import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { LeanUserProfile, UserProfile, TimelineEvent } from "@/lib/db/models";
import { getLocalProfileById, getLocalEvents } from "@/lib/db/fallback";
import { requireUserSession } from "@/lib/auth/session";
import { TimelineLike } from "@/lib/tdee";
import { dayKey, startOfDay } from "@/lib/dateUtils";
import { getCurrentWeek } from "@/lib/workoutPlans";

export const dynamic = "force-dynamic";

interface WorkoutSet {
  weight?: number;
  reps?: number;
  completed?: boolean;
}

interface WorkoutPayload {
  totalVolumeKg?: number;
  exercises?: { name: string; sets?: WorkoutSet[] }[];
}

export async function GET(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  try {
    const { userId, tz } = session;

    let profile: LeanUserProfile | null = null;
    let events: TimelineLike[] = [];

    // The review covers today and the six days before it.
    const startOfToday = startOfDay(tz);
    const startOfWeek = startOfDay(tz, 6);

    try {
      await connectDB();
      profile = await UserProfile.findById(userId).lean<LeanUserProfile>();
      if (profile) {
        events = await TimelineEvent.find({
          userId,
          timestamp: { $gte: startOfWeek },
        }).sort({ timestamp: 1 }).lean(); // Sort chronological ascending
      }
    } catch (dbError) {
      console.warn("Review could not reach MongoDB:", dbError);
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
      }
      profile = (await getLocalProfileById(userId)) as unknown as LeanUserProfile | null;
      if (profile) {
        const allEvents = await getLocalEvents({ userId });
        events = allEvents
          .filter((e) => new Date(e.timestamp).getTime() >= startOfWeek.getTime())
          .reverse(); // Convert descending to ascending chronological
      }
    }

    if (!profile) {
      return Response.json({ error: "User profile not found" }, { status: 404 });
    }

    // ── Metric Calculations ──

    // 1. Week Number since profile creation
    const createdDate = new Date(profile.createdAt || new Date());
    const diffMs = Date.now() - createdDate.getTime();
    const weekNumber = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)));

    // 2. Weight metrics
    const weightEvents = events.filter((e) => e.type === "weight");
    let startKg = null;
    let endKg = null;
    let deltaKg = null;

    if (weightEvents.length > 0) {
      startKg = Number(weightEvents[0].payload?.weightKg) || null;
      endKg = Number(weightEvents[weightEvents.length - 1].payload?.weightKg) || null;
      if (startKg !== null && endKg !== null) {
        deltaKg = Math.round((endKg - startKg) * 100) / 100;
      }
    } else {
      // Fallback: check profile weight
      startKg = profile.weightKg;
      endKg = profile.weightKg;
      deltaKg = 0;
    }

    // 3. Nutrition metrics
    const mealEvents = events.filter((e) => e.type === "meal");
    const dailyTotals: Record<string, { calories: number; protein: number }> = {};

    mealEvents.forEach((m) => {
      const dateStr = dayKey(m.timestamp, tz);
      if (!dailyTotals[dateStr]) {
        dailyTotals[dateStr] = { calories: 0, protein: 0 };
      }
      dailyTotals[dateStr].calories += Number(m.payload?.totalCalories) || 0;
      dailyTotals[dateStr].protein += Number(m.payload?.totalProteinG || m.payload?.totalProtein) || 0;
    });

    const loggedDates = Object.keys(dailyTotals);
    const daysLogged = loggedDates.length;

    let avgCalories = 0;
    let avgProteinG = 0;
    let calorieAdherence = 0;
    let proteinAdherence = 0;

    if (daysLogged > 0) {
      let totalCal = 0;
      let totalProt = 0;
      let calAdherentDays = 0;
      let protAdherentDays = 0;

      const targetCal = profile.targetCalories || 2000;
      const targetProt = profile.targetProteinG || 130;

      loggedDates.forEach((date) => {
        const day = dailyTotals[date];
        totalCal += day.calories;
        totalProt += day.protein;

        // ±15% Adherence ranges
        if (Math.abs(day.calories - targetCal) / targetCal <= 0.15) {
          calAdherentDays++;
        }
        if (Math.abs(day.protein - targetProt) / targetProt <= 0.15) {
          protAdherentDays++;
        }
      });

      avgCalories = Math.round(totalCal / daysLogged);
      avgProteinG = Math.round(totalProt / daysLogged);
      calorieAdherence = Math.round((calAdherentDays / daysLogged) * 100);
      proteinAdherence = Math.round((protAdherentDays / daysLogged) * 100);
    }

    // 4. Training metrics
    const workoutEvents = events.filter((e) => e.type === "workout");
    const sessionsCompleted = workoutEvents.length;
    let totalVolumeKg = 0;
    const exerciseVolumes: Record<string, number> = {};

    workoutEvents.forEach((w) => {
      const payload = (w.payload ?? {}) as WorkoutPayload;
      if (payload.totalVolumeKg) {
        totalVolumeKg += payload.totalVolumeKg;
      }
      
      // Calculate individual exercise volumes
      const exercises = payload.exercises || [];
      exercises.forEach((ex) => {
        const exName = ex.name;
        const sets = ex.sets || [];
        const exVol = sets
          .filter((s) => s.completed)
          .reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);

        if (exVol > 0) {
          exerciseVolumes[exName] = (exerciseVolumes[exName] || 0) + exVol;
          if (!payload.totalVolumeKg) {
            totalVolumeKg += exVol;
          }
        }
      });
    });

    // Determine top exercise
    let topExercise: string | null = null;
    let maxExVol = 0;
    Object.entries(exerciseVolumes).forEach(([name, vol]) => {
      if (vol > maxExVol) {
        maxExVol = vol;
        topExercise = name;
      }
    });

    // 5. Recovery metrics
    const sleepEvents = events.filter((e) => e.type === "sleep");
    const stepsEvents = events.filter((e) => e.type === "steps");

    // Group sleep by calendar day (latest event of the day takes precedence)
    const dailySleep: Record<string, number> = {};
    sleepEvents.forEach((s) => {
      dailySleep[dayKey(s.timestamp, tz)] = Number(s.payload?.hours) || 0;
    });

    const sleepDates = Object.keys(dailySleep);
    const daysWithSleep = sleepDates.length;
    const avgSleepHours = daysWithSleep > 0
      ? Math.round((sleepDates.reduce((sum, d) => sum + dailySleep[d], 0) / daysWithSleep) * 10) / 10
      : 0;

    // Group steps by calendar day (accumulating all steps logged in that day, supporting count or steps)
    const dailySteps: Record<string, number> = {};
    stepsEvents.forEach((s) => {
      const dateStr = dayKey(s.timestamp, tz);
      const count = Number(s.payload?.count || s.payload?.steps) || 0;
      dailySteps[dateStr] = (dailySteps[dateStr] || 0) + count;
    });

    const stepsDates = Object.keys(dailySteps);
    const daysWithSteps = stepsDates.length;
    const avgSteps = daysWithSteps > 0
      ? Math.round(stepsDates.reduce((sum, d) => sum + dailySteps[d], 0) / daysWithSteps)
      : 0;

    const review = {
      weekNumber,
      dateRange: {
        start: startOfWeek.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: tz }),
        end: startOfToday.toLocaleDateString("en-IN", { month: "short", day: "numeric", timeZone: tz }),
      },
      weight: {
        startKg,
        endKg,
        deltaKg,
      },
      nutrition: {
        avgCalories,
        avgProteinG,
        calorieAdherence,
        proteinAdherence,
        daysLogged,
      },
      training: {
        sessionsCompleted,
        totalVolumeKg,
        topExercise,
      },
      recovery: {
        avgSleepHours,
        avgSteps,
        daysWithSleep,
      },
      profile: {
        name: profile.name,
        targetCalories: profile.targetCalories,
        targetProteinG: profile.targetProteinG,
        goal: profile.goal,
        gymFrequency: Object.values(getCurrentWeek(profile as Parameters<typeof getCurrentWeek>[0])).filter((day) => day.exercises.length > 0).length,
      },
    };

    return Response.json({ review });
  } catch (error) {
    console.error("Weekly review API GET error:", error);
    return Response.json({ error: "Failed to generate weekly review" }, { status: 500 });
  }
}

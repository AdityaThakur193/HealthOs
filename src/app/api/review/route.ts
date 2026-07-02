import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfile, TimelineEvent } from "@/lib/db/models";
import { getLocalProfileById, getLocalEvents } from "@/lib/db/fallback";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    let profile: any = null;
    let events: any[] = [];

    // Calculate time window: last 7 days from start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);

    try {
      await connectDB();
      profile = await UserProfile.findById(userId).lean();
      if (profile) {
        events = await TimelineEvent.find({
          userId,
          timestamp: { $gte: startOfWeek },
        }).sort({ timestamp: 1 }).lean(); // Sort chronological ascending
      }
    } catch (dbError) {
      console.warn("⚠️ MongoDB connection failed on review API. Querying local file DB.");
      profile = await getLocalProfileById(userId);
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
      startKg = (weightEvents[0].payload as any).weightKg || null;
      endKg = (weightEvents[weightEvents.length - 1].payload as any).weightKg || null;
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
      const dateStr = new Date(m.timestamp).toDateString();
      if (!dailyTotals[dateStr]) {
        dailyTotals[dateStr] = { calories: 0, protein: 0 };
      }
      dailyTotals[dateStr].calories += (m.payload as any).totalCalories || 0;
      dailyTotals[dateStr].protein += (m.payload as any).totalProteinG || 0;
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
      const payload = w.payload as any;
      if (payload.totalVolumeKg) {
        totalVolumeKg += payload.totalVolumeKg;
      }
      
      // Calculate individual exercise volumes
      const exercises = payload.exercises || [];
      exercises.forEach((ex: any) => {
        const exName = ex.name;
        const sets = ex.sets || [];
        const exVol = sets
          .filter((s: any) => s.completed)
          .reduce((sum: number, s: any) => sum + (s.weight || 0) * (s.reps || 0), 0);

        if (exVol > 0) {
          exerciseVolumes[exName] = (exerciseVolumes[exName] || 0) + exVol;
          if (!payload.totalVolumeKg) {
            totalVolumeKg += exVol;
          }
        }
      });
    });

    // Determine top exercise
    let topExercise = null;
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

    const daysWithSleep = sleepEvents.length;
    const daysWithSteps = stepsEvents.length;

    const avgSleepHours = daysWithSleep > 0
      ? Math.round((sleepEvents.reduce((sum, s) => sum + ((s.payload as any).hours || 0), 0) / daysWithSleep) * 10) / 10
      : 0;

    const avgSteps = daysWithSteps > 0
      ? Math.round(stepsEvents.reduce((sum, s) => sum + ((s.payload as any).count || 0), 0) / daysWithSteps)
      : 0;

    const review = {
      weekNumber,
      dateRange: {
        start: startOfWeek.toLocaleDateString([], { month: "short", day: "numeric" }),
        end: startOfToday.toLocaleDateString([], { month: "short", day: "numeric" }),
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
      },
    };

    return Response.json({ review });
  } catch (error) {
    console.error("Weekly review API GET error:", error);
    return Response.json({ error: "Failed to generate weekly review" }, { status: 500 });
  }
}

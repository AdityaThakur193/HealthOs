import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { LeanUserProfile, TimelineEvent, UserProfile } from "@/lib/db/models";
import { getLocalEvents, getLocalProfileById } from "@/lib/db/fallback";
import { CoachContext, CoachRecommendation, generateDailyCoach } from "@/lib/gemini";
import { getTodaysWorkout } from "@/lib/workoutPlans";
import { calculateAdaptiveTdee, TimelineLike } from "@/lib/tdee";
import { buildRuleBasedCoach } from "@/lib/coachRules";
import { requireUserSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { dayKey, shiftDayKey, startOfDay, weekdayIndex } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const COACH_AI_CALLS_PER_HOUR = 30;

type DayName = "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
const WEEKDAYS: DayName[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function field(event: TimelineLike | undefined, ...keys: string[]): number {
  for (const key of keys) {
    const value = Number(event?.payload?.[key]);
    if (value) return value;
  }
  return 0;
}

function sum(events: TimelineLike[], ...keys: string[]): number {
  return events.reduce((total, event) => total + field(event, ...keys), 0);
}

function findActiveEvent(notes: TimelineLike[], tz?: string): CoachContext["activeEvent"] {
  const today = dayKey(new Date(), tz);
  const note = notes.find((candidate) => {
    const { startDate, endDate } = candidate.payload ?? {};
    if (!startDate || !endDate) return false;
    return dayKey(startDate as string, tz) <= today && today <= dayKey(endDate as string, tz);
  });
  if (!note?.payload) return null;
  return {
    title: String(note.payload.title ?? ""),
    event_type: note.payload.event_type as "exam" | "travel" | "sick",
    startDate: String(note.payload.startDate),
    endDate: String(note.payload.endDate),
  };
}

/**
 * POST /api/coach
 */
export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const { userId, tz } = session;
  const windowStart = startOfDay(tz, 14);

  let profile: LeanUserProfile | null = null;
  let recentEvents: TimelineLike[] = [];
  let notes: TimelineLike[] = [];
  let latestWeight: TimelineLike | undefined;

  try {
    try {
      await connectDB();
      profile = await UserProfile.findById(userId).lean<LeanUserProfile>();
      if (profile) {
        const [recent, noteEvents, weight] = await Promise.all([
          TimelineEvent.find({ userId, timestamp: { $gte: windowStart } }).select("-payload.imagePreview").lean(),
          TimelineEvent.find({ userId, type: "note" }).lean(),
          TimelineEvent.findOne({ userId, type: "weight" }).sort({ timestamp: -1 }).lean(),
        ]);
        recentEvents = recent;
        notes = noteEvents;
        latestWeight = weight ?? undefined;
      }
    } catch (dbError) {
      console.warn("Coach could not reach MongoDB:", dbError);
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
      }
      profile = (await getLocalProfileById(userId)) as unknown as LeanUserProfile | null;
      if (profile) {
        const all = await getLocalEvents({ userId });
        recentEvents = all.filter((event) => new Date(event.timestamp) >= windowStart);
        notes = all.filter((event) => event.type === "note");
        latestWeight = all.find((event) => event.type === "weight");
      }
    }

    if (!profile) {
      return Response.json({ error: "User profile not found" }, { status: 404 });
    }

    const todayKey = dayKey(new Date(), tz);
    const weekStartKey = shiftDayKey(todayKey, -6);
    const todayEvents = recentEvents.filter((event) => dayKey(event.timestamp, tz) === todayKey);
    const weekEvents = recentEvents.filter((event) => dayKey(event.timestamp, tz) >= weekStartKey);
    const ofType = (events: TimelineLike[], type: string) => events.filter((event) => event.type === type);

    const todayMeals = ofType(todayEvents, "meal");
    const todaySteps = ofType(todayEvents, "steps");
    const todaySleep = ofType(todayEvents, "sleep");

    const weekMeals = ofType(weekEvents, "meal");
    const weekSleeps = ofType(weekEvents, "sleep");
    const mealDays = new Set(weekMeals.map((meal) => dayKey(meal.timestamp, tz))).size || 1;

    const tdeeResult = calculateAdaptiveTdee(profile, recentEvents, tz);
    const dayIndex = weekdayIndex(new Date(), tz);
    const todayMessMenu = profile.messMenu?.parsedMenu?.[WEEKDAYS[dayIndex]] ?? null;

    const context: CoachContext = {
      profile: {
        name: profile.name,
        goal: profile.goal,
        targetCalories: profile.targetCalories || 2200,
        targetProteinG: profile.targetProteinG || 150,
        foodAllergies: profile.foodAllergies,
        medicalConditions: profile.medicalConditions,
        dietPreference: profile.dietPreference,
      },
      todayMessMenu,
      today: {
        caloriesConsumed: Math.round(sum(todayMeals, "totalCalories")),
        proteinConsumed: Math.round(sum(todayMeals, "totalProteinG", "totalProtein")),
        workoutCompleted: ofType(todayEvents, "workout").length > 0,
        scheduledWorkoutName: getTodaysWorkout(profile as Parameters<typeof getTodaysWorkout>[0], dayIndex).name,
        sleepHours: todaySleep.length ? field(todaySleep[todaySleep.length - 1], "hours") : null,
        stepsCount: todaySteps.length ? sum(todaySteps, "count", "steps") : null,
      },
      weekTrend: {
        avgCalories: Math.round(sum(weekMeals, "totalCalories") / mealDays),
        avgProtein: Math.round(sum(weekMeals, "totalProteinG", "totalProtein") / mealDays),
        workoutsCompleted: ofType(weekEvents, "workout").length,
        avgSleep: weekSleeps.length ? Math.round((sum(weekSleeps, "hours") / weekSleeps.length) * 10) / 10 : 0,
      },
      recentWeightKg: latestWeight ? field(latestWeight, "weightKg") : null,
      activeEvent: findActiveEvent(notes, tz),
      tdeeMode: tdeeResult.status,
      daysRemaining: tdeeResult.daysRemaining,
      avgCalories14d: tdeeResult.avgCalories,
      weightDeltaKg14d: tdeeResult.weightDeltaKg,
    };

    let recommendation: CoachRecommendation;
    try {
      if (!checkRateLimit(`coach:${userId}`, COACH_AI_CALLS_PER_HOUR, HOUR_MS)) {
        throw new Error("Coach AI rate limit reached");
      }
      recommendation = await generateDailyCoach(context);
    } catch (aiError) {
      console.warn("Coach AI unavailable, using rule-based coaching:", aiError);
      recommendation = buildRuleBasedCoach(context, profile);
    }

    return Response.json({ recommendation, context });
  } catch (error) {
    console.error("Coach POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

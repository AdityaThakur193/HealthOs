import type { LeanUserProfile } from "./db/models";
import type { CoachContext } from "./gemini";
import { dayKey, shiftDayKey, weekdayIndex } from "./dateUtils";
import { buildMealDayStatus, MealDayStatus, MealName, resolveMessTimings } from "./mealWindows";
import { calculateAdaptiveTdee, TimelineLike } from "./tdee";
import { getTodaysWorkout } from "./workoutPlans";

/**
 * Builds the single picture of the user's day that both coaches work from.
 * Everything here is calculated, so the AI never has to do the math.
 */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

export interface CoachInput {
  profile: LeanUserProfile;
  recentEvents: TimelineLike[];
  notes: TimelineLike[];
  latestWeight?: TimelineLike;
  tz?: string;
  now?: Date;
}

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

function coversToday(note: TimelineLike, today: string, tz?: string): boolean {
  const { startDate, endDate } = note.payload ?? {};
  if (!startDate || !endDate) return false;
  return dayKey(startDate as string, tz) <= today && today <= dayKey(endDate as string, tz);
}

function findActiveEvent(notes: TimelineLike[], today: string, tz?: string): CoachContext["activeEvent"] {
  // A holiday only changes mess hours. It doesn't lower the user's targets.
  const note = notes.find((candidate) => candidate.payload?.event_type !== "holiday" && coversToday(candidate, today, tz));
  if (!note?.payload) return null;
  return {
    title: String(note.payload.title ?? ""),
    event_type: note.payload.event_type as "exam" | "travel" | "sick",
    startDate: String(note.payload.startDate),
    endDate: String(note.payload.endDate),
  };
}

/** Mess hours only apply to people who actually eat at a mess. */
function usesMess(profile: LeanUserProfile): boolean {
  return !profile.messAccess || profile.messAccess === "hostel_mess";
}

function remainingMenu(
  menu: Record<string, string> | null | undefined,
  mealTiming: MealDayStatus | null
): CoachContext["todayMessMenu"] {
  if (!menu || !mealTiming) return menu ?? null;
  const open = mealTiming.meals.filter((meal) => meal.state !== "closed").map((meal) => meal.meal);
  const entries = open.filter((meal) => menu[meal]).map((meal: MealName) => [meal, menu[meal]]);
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export function buildCoachContext(input: CoachInput): CoachContext {
  const { profile, recentEvents, notes, latestWeight, tz } = input;
  const now = input.now ?? new Date();

  const todayKey = dayKey(now, tz);
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

  const mealTiming = usesMess(profile)
    ? buildMealDayStatus({
        now,
        tz,
        timings: resolveMessTimings(profile.messTimings),
        isHoliday: notes.some((note) => note.payload?.event_type === "holiday" && coversToday(note, todayKey, tz)),
        mealLogs: todayMeals.map((meal) => ({ timestamp: meal.timestamp, mealType: meal.payload?.mealType })),
      })
    : null;

  const tdee = calculateAdaptiveTdee(profile, recentEvents, tz);
  const dayIndex = weekdayIndex(now, tz);
  const todaysMenu = profile.messMenu?.parsedMenu?.[WEEKDAYS[dayIndex]] as Record<string, string> | undefined;

  return {
    profile: {
      name: profile.name,
      goal: profile.goal,
      targetCalories: profile.targetCalories || 2200,
      targetProteinG: profile.targetProteinG || 150,
      foodAllergies: profile.foodAllergies,
      medicalConditions: profile.medicalConditions,
      dietPreference: profile.dietPreference,
      strictMessOnly: profile.strictMessOnly,
    },
    mealTiming,
    todayMessMenu: remainingMenu(todaysMenu, mealTiming),
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
    activeEvent: findActiveEvent(notes, todayKey, tz),
    tdeeMode: tdee.status,
    daysRemaining: tdee.daysRemaining,
    avgCalories14d: tdee.avgCalories,
    weightDeltaKg14d: tdee.weightDeltaKg,
  };
}

/** Changes only when the coach would have something new to say. */
export function coachFingerprint(context: CoachContext, todayKey: string): string {
  return JSON.stringify({
    todayKey,
    today: context.today,
    activeEvent: context.activeEvent?.event_type ?? null,
    meals: context.mealTiming?.meals.map((meal) => [meal.meal, meal.state, meal.logged]) ?? null,
    menu: context.todayMessMenu ?? null,
    targets: [context.profile.targetCalories, context.profile.targetProteinG],
  });
}

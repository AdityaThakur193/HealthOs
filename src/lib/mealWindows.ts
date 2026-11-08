import { dayKey, minutesIntoDay, weekdayOfKey } from "./dateUtils";

/**
 * Mess meal hours, and what is still possible today.
 *
 * Code decides which meals are open so that advice can never point at a meal
 * the user can no longer get.
 */

export const MEAL_NAMES = ["breakfast", "lunch", "snacks", "dinner"] as const;
export type MealName = (typeof MEAL_NAMES)[number];

export interface MealWindow {
  start: string; // 24-hour HH:MM
  end: string;
}

export type MealSchedule = Record<MealName, MealWindow>;

export interface MessTimings {
  /** Monday to Saturday. */
  regular: MealSchedule;
  /** Sundays and days marked as a holiday. */
  holiday: MealSchedule;
}

const REGULAR_SCHEDULE: MealSchedule = {
  breakfast: { start: "07:00", end: "09:00" },
  lunch: { start: "11:30", end: "14:00" },
  snacks: { start: "16:30", end: "18:00" },
  dinner: { start: "19:30", end: "21:30" },
};

export const DEFAULT_MESS_TIMINGS: MessTimings = {
  regular: REGULAR_SCHEDULE,
  holiday: { ...REGULAR_SCHEDULE, breakfast: { start: "07:30", end: "09:30" } },
};

function resolveSchedule(saved: Partial<MealSchedule> | undefined, fallback: MealSchedule): MealSchedule {
  return Object.fromEntries(MEAL_NAMES.map((meal) => [meal, saved?.[meal] ?? fallback[meal]])) as MealSchedule;
}

/** Fills anything a profile has not saved with the default hours. */
export function resolveMessTimings(saved?: { regular?: Partial<MealSchedule>; holiday?: Partial<MealSchedule> } | null): MessTimings {
  return {
    regular: resolveSchedule(saved?.regular, DEFAULT_MESS_TIMINGS.regular),
    holiday: resolveSchedule(saved?.holiday, DEFAULT_MESS_TIMINGS.holiday),
  };
}

export function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

const toMinutes = minutesFromTime;

/** "19:30" becomes "7:30 PM". */
export function formatMealTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const hour12 = hours % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export function isValidMealWindow(window: unknown): window is MealWindow {
  const candidate = window as MealWindow | null;
  const pattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  return (
    !!candidate &&
    typeof candidate.start === "string" &&
    typeof candidate.end === "string" &&
    pattern.test(candidate.start) &&
    pattern.test(candidate.end) &&
    toMinutes(candidate.start) < toMinutes(candidate.end)
  );
}

export type MealState = "open" | "upcoming" | "closed";

export interface MealStatus {
  meal: MealName;
  start: string;
  end: string;
  hours: string;
  state: MealState;
  logged: boolean;
}

export interface MealDayStatus {
  localTime: string;
  /** The same time as 24-hour HH:MM, for calculations. */
  localClock: string;
  dayType: "regular" | "sunday_or_holiday";
  meals: MealStatus[];
  currentMeal: MealName | null;
  nextMeal: MealName | null;
  messClosedForToday: boolean;
}

function normalizeMealType(mealType: unknown): MealName | null {
  if (typeof mealType !== "string") return null;
  const lowered = mealType.toLowerCase();
  if (lowered.includes("breakfast")) return "breakfast";
  if (lowered.includes("lunch")) return "lunch";
  if (lowered.includes("snack")) return "snacks";
  if (lowered.includes("dinner")) return "dinner";
  return null;
}

/** Which meal a log belongs to: its stated type, else the window nearest its time. */
export function inferMealName(minutes: number, schedule: MealSchedule, mealType?: unknown): MealName {
  const stated = normalizeMealType(mealType);
  if (stated) return stated;

  let nearest: MealName = "breakfast";
  let smallestGap = Infinity;
  for (const meal of MEAL_NAMES) {
    const start = toMinutes(schedule[meal].start);
    const end = toMinutes(schedule[meal].end);
    const gap = minutes < start ? start - minutes : minutes > end ? minutes - end : 0;
    if (gap < smallestGap) {
      smallestGap = gap;
      nearest = meal;
    }
  }
  return nearest;
}

export function isSundayOrHoliday(now: Date, tz: string | undefined, isHoliday: boolean): boolean {
  return isHoliday || weekdayOfKey(dayKey(now, tz)) === 0;
}

export function buildMealDayStatus(options: {
  now: Date;
  tz?: string;
  timings: MessTimings;
  isHoliday: boolean;
  mealLogs: { timestamp: Date | string; mealType?: unknown }[];
}): MealDayStatus {
  const { now, tz, timings, isHoliday, mealLogs } = options;
  const special = isSundayOrHoliday(now, tz, isHoliday);
  const schedule = special ? timings.holiday : timings.regular;
  const current = minutesIntoDay(now, tz);

  const loggedMeals = new Set(
    mealLogs.map((log) => inferMealName(minutesIntoDay(new Date(log.timestamp), tz), schedule, log.mealType))
  );

  const meals: MealStatus[] = MEAL_NAMES.map((meal) => {
    const { start, end } = schedule[meal];
    const state: MealState =
      current < toMinutes(start) ? "upcoming" : current < toMinutes(end) ? "open" : "closed";
    return {
      meal,
      start,
      end,
      hours: `${formatMealTime(start)} to ${formatMealTime(end)}`,
      state,
      logged: loggedMeals.has(meal),
    };
  });

  const currentMeal = meals.find((status) => status.state === "open")?.meal ?? null;
  const nextMeal = meals.find((status) => status.state === "upcoming")?.meal ?? null;

  const localClock = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;

  return {
    localTime: formatMealTime(localClock),
    localClock,
    dayType: special ? "sunday_or_holiday" : "regular",
    meals,
    currentMeal,
    nextMeal,
    messClosedForToday: !currentMeal && !nextMeal,
  };
}

/** Sentences that tell the user to eat at a meal that has already closed. */
export function pointsAtClosedMeal(texts: string[], status: MealDayStatus): boolean {
  const closed = status.meals.filter((meal) => meal.state === "closed").map((meal) => meal.meal.replace(/s$/, ""));
  if (closed.length === 0) return false;

  const closedPattern = new RegExp(`\\b(${closed.join("|")})s?\\b`, "i");
  const pastOrFuture = /\b(tomorrow|yesterday|missed|skipped|logged|earlier|already|had)\b/i;

  return texts
    .flatMap((text) => text.split(/(?<=[.!?])\s+/))
    .some((sentence) => closedPattern.test(sentence) && !pastOrFuture.test(sentence));
}

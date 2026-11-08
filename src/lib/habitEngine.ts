/**
 * Dynamic Custom Habit Engine & Loop Exponential Smoothing Score Algorithm
 *
 * Implements exponential smoothing for Habit Strength % (0% - 100%)
 * so missed days cause graceful score decay rather than catastrophic streak resets.
 */

import { dayKey, shiftDayKey, weekdayOfKey } from "./dateUtils";

export interface HabitLogEntry {
  date: string; // YYYY-MM-DD
  completed: boolean;
  value?: number;
}

export interface HabitDefinition {
  id: string;
  userId: string;
  title: string;
  category: "Spiritual" | "Health" | "Career" | "Self Growth" | "Misc" | string;
  targetType: "boolean" | "numeric" | "duration";
  targetValue: number; // Default 1 for boolean
  unit?: string; // e.g. "problems", "mins", "ml"
  frequency: "daily" | "weekdays" | "weekly_count";
  weeklyTargetCount?: number; // Default 7 for daily
  colorTag: string; // HSL/Hex color tag
  icon: string; // Lucide icon name
  status: "active" | "archived";
  notes?: string;
  sortOrder: number;
  createdAt: string;
}

type HeatmapStatus = "completed" | "partial" | "missed" | "none";

export interface HabitWithStats extends HabitDefinition {
  habitStrength: number; // 0 to 100 %
  currentStreak: number; // Days
  bestStreak: number;
  completedToday: boolean;
  todayValue: number;
  heatmap30Days: Array<{ date: string; status: HeatmapStatus; val: number }>;
}

/**
 * Formats a Date as YYYY-MM-DD in the given timezone (runtime local by default).
 */
export function formatDateKey(date: Date = new Date(), tz?: string): string {
  return dayKey(date, tz);
}

/**
 * Calculates Habit Strength (0 - 100%) using Loop Habit Tracker's
 * Exponentially Weighted Moving Average (EWMA) algorithm.
 * Formula: Strength_t = Strength_{t-1} * (1 - α) + Execution_t * α
 * α = 0.1 (halflife ~ 6.5 days)
 */
export function calculateHabitStrength(logs: HabitLogEntry[], targetValue: number = 1, tz?: string): number {
  if (!logs || logs.length === 0) return 0;

  const logMap = new Map(logs.map((log) => [log.date, log]));
  const alpha = 0.1;
  const today = dayKey(new Date(), tz);
  let strength = 0;

  for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
    const entry = logMap.get(shiftDayKey(today, -daysAgo));

    let execution = 0;
    if (entry?.completed) {
      execution = 1;
    } else if (entry?.value && entry.value > 0) {
      execution = Math.min(1, entry.value / Math.max(1, targetValue));
    }

    strength = strength * (1 - alpha) + execution * alpha;
  }

  return Math.round(Math.min(100, Math.max(0, strength * 100)));
}

type Frequency = HabitDefinition["frequency"];

function previousDay(key: string, frequency: Frequency): string {
  let previous = shiftDayKey(key, -1);
  if (frequency === "weekdays") {
    while ([0, 6].includes(weekdayOfKey(previous))) previous = shiftDayKey(previous, -1);
  }
  return previous;
}

function calculateBestStreak(completedDates: Set<string>, frequency: Frequency): number {
  let best = 0;
  for (const date of completedDates) {
    // Only walk forward from the first day of each run.
    const isScheduled = frequency !== "weekdays" || ![0, 6].includes(weekdayOfKey(date));
    if (!isScheduled || completedDates.has(previousDay(date, frequency))) continue;

    let length = 1;
    let cursor = date;
    for (;;) {
      let next = shiftDayKey(cursor, 1);
      if (frequency === "weekdays") {
        while ([0, 6].includes(weekdayOfKey(next))) next = shiftDayKey(next, 1);
      }
      if (!completedDates.has(next)) break;
      length++;
      cursor = next;
    }
    best = Math.max(best, length);
  }
  return best;
}

/**
 * Consecutive completion streak with a one-day freeze. Today only counts once
 * it is done, so an unfinished today never breaks a streak.
 */
export function calculateCurrentStreak(
  logs: HabitLogEntry[],
  frequency: Frequency = "daily",
  targetValue: number = 1,
  tz?: string
): { currentStreak: number; bestStreak: number; freezeUsed?: boolean } {
  if (!logs || logs.length === 0) return { currentStreak: 0, bestStreak: 0, freezeUsed: false };

  const completedDates = new Set(
    logs.filter((log) => log.completed || (log.value && log.value >= targetValue)).map((log) => log.date)
  );
  if (completedDates.size === 0) return { currentStreak: 0, bestStreak: 0, freezeUsed: false };

  const earliest = [...completedDates].sort()[0];
  const today = dayKey(new Date(), tz);

  let cursor = completedDates.has(today) ? today : previousDay(today, frequency);
  let freezesAvailable = 1;
  let freezeUsed = false;
  let streak = 0;

  while (cursor >= earliest) {
    if (completedDates.has(cursor)) {
      streak++;
    } else if (freezesAvailable > 0) {
      freezesAvailable--;
      freezeUsed = true;
    } else {
      break;
    }
    cursor = previousDay(cursor, frequency);
  }

  return {
    currentStreak: streak,
    bestStreak: Math.max(streak, calculateBestStreak(completedDates, frequency)),
    freezeUsed: freezeUsed && streak > 0,
  };
}

function weekStart(key: string): string {
  return shiftDayKey(key, -((weekdayOfKey(key) + 6) % 7));
}

/** Consecutive weeks (Monday to Sunday) that reached the weekly goal. */
export function calculateWeeklyStreak(
  logs: HabitLogEntry[],
  weeklyTarget: number,
  targetValue: number = 1,
  tz?: string
): { currentStreak: number; bestStreak: number } {
  const perWeek = new Map<string, number>();
  logs
    .filter((log) => log.completed || (log.value && log.value >= targetValue))
    .forEach((log) => perWeek.set(weekStart(log.date), (perWeek.get(weekStart(log.date)) ?? 0) + 1));

  const reached = (week: string) => (perWeek.get(week) ?? 0) >= weeklyTarget;

  // The current week still has time, so it only counts once the goal is met.
  const thisWeek = weekStart(dayKey(new Date(), tz));
  let cursor = reached(thisWeek) ? thisWeek : shiftDayKey(thisWeek, -7);
  let currentStreak = 0;
  while (reached(cursor)) {
    currentStreak++;
    cursor = shiftDayKey(cursor, -7);
  }

  let bestStreak = 0;
  for (const week of perWeek.keys()) {
    if (!reached(week) || reached(shiftDayKey(week, -7))) continue;
    let length = 0;
    for (let run = week; reached(run); run = shiftDayKey(run, 7)) length++;
    bestStreak = Math.max(bestStreak, length);
  }

  return { currentStreak, bestStreak };
}

export function isHydrationHabit(habit: { habitId?: string; id?: string; title?: string; unit?: string }): boolean {
  const id = habit.habitId || habit.id;
  return id === "habit_hydration" || (/water|hydrat/i.test(habit.title ?? "") && /^(l|litres?|liters?)$/i.test(habit.unit ?? ""));
}

/** Counts water already logged, so hydration never has to be entered twice. */
export function mergeWaterIntoHydration(logs: HabitLogEntry[], waterByDay: Map<string, number>, targetValue: number): HabitLogEntry[] {
  const merged = new Map(logs.map((log) => [log.date, log]));
  for (const [date, litres] of waterByDay) {
    const existing = merged.get(date);
    const value = Math.round(Math.max(existing?.value ?? 0, litres) * 100) / 100;
    merged.set(date, { date, value, completed: Boolean(existing?.completed) || value >= targetValue });
  }
  return [...merged.values()];
}

/**
 * Generates 30-day heatmap grid array
 */
export function get30DayHeatmap(
  logs: HabitLogEntry[],
  targetValue: number = 1,
  tz?: string
): Array<{ date: string; status: HeatmapStatus; val: number }> {
  const logMap = new Map((logs || []).map((log) => [log.date, log]));
  const today = dayKey(new Date(), tz);
  const result: Array<{ date: string; status: HeatmapStatus; val: number }> = [];

  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const key = shiftDayKey(today, -daysAgo);
    const entry = logMap.get(key);

    let status: HeatmapStatus = "none";
    let val = 0;

    if (entry) {
      val = entry.value || (entry.completed ? targetValue : 0);
      if (entry.completed || val >= targetValue) {
        status = "completed";
      } else if (val > 0) {
        status = "partial";
      } else {
        status = "missed";
      }
    }

    result.push({ date: key, status, val });
  }

  return result;
}

/**
 * Preset starter templates users can customize or delete.
 * Focused 100% on physical health, nutrition, sleep, and recovery.
 */
export function getStarterHabits(userId: string): HabitDefinition[] {
  const now = new Date().toISOString();
  return [
    {
      id: "habit_mess_clean",
      userId,
      title: "Clean Nutrition (No Outside Junk)",
      category: "Health",
      targetType: "boolean",
      targetValue: 1,
      frequency: "daily",
      colorTag: "#34d399", // Emerald Green
      icon: "Soup",
      status: "active",
      notes: "Stick to clean mess & planned meals without unlogged junk snacks",
      sortOrder: 1,
      createdAt: now,
    },
    {
      id: "habit_hydration",
      userId,
      title: "3.5L Daily Hydration",
      category: "Health",
      targetType: "numeric",
      targetValue: 3.5,
      unit: "L",
      frequency: "daily",
      colorTag: "#38bdf8", // Sky Blue
      icon: "Droplet",
      status: "active",
      notes: "Maintain optimal hydration for metabolic performance",
      sortOrder: 2,
      createdAt: now,
    },
    {
      id: "habit_sleep_hygiene",
      userId,
      title: "Screen-Free 30m Before Bed",
      category: "Health",
      targetType: "boolean",
      targetValue: 1,
      frequency: "daily",
      colorTag: "#a78bfa", // Purple
      icon: "Moon",
      status: "active",
      notes: "Wind down without blue light for deep sleep recovery",
      sortOrder: 3,
      createdAt: now,
    },
    {
      id: "habit_mindful_stretch",
      userId,
      title: "10m Stretch & Mobility",
      category: "Health",
      targetType: "boolean",
      targetValue: 1,
      frequency: "daily",
      colorTag: "#fbbf24", // Amber
      icon: "TrendingUp",
      status: "active",
      notes: "Morning or post-workout mobility to prevent stiffness & injury",
      sortOrder: 4,
      createdAt: now,
    },
  ];
}

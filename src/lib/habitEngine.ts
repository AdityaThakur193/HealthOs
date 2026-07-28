/**
 * Dynamic Custom Habit Engine & Loop Exponential Smoothing Score Algorithm
 *
 * Implements exponential smoothing for Habit Strength % (0% - 100%)
 * so missed days cause graceful score decay rather than catastrophic streak resets.
 */

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

export interface HabitWithStats extends HabitDefinition {
  habitStrength: number; // 0 to 100 %
  currentStreak: number; // Days
  bestStreak: number;
  completedToday: boolean;
  todayValue: number;
  heatmap30Days: Array<{ date: string; status: "completed" | "partial" | "missed" | "none"; val: number }>;
}

/**
 * Formats a Date object as YYYY-MM-DD in local timezone
 */
export function formatDateKey(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculates Habit Strength (0 - 100%) using Loop Habit Tracker's
 * Exponentially Weighted Moving Average (EWMA) algorithm.
 * Formula: Strength_t = Strength_{t-1} * (1 - α) + Execution_t * α
 * α = 0.1 (halflife ~ 6.5 days)
 */
export function calculateHabitStrength(logs: HabitLogEntry[], targetValue: number = 1): number {
  if (!logs || logs.length === 0) return 0;

  const logMap = new Map<string, HabitLogEntry>();
  logs.forEach((l) => logMap.set(l.date, l));

  const alpha = 0.1;
  let strength = 0;

  // Process the past 90 days in chronological order
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    const entry = logMap.get(key);

    let execution = 0;
    if (entry && entry.completed) {
      execution = 1;
    } else if (entry && entry.value && entry.value > 0) {
      execution = Math.min(1, entry.value / Math.max(1, targetValue));
    }

    strength = strength * (1 - alpha) + execution * alpha;
  }

  return Math.round(Math.min(100, Math.max(0, strength * 100)));
}

/**
 * Calculates consecutive daily/weekday completion streak count
 */
export function calculateCurrentStreak(
  logs: HabitLogEntry[],
  frequency: "daily" | "weekdays" | "weekly_count" = "daily"
): { currentStreak: number; bestStreak: number } {
  if (!logs || logs.length === 0) return { currentStreak: 0, bestStreak: 0 };

  const completedDates = new Set<string>();
  logs.forEach((l) => {
    if (l.completed || (l.value && l.value > 0)) {
      completedDates.add(l.date);
    }
  });

  const today = new Date();
  const todayKey = formatDateKey(today);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = formatDateKey(yesterday);

  // Determine starting anchor date for current streak (today or yesterday)
  let checkDate = new Date(today);
  if (!completedDates.has(todayKey) && !completedDates.has(yesterdayKey)) {
    // If not checked today or yesterday, check if yesterday was weekend for weekdays habit
    if (frequency === "weekdays") {
      const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon
      if (dayOfWeek === 1) { // Monday
        const friday = new Date(today);
        friday.setDate(friday.getDate() - 3);
        const fridayKey = formatDateKey(friday);
        if (!completedDates.has(todayKey) && !completedDates.has(fridayKey)) {
          return { currentStreak: 0, bestStreak: calculateBestStreak(completedDates) };
        }
        checkDate = completedDates.has(todayKey) ? today : friday;
      } else {
        return { currentStreak: 0, bestStreak: calculateBestStreak(completedDates) };
      }
    } else {
      return { currentStreak: 0, bestStreak: calculateBestStreak(completedDates) };
    }
  } else if (!completedDates.has(todayKey) && completedDates.has(yesterdayKey)) {
    checkDate = yesterday;
  }

  let streak = 0;
  const curr = new Date(checkDate);

  while (true) {
    const key = formatDateKey(curr);
    const isWeekend = curr.getDay() === 0 || curr.getDay() === 6;

    if (frequency === "weekdays" && isWeekend) {
      // Skip weekend check for weekday habits
      curr.setDate(curr.getDate() - 1);
      continue;
    }

    if (completedDates.has(key)) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }

  const bestStreak = Math.max(streak, calculateBestStreak(completedDates));
  return { currentStreak: streak, bestStreak };
}

/**
 * Helper to calculate best historical consecutive streak
 */
function calculateBestStreak(completedDatesSet: Set<string>): number {
  if (completedDatesSet.size === 0) return 0;

  const sortedDates = Array.from(completedDatesSet)
    .map((d) => new Date(d).getTime())
    .sort((a, b) => a - b);

  let best = 1;
  let curr = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const diffDays = Math.round((sortedDates[i] - sortedDates[i - 1]) / (1000 * 3600 * 24));
    if (diffDays === 1) {
      curr++;
      best = Math.max(best, curr);
    } else if (diffDays > 1) {
      curr = 1;
    }
  }

  return best;
}

/**
 * Generates 30-day heatmap grid array
 */
export function get30DayHeatmap(
  logs: HabitLogEntry[],
  targetValue: number = 1
): Array<{ date: string; status: "completed" | "partial" | "missed" | "none"; val: number }> {
  const logMap = new Map<string, HabitLogEntry>();
  if (logs) logs.forEach((l) => logMap.set(l.date, l));

  const result = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);
    const entry = logMap.get(key);

    let status: "completed" | "partial" | "missed" | "none" = "none";
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
 * Preset starter templates users can customize or delete
 */
export function getStarterHabits(userId: string): HabitDefinition[] {
  const now = new Date().toISOString();
  return [
    {
      id: "habit_pray_5",
      userId,
      title: "Pray 5 Times Daily",
      category: "Spiritual",
      targetType: "numeric",
      targetValue: 5,
      unit: "prayers",
      frequency: "daily",
      colorTag: "#a78bfa", // Purple
      icon: "Sparkles",
      status: "active",
      notes: "Daily 5 prayers for spiritual discipline",
      sortOrder: 1,
      createdAt: now,
    },
    {
      id: "habit_mess_food",
      userId,
      title: "Only Mess Food (No Junk)",
      category: "Health",
      targetType: "boolean",
      targetValue: 1,
      frequency: "daily",
      colorTag: "#34d399", // Emerald Green
      icon: "Soup",
      status: "active",
      notes: "Stick to clean mess meals without outside junk",
      sortOrder: 2,
      createdAt: now,
    },
    {
      id: "habit_leetcode",
      userId,
      title: "Min 5 Leetcode Problems",
      category: "Career",
      targetType: "numeric",
      targetValue: 5,
      unit: "problems",
      frequency: "daily",
      colorTag: "#38bdf8", // Sky Blue
      icon: "Code",
      status: "active",
      notes: "Consistent DSA problem solving for interview prep",
      sortOrder: 3,
      createdAt: now,
    },
    {
      id: "habit_self_growth",
      userId,
      title: "Better Than Yesterday",
      category: "Self Growth",
      targetType: "boolean",
      targetValue: 1,
      frequency: "daily",
      colorTag: "#fbbf24", // Amber
      icon: "TrendingUp",
      status: "active",
      notes: "1% improvement in communication, skills, or mindset daily",
      sortOrder: 4,
      createdAt: now,
    },
  ];
}

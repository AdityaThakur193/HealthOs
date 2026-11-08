import { dayKey, shiftDayKey } from "./dateUtils";

/** Flexible payload shared by every timeline event type. */
export interface TimelinePayload {
  // Meals
  mealName?: string;
  mealType?: string;
  name?: string;
  foods?: { name: string; calories?: number; estimatedCalories?: number; proteinG?: number; carbsG?: number; fatG?: number }[];
  totalCalories?: number;
  totalProteinG?: number;
  totalProtein?: number;
  totalCarbsG?: number;
  totalFatG?: number;
  loggedVia?: string;
  // Body and recovery
  weightKg?: number;
  count?: number;
  steps?: number;
  caloriesBurned?: number;
  hours?: number;
  // Water
  amountL?: number;
  amountMl?: number;
  waterL?: number;
  glasses?: number;
  isConsolidated?: boolean;
  originalEventIds?: string[];
  subEvents?: TimelineEntry[];
  // Workouts
  workoutName?: string;
  totalVolumeKg?: number;
  volumeKg?: number;
  completedSets?: number;
  exercises?: {
    id?: string;
    name: string;
    sets?: { weight?: number; reps?: number; completed?: boolean }[];
  }[];
  // Notes and calendar events
  title?: string;
  event_type?: "exam" | "travel" | "sick" | "holiday";
  startDate?: string;
  endDate?: string;
  // Habits
  habitId?: string;
  date?: string;
  value?: number;
  unit?: string;
}

/** A timeline event as returned by the API. */
export interface TimelineEntry {
  _id: string;
  id?: string;
  type: string;
  timestamp: string;
  payload: TimelinePayload;
  source?: string;
}

export type GroupedEvents = [string, TimelineEntry[]][];

function waterLitres(payload: TimelinePayload): number {
  return Number(payload.amountL || payload.waterL || (payload.amountMl ? payload.amountMl / 1000 : 0)) || 0;
}

/**
 * Groups timeline events by date string and consolidates multiple water events into single entries
 */
export function getGroupedEvents(events: TimelineEntry[]): GroupedEvents {
  const groups: Record<string, TimelineEntry[]> = {};

  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  sortedEvents.forEach((event) => {
    const dateStr = new Date(event.timestamp).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    (groups[dateStr] ||= []).push(event);
  });

  return Object.entries(groups).map(([dateStr, dayEvents]) => {
    const waterEvents = dayEvents.filter((e) => e.type === "water");
    if (waterEvents.length === 0) return [dateStr, dayEvents];

    const totalAmount = waterEvents.reduce((sum, e) => sum + waterLitres(e.payload), 0);
    const consolidated: TimelineEntry = {
      _id: `consolidated_water_${dateStr}`,
      type: "water",
      timestamp: waterEvents[0].timestamp,
      payload: {
        amountL: Math.round(totalAmount * 10) / 10,
        isConsolidated: true,
        originalEventIds: waterEvents.map((e) => String(e._id || e.id)),
        subEvents: waterEvents,
      },
    };
    return [dateStr, [...dayEvents.filter((e) => e.type !== "water"), consolidated]];
  });
}

/**
 * Consecutive days with at least one log. A streak stays alive through today
 * until the day ends, so it may end on yesterday.
 */
export function calculateLoggingStreak(timestamps: (Date | string)[], tz?: string, now: Date = new Date()): number {
  const days = new Set(timestamps.map((timestamp) => dayKey(timestamp, tz)));
  const today = dayKey(now, tz);

  let cursor = days.has(today) ? today : shiftDayKey(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftDayKey(cursor, -1);
  }
  return streak;
}

/** Totals for one calendar day, shown on the dashboard. */
export function aggregateDailyEvents(events: Pick<TimelineEntry, "type" | "timestamp" | "payload">[], targetDate: Date = new Date(), bmr: number = 0) {
  const targetDay = targetDate.toDateString();
  const totals = { calories: 0, protein: 0, carbs: 0, fats: 0, sleep: 0, steps: 0, water: 0, burned: 0 };
  let workoutDone = false;

  const sumFoods = (payload: TimelinePayload, key: "carbsG" | "fatG") =>
    payload.foods?.reduce((sum, food) => sum + (Number(food[key]) || 0), 0) || 0;

  for (const { type, timestamp, payload } of events) {
    if (new Date(timestamp).toDateString() !== targetDay) continue;

    if (type === "meal") {
      totals.calories += payload.totalCalories || 0;
      totals.protein += payload.totalProteinG || payload.totalProtein || 0;
      totals.carbs += payload.totalCarbsG || sumFoods(payload, "carbsG");
      totals.fats += payload.totalFatG || sumFoods(payload, "fatG");
    } else if (type === "workout") {
      workoutDone = true;
      totals.burned += Number(payload.caloriesBurned) || 0;
    } else if (type === "sleep") {
      totals.sleep = Number(payload.hours) || 0;
    } else if (type === "steps") {
      const count = Number(payload.count || payload.steps) || 0;
      totals.steps += count;
      totals.burned += Number(payload.caloriesBurned) || Math.round(count * 0.04);
    } else if (type === "water") {
      totals.water += waterLitres(payload);
    }
  }

  return {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein),
    carbs: Math.round(totals.carbs),
    fats: Math.round(totals.fats),
    workoutDone,
    sleepHours: Math.round(totals.sleep * 10) / 10,
    steps: Math.round(totals.steps),
    waterL: Math.round(totals.water * 10) / 10,
    burnedToday: Math.round(bmr + totals.burned),
  };
}

/** Fetches every timeline event for the signed-in user, page by page. */
export async function fetchAllTimelineEvents(): Promise<TimelineEntry[]> {
  const pageSize = 500;
  const maxPages = 20;
  const all: TimelineEntry[] = [];
  let before: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const query = `limit=${pageSize}&t=${Date.now()}${before ? `&before=${encodeURIComponent(before)}` : ""}`;
    const res = await fetch(`/api/timeline?${query}`, { cache: "no-store" });
    if (!res.ok) break;
    const data = await res.json();
    const events: TimelineEntry[] = data.events || [];
    all.push(...events);
    if (!data.hasMore || events.length === 0) break;
    before = events[events.length - 1].timestamp;
  }

  return all;
}

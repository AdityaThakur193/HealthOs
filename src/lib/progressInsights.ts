import { dayKey, shiftDayKey } from "./dateUtils";
import type { TimelineEntry } from "./timelineUtils";

/**
 * Plain calculations behind the Journey and Weekly Review pages.
 */

const TREND_SMOOTHING = 0.25;

/** Smooths daily weigh-ins so water swings don't look like real change. */
export function weightTrendSeries(weights: number[], smoothing: number = TREND_SMOOTHING): number[] {
  const trend: number[] = [];
  weights.forEach((weight, index) => {
    trend.push(index === 0 ? weight : Math.round((trend[index - 1] + smoothing * (weight - trend[index - 1])) * 100) / 100);
  });
  return trend;
}

export interface NutritionPeriod {
  avgCalories: number;
  avgProteinG: number;
  daysLogged: number;
}

function summarize(days: Map<string, { calories: number; protein: number }>, keys: string[]): NutritionPeriod {
  const logged = keys.map((key) => days.get(key)).filter((day): day is { calories: number; protein: number } => Boolean(day));
  const count = logged.length;
  return {
    avgCalories: count ? Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / count) : 0,
    avgProteinG: count ? Math.round(logged.reduce((sum, day) => sum + day.protein, 0) / count) : 0,
    daysLogged: count,
  };
}

/**
 * The last seven finished days against the seven before. Today is left out
 * because it isn't over yet, and unlogged days aren't counted as zero.
 */
export function compareNutritionWeeks(
  events: Pick<TimelineEntry, "type" | "timestamp" | "payload">[],
  now: Date = new Date(),
  tz?: string
): { recent: NutritionPeriod; previous: NutritionPeriod } {
  const days = new Map<string, { calories: number; protein: number }>();
  for (const event of events) {
    if (event.type !== "meal") continue;
    const key = dayKey(event.timestamp, tz);
    const day = days.get(key) ?? { calories: 0, protein: 0 };
    day.calories += Number(event.payload.totalCalories) || 0;
    day.protein += Number(event.payload.totalProteinG || event.payload.totalProtein) || 0;
    days.set(key, day);
  }

  const today = dayKey(now, tz);
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => shiftDayKey(today, -(from + index)));

  return { recent: summarize(days, range(1, 7)), previous: summarize(days, range(8, 14)) };
}

export interface ReviewNumbers {
  weight: { deltaKg: number | null };
  nutrition: { avgProteinG: number; proteinAdherence: number; daysLogged: number };
  training: { sessionsCompleted: number; totalVolumeKg: number };
  recovery: { avgSleepHours: number; avgSteps: number; daysWithSleep: number };
  profile: { targetProteinG: number; goal: string; gymFrequency: number };
}

const MAX_ACTIONS = 3;

/** Up to three specific things to do next week, most useful first. */
export function buildNextWeekActions(review: ReviewNumbers): string[] {
  const { weight, nutrition, training, recovery, profile } = review;
  const actions: string[] = [];

  if (nutrition.daysLogged < 5) {
    actions.push(`You logged meals on ${nutrition.daysLogged} of 7 days. Aim for at least 5 next week, including the weekend.`);
  }

  if (nutrition.daysLogged > 0 && nutrition.proteinAdherence < 70) {
    const gap = Math.max(0, Math.round(profile.targetProteinG - nutrition.avgProteinG));
    if (gap > 0) actions.push(`Protein averaged ${nutrition.avgProteinG}g against ${profile.targetProteinG}g. Find ${gap}g more a day, starting at lunch and dinner.`);
  }

  if (training.sessionsCompleted < profile.gymFrequency) {
    actions.push(`You trained ${training.sessionsCompleted} of ${profile.gymFrequency} planned sessions. Choose which days you'll go before Monday.`);
  }

  if (recovery.daysWithSleep > 0 && recovery.avgSleepHours < 7) {
    actions.push(`Sleep averaged ${recovery.avgSleepHours} hours. Go to bed 30 minutes earlier on weeknights.`);
  }

  if (weight.deltaKg !== null && weight.deltaKg < -1 && profile.goal === "lose_fat") {
    actions.push("Weight is dropping quickly. Keep calories steady so you hold on to strength.");
  }

  if (recovery.avgSteps > 0 && recovery.avgSteps < 7000) {
    actions.push(`Steps averaged ${recovery.avgSteps.toLocaleString("en-IN")} a day. Add a 15-minute walk after dinner.`);
  }

  if (actions.length === 0 && training.totalVolumeKg > 0) {
    actions.push("Everything was on track. Add 2.5 kg to your main lifts where you hit the top of the rep range.");
  }

  return actions.length > 0 ? actions.slice(0, MAX_ACTIONS) : ["Log your meals and weight for a week to get specific next steps."];
}

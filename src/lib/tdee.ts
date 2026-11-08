/**
 * Calorie targets and the Adaptive TDEE Calibration Engine (MacroFactor Paradigm)
 *
 * Principle: "Use software for certainty; use AI for uncertainty."
 * The true TDEE is determined empirically by observing weight fluctuations
 * relative to calorie logs over a 14-day timeline.
 */

import { dayKey, startOfDay } from "./dateUtils";

export type Goal = "lose_fat" | "build_muscle" | "maintain" | "recomp" | "general_health";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Gender = "male" | "female" | "other";

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const GOAL_CALORIE_ADJUSTMENT: Record<Goal, number> = {
  lose_fat: -500,
  build_muscle: 300,
  maintain: 0,
  recomp: -100,
  general_health: 0,
};

const GOAL_PROTEIN_PER_KG: Record<Goal, number> = {
  lose_fat: 2.2,
  build_muscle: 1.8,
  maintain: 2.0,
  recomp: 2.3,
  general_health: 2.0,
};

/** Calculated targets never go below these. Custom macros are the user's own choice. */
const MIN_SAFE_CALORIES: Record<Gender, number> = { male: 1500, female: 1200, other: 1200 };

/** Applies the goal adjustment to a TDEE, with a safety floor. */
export function goalCalorieTarget(tdee: number, goal: Goal, gender: Gender = "other", age?: number): number {
  // Under-18s are still growing, so calculated targets stay at maintenance.
  const adjustment = age !== undefined && age < 18 ? 0 : GOAL_CALORIE_ADJUSTMENT[goal] ?? 0;
  const target = tdee + adjustment;
  return Math.round(Math.max(target, MIN_SAFE_CALORIES[gender] ?? 1200));
}

export interface HealthTargetInput {
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  neckCm?: number;
  waistCm?: number;
  hipCm?: number;
  customCalories?: number;
  customProtein?: number;
  useCustomMacros?: boolean;
  goal: Goal;
  activityLevel: ActivityLevel;
}

/** US Navy body-fat estimate; null when measurements are missing or implausible. */
export function estimateBodyFatPct(data: HealthTargetInput): number | null {
  const { neckCm, waistCm, hipCm, heightCm, gender } = data;
  if (!neckCm || !waistCm || waistCm <= neckCm) return null;

  const waistIn = waistCm / 2.54;
  const neckIn = neckCm / 2.54;
  const heightIn = heightCm / 2.54;

  let bodyFatPct: number | null = null;
  if (gender === "male") {
    bodyFatPct = 86.01 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
  } else if (hipCm && hipCm > 0) {
    const hipIn = hipCm / 2.54;
    bodyFatPct = 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
  }

  return bodyFatPct !== null && bodyFatPct >= 3 && bodyFatPct <= 60 ? bodyFatPct : null;
}

/** Deterministic BMR, TDEE and targets from biometrics. */
export function calculateHealthTargets(data: HealthTargetInput) {
  const bodyFatPct = estimateBodyFatPct(data);

  let bmr: number;
  if (bodyFatPct !== null) {
    // Katch-McArdle, based on lean mass
    bmr = 370 + 21.6 * data.weightKg * (1 - bodyFatPct / 100);
  } else {
    // Mifflin-St Jeor
    const genderOffset = data.gender === "male" ? 5 : data.gender === "female" ? -161 : -80;
    bmr = 10 * data.weightKg + 6.25 * data.heightCm - 5 * data.age + genderOffset;
  }

  const tdee = bmr * ACTIVITY_MULTIPLIERS[data.activityLevel];

  const heightM = data.heightCm / 100;
  const bmi = data.weightKg / (heightM * heightM);
  const referenceWeight = bmi > 25 ? data.targetWeightKg || 22 * heightM * heightM : data.weightKg;

  let targetCalories = goalCalorieTarget(tdee, data.goal, data.gender, data.age);
  let targetProteinG = referenceWeight * GOAL_PROTEIN_PER_KG[data.goal];

  if (data.useCustomMacros) {
    if (data.customCalories && data.customCalories > 0) targetCalories = data.customCalories;
    if (data.customProtein && data.customProtein > 0) targetProteinG = data.customProtein;
  }

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories: Math.round(targetCalories),
    targetProteinG: Math.round(targetProteinG),
  };
}

export interface TimelineLike {
  type: string;
  timestamp: Date | string;
  payload?: Record<string, unknown> | null;
}

interface TdeeProfile {
  tdee?: number;
  bmr?: number;
  activityLevel?: string;
}

export interface TDEEResult {
  status: "adaptive" | "calibrating";
  calculatedTdee: number;
  avgCalories: number;
  weightDeltaKg: number;
  daysLogged: number;
  weightsLogged: number;
  daysRemaining: number;
}

const WINDOW_DAYS = 14;
const MIN_WEIGHT_DAYS = 3;
const MIN_CALORIE_DAYS = 7;
const KCAL_PER_KG = 7700;
const MAX_DIFF_FROM_BASELINE = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export function calculateAdaptiveTdee(
  profile: TdeeProfile,
  events: TimelineLike[],
  tz?: string
): TDEEResult {
  const currentTdee = profile.tdee || 2400;
  const windowStart = startOfDay(tz, WINDOW_DAYS);
  const todayStart = startOfDay(tz);
  const inWindow = (event: TimelineLike) => new Date(event.timestamp) >= windowStart;

  // Keep the last valid weigh-in of each day so repeat weigh-ins are not
  // mistaken for a multi-day trend.
  const weightByDay = new Map<string, { time: number; weight: number }>();
  events
    .filter((event) => event.type === "weight" && inWindow(event))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .forEach((event) => {
      const weight = Number(event.payload?.weightKg);
      if (!isNaN(weight) && weight > 0) {
        weightByDay.set(dayKey(event.timestamp, tz), { time: new Date(event.timestamp).getTime(), weight });
      }
    });

  // Today is excluded: a day still being logged would drag the average down.
  const dailyCalories = new Map<string, number>();
  events
    .filter((event) => event.type === "meal" && inWindow(event) && new Date(event.timestamp) < todayStart)
    .forEach((meal) => {
      const key = dayKey(meal.timestamp, tz);
      dailyCalories.set(key, (dailyCalories.get(key) || 0) + (Number(meal.payload?.totalCalories) || 0));
    });

  const loggedCalories = [...dailyCalories.values()].filter((calories) => calories > 0);
  const weightDays = weightByDay.size;
  const calorieDays = loggedCalories.length;
  const averageCalories = calorieDays > 0 ? loggedCalories.reduce((a, b) => a + b, 0) / calorieDays : 0;

  if (weightDays < MIN_WEIGHT_DAYS || calorieDays < MIN_CALORIE_DAYS) {
    return {
      status: "calibrating",
      calculatedTdee: currentTdee,
      avgCalories: Math.round(averageCalories),
      weightDeltaKg: 0,
      daysLogged: calorieDays,
      weightsLogged: weightDays,
      daysRemaining: Math.max(MIN_WEIGHT_DAYS - weightDays, MIN_CALORIE_DAYS - calorieDays, 0),
    };
  }

  // Ordinary least squares: weight (kg) against time (days)
  const t0 = windowStart.getTime();
  const points = [...weightByDay.values()].map(({ time, weight }) => ({ x: (time - t0) / DAY_MS, y: weight }));
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumXX = points.reduce((sum, p) => sum + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slopeKgPerDay = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;

  const empiricalTdee = averageCalories - slopeKgPerDay * KCAL_PER_KG;

  // The baseline comes from BMR and activity, never from profile.tdee: that
  // value is overwritten with this result, which would let the clamp drift.
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel as ActivityLevel] ?? 1.3;
  const baselineTdee = profile.bmr ? Math.round(profile.bmr * multiplier) : 2400;
  const clamped = Math.min(
    baselineTdee + MAX_DIFF_FROM_BASELINE,
    Math.max(baselineTdee - MAX_DIFF_FROM_BASELINE, Math.round(empiricalTdee))
  );

  return {
    status: "adaptive",
    calculatedTdee: Math.max(1200, Math.min(4500, clamped)),
    avgCalories: Math.round(averageCalories),
    weightDeltaKg: Math.round(slopeKgPerDay * WINDOW_DAYS * 10) / 10,
    daysLogged: calorieDays,
    weightsLogged: weightDays,
    daysRemaining: 0,
  };
}

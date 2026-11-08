import { describe, expect, it } from "vitest";
import { dayKey, shiftDayKey, startOfDay, startOfDayKey, weekdayIndex } from "../lib/dateUtils";
import { calculateAdaptiveTdee, calculateHealthTargets, goalCalorieTarget, HealthTargetInput, TimelineLike } from "../lib/tdee";
import { auditAndFixDietPlanMath, getRecommendedAdditions } from "../lib/dietEngine";
import { calculateProgression, getTodaysWorkout } from "../lib/workoutPlans";
import { calculateCurrentStreak, formatDateKey } from "../lib/habitEngine";
import { calculateLoggingStreak } from "../lib/timelineUtils";
import { buildRuleBasedCoach, normalizeCoachReply } from "../lib/coachRules";
import { checkRateLimit } from "../lib/rateLimit";
import { evaluateOtpSend, generateRandomOtp, OtpRecord } from "../lib/auth/otp";
import type { CoachContext } from "../lib/gemini";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("Timezone helpers", () => {
  const lateUtc = new Date("2026-03-10T20:00:00Z"); // 01:30 on Mar 11 in India

  it("uses the user's calendar day, not the server's", () => {
    expect(dayKey(lateUtc, "Asia/Kolkata")).toBe("2026-03-11");
    expect(dayKey(lateUtc, "UTC")).toBe("2026-03-10");
    expect(weekdayIndex(lateUtc, "Asia/Kolkata")).toBe(3);
  });

  it("finds the instant a day starts", () => {
    expect(startOfDayKey("2026-03-11", "Asia/Kolkata").toISOString()).toBe("2026-03-10T18:30:00.000Z");
    expect(startOfDay("Asia/Kolkata", 1, lateUtc).toISOString()).toBe("2026-03-09T18:30:00.000Z");
  });

  it("handles a daylight saving change", () => {
    expect(startOfDayKey("2026-03-08", "America/New_York").toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(startOfDayKey("2026-03-09", "America/New_York").toISOString()).toBe("2026-03-09T04:00:00.000Z");
  });

  it("shifts across month boundaries", () => {
    expect(shiftDayKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("Adaptive TDEE exact values", () => {
  const now = Date.now();
  const log = (type: string, daysAgo: number, payload: Record<string, unknown>): TimelineLike => ({
    type,
    timestamp: new Date(now - daysAgo * DAY_MS).toISOString(),
    payload,
  });

  function steadyLoss(kgPerDay: number, calories: number) {
    const events: TimelineLike[] = [];
    for (let daysAgo = 1; daysAgo <= 12; daysAgo++) {
      events.push(log("meal", daysAgo, { totalCalories: calories }));
      events.push(log("weight", daysAgo, { weightKg: 80 + kgPerDay * daysAgo }));
    }
    return events;
  }

  // BMR 2000 x moderate 1.55 = baseline 3100, so the clamp is [2900, 3300].
  const profile = { bmr: 2000, activityLevel: "moderate", tdee: 3100 };

  it("computes maintenance from a known slope", () => {
    // Losing 0.1 kg/day at 2200 kcal: 2200 + 0.1 * 7700 = 2970
    const result = calculateAdaptiveTdee(profile, steadyLoss(0.1, 2200));
    expect(result.status).toBe("adaptive");
    expect(result.calculatedTdee).toBe(2970);
    expect(result.avgCalories).toBe(2200);
    expect(result.weightDeltaKg).toBe(-1.4);
  });

  it("clamps to the top of the activity-based baseline", () => {
    expect(calculateAdaptiveTdee(profile, steadyLoss(0.3, 2500)).calculatedTdee).toBe(3300);
  });

  it("clamps to the bottom of the activity-based baseline", () => {
    expect(calculateAdaptiveTdee(profile, steadyLoss(-0.3, 2500)).calculatedTdee).toBe(2900);
  });

  it("does not let a stored adaptive TDEE shift the baseline", () => {
    const drifted = { ...profile, tdee: 1500 };
    expect(calculateAdaptiveTdee(drifted, steadyLoss(0.1, 2200)).calculatedTdee).toBe(2970);
  });

  it("does not count repeat weigh-ins on one day as separate days", () => {
    const events: TimelineLike[] = [];
    for (let daysAgo = 1; daysAgo <= 8; daysAgo++) events.push(log("meal", daysAgo, { totalCalories: 2200 }));
    events.push(log("weight", 2, { weightKg: 80 }), log("weight", 2.001, { weightKg: 81 }), log("weight", 2.002, { weightKg: 79 }));

    const result = calculateAdaptiveTdee(profile, events);
    expect(result.status).toBe("calibrating");
    expect(result.weightsLogged).toBe(1);
  });

  it("ignores today's unfinished calorie log", () => {
    const events = [...steadyLoss(0.1, 2200), { type: "meal", timestamp: new Date(now).toISOString(), payload: { totalCalories: 100 } }];
    expect(calculateAdaptiveTdee(profile, events).avgCalories).toBe(2200);
  });
});

describe("Calorie targets", () => {
  const base: HealthTargetInput = { age: 25, gender: "female", heightCm: 150, weightKg: 45, goal: "lose_fat", activityLevel: "sedentary" };

  it("never drops below the safety floor for a calculated target", () => {
    expect(goalCalorieTarget(1400, "lose_fat", "female")).toBe(1200);
    expect(goalCalorieTarget(1900, "lose_fat", "male")).toBe(1500);
    expect(calculateHealthTargets(base).targetCalories).toBe(1200);
  });

  it("respects an explicit custom target", () => {
    expect(calculateHealthTargets({ ...base, useCustomMacros: true, customCalories: 1100 }).targetCalories).toBe(1100);
  });

  it("computes Mifflin-St Jeor exactly", () => {
    // 10*75 + 6.25*175 - 5*25 + 5 = 1723.75; x 1.55 = 2671.8
    const result = calculateHealthTargets({ age: 25, gender: "male", heightCm: 175, weightKg: 75, goal: "maintain", activityLevel: "moderate" });
    expect(result.bmr).toBe(1724);
    expect(result.tdee).toBe(2672);
    expect(result.targetCalories).toBe(2672);
  });

  it("falls back to Mifflin when body-fat measurements are implausible", () => {
    const withBadTape = calculateHealthTargets({ age: 25, gender: "male", heightCm: 175, weightKg: 75, neckCm: 37, waistCm: 37.5, goal: "maintain", activityLevel: "moderate" });
    expect(withBadTape.bmr).toBe(1724);
  });
});

describe("Diet plan math audit", () => {
  const audit = (messItems: string, additions = "None") =>
    auditAndFixDietPlanMath({ monday: { meals: [{ messItems, additions, proteinG: 999, calories: 9999 }] } }).monday.meals[0];

  it("sums itemized macros", () => {
    const meal = audit("• Dal (1 Katori 150g - 5.2g P, 105 kcal)\n• Roti (2 pieces - 6.4g P, 170 kcal)");
    expect(meal.proteinG).toBe(11.6);
    expect(meal.calories).toBe(275);
  });

  it("does not read a food weight as protein", () => {
    const meal = audit("• Paneer (100g Paneer - 18.9g P, 305 kcal)");
    expect(meal.proteinG).toBe(18.9);
  });

  it("keeps decimal calories whole", () => {
    expect(audit("• Egg (1 egg - 6.6g P, 71.5 kcal)").calories).toBe(72);
  });

  it("handles nested parentheses", () => {
    expect(audit("• Dal (1 Katori (150g) - 5.2g P, 105 kcal)").calories).toBe(105);
  });

  it("never suggests animal products to vegans", () => {
    const items = getRecommendedAdditions(40, "vegan").map((addition) => addition.item.toLowerCase());
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((item) => /egg|chicken|whey|paneer|curd/.test(item))).toBe(false);
  });
});

describe("Progressive overload", () => {
  it("adds weight only when every top set reaches the top of the range", () => {
    const allHit = [{ weight: 40, reps: 12, completed: true }, { weight: 40, reps: 12, completed: true }];
    expect(calculateProgression(allHit, "8-12", "bench_press")?.suggestedWeight).toBe(42.5);

    const oneMissed = [{ weight: 40, reps: 12, completed: true }, { weight: 40, reps: 9, completed: true }];
    expect(calculateProgression(oneMissed, "8-12", "bench_press")?.suggestedWeight).toBe(40);
  });

  it("uses the smaller increment for dumbbell work", () => {
    expect(calculateProgression([{ weight: 20, reps: 10, completed: true }], "8-10", "incline_db_press")?.suggestedWeight).toBe(22);
  });

  it("reads non-range rep targets", () => {
    expect(calculateProgression([{ weight: 20, reps: 15, completed: true }], "15", "x")?.suggestedWeight).toBe(22.5);
    expect(calculateProgression([{ weight: 20, reps: 10, completed: true }], "10/leg", "x")?.suggestedWeight).toBe(22.5);
  });

  it("returns null for an empty session so older history is used", () => {
    expect(calculateProgression([{ weight: 0, reps: 0, completed: false }], "8-12", "x")).toBeNull();
  });
});

describe("Workout selection", () => {
  it("uses the user's custom plan when one exists for the day", () => {
    const custom = { name: "Custom", focus: "x", targetDurationMin: 40, exercises: [] };
    expect(getTodaysWorkout({ customWorkoutPlan: { 2: custom } }, 2).name).toBe("Custom");
  });

  it("gives an unsupported frequency a real program", () => {
    expect(getTodaysWorkout({ gymFrequency: 2 }, 2).exercises.length).toBeGreaterThan(0);
  });
});

describe("Streaks", () => {
  const key = (daysAgo: number) => formatDateKey(new Date(Date.now() - daysAgo * DAY_MS));
  const logs = (...daysAgo: number[]) => daysAgo.map((d) => ({ date: key(d), completed: true, value: 1 }));

  it("an unfinished today does not break a streak", () => {
    expect(calculateCurrentStreak(logs(1, 2, 3)).currentStreak).toBe(3);
  });

  it("one missed day is covered by the freeze", () => {
    const result = calculateCurrentStreak(logs(2, 3, 4));
    expect(result.currentStreak).toBe(3);
    expect(result.freezeUsed).toBe(true);
  });

  it("two missed days end the streak", () => {
    expect(calculateCurrentStreak(logs(3, 4, 5)).currentStreak).toBe(0);
  });

  it("partial progress on a numeric habit does not count", () => {
    const partial = [{ date: key(0), completed: false, value: 1 }];
    expect(calculateCurrentStreak(partial, "daily", 3.5).currentStreak).toBe(0);
  });

  it("counts a logging streak by the user's calendar day", () => {
    const now = new Date("2026-03-10T20:00:00Z"); // Mar 11 in India
    const stamps = [new Date("2026-03-10T19:00:00Z"), new Date("2026-03-09T19:00:00Z")]; // Mar 11, Mar 10 in India
    expect(calculateLoggingStreak(stamps, "Asia/Kolkata", now)).toBe(2);
  });
});

describe("Rule-based coach", () => {
  const context = (overrides: Partial<CoachContext["today"]> = {}): CoachContext => ({
    profile: { name: "A", goal: "maintain", targetCalories: 2000, targetProteinG: 150 },
    today: { caloriesConsumed: 500, proteinConsumed: 20.4, workoutCompleted: true, sleepHours: 8, stepsCount: 20000, ...overrides },
    weekTrend: { avgCalories: 0, avgProtein: 0, workoutsCompleted: 0, avgSleep: 0 },
    recentWeightKg: null,
  });

  it("matches protein suggestions to the diet preference", () => {
    const eggetarian = buildRuleBasedCoach(context(), { name: "A", dietPreference: "eggetarian" }).actionItems.join(" ");
    expect(eggetarian).not.toContain("chicken");
    const vegan = buildRuleBasedCoach(context(), { name: "A", dietPreference: "vegan" }).actionItems.join(" ");
    expect(vegan).not.toMatch(/paneer|curd|egg|whey/);
  });

  it("shows whole grams of protein", () => {
    expect(buildRuleBasedCoach(context(), { name: "A" }).actionItems.join(" ")).toContain("Need 130g more protein");
  });
});

describe("Coach reply normalization", () => {
  it("downgrades unknown actions and malformed replies", () => {
    expect(normalizeCoachReply({ action: "drop_database", updatedData: { a: 1 } })).toMatchObject({ action: "none", updatedData: null });
    expect(normalizeCoachReply("nonsense").action).toBe("none");
  });

  it("audits AI-edited diet plans", () => {
    const reply = normalizeCoachReply({
      message: "ok",
      action: "update_diet",
      updatedData: { monday: { meals: [{ messItems: "• Dal (5.2g P, 105 kcal)", calories: 9999, proteinG: 999 }] } },
    });
    expect((reply.updatedData as { monday: { meals: { calories: number }[] } }).monday.meals[0].calories).toBe(105);
  });
});

describe("Limits", () => {
  it("rate limiter blocks within a window and resets after it", () => {
    expect(checkRateLimit("t", 1, 1000, 0)).toBe(true);
    expect(checkRateLimit("t", 1, 1000, 500)).toBe(false);
    expect(checkRateLimit("t", 1, 1000, 1001)).toBe(true);
  });

  it("generates six-digit codes", () => {
    for (let i = 0; i < 50; i++) expect(generateRandomOtp()).toMatch(/^[1-9]\d{5}$/);
  });

  it("applies the hourly send limit", () => {
    const now = Date.now();
    const record = (lastAgoMs: number, sendCount: number): OtpRecord => ({
      email: "a@b.co",
      codeHash: "x",
      expiresAt: new Date(now),
      attempts: 0,
      lastSentAt: new Date(now - lastAgoMs),
      windowStart: new Date(now - lastAgoMs),
      sendCount,
    });
    expect(evaluateOtpSend(null, now)).toBe("ok");
    expect(evaluateOtpSend(record(1000, 1), now)).toBe("cooldown");
    expect(evaluateOtpSend(record(60000, 5), now)).toBe("limit");
    expect(evaluateOtpSend(record(60 * 60 * 1000 + 1, 5), now)).toBe("ok");
  });
});

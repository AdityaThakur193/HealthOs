import { describe, expect, it } from "vitest";
import { buildNextWeekActions, compareNutritionWeeks, ReviewNumbers, weightTrendSeries } from "../lib/progressInsights";
import { calculateCurrentStreak, calculateWeeklyStreak, formatDateKey, isHydrationHabit, mergeWaterIntoHydration } from "../lib/habitEngine";
import { calculateHealthTargets, goalCalorieTarget, HealthTargetInput } from "../lib/tdee";
import { buildMealDayStatus, DEFAULT_MESS_TIMINGS, nextMealPrompt } from "../lib/mealWindows";
import { shiftDayKey, weekdayOfKey } from "../lib/dateUtils";

describe("Weight trend", () => {
  it("smooths a one-day spike", () => {
    const trend = weightTrendSeries([80, 80, 82, 80]);
    expect(trend[0]).toBe(80);
    expect(trend[2]).toBe(80.5);
    expect(trend[3]).toBeCloseTo(80.38, 2);
  });

  it("follows a real change", () => {
    const trend = weightTrendSeries(Array.from({ length: 30 }, (_, day) => 80 - day * 0.1));
    expect(trend[29]).toBeLessThan(trend[0] - 2);
  });

  it("handles no data", () => {
    expect(weightTrendSeries([])).toEqual([]);
  });
});

describe("Nutrition comparison", () => {
  const now = new Date("2026-11-09T12:00:00+05:30");
  const meal = (daysAgo: number, totalCalories: number, totalProteinG: number) => ({
    type: "meal",
    timestamp: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    payload: { totalCalories, totalProteinG },
  });

  it("averages logged days only, and adds up meals within a day", () => {
    const { recent } = compareNutritionWeeks([meal(1, 1000, 50), meal(1, 1000, 50), meal(3, 1000, 40)], now, "Asia/Kolkata");
    expect(recent).toEqual({ avgCalories: 1500, avgProteinG: 70, daysLogged: 2 });
  });

  it("leaves out today and separates the two weeks", () => {
    const { recent, previous } = compareNutritionWeeks([meal(0, 9999, 999), meal(2, 2000, 100), meal(10, 1500, 80)], now, "Asia/Kolkata");
    expect(recent.avgCalories).toBe(2000);
    expect(previous.avgCalories).toBe(1500);
  });
});

describe("Next week actions", () => {
  const base: ReviewNumbers = {
    weight: { deltaKg: 0 },
    nutrition: { avgProteinG: 150, proteinAdherence: 90, daysLogged: 7 },
    training: { sessionsCompleted: 4, totalVolumeKg: 10000 },
    recovery: { avgSleepHours: 8, avgSteps: 9000, daysWithSleep: 7 },
    profile: { targetProteinG: 150, goal: "maintain", gymFrequency: 4 },
  };

  it("uses the person's actual numbers", () => {
    const actions = buildNextWeekActions({
      ...base,
      nutrition: { avgProteinG: 100, proteinAdherence: 30, daysLogged: 6 },
      training: { sessionsCompleted: 2, totalVolumeKg: 500 },
    });
    expect(actions[0]).toContain("Find 50g more a day");
    expect(actions[1]).toContain("2 of 4 planned sessions");
  });

  it("never gives more than three", () => {
    const actions = buildNextWeekActions({
      weight: { deltaKg: -2 },
      nutrition: { avgProteinG: 50, proteinAdherence: 10, daysLogged: 2 },
      training: { sessionsCompleted: 0, totalVolumeKg: 0 },
      recovery: { avgSleepHours: 5, avgSteps: 3000, daysWithSleep: 5 },
      profile: { targetProteinG: 150, goal: "lose_fat", gymFrequency: 4 },
    });
    expect(actions).toHaveLength(3);
  });

  it("moves forward when everything went well", () => {
    expect(buildNextWeekActions(base)[0]).toContain("Add 2.5 kg");
  });

  it("asks for data when there is none", () => {
    const actions = buildNextWeekActions({
      ...base,
      nutrition: { avgProteinG: 0, proteinAdherence: 0, daysLogged: 7 },
      training: { sessionsCompleted: 4, totalVolumeKg: 0 },
      recovery: { avgSleepHours: 0, avgSteps: 0, daysWithSleep: 0 },
      profile: { ...base.profile, targetProteinG: 0 },
    });
    expect(actions[0]).toContain("Log your meals");
  });
});

describe("Hydration habit", () => {
  it("recognises hydration habits only", () => {
    expect(isHydrationHabit({ habitId: "habit_hydration" })).toBe(true);
    expect(isHydrationHabit({ title: "Drink water", unit: "L" })).toBe(true);
    expect(isHydrationHabit({ title: "Drink water" })).toBe(false);
    expect(isHydrationHabit({ title: "Read", unit: "pages" })).toBe(false);
  });

  it("counts logged water and completes at the target", () => {
    const logs = mergeWaterIntoHydration([], new Map([["2026-11-09", 3.5], ["2026-11-08", 1]]), 3.5);
    expect(logs.find((log) => log.date === "2026-11-09")).toMatchObject({ value: 3.5, completed: true });
    expect(logs.find((log) => log.date === "2026-11-08")).toMatchObject({ value: 1, completed: false });
  });

  it("keeps a higher amount or a manual tick", () => {
    const logs = mergeWaterIntoHydration([{ date: "2026-11-09", completed: true, value: 2 }], new Map([["2026-11-09", 1]]), 3.5);
    expect(logs[0]).toMatchObject({ value: 2, completed: true });
  });
});

describe("Weekly habit streaks", () => {
  const today = formatDateKey(new Date());
  const monday = shiftDayKey(today, -((weekdayOfKey(today) + 6) % 7));
  const days = (weeksAgo: number, count: number) =>
    Array.from({ length: count }, (_, index) => ({ date: shiftDayKey(monday, index - weeksAgo * 7), completed: true, value: 1 }));

  it("counts weeks that reached the goal", () => {
    expect(calculateWeeklyStreak([...days(1, 3), ...days(2, 3)], 3).currentStreak).toBe(2);
  });

  it("doesn't break for an unfinished current week", () => {
    expect(calculateWeeklyStreak([...days(0, 1), ...days(1, 3)], 3).currentStreak).toBe(1);
  });

  it("ends at a missed week but remembers the best run", () => {
    const result = calculateWeeklyStreak([...days(1, 1), ...days(2, 3), ...days(3, 3)], 3);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(2);
  });

  it("is different from a daily streak", () => {
    const logs = days(1, 3);
    expect(calculateWeeklyStreak(logs, 3).currentStreak).not.toBe(calculateCurrentStreak(logs, "daily").currentStreak + 10);
  });
});

describe("Under-18 targets", () => {
  const teen: HealthTargetInput = { age: 16, gender: "male", heightCm: 170, weightKg: 70, goal: "lose_fat", activityLevel: "moderate" };

  it("keeps calculated calories at maintenance", () => {
    const targets = calculateHealthTargets(teen);
    expect(targets.targetCalories).toBe(targets.tdee);
    expect(goalCalorieTarget(2400, "lose_fat", "male", 17)).toBe(2400);
    expect(goalCalorieTarget(2400, "build_muscle", "male", 17)).toBe(2400);
  });

  it("still applies goals at 18 and over", () => {
    const targets = calculateHealthTargets({ ...teen, age: 18 });
    expect(targets.targetCalories).toBe(targets.tdee - 500);
  });
});

describe("Next meal prompt", () => {
  const monday = (time: string) => new Date(`2026-11-09T${time}:00+05:30`);
  const status = (time: string, logs: { timestamp: Date }[] = []) =>
    buildMealDayStatus({ now: monday(time), tz: "Asia/Kolkata", timings: DEFAULT_MESS_TIMINGS, isHoliday: false, mealLogs: logs });

  it("offers to log the open meal, with its menu", () => {
    expect(nextMealPrompt(status("12:30"), { lunch: "Rajma, Roti" })).toEqual({ title: "Lunch is open until 2:00 PM", detail: "Rajma, Roti", action: "Log Lunch" });
  });

  it("moves on once the open meal is logged", () => {
    expect(nextMealPrompt(status("12:30", [{ timestamp: monday("12:00") }])).title).toBe("Snacks opens at 4:30 PM");
  });

  it("offers a meal that was missed between windows", () => {
    expect(nextMealPrompt(status("15:00")).action).toBe("Log Lunch");
  });

  it("says when the mess is finished", () => {
    expect(nextMealPrompt(status("22:00")).title).toBe("The mess is closed for today");
  });
});

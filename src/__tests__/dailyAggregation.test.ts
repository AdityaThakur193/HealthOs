import { describe, it, expect } from "vitest";
import { aggregateDailyEvents as aggregateEvents, TimelineEntry } from "../lib/timelineUtils";

describe("Dashboard Daily Stats Aggregation", () => {
  const today = new Date();

  it("should accumulate multiple step logs across the same day (not overwrite)", () => {
    const events = [
      {
        type: "steps",
        timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0).toISOString(),
        payload: { count: 5000 },
      },
      {
        type: "steps",
        timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 30).toISOString(),
        payload: { count: 2000, steps: 2000 },
      },
    ];

    const stats = aggregateEvents(events, today);
    expect(stats.steps).toBe(7000);
  });

  it("should support both count and steps field names when accumulating steps", () => {
    const events = [
      {
        type: "steps",
        timestamp: today.toISOString(),
        payload: { count: 4000 },
      },
      {
        type: "steps",
        timestamp: today.toISOString(),
        payload: { steps: 3500 },
      },
    ];

    const stats = aggregateEvents(events, today);
    expect(stats.steps).toBe(7500);
  });

  it("should treat sleep as a single daily value (overwrite with latest log)", () => {
    const events = [
      {
        type: "sleep",
        timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 7, 0).toISOString(),
        payload: { hours: 6.5 },
      },
      {
        type: "sleep",
        timestamp: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 8, 30).toISOString(),
        payload: { hours: 7.5 },
      },
    ];

    const stats = aggregateEvents(events, today);
    expect(stats.sleepHours).toBe(7.5);
  });

  it("should ignore events from other days during daily aggregation", () => {
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const events = [
      {
        type: "steps",
        timestamp: yesterday.toISOString(),
        payload: { count: 10000 },
      },
      {
        type: "steps",
        timestamp: today.toISOString(),
        payload: { count: 3000 },
      },
    ];

    const stats = aggregateEvents(events, today);
    expect(stats.steps).toBe(3000);
  });

  it("should calculate burnedToday as BMR + steps caloriesBurned + workout caloriesBurned", () => {
    const bmr = 2241;
    const events = [
      {
        type: "steps",
        timestamp: today.toISOString(),
        payload: { count: 8500, caloriesBurned: 340 },
      },
      {
        type: "workout",
        timestamp: today.toISOString(),
        payload: { workoutType: "Push Day", durationMin: 60, caloriesBurned: 420 },
      },
    ];

    const stats = aggregateEvents(events, today, bmr);
    expect(stats.burnedToday).toBe(3001); // 2241 + 340 + 420 = 3001
  });

  it("should fallback to steps * 0.04 when steps event lacks explicit caloriesBurned", () => {
    const bmr = 2000;
    const events = [
      {
        type: "steps",
        timestamp: today.toISOString(),
        payload: { count: 5000 }, // 5000 * 0.04 = 200
      },
    ];

    const stats = aggregateEvents(events, today, bmr);
    expect(stats.burnedToday).toBe(2200); // 2000 + 200 = 2200
  });
});

/**
 * Mirror of Recovery Metrics calculation in src/app/api/review/route.ts
 */
function aggregateWeeklyRecoveryMetrics(events: Pick<TimelineEntry, "type" | "timestamp" | "payload">[]) {
  const sleepEvents = events.filter((e) => e.type === "sleep");
  const stepsEvents = events.filter((e) => e.type === "steps");

  const dailySleep: Record<string, number> = {};
  sleepEvents.forEach((s) => {
    const dateStr = new Date(s.timestamp).toDateString();
    dailySleep[dateStr] = Number(s.payload?.hours) || 0;
  });

  const sleepDates = Object.keys(dailySleep);
  const daysWithSleep = sleepDates.length;
  const avgSleepHours = daysWithSleep > 0
    ? Math.round((sleepDates.reduce((sum, d) => sum + dailySleep[d], 0) / daysWithSleep) * 10) / 10
    : 0;

  const dailySteps: Record<string, number> = {};
  stepsEvents.forEach((s) => {
    const dateStr = new Date(s.timestamp).toDateString();
    const count = Number(s.payload?.count || s.payload?.steps) || 0;
    dailySteps[dateStr] = (dailySteps[dateStr] || 0) + count;
  });

  const stepsDates = Object.keys(dailySteps);
  const daysWithSteps = stepsDates.length;
  const avgSteps = daysWithSteps > 0
    ? Math.round(stepsDates.reduce((sum, d) => sum + dailySteps[d], 0) / daysWithSteps)
    : 0;

  return { daysWithSleep, avgSleepHours, daysWithSteps, avgSteps };
}

describe("Weekly Review Recovery Metrics Aggregation", () => {
  it("should count unique calendar days for sleep instead of raw event count", () => {
    const events = [
      // Day 1: User logged sleep twice (initial 6h, later re-logged 7.5h)
      { type: "sleep", timestamp: new Date(2026, 8, 1, 7, 0).toISOString(), payload: { hours: 6.0 } },
      { type: "sleep", timestamp: new Date(2026, 8, 1, 9, 0).toISOString(), payload: { hours: 7.5 } },
      // Day 2: Single log of 8h
      { type: "sleep", timestamp: new Date(2026, 8, 2, 7, 30).toISOString(), payload: { hours: 8.0 } },
    ];

    const result = aggregateWeeklyRecoveryMetrics(events);
    expect(result.daysWithSleep).toBe(2);
    // (7.5 + 8.0) / 2 = 7.75 -> 7.8
    expect(result.avgSleepHours).toBe(7.8);
  });

  it("should aggregate incremental steps per unique calendar day before averaging", () => {
    const events = [
      // Day 1: 2 step logs (morning walk 4000, evening walk 6000)
      { type: "steps", timestamp: new Date(2026, 8, 1, 10, 0).toISOString(), payload: { count: 4000 } },
      { type: "steps", timestamp: new Date(2026, 8, 1, 16, 0).toISOString(), payload: { steps: 6000 } },
      // Day 2: 1 step log (8000)
      { type: "steps", timestamp: new Date(2026, 8, 2, 12, 0).toISOString(), payload: { count: 8000 } },
    ];

    const result = aggregateWeeklyRecoveryMetrics(events);
    expect(result.daysWithSteps).toBe(2);
    // Day 1: 10000, Day 2: 8000. Avg = 18000 / 2 = 9000
    expect(result.avgSteps).toBe(9000);
  });
});

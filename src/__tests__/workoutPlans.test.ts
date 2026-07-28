import { describe, it, expect } from "vitest";
import { getWeekSchedule, getTodaysWorkout } from "../lib/workoutPlans";

describe("Workout Engine & Progressive Overload", () => {
  it("should return the correct schedule mapping for 3, 4, 5, and 6-day splits", () => {
    const sched3 = getWeekSchedule(3);
    expect(sched3.length).toBe(3);
    expect(sched3.map((s) => s.name)).toContain("Tuesday — Push");

    const sched4 = getWeekSchedule(4);
    expect(sched4.length).toBe(4);
    expect(sched4.map((s) => s.name)).toContain("Tuesday — Upper A");

    const sched5 = getWeekSchedule(5);
    expect(sched5.length).toBe(6); // 5 days + Sunday optional delts
    expect(sched5.map((s) => s.name)).toContain("Thursday — Recovery");

    const sched6 = getWeekSchedule(6);
    expect(sched6.length).toBe(6);
  });

  it("should return a Rest Day plan when requested day is not scheduled", () => {
    // For 4-day split, Sunday (day 0) is rest
    const plan = getTodaysWorkout({ gymFrequency: 4 }, 0);
    expect(plan.name).toBe("Rest Day");
    expect(plan.focus).toBe("Recovery & Mobility");
    expect(plan.exercises.length).toBe(0);
  });

  it("should generate exercises with target sets, reps, and valid video timestamps", () => {
    // Tuesday (day 2) in 5-day split is Upper A
    const plan = getTodaysWorkout({ gymFrequency: 5 }, 2);
    expect(plan.name).toContain("Tuesday");
    expect(plan.exercises.length).toBeGreaterThan(0);

    plan.exercises.forEach((ex) => {
      expect(ex.id).toBeDefined();
      expect(ex.name).toBeDefined();
      expect(ex.targetSets).toBeGreaterThan(0);
      expect(ex.targetReps).toBeDefined();
      if (ex.youtubeId) {
        expect(ex.youtubeId).toMatch(/^[a-zA-Z0-9_-]+\?t=\d+$/);
      }
    });
  });

  it("should fallback to 4-day split when gymFrequency is undefined or invalid", () => {
    const planDefault = getTodaysWorkout({}, 2); // Tuesday
    expect(planDefault.name).toBe("Tuesday — Upper A");
  });
});

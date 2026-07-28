import { describe, it, expect } from "vitest";
import {
  calculateHabitStrength,
  calculateCurrentStreak,
  get30DayHeatmap,
  formatDateKey,
} from "../lib/habitEngine";

describe("Dynamic Custom Habit Engine", () => {
  it("should format dates correctly as YYYY-MM-DD", () => {
    const d = new Date(2026, 6, 28); // Month is 0-indexed (6 = July)
    expect(formatDateKey(d)).toBe("2026-07-28");
  });

  it("should calculate habit strength gracefully using exponential smoothing", () => {
    const today = new Date();
    const logs = [];

    // Create 30 days of consecutive completed logs
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      logs.push({
        date: formatDateKey(d),
        completed: true,
        value: 1,
      });
    }

    const strength = calculateHabitStrength(logs, 1);
    expect(strength).toBeGreaterThan(90); // Should be very strong (>90%)
  });

  it("should cause graceful decay of habit strength on missed days rather than zeroing out", () => {
    const today = new Date();
    const logs = [];

    // 25 days of completion followed by 2 missed days
    for (let i = 2; i < 27; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      logs.push({
        date: formatDateKey(d),
        completed: true,
        value: 1,
      });
    }

    const strength = calculateHabitStrength(logs, 1);
    // Strength should decay slightly, but still hold historical momentum (>60%)
    expect(strength).toBeGreaterThan(60);
    expect(strength).toBeLessThan(95);
  });

  it("should calculate current streak and best streak correctly", () => {
    const today = new Date();
    const logs = [];

    // 5 consecutive days ending today
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      logs.push({
        date: formatDateKey(d),
        completed: true,
        value: 1,
      });
    }

    const { currentStreak, bestStreak } = calculateCurrentStreak(logs, "daily");
    expect(currentStreak).toBe(5);
    expect(bestStreak).toBeGreaterThanOrEqual(5);
  });

  it("should generate a 30-day heatmap grid array", () => {
    const today = new Date();
    const todayKey = formatDateKey(today);
    const logs = [{ date: todayKey, completed: true, value: 5 }];

    const heatmap = get30DayHeatmap(logs, 5);
    expect(heatmap.length).toBe(30);
    expect(heatmap[29].date).toBe(todayKey);
    expect(heatmap[29].status).toBe("completed");
    expect(heatmap[29].val).toBe(5);
  });
});

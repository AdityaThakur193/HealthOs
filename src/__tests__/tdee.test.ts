import { describe, it, expect } from "vitest";
import { calculateAdaptiveTdee } from "../lib/tdee";

describe("Adaptive TDEE Engine (MacroFactor Paradigm)", () => {
  const baseProfile = {
    tdee: 2400,
    bmr: 1800,
    weightKg: 80,
  };

  const now = new Date();

  function createLog(type: "weight" | "meal", daysAgo: number, payload: any) {
    const timestamp = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return { type, timestamp, payload };
  }

  it("should return 'calibrating' status when less than 3 weight logs exist", () => {
    const events = [
      createLog("weight", 1, { weightKg: 80 }),
      createLog("weight", 3, { weightKg: 79.8 }),
      // Only 2 weight logs, but 10 meal logs
      ...Array.from({ length: 10 }, (_, i) => createLog("meal", i + 1, { totalCalories: 2400 })),
    ];

    const result = calculateAdaptiveTdee(baseProfile, events);
    expect(result.status).toBe("calibrating");
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it("should return 'calibrating' status when less than 7 calorie logs exist", () => {
    const events = [
      // 5 weight logs, but only 4 meal logs
      ...Array.from({ length: 5 }, (_, i) => createLog("weight", i + 1, { weightKg: 80 - i * 0.1 })),
      ...Array.from({ length: 4 }, (_, i) => createLog("meal", i + 1, { totalCalories: 2200 })),
    ];

    const result = calculateAdaptiveTdee(baseProfile, events);
    expect(result.status).toBe("calibrating");
    expect(result.daysRemaining).toBeGreaterThan(0);
  });

  it("should calculate adaptive TDEE correctly when user is in calorie deficit and losing weight", () => {
    // 14 days of data: logged 2200 kcal average, lost 1 kg over 14 days (approx 7700 kcal deficit = ~550 kcal/day deficit)
    // Estimated TDEE should be ~2200 + 550 = 2750, clamped to max diff ±200 from BMR * 1.3 (2340 + 200 = 2540)
    const events: any[] = [];
    for (let i = 1; i <= 14; i++) {
      events.push(createLog("meal", i, { totalCalories: 2200 }));
      events.push(createLog("weight", i, { weightKg: 81 - (14 - i) * (1.0 / 13) })); // Linear loss from 81kg to 80kg
    }

    const result = calculateAdaptiveTdee(baseProfile, events);
    expect(result.status).toBe("adaptive");
    expect(result.calculatedTdee).toBeGreaterThan(2200);
    expect(result.avgCalories).toBe(2200);
    expect(result.weightDeltaKg).toBeLessThan(0);
  });

  it("should ignore missing/unlogged days without skewing calorie average down to 0", () => {
    // Logged only 7 out of 14 days at 2500 kcal
    const events: any[] = [];
    for (let i = 1; i <= 7; i++) {
      events.push(createLog("meal", i * 2, { totalCalories: 2500 }));
    }
    for (let i = 1; i <= 5; i++) {
      events.push(createLog("weight", i * 2, { weightKg: 80 }));
    }

    const result = calculateAdaptiveTdee(baseProfile, events);
    expect(result.status).toBe("adaptive");
    // Average should be 2500, NOT 2500 * 7 / 14 = 1250!
    expect(result.avgCalories).toBe(2500);
  });

  it("should clamp extreme water weight spikes to maximum delta cap (±200 kcal from baseline)", () => {
    // Baseline TDEE estimate = BMR 1800 * 1.3 = 2340 kcal
    // Massive weight spike: +4 kg in 14 days (impossible pure fat gain)
    const events: any[] = [];
    for (let i = 1; i <= 14; i++) {
      events.push(createLog("meal", i, { totalCalories: 2000 }));
      events.push(createLog("weight", 15 - i, { weightKg: 75 + i * 0.3 })); // 75kg to 79.2kg
    }

    const result = calculateAdaptiveTdee(baseProfile, events);
    expect(result.status).toBe("adaptive");
    // Baseline = 2340, min clamp = 2340 - 200 = 2140 kcal
    expect(result.calculatedTdee).toBeGreaterThanOrEqual(2140);
  });

  it("should enforce absolute bounds [1200, 4500] kcal", () => {
    const events: any[] = [];
    for (let i = 1; i <= 14; i++) {
      events.push(createLog("meal", i, { totalCalories: 100 })); // Super low
      events.push(createLog("weight", i, { weightKg: 80 }));
    }

    const result = calculateAdaptiveTdee({ bmr: 500, tdee: 1000 }, events);
    expect(result.calculatedTdee).toBeGreaterThanOrEqual(1200);
    expect(result.calculatedTdee).toBeLessThanOrEqual(4500);
  });
});

import { describe, it, expect } from "vitest";
import { calculateFoodMacros, findIFCTItem } from "../lib/ifctData";

describe("ICMR-NIN IFCT 2017 Portion Engine", () => {
  it("should correctly calculate macros for 2 Rotis", () => {
    const res = calculateFoodMacros("Roti", 2, "piece");
    expect(res.name).toContain("Roti");
    expect(res.quantity).toBe(2);
    // 2 rotis = ~70g weight
    expect(res.weightGrams).toBe(70);
    // 2 rotis = ~170-172 kcal, ~6.4g protein
    expect(res.calories).toBeGreaterThanOrEqual(165);
    expect(res.calories).toBeLessThanOrEqual(180);
    expect(res.proteinG).toBe(6.4);
  });

  it("should calculate macros for 1 Katori of Thin Mess Dal accurately", () => {
    const res = calculateFoodMacros("Yellow Dal", 1, "katori", "thin_mess");
    expect(res.name).toContain("Yellow Dal");
    expect(res.weightGrams).toBe(150);
    // Diluted mess dal should be ~85-95 kcal and ~4.5-5.5g protein
    expect(res.calories).toBeLessThan(110);
    expect(res.proteinG).toBeGreaterThan(4.0);
    expect(res.proteinG).toBeLessThan(6.0);
  });

  it("should calculate macros for 1 Scoop Whey Protein", () => {
    const res = calculateFoodMacros("Whey Protein", 1, "scoop");
    expect(res.weightGrams).toBe(32);
    expect(res.calories).toBe(120);
    expect(res.proteinG).toBe(24);
  });

  it("should handle custom gram weights (e.g., 200g Paneer)", () => {
    const res = calculateFoodMacros("Paneer", 200, "gram");
    expect(res.weightGrams).toBe(200);
    // 200g raw paneer = ~610 kcal, ~37.8g protein
    expect(res.calories).toBe(610);
    expect(res.proteinG).toBe(37.8);
  });
});

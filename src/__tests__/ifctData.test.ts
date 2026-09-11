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

  it("should calculate correct macros for 1 portion of Paneer (305 kcal, not 3 kcal undercount)", () => {
    // Calling with quantity: 1 and no unit (defaults to standardUnit "serving" = 100g)
    const resNoUnit = calculateFoodMacros("Paneer", 1);
    expect(resNoUnit.calories).toBe(305);
    expect(resNoUnit.proteinG).toBe(18.9);
    expect(resNoUnit.weightGrams).toBe(100);
    expect(resNoUnit.unitType).toBe("serving");
  });

  it("should calculate exact small gram weights for Paneer (e.g. 3g = ~9 kcal, not 300g)", () => {
    const res = calculateFoodMacros("Paneer", 3, "gram");
    expect(res.weightGrams).toBe(3);
    // 3g of raw paneer (305 kcal / 100g) = 9.15 kcal -> 9 kcal, 0.567g protein -> 0.6g protein
    expect(res.calories).toBe(9);
    expect(res.proteinG).toBe(0.6);
    expect(res.unitType).toBe("gram");
  });

  it("should calculate correct macros for 1 portion of Chicken Breast (150 kcal, not 1.5 kcal undercount)", () => {
    const res = calculateFoodMacros("Chicken Breast", 1);
    expect(res.calories).toBe(150);
    expect(res.proteinG).toBe(31.0);
    expect(res.weightGrams).toBe(100);
  });

  it("should return null from findIFCTItem and matched: false with 0 macros from calculateFoodMacros for non-matching dishes", () => {
    const item = findIFCTItem("bowl of soup");
    expect(item).toBeNull();

    const res = calculateFoodMacros("bowl of soup", 1, "piece");
    expect(res.matched).toBe(false);
    expect(res.calories).toBe(0);
    expect(res.proteinG).toBe(0);
    expect(res.carbsG).toBe(0);
    expect(res.fatG).toBe(0);
    expect(res.weightGrams).toBe(0);
  });
});

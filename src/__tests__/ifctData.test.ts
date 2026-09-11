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

  it("should correctly resolve moong dal to dal_moong instead of shadowing to dal_toor", () => {
    const item = findIFCTItem("moong dal");
    expect(item).not.toBeNull();
    expect(item?.id).toBe("dal_moong");
    expect(item?.name).toContain("Moong");
  });

  it("should correctly resolve masala dosa to dosa_masala instead of defaulting to dosa_plain", () => {
    const item = findIFCTItem("masala dosa");
    expect(item).not.toBeNull();
    expect(item?.id).toBe("dosa_masala");
    expect(item?.unitWeightGrams).toBe(150);
  });

  it("should correctly resolve toned milk to milk_toned instead of returning null", () => {
    const item = findIFCTItem("toned milk");
    expect(item).not.toBeNull();
    expect(item?.id).toBe("milk_toned");
  });

  it("should correctly resolve curry/sabzi paneer dishes to paneer_gravy instead of paneer_raw", () => {
    expect(findIFCTItem("matar paneer")?.id).toBe("paneer_gravy");
    expect(findIFCTItem("paneer curry")?.id).toBe("paneer_gravy");
    expect(findIFCTItem("palak paneer")?.id).toBe("paneer_gravy");
    expect(findIFCTItem("fresh paneer")?.id).toBe("paneer_raw");
  });

  describe("G-2: Quantity Ceiling & Plausibility Clamping", () => {
    it("should clamp quantity 15 for piece-type item (roti) to 8 and set quantityClamped: true", () => {
      const res = calculateFoodMacros("Roti", 15, "piece");
      expect(res.quantity).toBe(8);
      expect(res.quantityClamped).toBe(true);
      // 8 rotis = 8 * 35g = 280g
      expect(res.weightGrams).toBe(280);
    });

    it("should pass normal quantity (e.g. 2 rotis) through unchanged with quantityClamped: false", () => {
      const res = calculateFoodMacros("Roti", 2, "piece");
      expect(res.quantity).toBe(2);
      expect(res.quantityClamped).toBe(false);
      expect(res.weightGrams).toBe(70);
    });

    it("should clamp quantity 1000 with unitType 'gram' to 800 and set quantityClamped: true", () => {
      const res = calculateFoodMacros("Paneer", 1000, "gram");
      expect(res.quantity).toBe(800);
      expect(res.quantityClamped).toBe(true);
      expect(res.weightGrams).toBe(800);
    });

    it("should clamp katori items (dal/rice) to max 4 katoris", () => {
      const res = calculateFoodMacros("Yellow Dal", 7, "katori");
      expect(res.quantity).toBe(4);
      expect(res.quantityClamped).toBe(true);
      expect(res.weightGrams).toBe(600);
    });

    it("should clamp scoop items (whey) to max 3 scoops", () => {
      const res = calculateFoodMacros("Whey Protein", 5, "scoop");
      expect(res.quantity).toBe(3);
      expect(res.quantityClamped).toBe(true);
      expect(res.weightGrams).toBe(96);
    });
  });
});

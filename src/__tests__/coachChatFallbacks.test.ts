import { describe, it, expect } from "vitest";

/**
 * Normalization logic mirror from CoachChatFAB.tsx action handlers
 */
function normalizeCoachMeal(updatedData: any) {
  const totalCalories = updatedData.totalCalories || updatedData.calories || 0;
  const totalProteinG = updatedData.totalProtein || updatedData.totalProteinG || updatedData.protein || 0;
  const totalCarbsG =
    updatedData.totalCarbs ||
    updatedData.totalCarbsG ||
    updatedData.carbs ||
    (updatedData.items || []).reduce((s: number, f: any) => s + (f.carbsG || 0), 0);
  const totalFatG =
    updatedData.totalFat ||
    updatedData.totalFatG ||
    updatedData.fat ||
    (updatedData.items || []).reduce((s: number, f: any) => s + (f.fatG || 0), 0);

  return {
    mealType: updatedData.mealType || "meal",
    foods: updatedData.items || [],
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    notes: updatedData.notes || "",
    loggedVia: "chatbot",
  };
}

function normalizeCoachSteps(updatedData: any) {
  const steps = updatedData.steps || updatedData.count || 0;
  const distKm = updatedData.distanceKm || parseFloat((steps * 0.00075).toFixed(2));
  const kcal = updatedData.caloriesBurned || Math.round(steps * 0.04);
  return {
    count: steps,
    steps,
    distanceKm: distKm,
    caloriesBurned: kcal,
    notes: updatedData.notes || "",
    loggedVia: "chatbot",
  };
}

function normalizeCoachWater(updatedData: any) {
  const ml =
    updatedData.amountMl ||
    (updatedData.amountL ? Math.round(updatedData.amountL * 1000) : (updatedData.glasses ? updatedData.glasses * 250 : 0));
  const glasses = updatedData.glasses || Math.round(ml / 250);
  return {
    amountL: +(ml / 1000).toFixed(2),
    amountMl: ml,
    glasses,
    notes: updatedData.notes || "",
    loggedVia: "chatbot",
  };
}

describe("CoachChatFAB Field-Name Fallbacks", () => {
  describe("Bug 15: Water Logging Fallbacks", () => {
    it("should correctly handle amountL when amountMl is omitted", () => {
      const payload = normalizeCoachWater({ amountL: 1.5, notes: "Drank 2 bottles" });
      expect(payload.amountL).toBe(1.5);
      expect(payload.amountMl).toBe(1500);
      expect(payload.glasses).toBe(6);
    });

    it("should handle glasses when amountMl and amountL are omitted", () => {
      const payload = normalizeCoachWater({ glasses: 4 });
      expect(payload.amountL).toBe(1.0);
      expect(payload.amountMl).toBe(1000);
      expect(payload.glasses).toBe(4);
    });

    it("should prioritize amountMl when explicitly provided", () => {
      const payload = normalizeCoachWater({ amountMl: 750, glasses: 3 });
      expect(payload.amountL).toBe(0.75);
      expect(payload.amountMl).toBe(750);
      expect(payload.glasses).toBe(3);
    });
  });

  describe("Bug 18: Steps Logging Fallbacks", () => {
    it("should fall back to count when steps field is missing", () => {
      const payload = normalizeCoachSteps({ count: 8500 });
      expect(payload.steps).toBe(8500);
      expect(payload.count).toBe(8500);
      expect(payload.distanceKm).toBe(6.38);
      expect(payload.caloriesBurned).toBe(340);
    });

    it("should use steps when explicitly provided", () => {
      const payload = normalizeCoachSteps({ steps: 10000 });
      expect(payload.steps).toBe(10000);
      expect(payload.count).toBe(10000);
      expect(payload.distanceKm).toBe(7.5);
      expect(payload.caloriesBurned).toBe(400);
    });
  });

  describe("Bug 19: Meal Logging Protein and Macro Fallbacks", () => {
    it("should fall back to totalProteinG when totalProtein is missing", () => {
      const payload = normalizeCoachMeal({
        mealType: "lunch",
        calories: 550,
        totalProteinG: 35,
        totalCarbsG: 60,
        totalFatG: 15,
      });
      expect(payload.totalCalories).toBe(550);
      expect(payload.totalProteinG).toBe(35);
      expect(payload.totalCarbsG).toBe(60);
      expect(payload.totalFatG).toBe(15);
    });

    it("should fall back to protein / carbs / fat single word aliases", () => {
      const payload = normalizeCoachMeal({
        protein: 28,
        carbs: 45,
        fat: 10,
        calories: 380,
      });
      expect(payload.totalCalories).toBe(380);
      expect(payload.totalProteinG).toBe(28);
      expect(payload.totalCarbsG).toBe(45);
      expect(payload.totalFatG).toBe(10);
    });
  });
});

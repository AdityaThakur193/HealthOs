import { describe, it, expect } from "vitest";
import { normalizeCoachMeal, normalizeCoachSteps, normalizeCoachWater } from "../lib/coachActions";

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

import { describe, it, expect } from "vitest";
import {
  calculateMealMacroAllocation,
  getRecommendedAdditions,
  auditAndFixDietPlanMath,
} from "../lib/dietEngine";

describe("Grounded AI Diet Allocation Engine", () => {
  it("should space calories and protein across 4 structured meals correctly", () => {
    const meals = calculateMealMacroAllocation(2400, 160);
    expect(meals.length).toBe(4);
    expect(meals[0].name).toBe("Breakfast");
    expect(meals[0].targetCalories).toBe(600); // 25%
    expect(meals[0].targetProteinG).toBe(40); // 25%
    expect(meals[1].name).toBe("Lunch");
    expect(meals[1].targetCalories).toBe(720); // 30%
    expect(meals[1].targetProteinG).toBe(48); // 30%
  });

  it("should calculate exact additions for vegetarian preference", () => {
    const vegAdditions = getRecommendedAdditions(30, "veg");
    expect(vegAdditions.length).toBeGreaterThan(0);
    expect(vegAdditions.some((a) => a.item.includes("Whey"))).toBe(true);
    expect(vegAdditions.some((a) => a.item.includes("Egg"))).toBe(false);
    expect(vegAdditions.some((a) => a.item.includes("Chicken"))).toBe(false);
  });

  it("should calculate exact additions for eggetarian preference", () => {
    const eggAdditions = getRecommendedAdditions(20, "eggetarian");
    expect(eggAdditions.length).toBeGreaterThan(0);
    expect(eggAdditions.some((a) => a.item.includes("Egg Whites"))).toBe(true);
    expect(eggAdditions.some((a) => a.item.includes("Chicken"))).toBe(false);
  });

  it("should audit and override LLM arithmetic errors in generated diet plans", () => {
    const rawLLMPlan = {
      monday: {
        meals: [
          {
            time: "8:00 AM",
            name: "Breakfast",
            messItems: "• Roti (2 pieces - 6.4g P, 170 kcal)",
            additions: "• Whey Protein (1 Scoop - 24g P, 120 kcal)",
            proteinG: 999, // Hallucinated LLM number!
            calories: 9999, // Hallucinated LLM number!
          },
        ],
      },
    };

    const audited = auditAndFixDietPlanMath(rawLLMPlan);
    const auditedMeal = audited.monday.meals[0];

    // Math audit should override hallucinated 999/9999 with 6.4 + 24 = 30.4g P, 170 + 120 = 290 kcal
    expect(auditedMeal.proteinG).toBe(30.4);
    expect(auditedMeal.calories).toBe(290);
    expect(audited.monday.dailySummary.totalCalories).toBe(290);
    expect(audited.monday.dailySummary.totalProteinG).toBe(30.4);
  });
});

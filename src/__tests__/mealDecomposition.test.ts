import { describe, it, expect } from "vitest";
import { enrichMealAnalysisWithIFCT } from "../app/api/vision/route";
import { MealAnalysis } from "../lib/gemini";
import { calculateFoodMacros } from "../lib/ifctData";

describe("enrichMealAnalysisWithIFCT Ingredient Decomposition Pipeline", () => {
  it("should decompose full 'mutton curry' and sum accurate IFCT macros with Atwater lipid fallback", () => {
    // 150g mutton, 15g mustard oil, 40g onion, 30g tomato
    const rawAnalysis: MealAnalysis = {
      foods: [
        {
          name: "Mutton Curry",
          dishName: "mutton_curry",
          preparationStyle: "thick_home",
          quantity: 1,
          unitType: "katori",
          portionSize: "medium",
          ingredients: [
            { name: "mutton", estimatedGrams: 150 },
            { name: "mustard oil", estimatedGrams: 15 },
            { name: "onion", estimatedGrams: 40 },
            { name: "tomato", estimatedGrams: 30 },
          ],
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.95,
      plateType: "single_dish",
    };

    const enriched = enrichMealAnalysisWithIFCT(rawAnalysis);
    const dish = enriched.foods[0];

    expect(dish.unmatched).toBe(false);
    expect(dish.partialMatch).toBe(false);
    expect(dish.unmatchedIngredients).toBeUndefined();

    // Mutton (O001): 188.1 kcal, 20.33g P, 11.94g F, 0g C / 100g => * 1.5 = 282.15 kcal, 30.50g P, 17.91g F
    // Mustard oil (T006): 900 kcal (Atwater), 0g P, 100g F, 0g C / 100g => * 0.15 = 135 kcal, 0g P, 15g F
    // Onion (G017): 48.0 kcal, 1.34g P, 0.22g F, 9.77g C / 100g => * 0.4 = 19.2 kcal, 0.54g P, 0.09g F, 3.91g C
    // Tomato (D075): 19.8 kcal, 0.88g P, 0.24g F, 3.12g C / 100g => * 0.3 = 5.94 kcal, 0.26g P, 0.07g F, 0.94g C
    // Total kcal: 282.15 + 135 + 19.2 + 5.94 = 442.29 -> Math.round = 442 kcal
    expect(dish.estimatedCalories).toBe(442);
    // Total Protein: 30.50 + 0 + 0.54 + 0.26 = 31.3g
    expect(dish.proteinG).toBe(31.3);
    // Total Fat: 17.91 + 15 + 0.09 + 0.07 = 33.07 -> 33.1g
    expect(dish.fatG).toBe(33.1);
    // Total Carbs: 0 + 0 + 3.91 + 0.94 = 4.85 -> 4.8g
    expect(dish.carbsG).toBe(4.8);
    // Weight: 150 + 15 + 40 + 30 = 235g
    expect(dish.weightGrams).toBe(235);

    // Verify overall meal totals match
    expect(enriched.totalCalories).toBe(442);
    expect(enriched.totalProteinG).toBe(31.3);
    expect(enriched.totalFatG).toBe(33.1);
    expect(enriched.totalCarbsG).toBe(4.8);
  });

  it("should handle partial matches with unmatched ingredients contributing 0 and flagging the dish", () => {
    const rawAnalysis: MealAnalysis = {
      foods: [
        {
          name: "Chicken with Rare Herb",
          dishName: "chicken_special",
          quantity: 1,
          unitType: "plate",
          ingredients: [
            { name: "chicken", estimatedGrams: 100 },
            { name: "unknown_mysterious_herb_xyz", estimatedGrams: 20 },
          ],
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.9,
    };

    const enriched = enrichMealAnalysisWithIFCT(rawAnalysis);
    const dish = enriched.foods[0];

    // Chicken matches, but unknown herb does not
    expect(dish.unmatched).toBe(false);
    expect(dish.partialMatch).toBe(true);
    expect(dish.unmatchedIngredients).toEqual(["unknown_mysterious_herb_xyz"]);

    // Chicken (N003): 168.0 kcal, 21.8g P, 8.97g F (rounds to 9.0g), 1.13g C / 100g
    // Unknown contributes 0
    expect(dish.estimatedCalories).toBe(168);
    expect(dish.proteinG).toBe(21.8);
    expect(dish.fatG).toBe(9.0);
    expect(dish.carbsG).toBe(0);
    expect(dish.weightGrams).toBe(120); // Total estimated grams preserved

    // Notes must indicate the partial match warning
    expect(enriched.notes).toContain("Partial macro match for: Chicken with Rare Herb (unmatched: unknown_mysterious_herb_xyz)");
  });

  it("should mark dish as completely unmatched if all constituent ingredients fail to match", () => {
    const rawAnalysis: MealAnalysis = {
      foods: [
        {
          name: "Alien Dish",
          dishName: "alien_dish",
          quantity: 1,
          unitType: "plate",
          ingredients: [
            { name: "ingredient_one_unknown", estimatedGrams: 100 },
            { name: "ingredient_two_unknown", estimatedGrams: 50 },
          ],
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.9,
    };

    const enriched = enrichMealAnalysisWithIFCT(rawAnalysis);
    const dish = enriched.foods[0];

    expect(dish.unmatched).toBe(true);
    expect(dish.partialMatch).toBe(false);
    expect(dish.estimatedCalories).toBe(0);
    expect(enriched.notes).toContain("Couldn't identify macros for: Alien Dish — please edit manually.");
  });

  it("should fall back to legacy ifctData.ts calculateFoodMacros when ingredients array is absent or empty", () => {
    const legacyItem = calculateFoodMacros("Roti", 2, "piece");

    const rawAnalysis: MealAnalysis = {
      foods: [
        {
          name: "Whole Wheat Roti",
          dishName: "roti",
          preparationStyle: "plain",
          quantity: 2,
          unitType: "piece",
          // No ingredients array provided
        },
        {
          name: "Yellow Dal",
          dishName: "dal_toor",
          preparationStyle: "thin_mess",
          quantity: 1,
          unitType: "katori",
          ingredients: [], // Empty ingredients array
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.95,
      notes: "Hostel lunch",
    };

    const enriched = enrichMealAnalysisWithIFCT(rawAnalysis);
    const roti = enriched.foods[0];
    const dal = enriched.foods[1];

    // Roti checked against legacy calculateFoodMacros
    expect(roti.estimatedCalories).toBe(legacyItem.calories); // 208
    expect(roti.proteinG).toBe(legacyItem.proteinG); // 6.0
    expect(roti.carbsG).toBe(legacyItem.carbsG); // 34.4
    expect(roti.fatG).toBe(legacyItem.fatG); // 5.0
    expect(roti.unmatched).toBe(false);

    // Yellow Dal
    const dalLegacy = calculateFoodMacros("dal_toor", 1, "katori", "thin_mess");
    expect(dal.estimatedCalories).toBe(dalLegacy.calories);
    expect(dal.proteinG).toBe(dalLegacy.proteinG);
    expect(dal.unmatched).toBe(false);

    // Verify totals
    expect(enriched.totalCalories).toBe(legacyItem.calories + dalLegacy.calories);
  });

  it("should preserve legacy quantity clamping on the fallback path", () => {
    const rawAnalysis: MealAnalysis = {
      foods: [
        {
          name: "Roti",
          dishName: "roti",
          quantity: 12, // Excessive quantity, max is 8
          unitType: "piece",
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.9,
    };

    const enriched = enrichMealAnalysisWithIFCT(rawAnalysis);
    expect(enriched.foods[0].quantity).toBe(8);
    expect(enriched.foods[0].quantityClamped).toBe(true);
    expect(enriched.notes).toContain("Quantity adjusted to maximum plausible limit for: Roti — please verify.");
  });

  it("should accurately enrich complex restaurant meal: Butter Chicken, Butter Naan, and Chilli Chicken with supplemental standards", () => {
    const rawMeal: MealAnalysis = {
      foods: [
        {
          name: "Butter Chicken",
          dishName: "chicken_curry",
          preparationStyle: "rich_restaurant",
          quantity: 1,
          unitType: "katori",
          ingredients: [
            { name: "chicken", estimatedGrams: 150 },
            { name: "butter", estimatedGrams: 25 },
            { name: "fresh cream", estimatedGrams: 20 },
            { name: "cashew nut", estimatedGrams: 15 },
            { name: "tomato", estimatedGrams: 60 },
            { name: "garlic", estimatedGrams: 5 },
            { name: "ginger", estimatedGrams: 5 },
          ],
        },
        {
          name: "Butter Naan",
          dishName: "naan",
          preparationStyle: "ghee",
          quantity: 1,
          unitType: "piece",
          ingredients: [
            { name: "maida", estimatedGrams: 90 },
            { name: "butter", estimatedGrams: 15 },
          ],
        },
        {
          name: "Chilli Chicken",
          dishName: "chilli_chicken",
          preparationStyle: "fried",
          quantity: 1,
          unitType: "plate",
          ingredients: [
            { name: "chicken", estimatedGrams: 150 },
            { name: "sunflower oil", estimatedGrams: 20 },
            { name: "maida", estimatedGrams: 20 },
            { name: "capsicum", estimatedGrams: 40 },
            { name: "onion", estimatedGrams: 30 },
            { name: "garlic", estimatedGrams: 10 },
          ],
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.94,
    };

    const enriched = enrichMealAnalysisWithIFCT(rawMeal);
    const [butterChicken, butterNaan, chilliChicken] = enriched.foods;

    // 1. Butter Chicken
    expect(butterChicken.unmatched).toBe(false);
    expect(butterChicken.partialMatch).toBe(false);
    expect(butterChicken.estimatedCalories).toBe(589);
    expect(butterChicken.proteinG).toBe(37.2);
    expect(butterChicken.fatG).toBe(45.8);
    expect(butterChicken.carbsG).toBe(8.0);

    // 2. Butter Naan (90g baked naan matrix / 1.38 -> 65.2g raw maida + 15g butter)
    expect(butterNaan.unmatched).toBe(false);
    expect(butterNaan.partialMatch).toBe(false);
    expect(butterNaan.estimatedCalories).toBe(337);
    expect(butterNaan.proteinG).toBe(6.9);
    expect(butterNaan.fatG).toBe(12.7);
    expect(butterNaan.carbsG).toBe(48.4);

    // 3. Chilli Chicken
    expect(chilliChicken.unmatched).toBe(false);
    expect(chilliChicken.partialMatch).toBe(false);
    expect(chilliChicken.estimatedCalories).toBe(517);
    expect(chilliChicken.proteinG).toBe(35.8);
    expect(chilliChicken.fatG).toBe(33.8);
    expect(chilliChicken.carbsG).toBe(16.6);

    // Overall meal totals
    expect(enriched.totalCalories).toBe(589 + 337 + 517); // 1443 kcal
    expect(enriched.totalProteinG).toBe(Math.round((37.2 + 6.9 + 35.8) * 10) / 10); // 79.9g
    expect(enriched.totalFatG).toBe(Math.round((45.8 + 12.7 + 33.8) * 10) / 10); // 92.3g
  });

  it("should accurately apply CULINARY_TRANSFORMS hydration and processing conversions for rice, roti, calibrated naan, dal, and birista garnish", () => {
    const rawMeal: MealAnalysis = {
      foods: [
        {
          name: "Cooked Basmati Rice",
          dishName: "rice_cooked",
          preparationStyle: "steamed",
          quantity: 1,
          unitType: "plate",
          ingredients: [
            { name: "cooked basmati rice", estimatedGrams: 220 }, // 220g cooked / 2.73 -> 80.6g raw
          ],
        },
        {
          name: "Whole Wheat Roti",
          dishName: "roti",
          preparationStyle: "plain",
          quantity: 1,
          unitType: "piece",
          ingredients: [
            { name: "roti", estimatedGrams: 40 }, // 40g baked / 1.43 -> 28.0g raw atta
          ],
        },
        {
          name: "Calibrated Butter Naan",
          dishName: "butter_naan",
          preparationStyle: "tandoor",
          quantity: 1,
          unitType: "piece",
          ingredients: [
            { name: "maida", estimatedGrams: 90 }, // 90g baked / 1.38 -> 65.2g raw maida (~229 kcal)
            { name: "butter", estimatedGrams: 8 },  // 8g butter glaze (~57 kcal)
          ],
        },
        {
          name: "Cooked Yellow Dal",
          dishName: "dal_toor",
          preparationStyle: "thick_home",
          quantity: 1,
          unitType: "katori",
          ingredients: [
            { name: "cooked toor dal", estimatedGrams: 150 }, // 150g cooked / 3.85 -> 39.0g raw dal
          ],
        },
        {
          name: "Birista Garnish",
          dishName: "birista",
          preparationStyle: "fried",
          quantity: 1,
          unitType: "plate",
          ingredients: [
            { name: "birista", estimatedGrams: 10 }, // 10g fried -> 25g raw onion + 3.5g absorbed oil
          ],
        },
      ],
      totalCalories: 0,
      totalProteinG: 0,
      confidence: 0.95,
    };

    const enriched = enrichMealAnalysisWithIFCT(rawMeal);
    const [rice, roti, naan, dal, birista] = enriched.foods;

    // 1. Cooked Basmati Rice (220g visible -> 80.6g raw rice A015: 356.4 kcal, 7.94g P, 0.52g F, 78.24g C)
    expect(rice.weightGrams).toBe(220); // Preserves visible plate weight
    expect(rice.estimatedCalories).toBe(287);
    expect(rice.proteinG).toBe(6.4);
    expect(rice.fatG).toBe(0.4);
    expect(rice.carbsG).toBe(63.1);

    // 2. Whole Wheat Roti (40g visible -> 28.0g raw atta A019: 320.3 kcal, 10.57g P, 1.53g F, 64.17g C)
    expect(roti.weightGrams).toBe(40);
    expect(roti.estimatedCalories).toBe(90);
    expect(roti.proteinG).toBe(3.0);
    expect(roti.fatG).toBe(0.4);
    expect(roti.carbsG).toBe(18.0);

    // 3. Calibrated Butter Naan (90g maida / 1.38 = 65.2g maida -> 229.4 kcal + 8g butter -> 57.4 kcal = 287 kcal)
    expect(naan.weightGrams).toBe(98);
    expect(naan.estimatedCalories).toBe(287);
    expect(naan.proteinG).toBe(6.8);
    expect(naan.fatG).toBe(7.0);
    expect(naan.carbsG).toBe(48.4);

    // 4. Cooked Yellow Dal (150g visible -> 39.0g raw toor dal B021: 330.8 kcal, 21.7g P, 1.56g F, 55.23g C)
    expect(dal.weightGrams).toBe(150);
    expect(dal.estimatedCalories).toBe(129);
    expect(dal.proteinG).toBe(8.5);
    expect(dal.fatG).toBe(0.6);
    expect(dal.carbsG).toBe(21.5);

    // 5. Birista Garnish (10g fried -> 25g raw onion [12.0 kcal, 0.38g P, 0.06g F, 2.39g C] + 3.5g oil [31.5 kcal, 3.5g F] = 44 kcal)
    expect(birista.weightGrams).toBe(10);
    expect(birista.estimatedCalories).toBe(44);
    expect(birista.proteinG).toBe(0.4);
    expect(birista.fatG).toBe(3.6);
    expect(birista.carbsG).toBe(2.4);
  });
});

/**
 * Grounded AI Diet Allocation Engine & Deterministic Math Audit
 *
 * Source: ICMR-NIN IFCT 2017 & Muscle Protein Synthesis (MPS) Leucine Spacing.
 * Principle: "Use software for certainty; use AI for uncertainty."
 */

import { calculateFoodMacros } from "./ifctData";

export interface MealTarget {
  name: string;
  time: string;
  targetCalories: number;
  targetProteinG: number;
}

export interface MealAdditionOption {
  item: string;
  proteinG: number;
  calories: number;
  description: string;
}

/**
 * Spaces daily target calories and protein across 4 structured meals
 * based on Muscle Protein Synthesis (MPS) leucine threshold guidelines.
 */
export function calculateMealMacroAllocation(
  targetCalories: number,
  targetProtein: number
): MealTarget[] {
  const cal = Math.max(1200, Math.min(4500, Number(targetCalories) || 2000));
  const prot = Math.max(40, Math.min(300, Number(targetProtein) || 120));

  return [
    {
      name: "Breakfast",
      time: "8:00 AM",
      targetCalories: Math.round(cal * 0.25),
      targetProteinG: Math.round(prot * 0.25),
    },
    {
      name: "Lunch",
      time: "1:00 PM",
      targetCalories: Math.round(cal * 0.30),
      targetProteinG: Math.round(prot * 0.30),
    },
    {
      name: "Evening Snack",
      time: "5:00 PM",
      targetCalories: Math.round(cal * 0.15),
      targetProteinG: Math.round(prot * 0.15),
    },
    {
      name: "Dinner",
      time: "8:15 PM",
      targetCalories: Math.round(cal * 0.30),
      targetProteinG: Math.round(prot * 0.30),
    },
  ];
}

/**
 * Calculates exact additions using official ICMR-NIN IFCT 2017 benchmarks
 * to cover any protein/calorie deficit between mess food and daily targets.
 */
export function getRecommendedAdditions(
  deficitProtein: number,
  dietPreference: string = "none"
): MealAdditionOption[] {
  const pref = dietPreference.toLowerCase();
  const additions: MealAdditionOption[] = [];

  if (deficitProtein <= 0) return additions;

  if (pref === "veg" || pref === "vegetarian") {
    if (deficitProtein >= 20) {
      additions.push({
        item: "Whey Protein (1 Scoop = 32g)",
        proteinG: 24.0,
        calories: 120,
        description: "1 Scoop Whey Protein in 200ml water or milk",
      });
    }
    if (deficitProtein >= 15) {
      additions.push({
        item: "Paneer (100g Raw)",
        proteinG: 18.9,
        calories: 305,
        description: "100g Fresh Raw Paneer Cubes",
      });
    }
    additions.push({
      item: "Plain Curd / Dahi (150g)",
      proteinG: 5.25,
      calories: 90,
      description: "1 Katori Plain Curd with meal",
    });
  } else if (pref === "eggetarian") {
    if (deficitProtein >= 15) {
      additions.push({
        item: "Boiled Egg Whites (4 Large)",
        proteinG: 16.0,
        calories: 68,
        description: "4 Boiled Egg Whites",
      });
    }
    if (deficitProtein >= 10) {
      additions.push({
        item: "Whole Boiled Eggs (2 Eggs)",
        proteinG: 13.2,
        calories: 143,
        description: "2 Whole Boiled Eggs",
      });
    }
    additions.push({
      item: "Whey Protein (1 Scoop = 32g)",
      proteinG: 24.0,
      calories: 120,
      description: "1 Scoop Whey Protein in water",
    });
  } else {
    // Non-Veg / Default
    if (deficitProtein >= 25) {
      additions.push({
        item: "Boiled Chicken Breast (100g)",
        proteinG: 31.0,
        calories: 150,
        description: "100g Boiled / Shredded Chicken Breast",
      });
    }
    if (deficitProtein >= 15) {
      additions.push({
        item: "Boiled Egg Whites (4 Large)",
        proteinG: 16.0,
        calories: 68,
        description: "4 Boiled Egg Whites",
      });
    }
    additions.push({
      item: "Whole Boiled Egg (1 Egg)",
      proteinG: 6.6,
      calories: 71.5,
      description: "1 Whole Boiled Egg",
    });
  }

  return additions;
}

/**
 * Programmatically audits and verifies macro calculations in generated diet plans,
 * eliminating LLM arithmetic hallucinations.
 */
export function auditAndFixDietPlanMath(dietPlan: Record<string, any>): Record<string, any> {
  if (!dietPlan || typeof dietPlan !== "object") return dietPlan;

  const auditedPlan: Record<string, any> = {};

  for (const [dayKey, dayData] of Object.entries(dietPlan)) {
    if (dayData && typeof dayData === "object" && Array.isArray((dayData as any).meals)) {
      const auditedMeals = (dayData as any).meals.map((meal: any) => {
        if (!meal || typeof meal !== "object") return meal;
        let computedProtein = 0;
        let computedCalories = 0;

        // Parse individual items from messItems and additions text if format matches "Name (Details - Xg P, Y kcal)"
        const textToScan = `${meal.messItems || ""} ${meal.additions || ""}`;

        // Regex pattern to extract macro numbers from parenthesis: e.g. "(... - 6g P, 120 kcal)"
        const macroMatches = textToScan.matchAll(/\(([^)]*?(\d+(?:\.\d+)?)\s*g\s*P[^)]*?(\d+)\s*kcal[^)]*?)\)/gi);

        let matchFound = false;
        for (const match of macroMatches) {
          matchFound = true;
          const protVal = parseFloat(match[2]);
          const calVal = parseInt(match[3], 10);
          if (!isNaN(protVal)) computedProtein += protVal;
          if (!isNaN(calVal)) computedCalories += calVal;
        }

        // If items were itemized, override meal totals with exact audited sums; otherwise sanitize existing meal values
        const finalProtein = matchFound && computedProtein > 0 ? Math.round(computedProtein * 10) / 10 : Math.round(Number(meal.proteinG) || 0);
        const finalCalories = matchFound && computedCalories > 0 ? Math.round(computedCalories) : Math.round(Number(meal.calories) || 0);

        return {
          ...meal,
          proteinG: finalProtein,
          calories: finalCalories,
        };
      });

      // Calculate daily total
      const dailyCalories = auditedMeals.reduce((sum: number, m: any) => sum + m.calories, 0);
      const dailyProteinG = Math.round(auditedMeals.reduce((sum: number, m: any) => sum + m.proteinG, 0) * 10) / 10;

      auditedPlan[dayKey] = {
        meals: auditedMeals,
        dailySummary: {
          totalCalories: dailyCalories,
          totalProteinG: dailyProteinG,
        },
      };
    } else {
      auditedPlan[dayKey] = dayData;
    }
  }

  return auditedPlan;
}

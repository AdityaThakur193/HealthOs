import { describe, expect, it } from "vitest";
import { buildWeeklyPlan, findFoodsNeedingEstimates, FoodEstimates, parseCustomRules, parseMenuItems, PlannerProfile, WEEK_DAYS } from "../lib/dietPlanner";
import { DEFAULT_MESS_TIMINGS } from "../lib/mealWindows";

const day = { breakfast: "Poha, Boiled Egg, Tea", lunch: "Rajma Chawal, Roti, Curd", snacks: "Samosa, Tea", dinner: "Paneer, Dal, Rice, Roti" };
const menu = Object.fromEntries(WEEK_DAYS.map((name) => [name, day]));

const profile: PlannerProfile = { targetCalories: 2200, targetProteinG: 150, dietPreference: "non_veg" };

const estimates: FoodEstimates = {
  tea: { unit: "cup", grams: 150, calories: 80, proteinG: 2, carbsG: 10, fatG: 3 },
  samosa: { unit: "piece", grams: 80, calories: 250, proteinG: 4, carbsG: 28, fatG: 13 },
  "aloo sabzi": { unit: "katori", grams: 150, calories: 160, proteinG: 3, carbsG: 22, fatG: 7 },
};

const plan = (overrides: Partial<PlannerProfile> = {}, customMenu: Record<string, Record<string, string>> = menu, variants = {}) =>
  buildWeeklyPlan({ menu: customMenu, profile: { ...profile, ...overrides }, timings: DEFAULT_MESS_TIMINGS, estimates, variants });

function quantityOf(text: string | undefined, food: string): number {
  const match = text?.match(new RegExp(`${food} \\((\\d+(?:\\.\\d+)?) `, "i"));
  return match ? Number(match[1]) : NaN;
}

describe("Menu parsing", () => {
  it("splits items and separates combos", () => {
    expect(parseMenuItems("Rajma Chawal, Roti + Curd")).toEqual(["Rajma", "Chawal", "Roti", "Curd"]);
    expect(parseMenuItems("Idli Sambhar and Chutney")).toEqual(["Idli", "Sambhar", "Chutney"]);
  });

  it("keeps dishes that are a single food", () => {
    expect(parseMenuItems("Jeera Rice, Fried Rice")).toEqual(["Jeera Rice", "Fried Rice"]);
  });

  it("ignores placeholders and notes in brackets", () => {
    expect(parseMenuItems("Not specified")).toEqual([]);
    expect(parseMenuItems("Dal (thin), -")).toEqual(["Dal"]);
    expect(parseMenuItems(undefined)).toEqual([]);
  });
});

describe("Realistic portions", () => {
  const huge = plan({ targetCalories: 4000, targetProteinG: 250 });

  it("never plans more rotis than a person eats, even for a huge target", () => {
    for (const name of WEEK_DAYS) {
      for (const meal of huge[name].meals) {
        const rotis = quantityOf(meal.messItems, "Roti");
        if (!Number.isNaN(rotis)) expect(rotis).toBeLessThanOrEqual(4);
        const rice = quantityOf(meal.messItems, "Rice");
        if (!Number.isNaN(rice)) expect(rice).toBeLessThanOrEqual(2);
        const paneer = quantityOf(meal.messItems, "Paneer");
        if (!Number.isNaN(paneer)) expect(paneer).toBeLessThanOrEqual(1.5);
      }
    }
  });

  it("keeps normal food on the plate even for a small target", () => {
    const small = plan({ targetCalories: 1300, targetProteinG: 60 });
    expect(quantityOf(small.monday.meals[3].messItems, "Roti")).toBeGreaterThanOrEqual(1);
  });

  it("uses IFCT numbers for known foods", () => {
    // One 35g roti is 86 kcal and 3.2g protein in the database.
    const single = plan({}, Object.fromEntries(WEEK_DAYS.map((name) => [name, { lunch: "Roti" }])));
    expect(single.monday.meals[1].messItems).toMatch(/Roti \(\d pieces? - /);
    expect(single.monday.meals[1].messItems).not.toContain("estimated");
  });

  it("labels AI numbers as estimated", () => {
    const samosa = plan({}, Object.fromEntries(WEEK_DAYS.map((name) => [name, { snacks: "Samosa" }])));
    expect(samosa.monday.meals[2].messItems).toContain("estimated");
  });

  it("doesn't count a food with no nutrition data, and says so", () => {
    const result = buildWeeklyPlan({ menu: Object.fromEntries(WEEK_DAYS.map((name) => [name, { lunch: "Mystery Bake" }])), profile, timings: DEFAULT_MESS_TIMINGS });
    expect(result.monday.meals[1].messItems).toContain("nutrition unknown");
    expect(result.monday.dailySummary?.note).toContain("Mystery Bake");
  });

  it("adds totals up exactly", () => {
    const monday = plan().monday;
    expect(monday.dailySummary?.totalCalories).toBe(monday.meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0));
  });

  it("gets the same answer every time", () => {
    expect(plan()).toEqual(plan());
  });
});

describe("Diet and allergy safety", () => {
  it("removes non-vegetarian mess items and additions for vegetarians", () => {
    const veg = plan({ dietPreference: "vegetarian" });
    const text = veg.monday.meals.map((meal) => `${meal.messItems} ${meal.additions}`).join(" ");
    expect(text).toContain("Skipped for your diet, allergies or rules: Boiled Egg");
    expect(veg.monday.meals[0].additions).not.toMatch(/egg|chicken/i);
  });

  it("gives vegans no dairy, egg or whey", () => {
    const vegan = plan({ dietPreference: "vegan" });
    for (const meal of vegan.monday.meals) expect(meal.additions).not.toMatch(/whey|paneer|curd|egg/i);
    expect(vegan.monday.meals[3].messItems).toContain("Skipped for your diet, allergies or rules");
  });

  it("removes allergens from food and additions", () => {
    const allergic = plan({ dietPreference: "vegetarian", foodAllergies: ["dairy"] });
    const text = allergic.monday.meals.map((meal) => `${meal.messItems} ${meal.additions}`).join(" ").replace(/Skipped[^\n]*/g, "");
    expect(text).not.toMatch(/paneer|curd/i);
  });

  it("respects a no-whey preference", () => {
    const noWhey = plan({ dietPreference: "vegetarian", customDietPreferences: "no whey please" });
    for (const name of WEEK_DAYS) for (const meal of noWhey[name].meals) expect(meal.additions).not.toContain("Whey");
  });
});

describe("The user's own rules", () => {
  it("reads no and limit rules", () => {
    expect(parseCustomRules("No soya chunks, limit chapatis to 2 per day")).toEqual({
      avoid: ["soya chunks"],
      limits: [{ term: "chapatis", max: 2 }],
    });
  });

  it("removes foods the user said no to, from the menu and additions", () => {
    const result = plan({ customDietPreferences: "no rajma, avoid whey" }).monday;
    expect(result.meals[1].messItems).toContain("Skipped for your diet, allergies or rules: Rajma");
    for (const meal of result.meals) expect(meal.additions).not.toContain("Whey");
  });

  it("holds a limited food to its daily total, whatever the menu calls it", () => {
    const result = plan({ customDietPreferences: "Limit chapatis to 2 per day", targetCalories: 3000 }).monday;
    const rotis = result.meals.reduce((sum, meal) => sum + (quantityOf(meal.messItems, "Roti") || 0), 0);
    expect(rotis).toBeLessThanOrEqual(2);
  });
});

describe("Additions", () => {
  it("adds nothing in strict mess mode and states the limit honestly", () => {
    const strict = plan({ strictMessOnly: true });
    for (const meal of strict.monday.meals) expect(meal.additions).toBe("None (Strict Mess Only)");
    expect(strict.monday.dailySummary?.note).toContain("strict mess mode");
  });

  it("uses additions to close a protein gap, without overdoing it", () => {
    const monday = plan().monday;
    const items = monday.meals.filter((meal) => meal.additions !== "None needed").flatMap((meal) => meal.additions!.split("\n"));
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(3);
    expect(monday.dailySummary!.totalProteinG).toBeGreaterThan(monday.dailySummary!.messProteinG!);
  });

  it("adds nothing when the mess already reaches the target", () => {
    const easy = plan({ targetProteinG: 40 });
    for (const meal of easy.monday.meals) expect(meal.additions).toBe("None needed");
  });

  it("changes additions when a meal is swapped", () => {
    const before = plan().monday.meals.find((meal) => meal.additions !== "None needed")!;
    const mealKey = before.name === "Evening Snack" ? "snacks" : before.name!.toLowerCase();
    const after = plan({}, menu, { [`monday:${mealKey}`]: 1 }).monday.meals.find((meal) => meal.name === before.name)!;
    expect(after.additions).not.toBe(before.additions);
  });
});

describe("Mess hours in the plan", () => {
  it("shows the Sunday breakfast time on Sundays only", () => {
    const week = plan();
    expect(week.sunday.meals[0].time).toBe("7:30 AM to 9:30 AM");
    expect(week.monday.meals[0].time).toBe("7:00 AM to 9:00 AM");
    expect(week.monday.meals[3].time).toBe("7:30 PM to 9:30 PM");
  });
});

describe("Daily calories", () => {
  it("trims portions when additions push the day over target", () => {
    const summary = plan({ targetCalories: 1800, targetProteinG: 110, dietPreference: "vegetarian" }).monday.dailySummary!;
    expect(summary.totalCalories).toBeLessThanOrEqual(1875);
  });

  it("says so when even minimum portions run over", () => {
    const heavy = { breakfast: "Paneer Butter Masala, Chicken Curry", lunch: "Paneer Butter Masala, Chicken Curry", snacks: "Paneer Butter Masala, Chicken Curry", dinner: "Paneer Butter Masala, Chicken Curry" };
    const summary = plan({ targetCalories: 1200, targetProteinG: 60 }, Object.fromEntries(WEEK_DAYS.map((name) => [name, heavy]))).monday.dailySummary!;
    expect(summary.totalCalories).toBeGreaterThan(1350);
    expect(summary.note).toContain("over your target");
  });
});

describe("Whole foods", () => {
  it("uses IFCT for a plain fruit even when the AI estimated it", () => {
    const fruit = buildWeeklyPlan({
      menu: Object.fromEntries(WEEK_DAYS.map((name) => [name, { snacks: "Banana" }])),
      profile,
      timings: DEFAULT_MESS_TIMINGS,
      estimates: { banana: { unit: "piece", grams: 100, calories: 999, proteinG: 50, carbsG: 0, fatG: 0 } },
    });
    expect(fruit.monday.meals[2].messItems).not.toContain("estimated");
    expect(fruit.monday.meals[2].calories).toBeLessThan(400);
  });
});

describe("Estimates needed", () => {
  it("asks only about foods IFCT doesn't cover, once each", () => {
    const needed = findFoodsNeedingEstimates(menu);
    expect(needed).toContain("samosa");
    expect(needed).toContain("tea");
    expect(needed).not.toContain("roti");
    expect(needed.filter((name) => name === "tea")).toHaveLength(1);
  });

  it("doesn't mistake a dish for its ingredient", () => {
    expect(findFoodsNeedingEstimates({ monday: { lunch: "Rice Kheer, Paneer Paratha" } })).toEqual(["rice kheer", "paneer paratha"]);
  });
});

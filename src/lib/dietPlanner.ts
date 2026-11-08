import { calculateFoodMacros, findIFCTItem } from "./ifctData";
import { matchIngredient } from "./ifctMatcher";
import { calculateMealMacroAllocation, DietMeal, DietPlan } from "./dietEngine";
import { formatMealTime, MEAL_NAMES, MealName, MessTimings } from "./mealWindows";

/**
 * Builds a week of meals from what the mess actually serves.
 *
 * Code chooses every portion within limits a person would really eat, and
 * nutrition comes from IFCT wherever it can. AI only supplies a labelled
 * estimate for dishes IFCT doesn't cover.
 */

export const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const MEAL_LABELS: Record<MealName, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Evening Snack",
  dinner: "Dinner",
};

export interface FoodEstimate {
  unit: string;
  grams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type FoodEstimates = Record<string, FoodEstimate>;

interface PortionRule {
  start: number;
  min: number;
  max: number;
  step: number;
}

interface PlannedFood {
  name: string;
  unit: string;
  calories: number;
  proteinG: number;
  source: "ifct" | "estimated" | "unknown";
  rule: PortionRule;
  quantity: number;
}

export interface PlannerProfile {
  targetCalories: number;
  targetProteinG: number;
  dietPreference?: string;
  foodAllergies?: string[];
  customDietPreferences?: string;
  strictMessOnly?: boolean;
}

const IGNORED_ITEM = /^(not specified|n\/?a|none|nil|closed|holiday|no (meal|service)|-+)$/i;

/** Dishes whose name contains a basic food but aren't that food. */
const COMPOSITE_DISH =
  /kheer|biryani|biriyani|pulao|pulav|khichdi|halwa|paratha|pakora|pakoda|fried rice|lemon rice|curd rice|kadhi|raita|sambar|sambhar|rasam|bhature|bhatura|manchurian|noodles|soup|shake|lassi|chaat|bhurji|omelette|maggi|sandwich|kofta|custard/i;

/** Whole foods where an ingredient match really is the food being served. */
const WHOLE_FOOD = /^(banana|apple|orange|guava|papaya|mango|watermelon|sprouts|cucumber|tomato|carrot|peanuts?|almonds?)$/i;

/** How much of a food a person realistically eats at one sitting. First match wins. */
const PORTION_RULES: [RegExp, PortionRule][] = [
  [/roti|chapati|chapathi|phulka/i, { start: 2, min: 1, max: 4, step: 1 }],
  [/paratha/i, { start: 2, min: 1, max: 3, step: 1 }],
  [/puri|poori|bhatura|bhature|naan/i, { start: 2, min: 1, max: 3, step: 1 }],
  [/bread|toast/i, { start: 2, min: 1, max: 4, step: 1 }],
  [/idli/i, { start: 3, min: 2, max: 5, step: 1 }],
  [/dosa|uttapam|utapam/i, { start: 1, min: 1, max: 2, step: 1 }],
  [/vada|samosa|pakora|pakoda|kachori|cutlet/i, { start: 1, min: 0, max: 2, step: 1 }],
  [/kheer|halwa|gulab|jalebi|sweet|custard|ice cream|rasgulla|ladoo|laddu/i, { start: 1, min: 0, max: 1, step: 1 }],
  [/\b(tea|chai|coffee)\b/i, { start: 1, min: 1, max: 1, step: 1 }],
  [/salad|pickle|achar|papad|chutney/i, { start: 1, min: 1, max: 1, step: 1 }],
  [/banana|apple|orange|fruit/i, { start: 1, min: 1, max: 2, step: 1 }],
  [/rice|chawal|biryani|biriyani|pulao|pulav|khichdi/i, { start: 1, min: 0.5, max: 2, step: 0.5 }],
  [/egg|anda|omelette/i, { start: 2, min: 1, max: 3, step: 1 }],
  [/paneer|chicken|mutton|fish|soya/i, { start: 1, min: 1, max: 1.5, step: 0.5 }],
  [/dal|rajma|chole|chana|sambar|sambhar|kadhi|rasam/i, { start: 1, min: 0.5, max: 2, step: 0.5 }],
  [/curd|dahi|raita|milk|lassi/i, { start: 1, min: 1, max: 2, step: 0.5 }],
  [/poha|upma|maggi|noodles|pasta|sandwich/i, { start: 1, min: 0.5, max: 2, step: 0.5 }],
];

const DEFAULT_RULE: PortionRule = { start: 1, min: 0.5, max: 1.5, step: 0.5 };

const MAX_KATORIS_PER_MEAL = 3.5;

function ruleFor(name: string): PortionRule {
  return PORTION_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? DEFAULT_RULE;
}

/** Turns a menu line into individual foods, separating combos like "Rajma Chawal". */
export function parseMenuItems(text: string | undefined): string[] {
  if (!text) return [];

  const parts = text
    .split(/[,/+&;\n]|\band\b|\bwith\b/i)
    .map((part) => part.replace(/\(.*?\)/g, "").trim())
    .filter((part) => part && !IGNORED_ITEM.test(part));

  const items = parts.flatMap((part) => {
    const combo = part.match(/^(.+?)\s+(chawal|rice|sambhar|sambar|bhature|bhatura)$/i);
    if (combo && !/^(jeera|fried|lemon|curd|veg|plain|steamed|brown|tomato|masala|egg|chicken|white)$/i.test(combo[1])) {
      return [combo[1], combo[2]];
    }
    return [part];
  });

  return [...new Set(items)];
}

const NON_VEG = /chicken|mutton|fish|prawn|keema|meat/i;
const EGG = /egg|anda|omelette/i;
const DAIRY = /paneer|curd|dahi|milk|ghee|butter|kheer|lassi|raita|cheese|malai/i;

const ALLERGY_TERMS: [RegExp, RegExp][] = [
  [/peanut|groundnut/i, /peanut|groundnut|moongfali/i],
  [/milk|dairy|lactose/i, DAIRY],
  [/\begg/i, EGG],
  [/gluten|wheat/i, /roti|chapati|chapathi|phulka|paratha|naan|puri|poori|bread|maida|atta|bhatura|bhature/i],
  [/\bsoy/i, /soya|soy|tofu/i],
  [/\bnut|cashew|almond/i, /kaju|cashew|badam|almond|peanut|groundnut/i],
];

interface CustomRules {
  avoid: string[];
  limits: { term: string; max: number }[];
}

/** Reads "no soya chunks" and "limit chapatis to 2" style rules from the user's notes. */
export function parseCustomRules(text: string | undefined): CustomRules {
  const notes = text ?? "";
  return {
    avoid: [...notes.matchAll(/\b(?:no|avoid|without|skip)\s+([a-z][a-z ]*?)(?=\s*(?:[,.;\n]|$|please\b|per\b))/gi)].map((match) => match[1]),
    limits: [...notes.matchAll(/\b(?:limit|max(?:imum)?)\s+([a-z][a-z ]*?)\s+to\s+(\d+)/gi)].map((match) => ({
      term: match[1],
      max: Number(match[2]),
    })),
  };
}

const SAME_FOOD = /roti|chapati|chapathi|phulka/gi;

function matchesRule(name: string, term: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(SAME_FOOD, "roti").trim();
  const singular = normalize(term).replace(/(?<=[a-z])s$/, "");
  return normalize(name).includes(singular);
}

/** Holds each limited food to its daily maximum, taking from the latest meals first. */
function applyDailyLimits(foods: PlannedFood[], limits: CustomRules["limits"]): void {
  for (const { term, max } of limits) {
    const matching = foods.filter((food) => matchesRule(food.name, term)).reverse();
    let total = matching.reduce((sum, food) => sum + food.quantity, 0);
    for (const food of matching) {
      while (total > max && food.quantity > 0) {
        food.quantity -= food.rule.step;
        total -= food.rule.step;
      }
    }
  }
}

function conflictsWithAllergy(name: string, allergies: string[]): boolean {
  return allergies.some((allergy) => {
    const term = allergy.trim();
    if (!term) return false;
    if (name.toLowerCase().includes(term.toLowerCase())) return true;
    return ALLERGY_TERMS.some(([trigger, foods]) => trigger.test(term) && foods.test(name));
  });
}

function fitsDiet(name: string, dietPreference: string | undefined): boolean {
  switch (dietPreference) {
    case "vegan":
      return !NON_VEG.test(name) && !EGG.test(name) && !DAIRY.test(name);
    case "vegetarian":
      return !NON_VEG.test(name) && !EGG.test(name);
    case "eggetarian":
      return !NON_VEG.test(name);
    default:
      return true;
  }
}

function fromIfct(name: string): Pick<PlannedFood, "name" | "unit" | "calories" | "proteinG"> | null {
  if (COMPOSITE_DISH.test(name)) return null;
  // Mess paneer is a curry, not a 100g block of raw paneer.
  const lookup = /paneer/i.test(name) ? "paneer gravy" : name;
  const item = findIFCTItem(lookup);
  if (!item) return null;

  const isPlainDal = item.id === "dal_toor" && !/tadka|fry/i.test(name);
  const prep = isPlainDal ? "thin_mess" : item.id === "dal_toor" ? "dal_tadka" : "standard";
  const macros = calculateFoodMacros(lookup, 1, item.standardUnit, prep);
  return { name, unit: item.standardUnit, calories: macros.calories, proteinG: macros.proteinG };
}

/** Simple foods IFCT covers by ingredient get IFCT numbers at the estimated serving size. */
function groundEstimate(name: string, estimate: FoodEstimate): Pick<FoodEstimate, "calories" | "proteinG"> & { grounded: boolean } {
  if (WHOLE_FOOD.test(name.trim())) {
    const match = matchIngredient(name);
    if (match && estimate.grams > 0) {
      const factor = estimate.grams / 100;
      return {
        calories: Math.round(match.nutrientsPer100g.energyKcal * factor),
        proteinG: Math.round(match.nutrientsPer100g.proteinG * factor * 10) / 10,
        grounded: true,
      };
    }
  }
  return { calories: estimate.calories, proteinG: estimate.proteinG, grounded: false };
}

function toPlannedFood(name: string, estimates: FoodEstimates): PlannedFood {
  const rule = ruleFor(name);
  const known = fromIfct(name);
  if (known) return { ...known, source: "ifct", rule, quantity: rule.start };

  const estimate = estimates[name.toLowerCase()];
  if (estimate) {
    const { calories, proteinG, grounded } = groundEstimate(name, estimate);
    return { name, unit: estimate.unit, calories, proteinG, source: grounded ? "ifct" : "estimated", rule, quantity: rule.start };
  }
  return { name, unit: "serving", calories: 0, proteinG: 0, source: "unknown", rule, quantity: rule.start };
}

/** Menu items IFCT can't answer, so the caller can get estimates for them. */
export function findFoodsNeedingEstimates(menu: Record<string, Record<string, string> | undefined>): string[] {
  const names = WEEK_DAYS.flatMap((day) => MEAL_NAMES.flatMap((meal) => parseMenuItems(menu[day]?.[meal])));
  return [...new Set(names.filter((name) => !fromIfct(name)).map((name) => name.toLowerCase()))];
}

function totals(foods: PlannedFood[]) {
  return foods.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories * food.quantity,
      proteinG: sum.proteinG + food.proteinG * food.quantity,
    }),
    { calories: 0, proteinG: 0 }
  );
}

function katoris(foods: PlannedFood[]): number {
  return foods.filter((food) => food.unit === "katori").reduce((sum, food) => sum + food.quantity, 0);
}

function score(foods: PlannedFood[], targetCalories: number, targetProtein: number): number {
  if (katoris(foods) > MAX_KATORIS_PER_MEAL) return Infinity;
  const { calories, proteinG } = totals(foods);
  const calorieError = targetCalories > 0 ? Math.abs(calories - targetCalories) / targetCalories : 0;
  const proteinShort = targetProtein > 0 ? Math.max(0, targetProtein - proteinG) / targetProtein : 0;
  const proteinOver = targetProtein > 0 ? Math.max(0, proteinG - targetProtein) / targetProtein : 0;
  // A small cost for moving away from a normal plate keeps portions ordinary.
  const unusual = foods.reduce((sum, food) => sum + Math.abs(food.quantity - food.rule.start) / food.rule.start, 0);
  return calorieError + 1.5 * proteinShort + 0.2 * proteinOver + 0.03 * unusual;
}

/** Adjusts one portion at a time, always within each food's limits. */
function fitPortions(foods: PlannedFood[], targetCalories: number, targetProtein: number): void {
  for (let iteration = 0; iteration < 60; iteration++) {
    let best = score(foods, targetCalories, targetProtein);
    let bestMove: { food: PlannedFood; quantity: number } | null = null;

    for (const food of foods) {
      for (const direction of [-1, 1]) {
        const quantity = food.quantity + direction * food.rule.step;
        if (quantity < food.rule.min || quantity > food.rule.max) continue;
        const previous = food.quantity;
        food.quantity = quantity;
        const candidate = score(foods, targetCalories, targetProtein);
        food.quantity = previous;
        if (candidate < best - 1e-9) {
          best = candidate;
          bestMove = { food, quantity };
        }
      }
    }

    if (!bestMove) return;
    bestMove.food.quantity = bestMove.quantity;
  }
}

interface Addition {
  name: string;
  amount: string;
  calories: number;
  proteinG: number;
  dailyLimit: number;
}

function ifctAddition(name: string, query: string, quantity: number, unit: string, amount: string, dailyLimit = 1): Addition {
  const macros = calculateFoodMacros(query, quantity, unit);
  return { name, amount, calories: macros.calories, proteinG: macros.proteinG, dailyLimit };
}

function additionPool(profile: PlannerProfile): Addition[] {
  const whey = ifctAddition("Whey Protein", "whey", 1, "scoop", "1 scoop", 2);
  const curd = ifctAddition("Plain Curd", "curd", 1, "katori", "1 katori");
  const paneer = ifctAddition("Paneer", "paneer raw", 1, "serving", "100g");
  const whites = ifctAddition("Boiled Egg Whites", "egg white", 4, "piece", "4 whites");
  const eggs = ifctAddition("Boiled Eggs", "egg", 2, "piece", "2 eggs");
  const chicken = ifctAddition("Chicken Breast", "chicken breast", 1, "serving", "100g");
  const chana: Addition = { name: "Roasted Chana", amount: "50g", calories: 180, proteinG: 9, dailyLimit: 1 };
  const soya: Addition = { name: "Soya Chunks", amount: "50g dry", calories: 173, proteinG: 26, dailyLimit: 1 };
  const tofu: Addition = { name: "Tofu", amount: "100g", calories: 76, proteinG: 8, dailyLimit: 1 };

  const byDiet: Record<string, Addition[]> = {
    vegan: [soya, chana, tofu],
    vegetarian: [whey, curd, paneer, chana],
    eggetarian: [whites, whey, eggs, curd, paneer],
  };
  const pool = byDiet[profile.dietPreference ?? ""] ?? [whites, chicken, whey, eggs, curd, paneer];

  const notes = profile.customDietPreferences ?? "";
  const { avoid } = parseCustomRules(notes);
  const wantsNoSupplements = /\bno\s+(supplements?|protein powder)\b/i.test(notes);
  return pool.filter(
    (addition) =>
      !conflictsWithAllergy(addition.name, profile.foodAllergies ?? []) &&
      !avoid.some((term) => matchesRule(addition.name, term)) &&
      !(wantsNoSupplements && addition.name === "Whey Protein")
  );
}

function formatQuantity(quantity: number, unit: string): string {
  return `${quantity} ${unit === "piece" && quantity !== 1 ? "pieces" : unit}`;
}

function describeFood(food: PlannedFood): string {
  const amount = formatQuantity(food.quantity, food.unit);
  if (food.source === "unknown") return `• ${food.name} (nutrition unknown)`;
  const calories = Math.round(food.calories * food.quantity);
  const protein = Math.round(food.proteinG * food.quantity * 10) / 10;
  return food.source === "estimated"
    ? `• ${food.name} (${amount} - ~${protein}g P, ~${calories} kcal, estimated)`
    : `• ${food.name} (${amount} - ${protein}g P, ${calories} kcal)`;
}

const CALORIE_OVERSHOOT_ALLOWED = 75;

/** Trims the least protein-dense portions when the whole day runs over. */
function trimDayToCalories(foods: PlannedFood[], addedCalories: number, targetCalories: number): void {
  for (let iteration = 0; iteration < 40; iteration++) {
    const dayCalories = totals(foods).calories + addedCalories;
    if (dayCalories <= targetCalories + CALORIE_OVERSHOOT_ALLOWED) return;

    const candidates = foods.filter((food) => food.calories >= 30 && food.quantity - food.rule.step >= food.rule.min);
    if (candidates.length === 0) return;

    const leastDense = candidates.reduce((worst, food) =>
      food.proteinG / food.calories < worst.proteinG / worst.calories ? food : worst
    );
    leastDense.quantity -= leastDense.rule.step;
  }
}

interface MealDraft {
  meal: MealName;
  targetCalories: number;
  targetProteinG: number;
  foods: PlannedFood[];
  skipped: string[];
  additions: Addition[];
}

function reasonFor(draft: MealDraft, strict: boolean): string {
  const eaten = draft.foods.filter((food) => food.quantity > 0 && food.source !== "unknown");
  if (eaten.length === 0) return "No food listed on the menu for this meal.";

  const best = eaten.reduce((top, food) => (food.proteinG * food.quantity > top.proteinG * top.quantity ? food : top));
  const parts = [`${best.name} is the best protein source at this meal.`];
  if (draft.additions.length > 0) {
    parts.push(`${draft.additions.map((addition) => addition.name).join(" and ")} added because the mess alone falls short here.`);
  } else if (strict) {
    parts.push("Mess food only, as you chose.");
  }
  return parts.join(" ");
}

function buildDay(
  day: (typeof WEEK_DAYS)[number],
  menu: Record<string, string> | undefined,
  profile: PlannerProfile,
  timings: MessTimings,
  estimates: FoodEstimates,
  variants: Record<string, number>
): DietPlan[string] {
  const dayIndex = WEEK_DAYS.indexOf(day);
  const allergies = profile.foodAllergies ?? [];
  const strict = Boolean(profile.strictMessOnly);
  const allocation = calculateMealMacroAllocation(profile.targetCalories, profile.targetProteinG);
  const rules = parseCustomRules(profile.customDietPreferences);

  const drafts: MealDraft[] = MEAL_NAMES.map((meal, index) => {
    const items = parseMenuItems(menu?.[meal]);
    const allowed = items.filter(
      (name) =>
        fitsDiet(name, profile.dietPreference) &&
        !conflictsWithAllergy(name, allergies) &&
        !rules.avoid.some((term) => matchesRule(name, term))
    );
    return {
      meal,
      targetCalories: allocation[index].targetCalories,
      targetProteinG: allocation[index].targetProteinG,
      foods: allowed.map((name) => toPlannedFood(name, estimates)),
      skipped: items.filter((name) => !allowed.includes(name)),
      additions: [],
    };
  });

  // Later meals pick up what earlier ones couldn't reach.
  let carry = 0;
  for (const draft of drafts) {
    fitPortions(draft.foods, Math.max(0, draft.targetCalories + carry), draft.targetProteinG);
    carry = Math.max(-150, Math.min(200, draft.targetCalories + carry - totals(draft.foods).calories));
  }

  const messProtein = drafts.reduce((sum, draft) => sum + totals(draft.foods).proteinG, 0);

  if (!strict) {
    const used = new Map<string, number>();
    for (let added = 0; added < 3; added++) {
      const dayProtein = drafts.reduce(
        (sum, draft) => sum + totals(draft.foods).proteinG + draft.additions.reduce((a, b) => a + b.proteinG, 0),
        0
      );
      if (profile.targetProteinG - dayProtein < 8) break;

      const shortfall = (draft: MealDraft) =>
        draft.targetProteinG - totals(draft.foods).proteinG - draft.additions.reduce((a, b) => a + b.proteinG, 0);
      const draft = drafts
        .filter((candidate) => candidate.additions.length < 2)
        .sort((a, b) => shortfall(b) - shortfall(a))[0];
      if (!draft) break;

      const pool = additionPool(profile).filter((addition) => (used.get(addition.name) ?? 0) < addition.dailyLimit);
      if (pool.length === 0) break;

      const variant = variants[`${day}:${draft.meal}`] ?? 0;
      const choice = pool[(dayIndex + variant) % pool.length];
      draft.additions.push(choice);
      used.set(choice.name, (used.get(choice.name) ?? 0) + 1);
    }

    // Make room for the additions' calories, usually by trimming rice or rotis.
    let remainder = 0;
    for (const draft of drafts) {
      const addedCalories = draft.additions.reduce((sum, addition) => sum + addition.calories, 0);
      const addedProtein = draft.additions.reduce((sum, addition) => sum + addition.proteinG, 0);
      fitPortions(draft.foods, Math.max(0, draft.targetCalories + remainder - addedCalories), Math.max(0, draft.targetProteinG - addedProtein));
      remainder = Math.max(-150, Math.min(200, draft.targetCalories + remainder - addedCalories - totals(draft.foods).calories));
    }
  }

  applyDailyLimits(drafts.flatMap((draft) => draft.foods), rules.limits);

  trimDayToCalories(
    drafts.flatMap((draft) => draft.foods),
    drafts.reduce((sum, draft) => sum + draft.additions.reduce((a, b) => a + b.calories, 0), 0),
    profile.targetCalories
  );

  const schedule = day === "sunday" ? timings.holiday : timings.regular;

  const meals: DietMeal[] = drafts.map((draft) => {
    const eaten = draft.foods.filter((food) => food.quantity > 0);
    const base = totals(eaten);
    const calories = Math.round(base.calories + draft.additions.reduce((sum, addition) => sum + addition.calories, 0));
    const proteinG = Math.round((base.proteinG + draft.additions.reduce((sum, addition) => sum + addition.proteinG, 0)) * 10) / 10;
    const skippedNote = draft.skipped.length > 0 ? `\n• Skipped for your diet, allergies or rules: ${draft.skipped.join(", ")}` : "";

    return {
      time: `${formatMealTime(schedule[draft.meal].start)} to ${formatMealTime(schedule[draft.meal].end)}`,
      name: MEAL_LABELS[draft.meal],
      messItems: (eaten.length > 0 ? eaten.map(describeFood).join("\n") : "• Not on the menu") + skippedNote,
      additions: draft.additions.length > 0
        ? draft.additions.map((a) => `• ${a.name} (${a.amount} - ${a.proteinG}g P, ${a.calories} kcal)`).join("\n")
        : strict ? "None (Strict Mess Only)" : "None needed",
      proteinG,
      calories,
      timingReason: reasonFor(draft, strict),
      variant: variants[`${day}:${draft.meal}`] ?? 0,
    };
  });

  const totalCalories = meals.reduce((sum, meal) => sum + (meal.calories ?? 0), 0);
  const totalProteinG = Math.round(meals.reduce((sum, meal) => sum + (meal.proteinG ?? 0), 0) * 10) / 10;
  const proteinGap = Math.max(0, Math.round(profile.targetProteinG - totalProteinG));
  const unknown = drafts.flatMap((draft) => draft.foods).filter((food) => food.source === "unknown").map((food) => food.name);

  const notes: string[] = [];
  if (proteinGap >= 10) {
    notes.push(
      strict
        ? `Mess food reaches about ${Math.round(messProtein)}g of protein today, ${proteinGap}g short of your target. That's the realistic limit in strict mess mode.`
        : `Even with additions, today lands ${proteinGap}g short of your protein target. Realistic portions matter more than hitting the number.`
    );
  }
  const calorieGap = totalCalories - profile.targetCalories;
  if (Math.abs(calorieGap) > 150) {
    notes.push(
      calorieGap > 0
        ? `Today runs about ${calorieGap} kcal over your target, even with smaller portions.`
        : `Today lands about ${-calorieGap} kcal under your target, even with fuller portions.`
    );
  }
  if (unknown.length > 0) notes.push(`Nutrition couldn't be found for ${unknown.join(", ")}, so it isn't counted.`);

  return {
    meals,
    dailySummary: {
      totalCalories,
      totalProteinG,
      messProteinG: Math.round(messProtein),
      proteinGap,
      note: notes.join(" "),
    },
  };
}

export function buildWeeklyPlan(options: {
  menu: Record<string, Record<string, string> | undefined>;
  profile: PlannerProfile;
  timings: MessTimings;
  estimates?: FoodEstimates;
  variants?: Record<string, number>;
}): DietPlan {
  const { menu, profile, timings, estimates = {}, variants = {} } = options;
  return Object.fromEntries(WEEK_DAYS.map((day) => [day, buildDay(day, menu[day], profile, timings, estimates, variants)]));
}

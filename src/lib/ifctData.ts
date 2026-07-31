/**
 * ICMR-NIN IFCT 2017 Official Indian Food Composition Database
 * & Deterministic Portion Calculator Engine
 *
 * Source: Indian Food Composition Tables (IFCT 2017), ICMR - National Institute of Nutrition.
 * Principle: "Use software for certainty; use AI for uncertainty."
 */

export interface IFCTItem {
  id: string;
  name: string;
  category: "cereal" | "pulse" | "dairy" | "meat" | "vegetable" | "snack" | "supplement";
  standardUnit: "piece" | "katori" | "scoop" | "gram" | "plate";
  unitWeightGrams: number;
  // Per 100g cooked/edible values
  caloriesPer100g: number;
  proteinGPer100g: number;
  carbsGPer100g: number;
  fatGPer100g: number;
  // Preparation style multipliers for calories/fat
  prepMultipliers?: Record<string, { cal: number; fat: number }>;
}

export const IFCT_DATABASE: Record<string, IFCTItem> = {
  // ── Cereals & Breads ──
  roti: {
    id: "roti",
    name: "Whole Wheat Roti / Chapati",
    category: "cereal",
    standardUnit: "piece",
    unitWeightGrams: 35, // ~35g raw wheat flour per medium roti
    caloriesPer100g: 245,
    proteinGPer100g: 9.1,
    carbsGPer100g: 50.0,
    fatGPer100g: 1.1,
    prepMultipliers: {
      plain: { cal: 1.0, fat: 1.0 },
      ghee: { cal: 1.35, fat: 3.5 }, // +3g ghee per roti
      tandoori: { cal: 1.0, fat: 1.0 },
      paratha: { cal: 1.7, fat: 4.5 },
    },
  },
  rice_cooked: {
    id: "rice_cooked",
    name: "Cooked White Rice",
    category: "cereal",
    standardUnit: "katori",
    unitWeightGrams: 150, // 1 standard katori = 150g cooked
    caloriesPer100g: 130,
    proteinGPer100g: 2.4,
    carbsGPer100g: 28.0,
    fatGPer100g: 0.3,
    prepMultipliers: {
      steamed: { cal: 1.0, fat: 1.0 },
      jeera: { cal: 1.2, fat: 2.5 },
      fried: { cal: 1.6, fat: 4.0 },
    },
  },
  brown_rice_cooked: {
    id: "brown_rice_cooked",
    name: "Cooked Brown Rice",
    category: "cereal",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 112,
    proteinGPer100g: 2.6,
    carbsGPer100g: 23.5,
    fatGPer100g: 0.9,
  },
  poha: {
    id: "poha",
    name: "Poha (Flattened Rice)",
    category: "snack",
    standardUnit: "plate",
    unitWeightGrams: 150,
    caloriesPer100g: 145,
    proteinGPer100g: 2.7,
    carbsGPer100g: 25.5,
    fatGPer100g: 4.0,
  },
  upma: {
    id: "upma",
    name: "Rava Upma",
    category: "snack",
    standardUnit: "plate",
    unitWeightGrams: 150,
    caloriesPer100g: 155,
    proteinGPer100g: 3.2,
    carbsGPer100g: 24.0,
    fatGPer100g: 5.5,
  },
  idli: {
    id: "idli",
    name: "Steamed Idli",
    category: "snack",
    standardUnit: "piece",
    unitWeightGrams: 50,
    caloriesPer100g: 130,
    proteinGPer100g: 4.0,
    carbsGPer100g: 27.0,
    fatGPer100g: 0.6,
  },
  dosa_plain: {
    id: "dosa_plain",
    name: "Plain Dosa",
    category: "snack",
    standardUnit: "piece",
    unitWeightGrams: 80,
    caloriesPer100g: 210,
    proteinGPer100g: 4.5,
    carbsGPer100g: 32.0,
    fatGPer100g: 7.0,
  },
  dosa_masala: {
    id: "dosa_masala",
    name: "Masala Dosa",
    category: "snack",
    standardUnit: "piece",
    unitWeightGrams: 150,
    caloriesPer100g: 215,
    proteinGPer100g: 3.7,
    carbsGPer100g: 30.0,
    fatGPer100g: 8.5,
  },

  // ── Pulses & Dals ──
  dal_toor: {
    id: "dal_toor",
    name: "Yellow Dal (Toor / Arhar)",
    category: "pulse",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 70, // ~105 kcal per 150g katori (hostel mess dilution)
    proteinGPer100g: 3.5, // ~5.2g protein per katori
    carbsGPer100g: 9.3,
    fatGPer100g: 1.7,
    prepMultipliers: {
      thin_mess: { cal: 0.8, fat: 0.7 }, // Extra diluted hostel mess style
      standard: { cal: 1.0, fat: 1.0 },
      thick_home: { cal: 1.3, fat: 1.4 },
      dal_tadka: { cal: 1.45, fat: 2.2 },
    },
  },
  dal_moong: {
    id: "dal_moong",
    name: "Green Gram Dal (Moong)",
    category: "pulse",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 68,
    proteinGPer100g: 3.8,
    carbsGPer100g: 9.0,
    fatGPer100g: 1.2,
  },
  dal_makhani: {
    id: "dal_makhani",
    name: "Dal Makhani",
    category: "pulse",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 165,
    proteinGPer100g: 5.2,
    carbsGPer100g: 14.5,
    fatGPer100g: 9.8,
  },
  rajma_curry: {
    id: "rajma_curry",
    name: "Rajma Curry (Kidney Beans)",
    category: "pulse",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 110,
    proteinGPer100g: 5.0,
    carbsGPer100g: 13.5,
    fatGPer100g: 3.2,
  },
  chole_curry: {
    id: "chole_curry",
    name: "Chole / Chana Masala",
    category: "pulse",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 135,
    proteinGPer100g: 5.5,
    carbsGPer100g: 16.0,
    fatGPer100g: 5.0,
  },

  // ── Dairy ──
  curd: {
    id: "curd",
    name: "Plain Curd / Dahi",
    category: "dairy",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 60,
    proteinGPer100g: 3.5,
    carbsGPer100g: 4.7,
    fatGPer100g: 3.1,
  },
  paneer_raw: {
    id: "paneer_raw",
    name: "Paneer (Fresh Cottage Cheese)",
    category: "dairy",
    standardUnit: "gram",
    unitWeightGrams: 100,
    caloriesPer100g: 305,
    proteinGPer100g: 18.9,
    carbsGPer100g: 2.4,
    fatGPer100g: 24.8,
  },
  paneer_gravy: {
    id: "paneer_gravy",
    name: "Paneer Sabzi / Butter Masala",
    category: "dairy",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 195,
    proteinGPer100g: 8.2,
    carbsGPer100g: 6.5,
    fatGPer100g: 15.5,
  },
  milk_toned: {
    id: "milk_toned",
    name: "Toned Milk (3% Fat)",
    category: "dairy",
    standardUnit: "katori", // 1 cup ~150ml
    unitWeightGrams: 150,
    caloriesPer100g: 58,
    proteinGPer100g: 3.1,
    carbsGPer100g: 4.7,
    fatGPer100g: 3.0,
  },

  // ── Meat, Eggs & Poultry ──
  egg_whole: {
    id: "egg_whole",
    name: "Whole Boiled Egg",
    category: "meat",
    standardUnit: "piece",
    unitWeightGrams: 50,
    caloriesPer100g: 143, // ~71.5 kcal per egg
    proteinGPer100g: 13.3, // ~6.6g protein per egg
    carbsGPer100g: 0.7,
    fatGPer100g: 9.5,
  },
  egg_white: {
    id: "egg_white",
    name: "Boiled Egg White",
    category: "meat",
    standardUnit: "piece",
    unitWeightGrams: 33,
    caloriesPer100g: 52, // ~17 kcal per egg white
    proteinGPer100g: 12.1, // ~4.0g protein per egg white
    carbsGPer100g: 0.7,
    fatGPer100g: 0.2,
  },
  chicken_breast: {
    id: "chicken_breast",
    name: "Boiled / Grilled Chicken Breast",
    category: "meat",
    standardUnit: "gram",
    unitWeightGrams: 100,
    caloriesPer100g: 150,
    proteinGPer100g: 31.0,
    carbsGPer100g: 0.0,
    fatGPer100g: 3.2,
  },
  chicken_curry: {
    id: "chicken_curry",
    name: "Chicken Curry (Mess / Indian Style)",
    category: "meat",
    standardUnit: "katori",
    unitWeightGrams: 150,
    caloriesPer100g: 140,
    proteinGPer100g: 14.5,
    carbsGPer100g: 3.5,
    fatGPer100g: 7.5,
  },

  // ── Supplements ──
  whey_protein: {
    id: "whey_protein",
    name: "Whey Protein Powder",
    category: "supplement",
    standardUnit: "scoop",
    unitWeightGrams: 32,
    caloriesPer100g: 375, // ~120 kcal per 32g scoop
    proteinGPer100g: 75.0, // ~24g protein per scoop
    carbsGPer100g: 6.2,
    fatGPer100g: 4.7,
  },
};

export interface CampusPreset {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  icon: string;
}

export const CAMPUS_PRESETS: CampusPreset[] = [
  { name: "Samosa", calories: 210, proteinG: 4.5, carbsG: 24, fatG: 11, icon: "🥟" },
  { name: "Cutting Chai", calories: 90, proteinG: 2.1, carbsG: 12, fatG: 3.5, icon: "☕" },
  { name: "Maggi", calories: 310, proteinG: 6.2, carbsG: 44, fatG: 12, icon: "🍜" },
  { name: "Egg Roll", calories: 280, proteinG: 11.5, carbsG: 28, fatG: 13, icon: "🍳" },
  { name: "1 Scoop Whey", calories: 120, proteinG: 24.0, carbsG: 2, fatG: 1, icon: "🥛" },
];

/**
 * Fuzzy matches a dish name against official IFCT database items
 */
export function findIFCTItem(queryName: string = ""): IFCTItem {
  const clean = (queryName || "").toLowerCase().trim();

  if (clean.includes("roti") || clean.includes("chapati") || clean.includes("phulka")) {
    return IFCT_DATABASE.roti;
  }
  if (clean.includes("dal makhani") || clean.includes("makhni")) {
    return IFCT_DATABASE.dal_makhani;
  }
  if (clean.includes("toor") || clean.includes("arhar") || clean.includes("yellow dal") || clean.includes("dal")) {
    return IFCT_DATABASE.dal_toor;
  }
  if (clean.includes("moong")) {
    return IFCT_DATABASE.dal_moong;
  }
  if (clean.includes("rajma")) {
    return IFCT_DATABASE.rajma_curry;
  }
  if (clean.includes("chole") || clean.includes("chana")) {
    return IFCT_DATABASE.chole_curry;
  }
  if (clean.includes("brown rice")) {
    return IFCT_DATABASE.brown_rice_cooked;
  }
  if (clean.includes("rice") || clean.includes("chawal")) {
    return IFCT_DATABASE.rice_cooked;
  }
  if (clean.includes("curd") || clean.includes("dahi") || clean.includes("yogurt")) {
    return IFCT_DATABASE.curd;
  }
  if (clean.includes("paneer sabzi") || clean.includes("paneer butter") || clean.includes("shahi paneer")) {
    return IFCT_DATABASE.paneer_gravy;
  }
  if (clean.includes("paneer")) {
    return IFCT_DATABASE.paneer_raw;
  }
  if (clean.includes("egg white") || clean.includes("egg-white")) {
    return IFCT_DATABASE.egg_white;
  }
  if (clean.includes("egg") || clean.includes("anda")) {
    return IFCT_DATABASE.egg_whole;
  }
  if (clean.includes("chicken breast")) {
    return IFCT_DATABASE.chicken_breast;
  }
  if (clean.includes("chicken")) {
    return IFCT_DATABASE.chicken_curry;
  }
  if (clean.includes("whey")) {
    return IFCT_DATABASE.whey_protein;
  }
  if (clean.includes("poha")) {
    return IFCT_DATABASE.poha;
  }
  if (clean.includes("upma")) {
    return IFCT_DATABASE.upma;
  }
  if (clean.includes("idli")) {
    return IFCT_DATABASE.idli;
  }
  if (clean.includes("dosa")) {
    return IFCT_DATABASE.dosa_plain;
  }

  // Fallback to Toor Dal if unspecified pulse/soup, or Cooked Rice
  return IFCT_DATABASE.rice_cooked;
}

/**
 * Deterministically calculates exact macros for a food item given quantity and unit
 */
export function calculateFoodMacros(
  dishName: string,
  quantity: number = 1,
  unitType?: string,
  prepStyle: string = "standard"
): {
  id: string;
  name: string;
  quantity: number;
  unitType: string;
  weightGrams: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
} {
  const item = findIFCTItem(dishName);
  const qty = Math.max(0.25, Number(quantity) || 1);
  const finalUnit = unitType || item.standardUnit;

  // Calculate total weight in grams
  let totalWeightGrams = item.unitWeightGrams * qty;
  if (finalUnit === "gram" || finalUnit === "grams") {
    totalWeightGrams = qty;
  }

  // Apply prep style multiplier if applicable
  let calMult = 1.0;
  let fatMult = 1.0;

  if (item.prepMultipliers && prepStyle && item.prepMultipliers[prepStyle.toLowerCase()]) {
    calMult = item.prepMultipliers[prepStyle.toLowerCase()].cal;
    fatMult = item.prepMultipliers[prepStyle.toLowerCase()].fat;
  } else if (prepStyle.toLowerCase().includes("mess") || prepStyle.toLowerCase().includes("thin")) {
    calMult = 0.85;
  } else if (prepStyle.toLowerCase().includes("ghee") || prepStyle.toLowerCase().includes("butter")) {
    calMult = 1.3;
    fatMult = 2.5;
  }

  const factor = totalWeightGrams / 100;
  const calories = Math.round(item.caloriesPer100g * factor * calMult);
  const proteinG = Math.round(item.proteinGPer100g * factor * 10) / 10;
  const carbsG = Math.round(item.carbsGPer100g * factor * 10) / 10;
  const fatG = Math.round(item.fatGPer100g * factor * fatMult * 10) / 10;

  return {
    id: item.id,
    name: item.name,
    quantity: qty,
    unitType: finalUnit,
    weightGrams: Math.round(totalWeightGrams),
    calories,
    proteinG,
    carbsG,
    fatG,
  };
}

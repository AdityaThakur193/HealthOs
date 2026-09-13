/**
 * Deterministic 3-Tier Ingredient Matcher Engine
 *
 * Source Database: ICMR-NIN IFCT 2017 (src/data/ifct542.json)
 *
 * Tiers:
 * - Tier 1: Curated canonical synonym map (~90 core Indian ingredients, ~210 terms)
 *          specifically bridging alias-less items (poultry, meat, oils, dairy).
 * - Tier 2: Multi-language alias lookup against 5,282 verified regional names in IFCT 2017.
 * - Tier 3: Fuzzy matching (Dice/bigram string similarity >= 0.82) with structural-part
 *          collision guards (leaves vs seeds vs oil vs flour).
 *
 * Principle: "Use software for certainty; use AI for uncertainty."
 */

import ifctDataset from "../data/ifct542.json";
import type { IFCT542Dataset, IFCTNormalizedFood, IFCTSourceNutrients } from "../../scripts/build-ifct-data";

export type MatchTier = "tier1_synonym" | "tier2_multilingual" | "tier3_fuzzy" | "none";

export interface MatchedIngredient {
  id: string;
  name: string;
  category: string;
  tier: MatchTier;
  confidence: number;
  matchedQuery: string;
  matchedAlias: string | null;
  requiresReview: boolean;
  structuralParts: string[];
  nutrientsPer100g: IFCTSourceNutrients;
  originalSourceEnergyZero: boolean;
  rawFood: IFCTNormalizedFood;
  source?: string;
}

export interface SupplementalStandard {
  id: string;
  name: string;
  category: string;
  source: string;
  energyKcal: number;
  energyKj: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  fiberG: number;
  waterG: number;
}

/**
 * Authoritative Supplemental Culinary Standards for universal staples omitted by IFCT 2017.
 * Every entry strictly cites its regulatory / laboratory analytical source.
 */
export const SUPPLEMENTAL_CULINARY_STANDARDS: Record<string, SupplementalStandard> = {
  butter: {
    id: "SUPP_BUTTER",
    name: "Butter, salted",
    category: "Dairy and Egg Products",
    source: "USDA FoodData Central FDC ID 173410",
    energyKcal: 717.0,
    energyKj: 2999.0,
    proteinG: 0.85,
    fatG: 81.11,
    carbG: 0.06,
    fiberG: 0.0,
    waterG: 16.17,
  },
  cream: {
    id: "SUPP_CREAM",
    name: "Fresh Cream / Malai (25% fat)",
    category: "Dairy Products",
    source: "Indian commercial fresh cooking cream standard (25% milk fat, Amul Fresh Cream panel)",
    energyKcal: 246.0,
    energyKj: 1030.0,
    proteinG: 2.7,
    fatG: 25.0,
    carbG: 3.7,
    fiberG: 0.0,
    waterG: 67.8,
  },
  curd: {
    id: "SUPP_CURD",
    name: "Curd / Dahi (whole milk)",
    category: "Dairy Products",
    source: "USDA FoodData Central FDC ID 171284",
    energyKcal: 61.0,
    energyKj: 255.0,
    proteinG: 3.47,
    fatG: 3.25,
    carbG: 4.66,
    fiberG: 0.0,
    waterG: 87.9,
  },
  cheese: {
    id: "SUPP_CHEESE",
    name: "Cheese, cheddar / processed",
    category: "Dairy and Egg Products",
    source: "USDA FoodData Central FDC ID 173414",
    energyKcal: 403.0,
    energyKj: 1686.0,
    proteinG: 24.9,
    fatG: 33.14,
    carbG: 1.33,
    fiberG: 0.0,
    waterG: 36.75,
  },
};

export const SUPPLEMENTAL_ALIASES: Record<string, string> = {
  butter: "butter",
  "table butter": "butter",
  "salted butter": "butter",
  "unsalted butter": "butter",
  makhan: "butter",
  makkhan: "butter",
  cream: "cream",
  "fresh cream": "cream",
  "cooking cream": "cream",
  malai: "cream",
  "heavy cream": "cream",
  curd: "curd",
  dahi: "curd",
  yogurt: "curd",
  yoghurt: "curd",
  cheese: "cheese",
  "cheddar cheese": "cheese",
  "processed cheese": "cheese",
  mozzarella: "cheese",
};

const typedDataset = ifctDataset as unknown as IFCT542Dataset;
const FOOD_MAP = new Map<string, IFCTNormalizedFood>();
typedDataset.foods.forEach((f) => FOOD_MAP.set(f.id, f));

/**
 * 1. Curated Tier 1 Canonical Synonym Map
 * Maps everyday Indian home cooking terms directly to valid IFCT 2017 IDs.
 * Note: "kabuli chana" is deliberately omitted (unmatched gap in IFCT 2017).
 * Note: generic bare "fish" is deliberately omitted (requires species specificity).
 */
export const TIER1_SEED_MAP: Record<string, string> = {
  // ── Poultry & Meats (Group N & O) ──
  "chicken": "N003",
  "chicken breast": "N003",
  "chicken thigh": "N002",
  "chicken leg": "N001",
  "chicken curry cut": "N001",
  "chicken wings": "N004",
  "mutton": "O001",
  "goat meat": "O001",
  "mutton chops": "O002",
  "mutton leg": "O003",
  "kaleji": "O008",
  "mutton liver": "O008",
  "lamb": "O014",
  "pork": "O048",
  "beef": "O025",

  // ── Eggs (Group M) ──
  "egg": "M001",
  "whole egg": "M001",
  "boiled egg": "M004",
  "egg white": "M005",
  "egg white raw": "M002",
  "egg yolk": "M006",
  "omelette": "M007",
  "omlet": "M007",

  // ── Dairy (Group L) ──
  "paneer": "L003",
  "cottage cheese": "L003",
  "milk": "L002",
  "cow milk": "L002",
  "buffalo milk": "L001",
  "khoa": "L004",
  "mawa": "L004",

  // ── Edible Oils & Fats (Group T) ──
  "mustard oil": "T006",
  "sarson tel": "T006",
  "sarson ka tel": "T006",
  "ghee": "T013",
  "desi ghee": "T013",
  "sunflower oil": "T012",
  "coconut oil": "T001",
  "nariyal tel": "T001",
  "groundnut oil": "T005",
  "peanut oil": "T005",
  "moongfali tel": "T005",
  "sesame oil": "T004",
  "til tel": "T004",
  "gingelly oil": "T004",
  "soybean oil": "T011",
  "soyabean oil": "T011",
  "rice bran oil": "T008",
  "vanaspati": "T014",
  "dalda": "T014",

  // ── Grains, Flours & Millets (Group A & F) ──
  "atta": "A019",
  "gehu ka atta": "A019",
  "wheat flour": "A019",
  "whole wheat flour": "A019",
  "maida": "A018",
  "all purpose flour": "A018",
  "refined flour": "A018",
  "sooji": "A022",
  "suji": "A022",
  "rava": "A022",
  "semolina": "A022",
  "rice": "A015",
  "white rice": "A015",
  "chawal": "A015",
  "basmati rice": "A015",
  "brown rice": "A013",
  "parboiled rice": "A014",
  "sela rice": "A014",
  "poha": "A011",
  "chuda": "A011",
  "flattened rice": "A011",
  "murmura": "A012",
  "puffed rice": "A012",
  "bajra": "A003",
  "pearl millet": "A003",
  "jowar": "A005",
  "sorghum": "A005",
  "ragi": "A010",
  "finger millet": "A010",
  "makka": "A007",
  "corn": "A007",
  "makki": "A007",
  "bhutta": "A007",
  "sabudana": "F015",
  "sago": "F015",

  // ── Dals & Legumes (Group B) ──
  "toor dal": "B021",
  "tuvar dal": "B021",
  "arhar dal": "B021",
  "red gram": "B021",
  "moong dal": "B010",
  "green gram dal": "B010",
  "dhuli moong": "B010",
  "sabut moong": "B011",
  "whole green gram": "B011",
  "chana dal": "B001",
  "bengal gram dal": "B001",
  "besan": "B001",
  "gram flour": "B001",
  "kala chana": "B002",
  "black chana": "B002",
  "urad dal": "B003",
  "black gram dal": "B003",
  "dhuli urad": "B003",
  "sabut urad": "B004",
  "whole urad": "B004",
  "masoor dal": "B013",
  "red lentil": "B013",
  "rajma": "B020",
  "kidney beans": "B020",
  "lobia": "B005",
  "cowpea": "B005",
  "soya bean": "B025",
  "soyabean": "B025",

  // ── Core Aromatics & Vegetables (Group D, F, C, G) ──
  "onion": "G017",
  "pyaz": "G017",
  "pyaaz": "G017",
  "kanda": "G017",
  "tomato": "D075",
  "tamatar": "D075",
  "tamator": "D075",
  "potato": "F006",
  "aloo": "F006",
  "alu": "F006",
  "ginger": "G014",
  "adrak": "G014",
  "garlic": "G011",
  "lehsun": "G011",
  "green chilli": "G008",
  "green chili": "G008",
  "hari mirch": "G008",
  "red chilli": "G022",
  "red chili": "G022",
  "lal mirch": "G022",
  "spinach": "C033",
  "palak": "C033",
  "bhindi": "D056",
  "okra": "D056",
  "lady finger": "D056",
  "ladies finger": "D056",
  "gobi": "D036",
  "phool gobi": "D036",
  "cauliflower": "D036",
  "patta gobi": "C015",
  "bandh gobi": "C015",
  "cabbage": "C015",
  "baingan": "D011",
  "eggplant": "D011",
  "brinjal": "D011",
  "shimla mirch": "D033",
  "capsicum": "D033",
  "bell pepper": "D033",
  "lauki": "D009",
  "ghiya": "D009",
  "bottle gourd": "D009",
  "turai": "D068",
  "tori": "D068",
  "ridge gourd": "D068",
  "karela": "D004",
  "bitter gourd": "D004",
  "gajar": "F002",
  "carrot": "F002",
  "chukandar": "F001",
  "beetroot": "F001",
  "beet": "F001",
  "kheera": "D043",
  "cucumber": "D043",
  "matar": "D061",
  "green peas": "D061",
  "fresh peas": "D061",

  // ── Spices & Condiments (Group G & I & E) ──
  "haldi": "G033",
  "turmeric": "G033",
  "turmeric powder": "G033",
  "jeera": "G025",
  "zeera": "G025",
  "cumin": "G025",
  "cumin seeds": "G025",
  "coriander leaves": "G009",
  "dhaniya patta": "G009",
  "dhania patta": "G009",
  "cilantro": "G009",
  "fresh coriander": "G009",
  "coriander seeds": "G024",
  "dhaniya powder": "G024",
  "dhania powder": "G024",
  "dhaniya seeds": "G024",
  "dhania seeds": "G024",
  "methi leaves": "C020",
  "methi patta": "C020",
  "kasuri methi": "C020",
  "fenugreek leaves": "C020",
  "methi seeds": "G026",
  "methi dana": "G026",
  "fenugreek seeds": "G026",
  "mustard seeds": "H013",
  "sarson seeds": "H013",
  "rai": "H013",
  "kadi patta": "G010",
  "curry leaves": "G010",
  "pudina": "G016",
  "mint leaves": "G016",
  "elaichi": "G020",
  "cardamom": "G020",
  "laung": "G023",
  "clove": "G023",
  "cloves": "G023",
  "kali mirch": "G031",
  "black pepper": "G031",
  "hing": "G019",
  "asafoetida": "G019",
  "ajwain": "G029",
  "omum": "G029",
  "jaiphal": "G028",
  "nutmeg": "G028",
  "javitri": "G027",
  "mace": "G027",
  "imli": "E064",
  "tamarind": "E064",
  "jaggery": "I001",
  "gud": "I001",
  "gur": "I001",

  // ── Specific Indian Fish & Shellfish (Group P, Q, S) ──
  "rohu": "S006",
  "catla": "S002",
  "katla": "S002",
  "surmai": "P087",
  "kingfish": "P087",
  "vanjaram": "P087",
  "pomfret": "P057",
  "white pomfret": "P057",
  "bangda": "P034",
  "mackerel": "P034",
  "hilsa": "P017",
  "ilish": "P017",
  "crab": "Q001",
  "kekda": "Q001",
  "prawns": "Q007",
  "prawn": "Q007",
  "shrimp": "Q007",
  "jhinga": "Q007",

  // ── Nuts & Oilseeds (Group H) ──
  "cashew": "H005",
  "cashew nut": "H005",
  "cashews": "H005",
  "kaju": "H005",
  "kaju paste": "H005",
};

/**
 * 2. Tier 2 Multilingual Alias Map
 * Maps lowercase alias strings from ifct542.json -> { foodId, aliasName }
 * Note: "kabuli chana" is explicitly excluded because IFCT 2017 has no real white chickpea entry,
 * only brown/desi Bengal gram (B002) which was labeled with a regional Nepali alias.
 */
const EXCLUDED_TIER2_ALIASES = new Set(["kabuli chana", "white chickpea"]);
const TIER2_ALIAS_MAP = new Map<string, { foodId: string; aliasName: string }>();

typedDataset.foods.forEach((food) => {
  food.aliases.forEach((alias) => {
    const norm = normalizeTerm(alias.name);
    if (norm && !EXCLUDED_TIER2_ALIASES.has(norm) && !TIER2_ALIAS_MAP.has(norm)) {
      TIER2_ALIAS_MAP.set(norm, { foodId: food.id, aliasName: alias.name });
    }
  });
});

/**
 * Normalizes query string for uniform matching
 */
export function normalizeTerm(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[,\-_.;:()/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Levenshtein distance between two strings
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Jaro-Winkler similarity between two strings (0.0 to 1.0)
 * Optimal for typo detection in food words.
 */
export function jaroWinklerSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const len1 = str1.length;
  const len2 = str2.length;
  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;

  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (!s2Matches[j] && str1[i] === str2[j]) {
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (s1Matches[i]) {
      while (!s2Matches[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Normalized single word similarity combining Levenshtein and Jaro-Winkler (0.0 to 1.0).
 * Jaro-Winkler is only activated for genuine typos (edit distance <= 2) to prevent false matches
 * between totally different words that happen to share a 4-letter prefix (e.g. "crabapple" vs "crabeater").
 */
export function wordSimilarity(w1: string, w2: string): number {
  if (w1 === w2) return 1.0;
  const maxLen = Math.max(w1.length, w2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(w1, w2);
  const levSim = 1.0 - dist / maxLen;

  if (dist <= 2) {
    const jwSim = jaroWinklerSimilarity(w1, w2);
    return Math.max(levSim, jwSim);
  }
  return levSim;
}

/**
 * Computes token-aware fuzzy similarity (0.0 to 1.0)
 */
export function computeFuzzySimilarity(query: string, target: string): number {
  const q = normalizeTerm(query);
  const t = normalizeTerm(target);

  if (q === t) return 1.0;
  if (!q || !t) return 0.0;

  const fullSim = wordSimilarity(q, t);

  const qTokens = q.split(/\s+/).filter(Boolean);
  const tTokens = t.split(/\s+/).filter(Boolean);

  if (qTokens.length === 1) {
    let maxTokenSim = 0;
    for (const token of tTokens) {
      const s = wordSimilarity(qTokens[0], token);
      if (s > maxTokenSim) maxTokenSim = s;
    }
    return Math.round(Math.max(fullSim, maxTokenSim) * 100) / 100;
  }

  let sum = 0;
  for (const qTok of qTokens) {
    let maxS = 0;
    for (const tTok of tTokens) {
      const s = wordSimilarity(qTok, tTok);
      if (s > maxS) maxS = s;
    }
    sum += maxS;
  }
  const avgSim = sum / qTokens.length;
  return Math.round(Math.max(fullSim, avgSim) * 100) / 100;
}

/**
 * Extracts query structural indicators to prevent cross-matching
 * leaves vs seeds vs oil vs flour vs root.
 */
function extractQueryStructuralParts(query: string): string[] {
  const parts: string[] = [];
  const q = normalizeTerm(query);

  if (/\b(leaves|leaf|greens|saag|sag|patta|pata|palak)\b/.test(q)) {
    parts.push("leaves");
  }
  if (/\b(seeds|seed|dana|beej|biya|grain)\b/.test(q)) {
    parts.push("seeds");
  }
  if (/\b(oil|tel|ghee|fat|vanaspati)\b/.test(q)) {
    parts.push("oil");
  }
  if (/\b(flour|atta|maida|sooji|suji|powder|besan)\b/.test(q)) {
    parts.push("flour");
  }
  if (/\b(root|potato|aloo|onion|pyaz|garlic|ginger|carrot)\b/.test(q)) {
    parts.push("root");
  }
  return parts;
}

/**
 * Validates whether candidate food structural parts clash with the query.
 * For example: if user query explicitly has "leaves", candidate cannot be "seeds" or "oil".
 */
export function hasStructuralConflict(queryParts: string[], foodParts: string[]): boolean {
  if (queryParts.length === 0 || foodParts.length === 0) return false;

  const mutuallyExclusivePairs: Array<[string, string]> = [
    ["leaves", "seeds"],
    ["leaves", "oil"],
    ["leaves", "flour"],
    ["seeds", "oil"],
    ["seeds", "leaves"],
    ["oil", "seeds"],
    ["oil", "leaves"],
    ["oil", "flour"],
    ["meat", "leaves"],
    ["meat", "seeds"],
    ["meat", "oil"],
  ];

  for (const qp of queryParts) {
    for (const fp of foodParts) {
      for (const [p1, p2] of mutuallyExclusivePairs) {
        if (qp === p1 && fp === p2) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Calculates Atwater energy (kcal and kJ) for Group T lipids where IFCT source enerc === 0.
 * In IFCT 2017 Group T, crude fat is 0 in proximate assays because pure oils/fats are 100% lipid.
 * Atwater factor: 100g pure fat * 9.0 kcal/g = 900.0 kcal/100g (3765.6 kJ/100g).
 */
export function resolveNutrientsWithAtwater(food: IFCTNormalizedFood): IFCTSourceNutrients {
  const n = { ...food.nutrientsPer100g };

  if (food.sourceEnergyZero) {
    if (food.groupLetter === "T" || food.category.toLowerCase().includes("oils and fats")) {
      // 100g edible oil / fat = 900 kcal, 100g fat
      n.energyKcal = 900.0;
      n.energyKj = 3765.6;
      n.fatG = 100.0;
      n.proteinG = 0.0;
      n.carbG = 0.0;
    } else {
      // General Atwater fallback for any other zero-energy item with non-zero macros
      const computedKcal = (n.proteinG * 4.0) + (n.carbG * 4.0) + (n.fatG * 9.0);
      n.energyKcal = Math.round(computedKcal * 10) / 10;
      n.energyKj = Math.round(computedKcal * 4.184 * 10) / 10;
    }
  }

  return n;
}

/**
 * Main 3-Tier Matcher Function
 * Given an ingredient string, deterministically returns the matched IFCT food or null.
 */
export function matchIngredient(query: string): MatchedIngredient | null {
  const norm = normalizeTerm(query);
  if (!norm) return null;

  // Known IFCT 2017 gaps that must explicitly remain unmatched rather than
  // falsely substituting a different food (e.g. kabuli chana / white chickpea, cinnamon / dalchini).
  const EXPLICIT_UNMATCHED_GAPS = new Set([
    "kabuli chana",
    "white chickpea",
    "garbanzo",
    "cinnamon",
    "dalchini",
  ]);
  if (EXPLICIT_UNMATCHED_GAPS.has(norm)) {
    return null;
  }

  // ── Supplemental Authoritative Culinary Standards (Universal commodities missing from IFCT) ──
  const suppKey = SUPPLEMENTAL_ALIASES[norm];
  if (suppKey && SUPPLEMENTAL_CULINARY_STANDARDS[suppKey]) {
    const s = SUPPLEMENTAL_CULINARY_STANDARDS[suppKey];
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      tier: "tier1_synonym",
      confidence: 1.0,
      matchedQuery: query,
      matchedAlias: norm,
      requiresReview: false,
      structuralParts: [],
      source: s.source,
      nutrientsPer100g: {
        energyKcal: s.energyKcal,
        energyKj: s.energyKj,
        proteinG: s.proteinG,
        fatG: s.fatG,
        carbG: s.carbG,
        fiberG: s.fiberG,
        waterG: s.waterG,
        ashG: 0,
      },
      originalSourceEnergyZero: false,
      rawFood: {
        id: s.id,
        code: s.id,
        name: s.name,
        scientificName: "",
        groupLetter: "L",
        category: s.category,
        sourceEnergyZero: false,
        tags: [],
        nutrientsPer100g: {
          energyKcal: s.energyKcal,
          energyKj: s.energyKj,
          proteinG: s.proteinG,
          fatG: s.fatG,
          carbG: s.carbG,
          fiberG: s.fiberG,
          waterG: s.waterG,
          ashG: 0,
        },
        aliases: [],
        structuralParts: [],
      },
    };
  }

  // ── Tier 1: Curated Canonical Synonym Map ──
  const tier1Id = TIER1_SEED_MAP[norm];
  if (tier1Id) {
    const food = FOOD_MAP.get(tier1Id);
    if (food) {
      return {
        id: food.id,
        name: food.name,
        category: food.category,
        tier: "tier1_synonym",
        confidence: 1.0,
        matchedQuery: query,
        matchedAlias: norm,
        requiresReview: false,
        structuralParts: food.structuralParts,
        source: "ICMR-NIN IFCT 2017",
        nutrientsPer100g: resolveNutrientsWithAtwater(food),
        originalSourceEnergyZero: food.sourceEnergyZero,
        rawFood: food,
      };
    }
  }

  // ── Tier 2: Multi-Language Alias Lookup ──
  const tier2Match = TIER2_ALIAS_MAP.get(norm);
  if (tier2Match) {
    const food = FOOD_MAP.get(tier2Match.foodId);
    if (food) {
      return {
        id: food.id,
        name: food.name,
        category: food.category,
        tier: "tier2_multilingual",
        confidence: 0.95,
        matchedQuery: query,
        matchedAlias: tier2Match.aliasName,
        requiresReview: false,
        structuralParts: food.structuralParts,
        source: "ICMR-NIN IFCT 2017",
        nutrientsPer100g: resolveNutrientsWithAtwater(food),
        originalSourceEnergyZero: food.sourceEnergyZero,
        rawFood: food,
      };
    }
  }

  // ── Tier 3: Fuzzy Matching with Structural Collision Guard ──
  // Generic single-word category names or composite dish descriptors (e.g. "fish", "meat", "curry", "gravy")
  // must NOT fuzzy-match specific species or items like "Ari fish", "Curry leaves", or "Mustard oil".
  const GENERIC_CATEGORY_TERMS = new Set([
    "fish", "meat", "seafood", "dal", "oil", "vegetable", "fruit", "flour", "grain",
    "curry", "gravy", "sabzi", "sabji", "masala", "tadka", "soup", "broth", "sauce",
  ]);
  if (GENERIC_CATEGORY_TERMS.has(norm)) {
    return null;
  }

  const FUZZY_THRESHOLD = 0.82;
  const queryParts = extractQueryStructuralParts(norm);

  let bestFood: IFCTNormalizedFood | null = null;
  let bestScore = 0;
  let bestAlias: string | null = null;

  for (const food of typedDataset.foods) {
    // Structural part collision guard check
    if (hasStructuralConflict(queryParts, food.structuralParts)) {
      continue;
    }

    // 1. Compare against canonical food name
    const nameScore = computeFuzzySimilarity(norm, food.name);
    // If query has no "leaves" indicator, penalize leafy variant tie
    const adjustedNameScore = (!queryParts.includes("leaves") && food.structuralParts.includes("leaves"))
      ? nameScore - 0.05
      : nameScore;

    if (adjustedNameScore > bestScore) {
      bestScore = adjustedNameScore;
      bestFood = food;
      bestAlias = food.name;
    }

    // 2. Compare against aliases (skip excluded aliases)
    for (const alias of food.aliases) {
      const aNorm = normalizeTerm(alias.name);
      if (EXCLUDED_TIER2_ALIASES.has(aNorm)) continue;

      const aliasScore = computeFuzzySimilarity(norm, alias.name);
      const adjustedAliasScore = (!queryParts.includes("leaves") && food.structuralParts.includes("leaves"))
        ? aliasScore - 0.05
        : aliasScore;

      if (adjustedAliasScore > bestScore) {
        bestScore = adjustedAliasScore;
        bestFood = food;
        bestAlias = alias.name;
      }
    }
  }

  if (bestFood && bestScore >= FUZZY_THRESHOLD) {
    return {
      id: bestFood.id,
      name: bestFood.name,
      category: bestFood.category,
      tier: "tier3_fuzzy",
      confidence: Math.round(bestScore * 100) / 100,
      matchedQuery: query,
      matchedAlias: bestAlias,
      requiresReview: true, // Tier 3 always flagged for UI review
      structuralParts: bestFood.structuralParts,
      source: "ICMR-NIN IFCT 2017",
      nutrientsPer100g: resolveNutrientsWithAtwater(bestFood),
      originalSourceEnergyZero: bestFood.sourceEnergyZero,
      rawFood: bestFood,
    };
  }

  // No confident match found
  return null;
}

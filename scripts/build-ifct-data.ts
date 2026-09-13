import fs from "fs";
import path from "path";
import https from "https";

/**
 * IFCT 2017 Dataset Extraction & Normalization Pipeline
 *
 * Source: ICMR-NIN Indian Food Composition Tables (IFCT 2017)
 * Package: @ifct2017/compositions@1.0.12 (via unpkg)
 * Output: src/data/ifct542.json
 *
 * Requirements:
 * - Deterministic, reproducible extraction
 * - Preserves original IFCT identifiers and food names
 * - Preserves category, tags, and scientific names
 * - Extracts and normalizes multilingual regional aliases from the 'lang' field
 * - Extracts structural parts (leaves, seeds, oil, flour, root, etc.) for match guarding
 * - Preserves exact source nutrient values (kJ energy, protein, carb, fat, fiber, water)
 * - Converts source kJ to kcal (1 kcal = 4.184 kJ) deterministically while preserving raw kJ
 * - Flags zero/missing energy without silently fabricating values
 */

export interface IFCTSourceNutrients {
  energyKj: number;
  energyKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number;
  waterG: number;
  ashG: number;
}

export interface IFCTAlias {
  lang: string;
  name: string;
}

export interface IFCTNormalizedFood {
  id: string; // e.g. "A001", "G009", "T006"
  code: string; // original IFCT code
  name: string; // Canonical English name
  scientificName: string; // Botanical/zoological name
  category: string; // IFCT Food Group e.g. "Cereals and Millets"
  groupLetter: string; // "A" - "U"
  tags: string[]; // e.g. ["vegetarian", "veg"]
  structuralParts: string[]; // ["leaves", "seeds", "oil", "flour", etc.]
  nutrientsPer100g: IFCTSourceNutrients;
  aliases: IFCTAlias[];
  sourceEnergyZero: boolean; // True if IFCT source enerc === 0 (e.g. Group T oils/fats)
}

export interface IFCT542Dataset {
  metadata: {
    source: string;
    version: string;
    extractedAt: string;
    itemCount: number;
    aliasCount: number;
    zeroEnergyCount: number;
    energyUnit: string;
    macroUnit: string;
  };
  foods: IFCTNormalizedFood[];
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "HealthApp-IFCT-Builder/1.0" } }, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url} - Status ${res.statusCode}`));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === "," && !inQuotes) {
      current.push(field);
      field = "";
    } else if ((c === "\r" || c === "\n") && !inQuotes) {
      if (c === "\r" && text[i + 1] === "\n") {
        i++;
      }
      current.push(field);
      field = "";
      if (current.length > 1 || (current.length === 1 && current[0] !== "")) {
        lines.push(current);
      }
      current = [];
    } else {
      field += c;
    }
  }
  if (current.length > 0 || field !== "") {
    current.push(field);
    lines.push(current);
  }
  return lines;
}

/**
 * Standardize language abbreviation codes used in IFCT 2017
 */
const LANG_MAP: Record<string, string> = {
  A: "Assamese",
  B: "Bengali",
  E: "English",
  G: "Gujarati",
  H: "Hindi",
  Kan: "Kannada",
  Kash: "Kashmiri",
  Kh: "Khasi",
  M: "Manipuri",
  Mal: "Malayalam",
  Mar: "Marathi",
  N: "Nepali",
  O: "Odia",
  P: "Punjabi",
  S: "Sanskrit",
  Tam: "Tamil",
  Tel: "Telugu",
  U: "Urdu",
};

/**
 * Parses the raw IFCT 'lang' field into structured { lang, name } entries.
 * Format examples:
 * - "A. Moricha guti; H. Ramdana; Kan. Danthu beeja"
 * - "A., Kash. Baajra; B. Bajra; Tam. Kambu"
 */
export function parseIFCTLanguageAliases(langStr: string): IFCTAlias[] {
  if (!langStr || !langStr.trim()) return [];
  const aliases: IFCTAlias[] = [];
  const segments = langStr.split(";").map((s) => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const match = seg.match(/^([A-Za-z.,\s]+?)\.\s+(.+)$/);
    if (match) {
      const rawPrefixes = match[1].split(/[,.]/).map((p) => p.trim()).filter(Boolean);
      let aliasName = match[2].trim();
      // Remove trailing period if present
      if (aliasName.endsWith(".")) {
        aliasName = aliasName.slice(0, -1).trim();
      }
      if (!aliasName) continue;

      for (const prefix of rawPrefixes) {
        const langName = LANG_MAP[prefix] || prefix;
        aliases.push({ lang: langName, name: aliasName });
      }
    } else {
      let clean = seg.trim();
      if (clean.endsWith(".")) clean = clean.slice(0, -1).trim();
      if (clean) {
        aliases.push({ lang: "Other", name: clean });
      }
    }
  }

  // Deduplicate aliases per item
  const seen = new Set<string>();
  const deduped: IFCTAlias[] = [];
  for (const a of aliases) {
    const key = `${a.lang.toLowerCase()}:${a.name.toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(a);
    }
  }
  return deduped;
}

/**
 * Extracts structural part tokens from food name and category
 * to prevent cross-matching leaves vs seeds vs oil vs flour.
 */
export function extractStructuralParts(name: string, category: string): string[] {
  const parts: string[] = [];
  const n = name.toLowerCase();
  const c = category.toLowerCase();

  // Leaves & greens
  if (/\b(leaves|leaf|greens|saag|patta|palak)\b/.test(n) || c.includes("leafy vegetables")) {
    parts.push("leaves");
  }
  // Seeds & grains
  if (/\b(seeds|seed|grain|dana|jeera|sarson)\b/.test(n)) {
    parts.push("seeds");
  }
  // Pure edible oils & fats
  if (/\b(oil|oils|ghee|fat|vanaspati|butter)\b/.test(n) || c.includes("edible oils and fats")) {
    parts.push("oil");
  }
  // Flour & powders
  if (/\b(flour|atta|maida|sooji|semolina|powder|besan|starch)\b/.test(n)) {
    parts.push("flour");
  }
  // Roots & tubers
  if (/\b(root|tubers|tuber|potato|onion|garlic|carrot|radish|ginger|beetroot)\b/.test(n) || c.includes("roots and tubers")) {
    parts.push("root");
  }
  // Fruits
  if (/\b(fruit|fruits|apple|banana|mango|melon|orange|berry)\b/.test(n) || c.includes("fruits")) {
    parts.push("fruit");
  }
  // Meat & poultry
  if (/\b(meat|flesh|breast|thigh|leg|chops|liver|heart|shoulder|brain|tripe)\b/.test(n) || c.includes("meat") || c.includes("poultry")) {
    parts.push("meat");
  }
  // Eggs
  if (/\b(egg|egg white|egg yolk)\b/.test(n) || c.includes("egg")) {
    parts.push("egg");
  }
  // Dairy
  if (/\b(milk|curd|paneer|cheese|whey|dahi)\b/.test(n) || c.includes("milk and milk products")) {
    parts.push("dairy");
  }

  return Array.from(new Set(parts));
}

export async function buildIFCTDataset(): Promise<IFCT542Dataset> {
  const SOURCE_URL = "https://unpkg.com/@ifct2017/compositions@1.0.12/index.csv";
  console.log(`Fetching IFCT 2017 dataset from: ${SOURCE_URL}`);
  const csvText = await fetchUrl(SOURCE_URL);

  const rows = parseCSV(csvText);
  if (rows.length < 500) {
    throw new Error(`Unexpectedly small row count from IFCT CSV: ${rows.length}`);
  }

  const header = rows[0];
  const colMap = new Map<string, number>();
  header.forEach((h, idx) => colMap.set(h, idx));

  // Required columns
  const required = ["code", "name", "scie", "lang", "grup", "tags", "enerc", "protcnt", "choavldf", "fatce", "fibtg", "water", "ash"];
  for (const col of required) {
    if (!colMap.has(col)) {
      throw new Error(`Missing required column in IFCT CSV: ${col}`);
    }
  }

  const foodRows = rows.slice(1).filter((r) => r.length > 5 && r[0].trim() !== "");
  console.log(`Discovered ${foodRows.length} food rows in source CSV.`);

  const foods: IFCTNormalizedFood[] = [];
  let zeroEnergyCount = 0;
  let totalAliasesCount = 0;

  for (const r of foodRows) {
    const code = r[colMap.get("code")!].trim();
    const name = r[colMap.get("name")!].trim();
    const scie = (r[colMap.get("scie")!] || "").trim();
    const langRaw = r[colMap.get("lang")!] || "";
    const group = (r[colMap.get("grup")!] || "").trim();
    const tagsRaw = (r[colMap.get("tags")!] || "").trim();

    // Nutrients (all numeric, verified)
    const energyKj = parseFloat(r[colMap.get("enerc")!] || "0") || 0;
    // Standard conversion: 1 kcal = 4.184 kJ
    const energyKcal = Math.round((energyKj / 4.184) * 10) / 10;
    const proteinG = Math.round((parseFloat(r[colMap.get("protcnt")!] || "0") || 0) * 100) / 100;
    const carbG = Math.round((parseFloat(r[colMap.get("choavldf")!] || "0") || 0) * 100) / 100;
    const fatG = Math.round((parseFloat(r[colMap.get("fatce")!] || "0") || 0) * 100) / 100;
    const fiberG = Math.round((parseFloat(r[colMap.get("fibtg")!] || "0") || 0) * 100) / 100;
    const waterG = Math.round((parseFloat(r[colMap.get("water")!] || "0") || 0) * 100) / 100;
    const ashG = Math.round((parseFloat(r[colMap.get("ash")!] || "0") || 0) * 100) / 100;

    const sourceEnergyZero = energyKj === 0;
    if (sourceEnergyZero) {
      zeroEnergyCount++;
    }

    const aliases = parseIFCTLanguageAliases(langRaw);
    totalAliasesCount += aliases.length;

    const structuralParts = extractStructuralParts(name, group);
    const tags = tagsRaw ? tagsRaw.split(/\s+/).filter(Boolean) : [];
    const groupLetter = code.charAt(0).toUpperCase();

    foods.push({
      id: code,
      code,
      name,
      scientificName: scie,
      category: group,
      groupLetter,
      tags,
      structuralParts,
      nutrientsPer100g: {
        energyKj,
        energyKcal,
        proteinG,
        carbG,
        fatG,
        fiberG,
        waterG,
        ashG,
      },
      aliases,
      sourceEnergyZero,
    });
  }

  // Sort deterministically by code
  foods.sort((a, b) => a.code.localeCompare(b.code));

  const dataset: IFCT542Dataset = {
    metadata: {
      source: "ICMR-NIN Indian Food Composition Tables (IFCT 2017)",
      version: "@ifct2017/compositions@1.0.12",
      extractedAt: new Date().toISOString(),
      itemCount: foods.length,
      aliasCount: totalAliasesCount,
      zeroEnergyCount,
      energyUnit: "kJ (source) and kcal (1 kcal = 4.184 kJ)",
      macroUnit: "g per 100g edible portion",
    },
    foods,
  };

  return dataset;
}

async function main() {
  const dataset = await buildIFCTDataset();
  const outDir = path.join(process.cwd(), "src", "data");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outFile = path.join(outDir, "ifct542.json");
  const jsonContent = JSON.stringify(dataset, null, 2);
  fs.writeFileSync(outFile, jsonContent, "utf8");

  const stat = fs.statSync(outFile);
  console.log(`\nSuccessfully generated ${outFile}`);
  console.log(`File size: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`Total items: ${dataset.metadata.itemCount}`);
  console.log(`Total aliases: ${dataset.metadata.aliasCount}`);
  console.log(`Zero-energy records: ${dataset.metadata.zeroEnergyCount}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Error building IFCT dataset:", err);
    process.exit(1);
  });
}

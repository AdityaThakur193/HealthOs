import { describe, it, expect } from "vitest";
import ifctDataset from "../data/ifct542.json";
import type { IFCT542Dataset, IFCTNormalizedFood } from "../../scripts/build-ifct-data";

const typedDataset = ifctDataset as unknown as IFCT542Dataset;

describe("IFCT 2017 Dataset Integrity Suite (ifct542.json)", () => {
  // 1. Dataset exists and loads successfully
  it("should load the dataset successfully with valid metadata", () => {
    expect(typedDataset).toBeDefined();
    expect(typedDataset.metadata).toBeDefined();
    expect(typedDataset.metadata.source).toContain("IFCT 2017");
    expect(typedDataset.metadata.version).toBe("@ifct2017/compositions@1.0.12");
    expect(typedDataset.foods).toBeInstanceOf(Array);
  });

  // 2. Expected approximate item count is present (between 520 and 560, actual 542)
  it("should contain the expected item count within the 520-560 range", () => {
    const count = typedDataset.foods.length;
    expect(count).toBeGreaterThanOrEqual(520);
    expect(count).toBeLessThanOrEqual(560);
    expect(typedDataset.metadata.itemCount).toBe(count);
  });

  // 3. Every item has unique IFCT identifier, non-empty canonical name, valid nutrient structure
  it("should verify every item has a unique ID, non-empty name, and valid nutrient structure", () => {
    const idSet = new Set<string>();

    for (const food of typedDataset.foods) {
      // Unique ID check
      expect(food.id).toBeTruthy();
      expect(typeof food.id).toBe("string");
      expect(idSet.has(food.id)).toBe(false);
      idSet.add(food.id);

      // Non-empty canonical name
      expect(food.name).toBeTruthy();
      expect(typeof food.name).toBe("string");
      expect(food.name.trim().length).toBeGreaterThan(0);

      // Category and group letter
      expect(food.category).toBeTruthy();
      expect(food.groupLetter).toBeTruthy();
      expect(food.groupLetter.length).toBe(1);

      // Nutrients structure
      expect(food.nutrientsPer100g).toBeDefined();
      const n = food.nutrientsPer100g;
      expect(typeof n.energyKj).toBe("number");
      expect(typeof n.energyKcal).toBe("number");
      expect(typeof n.proteinG).toBe("number");
      expect(typeof n.carbG).toBe("number");
      expect(typeof n.fatG).toBe("number");
      expect(typeof n.fiberG).toBe("number");
      expect(typeof n.waterG).toBe("number");
      expect(typeof n.ashG).toBe("number");

      // No NaN or Infinite numbers
      expect(Number.isFinite(n.energyKj)).toBe(true);
      expect(Number.isFinite(n.energyKcal)).toBe(true);
      expect(Number.isFinite(n.proteinG)).toBe(true);
      expect(Number.isFinite(n.carbG)).toBe(true);
      expect(Number.isFinite(n.fatG)).toBe(true);
      expect(Number.isFinite(n.fiberG)).toBe(true);
      expect(Number.isFinite(n.waterG)).toBe(true);
      expect(Number.isFinite(n.ashG)).toBe(true);
    }
  });

  // 4. Numeric nutrient fields are actually numeric and non-negative
  it("should ensure all nutrient values are non-negative", () => {
    for (const food of typedDataset.foods) {
      const n = food.nutrientsPer100g;
      expect(n.energyKj).toBeGreaterThanOrEqual(0);
      expect(n.energyKcal).toBeGreaterThanOrEqual(0);
      expect(n.proteinG).toBeGreaterThanOrEqual(0);
      expect(n.carbG).toBeGreaterThanOrEqual(0);
      expect(n.fatG).toBeGreaterThanOrEqual(0);
      expect(n.fiberG).toBeGreaterThanOrEqual(0);
    }
  });

  // 5. No duplicate canonical IDs exist
  it("should have zero duplicate IDs across all foods", () => {
    const ids = typedDataset.foods.map((f) => f.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  // 6. Alias records correctly exist and have non-empty lang and name
  it("should have valid multilingual aliases attached to canonical items", () => {
    expect(typedDataset.metadata.aliasCount).toBeGreaterThan(3000);

    for (const food of typedDataset.foods) {
      expect(Array.isArray(food.aliases)).toBe(true);
      for (const alias of food.aliases) {
        expect(alias.lang).toBeTruthy();
        expect(alias.name).toBeTruthy();
        expect(alias.name.trim().length).toBeGreaterThan(0);
      }
    }

    // Check Wheat flour, atta (A019) has Hindi alias "Atta"
    const atta = typedDataset.foods.find((f) => f.id === "A019");
    expect(atta).toBeDefined();
    const hindiAlias = atta?.aliases.find((a) => a.lang === "Hindi");
    expect(hindiAlias).toBeDefined();
    expect(hindiAlias?.name.toLowerCase()).toContain("atta");
  });

  // 7. Dataset contains representative foods
  it("should contain representative staple foods", () => {
    const foodMap = new Map<string, IFCTNormalizedFood>();
    for (const f of typedDataset.foods) {
      foodMap.set(f.id, f);
    }

    // Chicken: N003 Chicken breast
    const chickenBreast = foodMap.get("N003");
    expect(chickenBreast).toBeDefined();
    expect(chickenBreast?.name.toLowerCase()).toContain("chicken");
    expect(chickenBreast?.nutrientsPer100g.proteinG).toBeGreaterThan(20);

    // Mutton / Goat: O001 Goat shoulder
    const goatShoulder = foodMap.get("O001");
    expect(goatShoulder).toBeDefined();
    expect(goatShoulder?.name.toLowerCase()).toContain("goat");
    expect(goatShoulder?.category).toBe("Animal Meat");

    // Onion: G017 Onion, big
    const onion = foodMap.get("G017");
    expect(onion).toBeDefined();
    expect(onion?.name.toLowerCase()).toContain("onion");

    // Tomato: D075 Tomato, ripe, hybrid
    const tomato = foodMap.get("D075");
    expect(tomato).toBeDefined();
    expect(tomato?.name.toLowerCase()).toContain("tomato");

    // Potato: F006 Potato, brown skin, big
    const potato = foodMap.get("F006");
    expect(potato).toBeDefined();
    expect(potato?.name.toLowerCase()).toContain("potato");

    // Rice: A015 Rice, raw, milled
    const rice = foodMap.get("A015");
    expect(rice).toBeDefined();
    expect(rice?.name.toLowerCase()).toContain("rice");
    expect(rice?.nutrientsPer100g.carbG).toBeGreaterThan(70);

    // Wheat flour / Atta: A019 Wheat flour, atta
    const wheatAtta = foodMap.get("A019");
    expect(wheatAtta).toBeDefined();
    expect(wheatAtta?.name.toLowerCase()).toContain("atta");
    expect(wheatAtta?.nutrientsPer100g.proteinG).toBeGreaterThan(9);

    // Mustard oil: T006
    const mustardOil = foodMap.get("T006");
    expect(mustardOil).toBeDefined();
    expect(mustardOil?.name.toLowerCase()).toContain("mustard oil");
    expect(mustardOil?.category).toBe("Edible Oils and Fats");

    // Coriander: G009 (leaves) and G024 (seeds)
    const corLeaves = foodMap.get("G009");
    const corSeeds = foodMap.get("G024");
    expect(corLeaves).toBeDefined();
    expect(corSeeds).toBeDefined();

    // Fenugreek: C020 (leaves) and G026 (seeds)
    const fenLeaves = foodMap.get("C020");
    const fenSeeds = foodMap.get("G026");
    expect(fenLeaves).toBeDefined();
    expect(fenSeeds).toBeDefined();
  });

  // 8. Structural distinctions are preserved to prevent confusing matches
  it("should preserve structural distinction between leaves and seeds", () => {
    // Coriander
    const corLeaves = typedDataset.foods.find((f) => f.id === "G009")!;
    const corSeeds = typedDataset.foods.find((f) => f.id === "G024")!;
    expect(corLeaves.structuralParts).toContain("leaves");
    expect(corLeaves.structuralParts).not.toContain("seeds");
    expect(corSeeds.structuralParts).toContain("seeds");
    expect(corSeeds.structuralParts).not.toContain("leaves");
    // Vast difference in energy & macros
    expect(corLeaves.nutrientsPer100g.energyKj).toBeLessThan(200); // 130 kJ (~31 kcal)
    expect(corSeeds.nutrientsPer100g.energyKj).toBeGreaterThan(1000); // 1125 kJ (~269 kcal)

    // Fenugreek
    const fenLeaves = typedDataset.foods.find((f) => f.id === "C020")!;
    const fenSeeds = typedDataset.foods.find((f) => f.id === "G026")!;
    expect(fenLeaves.structuralParts).toContain("leaves");
    expect(fenLeaves.structuralParts).not.toContain("seeds");
    expect(fenSeeds.structuralParts).toContain("seeds");
    expect(fenSeeds.structuralParts).not.toContain("leaves");
    expect(fenLeaves.nutrientsPer100g.proteinG).toBeLessThan(5); // 3.68g
    expect(fenSeeds.nutrientsPer100g.proteinG).toBeGreaterThan(20); // 25.41g
  });

  it("should preserve structural distinction between oil, seeds, and greens for Mustard", () => {
    const greens = typedDataset.foods.find((f) => f.id === "C026")!; // Mustard leaves
    const seeds = typedDataset.foods.find((f) => f.id === "H013")!; // Mustard seeds
    const oil = typedDataset.foods.find((f) => f.id === "T006")!; // Mustard oil

    expect(greens.structuralParts).toContain("leaves");
    expect(greens.structuralParts).not.toContain("oil");

    expect(seeds.structuralParts).toContain("seeds");
    expect(seeds.structuralParts).not.toContain("oil");

    expect(oil.structuralParts).toContain("oil");
    expect(oil.structuralParts).not.toContain("leaves");
    expect(oil.structuralParts).not.toContain("seeds");

    // Verify completely different categories
    expect(greens.category).toBe("Green Leafy Vegetables");
    expect(seeds.category).toBe("Nuts and Oil Seeds");
    expect(oil.category).toBe("Edible Oils and Fats");
  });

  // 9. Energy-data validation: Identify zero-energy items (Group T)
  it("should accurately identify the 14 zero-energy source items in Group T (Edible Oils and Fats)", () => {
    const zeroEnergyFoods = typedDataset.foods.filter((f) => f.sourceEnergyZero);
    expect(zeroEnergyFoods.length).toBe(14);
    expect(typedDataset.metadata.zeroEnergyCount).toBe(14);

    // All zero-energy items should belong to Group T (Edible Oils and Fats)
    for (const food of zeroEnergyFoods) {
      expect(food.groupLetter).toBe("T");
      expect(food.category).toBe("Edible Oils and Fats");
      expect(food.nutrientsPer100g.energyKj).toBe(0);
      expect(food.nutrientsPer100g.energyKcal).toBe(0);
    }
  });
});

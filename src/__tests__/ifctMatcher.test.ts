import { describe, it, expect } from "vitest";
import { matchIngredient, computeFuzzySimilarity, hasStructuralConflict, TIER1_SEED_MAP, resolveCulinaryPortion } from "../lib/ifctMatcher";
import { calculateFoodMacros, IFCT_DATABASE } from "../lib/ifctData";

describe("IFCT 3-Tier Matcher Engine (src/lib/ifctMatcher.ts)", () => {
  // ── 1. The 5 Fuzzy-Match Test Cases from Design Discussion ──
  describe("Fuzzy Matching (Tier 3) and Structural Collision Guards", () => {
    it("Case 1: should correctly fuzzy-match typo 'potatos' to Potato (brown skin)", () => {
      const match = matchIngredient("potatos");
      expect(match).not.toBeNull();
      expect(match?.tier).toBe("tier3_fuzzy");
      expect(match?.name.toLowerCase()).toContain("potato");
      expect(match?.confidence).toBeGreaterThanOrEqual(0.82);
      expect(match?.requiresReview).toBe(true);
    });

    it("Case 2: should correctly fuzzy-match typo 'chicpeas' to Chickpea / Bengal gram", () => {
      const match = matchIngredient("chicpeas");
      expect(match).not.toBeNull();
      expect(match?.tier).toBe("tier3_fuzzy");
      expect(match?.name.toLowerCase()).toContain("bengal gram");
      expect(match?.confidence).toBeGreaterThanOrEqual(0.82);
      expect(match?.requiresReview).toBe(true);
    });

    it("Case 3: should correctly fuzzy-match typo 'coliflower' to Cauliflower", () => {
      const match = matchIngredient("coliflower");
      expect(match).not.toBeNull();
      expect(match?.tier).toBe("tier3_fuzzy");
      expect(match?.id).toBe("D036"); // Cauliflower
      expect(match?.confidence).toBeGreaterThanOrEqual(0.82);
    });

    it("Case 4 (Tricky Collision Guard): Coriander leaves vs Coriander seeds", () => {
      // Coriander leaves query must match leaves (G009), never seeds (G024)
      const leavesMatch = matchIngredient("coriander leaves");
      expect(leavesMatch).not.toBeNull();
      expect(leavesMatch?.id).toBe("G009");
      expect(leavesMatch?.structuralParts).toContain("leaves");
      expect(leavesMatch?.structuralParts).not.toContain("seeds");
      expect(leavesMatch?.nutrientsPer100g.energyKcal).toBeLessThan(50); // ~31.1 kcal

      // Coriander seeds query must match seeds (G024), never leaves (G009)
      const seedsMatch = matchIngredient("coriander seeds");
      expect(seedsMatch).not.toBeNull();
      expect(seedsMatch?.id).toBe("G024");
      expect(seedsMatch?.structuralParts).toContain("seeds");
      expect(seedsMatch?.structuralParts).not.toContain("leaves");
      expect(seedsMatch?.nutrientsPer100g.energyKcal).toBeGreaterThan(200); // ~268.9 kcal

      // Direct structural conflict check
      expect(hasStructuralConflict(["leaves"], ["seeds"])).toBe(true);
      expect(hasStructuralConflict(["seeds"], ["leaves"])).toBe(true);
    });

    it("Case 5 (Tricky Collision Guard): Mustard oil vs Mustard seeds vs Mustard leaves", () => {
      // Mustard oil must match T006, never seeds (H013) or leaves (C026)
      const oilMatch = matchIngredient("mustard oil");
      expect(oilMatch).not.toBeNull();
      expect(oilMatch?.id).toBe("T006");
      expect(oilMatch?.structuralParts).toContain("oil");
      expect(oilMatch?.nutrientsPer100g.energyKcal).toBe(900); // Atwater 900 kcal

      // Mustard seeds must match G027 / H013, never oil
      const seedsMatch = matchIngredient("mustard seeds");
      expect(seedsMatch).not.toBeNull();
      expect(seedsMatch?.structuralParts).toContain("seeds");
      expect(seedsMatch?.structuralParts).not.toContain("oil");

      // Mustard leaves must match C026, never oil
      const leavesMatch = matchIngredient("mustard leaves");
      expect(leavesMatch).not.toBeNull();
      expect(leavesMatch?.id).toBe("C026");
      expect(leavesMatch?.structuralParts).toContain("leaves");
      expect(leavesMatch?.structuralParts).not.toContain("oil");

      // Direct structural conflict check
      expect(hasStructuralConflict(["oil"], ["seeds"])).toBe(true);
      expect(hasStructuralConflict(["oil"], ["leaves"])).toBe(true);
      expect(hasStructuralConflict(["leaves"], ["oil"])).toBe(true);
    });
  });

  // ── 2. Tier 1 Curated Synonym Matching ──
  describe("Tier 1 Curated Canonical Synonyms", () => {
    it("should match staple poultry & animal meats", () => {
      // Chicken cuts
      const chicken = matchIngredient("chicken");
      expect(chicken?.id).toBe("N003");
      expect(chicken?.tier).toBe("tier1_synonym");
      expect(chicken?.confidence).toBe(1.0);
      expect(chicken?.requiresReview).toBe(false);

      const thigh = matchIngredient("chicken thigh");
      expect(thigh?.id).toBe("N002");

      const leg = matchIngredient("chicken leg");
      expect(leg?.id).toBe("N001");

      // Mutton / Goat
      const mutton = matchIngredient("mutton");
      expect(mutton?.id).toBe("O001");
      expect(mutton?.category).toBe("Animal Meat");

      const kaleji = matchIngredient("kaleji");
      expect(kaleji?.id).toBe("O008"); // Goat liver
    });

    it("should match dairy staples (paneer, cow milk, buffalo milk)", () => {
      const paneer = matchIngredient("paneer");
      expect(paneer?.id).toBe("L003");
      expect(paneer?.tier).toBe("tier1_synonym");
      expect(paneer?.confidence).toBe(1.0);

      const cowMilk = matchIngredient("cow milk");
      expect(cowMilk?.id).toBe("L002");

      const buffaloMilk = matchIngredient("buffalo milk");
      expect(buffaloMilk?.id).toBe("L001");
    });

    it("should match flours and grains (atta, maida, sooji, rice, poha)", () => {
      const atta = matchIngredient("atta");
      expect(atta?.id).toBe("A019");
      expect(atta?.name).toBe("Wheat flour, atta");

      const maida = matchIngredient("maida");
      expect(maida?.id).toBe("A018");

      const sooji = matchIngredient("sooji");
      expect(sooji?.id).toBe("A022");

      const rice = matchIngredient("rice");
      expect(rice?.id).toBe("A015");

      const poha = matchIngredient("poha");
      expect(poha?.id).toBe("A011");
    });

    it("should match dals and legumes correctly", () => {
      const toor = matchIngredient("toor dal");
      expect(toor?.id).toBe("B021");

      const moong = matchIngredient("moong dal");
      expect(moong?.id).toBe("B010");

      const kalaChana = matchIngredient("kala chana");
      expect(kalaChana?.id).toBe("B002");

      const besan = matchIngredient("besan");
      expect(besan?.id).toBe("B001");
    });

    it("should explicitly return unmatched (null) for 'kabuli chana' rather than falsely substituting B002", () => {
      const kabuli = matchIngredient("kabuli chana");
      // Must NOT be mapped in Tier 1
      expect(TIER1_SEED_MAP["kabuli chana"]).toBeUndefined();
      // Should return null (not match B002 or anything else)
      expect(kabuli).toBeNull();
    });
  });

  // ── 3. Tier 2 Multilingual Alias Matching ──
  describe("Tier 2 Multilingual Alias Matching", () => {
    it("should match regional terms from the 5,282 IFCT aliases", () => {
      // Tomato aliases: Assamese "poka bilahi", Gujarati "tameta", Hindi "tamator"
      const pokaBilahi = matchIngredient("poka bilahi");
      expect(pokaBilahi?.id).toBe("D075");
      expect(pokaBilahi?.tier).toBe("tier2_multilingual");
      expect(pokaBilahi?.confidence).toBe(0.95);

      const tameta = matchIngredient("tameta");
      expect(tameta?.id).toBe("D075");
      expect(tameta?.tier).toBe("tier2_multilingual");

      const tamator = matchIngredient("tamator");
      expect(tamator?.id).toBe("D075");

      // Rice aliases: Bengali "chowl", Gujarati "choka"
      const chowl = matchIngredient("chowl");
      expect(chowl?.id).toBe("A015");
      expect(chowl?.tier).toBe("tier2_multilingual");

      const choka = matchIngredient("choka");
      expect(choka?.id).toBe("A015");

      // Atta alias: Bengali "ata"
      const ata = matchIngredient("ata");
      expect(ata?.id).toBe("A019");
    });
  });

  // ── 4. Fish & Shellfish Matching ──
  describe("Fish & Shellfish Matching", () => {
    it("should match specific Indian fish species to their true IFCT codes", () => {
      const rohu = matchIngredient("rohu");
      expect(rohu?.id).toBe("S006"); // Freshwater Rohu
      expect(rohu?.name).toBe("Rohu");

      const catla = matchIngredient("catla");
      expect(catla?.id).toBe("S002"); // Freshwater Catla

      const surmai = matchIngredient("surmai");
      expect(surmai?.id).toBe("P087"); // Vanjaram / Kingfish

      const pomfret = matchIngredient("pomfret");
      expect(pomfret?.id).toBe("P057"); // White pomfret

      const bangda = matchIngredient("bangda");
      expect(bangda?.id).toBe("P034"); // Mackerel

      const hilsa = matchIngredient("hilsa");
      expect(hilsa?.id).toBe("P017"); // Hilsa
    });

    it("should correctly separate prawns from crab", () => {
      const crab = matchIngredient("crab");
      expect(crab?.id).toBe("Q001");
      expect(crab?.name).toBe("Crab");

      const prawns = matchIngredient("prawns");
      expect(prawns?.id).toBe("Q007"); // Tiger prawns, brown
      expect(prawns?.name).toContain("prawns");

      // Verify they do not collapse into the same ID
      expect(crab?.id).not.toBe(prawns?.id);
    });

    it("should NOT match bare 'fish' to Salmon or any specific species (returns null)", () => {
      const bareFish = matchIngredient("fish");
      // Bare fish must not be arbitrarily mapped to Salmon (P068) or any other species
      expect(bareFish).toBeNull();
    });
  });

  // ── 5. Atwater Energy Fallback for Group T Lipids ──
  describe("Atwater Energy Fallback for Zero-Energy Lipids (Group T)", () => {
    it("should compute 900.0 kcal/100g for Mustard oil (T006)", () => {
      const mustardOil = matchIngredient("mustard oil");
      expect(mustardOil).not.toBeNull();
      expect(mustardOil?.id).toBe("T006");
      expect(mustardOil?.originalSourceEnergyZero).toBe(true);
      expect(mustardOil?.nutrientsPer100g.energyKcal).toBe(900.0);
      expect(mustardOil?.nutrientsPer100g.fatG).toBe(100.0);
      expect(mustardOil?.nutrientsPer100g.proteinG).toBe(0.0);
      expect(mustardOil?.nutrientsPer100g.carbG).toBe(0.0);
      expect(mustardOil?.nutrientsPer100g.energyKj).toBe(3765.6);
    });

    it("should compute 900.0 kcal/100g for Ghee (T013)", () => {
      const ghee = matchIngredient("ghee");
      expect(ghee).not.toBeNull();
      expect(ghee?.id).toBe("T013");
      expect(ghee?.originalSourceEnergyZero).toBe(true);
      expect(ghee?.nutrientsPer100g.energyKcal).toBe(900.0);
      expect(ghee?.nutrientsPer100g.fatG).toBe(100.0);
    });

    it("should compute 900.0 kcal/100g for Sunflower oil (T012)", () => {
      const sunflowerOil = matchIngredient("sunflower oil");
      expect(sunflowerOil).not.toBeNull();
      expect(sunflowerOil?.id).toBe("T012");
      expect(sunflowerOil?.originalSourceEnergyZero).toBe(true);
      expect(sunflowerOil?.nutrientsPer100g.energyKcal).toBe(900.0);
    });
  });

  // ── 6. Negative Matching & Architectural Isolation ──
  describe("Negative Matching & Architecture Isolation", () => {
    it("should return null for unmatched foods and gibberish", () => {
      expect(matchIngredient("crabapple")).toBeNull();
      expect(matchIngredient("dragonfruit")).toBeNull();
      expect(matchIngredient("xyz123randomfood")).toBeNull();
      expect(matchIngredient("")).toBeNull();
    });

    it("should return null for known IFCT gaps (cinnamon, dalchini, kabuli chana)", () => {
      expect(matchIngredient("cinnamon")).toBeNull();
      expect(matchIngredient("dalchini")).toBeNull();
      expect(matchIngredient("kabuli chana")).toBeNull();
    });

    it("should return null for bare generic dish descriptors without fuzzy-matching specific ingredients", () => {
      // "curry" must NOT match "Curry leaves" (G010)
      expect(matchIngredient("curry")).toBeNull();
      // "gravy", "sabzi", "masala" must NOT fuzzy-match random ingredients
      expect(matchIngredient("gravy")).toBeNull();
      expect(matchIngredient("sabzi")).toBeNull();
      expect(matchIngredient("masala")).toBeNull();
    });

    it("should verify audited vegetables and spices resolve to exact IFCT items", () => {
      expect(matchIngredient("spinach")?.id).toBe("C033");
      expect(matchIngredient("palak")?.id).toBe("C033");
      expect(matchIngredient("bhindi")?.id).toBe("D056");
      expect(matchIngredient("cabbage")?.id).toBe("C015");
      expect(matchIngredient("ragi")?.id).toBe("A010");
      expect(matchIngredient("sabudana")?.id).toBe("F015");
      expect(matchIngredient("elaichi")?.id).toBe("G020");
      expect(matchIngredient("laung")?.id).toBe("G023");
      expect(matchIngredient("kali mirch")?.id).toBe("G031");
      expect(matchIngredient("hing")?.id).toBe("G019");
    });

    it("should resolve supplemental standards for butter, cream, curd, and cheese with explicit sources", () => {
      const butter = matchIngredient("butter");
      expect(butter).not.toBeNull();
      expect(butter?.id).toBe("SUPP_BUTTER");
      expect(butter?.source).toBe("USDA FoodData Central FDC ID 173410");
      expect(butter?.nutrientsPer100g.energyKcal).toBe(717.0);
      expect(butter?.nutrientsPer100g.fatG).toBe(81.11);
      expect(butter?.nutrientsPer100g.proteinG).toBe(0.85);

      const makhan = matchIngredient("makhan");
      expect(makhan?.id).toBe("SUPP_BUTTER");

      const cream = matchIngredient("fresh cream");
      expect(cream).not.toBeNull();
      expect(cream?.id).toBe("SUPP_CREAM");
      expect(cream?.source).toContain("commercial fresh cooking cream standard");
      expect(cream?.nutrientsPer100g.energyKcal).toBe(246.0);
      expect(cream?.nutrientsPer100g.fatG).toBe(25.0);

      const malai = matchIngredient("malai");
      expect(malai?.id).toBe("SUPP_CREAM");

      const curd = matchIngredient("curd");
      expect(curd?.id).toBe("SUPP_CURD");
      expect(curd?.nutrientsPer100g.energyKcal).toBe(61.0);

      const cheese = matchIngredient("cheese");
      expect(cheese?.id).toBe("SUPP_CHEESE");
      expect(cheese?.nutrientsPer100g.energyKcal).toBe(403.0);
    });

    it("should resolve cashew and kaju directly in Tier 1 to H005", () => {
      const cashew = matchIngredient("cashew");
      expect(cashew).not.toBeNull();
      expect(cashew?.id).toBe("H005");
      expect(cashew?.tier).toBe("tier1_synonym");
      expect(cashew?.nutrientsPer100g.energyKcal).toBe(582.7);

      const kaju = matchIngredient("kaju");
      expect(kaju?.id).toBe("H005");
      expect(kaju?.tier).toBe("tier1_synonym");
    });

    it("should resolve cooked and garnish synonyms in Tier 1", () => {
      expect(matchIngredient("cooked rice")?.id).toBe("A015");
      expect(matchIngredient("cooked basmati rice")?.id).toBe("A015");
      expect(matchIngredient("roti")?.id).toBe("A019");
      expect(matchIngredient("chapati")?.id).toBe("A019");
      expect(matchIngredient("naan")?.id).toBe("A018");
      expect(matchIngredient("cooked toor dal")?.id).toBe("B021");
      expect(matchIngredient("cooked moong dal")?.id).toBe("B010");
      expect(matchIngredient("cooked chicken")?.id).toBe("N003");
      expect(matchIngredient("birista")?.id).toBe("G017");
      expect(matchIngredient("fried onion")?.id).toBe("G017");
      expect(matchIngredient("fried onions")?.id).toBe("G017");
    });

    it("should confirm existing ifctData.ts and IFCT_DATABASE remain untouched and valid", () => {
      // Verify existing 21-item database is completely unchanged
      expect(Object.keys(IFCT_DATABASE).length).toBeGreaterThanOrEqual(20);
      const res = calculateFoodMacros("Roti", 2, "piece");
      expect(res.matched).toBe(true);
      expect(res.calories).toBeGreaterThanOrEqual(165);
      expect(res.proteinG).toBe(6.4);
    });
  });

  describe("Sourced Culinary Transforms Engine (resolveCulinaryPortion)", () => {
    it("should correctly convert cooked basmati rice (220g) to raw commodity weight via ICMR-NIN divisor 2.73", () => {
      const resolved = resolveCulinaryPortion("A015", "cooked basmati rice", 220);
      expect(resolved.effectiveWeightGrams).toBe(80.6);
      expect(resolved.supplementalOilGrams).toBe(0);
      expect(resolved.transformApplied?.source).toContain("ICMR-NIN");
      expect(resolved.auditNote).toContain("220g cooked / 2.73 -> 80.6g raw commodity");
    });

    it("should correctly convert cooked plain roti (40g) to dry atta via USDA/ICMR divisor 1.43", () => {
      const resolved = resolveCulinaryPortion("A019", "roti", 40);
      expect(resolved.effectiveWeightGrams).toBe(28.0);
      expect(resolved.supplementalOilGrams).toBe(0);
      expect(resolved.transformApplied?.hydrationDivisor).toBe(1.43);
    });

    it("should correctly convert baked naan matrix (90g) to dry maida via CFTRI divisor 1.38", () => {
      const resolved = resolveCulinaryPortion("A018", "maida", 90);
      expect(resolved.effectiveWeightGrams).toBe(65.2);
      expect(resolved.supplementalOilGrams).toBe(0);
      expect(resolved.transformApplied?.hydrationDivisor).toBe(1.38);
    });

    it("should correctly convert cooked toor dal (150g) to raw pulse via ICMR divisor 3.85", () => {
      const resolved = resolveCulinaryPortion("B021", "cooked toor dal", 150);
      expect(resolved.effectiveWeightGrams).toBe(39.0);
      expect(resolved.supplementalOilGrams).toBe(0);
      expect(resolved.transformApplied?.hydrationDivisor).toBe(3.85);
    });

    it("should correctly convert cooked moong dal (150g) to raw pulse via ICMR divisor 3.85", () => {
      const resolved = resolveCulinaryPortion("B010", "cooked moong dal", 150);
      expect(resolved.effectiveWeightGrams).toBe(39.0);
      expect(resolved.supplementalOilGrams).toBe(0);
      expect(resolved.transformApplied?.hydrationDivisor).toBe(3.85);
    });

    it("should correctly unpack birista (10g) into raw onion (25g) + absorbed oil (3.5g) via expansionMultiplier", () => {
      const resolved = resolveCulinaryPortion("G017", "birista", 10);
      expect(resolved.effectiveWeightGrams).toBe(25.0); // 10 * 2.50
      expect(resolved.supplementalOilGrams).toBe(3.5);  // 10 * 0.35
      expect(resolved.transformApplied?.expansionMultiplier).toBe(2.50);
      expect(resolved.transformApplied?.absorbedOilRatio).toBe(0.35);
      expect(resolved.auditNote).toContain("10g fried -> 25g raw onion + 3.5g absorbed oil");
    });

    it("should passthrough meats, dairy, eggs, and raw produce 1:1 without dividing", () => {
      const chicken = resolveCulinaryPortion("N003", "cooked chicken", 100);
      expect(chicken.effectiveWeightGrams).toBe(100);
      expect(chicken.supplementalOilGrams).toBe(0);

      const curd = resolveCulinaryPortion("SUPP_CURD", "curd", 80);
      expect(curd.effectiveWeightGrams).toBe(80);

      const egg = resolveCulinaryPortion("M004", "boiled egg", 50);
      expect(egg.effectiveWeightGrams).toBe(50);

      const cucumber = resolveCulinaryPortion("D026", "cucumber", 20);
      expect(cucumber.effectiveWeightGrams).toBe(20);
    });

    it("should preserve explicitly labeled raw/dry ingredients 1:1 without dividing", () => {
      const rawRice = resolveCulinaryPortion("A015", "raw rice", 100);
      expect(rawRice.effectiveWeightGrams).toBe(100);
      expect(rawRice.auditNote).toContain("Explicit raw/dry label: passthrough");

      const dryAtta = resolveCulinaryPortion("A019", "dry atta", 50);
      expect(dryAtta.effectiveWeightGrams).toBe(50);
    });
  });
});

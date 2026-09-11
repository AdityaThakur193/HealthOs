import { NextRequest } from "next/server";
import { analyzeMealImage, analyzeMealTextWithGroq, MealAnalysis, DetectedFoodItem } from "@/lib/gemini";
import { calculateFoodMacros } from "@/lib/ifctData";

export function getMockMealAnalysis(): MealAnalysis {
  const item1 = calculateFoodMacros("Roti", 2, "piece");
  const item2 = calculateFoodMacros("Yellow Dal", 1, "katori", "thin_mess");
  const item3 = calculateFoodMacros("Curd", 1, "katori");

  const foods: DetectedFoodItem[] = [
    {
      name: item1.name,
      dishName: "roti",
      preparationStyle: "plain",
      quantity: 2,
      unitType: "piece",
      estimatedCalories: item1.calories,
      proteinG: item1.proteinG,
      carbsG: item1.carbsG,
      fatG: item1.fatG,
      weightGrams: item1.weightGrams,
    },
    {
      name: item2.name,
      dishName: "dal_toor",
      preparationStyle: "thin_mess",
      quantity: 1,
      unitType: "katori",
      estimatedCalories: item2.calories,
      proteinG: item2.proteinG,
      carbsG: item2.carbsG,
      fatG: item2.fatG,
      weightGrams: item2.weightGrams,
    },
    {
      name: item3.name,
      dishName: "curd",
      preparationStyle: "standard",
      quantity: 1,
      unitType: "katori",
      estimatedCalories: item3.calories,
      proteinG: item3.proteinG,
      carbsG: item3.carbsG,
      fatG: item3.fatG,
      weightGrams: item3.weightGrams,
    },
  ];

  const totalCalories = foods.reduce((sum, f) => sum + (f.estimatedCalories || 0), 0);
  const totalProteinG = Math.round(foods.reduce((sum, f) => sum + (f.proteinG || 0), 0) * 10) / 10;
  const totalCarbsG = Math.round(foods.reduce((sum, f) => sum + (f.carbsG || 0), 0) * 10) / 10;
  const totalFatG = Math.round(foods.reduce((sum, f) => sum + (f.fatG || 0), 0) * 10) / 10;

  return {
    foods,
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    confidence: 0.94,
    plateType: "hostel_mess_thali",
    notes: "Hostel mess thali with rotis, yellow dal, and plain curd.",
  };
}

/**
 * Post-processes visual AI candidate detections with deterministic ICMR-NIN IFCT 2017 math
 */
function isNonFoodOrDrink(name: string): boolean {
  const clean = (name || "").toLowerCase().trim();
  if (!clean) return true;
  if (
    clean === "water" ||
    clean === "plain water" ||
    clean === "glass of water" ||
    clean === "bottle of water" ||
    clean === "drinking water" ||
    clean.startsWith("water ") ||
    /\b(glass|bottle|cup) of water\b/.test(clean)
  ) {
    return true;
  }
  const nonFoodList = [
    "empty plate",
    "empty bowl",
    "empty dish",
    "empty thali",
    "empty glass",
    "empty cup",
    "napkin",
    "tissue",
    "cutlery",
    "spoon",
    "fork",
    "plate",
    "table",
    "person",
  ];
  return nonFoodList.includes(clean) || clean.startsWith("empty ");
}

/**
 * Post-processes visual AI candidate detections with deterministic ICMR-NIN IFCT 2017 math
 */
export function enrichMealAnalysisWithIFCT(rawAnalysis: MealAnalysis): MealAnalysis {
  if (!rawAnalysis || !rawAnalysis.foods || !Array.isArray(rawAnalysis.foods)) {
    throw new Error("Invalid AI response: foods array missing or invalid");
  }

  const validCandidates = rawAnalysis.foods.filter((food) => {
    const dishQuery = food.dishName || food.name;
    return Boolean(dishQuery && !isNonFoodOrDrink(dishQuery));
  });

  const enrichedFoods: DetectedFoodItem[] = validCandidates.map((food) => {
    const dishQuery = food.dishName || food.name!;
    const qty = food.quantity && food.quantity > 0 ? food.quantity : 1;
    const unit = food.unitType || "piece";
    const prep = food.preparationStyle || "standard";

    const computed = calculateFoodMacros(dishQuery, qty, unit, prep);

    return {
      ...food,
      name: food.name || computed.name,
      dishName: food.dishName || computed.id,
      quantity: computed.quantity,
      unitType: (computed.unitType as any) || "piece",
      estimatedCalories: computed.calories,
      proteinG: computed.proteinG,
      carbsG: computed.carbsG,
      fatG: computed.fatG,
      weightGrams: computed.weightGrams,
      unmatched: !computed.matched,
      quantityClamped: computed.quantityClamped,
    };
  });

  const totalCalories = enrichedFoods.reduce((sum, f) => sum + (f.estimatedCalories || 0), 0);
  const totalProteinG = Math.round(enrichedFoods.reduce((sum, f) => sum + (f.proteinG || 0), 0) * 10) / 10;
  const totalCarbsG = Math.round(enrichedFoods.reduce((sum, f) => sum + (f.carbsG || 0), 0) * 10) / 10;
  const totalFatG = Math.round(enrichedFoods.reduce((sum, f) => sum + (f.fatG || 0), 0) * 10) / 10;

  const isNonFoodFiltered = enrichedFoods.length === 0 && rawAnalysis.foods.length > 0;
  const hasUnmatched = enrichedFoods.some((f) => f.unmatched);
  const unmatchedNames = enrichedFoods.filter((f) => f.unmatched).map((f) => f.name).join(", ");
  const clampedItems = enrichedFoods.filter((f) => f.quantityClamped).map((f) => f.name);

  let finalNotes = rawAnalysis.notes || "";
  if (isNonFoodFiltered) {
    finalNotes = "Non-food item or plain water detected — 0 calories logged.";
  } else {
    if (hasUnmatched) {
      const warning = `Couldn't identify macros for: ${unmatchedNames} — please edit manually.`;
      finalNotes = finalNotes ? `${finalNotes} (${warning})` : warning;
    }
    if (clampedItems.length > 0) {
      const clampWarning = `Quantity adjusted to maximum plausible limit for: ${clampedItems.join(", ")} — please verify.`;
      finalNotes = finalNotes ? `${finalNotes} (${clampWarning})` : clampWarning;
    }
  }

  return {
    foods: enrichedFoods,
    totalCalories,
    totalProteinG,
    totalCarbsG,
    totalFatG,
    confidence: isNonFoodFiltered ? 0 : (rawAnalysis.confidence || 0.9),
    plateType: isNonFoodFiltered ? "single_dish" : (rawAnalysis.plateType || "single_dish"),
    notes: finalNotes,
  };
}

const visionCache = new Map<string, MealAnalysis>();

/**
 * POST /api/vision
 *
 * Accepts imageBase64 or mealText.
 * Uses Gemini 2.5 Flash Vision for image capture, with Groq AI (openai/gpt-oss-20b) + ICMR-NIN IFCT 2017 fallback!
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType, mealText } = body;

    // Handle pure text meal analysis request
    if (mealText && !imageBase64) {
      try {
        console.log(`⚡ Analyzing text meal description using Groq AI + IFCT 2017: "${mealText}"...`);
        const rawAnalysis = await analyzeMealTextWithGroq(mealText);
        const analysis = enrichMealAnalysisWithIFCT(rawAnalysis);
        return Response.json({ analysis, isMock: false, source: "groq_text" });
      } catch (groqErr) {
        console.warn("⚠️ Groq text meal analysis failed, using mock fallback:", groqErr);
        return Response.json({ analysis: getMockMealAnalysis(), isMock: true, source: "mock" });
      }
    }

    if (!imageBase64) {
      return Response.json(
        { error: "imageBase64 or mealText is required" },
        { status: 400 }
      );
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageKey = cleanBase64.slice(0, 100) + cleanBase64.slice(-100) + cleanBase64.length;

    if (visionCache.has(imageKey)) {
      console.log("⚡ Returning cached Vision Analysis result for identical image submission...");
      return Response.json({ analysis: visionCache.get(imageKey)!, isMock: false, source: "cache" });
    }

    let analysis: MealAnalysis = getMockMealAnalysis();
    let isMock = true;
    let source = "mock";

    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
      try {
        console.log("⚡ Analyzing meal image using Gemini Vision + IFCT 2017 Engine...");
        const rawAnalysis = await analyzeMealImage(cleanBase64, mimeType || "image/jpeg");
        analysis = enrichMealAnalysisWithIFCT(rawAnalysis);
        visionCache.set(imageKey, analysis);
        isMock = false;
        source = "gemini_vision";
      } catch (geminiError: any) {
        console.warn("⚠️ Gemini Vision API call failed, attempting Groq text fallback:", geminiError);
        if (mealText) {
          try {
            const rawAnalysis = await analyzeMealTextWithGroq(mealText);
            analysis = enrichMealAnalysisWithIFCT(rawAnalysis);
            isMock = false;
            source = "groq_text_fallback";
          } catch (groqError) {
            analysis = getMockMealAnalysis();
            isMock = true;
            source = "mock";
          }
        } else {
          analysis = getMockMealAnalysis();
          isMock = true;
          source = "mock";
        }
      }
    } else if (mealText) {
      try {
        console.log("⚡ No Gemini key; analyzing meal text using Groq AI...");
        const rawAnalysis = await analyzeMealTextWithGroq(mealText);
        analysis = enrichMealAnalysisWithIFCT(rawAnalysis);
        isMock = false;
        source = "groq_text";
      } catch (groqError) {
        analysis = getMockMealAnalysis();
        isMock = true;
        source = "mock";
      }
    } else {
      console.log("⚠️ No Gemini API key configured. Using mock IFCT analysis.");
      analysis = getMockMealAnalysis();
      isMock = true;
      source = "mock";
    }

    return Response.json({ analysis, isMock, source });
  } catch (error) {
    console.error("Vision API error:", error);
    return Response.json(
      { error: "Failed to analyze meal image" },
      { status: 500 }
    );
  }
}

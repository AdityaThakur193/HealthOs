import { NextRequest } from "next/server";
import { analyzeMealImage, MealAnalysis } from "@/lib/gemini";

function getMockMealAnalysis(): MealAnalysis {
  return {
    foods: [
      {
        name: "Idli",
        portionSize: "medium",
        estimatedCalories: 270,
        proteinG: 9,
        carbsG: 50,
        fatG: 2,
      },
      {
        name: "Sambar",
        portionSize: "medium",
        estimatedCalories: 120,
        proteinG: 4,
        carbsG: 18,
        fatG: 4,
      },
      {
        name: "Coconut Chutney",
        portionSize: "small",
        estimatedCalories: 80,
        proteinG: 1,
        carbsG: 6,
        fatG: 7,
      },
    ],
    totalCalories: 470,
    totalProteinG: 14,
    confidence: 0.94,
  };
}

/**
 * POST /api/vision
 *
 * Takes a base64 image and processes it via Gemini 2.0 Vision.
 * Returns structured food listings with portion estimates.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return Response.json(
        { error: "imageBase64 is required" },
        { status: 400 }
      );
    }

    let analysis: MealAnalysis;
    let isMock = false;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      console.log("⚠️ Using mock vision analysis (no API key configured)");
      await new Promise((r) => setTimeout(r, 1500));
      analysis = getMockMealAnalysis();
      isMock = true;
    } else {
      try {
        // Stripping potential base64 prefix
        const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
        analysis = await analyzeMealImage(cleanBase64, mimeType || "image/jpeg");
      } catch (geminiError: any) {
        const isQuotaError =
          geminiError?.status === 429 ||
          String(geminiError).includes("429") ||
          String(geminiError).includes("quota");

        if (isQuotaError) {
          console.warn("⚠️ Gemini quota exceeded — returning error to client");
          return Response.json(
            {
              error: "quota_exceeded",
              message:
                "Gemini API daily limit reached. Wait until tomorrow or enable billing at console.cloud.google.com for higher limits.",
            },
            { status: 429 }
          );
        }

        console.warn("⚠️ Gemini Vision API call failed. Falling back to mock:", geminiError);
        await new Promise((r) => setTimeout(r, 1000));
        analysis = getMockMealAnalysis();
        isMock = true;
      }
    }

    return Response.json({ analysis, isMock });
  } catch (error) {
    console.error("Vision API error:", error);
    return Response.json(
      { error: "Failed to analyze meal image" },
      { status: 500 }
    );
  }
}

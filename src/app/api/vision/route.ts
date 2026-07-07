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

async function analyzeMealWithGroq(imageBase64: string, mimeType: string): Promise<MealAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not defined");
  }

  const prompt = `You are a nutrition analysis AI for an Indian college student's health app.
Analyze this food image and return a JSON object with:
- "foods": array of detected food items, each with "name", "portionSize" (small/medium/large), "estimatedCalories", "proteinG", "carbsG", "fatG"
- "totalCalories": sum of all calories
- "totalProteinG": sum of all protein
- "confidence": 0-1 confidence score

Be accurate with Indian foods (dal, roti, rice, sabzi, mess food, etc).
Return ONLY valid JSON.`;

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageUrl = `data:${mimeType};base64,${cleanBase64}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } }
          ]
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from Groq");
  }

  return JSON.parse(text) as MealAnalysis;
}

/**
 * POST /api/vision
 *
 * Takes a base64 image and processes it via Groq Vision (or Gemini 2.0 Vision fallback).
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

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (groqKey && groqKey !== "your_groq_api_key_here") {
      try {
        console.log("⚡ Analyzing meal using Groq Vision API...");
        analysis = await analyzeMealWithGroq(imageBase64, mimeType || "image/jpeg");
      } catch (groqError: any) {
        console.warn("⚠️ Groq Vision API call failed, falling back to Gemini:", groqError);
        // Fallback to Gemini if Groq fails
        if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
          try {
            const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
            analysis = await analyzeMealImage(cleanBase64, mimeType || "image/jpeg");
          } catch (geminiError: any) {
            console.warn("⚠️ Gemini Vision API call also failed. Falling back to mock:", geminiError);
            analysis = getMockMealAnalysis();
            isMock = true;
          }
        } else {
          analysis = getMockMealAnalysis();
          isMock = true;
        }
      }
    } else if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
      try {
        console.log("⚡ Analyzing meal using Gemini Vision API...");
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
        analysis = getMockMealAnalysis();
        isMock = true;
      }
    } else {
      console.log("⚠️ Using mock vision analysis (no API key configured)");
      await new Promise((r) => setTimeout(r, 1500));
      analysis = getMockMealAnalysis();
      isMock = true;
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

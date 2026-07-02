import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini AI Service Client
 *
 * Principle: "Use software for certainty; use AI for uncertainty."
 * All math (calories remaining, BMI, volume) stays in deterministic code.
 * AI is reserved for interpretation, reasoning, and personalization.
 */

let _genAI: GoogleGenerativeAI | null = null;

/**
 * Get the Gemini model instance (lazy initialization).
 * Uses gemini-2.5-flash for speed and multimodal capabilities.
 */
function getModel() {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Set it in .env.local."
      );
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

/**
 * Sanitize Gemini output that may be wrapped in markdown code fences.
 */
function sanitizeJsonOutput(text: string): string {
  let cleaned = text.trim();
  // Strip ```json ... ``` or ``` ... ``` wrappers
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

/* ─────────────────────────────────────────────
 * Vision: Meal Analysis
 *
 * Takes a food photo and returns structured
 * nutrition estimates. Camera-first capture.
 * ───────────────────────────────────────────── */

export interface MealAnalysis {
  foods: {
    name: string;
    portionSize: "small" | "medium" | "large";
    estimatedCalories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }[];
  totalCalories: number;
  totalProteinG: number;
  confidence: number;
}

export async function analyzeMealImage(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<MealAnalysis> {
  const model = getModel();

  const prompt = `You are a nutrition analysis AI for an Indian college student's health app.
Analyze this food image and return a JSON object with:
- "foods": array of detected food items, each with "name", "portionSize" (small/medium/large), "estimatedCalories", "proteinG", "carbsG", "fatG"
- "totalCalories": sum of all calories
- "totalProteinG": sum of all protein
- "confidence": 0-1 confidence score

Be accurate with Indian foods (dal, roti, rice, sabzi, mess food, etc).
Return ONLY valid JSON, no markdown.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType,
      },
    },
  ]);

  const text = result.response.text();
  return JSON.parse(sanitizeJsonOutput(text)) as MealAnalysis;
}

/* ─────────────────────────────────────────────
 * Coach: Daily Recommendation
 *
 * Takes a context summary (not the entire DB)
 * and returns a personalized coaching insight.
 * ───────────────────────────────────────────── */

export interface CoachContext {
  profile: {
    name: string;
    goal: string;
    targetCalories: number;
    targetProteinG: number;
  };
  today: {
    caloriesConsumed: number;
    proteinConsumed: number;
    workoutCompleted: boolean;
    sleepHours: number | null;
    stepsCount: number | null;
  };
  weekTrend: {
    avgCalories: number;
    avgProtein: number;
    workoutsCompleted: number;
    avgSleep: number;
  };
  recentWeightKg: number | null;
}

export interface CoachRecommendation {
  greeting: string;
  status: "on_track" | "needs_attention" | "great_job";
  primaryInsight: string;
  actionItems: string[];
  motivation: string;
}

export async function generateDailyCoach(
  context: CoachContext
): Promise<CoachRecommendation> {
  const model = getModel();

  const prompt = `You are a personal health coach AI named "Health OS Coach".
Your personality: supportive, direct, no guilt-tripping, focused on the NEXT action.

User context (pre-calculated, do NOT recalculate):
${JSON.stringify(context, null, 2)}

Generate a daily coaching recommendation as JSON:
- "greeting": short personalized greeting (use their name)
- "status": "on_track" | "needs_attention" | "great_job"
- "primaryInsight": ONE key insight about today (e.g., "Your sleep was short — consider reducing workout intensity")
- "actionItems": array of 2-3 specific next actions
- "motivation": one encouraging sentence (no guilt, no shame)

Rules:
- Never guilt the user for missing workouts or eating badly
- If they return after days off, say "Welcome back. Let's focus on today."
- Every recommendation must explain WHY
- Return ONLY valid JSON, no markdown.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(sanitizeJsonOutput(text)) as CoachRecommendation;
}

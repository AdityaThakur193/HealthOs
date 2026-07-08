import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Gemini AI Service Client
 *
 * Principle: "Use software for certainty; use AI for uncertainty."
 * All math (calories remaining, BMI, volume) stays in deterministic code.
 * AI is reserved for interpretation, reasoning, and personalization.
 */

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Set it in .env.local."
      );
    }
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

/**
 * Vision model — supports multimodal (images + text).
 * Free tier: ~20 req/day. Enable billing in Google Cloud Console
 * to unlock 1,500 req/day at no charge within free limits.
 */
function getVisionModel() {
  return getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
}

/**
 * Text coach model — lightweight text generation.
 * Free tier: ~20 req/day. Enable billing to unlock higher quotas.
 */
function getCoachModel() {
  return getGenAI().getGenerativeModel({ model: "gemini-2.5-flash" });
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
  const model = getVisionModel();

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
  activeEvent?: {
    title: string;
    event_type: "exam" | "travel" | "sick";
    startDate: string;
    endDate: string;
  } | null;
  tdeeMode?: "adaptive" | "calibrating";
  daysRemaining?: number;
  avgCalories14d?: number;
  weightDeltaKg14d?: number;
  todayMessMenu?: {
    breakfast?: string;
    lunch?: string;
    snacks?: string;
    dinner?: string;
  } | null;
}

export interface CoachRecommendation {
  greeting: string;
  status: "on_track" | "needs_attention" | "great_job";
  primaryInsight: string;
  actionItems: string[];
  motivation: string;
}

async function generateDailyCoachWithGroq(
  context: CoachContext
): Promise<CoachRecommendation> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not defined");
  }

  const prompt = `You are a personal health coach AI named "Health OS Coach".
Your personality: supportive, direct, calm, no guilt-tripping, focused on the NEXT action.

User context (pre-calculated, do NOT recalculate):
${JSON.stringify(context, null, 2)}

Generate a daily coaching recommendation as JSON:
- "greeting": short personalized greeting (use their name)
- "status": "on_track" | "needs_attention" | "great_job"
- "primaryInsight": ONE key insight about today. 
  * If the user is in "adaptive" TDEE mode, explain that their targets are dynamically calculated based on their actual metabolism (e.g. mention if their maintenance has shifted and why, referencing their 14-day weight delta and calorie intake).
  * If in "calibrating" mode, encourage them to stay consistent with logs: "We are calibrating your metabolic engine. Need X more days of logs."
  * If an activeEvent (like exams, travel, or sickness) is present, adapt immediately: suggest active recovery or rest, explain that targets are lowered, and comfort them.
- "actionItems": array of 2-3 specific next actions. If activeEvent is present, keep actions simple (e.g. hydration, rest, gentle walks).
  * If todayMessMenu is present, include exactly ONE action item with a recommendation on what to eat or adjust based on today's mess menu to hit calorie/protein targets (e.g., "Add double curd to your dinner dal" or "Mess lunch is Rajma Chawal, add 3 boiled eggs for protein").
- "motivation": one encouraging sentence (no guilt, no shame)

Rules:
- Never guilt the user for missing workouts or eating badly.
- If todayMessMenu is present, actively reference its items in your nutritional feedback.
- If they have activeEvent, adapt targets downward (e.g. step count target is lower). Encourage them that health is a long term relationship.
- If they return after days off, say "Welcome back. Let's focus on today."
- Every recommendation must explain WHY, WHAT, and EXPECTED OUTCOME.
- Return ONLY valid JSON, no markdown.`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq Coach API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text = data.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from Groq Coach");
  }

  return JSON.parse(sanitizeJsonOutput(text)) as CoachRecommendation;
}

export async function generateDailyCoach(
  context: CoachContext
): Promise<CoachRecommendation> {
  const groqKey = process.env.GROQ_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (groqKey && groqKey !== "your_groq_api_key_here") {
    try {
      console.log("⚡ Generating daily coaching recommendation using Groq API...");
      return await generateDailyCoachWithGroq(context);
    } catch (groqError) {
      console.warn("⚠️ Groq Coach call failed, falling back to Gemini:", groqError);
    }
  }

  if (geminiKey && geminiKey !== "your_gemini_api_key_here") {
    console.log("⚡ Generating daily coaching recommendation using Gemini API...");
    const model = getCoachModel();

    const prompt = `You are a personal health coach AI named "Health OS Coach".
Your personality: supportive, direct, calm, no guilt-tripping, focused on the NEXT action.

User context (pre-calculated, do NOT recalculate):
${JSON.stringify(context, null, 2)}

Generate a daily coaching recommendation as JSON:
- "greeting": short personalized greeting (use their name)
- "status": "on_track" | "needs_attention" | "great_job"
- "primaryInsight": ONE key insight about today. 
  * If the user is in "adaptive" TDEE mode, explain that their targets are dynamically calculated based on their actual metabolism (e.g. mention if their maintenance has shifted and why, referencing their 14-day weight delta and calorie intake).
  * If in "calibrating" mode, encourage them to stay consistent with logs: "We are calibrating your metabolic engine. Need X more days of logs."
  * If an activeEvent (like exams, travel, or sickness) is present, adapt immediately: suggest active recovery or rest, explain that targets are lowered, and comfort them.
- "actionItems": array of 2-3 specific next actions. If activeEvent is present, keep actions simple (e.g. hydration, rest, gentle walks).
  * If todayMessMenu is present, include exactly ONE action item with a recommendation on what to eat or adjust based on today's mess menu to hit calorie/protein targets (e.g., "Add double curd to your dinner dal" or "Mess lunch is Rajma Chawal, add 3 boiled eggs for protein").
- "motivation": one encouraging sentence (no guilt, no shame)

Rules:
- Never guilt the user for missing workouts or eating badly.
- If todayMessMenu is present, actively reference its items in your nutritional feedback.
- If they have activeEvent, adapt targets downward (e.g. step count target is lower). Encourage them that health is a long term relationship.
- If they return after days off, say "Welcome back. Let's focus on today."
- Every recommendation must explain WHY, WHAT, and EXPECTED OUTCOME.
- Return ONLY valid JSON, no markdown.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(sanitizeJsonOutput(text)) as CoachRecommendation;
  }

  throw new Error("No configured API key found for coaching recommendations.");
}

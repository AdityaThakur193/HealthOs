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
  return getGenAI().getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.0, // Enforce zero-variance deterministic visual dish identification
    },
  });
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
export function sanitizeJsonOutput(text: string): string {
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

export interface FoodIngredient {
  name: string;
  estimatedGrams: number;
}

export interface DetectedFoodItem {
  name: string;
  dishName: string;
  preparationStyle?: string;
  visualCues?: string;
  quantity: number;
  unitType: "piece" | "katori" | "scoop" | "gram" | "plate";
  portionSize?: "small" | "medium" | "large";
  ingredients?: FoodIngredient[];
  estimatedCalories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  weightGrams?: number;
  unmatched?: boolean;
  partialMatch?: boolean;
  unmatchedIngredients?: string[];
  quantityClamped?: boolean;
}

export interface MealAnalysis {
  foods: DetectedFoodItem[];
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG?: number;
  totalFatG?: number;
  confidence: number;
  plateType?: string;
  notes?: string;
}

export async function analyzeMealImage(
  imageBase64: string,
  mimeType: string = "image/jpeg",
  learnedContext?: string
): Promise<MealAnalysis> {
  const model = getVisionModel();

  const prompt = `You are a world-class Indian Culinary Computer Vision Specialist.
Analyze this food image and return a JSON object with strict visual identification. Do NOT attempt raw calorie/protein math; focus on accurate visual dish identification, preparation style, standard unit counting, and ingredient decomposition.

IMPORTANT NEGATIVE CONSTRAINTS:
- If the image contains NO food (e.g. an empty plate, glass/bottle of plain water, a person, desk, gym equipment, or non-food objects), return "foods": [], "confidence": 0.0, "plateType": "single_dish", and describe what is visible in "notes".
- Do NOT guess or hallucinate food dishes if no edible food is clearly visible. Plain water and empty plates must NEVER be identified as food.

${learnedContext ? `LEARNED USER PLATE CONTEXT:\n${learnedContext}\n` : ""}

INGREDIENT DECOMPOSITION RULES:
- For each food item, provide an "ingredients" array decomposing the dish into its visible, finished plate components with "estimatedGrams".
- VISIBLE COOKED WEIGHT RULE: Always estimate the VISIBLE FINISHED COOKED WEIGHT of each component as it appears on the plate (e.g. ~150-220g for a serving of cooked rice, ~150g for a bowl of cooked dal, ~40g for a cooked roti, ~90g for a baked naan, ~100g for cooked chicken meat). Do NOT attempt to calculate dry raw grain weights or reverse hydration; the database pipeline handles culinary conversions deterministically.
- SCALE & REFERENCE-OBJECT ANCHORING RULES:
  Establish physical geometry and absolute portion mass using standard reference objects visible in food photography:
  1. Dipping Katoris / Ramekins: Standard stainless-steel katoris or sauce cups are 6-8 cm in diameter and hold ~50-60g of liquid/dip.
  2. Bone-in Chicken Quarter: A standard cooked leg quarter (thigh + drumstick) yields ~180-220g edible meat. Two visible quarters = ~360-440g edible meat.
  3. Garnishes: A single lemon wedge is ~15-20g; single sliced raw onion/cucumber rounds are ~5g each.
  4. Platter Scale Calibration:
     - If the plate diameter is ~3x the width of a katori (~25 cm / 10 in), it is an individual plate: cooked rice is ~200-300g.
     - If the platter diameter is >5x the width of a katori (e.g. ~45 cm / 18 in communal Mandi/Biryani thaal), it is a sharing platter: the cooked rice bed is typically ~800-1000g, NOT thousands of grams.
- COMPOSITE PLATTER SEGMENTATION RULE:
  For composite rice dishes served with cooked protein on top (e.g. Chicken Mandi, Chicken Biryani, Kabsa), ALWAYS group the seasoned rice bed, primary meat, cooking fat, and direct garnishes together into ONE unified primary food item (e.g. "Chicken Mandi" with ingredients: rice, chicken, cooking fat, fried onions, cashews). Do NOT splinter the rice bed and the meat into disconnected standalone dishes. Separate only distinct side items like dipping sauces, chutneys, and raw side salads into their own food entries.
- For simple single-ingredient items (e.g. "boiled egg", "plain rice", "banana"), provide a single ingredient entry matching the dish (e.g. [{ "name": "egg", "estimatedGrams": 50 }]).
- For composite dishes (curries, dals, sabzis, biryanis), decompose into primary protein/vegetable, cooking fat, and major gravies/aromatics (e.g. [{ "name": "mutton", "estimatedGrams": 150 }, { "name": "mustard oil", "estimatedGrams": 15 }, { "name": "onion", "estimatedGrams": 40 }, { "name": "tomato", "estimatedGrams": 30 }]).
- CRITICAL FAT RULE: Fried, sautéed, tadka, or curry preparations MUST include cooking oil, ghee, or butter as a separate ingredient line with realistic estimated grams (e.g. 10-15g for home curry, 5-10g for tadka/omelette, 15-20g for restaurant/deep-fried, 5-10g butter/ghee glazed on breads). Never omit cooking fat for cooked dishes.
- BREADS & GRAINS: Flatbreads and grains should list the base grain/flour (e.g. "atta" or "roti" for chapati, "maida" for naan, "basmati rice" for biryani/rice). Any visible glaze (ghee, butter) MUST be a separate ingredient line.
- GARNISHES: Dehydrated/fried toppings like crispy fried onions (birista) should be listed explicitly (e.g. [{ "name": "birista", "estimatedGrams": 10 }]).
- Use standard, specific ingredient names (e.g. "chicken", "mutton", "mustard oil", "ghee", "butter", "toor dal", "onion", "tomato", "paneer", "potato", "birista"). Do NOT use generic dish descriptors like "curry", "gravy", "sabzi", or "masala" as ingredient names.
- Do NOT calculate calories, protein, carbs, or fat. Output only visual identification, dish metadata, and ingredient gram estimates.

Return a JSON object matching this structure:
{
  "foods": [
    {
      "name": "string (e.g. Yellow Dal, Whole Wheat Roti, Cooked White Rice, Mutton Curry)",
      "dishName": "string (canonical name: roti | dal_toor | rice_cooked | curd | paneer_raw | egg_whole | etc)",
      "preparationStyle": "string (e.g. thin_mess | plain | ghee | thick_home | steamed | fried)",
      "visualCues": "string (e.g. watery yellow turmeric dal, 2 circular whole wheat flatbreads)",
      "quantity": number (e.g. 2 for rotis, 1 for katori dal),
      "unitType": "piece" | "katori" | "scoop" | "gram" | "plate",
      "portionSize": "small" | "medium" | "large",
      "ingredients": [
        {
          "name": "string (specific ingredient: e.g. mutton, mustard oil, onion, tomato)",
          "estimatedGrams": number (estimated weight in grams for this ingredient in the portion)
        }
      ]
    }
  ],
  "confidence": number (0.0 to 1.0),
  "plateType": "hostel_mess_thali" | "single_dish" | "snack_plate" | "home_thali",
  "notes": "string (brief visual observations)"
}

STRICT RULE: Return ONLY valid JSON, no markdown code fences.`;

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

export async function analyzeMealTextWithGroq(description: string): Promise<MealAnalysis> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your_groq_api_key_here") {
    throw new Error("GROQ_API_KEY is not configured for meal analysis fallback.");
  }

  const prompt = `You are an Indian Culinary Specialist AI.
Analyze this meal text description: "${description}"
Extract dish names, canonical dish IDs, quantities, unit types, and ingredient decompositions for ICMR-NIN IFCT 2017 macro calculation.

IMPORTANT: If the text describes only water, non-food items, fasting, or contains no edible food, return "foods": [], "confidence": 0.0, and explain in "notes". Do NOT guess food if none was described.

INGREDIENT DECOMPOSITION RULES:
- For each food item, provide an "ingredients" array decomposing the dish into its visible, finished plate components with "estimatedGrams".
- VISIBLE COOKED WEIGHT RULE: Always estimate the VISIBLE FINISHED COOKED WEIGHT of each component as it appears on the plate (e.g. ~150-220g for a serving of cooked rice, ~150g for a bowl of cooked dal, ~40g for a cooked roti, ~90g for a baked naan, ~100g for cooked chicken meat). Do NOT attempt to calculate dry raw grain weights or reverse hydration; the database pipeline handles culinary conversions deterministically.
- For simple single-ingredient items (e.g. "boiled egg", "plain rice", "banana"), provide a single ingredient entry matching the dish.
- For composite dishes (curries, dals, sabzis, biryanis), decompose into primary protein/vegetable, cooking fat, and major gravies/aromatics.
- CRITICAL FAT RULE: Fried, sautéed, tadka, or curry preparations MUST include cooking oil, ghee, or butter as a separate ingredient line with realistic estimated grams (e.g. 10-15g for home curry, 5-10g for tadka/omelette, 5-10g butter/ghee on breads). Never omit cooking fat for cooked dishes.
- BREADS & GRAINS: Flatbreads and grains should list the base grain/flour (e.g. "atta" or "roti" for chapati, "maida" for naan, "basmati rice" for biryani/rice). Any visible glaze (ghee, butter) MUST be a separate ingredient line.
- GARNISHES: Dehydrated/fried toppings like crispy fried onions (birista) should be listed explicitly (e.g. [{ "name": "birista", "estimatedGrams": 10 }]).
- Use standard, specific ingredient names (e.g. "chicken", "mutton", "mustard oil", "ghee", "butter", "toor dal", "onion", "tomato", "paneer", "birista"). Do NOT use generic dish descriptors like "curry", "gravy", "sabzi", or "masala" as ingredient names.
- Do NOT calculate calories, protein, carbs, or fat.

Return ONLY a JSON object matching:
{
  "foods": [
    {
      "name": "string (e.g. Boiled Egg, Roti, Dal Tadka, Chicken Curry, Curd, Mutton Curry)",
      "dishName": "string (canonical name: roti | dal_toor | rice_cooked | curd | paneer_raw | egg_whole | chicken_curry | soya | etc)",
      "preparationStyle": "string (e.g. thin_mess | plain | ghee | thick_home | steamed | fried)",
      "quantity": number (e.g. 4 for eggs, 2 for rotis, 1 for katori dal),
      "unitType": "piece" | "katori" | "scoop" | "gram" | "plate",
      "portionSize": "small" | "medium" | "large",
      "ingredients": [
        {
          "name": "string (specific ingredient: e.g. chicken, mustard oil, onion, tomato)",
          "estimatedGrams": number
        }
      ]
    }
  ],
  "confidence": 0.95,
  "plateType": "single_dish",
  "notes": "string"
}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq Meal Analysis error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rawText = data.choices[0]?.message?.content;
  if (!rawText) throw new Error("Empty response from Groq Meal Analysis");

  return JSON.parse(sanitizeJsonOutput(rawText)) as MealAnalysis;
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
    scheduledWorkoutName?: string;
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
- Encouraging Workout Reminders: If today.workoutCompleted is false and today.scheduledWorkoutName is not "Rest Day", include a friendly, encouraging nudge in your primaryInsight or actionItems to do their scheduled "${context.today.scheduledWorkoutName || 'workout'}" today. Remind them how this session helps them progress towards their goal, keeping the tone completely positive, zero guilt. If today.workoutCompleted is true, praise their dedication.
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
      model: "openai/gpt-oss-20b",
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
- Encouraging Workout Reminders: If today.workoutCompleted is false and today.scheduledWorkoutName is not "Rest Day", include a friendly, encouraging nudge in your primaryInsight or actionItems to do their scheduled "${context.today.scheduledWorkoutName || 'workout'}" today. Remind them how this session helps them progress towards their goal, keeping the tone completely positive, zero guilt. If today.workoutCompleted is true, praise their dedication.
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

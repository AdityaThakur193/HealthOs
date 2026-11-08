import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { LeanUserProfile, UserProfile, TimelineEvent } from "@/lib/db/models";
import { getLocalProfile, saveLocalProfile, getLocalEvents } from "@/lib/db/fallback";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateAdaptiveTdee, goalCalorieTarget, TimelineLike } from "@/lib/tdee";
import { calculateMealMacroAllocation, auditAndFixDietPlanMath, DietPlan, isCompleteDietPlan } from "@/lib/dietEngine";
import { sanitizeJsonOutput } from "@/lib/gemini";
import { requireUserSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import { readJsonObject } from "@/lib/validation";

export const dynamic = "force-dynamic";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenerativeAI(apiKey);
}

function additionsForPreference(dietPreference: string, targetProtein: number): string {
  const intro = `Since mess food is typically low in protein, you MUST suggest specific additions/supplements in the "additions" field to hit the daily target of ${targetProtein}g protein.
Guidelines for additions based on ICMR-NIN IFCT 2017 benchmarks and preference ("${dietPreference}"):`;

  const whey = "Whey protein powder (1 scoop 32g = 120 kcal, 24g protein)";
  const paneer = "Fresh Paneer (100g = 305 kcal, 18.9g protein)";
  const curd = "Plain Curd (150g = 90 kcal, 5.25g protein)";
  const chana = "Roasted Chana (100g = 360 kcal, 18g protein)";
  const whites = "Boiled Egg Whites (4 whites = 68 kcal, 16g protein)";
  const eggs = "Whole Boiled Eggs (2 eggs = 143 kcal, 13.2g protein)";
  const chicken = "Boiled Chicken Breast (100g = 150 kcal, 31g protein)";

  switch (dietPreference) {
    case "vegan":
      return `${intro}\n- Allowed additions: ${chana}, Soya Chunks (50g dry = 173 kcal, 26g protein), Tofu (100g = 76 kcal, 8g protein). Do NOT suggest whey, paneer, curd, milk, ghee, eggs, chicken, fish, or meat.`;
    case "vegetarian":
      return `${intro}\n- Allowed additions: ${whey}, ${paneer}, ${curd}, ${chana}. Do NOT suggest eggs, egg whites, chicken, fish, or meat.`;
    case "eggetarian":
      return `${intro}\n- Allowed additions: ${whites}, ${eggs}, ${whey}, ${paneer}, ${curd}. Do NOT suggest chicken, fish, or meat.`;
    default:
      return `${intro}\n- Allowed additions: ${chicken}, ${whites}, ${eggs}, ${whey}, ${paneer}, ${curd}.`;
  }
}

export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  if (!checkRateLimit(`diet:${session.userId}`, 8, 60 * 60 * 1000)) {
    return rateLimitedResponse();
  }

  try {
    const body = (await readJsonObject(request)) ?? {};
    const { email } = session;

    let profile: LeanUserProfile | null = null;
    let events: TimelineLike[] = [];

    try {
      await connectDB();
      profile = await UserProfile.findOne({ email }).lean<LeanUserProfile>();
      if (profile) {
        events = await TimelineEvent.find({ userId: profile._id }).lean();
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV === "production") throw dbErr;
      console.warn("MongoDB offline during diet generation. Using local fallback file DB.");
      profile = (await getLocalProfile(email)) as unknown as LeanUserProfile | null;
      if (profile) {
        events = await getLocalEvents({ userId: String(profile._id) });
      }
    }

    if (!profile) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    if (!profile.messMenu || !profile.messMenu.parsedMenu) {
      return Response.json({ error: "Please configure and parse your Mess Menu in profile settings first." }, { status: 400 });
    }

    // 1. DYNAMICALLY CALCULATE DYNAMIC ADAPTIVE TDEE & CALORIES
    const tdeeResult = calculateAdaptiveTdee(profile, events, session.tz);
    
    let calculatedTdee = profile.tdee || 2400;
    let targetCalories = profile.targetCalories || 2000;
    let targetProtein = profile.targetProteinG || 150;

    let isAdaptiveActive = false;
    if (tdeeResult.status === "adaptive") {
      calculatedTdee = tdeeResult.calculatedTdee;
      isAdaptiveActive = true;
      if (!profile.useCustomMacros) {
        targetCalories = goalCalorieTarget(calculatedTdee, profile.goal, profile.gender);
      }
    }

    // Apply custom calorie/protein target overrides if requested
    if (profile.useCustomMacros) {
      if (profile.customCalories && profile.customCalories > 0) {
        targetCalories = profile.customCalories;
      }
      if (profile.customProtein && profile.customProtein > 0) {
        targetProtein = profile.customProtein;
      }
    }

    const mealAllocations = calculateMealMacroAllocation(targetCalories, targetProtein);

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    });

    const name = profile.name || "User";
    const age = profile.age || 22;
    const height = profile.heightCm || 175;
    const weight = profile.weightKg || 75;
    const goal = profile.goal || "recomp";
    const dietPreference = profile.dietPreference || "none";
    const strictMessOnly = typeof body.strictMessOnly === "boolean" ? body.strictMessOnly : (profile.strictMessOnly || false);
    const collegeSchedule = profile.collegeSchedule || "8 AM - 4 PM";
    const sleepTarget = profile.sleepTarget || 8;

    let additionsGuideline = "";
    if (strictMessOnly) {
      additionsGuideline = `CRITICAL CONSTRAINT (Strict Mess Only Mode): The user is on a strict budget and CAN ONLY eat food provided by the hostel mess. You MUST NOT suggest any external additions, purchases, or supplements. Set "additions" to "None (Strict Mess Only)" for all meals. 
      Prioritize and suggest the highest protein options available directly from the mess menu items served that day.
      
      REALISTIC ICMR-NIN IFCT 2017 MACROS ONLY (DO NOT HALLUCINATE):
      - In Strict Mess Only mode, it is physically impossible to meet high protein targets (like 150g+) using only typical carb-heavy hostel mess foods (roti, rice, sabzi, thin dal).
      - You MUST estimate the true, realistic protein and calories of the mess food based on ICMR-NIN IFCT 2017 standards:
        * 1 Katori (150g) typical thin Mess Dal = 105 kcal, 5.2g protein (NOT 15g or 20g!)
        * 1 Medium Roti = 85 kcal, 3.2g protein
        * 1 Katori (150g) cooked Rice = 175 kcal, 3.4g protein
        * 1 Katori (150g) Curd = 90 kcal, 5.25g protein
        * 2 Onion Utapams = 320 kcal, 8g protein
      - If the daily protein total under strict mess constraints is only 50g-70g, that is perfectly fine. DO NOT inflate or hallucinate the protein of mess food to meet the ${targetProtein}g target!`;
    } else {
      additionsGuideline = additionsForPreference(dietPreference, targetProtein);
    }

    const prompt = `You are an elite sports dietitian and bodybuilding nutrition coach. Your goal is to design a highly personalized week-long diet plan (Monday to Sunday) mapping out meal timings, mess food choices, necessary additions, and carbohydrate-fat distribution, optimized for the user's specific biometrics and schedule.

User Context:
- Name: ${name}
- Biometrics: ${age} years old, ${height}cm height, ${weight}kg weight.
- Goals: Goal is "${goal}". Daily targets are ${targetCalories} kcal and ${targetProtein}g of protein.
- Calorie Source: ${isAdaptiveActive ? `Empirically determined Adaptive TDEE: ${calculatedTdee} kcal.` : "Static biometrics calculation."}
- Schedule: College classes are ${collegeSchedule}. Sleep target is ${sleepTarget} hours.
- Diet preference: ${dietPreference}.
- Food allergies (HARD CONSTRAINT, never include these or dishes containing them, even if the mess serves them): ${profile.foodAllergies?.length ? profile.foodAllergies.join(", ") : "None"}.
- Medical conditions (adapt food choices accordingly): ${profile.medicalConditions?.length ? profile.medicalConditions.join(", ") : "None"}.
- Other preferences from the user: ${profile.customDietPreferences || "None"}.
- Strict Mess/Budget Mode: ${strictMessOnly ? "ACTIVE (Strictly Mess Items Only, NO additions)" : "INACTIVE (Allows additions/whey/eggs)"}

Pre-Calculated Target Allocations per Meal:
${JSON.stringify(mealAllocations, null, 2)}

Active Hostel Mess Menu:
${JSON.stringify(profile.messMenu.parsedMenu, null, 2)}

You MUST design the weekly diet plan following these strict scientific principles:
1. ${additionsGuideline}
2. Itemized Macro Parentheses Contract:
   - In both "messItems" and "additions" fields, list exact weights and macro contributions in parentheses for EACH food item: e.g., "• Yellow Dal (1 Katori 150g - 5.2g P, 105 kcal)\n• Whole Wheat Roti (2 pieces - 6.4g P, 170 kcal)".
   - The meal's total "proteinG" and "calories" fields MUST equal the exact sum of these individual item breakdowns.

Return a JSON object matching this exact structure:
{
  "dietPlan": {
    "monday": {
      "meals": [
        { "time": "8:00 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    },
    "tuesday": { "meals": [...] },
    "wednesday": { "meals": [...] },
    "thursday": { "meals": [...] },
    "friday": { "meals": [...] },
    "saturday": { "meals": [...] },
    "sunday": { "meals": [...] }
  }
}

Return ONLY valid JSON.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const sanitized = sanitizeJsonOutput(responseText);
    const parsed = JSON.parse(sanitized);

    // Programmatic Math Audit to eliminate LLM arithmetic hallucinations
    const rawPlan: DietPlan = parsed.dietPlan || parsed;
    if (!isCompleteDietPlan(rawPlan)) {
      return Response.json({ error: "The AI returned an incomplete plan. Please try again." }, { status: 502 });
    }
    const auditedPlan = auditAndFixDietPlanMath(rawPlan);

    const dietPlanData = {
      generatedPlan: auditedPlan,
      generatedAt: new Date().toISOString(),
    };

    // Save generated diet plan to user profile
    let savedProfile: unknown = null;
    try {
      await connectDB();
      savedProfile = await UserProfile.findOneAndUpdate(
        { email },
        { dietPlan: dietPlanData },
        { new: true }
      );
    } catch (dbErr) {
      if (process.env.NODE_ENV === "production") throw dbErr;
      const currentLocal = await getLocalProfile(email);
      if (currentLocal) {
        currentLocal.dietPlan = dietPlanData;
        savedProfile = await saveLocalProfile(currentLocal);
      }
    }

    return Response.json({ success: true, dietPlan: dietPlanData.generatedPlan, savedProfile });
  } catch (err) {
    console.error("AI Diet Plan Generation error:", err);
    return Response.json({ error: "Failed to generate AI Diet Plan" }, { status: 500 });
  }
}

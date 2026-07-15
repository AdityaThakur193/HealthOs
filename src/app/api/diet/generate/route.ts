import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfile, TimelineEvent } from "@/lib/db/models";
import { getLocalProfile, saveLocalProfile, getLocalEvents } from "@/lib/db/fallback";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { calculateAdaptiveTdee } from "@/lib/tdee";

export const dynamic = "force-dynamic";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenerativeAI(apiKey);
}

function sanitizeJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return Response.json({ error: "Email is required to locate user profile." }, { status: 400 });
    }

    let profile: any = null;
    let events: any[] = [];

    try {
      await connectDB();
      profile = await UserProfile.findOne({ email }).lean();
      if (profile) {
        events = await TimelineEvent.find({ userId: profile._id }).lean();
      }
    } catch (dbErr) {
      console.warn("⚠️ MongoDB offline during diet generation. Using local fallback file DB.");
      profile = await getLocalProfile(email);
      if (profile) {
        events = await getLocalEvents({ userId: profile._id.toString() });
      }
    }

    if (!profile) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    if (!profile.messMenu || !profile.messMenu.parsedMenu) {
      return Response.json({ error: "Please configure and parse your Mess Menu in profile settings first." }, { status: 400 });
    }

    // 1. DYNAMICALLY CALCULATE DYNAMIC ADAPTIVE TDEE & CALORIES
    const tdeeResult = calculateAdaptiveTdee(profile, events);
    
    let calculatedTdee = profile.tdee || 2400;
    let targetCalories = profile.targetCalories || 2000;
    let targetProtein = profile.targetProteinG || 150;

    let isAdaptiveActive = false;
    if (tdeeResult.status === "adaptive") {
      calculatedTdee = tdeeResult.calculatedTdee;
      isAdaptiveActive = true;
      if (!profile.useCustomMacros) {
        let newTargetCalories = calculatedTdee;
        if (profile.goal === "lose_fat") {
          newTargetCalories -= 500;
        } else if (profile.goal === "build_muscle") {
          newTargetCalories += 300;
        } else if (profile.goal === "recomp") {
          newTargetCalories -= 100;
        }
        targetCalories = Math.round(newTargetCalories);
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

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.85,
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
      
      REALISTIC MACROS ONLY (DO NOT HALLUCINATE):
      - In Strict Mess Only mode, it is physically impossible to meet high protein targets (like 150g+) using only typical carb-heavy hostel mess foods (roti, rice, sabzi, thin dal).
      - You MUST estimate the true, realistic protein and calories of the mess food:
        * 1 cup typical thin Mess Dal = 4g to 5g protein (NOT 15g or 20g)
        * 1 Roti = 2.5g protein
        * 1 cup cooked Rice = 3.5g protein
        * 200g Curd = 6g protein
        * Onion Utapam (2 large) = 8g protein (NOT 40g or 50g)
        * Ghugni Masala / Chole = 8g protein
        * Banana Milkshake (1 glass) = 8g protein
      - If the daily protein total under strict mess constraints is only 50g-70g, that is perfectly fine. DO NOT inflate or hallucinate the protein of mess food to meet the ${targetProtein}g target! Under this mode, accuracy of food metrics takes absolute priority over hitting the target. If the targets cannot be met, accept the deficit and explain it in the "timingReason" field.`;
    } else {
      additionsGuideline = `Since mess food is typically low in protein, you MUST suggest specific additions/supplements in the "additions" field to hit the daily target of ${targetProtein}g protein.
Guidelines for additions based on diet preference ("${dietPreference}"):
- veg / vegetarian: Add ONLY vegetarian items. Allowed additions: Whey protein powder (e.g. 1 scoop = 24g protein, 120 kcal), Paneer (e.g. 100g = 18g protein, 300 kcal), Greek Yogurt / Curd (e.g. 200g = 8g protein, 120 kcal), Soya chunks, Tofu, Milk, Roasted Chana. Do NOT suggest eggs, egg whites, chicken, fish, or meat.
- eggitarian: Allowed additions: Eggs (e.g. 1 whole egg = 6g protein, 70 kcal), Egg whites (e.g. 4 whites = 16g protein, 68 kcal), and all Vegetarian items listed above. Do NOT suggest chicken, fish, or meat.
- non_veg / non_vegetarian / none: Allowed additions: Chicken breast (e.g. 100g boiled = 30g protein, 150 kcal), Eggs, Egg whites, and all Vegetarian items.
Make additions realistic, specific, and easy for a college student to purchase and consume in a hostel room.`;
    }

    const prompt = `You are an elite sports dietitian and bodybuilding nutrition coach. Your goal is to design a highly personalized week-long diet plan (Monday to Sunday) mapping out meal timings, mess food choices, necessary additions, and carbohydrate-fat distribution, optimized for the user's specific biometrics and schedule.

User Context:
- Name: ${name}
- Biometrics: ${age} years old, ${height}cm height, ${weight}kg weight.
- Goals: Goal is "${goal}". Daily targets are ${targetCalories} kcal and ${targetProtein}g of protein.
- Calorie Source: ${isAdaptiveActive ? `Empirically determined Adaptive TDEE: ${calculatedTdee} kcal.` : "Static biometrics calculation."}
- Schedule: College classes are ${collegeSchedule}. Sleep target is ${sleepTarget} hours.
- Diet preference: ${dietPreference}.
- Strict Mess/Budget Mode: ${strictMessOnly ? "ACTIVE (Strictly Mess Items Only, NO additions)" : "INACTIVE (Allows additions/whey/eggs)"}

Active Hostel Mess Menu:
${JSON.stringify(profile.messMenu.parsedMenu, null, 2)}

You MUST design the weekly diet plan following these strict scientific principles:
1. Protein Spacing: Space total protein (${targetProtein}g) across 4 to 5 meals per day (target ~${Math.round(targetProtein / 4.5)}g per meal) to maximize Muscle Protein Synthesis (MPS) and trigger the leucine threshold.
2. Carbohydrate Positioning (Peri-workout): Position complex carbohydrates 2-3 hours pre-workout to load glycogen. Position simple, fast-acting carbohydrates 30-60 minutes pre-workout for instant performance energy. Position high-glycemic carbohydrates post-workout to accelerate recovery.
3. Fat Digestion Timing: Minimize fat intake in the peri-workout window (2 hours before to 2 hours after training) to avoid slowing down digestion. Consolidate healthy fats in breakfast and pre-sleep meals.
4. College Schedule Integration: Align meal timings with the user's college schedule (${collegeSchedule}). Schedule a quick lunch at 1:00 PM and a pre-workout meal right after classes.
5. Mess Menu & Budget Adaptations: Look at what is served in the mess for each meal of each day. Suggest EXACTLY what to eat from the mess.
6. ${additionsGuideline}
7. Mutually Exclusive Mess Options (Single Selection Rule):
   - On Wednesday, Friday, and Sunday: The mess menu serves both Veg and Non-Veg choices for certain meals. You MUST strictly select exactly ONE option (either the vegetarian option OR the non-vegetarian option, never both) for a meal, and calculate the calories/protein based only on that selected option.
   - On Monday: The mess menu serves Eggs and Veg options. You MUST strictly select exactly ONE option (either the egg choice OR the veg choice, never both) for a meal.
8. Hostel Mess Timings Constraint: The hostel mess operates strictly on this schedule:
   - Breakfast: 7:30 AM - 9:00 AM (e.g. schedule breakfast at 8:00 AM)
   - Lunch: 11:30 AM - 2:00 PM (e.g. schedule lunch at 1:00 PM)
   - Snacks: 4:30 PM - 6:00 PM (e.g. schedule snacks at 5:00 PM)
   - Dinner: 7:30 PM - 9:30 PM (e.g. schedule dinner at 8:15 PM)
   You MUST design all meal times in the plan to fall strictly within these specific time windows when using mess menu items.
9. Specific Weights & Quantities (NO VAGUE PORTIONS):
   - You MUST NOT use vague adjectives like "large serving", "generous portion", "very large bowl", "minimal gravy", "focus on X".
   - You MUST specify exact weights in grams (e.g. "150g cooked soya chunks", "150g chicken breast", "200g plain curd") or precise quantities (e.g. "2 Rotis (approx 100g total)", "250ml Milk").
   - In both the "messItems" and "additions" fields, you must list the exact estimated weight/volume and macro contribution in parentheses for EACH food item. For example: "Onion Utapam (2 pieces, approx 160g total - 8g P, 320 kcal), Plain Curd (200g - 6g P, 120 kcal)".

CRITICAL MATHEMATICAL ENFORCEMENT:
- Every single food item suggested in the "messItems" and "additions" fields MUST list its estimated weight/quantity, estimated protein in grams, and calories in parentheses. For example: "Plain Curd (200g - 6g P, 120 kcal)". The meal's total "proteinG" and "calories" fields MUST equal the exact sum of these individual item breakdowns.
- If Strict Mess Only Mode is INACTIVE: The daily SUM of "calories" across all meals MUST EQUAL the target of ${targetCalories} kcal (+/- 50 kcal), and the daily SUM of "proteinG" across all meals MUST EQUAL the target of ${targetProtein}g (+/- 5g).
- If Strict Mess Only Mode is ACTIVE: The daily SUM does NOT need to hit the targets if the mess menu cannot support it. In this case, you MUST prioritize realistic macro estimations. Do NOT inflate the protein of mess foods. Simply sum the real values of the mess items, even if the total is far below the targets.
- Make sure the individual meal calorie and protein estimates are realistic:
  - 1 scoop Whey Protein = 120 kcal, 24g Protein
  - 4 Egg Whites = 68 kcal, 16g Protein
  - 100g Paneer = 300 kcal, 18g Protein
  - 200g Curd = 120 kcal, 8g Protein
  - 1 Roti = 80-100 kcal, 2-3g Protein
  - 1 cup cooked Rice = 200 kcal, 4g Protein
  - 1 cup Dal = 150 kcal, 7g Protein
  - Ensure the sums add up correctly. Do not output arbitrary numbers.

Return a JSON object matching this exact structure:
{
  "dietPlan": {
    "monday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string (what to eat from the mess)", "additions": "string (additions like whey, eggs, curd, or paneer to meet protein/calories)", "proteinG": number, "calories": number, "timingReason": "string (scientific reason for timing, macro spacing, or peri-workout carbohydrate positioning)" }
      ]
    },
    "tuesday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    },
    "wednesday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    },
    "thursday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    },
    "friday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    },
    "saturday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    },
    "sunday": {
      "meals": [
        { "time": "7:15 AM", "name": "Breakfast", "messItems": "string", "additions": "string", "proteinG": number, "calories": number, "timingReason": "string" }
      ]
    }
  }
}

Do not add any text before or after the JSON response. Return ONLY valid JSON.`;

    console.log(`🥗 Generating custom sports-diet plan for ${email} using Gemini...`);
    console.log(`⚡ Dynamic Targets: Calories=${targetCalories} kcal, Protein=${targetProtein}g (Adaptive TDEE active: ${isAdaptiveActive})`);
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    const sanitized = sanitizeJsonOutput(responseText);
    const parsed = JSON.parse(sanitized);

    const dietPlanData = {
      generatedPlan: parsed.dietPlan || parsed,
      generatedAt: new Date().toISOString(),
    };

    // Save generated diet plan to user profile
    let savedProfile: any = null;
    try {
      await connectDB();
      savedProfile = await UserProfile.findOneAndUpdate(
        { email },
        { dietPlan: dietPlanData },
        { new: true }
      );
    } catch (dbErr) {
      console.warn("⚠️ MongoDB offline during saving diet plan. Saving to local fallback.");
      const currentLocal = await getLocalProfile(email);
      if (currentLocal) {
        currentLocal.dietPlan = dietPlanData;
        savedProfile = await saveLocalProfile(currentLocal);
      }
    }

    return Response.json({ success: true, dietPlan: dietPlanData.generatedPlan, savedProfile });
  } catch (err: any) {
    console.error("AI Diet Plan Generation error:", err);
    return Response.json({ error: err.message || "Failed to generate AI Diet Plan" }, { status: 500 });
  }
}

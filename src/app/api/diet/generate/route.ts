import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { UserProfile } from "@/lib/db/models";
import { getLocalProfile, saveLocalProfile } from "@/lib/db/fallback";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    try {
      await connectDB();
      profile = await UserProfile.findOne({ email }).lean();
    } catch (dbErr) {
      console.warn("⚠️ MongoDB offline during diet generation. Using local fallback file DB.");
      profile = await getLocalProfile(email);
    }

    if (!profile) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    if (!profile.messMenu || !profile.messMenu.parsedMenu) {
      return Response.json({ error: "Please configure and parse your Mess Menu in profile settings first." }, { status: 400 });
    }

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Read user properties or use defaults
    const name = profile.name || "User";
    const age = profile.age || 22;
    const height = profile.heightCm || 175;
    const weight = profile.weightKg || 75;
    const goal = profile.goal || "recomp";
    const targetCalories = profile.targetCalories || 2000;
    const targetProtein = profile.targetProteinG || 150;
    const collegeSchedule = profile.collegeSchedule || "8 AM - 4 PM";
    const sleepTarget = profile.sleepTarget || 8;
    const dietPreference = profile.dietPreference || "none";

    const strictMessOnly = profile.strictMessOnly || false;

    let budgetGuideline = "";
    if (strictMessOnly) {
      budgetGuideline = `CRITICAL BUDGET CONSTRAINT (Strict Mess Only Mode): The user is on a strict budget and CAN ONLY eat food provided by their hostel mess menu. You MUST NOT suggest any external additions, purchases, or supplements (e.g., NO whey protein powder, NO eggs bought outside, NO store-bought curd or paneer). Set "additions" to "None (Strict Mess Only Mode)" for all meals. Prioritize and suggest the highest protein options available directly from the mess menu items served that day. If they cannot meet the protein goal due to low protein in the mess, accept this restriction and maximize what they can get from the mess without forcing external purchases.`;
    } else {
      budgetGuideline = `Since mess food is typically low in protein, suggest specific supplements or additions (e.g., scoop of whey, egg whites, paneer, double curd) and exact quantities to hit the protein target for that meal.`;
    }

    const prompt = `You are an elite sports dietitian and bodybuilding nutrition coach. Your goal is to design a highly personalized week-long diet plan (Monday to Sunday) mapping out meal timings, mess food choices, necessary additions, and carbohydrate-fat distribution, optimized for the user's specific biometrics and schedule.

User Context:
- Name: ${name}
- Biometrics: ${age} years old, ${height}cm height, ${weight}kg weight.
- Goals: Goal is "${goal}". Daily targets are ${targetCalories} kcal and ${targetProtein}g of protein.
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
   ${budgetGuideline}

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

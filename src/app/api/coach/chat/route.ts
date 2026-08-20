import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeJsonOutput } from "@/lib/gemini";
import { getWeekSchedule } from "@/lib/workoutPlans";

export const dynamic = "force-dynamic";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenerativeAI(apiKey);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, message, history, profile } = body;

    if (!email || !message) {
      return Response.json({ error: "Email and message are required." }, { status: 400 });
    }

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const name = profile?.name || "User";
    const age = profile?.age || 22;
    const height = profile?.heightCm || 175;
    const weight = profile?.weightKg || 75;
    const targetCalories = profile?.targetCalories || 2000;
    const targetProtein = profile?.targetProteinG || 150;
    const collegeSchedule = profile?.collegeSchedule || "8 AM - 4 PM";
    const goal = profile?.goal || "recomp";
    const strictMessOnly = profile?.strictMessOnly || false;
    const activeDietPlan = profile?.dietPlan?.generatedPlan || null;
    const activeMessMenu = profile?.messMenu?.parsedMenu || null;
    const gymFrequency = profile?.gymFrequency || 4;
    const gymExperience = profile?.gymExperience || "intermediate";
    const workoutSchedule = getWeekSchedule(gymFrequency);

    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayName = days[new Date().getDay()];
    
    // Extract today's plan & mess menu
    const todayDiet = activeDietPlan ? activeDietPlan[todayName] : null;
    const todayMess = activeMessMenu ? activeMessMenu[todayName] : null;

    // Create ultra-compact weekly summary
    let weeklySummaryStr = "";
    if (activeDietPlan) {
      weeklySummaryStr = Object.keys(activeDietPlan).map(day => {
        const d = activeDietPlan[day];
        const mealsSummary = (d?.meals || []).map((m: any) => m.name + ": " + (m.messItems || "").split("\n")[0].replace("• ", "")).join(" | ");
        return `${day.toUpperCase()}: ${mealsSummary}`;
      }).join("\n");
    }

    const systemPrompt = `You are the Health OS Personal AI Coach — a fully autonomous health data agent with COMPLETE control over the user's health app. You can read and write all health data: meals, steps, water, sleep, weight, and workout logs. You are not just a conversational assistant — you are an ACTION-FIRST agent. Whenever the user mentions any health data, you MUST capture it and write it to the database immediately.

User Profile:
- Name: ${name} | Age: ${age} | Height: ${height}cm | Weight: ${weight}kg
- Goal: "${goal}" | Daily Targets: ${targetCalories} kcal, ${targetProtein}g protein
- Schedule: ${collegeSchedule} | Strict Mess Mode: ${strictMessOnly ? "ACTIVE" : "INACTIVE"}
- Gym: ${gymFrequency} days/week (${gymExperience}) | Split: ${JSON.stringify(workoutSchedule)}
- Today (${todayName}): Mess: ${todayMess ? JSON.stringify(todayMess) : "N/A"} | Plan: ${todayDiet ? JSON.stringify(todayDiet) : "N/A"}
- Full Weekly Diet Overview:
${weeklySummaryStr || "Standard 2200 kcal High Protein Mess Plan"}

════════════════════════════════════════════
FULL DATA CONTROL — ACTIONS YOU CAN TAKE
════════════════════════════════════════════

You have 10 possible actions. Choose the correct one based on what the user says:

1. log_meal — User mentions food they ate (any meal, snack, drink with calories)
   updatedData: {
     mealType: "breakfast"|"lunch"|"dinner"|"snack",
     items: [{ name, portionSize: "small"|"medium"|"large", estimatedCalories, proteinG, carbsG, fatG }],
     totalCalories: number,
     totalProtein: number,
     totalCarbs: number,
     totalFat: number,
     notes: string
   }

2. log_steps — User mentions step count, walking distance, or steps walked today
   updatedData: {
     steps: number,
     distanceKm: number (estimate: steps × 0.00075),
     caloriesBurned: number (estimate: steps × 0.04),
     notes: string
   }

3. log_water — User mentions water intake, glasses drunk, hydration
   updatedData: {
     amountMl: number (1 glass = 250ml, 1 bottle = 750ml),
     glasses: number,
     notes: string
   }

4. log_sleep — User mentions sleep hours, bedtime, wake time, sleep quality
   updatedData: {
     hours: number,
     quality: number (1-10, infer from description: "deep/great" = 8-9, "okay" = 6, "bad/restless" = 3-4),
     bedtime: string (e.g. "11:30 PM"),
     wakeTime: string (e.g. "7:00 AM"),
     notes: string
   }

5. log_weight — User mentions their current weight or a weight measurement
   updatedData: {
     weightKg: number,
     notes: string
   }

6. log_workout_done — User says they completed a workout, gym session, or exercise
   updatedData: {
     workoutName: string,
     durationMin: number,
     musclesWorked: string[],
     exercisesCompleted: [{ name, sets, reps }],
     caloriesBurned: number (estimate based on duration),
     notes: string
   }

7. update_diet — User asks to modify their weekly diet plan
   updatedData: full updated dietPlan generatedPlan JSON

8. update_workout — User asks to modify their workout split / gym frequency (e.g., "change to a 5 days split", "shift to 3 days split", "update split to 6 days")
   updatedData: { gymFrequency: number (value must be 3, 4, 5, or 6) }

9. log_habit — User asks to mark a habit as done or log habit progress (e.g., "mark pray 5 times as done", "completed 5 leetcode problems", "check off no junk food")
   updatedData: { habitTitle: string, completed: boolean, value?: number }

10. none — Pure question, general health advice, no data to save
    updatedData: null

════════════════════════════════════════════
FORMATTING RULES
════════════════════════════════════════════
- Be concise and action-first. Confirm what you did, then add useful insight.
- Use **bold** for emphasis, ### for sections, * for bullet points.
- Use emojis: 🥣 🏋️ 💧 👟 😴 ⚖️ ✅ ⚡ ✨
- Stay strictly within health/fitness topics.
- For log actions: always confirm exactly what was saved with the numbers.

════════════════════════════════════════════
RESPONSE FORMAT — RETURN ONLY VALID JSON
════════════════════════════════════════════
{
  "message": "string — your reply to the user",
  "action": "log_meal"|"log_steps"|"log_water"|"log_sleep"|"log_weight"|"log_workout_done"|"update_diet"|"update_workout"|"log_habit"|"none",
  "updatedData": {} or null
}

CRITICAL: Return ONLY the JSON object. No text before or after. No markdown wrapping.`;

    const recentHistory = (history || []).slice(-6);
    const formattedHistory = recentHistory.map((msg: any) => {
      return `${msg.role === "user" ? "User" : "Coach"}: ${msg.content}`;
    }).join("\n");

    const fullPrompt = `${systemPrompt}\n\nChat History:\n${formattedHistory}\n\nUser: ${message}\n\nCoach:`;

    const groqApiKey = process.env.GROQ_API_KEY;
    let responseText = "";

    try {
      console.log(`💬 Chatbot processing message from ${email} using Gemini...`);
      const result = await model.generateContent(fullPrompt);
      responseText = result.response.text();
    } catch (geminiError) {
      console.warn("⚠️ Gemini chatbot request failed, attempting Groq fallback:", geminiError);

      if (groqApiKey && groqApiKey !== "your_groq_api_key_here") {
        const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${groqApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-oss-20b",
            messages: [{ role: "user", content: fullPrompt }],
            response_format: { type: "json_object" },
            temperature: 0.7,
          }),
        });

        if (groqRes.ok) {
          const groqData = await groqRes.json();
          responseText = groqData.choices[0]?.message?.content || "";
          console.log("✅ Successfully fell back to Groq for chatbot response.");
        } else {
          const errText = await groqRes.text();
          throw new Error(`Groq fallback failed (${groqRes.status}): ${errText}`);
        }
      } else {
        throw geminiError;
      }
    }

    const sanitized = sanitizeJsonOutput(responseText);
    const parsed = JSON.parse(sanitized);
    return Response.json(parsed);
  } catch (err: any) {
    console.error("AI Coach Chatbot error:", err);
    return Response.json({ error: err.message || "Failed to process chat message" }, { status: 500 });
  }
}

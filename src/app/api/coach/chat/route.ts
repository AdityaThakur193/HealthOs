import { NextRequest } from "next/server";
import { sanitizeJsonOutput } from "@/lib/gemini";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getWeekSchedule } from "@/lib/workoutPlans";
import { buildCoachContext } from "@/lib/coachContext";
import { CoachSnapshot, loadCoachSnapshot } from "@/lib/coachData";
import { normalizeCoachReply } from "@/lib/coachRules";
import { requireUserSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import { weekdayIndex } from "@/lib/dateUtils";
import { invalidBodyResponse, MAX_CHAT_MESSAGE_CHARS, readJsonObject } from "@/lib/validation";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const CHAT_MESSAGES_PER_HOUR = 60;

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

interface ChatTurn {
  role?: unknown;
  content?: unknown;
}

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
  return new GoogleGenerativeAI(apiKey);
}

function formatHistory(history: unknown): string {
  if (!Array.isArray(history)) return "";
  return (history as ChatTurn[])
    .slice(-6)
    .filter((turn) => typeof turn?.content === "string")
    .map((turn) => `${turn.role === "user" ? "User" : "Coach"}: ${(turn.content as string).slice(0, MAX_CHAT_MESSAGE_CHARS)}`)
    .join("\n");
}

function remainingPlanMeals(meals: { name: string }[] | undefined, closed: string[]) {
  return (meals || []).filter((meal) => !closed.some((name) => meal.name.toLowerCase().includes(name)));
}

function buildSystemPrompt(snapshot: CoachSnapshot, tz?: string): string {
  const { profile, habits } = snapshot;
  const context = buildCoachContext({ ...snapshot, tz });
  const todayName = DAYS[weekdayIndex(new Date(), tz)];
  const closedMeals = (context.mealTiming?.meals || [])
    .filter((meal) => meal.state === "closed")
    .map((meal) => meal.meal.replace(/s$/, ""));
  const dietPlan = profile.dietPlan?.generatedPlan as Record<string, { meals?: { name: string; messItems?: string }[] }> | undefined;
  const gymFrequency = profile.gymFrequency || 4;

  const weeklySummary = dietPlan
    ? Object.keys(dietPlan)
        .map((day) => {
          const meals = (dietPlan[day]?.meals || [])
            .map((meal) => `${meal.name}: ${(meal.messItems || "").split("\n")[0].replace("• ", "")}`)
            .join(" | ");
          return `${day.toUpperCase()}: ${meals}`;
        })
        .join("\n")
    : "";

  const allergies = profile.foodAllergies?.length ? profile.foodAllergies.join(", ") : "None";
  const conditions = profile.medicalConditions?.length ? profile.medicalConditions.join(", ") : "None";

  return `You are the Health OS Personal AI Coach — a fully autonomous health data agent with COMPLETE control over the user's health app. You can read and write all health data: meals, steps, water, sleep, weight, and workout logs. You are not just a conversational assistant — you are an ACTION-FIRST agent. Whenever the user mentions any health data, you MUST capture it and write it to the database immediately.

User Profile:
- Name: ${profile.name} | Age: ${profile.age} | Height: ${profile.heightCm}cm | Weight: ${profile.weightKg}kg
- Goal: "${profile.goal}" | Daily Targets: ${profile.targetCalories} kcal, ${profile.targetProteinG}g protein
- Diet preference: ${profile.dietPreference || "none"} | Food allergies (NEVER suggest these): ${allergies} | Medical conditions: ${conditions}
- Schedule: ${profile.collegeSchedule || "Not specified"} | Strict Mess Mode: ${profile.strictMessOnly ? "ACTIVE" : "INACTIVE"}
- Gym: ${gymFrequency} days/week (${profile.gymExperience}) | Split: ${JSON.stringify(getWeekSchedule(gymFrequency))}
- Today (${todayName}): Remaining plan: ${dietPlan?.[todayName] ? JSON.stringify(remainingPlanMeals(dietPlan[todayName].meals, closedMeals)) : "N/A"}
- Full Weekly Diet Overview:
${weeklySummary || "No diet plan generated yet"}

LIVE STATUS (calculated by the app, use these numbers and do not recalculate):
${JSON.stringify({ ...context, habits })}

MESS TIMING RULE: mealTiming has the current local time and each meal's state. Only suggest eating at a meal whose state is "open" or "upcoming". Never tell the user to eat at a "closed" meal, because the mess will not serve it. If messClosedForToday is true, suggest only what they could already have in their room (not in Strict Mess Mode), or reassure them and point to tomorrow's breakfast.

════════════════════════════════════════════
FULL DATA CONTROL — ACTIONS YOU CAN TAKE
════════════════════════════════════════════

You have 10 possible actions. Choose the correct one based on what the user says:

1. log_meal — User mentions food they ate (any meal, snack, drink with calories)
   updatedData: {
     mealType: "breakfast"|"lunch"|"dinner"|"snack",
     items: [{ name (one food per item, e.g. "Roti"), quantity: number (the amount the user said), unit: "piece"|"katori"|"plate"|"scoop"|"gram", estimatedCalories, proteinG, carbsG, fatG }],
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
}

async function generateReply(prompt: string): Promise<string> {
  try {
    const model = getGenAI().getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (geminiError) {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey || groqApiKey === "your_groq_api_key_here") throw geminiError;

    console.warn("Gemini chat failed, trying Groq:", geminiError);
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });
    if (!response.ok) {
      throw new Error(`Groq fallback failed (${response.status}): ${await response.text()}`);
    }
    const data = await response.json();
    return data.choices[0]?.message?.content || "";
  }
}

export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  const { message, history } = body;
  if (typeof message !== "string" || !message.trim()) {
    return Response.json({ error: "A message is required." }, { status: 400 });
  }
  if (message.length > MAX_CHAT_MESSAGE_CHARS) {
    return Response.json({ error: "That message is too long." }, { status: 400 });
  }
  if (!checkRateLimit(`chat:${session.userId}`, CHAT_MESSAGES_PER_HOUR, HOUR_MS)) {
    return rateLimitedResponse();
  }

  try {
    const snapshot = await loadCoachSnapshot(session.userId, session.tz);
    if (!snapshot) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    const prompt = `${buildSystemPrompt(snapshot, session.tz)}\n\nChat History:\n${formatHistory(history)}\n\nUser: ${message}\n\nCoach:`;
    const responseText = await generateReply(prompt);
    return Response.json(normalizeCoachReply(JSON.parse(sanitizeJsonOutput(responseText))));
  } catch (error) {
    console.error("AI Coach Chatbot error:", error);
    return Response.json({ error: "Failed to process chat message" }, { status: 500 });
  }
}

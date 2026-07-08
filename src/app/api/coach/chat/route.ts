import { NextRequest } from "next/server";
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
    const { email, message, history, profile } = body;

    if (!email || !message) {
      return Response.json({ error: "Email and message are required." }, { status: 400 });
    }

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Construct the context profile summary
    const name = profile?.name || "User";
    const age = profile?.age || 22;
    const height = profile?.heightCm || 175;
    const weight = profile?.weightKg || 75;
    const targetCalories = profile?.targetCalories || 2000;
    const targetProtein = profile?.targetProteinG || 150;
    const collegeSchedule = profile?.collegeSchedule || "8 AM - 4 PM";
    const goal = profile?.goal || "recomp";
    
    const activeDietPlan = profile?.dietPlan?.generatedPlan || null;
    const activeWorkoutPlan = profile?.workouts || null; // Workouts stored in profile or timeline
    const activeMessMenu = profile?.messMenu?.parsedMenu || null;

    const systemPrompt = `You are the Health OS Personal AI Coach. Your goal is to guide the user, answer their health questions, and help them customize their generated diet plans and workouts.
You have access to the user's active profile and custom plans.

User Context:
- Name: ${name}
- Biometrics: ${age} years old, ${height}cm height, ${weight}kg weight.
- Goals: Goal is "${goal}". Daily targets are ${targetCalories} kcal and ${targetProtein}g of protein.
- Schedule: College classes are ${collegeSchedule}.
- Active Hostel Mess Menu:
${JSON.stringify(activeMessMenu, null, 2)}

Active Diet Plan:
${JSON.stringify(activeDietPlan, null, 2)}

Active Workouts/Gym Split:
${JSON.stringify(activeWorkoutPlan, null, 2)}

Instruction Guidelines:
1. Conversation: Be supportive, scientific, and direct. Use sports-science principles (Muscle Protein Synthesis spacing, leucine threshold, carbohydrate timing).
2. Tweak Plans on request:
   - If the user asks to modify, replace, add, remove, or reschedule things in their daily/weekly DIET PLAN (e.g. "change Monday's breakfast to have eggs instead of whey", "make Wednesday lunch lower in calories"):
     - Analyze their request, make the precise edits to the "Active Diet Plan" JSON, set "action" to "update_diet", and return the full updated "dietPlan" structure in "updatedData".
   - If the user asks to modify, edit, or adjust their WORKOUT splits:
     - Analyze their request, make the precise edits to the "Active Workouts/Gym Split" JSON, set "action" to "update_workout", and return the full updated "workoutPlan" structure in "updatedData".
   - Otherwise, set "action" to "none" and "updatedData" to null.

You MUST return a JSON object matching this exact structure:
{
  "message": "A friendly explanation of your reply or the updates you made",
  "action": "update_diet" | "update_workout" | "none",
  "updatedData": {} // The modified dietPlan or workoutPlan JSON structure if action is not "none", else null
}

Do not add any text before or after the JSON response. Return ONLY valid JSON.`;

    const formattedHistory = (history || []).map((msg: any) => {
      return `${msg.role === "user" ? "User" : "Coach"}: ${msg.content}`;
    }).join("\n");

    const fullPrompt = `${systemPrompt}\n\nChat History:\n${formattedHistory}\n\nUser: ${message}\n\nCoach:`;

    console.log(`💬 Chatbot processing message from ${email}...`);
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    const sanitized = sanitizeJsonOutput(responseText);
    const parsed = JSON.parse(sanitized);

    return Response.json(parsed);
  } catch (err: any) {
    console.error("AI Coach Chatbot error:", err);
    return Response.json({ error: err.message || "Failed to process chat message" }, { status: 500 });
  }
}

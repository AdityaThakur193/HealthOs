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
    const { text, image, mimeType } = body;

    if (!text && !image) {
      return Response.json({ error: "Either text or image input is required." }, { status: 400 });
    }

    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are an expert college hostel mess menu parser.
Analyze the provided unstructured mess menu (which could be a copy-pasted text block or an image) and extract the food items served for Breakfast, Lunch, Snacks, and Dinner for each day from Monday to Sunday.

Translate local Hindi or regional Indian food names into clear, standard descriptions if helpful, but preserve the common names (e.g. "Rajma Chawal", "Idli Sambhar", "Aloo Paratha").

You MUST return a JSON object matching this exact structure:
{
  "parsedMenu": {
    "monday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" },
    "tuesday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" },
    "wednesday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" },
    "thursday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" },
    "friday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" },
    "saturday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" },
    "sunday": { "breakfast": "string", "lunch": "string", "snacks": "string", "dinner": "string" }
  }
}

If any meal is not specified or is a rest day, use a brief blank or placeholder like "Not specified". Do not add any text before or after the JSON response. Return ONLY valid JSON.`;

    let responseText = "";

    if (image) {
      // Multimodal vision check
      const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, "");
      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg",
        },
      };
      console.log("📸 Calling Gemini Vision to parse mess menu image...");
      const result = await model.generateContent([prompt, imagePart]);
      responseText = result.response.text();
    } else {
      // Text block analysis
      console.log("📝 Calling Gemini Text to parse mess menu text...");
      const fullPrompt = `${prompt}\n\nUnstructured Menu Text:\n${text}`;
      const result = await model.generateContent(fullPrompt);
      responseText = result.response.text();
    }

    const sanitized = sanitizeJsonOutput(responseText);
    const parsed = JSON.parse(sanitized);

    return Response.json(parsed);
  } catch (err: any) {
    console.error("Mess menu parsing error:", err);
    return Response.json({ error: err.message || "Failed to parse mess menu" }, { status: 500 });
  }
}

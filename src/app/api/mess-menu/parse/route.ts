import { NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeJsonOutput } from "@/lib/gemini";
import { requireUserSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import { invalidBodyResponse, readJsonObject, validateImageInput, validateMessMenuInput } from "@/lib/validation";

export const dynamic = "force-dynamic";

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();
  const { text, image, mimeType } = body;

  if (!text && !image) {
    return Response.json({ error: "Either text or image input is required." }, { status: 400 });
  }
  if (text) {
    const textCheck = validateMessMenuInput(text);
    if (!textCheck.valid) return Response.json({ error: textCheck.error }, { status: 400 });
  }
  if (image) {
    const imageError = validateImageInput(image, mimeType);
    if (imageError) return Response.json({ error: imageError }, { status: 400 });
  }
  if (!checkRateLimit(`mess-menu:${session.userId}`, 10, 60 * 60 * 1000)) {
    return rateLimitedResponse();
  }

  try {
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
      const cleanBase64 = (image as string).replace(/^data:image\/\w+;base64,/, "");
      const imagePart = {
        inlineData: {
          data: cleanBase64,
          mimeType: (mimeType as string) || "image/jpeg",
        },
      };
      const result = await model.generateContent([prompt, imagePart]);
      responseText = result.response.text();
    } else {
      // Text block analysis
      const fullPrompt = `${prompt}\n\nUnstructured Menu Text:\n${text}`;
      const result = await model.generateContent(fullPrompt);
      responseText = result.response.text();
    }

    const sanitized = sanitizeJsonOutput(responseText);
    const parsed = JSON.parse(sanitized);

    return Response.json(parsed);
  } catch (err) {
    console.error("Mess menu parsing error:", err);
    return Response.json({ error: "Failed to parse mess menu" }, { status: 500 });
  }
}

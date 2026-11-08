/**
 * Shared input validation for API routes.
 */

export const TIMELINE_EVENT_TYPES = [
  "weight",
  "meal",
  "workout",
  "sleep",
  "steps",
  "photo",
  "measurement",
  "note",
  "water",
  "habit",
] as const;

/** Sources a client may claim. Others are set by the server only. */
export const CLIENT_EVENT_SOURCES = ["manual", "ai_vision", "wearable", "import", "chatbot"] as const;

export const MAX_MESS_MENU_CHARS = 50000;
export const MAX_IMAGE_BASE64_CHARS = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const MAX_CHAT_MESSAGE_CHARS = 2000;
export const MAX_MEAL_TEXT_CHARS = 2000;
const MAX_EVENT_PAYLOAD_CHARS = 2 * 1024 * 1024;

const GOALS = ["lose_fat", "build_muscle", "maintain", "recomp", "general_health"];
const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"];
const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];
const GENDERS = ["male", "female", "other"];
const DIET_PREFERENCES = ["none", "vegetarian", "vegan", "eggetarian", "non_veg"];

type JsonObject = Record<string, unknown>;

/** Parses a JSON object body; returns null for malformed or non-object bodies. */
export async function readJsonObject(request: Request): Promise<JsonObject | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as JsonObject) : null;
  } catch {
    return null;
  }
}

export function invalidBodyResponse(): Response {
  return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
}

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string" || email.length > 254) return false;
  if (email.includes("..") || email.includes("<") || email.includes(">")) return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$/.test(email);
}

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return isValidEmail(normalized) ? normalized : null;
}

export function isValidObjectId(id: unknown): id is string {
  return typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id);
}

/** Accepts Mongo ids and the ids produced by the local development store. */
export function isValidEventId(id: unknown): id is string {
  return isValidObjectId(id) || (typeof id === "string" && /^local_event_[a-z0-9]+$/.test(id));
}

export function isValidDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function isValidDate(value: unknown): boolean {
  return (typeof value === "string" || typeof value === "number") && !isNaN(new Date(value).getTime());
}

interface ProfileMetrics {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  sleepTarget?: number;
}

export function validateProfileMetrics(data: ProfileMetrics): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const outside = (value: number | undefined, min: number, max: number) =>
    value !== undefined && (isNaN(value) || value < min || value > max);

  if (outside(data.age, 10, 120)) errors.push("Age must be between 10 and 120.");
  if (outside(data.heightCm, 50, 250)) errors.push("Height must be between 50 cm and 250 cm.");
  if (outside(data.weightKg, 20, 500)) errors.push("Weight must be between 20 kg and 500 kg.");
  if (outside(data.targetWeightKg, 20, 500)) errors.push("Target weight must be between 20 kg and 500 kg.");
  if (outside(data.sleepTarget, 1, 24)) errors.push("Sleep target must be between 1 and 24 hours.");

  return { valid: errors.length === 0, errors };
}

export function validateProfileChoices(data: JsonObject): string | null {
  if (!GENDERS.includes(String(data.gender))) return "Invalid gender.";
  if (!GOALS.includes(String(data.goal))) return "Invalid goal.";
  if (!ACTIVITY_LEVELS.includes(String(data.activityLevel))) return "Invalid activity level.";
  if (!EXPERIENCE_LEVELS.includes(String(data.gymExperience))) return "Invalid gym experience.";
  if (data.dietPreference !== undefined && !DIET_PREFERENCES.includes(String(data.dietPreference))) {
    return "Invalid diet preference.";
  }
  return null;
}

export function validateMessMenuInput(text: unknown): { valid: boolean; error?: string } {
  if (typeof text !== "string") return { valid: false, error: "Input must be text." };
  if (text.length > MAX_MESS_MENU_CHARS) {
    return { valid: false, error: "Mess menu exceeds maximum limit of 50,000 characters." };
  }
  return { valid: true };
}

export function validateImageInput(image: unknown, mimeType: unknown): string | null {
  if (typeof image !== "string" || image.length === 0) return "Image data is invalid.";
  if (image.length > MAX_IMAGE_BASE64_CHARS) return "Image is too large. Please use a smaller photo.";
  if (mimeType !== undefined && !ALLOWED_IMAGE_TYPES.includes(String(mimeType))) {
    return "Unsupported image type.";
  }
  return null;
}

export function validateTimelinePayload(type: string, payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "Payload must be a valid object.";
  if (JSON.stringify(payload).length > MAX_EVENT_PAYLOAD_CHARS) return "Payload is too large.";
  const data = payload as JsonObject;

  if (type === "water") {
    const amount = Number(data.amountL);
    if (isNaN(amount) || amount <= 0) return "Water amount must be greater than 0 L.";
    if (amount > 10) return "Water intake cannot exceed 10 Liters in a single log for safety.";
  }

  if (type === "sleep") {
    const hours = Number(data.hours);
    if (isNaN(hours) || hours <= 0) return "Sleep duration must be greater than 0.";
    if (hours > 24) return "Sleep duration cannot exceed 24 hours in a single day.";
  }

  if (type === "steps") {
    const count = Number(data.count ?? data.steps);
    if (isNaN(count) || count < 0) return "Step count cannot be negative.";
    if (count > 100000) return "Step count cannot exceed 100,000 steps in a single log.";
  }

  if (type === "weight") {
    const weight = Number(data.weightKg);
    if (isNaN(weight) || weight < 25 || weight > 350) {
      return "Weight measurement must be between 25 kg and 350 kg.";
    }
  }

  if (type === "meal") {
    if (data.isMock === true || data.source === "mock") {
      return "Cannot log demo or mock meal data to timeline.";
    }
    const calories = Number(data.totalCalories);
    if (!isNaN(calories) && (calories < 0 || calories > 10000)) {
      return "Meal calories must be between 0 and 10,000 kcal.";
    }
  }

  return null;
}

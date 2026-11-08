import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { AIMemory, Habit, HabitLog, OtpChallenge, TimelineEvent, UserProfile } from "@/lib/db/models";
import { getLocalProfile, saveLocalProfile, deleteLocalEvents, deleteLocalProfile } from "@/lib/db/fallback";
import { calculateAdaptiveTdee, calculateHealthTargets, goalCalorieTarget, ActivityLevel, Gender, Goal } from "@/lib/tdee";
import { calculateLoggingStreak } from "@/lib/timelineUtils";
import { clearSessionCookieHeader, createSessionToken, requireSession, Session, sessionCookieHeader } from "@/lib/auth/session";
import { invalidBodyResponse, isValidMessTimings, readJsonObject, validateProfileChoices, validateProfileMetrics } from "@/lib/validation";

export const dynamic = "force-dynamic";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function toNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? NaN : parsed;
}

/** Keeps the signed session's userId in step with the stored profile. */
function sessionHeaders(session: Session, userId: string): HeadersInit | undefined {
  if (session.userId === userId) return undefined;
  const token = createSessionToken({ email: session.email, userId, tz: session.tz });
  return { "Set-Cookie": sessionCookieHeader(token) };
}

export async function GET(request: NextRequest) {
  const session = requireSession(request);
  if (session instanceof Response) return session;

  try {
    await connectDB();
    const profileDoc = await UserProfile.findOne({ email: session.email });

    if (!profileDoc) {
      return Response.json({ notInitialized: true });
    }

    const profile = profileDoc.toObject();
    const userId = String(profile._id);

    // Only the fields the TDEE and streak calculations read.
    const events = await TimelineEvent.find({ userId: profile._id })
      .select("type timestamp payload.totalCalories payload.weightKg")
      .lean();
    const tdeeResult = calculateAdaptiveTdee(profile, events, session.tz);

    if (tdeeResult.status === "adaptive" && tdeeResult.calculatedTdee !== profile.tdee) {
      profileDoc.tdee = tdeeResult.calculatedTdee;
      if (!profileDoc.useCustomMacros) {
        profileDoc.targetCalories = goalCalorieTarget(tdeeResult.calculatedTdee, profileDoc.goal, profileDoc.gender);
      }
      await profileDoc.save();
      profile.tdee = profileDoc.tdee;
      profile.targetCalories = profileDoc.targetCalories;
    }

    return Response.json(
      {
        profile,
        tdeeMode: tdeeResult.status,
        daysRemaining: tdeeResult.daysRemaining,
        avgCalories: tdeeResult.avgCalories,
        weightDeltaKg: tdeeResult.weightDeltaKg,
        streak: calculateLoggingStreak(events.map((event) => event.timestamp), session.tz),
      },
      { headers: sessionHeaders(session, userId) }
    );
  } catch (error) {
    console.warn("Profile GET could not reach MongoDB:", error);
    if (isProduction()) {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
    }

    const profile = await getLocalProfile(session.email);
    if (!profile) return Response.json({ notInitialized: true });

    return Response.json(
      { profile, tdeeMode: "calibrating", daysRemaining: 14, avgCalories: 0, weightDeltaKg: 0, streak: 0 },
      { headers: sessionHeaders(session, profile._id) }
    );
  }
}

/**
 * POST /api/profile
 */
export async function POST(request: NextRequest) {
  const session = requireSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  const { name, goal, activityLevel, gymExperience, gender } = body;
  const email = session.email;

  if (typeof name !== "string" || !name.trim() || !body.age || !gender || !body.heightCm || !body.weightKg || !goal || !activityLevel || !gymExperience) {
    return Response.json(
      { error: "Basics, physical details, goal, activity level, and experience are required" },
      { status: 400 }
    );
  }

  const choiceError = validateProfileChoices(body);
  if (choiceError) return Response.json({ error: choiceError }, { status: 400 });

  let existing: Record<string, unknown> | null = null;
  try {
    await connectDB();
    existing = await UserProfile.findOne({ email }).lean<Record<string, unknown>>();
  } catch (error) {
    if (isProduction()) {
      console.error("Profile POST could not reach MongoDB:", error);
      return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
    }
    existing = await getLocalProfile(email);
  }

  /** Field from the request when present, otherwise the stored value. */
  const pick = <T>(key: string, fallback: T): T =>
    body[key] !== undefined ? (body[key] as T) : ((existing?.[key] as T | undefined) ?? fallback);

  const age = toNumber(body.age) as number;
  const heightCm = toNumber(body.heightCm) as number;
  const weightKg = toNumber(body.weightKg) as number;
  const targetWeightKg = toNumber(body.targetWeightKg) ?? (existing?.targetWeightKg as number | undefined) ?? weightKg;
  const sleepTarget = toNumber(body.sleepTarget) ?? (existing?.sleepTarget as number | undefined) ?? 8;

  const metrics = validateProfileMetrics({ age, heightCm, weightKg, targetWeightKg, sleepTarget });
  if (!metrics.valid) {
    return Response.json({ error: metrics.errors[0] }, { status: 400 });
  }

  // Screens that save only some settings must not disturb the rest.
  const storedOr = (key: string) => toNumber(body[key]) ?? (existing?.[key] as number | undefined);
  const neckCm = storedOr("neckCm");
  const waistCm = storedOr("waistCm");
  const hipCm = storedOr("hipCm");
  const customCalories = storedOr("customCalories");
  const customProtein = storedOr("customProtein");
  const useCustomMacros = pick<boolean>("useCustomMacros", false);
  const gymFrequency = toNumber(body.gymFrequency) ?? (existing?.gymFrequency as number | undefined) ?? 4;

  const optionalNumbers = [neckCm, waistCm, hipCm, customCalories, customProtein, gymFrequency];
  if (optionalNumbers.some((value) => value !== undefined && (Number.isNaN(value) || value < 0))) {
    return Response.json({ error: "Measurements and custom targets must be positive numbers." }, { status: 400 });
  }

  const targets = calculateHealthTargets({
    age,
    gender: gender as Gender,
    heightCm,
    weightKg,
    targetWeightKg,
    neckCm,
    waistCm,
    hipCm,
    customCalories,
    customProtein,
    useCustomMacros,
    goal: goal as Goal,
    activityLevel: activityLevel as ActivityLevel,
  });

  const profileData: Record<string, unknown> & { email: string } = {
    name: name.trim(),
    email,
    age,
    gender,
    heightCm,
    weightKg,
    targetWeightKg,
    goal,
    activityLevel,
    gymExperience,
    gymFrequency,
    gymAccess: pick("gymAccess", "college_gym"),
    messAccess: pick("messAccess", "hostel_mess"),
    dietPreference: pick("dietPreference", "none"),
    foodAllergies: pick<string[]>("foodAllergies", []),
    medicalConditions: pick<string[]>("medicalConditions", []),
    sleepTarget,
    collegeSchedule: pick("collegeSchedule", ""),
    strictMessOnly: pick("strictMessOnly", false),
    customDietPreferences: pick("customDietPreferences", ""),
    neckCm,
    waistCm,
    hipCm,
    customCalories,
    customProtein,
    useCustomMacros,
    ...targets,
  };

  if (body.messTimings !== undefined) {
    if (!isValidMessTimings(body.messTimings)) {
      return Response.json({ error: "Each meal needs an opening time before its closing time." }, { status: 400 });
    }
    profileData.messTimings = body.messTimings;
  }
  if (body.messMenu !== undefined) profileData.messMenu = body.messMenu;
  if (body.dietPlan !== undefined) profileData.dietPlan = body.dietPlan;

  try {
    const saved = await UserProfile.findOneAndUpdate(
      { email },
      { $set: profileData },
      { new: true, upsert: true, runValidators: true }
    );
    return Response.json({ profile: saved }, { headers: sessionHeaders(session, String(saved._id)) });
  } catch (error) {
    if ((error as Error)?.name === "ValidationError") {
      return Response.json({ error: "Some profile details are invalid." }, { status: 400 });
    }
    console.warn("Profile save could not reach MongoDB:", error);
    if (isProduction()) {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
    }
    const saved = await saveLocalProfile(profileData);
    return Response.json({ profile: saved }, { headers: sessionHeaders(session, saved._id) });
  }
}

/**
 * DELETE /api/profile
 * Permanently removes the signed-in user's account and all of their data.
 */
export async function DELETE(request: NextRequest) {
  const session = requireSession(request);
  if (session instanceof Response) return session;

  const clearCookie = { headers: { "Set-Cookie": clearSessionCookieHeader() } };

  try {
    await connectDB();
    const profile = await UserProfile.findOne({ email: session.email }).select("_id").lean();
    if (profile) {
      const userId = profile._id;
      await Promise.all([
        TimelineEvent.deleteMany({ userId }),
        Habit.deleteMany({ userId }),
        HabitLog.deleteMany({ userId }),
        AIMemory.deleteMany({ userId }),
      ]);
      await UserProfile.deleteOne({ _id: userId });
    }
    await OtpChallenge.deleteOne({ email: session.email });
    return Response.json({ success: true }, clearCookie);
  } catch (error) {
    console.warn("Profile DELETE could not reach MongoDB:", error);
    if (isProduction()) {
      return Response.json({ error: "Database offline. Please try again later." }, { status: 503 });
    }
    const profile = await getLocalProfile(session.email);
    if (profile) {
      await deleteLocalEvents(profile._id);
      await deleteLocalProfile(session.email);
    }
    return Response.json({ success: true }, clearCookie);
  }
}

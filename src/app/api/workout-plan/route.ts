import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { LeanUserProfile, UserProfile } from "@/lib/db/models";
import { requireUserSession, UserSession } from "@/lib/auth/session";
import {
  applyWorkoutDayEdit,
  buildTemplateWeek,
  getCurrentWeek,
  getExerciseLibrary,
  sanitizeWeekPlan,
  WeekPlan,
  WorkoutDayEdit,
} from "@/lib/workoutPlans";
import { invalidBodyResponse, readJsonObject } from "@/lib/validation";

export const dynamic = "force-dynamic";

type PlanProfile = Parameters<typeof getCurrentWeek>[0];

async function loadProfile(session: UserSession): Promise<LeanUserProfile | null> {
  await connectDB();
  return UserProfile.findById(session.userId).select("gymFrequency customWorkoutPlan").lean<LeanUserProfile>();
}

function unavailable(error: unknown): Response {
  console.error("Workout plan error:", error);
  return Response.json({ error: "Your workout plan is unavailable right now." }, { status: 503 });
}

async function savePlan(session: UserSession, plan: WeekPlan): Promise<Response> {
  await UserProfile.updateOne({ _id: session.userId }, { $set: { customWorkoutPlan: plan } });
  return Response.json({ week: plan, isCustom: true });
}

/** GET /api/workout-plan: the current week, its template, and the exercise library. */
export async function GET(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  try {
    const profile = await loadProfile(session);
    if (!profile) return Response.json({ error: "User profile not found." }, { status: 404 });

    return Response.json({
      week: getCurrentWeek(profile as PlanProfile),
      template: buildTemplateWeek(profile.gymFrequency),
      isCustom: Boolean(profile.customWorkoutPlan),
      library: getExerciseLibrary(),
    });
  } catch (error) {
    return unavailable(error);
  }
}

/** PUT /api/workout-plan: saves a full week. */
export async function PUT(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  const plan = sanitizeWeekPlan(body.plan);
  if (typeof plan === "string") return Response.json({ error: plan }, { status: 400 });

  try {
    await connectDB();
    return await savePlan(session, plan);
  } catch (error) {
    return unavailable(error);
  }
}

/** PATCH /api/workout-plan: changes a single day. */
export async function PATCH(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  try {
    const profile = await loadProfile(session);
    if (!profile) return Response.json({ error: "User profile not found." }, { status: 404 });

    const plan = applyWorkoutDayEdit(getCurrentWeek(profile as PlanProfile), body as WorkoutDayEdit);
    if (typeof plan === "string") return Response.json({ error: plan }, { status: 400 });

    return await savePlan(session, plan);
  } catch (error) {
    return unavailable(error);
  }
}

/** DELETE /api/workout-plan: returns to the template. */
export async function DELETE(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  try {
    await connectDB();
    await UserProfile.updateOne({ _id: session.userId }, { $unset: { customWorkoutPlan: 1 } });
    return Response.json({ success: true, isCustom: false });
  } catch (error) {
    return unavailable(error);
  }
}

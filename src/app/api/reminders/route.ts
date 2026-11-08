import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { PushDevice, UserProfile } from "@/lib/db/models";
import { requireUserSession } from "@/lib/auth/session";
import { isValidTimeZone } from "@/lib/dateUtils";
import { MEAL_NAMES } from "@/lib/mealWindows";
import { isAllowedPushEndpoint, resolveReminderMeals } from "@/lib/reminders";
import { invalidBodyResponse, readJsonObject } from "@/lib/validation";

export const dynamic = "force-dynamic";

function unavailable(error: unknown): Response {
  console.error("Reminders error:", error);
  return Response.json({ error: "Reminders are unavailable right now." }, { status: 503 });
}

/** GET /api/reminders: whether reminders can be used and how they're set. */
export async function GET(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  try {
    await connectDB();
    const [profile, devices] = await Promise.all([
      UserProfile.findById(session.userId).select("reminderMeals").lean(),
      PushDevice.countDocuments({ userId: session.userId }),
    ]);
    return Response.json({
      publicKey: process.env.VAPID_PUBLIC_KEY ?? null,
      enabled: devices > 0,
      meals: resolveReminderMeals(profile?.reminderMeals),
    });
  } catch (error) {
    return unavailable(error);
  }
}

/** POST /api/reminders: subscribe a device, unsubscribe it, or choose meals. */
export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const body = await readJsonObject(request);
  if (!body) return invalidBodyResponse();

  try {
    await connectDB();

    if (body.action === "subscribe") {
      const subscription = body.subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | undefined;
      const { p256dh, auth } = subscription?.keys ?? {};
      if (!isAllowedPushEndpoint(subscription?.endpoint) || typeof p256dh !== "string" || typeof auth !== "string") {
        return Response.json({ error: "That device can't receive reminders." }, { status: 400 });
      }

      // A device belongs to whoever most recently signed in on it.
      await PushDevice.updateOne(
        { endpoint: subscription.endpoint },
        { $set: { userId: session.userId, keys: { p256dh, auth }, tz: isValidTimeZone(body.tz) ? body.tz : session.tz } },
        { upsert: true }
      );
      return Response.json({ success: true });
    }

    if (body.action === "unsubscribe") {
      await PushDevice.deleteMany({ userId: session.userId });
      return Response.json({ success: true });
    }

    if (body.action === "meals") {
      if (!Array.isArray(body.meals) || body.meals.some((meal) => !(MEAL_NAMES as readonly unknown[]).includes(meal))) {
        return Response.json({ error: "Invalid meals." }, { status: 400 });
      }
      await UserProfile.updateOne({ _id: session.userId }, { $set: { reminderMeals: body.meals } });
      return Response.json({ success: true });
    }

    return Response.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    return unavailable(error);
  }
}

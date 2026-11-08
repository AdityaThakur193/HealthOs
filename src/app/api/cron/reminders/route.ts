import webpush from "web-push";
import connectDB from "@/lib/mongodb";
import { AIMemory, PushDevice } from "@/lib/db/models";
import { safeEqual } from "@/lib/auth/session";
import { buildCoachContext } from "@/lib/coachContext";
import { loadCoachSnapshot } from "@/lib/coachData";
import { dayKey } from "@/lib/dateUtils";
import { buildReminderMessage, checkReminder, resolveReminderMeals } from "@/lib/reminders";

export const dynamic = "force-dynamic";

const SENT_KEY = "reminders_sent";
const ONE_HOUR_SECONDS = 60 * 60;

/** Push services return these when a device has unsubscribed or gone away. */
const GONE_STATUSES = [404, 410];

const TEST_MESSAGE = JSON.stringify({ title: "Health OS test", body: "Notifications are working on this device.", url: "/" });

/** What a push service said when it refused a message. Never includes the device address. */
function describeFailure(endpoint: string, error: unknown) {
  const { statusCode, body, message } = error as { statusCode?: number; body?: unknown; message?: string };
  return {
    service: new URL(endpoint).hostname,
    status: statusCode ?? null,
    detail: String(body || message || "unknown").trim().slice(0, 160),
  };
}

async function readSent(userId: string, today: string): Promise<string[]> {
  const entry = await AIMemory.findOne({ userId, layer: 1, key: SENT_KEY }).lean();
  const value = entry?.value as { date?: string; meals?: string[] } | undefined;
  return value?.date === today ? value.meals ?? [] : [];
}

/**
 * POST /api/cron/reminders
 * Called on a schedule. Protected by CRON_SECRET rather than a user session.
 * Adding ?test=1 sends a test notification to every device, whatever the time.
 * The response appears in public workflow logs, so it holds no personal data.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!secret || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ error: "Reminders are not configured." }, { status: 503 });
  }
  if (!safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sendTest = new URL(request.url).searchParams.get("test") === "1";

  try {
    await connectDB();
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://github.com/AdityaThakur193/HealthOs", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const devices = await PushDevice.find().lean();
    const userIds = [...new Set(devices.map((device) => String(device.userId)))];
    let sent = 0;
    let removed = 0;
    const skipped: Record<string, number> = {};
    const failed: ReturnType<typeof describeFailure>[] = [];
    const localTimes = new Set<string>();
    const skip = (reason: string) => {
      skipped[reason] = (skipped[reason] ?? 0) + 1;
    };

    const deliver = async (userDevices: typeof devices, message: string) => {
      let delivered = false;
      for (const device of userDevices) {
        try {
          await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, message, { TTL: ONE_HOUR_SECONDS });
          delivered = true;
          sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          if (status && GONE_STATUSES.includes(status)) {
            await PushDevice.deleteOne({ _id: device._id });
            removed++;
          }
          failed.push(describeFailure(device.endpoint, error));
          console.warn("Reminder could not be delivered:", status);
        }
      }
      return delivered;
    };

    for (const userId of userIds) {
      const userDevices = devices.filter((device) => String(device.userId) === userId);
      const tz = userDevices[0].tz;

      try {
        if (sendTest) {
          await deliver(userDevices, TEST_MESSAGE);
          continue;
        }

        const snapshot = await loadCoachSnapshot(userId, tz);
        if (!snapshot) {
          skip("no_profile");
          continue;
        }

        const { mealTiming, todayMessMenu } = buildCoachContext({ ...snapshot, tz });
        if (!mealTiming) {
          skip("no_mess_schedule");
          continue;
        }
        localTimes.add(mealTiming.localClock);

        const today = dayKey(new Date(), tz);
        const alreadySent = await readSent(userId, today);
        const decision = checkReminder(mealTiming, resolveReminderMeals(snapshot.profile.reminderMeals), alreadySent);
        if ("skip" in decision) {
          skip(decision.skip);
          continue;
        }

        const message = JSON.stringify(buildReminderMessage(mealTiming, decision.meal, todayMessMenu?.[decision.meal]));
        if (await deliver(userDevices, message)) {
          await AIMemory.updateOne(
            { userId, layer: 1, key: SENT_KEY },
            { $set: { value: { date: today, meals: [...alreadySent, decision.meal] } } },
            { upsert: true }
          );
        }
      } catch (error) {
        // One user's problem shouldn't stop everyone else's reminders.
        skip("check_failed");
        console.error("Reminder check failed for a user:", error);
      }
    }

    return Response.json({ checked: userIds.length, sent, removed, skipped, failed, localTimes: [...localTimes] });
  } catch (error) {
    console.error("Reminder job failed:", error);
    return Response.json({ error: "Reminder job failed." }, { status: 500 });
  }
}

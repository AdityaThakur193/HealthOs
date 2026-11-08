import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import webpush from "web-push";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session";
import { PushDevice } from "../lib/db/models";
import { buildMealDayStatus, DEFAULT_MESS_TIMINGS } from "../lib/mealWindows";
import { buildReminderMessage, checkReminder, findDueReminder, isAllowedPushEndpoint, resolveReminderMeals } from "../lib/reminders";
import { POST as cronPOST } from "../app/api/cron/reminders/route";
import { GET as remindersGET, POST as remindersPOST } from "../app/api/reminders/route";
import { DELETE as profileDELETE, POST as profilePOST } from "../app/api/profile/route";
import { POST as timelinePOST } from "../app/api/timeline/route";

vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

const send = vi.mocked(webpush.sendNotification);
const TZ = "Asia/Kolkata";
const email = "reminders@example.com";
const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
const subscription = { endpoint, keys: { p256dh: "key", auth: "secret" } };
const monday = (time: string) => new Date(`2026-11-09T${time}:00+05:30`);

const status = (time: string, logs: { timestamp: Date }[] = []) =>
  buildMealDayStatus({ now: monday(time), tz: TZ, timings: DEFAULT_MESS_TIMINGS, isHoliday: false, mealLogs: logs });

const ALL = ["breakfast", "lunch", "snacks", "dinner"] as const;

describe("Which reminder is due", () => {
  it("waits until the last hour of a meal", () => {
    expect(findDueReminder(status("12:30"), [...ALL], [])).toBeNull();
    expect(findDueReminder(status("13:15"), [...ALL], [])).toBe("lunch");
  });

  it("stays quiet between meals and after the mess closes", () => {
    expect(findDueReminder(status("15:00"), [...ALL], [])).toBeNull();
    expect(findDueReminder(status("22:00"), [...ALL], [])).toBeNull();
  });

  it("doesn't remind about a meal already logged", () => {
    expect(findDueReminder(status("13:15", [{ timestamp: monday("12:45") }]), [...ALL], [])).toBeNull();
  });

  it("reminds only once per meal", () => {
    expect(findDueReminder(status("13:15"), [...ALL], ["lunch"])).toBeNull();
  });

  it("respects the meals the user chose", () => {
    expect(findDueReminder(status("13:15"), ["dinner"], [])).toBeNull();
    expect(resolveReminderMeals(undefined)).toEqual([...ALL]);
    expect(resolveReminderMeals([])).toEqual([]);
  });

  it("names the reason for staying quiet", () => {
    expect(checkReminder(status("12:30"), [...ALL], [])).toEqual({ skip: "not_last_hour" });
    expect(checkReminder(status("15:00"), [...ALL], [])).toEqual({ skip: "no_open_meal" });
    expect(checkReminder(status("13:15"), ["dinner"], [])).toEqual({ skip: "meal_turned_off" });
    expect(checkReminder(status("13:15"), [...ALL], ["lunch"])).toEqual({ skip: "already_sent" });
    expect(checkReminder(status("13:15", [{ timestamp: monday("12:45") }]), [...ALL], [])).toEqual({ skip: "already_logged" });
  });

  it("writes a short, guilt-free message", () => {
    const message = buildReminderMessage(status("13:15"), "lunch", "Rajma, Roti");
    expect(message.title).toBe("Lunch closes at 2:00 PM");
    expect(message.body).toContain("Rajma, Roti");
    expect(message.url).toBe("/meal");
  });
});

describe("Push endpoints", () => {
  it("accepts real push services", () => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/abc")).toBe(true);
  });

  it("rejects anything the server shouldn't call", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.test/x")).toBe(false);
    expect(isAllowedPushEndpoint({ url: endpoint })).toBe(false);
  });
});

describe("Reminder routes", () => {
  let server: MongoMemoryServer;
  const profileBody = { name: "R", age: 25, gender: "male", heightCm: 175, weightKg: 75, goal: "maintain", activityLevel: "moderate", gymExperience: "beginner" };
  const cookieFor = (userId: string | null, mail = email) => `${SESSION_COOKIE}=${createSessionToken({ email: mail, userId, tz: TZ })}`;

  function post(path: string, cookie: string, body?: unknown) {
    return new NextRequest(`http://localhost${path}`, { method: "POST", headers: { cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async function createUser(mail = email) {
    const res = await profilePOST(post("/api/profile", cookieFor(null, mail), profileBody));
    return cookieFor(String((await res.json()).profile._id), mail);
  }

  const runCron = (auth = "Bearer test-cron", query = "") => cronPOST(new Request(`http://localhost/api/cron/reminders${query}`, { method: "POST", headers: { authorization: auth } }));

  const subscribe = (cookie: string, body: object = { action: "subscribe", subscription, tz: TZ }) => remindersPOST(post("/api/reminders", cookie, body));

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    vi.stubEnv("MONGODB_URI", server.getUri());
    vi.stubEnv("CRON_SECRET", "test-cron");
    vi.stubEnv("VAPID_PUBLIC_KEY", "public");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private");
    global._mongooseCache = { conn: null, promise: null };
  }, 180000);

  afterAll(async () => {
    await mongoose.disconnect();
    await server.stop();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    send.mockReset();
    send.mockResolvedValue({} as never);
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await PushDevice.syncIndexes();
    }
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(monday("13:15"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses the job without the secret", async () => {
    expect((await runCron("Bearer wrong")).status).toBe(401);
    expect((await runCron("")).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses the job when it isn't configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await runCron()).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "test-cron");
  });

  it("requires a session to manage reminders", async () => {
    expect((await remindersGET(new NextRequest("http://localhost/api/reminders"))).status).toBe(401);
  });

  it("rejects a device with an unsafe endpoint", async () => {
    const cookie = await createUser();
    const res = await subscribe(cookie, { action: "subscribe", subscription: { ...subscription, endpoint: "https://169.254.169.254/x" } });
    expect(res.status).toBe(400);
    expect(await PushDevice.countDocuments()).toBe(0);
  });

  it("sends a due reminder once", async () => {
    await subscribe(await createUser());

    await runCron();
    vi.setSystemTime(monday("13:30"));
    await runCron();

    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0][1] as string).title).toBe("Lunch closes at 2:00 PM");
  });

  it("sends the next meal's reminder later the same day", async () => {
    await subscribe(await createUser());
    await runCron();
    vi.setSystemTime(monday("17:15"));
    await runCron();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("stays quiet once the meal is logged", async () => {
    const cookie = await createUser();
    await subscribe(cookie);
    await timelinePOST(post("/api/timeline", cookie, { type: "meal", timestamp: monday("12:45").toISOString(), payload: { totalCalories: 400 } }));

    await runCron();
    expect(send).not.toHaveBeenCalled();
  });

  it("removes a device the push service says is gone", async () => {
    await subscribe(await createUser());
    send.mockRejectedValue(Object.assign(new Error("gone"), { statusCode: 410 }));

    const result = await (await runCron()).json();

    expect(result.removed).toBe(1);
    expect(await PushDevice.countDocuments()).toBe(0);
  });

  it("retries next time after a temporary failure", async () => {
    await subscribe(await createUser());
    send.mockRejectedValueOnce(Object.assign(new Error("busy"), { statusCode: 503 }));

    await runCron();
    await runCron();

    expect(send).toHaveBeenCalledTimes(2);
    expect(await PushDevice.countDocuments()).toBe(1);
  });

  it("reports why a push service refused, without the device address", async () => {
    await subscribe(await createUser());
    send.mockRejectedValue(Object.assign(new Error("refused"), { statusCode: 403, body: "bad credentials" }));

    const result = await (await runCron()).json();

    expect(result.sent).toBe(0);
    expect(result.failed).toEqual([{ service: "fcm.googleapis.com", status: 403, detail: "bad credentials" }]);
    expect(JSON.stringify(result)).not.toContain("abc");
  });

  it("reports why nothing was due", async () => {
    await subscribe(await createUser());
    vi.setSystemTime(monday("12:30"));

    const result = await (await runCron()).json();

    expect(result.skipped).toEqual({ not_last_hour: 1 });
    expect(result.localTimes).toEqual(["12:30"]);
  });

  it("sends a test whatever the time, without using up the meal's reminder", async () => {
    await subscribe(await createUser());
    vi.setSystemTime(monday("15:00"));

    const result = await (await runCron("Bearer test-cron", "?test=1")).json();
    expect(result.sent).toBe(1);
    expect(JSON.parse(send.mock.calls[0][1] as string).title).toBe("Health OS test");

    vi.setSystemTime(monday("13:15"));
    await runCron();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("still needs the secret to send a test", async () => {
    expect((await runCron("Bearer wrong", "?test=1")).status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("moves a shared device to whoever signed in last", async () => {
    await subscribe(await createUser("first@example.com"));
    await subscribe(await createUser("second@example.com"));
    expect(await PushDevice.countDocuments()).toBe(1);
  });

  it("saves which meals to remind about", async () => {
    const cookie = await createUser();
    await subscribe(cookie);
    await remindersPOST(post("/api/reminders", cookie, { action: "meals", meals: ["dinner"] }));

    await runCron();

    expect(send).not.toHaveBeenCalled();
    const settings = await (await remindersGET(new NextRequest("http://localhost/api/reminders", { headers: { cookie } }))).json();
    expect(settings.meals).toEqual(["dinner"]);
    expect(settings.enabled).toBe(true);
  });

  it("removes devices when the account is deleted", async () => {
    const cookie = await createUser();
    await subscribe(cookie);
    await profileDELETE(new NextRequest("http://localhost/api/profile", { method: "DELETE", headers: { cookie } }));
    expect(await PushDevice.countDocuments()).toBe(0);
  });
});

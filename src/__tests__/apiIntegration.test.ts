import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session";
import { Habit, HabitLog, OtpChallenge, TimelineEvent, UserProfile } from "../lib/db/models";
import { OTP_MAX_ATTEMPTS } from "../lib/auth/otp";
import { GET as profileGET, POST as profilePOST, DELETE as profileDELETE } from "../app/api/profile/route";
import { GET as timelineGET, POST as timelinePOST, PUT as timelinePUT, DELETE as timelineDELETE } from "../app/api/timeline/route";
import { GET as habitsGET, POST as habitsPOST } from "../app/api/habits/route";
import { GET as reviewGET } from "../app/api/review/route";
import { POST as sendOtp } from "../app/api/auth/send-otp/route";
import { POST as verifyOtp } from "../app/api/auth/verify-otp/route";

/**
 * Runs the real route handlers against a real (in-memory) MongoDB.
 */

let server: MongoMemoryServer;

const profileBody = {
  name: "Test User",
  age: 25,
  gender: "male",
  heightCm: 175,
  weightKg: 75,
  goal: "maintain",
  activityLevel: "moderate",
  gymExperience: "beginner",
};

function call(path: string, method: string, cookie?: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: cookie ? { cookie } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function cookieFor(email: string, userId: string | null, tz?: string) {
  return `${SESSION_COOKIE}=${createSessionToken({ email, userId, tz })}`;
}

async function createUser(email: string) {
  const res = await profilePOST(call("/api/profile", "POST", cookieFor(email, null), profileBody));
  const { profile } = await res.json();
  return { id: String(profile._id), cookie: cookieFor(email, String(profile._id)) };
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  vi.stubEnv("MONGODB_URI", server.getUri());
  global._mongooseCache = { conn: null, promise: null };
}, 180000);

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await OtpChallenge.syncIndexes();
    await Habit.syncIndexes();
    await HabitLog.syncIndexes();
    await UserProfile.syncIndexes();
  }
});

describe("Authentication is required", () => {
  it("rejects anonymous requests", async () => {
    expect((await timelineGET(call("/api/timeline", "GET"))).status).toBe(401);
    expect((await profileGET(call("/api/profile", "GET"))).status).toBe(401);
    expect((await habitsGET(call("/api/habits", "GET"))).status).toBe(401);
    expect((await reviewGET(call("/api/review", "GET"))).status).toBe(401);
  });
});

describe("User isolation", () => {
  it("ignores a userId or email supplied by the client", async () => {
    const alice = await createUser("alice@example.com");
    const bob = await createUser("bob@example.com");

    await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "weight", payload: { weightKg: 70 } }));

    const bobView = await timelineGET(call(`/api/timeline?userId=${alice.id}`, "GET", bob.cookie));
    expect((await bobView.json()).events).toHaveLength(0);

    const created = await timelinePOST(
      call("/api/timeline", "POST", bob.cookie, { userId: alice.id, type: "weight", payload: { weightKg: 90 } })
    );
    expect(String((await created.json()).event.userId)).toBe(bob.id);

    await profilePOST(call("/api/profile", "POST", bob.cookie, { ...profileBody, email: "alice@example.com", name: "Hacked" }));
    expect((await UserProfile.findById(alice.id).lean())?.name).toBe("Test User");
  });

  it("does not let one user edit or delete another user's events", async () => {
    const alice = await createUser("alice@example.com");
    const bob = await createUser("bob@example.com");

    const res = await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "weight", payload: { weightKg: 70 } }));
    const eventId = String((await res.json()).event._id);

    const edit = await timelinePUT(call("/api/timeline", "PUT", bob.cookie, { eventId, payload: { weightKg: 99 } }));
    expect(edit.status).toBe(404);

    const remove = await timelineDELETE(call(`/api/timeline?eventId=${eventId}`, "DELETE", bob.cookie));
    expect(remove.status).toBe(404);

    expect((await TimelineEvent.findById(eventId).lean())?.payload.weightKg).toBe(70);
  });

  it("rejects an operator object as eventId", async () => {
    const alice = await createUser("alice@example.com");
    const res = await timelinePUT(call("/api/timeline", "PUT", alice.cookie, { eventId: { $ne: null }, payload: { weightKg: 80 } }));
    expect(res.status).toBe(400);
  });
});

describe("Timeline edits", () => {
  it("merges changed fields and validates the result", async () => {
    const alice = await createUser("alice@example.com");
    const res = await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "water", payload: { amountL: 0.5, glasses: 2 } }));
    const eventId = String((await res.json()).event._id);

    await timelinePUT(call("/api/timeline", "PUT", alice.cookie, { eventId, payload: { amountL: 1 } }));
    const saved = await TimelineEvent.findById(eventId).lean();
    expect(saved?.payload).toMatchObject({ amountL: 1, glasses: 2 });

    const invalid = await timelinePUT(call("/api/timeline", "PUT", alice.cookie, { eventId, payload: { amountL: 50 } }));
    expect(invalid.status).toBe(400);
  });

  it("handles a bad limit instead of reporting the database offline", async () => {
    const alice = await createUser("alice@example.com");
    expect((await timelineGET(call("/api/timeline?limit=abc", "GET", alice.cookie))).status).toBe(200);
  });

  it("does not let clients create habit events directly", async () => {
    const alice = await createUser("alice@example.com");
    const res = await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "habit", payload: {} }));
    expect(res.status).toBe(400);
  });
});

describe("Profile", () => {
  it("rejects impossible biometrics and malformed JSON", async () => {
    const alice = await createUser("alice@example.com");
    const res = await profilePOST(call("/api/profile", "POST", alice.cookie, { ...profileBody, age: -5 }));
    expect(res.status).toBe(400);

    const malformed = new NextRequest("http://localhost/api/profile", { method: "POST", headers: { cookie: alice.cookie }, body: "{oops" });
    expect((await profilePOST(malformed)).status).toBe(400);
  });

  it("upgrades the session cookie once the profile exists", async () => {
    const res = await profilePOST(call("/api/profile", "POST", cookieFor("new@example.com", null), profileBody));
    expect(res.headers.get("set-cookie")).toContain(SESSION_COOKIE);
  });

  it("keeps a stored target weight when an update omits it", async () => {
    const alice = await createUser("alice@example.com");
    await profilePOST(call("/api/profile", "POST", alice.cookie, { ...profileBody, targetWeightKg: 68 }));
    await profilePOST(call("/api/profile", "POST", alice.cookie, profileBody));
    expect((await UserProfile.findById(alice.id).lean())?.targetWeightKg).toBe(68);
  });

  it("deleting an account removes all of the user's data and clears the cookie", async () => {
    const alice = await createUser("alice@example.com");
    const bob = await createUser("bob@example.com");
    await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "weight", payload: { weightKg: 70 } }));
    await timelinePOST(call("/api/timeline", "POST", bob.cookie, { type: "weight", payload: { weightKg: 80 } }));
    await habitsGET(call("/api/habits", "GET", alice.cookie));
    await habitsPOST(call("/api/habits", "POST", alice.cookie, { action: "checkin", checkin: { habitId: "habit_hydration", completed: true } }));

    const res = await profileDELETE(call("/api/profile", "DELETE", alice.cookie));
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");

    expect(await UserProfile.countDocuments({ email: "alice@example.com" })).toBe(0);
    expect(await TimelineEvent.countDocuments({ userId: alice.id })).toBe(0);
    expect(await Habit.countDocuments({ userId: alice.id })).toBe(0);
    expect(await HabitLog.countDocuments({ userId: alice.id })).toBe(0);
    expect(await TimelineEvent.countDocuments({ userId: bob.id })).toBe(1);
  });
});

describe("Habits", () => {
  it("seeds safely when two first loads race", async () => {
    const alice = await createUser("alice@example.com");
    const results = await Promise.all([
      habitsGET(call("/api/habits", "GET", alice.cookie)),
      habitsGET(call("/api/habits", "GET", alice.cookie)),
    ]);
    expect(results.map((res) => res.status)).toEqual([200, 200]);
    expect(await Habit.countDocuments({ userId: alice.id })).toBe(4);
  });

  it("keeps exactly one timeline event per habit per day", async () => {
    const alice = await createUser("alice@example.com");
    await habitsGET(call("/api/habits", "GET", alice.cookie));
    const checkin = (completed: boolean) =>
      habitsPOST(call("/api/habits", "POST", alice.cookie, { action: "checkin", checkin: { habitId: "habit_hydration", completed, value: completed ? 3.5 : 0 } }));

    expect((await checkin(true)).status).toBe(200);
    await checkin(true);
    expect(await TimelineEvent.countDocuments({ userId: alice.id, type: "habit" })).toBe(1);

    await checkin(false);
    expect(await TimelineEvent.countDocuments({ userId: alice.id, type: "habit" })).toBe(0);
  });

  it("counts logged water towards the hydration habit", async () => {
    const alice = await createUser("alice@example.com");
    await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "water", payload: { amountL: 2 } }));
    await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "water", payload: { amountL: 1.5 } }));

    const { habits } = await (await habitsGET(call("/api/habits", "GET", alice.cookie))).json();
    const hydration = habits.find((habit: { id: string }) => habit.id === "habit_hydration");
    expect(hydration.completedToday).toBe(true);
    expect(hydration.todayValue).toBe(3.5);
  });

  it("deletes a habit along with its history", async () => {
    const alice = await createUser("alice@example.com");
    await habitsGET(call("/api/habits", "GET", alice.cookie));
    await habitsPOST(call("/api/habits", "POST", alice.cookie, { action: "checkin", checkin: { habitId: "habit_hydration", completed: true } }));

    const res = await habitsPOST(call("/api/habits", "POST", alice.cookie, { action: "delete", habitId: "habit_hydration" }));
    expect(res.status).toBe(200);
    expect(await Habit.countDocuments({ userId: alice.id, habitId: "habit_hydration" })).toBe(0);
    expect(await HabitLog.countDocuments({ userId: alice.id, habitId: "habit_hydration" })).toBe(0);
  });
});

describe("Weekly review window", () => {
  it("covers exactly seven calendar days", async () => {
    const alice = await createUser("alice@example.com");
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "meal", timestamp: daysAgo(5), payload: { totalCalories: 1000 } }));
    await timelinePOST(call("/api/timeline", "POST", alice.cookie, { type: "meal", timestamp: daysAgo(8), payload: { totalCalories: 9000 } }));

    const { review } = await (await reviewGET(call("/api/review", "GET", alice.cookie))).json();
    expect(review.nutrition.daysLogged).toBe(1);
    expect(review.nutrition.avgCalories).toBe(1000);
  });
});

describe("OTP login", () => {
  async function requestCode(email: string): Promise<{ res: Response; code: string }> {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await sendOtp(call("/api/auth/send-otp", "POST", undefined, { email }));
    const code = String(info.mock.calls[0]?.[0] ?? "").slice(-6);
    info.mockRestore();
    return { res, code };
  }

  const verify = (email: string, otp: string) => verifyOtp(call("/api/auth/verify-otp", "POST", undefined, { email, otp }));

  it("never sends anything derived from the code to the client", async () => {
    const { res } = await requestCode("otp1@example.com");
    expect(await res.json()).toEqual({ success: true, message: "OTP sent successfully" });
  });

  it("issues a session on a correct code, once only", async () => {
    const { code } = await requestCode("otp2@example.com");

    const first = await verify("otp2@example.com", code);
    expect(first.status).toBe(200);
    expect(first.headers.get("set-cookie")).toContain("HttpOnly");

    expect((await verify("otp2@example.com", code)).status).toBe(401);
  });

  it("locks the code after too many wrong guesses", async () => {
    const { code } = await requestCode("otp3@example.com");
    const wrong = code === "111111" ? "222222" : "111111";

    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) {
      expect((await verify("otp3@example.com", wrong)).status).toBe(401);
    }
    expect((await verify("otp3@example.com", code)).status).toBe(401);
  });

  it("enforces a resend cooldown", async () => {
    await requestCode("otp4@example.com");
    const { res } = await requestCode("otp4@example.com");
    expect(res.status).toBe(429);
  });

  it("rejects malformed input without a server error", async () => {
    expect((await sendOtp(call("/api/auth/send-otp", "POST", undefined, { email: { $ne: 1 } }))).status).toBe(400);
    expect((await verify("otp5@example.com", "abc")).status).toBe(400);
  });
});

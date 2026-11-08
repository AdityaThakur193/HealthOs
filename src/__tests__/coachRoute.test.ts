import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import * as geminiModule from "../lib/gemini";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session";
import { UserProfile } from "../lib/db/models";
import { DEFAULT_MESS_TIMINGS } from "../lib/mealWindows";
import { POST as coachPOST } from "../app/api/coach/route";
import { POST as profilePOST } from "../app/api/profile/route";
import { POST as timelinePOST } from "../app/api/timeline/route";

vi.mock("../lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof geminiModule>()),
  generateDailyCoach: vi.fn(),
}));

const generate = vi.mocked(geminiModule.generateDailyCoach);
const TZ = "Asia/Kolkata";
const email = "coach@example.com";

const profileBody = {
  name: "Coach Test",
  age: 25,
  gender: "male",
  heightCm: 175,
  weightKg: 75,
  goal: "maintain",
  activityLevel: "moderate",
  gymExperience: "beginner",
};

let server: MongoMemoryServer;

function call(path: string, cookie: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const cookieFor = (userId: string | null) => `${SESSION_COOKIE}=${createSessionToken({ email, userId, tz: TZ })}`;

async function createUser(extra: object = {}) {
  const res = await profilePOST(call("/api/profile", cookieFor(null), { ...profileBody, ...extra }));
  const { profile } = await res.json();
  return cookieFor(String(profile._id));
}

const advice = (insight: string) => ({
  greeting: "Hi",
  status: "on_track" as const,
  primaryInsight: insight,
  actionItems: ["Drink some water."],
  motivation: "Keep going.",
});

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
  generate.mockReset();
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  vi.useFakeTimers({ toFake: ["Date"] });
  // A Monday afternoon in India: breakfast and lunch are over.
  vi.setSystemTime(new Date("2026-11-09T15:00:00+05:30"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Coach message caching", () => {
  it("reuses the message while nothing has changed", async () => {
    generate.mockResolvedValue(advice("Steady day."));
    const cookie = await createUser();

    await coachPOST(call("/api/coach", cookie));
    const second = await (await coachPOST(call("/api/coach", cookie))).json();

    expect(generate).toHaveBeenCalledTimes(1);
    expect(second.recommendation.primaryInsight).toBe("Steady day.");
  });

  it("writes a new message after a log", async () => {
    generate.mockResolvedValue(advice("Steady day."));
    const cookie = await createUser();

    await coachPOST(call("/api/coach", cookie));
    await timelinePOST(call("/api/timeline", cookie, { type: "meal", payload: { totalCalories: 500, totalProteinG: 30 } }));
    await coachPOST(call("/api/coach", cookie));

    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("writes a new message when the next meal opens", async () => {
    generate.mockResolvedValue(advice("Steady day."));
    const cookie = await createUser();

    await coachPOST(call("/api/coach", cookie));
    vi.setSystemTime(new Date("2026-11-09T16:45:00+05:30"));
    await coachPOST(call("/api/coach", cookie));

    expect(generate).toHaveBeenCalledTimes(2);
  });
});

describe("Coach and closed meals", () => {
  it("replaces advice that points at a closed meal, and doesn't save it", async () => {
    generate.mockResolvedValue(advice("Eat extra rice at lunch."));
    const cookie = await createUser();

    const { recommendation } = await (await coachPOST(call("/api/coach", cookie))).json();
    expect(recommendation.primaryInsight).not.toContain("lunch");

    await coachPOST(call("/api/coach", cookie));
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("gives the AI only the meals that are still available", async () => {
    generate.mockResolvedValue(advice("Steady day."));
    const cookie = await createUser({
      messMenu: { parsedMenu: { monday: { breakfast: "Poha", lunch: "Rajma", snacks: "Samosa", dinner: "Paneer" } } },
    });

    await coachPOST(call("/api/coach", cookie));

    const context = generate.mock.calls[0][0];
    expect(context.todayMessMenu).toEqual({ snacks: "Samosa", dinner: "Paneer" });
    expect(context.mealTiming?.currentMeal).toBeNull();
    expect(context.mealTiming?.nextMeal).toBe("snacks");
  });
});

describe("Saving mess hours", () => {
  it("rejects a closing time before the opening time", async () => {
    const cookie = await createUser();
    const bad = { ...DEFAULT_MESS_TIMINGS, regular: { ...DEFAULT_MESS_TIMINGS.regular, lunch: { start: "14:00", end: "11:00" } } };
    const res = await profilePOST(call("/api/profile", cookie, { ...profileBody, messTimings: bad }));
    expect(res.status).toBe(400);
  });

  it("saves hours without disturbing other settings", async () => {
    const cookie = await createUser({ useCustomMacros: true, customCalories: 2100, neckCm: 38, waistCm: 80 });

    await profilePOST(call("/api/profile", cookie, { ...profileBody, messTimings: DEFAULT_MESS_TIMINGS }));

    const saved = await UserProfile.findOne({ email }).lean();
    expect(saved?.messTimings?.holiday.breakfast.start).toBe("07:30");
    expect(saved?.customCalories).toBe(2100);
    expect(saved?.targetCalories).toBe(2100);
    expect(saved?.neckCm).toBe(38);
  });
});

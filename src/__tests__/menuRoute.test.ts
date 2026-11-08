import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import * as geminiModule from "../lib/gemini";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session";
import { groundCoachMeal } from "../lib/coachRules";
import { TimelineEvent } from "../lib/db/models";
import { GET as menuGET } from "../app/api/mess-menu/today/route";
import { POST as profilePOST } from "../app/api/profile/route";
import { POST as timelinePOST } from "../app/api/timeline/route";

vi.mock("../lib/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof geminiModule>()),
  estimateMessFoods: vi.fn(),
}));

const estimate = vi.mocked(geminiModule.estimateMessFoods);
const email = "menu@example.com";
let server: MongoMemoryServer;

const day = { breakfast: "Poha", lunch: "Rajma Chawal, Roti, Aloo Sabzi", snacks: "Samosa", dinner: "Paneer, Roti" };
const parsedMenu = { monday: day };

const profileBody = {
  name: "Menu Test",
  age: 25,
  gender: "male",
  heightCm: 175,
  weightKg: 75,
  goal: "maintain",
  activityLevel: "moderate",
  gymExperience: "beginner",
};

function request(path: string, method: string, cookie: string, body?: unknown) {
  return new NextRequest(`http://localhost${path}`, { method, headers: { cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
}

const cookieFor = (userId: string | null) => `${SESSION_COOKIE}=${createSessionToken({ email, userId, tz: "Asia/Kolkata" })}`;

async function createUser(extra: object = { messMenu: { parsedMenu } }) {
  const res = await profilePOST(request("/api/profile", "POST", cookieFor(null), { ...profileBody, ...extra }));
  return cookieFor(String((await res.json()).profile._id));
}

const today = async (cookie: string, query = "") => (await menuGET(request(`/api/mess-menu/today${query}`, "GET", cookie))).json();

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
  estimate.mockReset();
  estimate.mockResolvedValue({ "aloo sabzi": { unit: "katori", grams: 150, calories: 160, proteinG: 3, carbsG: 22, fatG: 7 } });
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-09T12:30:00+05:30")); // Monday lunch
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Today's menu", () => {
  it("opens on the meal being served, split into individual foods", async () => {
    const data = await today(await createUser());
    expect(data.available).toBe(true);
    expect(data.meal).toBe("lunch");
    expect(data.foods.map((food: { name: string }) => food.name)).toEqual(["Rajma", "Chawal", "Roti", "Aloo Sabzi"]);
  });

  it("can show any meal of the day", async () => {
    const data = await today(await createUser(), "?meal=dinner");
    expect(data.meal).toBe("dinner");
    expect(data.foods[0].name).toBe("Paneer");
  });

  it("marks IFCT and estimated foods, and handles a failed estimate", async () => {
    const data = await today(await createUser());
    const source = (name: string) => data.foods.find((food: { name: string }) => food.name === name).source;
    expect(source("Roti")).toBe("ifct");
    expect(source("Aloo Sabzi")).toBe("estimated");

    estimate.mockRejectedValue(new Error("AI down"));
    vi.setSystemTime(new Date("2026-11-09T12:31:00+05:30"));
    await mongoose.connection.dropDatabase();
    const noAi = await today(await createUser());
    expect(noAi.foods.find((food: { name: string }) => food.name === "Aloo Sabzi").source).toBe("unknown");
  });

  it("only asks the AI about a dish once", async () => {
    const cookie = await createUser();
    await today(cookie);
    await today(cookie);
    expect(estimate).toHaveBeenCalledTimes(1);
  });

  it("offers the last amount without logging anything", async () => {
    const cookie = await createUser();
    await timelinePOST(request("/api/timeline", "POST", cookie, {
      type: "meal",
      timestamp: "2026-11-08T13:00:00+05:30",
      payload: { totalCalories: 258, foods: [{ name: "Roti", quantity: 3 }] },
    }));
    const before = await TimelineEvent.countDocuments();

    const data = await today(cookie);

    expect(data.foods.find((food: { name: string }) => food.name === "Roti").lastQuantity).toBe(3);
    expect(data.foods.find((food: { name: string }) => food.name === "Rajma").lastQuantity).toBeNull();
    expect(await TimelineEvent.countDocuments()).toBe(before);
  });

  it("reports unavailable when there is no menu or no mess", async () => {
    expect((await today(await createUser({}))).available).toBe(false);
    await mongoose.connection.dropDatabase();
    expect((await today(await createUser({ messMenu: { parsedMenu }, messAccess: "home_cooked" }))).available).toBe(false);
  });

  it("requires a session", async () => {
    expect((await menuGET(new NextRequest("http://localhost/api/mess-menu/today"))).status).toBe(401);
  });
});

describe("Chat meal numbers", () => {
  it("uses IFCT when the food and amount are known", () => {
    const meal = groundCoachMeal({
      items: [{ name: "Roti", quantity: 3, unit: "piece", estimatedCalories: 999, proteinG: 99 }],
      totalCalories: 999,
    });
    expect(meal.items?.[0]).toMatchObject({ estimatedCalories: 257, proteinG: 9.6, estimated: false });
    expect(meal.totalCalories).toBe(257);
    expect(meal.totalProtein).toBe(9.6);
  });

  it("keeps and labels the AI's numbers for anything else", () => {
    const meal = groundCoachMeal({ items: [{ name: "Pizza Slice", quantity: 2, estimatedCalories: 500, proteinG: 18 }] });
    expect(meal.items?.[0]).toMatchObject({ estimatedCalories: 500, estimated: true });
    expect(meal.totalCalories).toBe(500);
  });

  it("doesn't mistake a dish for its main ingredient", () => {
    const meal = groundCoachMeal({ items: [{ name: "Rice Kheer", quantity: 1, unit: "katori", estimatedCalories: 300, proteinG: 7 }] });
    expect(meal.items?.[0]).toMatchObject({ estimatedCalories: 300, estimated: true });
  });

  it("adds up a mixed meal", () => {
    const meal = groundCoachMeal({
      items: [
        { name: "Roti", quantity: 2, unit: "piece", estimatedCalories: 1, proteinG: 1 },
        { name: "Pizza Slice", quantity: 1, estimatedCalories: 250, proteinG: 9 },
      ],
    });
    expect(meal.totalCalories).toBe(172 + 250);
  });
});

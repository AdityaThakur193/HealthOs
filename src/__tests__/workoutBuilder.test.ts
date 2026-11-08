import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../lib/auth/session";
import { UserProfile } from "../lib/db/models";
import { normalizeCoachReply } from "../lib/coachRules";
import { applyWorkoutDayEdit, buildTemplateWeek, getTodaysWorkout, getWeekSchedule, sanitizeWeekPlan, WeekPlan } from "../lib/workoutPlans";
import { DELETE as planDELETE, GET as planGET, PATCH as planPATCH, PUT as planPUT } from "../app/api/workout-plan/route";
import { POST as profilePOST } from "../app/api/profile/route";

const training = (week: WeekPlan) => Object.values(week).filter((day) => day.exercises.length > 0);

describe("Default templates", () => {
  it.each([3, 4, 5, 6])("%i days gives exactly that many real sessions", (frequency) => {
    const days = training(buildTemplateWeek(frequency));
    expect(days).toHaveLength(frequency);
    for (const day of days) expect(day.exercises.length).toBeGreaterThanOrEqual(4);
  });

  it("schedules a real program for every planned day", () => {
    for (const frequency of [3, 4, 5, 6]) {
      for (const { day } of getWeekSchedule(frequency)) {
        expect(getTodaysWorkout({ gymFrequency: frequency }, day).exercises.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses the 4-day template for an unsupported number of days", () => {
    expect(getWeekSchedule(2)).toEqual(getWeekSchedule(4));
  });

  it("contains no one's personal day names", () => {
    const names = Object.values(buildTemplateWeek(4)).map((day) => day.name).join(" ");
    expect(names).not.toMatch(/Custom|Chest & Back/);
  });
});

describe("Saving a plan", () => {
  const week = () => structuredClone(buildTemplateWeek(4));

  it("accepts a template unchanged", () => {
    const result = sanitizeWeekPlan(week()) as WeekPlan;
    expect(training(result)).toHaveLength(4);
    expect(result[2].exercises[0].youtubeId).toBeDefined();
  });

  it("keeps a personal plan's own exercises", () => {
    const plan = week();
    plan[2].exercises[0] = { id: "smith_machine_squat", name: "Smith Machine Squats", muscle: "quads", equipment: "machine", targetSets: 4, targetReps: "6-10", restSeconds: 120 };
    expect((sanitizeWeekPlan(plan) as WeekPlan)[2].exercises[0].name).toBe("Smith Machine Squats");
  });

  it("treats a day with no exercises as a rest day", () => {
    const plan = week();
    plan[2].exercises = [];
    expect((sanitizeWeekPlan(plan) as WeekPlan)[2].name).toBe("Rest Day");
  });

  it("rejects impossible values with a clear message", () => {
    const plan = week();
    plan[2].exercises[0].targetSets = 50;
    expect(sanitizeWeekPlan(plan)).toContain("sets must be between 1 and 10");

    const reps = week();
    reps[2].exercises[0].targetReps = "<script>";
    expect(sanitizeWeekPlan(reps)).toContain("enter reps like 8-12");

    expect(sanitizeWeekPlan("nope")).toContain("isn't valid");
    expect(sanitizeWeekPlan({})).toContain("list of exercises");
  });

  it("drops an unsafe video id", () => {
    const plan = week();
    plan[2].exercises[0] = { id: "my_lift", name: "My Lift", muscle: "x", equipment: "machine", targetSets: 3, targetReps: "10", restSeconds: 60, youtubeId: "x\"><script>" };
    expect((sanitizeWeekPlan(plan) as WeekPlan)[2].exercises[0].youtubeId).toBeUndefined();
  });

  it("removes a duplicate exercise", () => {
    const plan = week();
    plan[2].exercises.push({ ...plan[2].exercises[0] });
    const count = plan[2].exercises.length;
    expect((sanitizeWeekPlan(plan) as WeekPlan)[2].exercises).toHaveLength(count - 1);
  });
});

describe("Coach day edits", () => {
  const week = () => buildTemplateWeek(4);

  it("adds a library exercise from a plain name, with its video", () => {
    const result = applyWorkoutDayEdit(week(), { day: "tuesday", add: [{ name: "hammer curl", sets: 4, reps: "10-12" }] }) as WeekPlan;
    const added = result[2].exercises.find((exercise) => exercise.id === "hammer_curl");
    expect(added).toMatchObject({ targetSets: 4, targetReps: "10-12" });
    expect(added?.youtubeId).toBeDefined();
  });

  it("adds an exercise that isn't in the library", () => {
    const result = applyWorkoutDayEdit(week(), { day: "tuesday", add: [{ name: "Sled Push" }] }) as WeekPlan;
    expect(result[2].exercises.some((exercise) => exercise.id === "custom_sled_push")).toBe(true);
  });

  it("removes an exercise and leaves other days alone", () => {
    const original = week();
    const result = applyWorkoutDayEdit(original, { day: "wednesday", remove: ["leg extension"] }) as WeekPlan;
    expect(result[3].exercises.some((exercise) => exercise.id === "leg_extension")).toBe(false);
    expect(result[2]).toEqual(original[2]);
  });

  it("makes a day a rest day, and a rest day a training day", () => {
    expect((applyWorkoutDayEdit(week(), { day: "tuesday", rest: true }) as WeekPlan)[2].exercises).toHaveLength(0);
    const monday = applyWorkoutDayEdit(week(), { day: "monday", add: [{ name: "Plank" }] }) as WeekPlan;
    expect(monday[1].name).toBe("Workout");
    expect(monday[1].exercises).toHaveLength(1);
  });

  it("asks which day when it can't tell", () => {
    expect(applyWorkoutDayEdit(week(), { day: "someday" })).toContain("which day");
  });

  it("is an allowed coach action", () => {
    expect(normalizeCoachReply({ action: "update_workout_day", updatedData: { day: "monday", rest: true } }).action).toBe("update_workout_day");
  });
});

describe("Workout plan routes", () => {
  let server: MongoMemoryServer;
  const email = "plan@example.com";
  const profileBody = { name: "P", age: 25, gender: "male", heightCm: 175, weightKg: 75, goal: "maintain", activityLevel: "moderate", gymExperience: "beginner", gymFrequency: 4 };

  const request = (method: string, cookie: string, body?: unknown) =>
    new NextRequest("http://localhost/api/workout-plan", { method, headers: { cookie }, body: body === undefined ? undefined : JSON.stringify(body) });

  async function createUser() {
    const first = `${SESSION_COOKIE}=${createSessionToken({ email, userId: null })}`;
    const res = await profilePOST(new NextRequest("http://localhost/api/profile", { method: "POST", headers: { cookie: first }, body: JSON.stringify(profileBody) }));
    const id = String((await res.json()).profile._id);
    return { id, cookie: `${SESSION_COOKIE}=${createSessionToken({ email, userId: id })}` };
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
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  });

  it("requires a session", async () => {
    expect((await planGET(new NextRequest("http://localhost/api/workout-plan"))).status).toBe(401);
  });

  it("starts from the template", async () => {
    const { cookie } = await createUser();
    const data = await (await planGET(request("GET", cookie))).json();
    expect(data.isCustom).toBe(false);
    expect(data.week).toEqual(data.template);
    expect(data.library.length).toBeGreaterThan(20);
  });

  it("saves edits and uses them for that day", async () => {
    const { id, cookie } = await createUser();
    const { week } = await (await planGET(request("GET", cookie))).json();
    week[2].name = "Big Tuesday";

    expect((await planPUT(request("PUT", cookie, { plan: week }))).status).toBe(200);

    const saved = await UserProfile.findById(id).lean();
    expect((saved?.customWorkoutPlan as WeekPlan)[2].name).toBe("Big Tuesday");
    expect((await (await planGET(request("GET", cookie))).json()).isCustom).toBe(true);
  });

  it("rejects an invalid plan without saving it", async () => {
    const { id, cookie } = await createUser();
    expect((await planPUT(request("PUT", cookie, { plan: {} }))).status).toBe(400);
    expect((await UserProfile.findById(id).lean())?.customWorkoutPlan).toBeUndefined();
  });

  it("changes one day through the coach", async () => {
    const { id, cookie } = await createUser();
    expect((await planPATCH(request("PATCH", cookie, { day: "tuesday", add: [{ name: "Plank" }] }))).status).toBe(200);
    const saved = (await UserProfile.findById(id).lean())?.customWorkoutPlan as WeekPlan;
    expect(saved[2].exercises.some((exercise) => exercise.id === "plank")).toBe(true);
    expect(saved[3].exercises.length).toBeGreaterThan(0);
  });

  it("goes back to the template", async () => {
    const { id, cookie } = await createUser();
    await planPATCH(request("PATCH", cookie, { day: "tuesday", rest: true }));
    await planDELETE(request("DELETE", cookie));
    expect((await UserProfile.findById(id).lean())?.customWorkoutPlan).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { buildMealDayStatus, DEFAULT_MESS_TIMINGS, formatMealTime, inferMealName, MealDayStatus, pointsAtClosedMeal, resolveMessTimings } from "../lib/mealWindows";
import { buildCoachContext, coachFingerprint } from "../lib/coachContext";
import { buildRuleBasedCoach } from "../lib/coachRules";
import { isValidMessTimings } from "../lib/validation";
import type { LeanUserProfile } from "../lib/db/models";
import type { TimelineLike } from "../lib/tdee";

const TZ = "Asia/Kolkata";
// 2026-11-09 is a Monday and 2026-11-08 is a Sunday.
const monday = (time: string) => new Date(`2026-11-09T${time}:00+05:30`);
const sunday = (time: string) => new Date(`2026-11-08T${time}:00+05:30`);

function status(now: Date, isHoliday = false, mealLogs: { timestamp: Date; mealType?: unknown }[] = []): MealDayStatus {
  return buildMealDayStatus({ now, tz: TZ, timings: DEFAULT_MESS_TIMINGS, isHoliday, mealLogs });
}

const states = (day: MealDayStatus) => day.meals.map((meal) => meal.state);

describe("Mess meal windows", () => {
  it("marks each meal open, upcoming or closed", () => {
    expect(states(status(monday("08:00")))).toEqual(["open", "upcoming", "upcoming", "upcoming"]);
    expect(states(status(monday("15:00")))).toEqual(["closed", "closed", "upcoming", "upcoming"]);
    expect(states(status(monday("20:00")))).toEqual(["closed", "closed", "closed", "open"]);
  });

  it("knows when the mess is finished for the day", () => {
    const late = status(monday("22:00"));
    expect(late.messClosedForToday).toBe(true);
    expect(late.currentMeal).toBeNull();
    expect(late.nextMeal).toBeNull();
  });

  it("treats a meal's closing minute as closed", () => {
    expect(status(monday("21:30")).meals[3].state).toBe("closed");
    expect(status(monday("21:29")).meals[3].state).toBe("open");
  });

  it("uses the later breakfast on Sundays", () => {
    const early = status(sunday("07:15"));
    expect(early.dayType).toBe("sunday_or_holiday");
    expect(early.meals[0].state).toBe("upcoming");
    expect(status(sunday("09:15")).meals[0].state).toBe("open");
    expect(status(monday("09:15")).meals[0].state).toBe("closed");
  });

  it("uses the later breakfast on a marked holiday, and keeps other meals the same", () => {
    const holiday = status(monday("09:15"), true);
    expect(holiday.meals[0].state).toBe("open");
    expect(holiday.meals[1].hours).toBe("11:30 AM to 2:00 PM");
  });

  it("uses the user's timezone rather than the server's", () => {
    // 02:30 UTC is 08:00 in India.
    expect(status(new Date("2026-11-09T02:30:00Z")).currentMeal).toBe("breakfast");
  });

  it("works out which meal a log belongs to", () => {
    const schedule = DEFAULT_MESS_TIMINGS.regular;
    expect(inferMealName(12 * 60, schedule)).toBe("lunch");
    expect(inferMealName(22 * 60, schedule)).toBe("dinner");
    expect(inferMealName(12 * 60, schedule, "Snack")).toBe("snacks");
  });

  it("records which meals have been logged", () => {
    const day = status(monday("13:00"), false, [{ timestamp: monday("08:15") }]);
    expect(day.meals[0].logged).toBe(true);
    expect(day.meals[1].logged).toBe(false);
  });

  it("formats 12-hour times", () => {
    expect(formatMealTime("00:05")).toBe("12:05 AM");
    expect(formatMealTime("12:00")).toBe("12:00 PM");
    expect(formatMealTime("19:30")).toBe("7:30 PM");
  });
});

describe("Closed-meal guard", () => {
  const afterLunch = status(monday("15:00"));

  it("flags advice to eat at a closed meal", () => {
    expect(pointsAtClosedMeal(["Add double curd at lunch."], afterLunch)).toBe(true);
    expect(pointsAtClosedMeal(["Have extra dal for breakfast."], afterLunch)).toBe(true);
  });

  it("allows open and upcoming meals", () => {
    expect(pointsAtClosedMeal(["Add curd at dinner."], afterLunch)).toBe(false);
    expect(pointsAtClosedMeal(["Grab protein at snacks."], afterLunch)).toBe(false);
  });

  it("allows references to tomorrow or the past", () => {
    expect(pointsAtClosedMeal(["Start strong at breakfast tomorrow."], afterLunch)).toBe(false);
    expect(pointsAtClosedMeal(["You logged lunch, nice work."], afterLunch)).toBe(false);
  });

  it("checks each sentence on its own", () => {
    expect(pointsAtClosedMeal(["Great work tomorrow will be better. Eat more at lunch."], afterLunch)).toBe(true);
  });
});

describe("Coach context", () => {
  const profile = {
    name: "A",
    goal: "maintain",
    targetCalories: 2000,
    targetProteinG: 150,
    gymFrequency: 3,
    messMenu: { parsedMenu: { monday: { breakfast: "Poha", lunch: "Rajma", snacks: "Samosa", dinner: "Paneer" } } },
  } as unknown as LeanUserProfile;

  const context = (now: Date, extra: Partial<LeanUserProfile> = {}, notes: TimelineLike[] = [], recentEvents: TimelineLike[] = []) =>
    buildCoachContext({ profile: { ...profile, ...extra }, recentEvents, notes, tz: TZ, now });

  it("only shows the coach meals that are still available", () => {
    expect(context(monday("15:00")).todayMessMenu).toEqual({ snacks: "Samosa", dinner: "Paneer" });
    expect(context(monday("22:00")).todayMessMenu).toBeNull();
  });

  it("drops mess timing for people who don't eat at a mess", () => {
    const home = context(monday("15:00"), { messAccess: "home_cooked" });
    expect(home.mealTiming).toBeNull();
    expect(home.todayMessMenu).toMatchObject({ breakfast: "Poha" });
  });

  it("treats a holiday as mess hours only, not a recovery day", () => {
    const holidayNote: TimelineLike = {
      type: "note",
      timestamp: monday("06:00"),
      payload: { title: "Diwali", event_type: "holiday", startDate: "2026-11-09", endDate: "2026-11-09" },
    };
    const result = context(monday("09:15"), {}, [holidayNote]);
    expect(result.mealTiming?.dayType).toBe("sunday_or_holiday");
    expect(result.activeEvent).toBeNull();
  });

  it("uses saved mess hours", () => {
    const messTimings = resolveMessTimings({ regular: { dinner: { start: "20:00", end: "23:00" } } });
    expect(context(monday("22:00"), { messTimings }).mealTiming?.currentMeal).toBe("dinner");
  });

  it("gets a new fingerprint only when the coach has something new to say", () => {
    const first = coachFingerprint(context(monday("15:00")), "2026-11-09");
    expect(coachFingerprint(context(monday("15:20")), "2026-11-09")).toBe(first);
    expect(coachFingerprint(context(monday("16:45")), "2026-11-09")).not.toBe(first);

    const meal: TimelineLike = { type: "meal", timestamp: monday("15:05"), payload: { totalCalories: 400, totalProteinG: 20 } };
    expect(coachFingerprint(context(monday("15:20"), {}, [], [meal]), "2026-11-09")).not.toBe(first);
  });
});

describe("Rule-based coach and mess hours", () => {
  const profile = { name: "A", dietPreference: "vegetarian" };
  const base = (now: Date, strictMessOnly = false) =>
    buildCoachContext({
      profile: { name: "A", goal: "maintain", targetCalories: 2000, targetProteinG: 150, strictMessOnly } as unknown as LeanUserProfile,
      recentEvents: [{ type: "workout", timestamp: now, payload: {} }],
      notes: [],
      tz: TZ,
      now,
    });

  it("names the open meal and when it closes", () => {
    expect(buildRuleBasedCoach(base(monday("12:00")), profile).actionItems.join(" ")).toContain("Lunch is open until 2:00 PM");
  });

  it("names the next meal when none is open", () => {
    expect(buildRuleBasedCoach(base(monday("15:00")), profile).actionItems.join(" ")).toContain("Snacks opens at 4:30 PM");
  });

  it("doesn't send anyone to a closed mess", () => {
    const text = buildRuleBasedCoach(base(monday("22:30")), profile).actionItems.join(" ");
    expect(text).toContain("The mess is closed for today");
    expect(text).toContain("no stress");
  });

  it("doesn't suggest room food in strict mess mode", () => {
    const text = buildRuleBasedCoach(base(monday("22:30"), true), profile).actionItems.join(" ");
    expect(text).not.toContain("in your room");
    expect(text).toContain("tomorrow");
  });
});

describe("Mess hours validation", () => {
  it("accepts the defaults", () => {
    expect(isValidMessTimings(DEFAULT_MESS_TIMINGS)).toBe(true);
  });

  it("rejects missing meals, bad times and backwards windows", () => {
    expect(isValidMessTimings({ regular: {}, holiday: {} })).toBe(false);
    const bad = resolveMessTimings({ regular: { lunch: { start: "14:00", end: "11:30" } } });
    expect(isValidMessTimings(bad)).toBe(false);
    const typo = resolveMessTimings({ regular: { lunch: { start: "25:00", end: "26:00" } } });
    expect(isValidMessTimings(typo)).toBe(false);
  });
});

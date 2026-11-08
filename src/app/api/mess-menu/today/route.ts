import { NextRequest } from "next/server";
import { buildCoachContext } from "@/lib/coachContext";
import { loadCoachSnapshot } from "@/lib/coachData";
import { findFoodsNeedingEstimates, parseMenuItems, toMenuFood, WEEK_DAYS } from "@/lib/dietPlanner";
import { loadFoodEstimates } from "@/lib/foodEstimates";
import { MEAL_NAMES, MealDayStatus, MealName } from "@/lib/mealWindows";
import { weekdayIndex } from "@/lib/dateUtils";
import { requireUserSession } from "@/lib/auth/session";
import type { TimelineLike } from "@/lib/tdee";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

/** The open meal, else a recent meal not yet logged, else the next one. */
function defaultMeal(timing: MealDayStatus): MealName {
  if (timing.currentMeal) return timing.currentMeal;
  const unloggedClosed = timing.meals.filter((meal) => meal.state === "closed" && !meal.logged).pop();
  return unloggedClosed?.meal ?? timing.nextMeal ?? "dinner";
}

/** The most recent amount of each food, used only as a starting suggestion. */
function lastAmounts(events: TimelineLike[]): Map<string, number> {
  const amounts = new Map<string, number>();
  const newestFirst = events
    .filter((event) => event.type === "meal")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  for (const event of newestFirst) {
    for (const food of (event.payload?.foods as { name?: string; quantity?: number }[] | undefined) ?? []) {
      const key = food.name?.toLowerCase();
      if (key && Number(food.quantity) > 0 && !amounts.has(key)) amounts.set(key, Number(food.quantity));
    }
  }
  return amounts;
}

export async function GET(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  try {
    const snapshot = await loadCoachSnapshot(session.userId, session.tz);
    if (!snapshot) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    const menu = snapshot.profile.messMenu?.parsedMenu as Record<string, Record<string, string> | undefined> | undefined;
    const today = DAY_NAMES[weekdayIndex(new Date(), session.tz)];
    const timing = buildCoachContext({ ...snapshot, tz: session.tz }).mealTiming;

    if (!menu || !timing || !WEEK_DAYS.some((day) => menu[day])) {
      return Response.json({ available: false });
    }

    const requested = request.nextUrl.searchParams.get("meal");
    const meal = MEAL_NAMES.includes(requested as MealName) ? (requested as MealName) : defaultMeal(timing);

    const estimates = await loadFoodEstimates(session.userId, findFoodsNeedingEstimates(menu));
    const amounts = lastAmounts(snapshot.recentEvents);

    return Response.json({
      available: true,
      meal,
      meals: timing.meals.map(({ meal: name, hours, state, logged }) => ({ meal: name, hours, state, logged })),
      foods: parseMenuItems(menu[today]?.[meal]).map((name) => ({
        ...toMenuFood(name, estimates),
        lastQuantity: amounts.get(name.toLowerCase()) ?? null,
      })),
    });
  } catch (error) {
    console.error("Today's menu error:", error);
    return Response.json({ error: "Could not load today's menu." }, { status: 500 });
  }
}

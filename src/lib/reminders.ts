import { formatMealTime, MEAL_NAMES, MealDayStatus, MealName, minutesFromTime } from "./mealWindows";

/** Remind only when a meal is about to close and hasn't been logged. */
export const REMIND_MINUTES_BEFORE_CLOSE = 60;

const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/, /(^|\.)push\.services\.mozilla\.com$/];

/** The server POSTs to this URL, so it must be a real browser push service. */
export function isAllowedPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && PUSH_HOSTS.some((host) => host.test(url.hostname));
  } catch {
    return false;
  }
}

export function resolveReminderMeals(saved: unknown): MealName[] {
  if (!Array.isArray(saved)) return [...MEAL_NAMES];
  return MEAL_NAMES.filter((meal) => saved.includes(meal));
}

function title(meal: string): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

export function findDueReminder(status: MealDayStatus, wanted: MealName[], alreadySent: string[]): MealName | null {
  const current = status.meals.find((meal) => meal.state === "open");
  if (!current || current.logged || !wanted.includes(current.meal) || alreadySent.includes(current.meal)) return null;

  const minutesLeft = minutesFromTime(current.end) - minutesFromTime(status.localClock);
  return minutesLeft <= REMIND_MINUTES_BEFORE_CLOSE ? current.meal : null;
}

export function buildReminderMessage(status: MealDayStatus, meal: MealName, menu: string | undefined) {
  const window = status.meals.find((candidate) => candidate.meal === meal);
  return {
    title: `${title(meal)} closes at ${formatMealTime(window?.end ?? "00:00")}`,
    body: menu ? `Today: ${menu.slice(0, 80)}. Tap to log it.` : "Tap to log it in a few seconds.",
    url: "/meal",
  };
}

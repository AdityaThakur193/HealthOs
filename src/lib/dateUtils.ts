/**
 * Timezone-aware calendar helpers.
 *
 * API routes run in UTC on serverless hosts while users live in their own
 * timezone (for IST, the UTC calendar day is wrong until 05:30 every morning).
 * Every server-side "today" must go through these helpers with the session's
 * timezone. When `tz` is undefined the runtime's local timezone is used.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Calendar date of an instant in the given timezone, as YYYY-MM-DD. */
export function dayKey(date: Date | string | number = new Date(), tz?: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}

/** Returns the YYYY-MM-DD key `days` days after `key` (negative goes back). */
export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD key. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 0 = Sunday ... 6 = Saturday, for an instant in the given timezone. */
export function weekdayIndex(date: Date = new Date(), tz?: string): number {
  return weekdayOfKey(dayKey(date, tz));
}

function timeZoneOffsetMs(instant: Date, tz?: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Minutes since midnight for an instant in the given timezone. */
export function minutesIntoDay(date: Date = new Date(), tz?: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get("hour") * 60 + get("minute");
}

/** The instant at which the calendar day `key` starts in the given timezone. */
export function startOfDayKey(key: string, tz?: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const offset = timeZoneOffsetMs(new Date(utcMidnight), tz);
  const candidate = utcMidnight - offset;
  // Re-check once: the offset can differ across a DST change.
  const corrected = timeZoneOffsetMs(new Date(candidate), tz);
  return new Date(corrected === offset ? candidate : utcMidnight - corrected);
}

/** Start of today (or `daysAgo` days before today) in the given timezone. */
export function startOfDay(tz?: string, daysAgo = 0, now: Date = new Date()): Date {
  return startOfDayKey(shiftDayKey(dayKey(now, tz), -daysAgo), tz);
}

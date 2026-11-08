/**
 * Fixed-window, in-memory rate limiter.
 *
 * Counters are per server instance, so on serverless hosts this is a
 * best-effort brake on runaway AI spend, not a hard global quota.
 */

const MAX_TRACKED_KEYS = 5000;
const windows = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_TRACKED_KEYS) {
      for (const [trackedKey, entry] of windows) {
        if (entry.resetAt <= now) windows.delete(trackedKey);
      }
      if (windows.size >= MAX_TRACKED_KEYS) {
        const oldest = windows.keys().next().value;
        if (oldest !== undefined) windows.delete(oldest);
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function rateLimitedResponse(): Response {
  return Response.json(
    { error: "Too many requests. Please wait a few minutes and try again." },
    { status: 429 }
  );
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

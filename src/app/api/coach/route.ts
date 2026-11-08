import { NextRequest } from "next/server";
import { CoachRecommendation, generateDailyCoach } from "@/lib/gemini";
import { buildRuleBasedCoach } from "@/lib/coachRules";
import { buildCoachContext, coachFingerprint } from "@/lib/coachContext";
import { loadCoachSnapshot, readCachedRecommendation, saveCachedRecommendation } from "@/lib/coachData";
import { pointsAtClosedMeal } from "@/lib/mealWindows";
import { requireUserSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/rateLimit";
import { dayKey } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

const HOUR_MS = 60 * 60 * 1000;
const COACH_AI_CALLS_PER_HOUR = 30;

/**
 * POST /api/coach
 */
export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  const { userId, tz } = session;

  try {
    const snapshot = await loadCoachSnapshot(userId, tz);
    if (!snapshot) {
      return Response.json({ error: "User profile not found" }, { status: 404 });
    }

    const context = buildCoachContext({ ...snapshot, tz });
    const fingerprint = coachFingerprint(context, dayKey(new Date(), tz));

    const cached = await readCachedRecommendation(userId, fingerprint);
    if (cached) return Response.json({ recommendation: cached, context });

    let recommendation: CoachRecommendation;
    try {
      if (!checkRateLimit(`coach:${userId}`, COACH_AI_CALLS_PER_HOUR, HOUR_MS)) {
        throw new Error("Coach AI rate limit reached");
      }
      recommendation = await generateDailyCoach(context);

      if (context.mealTiming && pointsAtClosedMeal([recommendation.primaryInsight, ...recommendation.actionItems], context.mealTiming)) {
        throw new Error("Coach suggested a meal that has already closed");
      }
      await saveCachedRecommendation(userId, fingerprint, recommendation);
    } catch (aiError) {
      console.warn("Coach AI unavailable, using rule-based coaching:", aiError);
      recommendation = buildRuleBasedCoach(context, snapshot.profile);
    }

    return Response.json({ recommendation, context });
  } catch (error) {
    console.error("Coach POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { LeanUserProfile, TimelineEvent, UserProfile } from "@/lib/db/models";
import { getLocalEvents, getLocalProfile, saveLocalProfile } from "@/lib/db/fallback";
import { calculateAdaptiveTdee, goalCalorieTarget, TimelineLike } from "@/lib/tdee";
import { DietPlan } from "@/lib/dietEngine";
import { buildWeeklyPlan, findFoodsNeedingEstimates, WEEK_DAYS } from "@/lib/dietPlanner";
import { loadFoodEstimates } from "@/lib/foodEstimates";
import { MEAL_NAMES, resolveMessTimings } from "@/lib/mealWindows";
import { requireUserSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rateLimit";
import { readJsonObject } from "@/lib/validation";

export const dynamic = "force-dynamic";

const PLANS_PER_HOUR = 30;

const MEAL_BY_LABEL: Record<string, string> = {
  Breakfast: "breakfast",
  Lunch: "lunch",
  "Evening Snack": "snacks",
  Dinner: "dinner",
};

function savedVariants(plan: LeanUserProfile["dietPlan"]): Record<string, number> {
  const generated = plan?.generatedPlan as DietPlan | undefined;
  const variants: Record<string, number> = {};
  for (const day of WEEK_DAYS) {
    for (const meal of generated?.[day]?.meals ?? []) {
      const key = MEAL_BY_LABEL[meal.name ?? ""];
      if (key && meal.variant) variants[`${day}:${key}`] = meal.variant;
    }
  }
  return variants;
}

function parseSwap(swap: unknown): { day: string; meal: string } | null {
  const candidate = swap as { day?: unknown; meal?: unknown } | null;
  if (!candidate || typeof candidate !== "object") return null;
  const meal = MEAL_BY_LABEL[String(candidate.meal)];
  const day = String(candidate.day);
  return meal && (WEEK_DAYS as readonly string[]).includes(day) && (MEAL_NAMES as readonly string[]).includes(meal) ? { day, meal } : null;
}

export async function POST(request: NextRequest) {
  const session = requireUserSession(request);
  if (session instanceof Response) return session;

  if (!checkRateLimit(`diet:${session.userId}`, PLANS_PER_HOUR, 60 * 60 * 1000)) {
    return rateLimitedResponse();
  }

  try {
    const body = (await readJsonObject(request)) ?? {};
    const { email } = session;

    let profile: LeanUserProfile | null = null;
    let events: TimelineLike[] = [];

    try {
      await connectDB();
      profile = await UserProfile.findOne({ email }).lean<LeanUserProfile>();
      if (profile) {
        events = await TimelineEvent.find({ userId: profile._id }).select("type timestamp payload.totalCalories payload.weightKg").lean();
      }
    } catch (dbErr) {
      if (process.env.NODE_ENV === "production") throw dbErr;
      console.warn("MongoDB offline during diet generation. Using local fallback file DB.");
      profile = (await getLocalProfile(email)) as unknown as LeanUserProfile | null;
      if (profile) events = await getLocalEvents({ userId: String(profile._id) });
    }

    if (!profile) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    const menu = profile.messMenu?.parsedMenu as Record<string, Record<string, string> | undefined> | undefined;
    if (!menu) {
      return Response.json({ error: "Please configure and parse your Mess Menu in profile settings first." }, { status: 400 });
    }

    const tdeeResult = calculateAdaptiveTdee(profile, events, session.tz);

    let targetCalories = profile.targetCalories || 2000;
    let targetProteinG = profile.targetProteinG || 150;

    if (profile.useCustomMacros) {
      targetCalories = profile.customCalories && profile.customCalories > 0 ? profile.customCalories : targetCalories;
      targetProteinG = profile.customProtein && profile.customProtein > 0 ? profile.customProtein : targetProteinG;
    } else if (tdeeResult.status === "adaptive") {
      targetCalories = goalCalorieTarget(tdeeResult.calculatedTdee, profile.goal, profile.gender, profile.age);
    }

    const variants = savedVariants(profile.dietPlan);
    if (body.swap !== undefined) {
      const swap = parseSwap(body.swap);
      if (!swap) return Response.json({ error: "That meal could not be found." }, { status: 400 });
      const key = `${swap.day}:${swap.meal}`;
      variants[key] = (variants[key] ?? 0) + 1;
    }

    const estimates = await loadFoodEstimates(session.userId, findFoodsNeedingEstimates(menu));

    const plan = buildWeeklyPlan({
      menu,
      profile: {
        targetCalories,
        targetProteinG,
        dietPreference: profile.dietPreference,
        foodAllergies: profile.foodAllergies,
        customDietPreferences: profile.customDietPreferences,
        strictMessOnly: typeof body.strictMessOnly === "boolean" ? body.strictMessOnly : profile.strictMessOnly,
      },
      timings: resolveMessTimings(profile.messTimings),
      estimates,
      variants,
    });

    const dietPlanData = { generatedPlan: plan, generatedAt: new Date().toISOString() };

    let savedProfile: unknown = null;
    try {
      await connectDB();
      savedProfile = await UserProfile.findOneAndUpdate({ email }, { dietPlan: dietPlanData }, { new: true });
    } catch (dbErr) {
      if (process.env.NODE_ENV === "production") throw dbErr;
      const local = await getLocalProfile(email);
      if (local) {
        local.dietPlan = dietPlanData;
        savedProfile = await saveLocalProfile(local);
      }
    }

    return Response.json({ success: true, dietPlan: plan, savedProfile });
  } catch (err) {
    console.error("Diet plan generation error:", err);
    return Response.json({ error: "Failed to build your diet plan" }, { status: 500 });
  }
}

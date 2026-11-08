import { EVENT_STEP_TARGETS } from "./constants";
import { auditAndFixDietPlanMath, DietPlan } from "./dietEngine";
import type { CoachContext, CoachRecommendation } from "./gemini";

interface CoachRulesProfile {
  name: string;
  dietPreference?: string;
  stepsTarget?: number;
  medicalConditions?: string[];
  collegeSchedule?: string;
}

function proteinSources(dietPreference?: string): string {
  switch (dietPreference) {
    case "vegan":
      return "tofu, soya chunks, or lentils";
    case "vegetarian":
      return "paneer, curd, tofu, or lentils";
    case "eggetarian":
      return "egg whites, paneer, or whey";
    default:
      return "egg whites, chicken breast, or whey";
  }
}

/**
 * Deterministic coaching used when no AI provider is available.
 */
export function buildRuleBasedCoach(context: CoachContext, profile: CoachRulesProfile): CoachRecommendation {
  const { today, activeEvent } = context;
  const proteinRemaining = Math.round(context.profile.targetProteinG - today.proteinConsumed);
  const workoutName = today.scheduledWorkoutName || "Rest Day";

  let status: CoachRecommendation["status"] = "on_track";
  let primaryInsight = "Your nutrition and logs are steady today. Keep focus on consistency.";
  let motivation = "Consistency beats perfection. Focus on stacking successful days.";
  const actionItems: string[] = [];

  if (activeEvent) {
    const label =
      activeEvent.event_type === "exam" ? "exam period" : activeEvent.event_type === "travel" ? "travel period" : "sick day";
    status = "needs_attention";
    primaryInsight = `Health OS adapted: We detected you are in your ${label}. Targets scaled down to prioritize recovery.`;
    motivation = "Health over perfection. Rest, recover, and focus on what matters most today.";
    actionItems.push("Prioritize rest and recover your physical & mental energy.");
    actionItems.push("Ensure you stay hydrated and have light, nourishing meals.");
    actionItems.push(
      activeEvent.event_type === "sick"
        ? "Zero workout session today. Focus entirely on sleep."
        : "Short 15-min recovery walks to clear your mind."
    );
  } else {
    if (today.sleepHours && today.sleepHours < 6) {
      status = "needs_attention";
      primaryInsight = `Sleep was short last night (${today.sleepHours}h). Your CNS recovery will be reduced today.`;
      actionItems.push("Reduce today's lifting volume by 15-20% and avoid heavy single-rep PRs.");
    } else if (proteinRemaining > 50 && today.caloriesConsumed > context.profile.targetCalories * 0.7) {
      status = "needs_attention";
      primaryInsight = "Calorie intake is high but protein is lagging. Prioritize lean protein sources next.";
    } else if (today.workoutCompleted && proteinRemaining <= 10) {
      status = "great_job";
      primaryInsight = "Outstanding performance today! Workout completed and macros are perfectly dialed in.";
    }

    if (today.workoutCompleted) {
      actionItems.push("Workout session logged successfully. Rest, rehydrate, and recover.");
    } else if (workoutName === "Rest Day") {
      actionItems.push("Today is a scheduled Rest Day. Focus on recovery, light mobility, and hydration.");
    } else {
      actionItems.push(`${workoutName} is scheduled. Focus on progressive overload suggestions (beat previous weights).`);
    }

    actionItems.push(
      proteinRemaining > 0
        ? `Need ${proteinRemaining}g more protein. Consider having ${proteinSources(profile.dietPreference)} to hit your target.`
        : "Protein target met for the day! Excellent job fueling your muscles."
    );
  }

  const stepsGoal = activeEvent ? EVENT_STEP_TARGETS[activeEvent.event_type] : profile.stepsTarget || EVENT_STEP_TARGETS.default;
  const stepsRemaining = stepsGoal - (today.stepsCount || 0);
  actionItems.push(
    stepsRemaining > 0
      ? `Aim for ${stepsGoal} steps today (${stepsRemaining} left). A short walk will clear your mind.`
      : "Step target achieved! Keeping your neat activity high is excellent."
  );

  if (!today.workoutCompleted) {
    const conditions = (profile.medicalConditions || []).map((condition) => condition.toLowerCase());
    if (conditions.some((c) => c.includes("shoulder"))) {
      actionItems.push("⚠️ Care: Maintain shoulder health. Swap overhead pressing with lateral raises today.");
    }
    if (conditions.some((c) => c.includes("knee") || c.includes("leg"))) {
      actionItems.push("⚠️ Care: Avoid heavy knee flexion. Limit squat depth or swap with leg extensions.");
    }
    if (profile.collegeSchedule) {
      motivation = `Training around your classes (${profile.collegeSchedule}) helps maintain consistency.`;
    }
  }

  return {
    greeting: `Hey ${profile.name}`,
    status,
    primaryInsight,
    actionItems: actionItems.slice(0, 3),
    motivation,
  };
}

const ALLOWED_ACTIONS = [
  "log_meal",
  "log_steps",
  "log_water",
  "log_sleep",
  "log_weight",
  "log_workout_done",
  "update_diet",
  "update_workout",
  "log_habit",
  "none",
];

/** Forces model output into the shape the client expects. */
export function normalizeCoachReply(raw: unknown): { message: string; action: string; updatedData: unknown } {
  const reply = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const action = typeof reply.action === "string" && ALLOWED_ACTIONS.includes(reply.action) ? reply.action : "none";
  let updatedData = action === "none" ? null : reply.updatedData ?? null;

  if (action === "update_diet" && updatedData && typeof updatedData === "object") {
    updatedData = auditAndFixDietPlanMath(updatedData as DietPlan);
  }

  return {
    message: typeof reply.message === "string" && reply.message ? reply.message : "Done.",
    action,
    updatedData,
  };
}

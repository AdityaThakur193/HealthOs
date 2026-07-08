import { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { TimelineEvent, UserProfile } from "@/lib/db/models";
import { getLocalProfileById, getLocalEvents } from "@/lib/db/fallback";
import { generateDailyCoach, CoachContext } from "@/lib/gemini";
import { getTodaysWorkout } from "@/lib/workoutPlans";
import { calculateAdaptiveTdee } from "@/lib/tdee";

/**
 * POST /api/coach
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    let profile: any = null;
    let todayEvents: any[] = [];
    let weekEvents: any[] = [];
    let latestWeight: any = null;
    let allNotes: any[] = [];
    let tdeeEvents: any[] = [];

    try {
      await connectDB();

      // Fetch from MongoDB
      profile = await UserProfile.findById(userId).lean();
      if (profile) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(now.getDate() - 14);

        todayEvents = await TimelineEvent.find({
          userId,
          timestamp: { $gte: startOfDay },
        }).lean();

        // Fetch 14 days of events for TDEE & Week trends
        const fourteenDayEvents = await TimelineEvent.find({
          userId,
          timestamp: { $gte: fourteenDaysAgo },
        }).lean();

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);

        weekEvents = fourteenDayEvents.filter((e) => new Date(e.timestamp) >= startOfWeek);

        latestWeight = await TimelineEvent.findOne({
          userId,
          type: "weight",
        })
          .sort({ timestamp: -1 })
          .lean();

        allNotes = await TimelineEvent.find({
          userId,
          type: "note",
        }).lean();

        // Pass 14 day events to TDEE calculations
        tdeeEvents = fourteenDayEvents;
      }
    } catch (dbError) {
      console.warn("⚠️ MongoDB connection failed on coach API. Querying local file DB.");
      if (process.env.NODE_ENV === "production") {
        return Response.json({ error: "Database offline. Please try again later." }, { status: 500 });
      }
      profile = await getLocalProfileById(userId);

      if (profile) {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const allTodayEvents = await getLocalEvents({ userId });
        todayEvents = allTodayEvents.filter(
          (e) => new Date(e.timestamp).getTime() >= startOfDay.getTime()
        );

        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(now.getDate() - 14);
        
        const fourteenDayEvents = allTodayEvents.filter(
          (e) => new Date(e.timestamp).getTime() >= fourteenDaysAgo.getTime()
        );

        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        weekEvents = fourteenDayEvents.filter(
          (e) => new Date(e.timestamp).getTime() >= startOfWeek.getTime()
        );

        const weightEvents = allTodayEvents.filter((e) => e.type === "weight");
        latestWeight = weightEvents[0] || null;

        allNotes = allTodayEvents.filter((e) => e.type === "note");
        tdeeEvents = fourteenDayEvents;
      }
    }

    if (!profile) {
      return Response.json({ error: "User profile not found" }, { status: 404 });
    }

    // ── Analytics Engine: Calculate context (deterministic math) ──
    const todayMeals = todayEvents.filter((e) => e.type === "meal");
    const todayWorkout = todayEvents.find((e) => e.type === "workout");
    const todaySleep = todayEvents.find((e) => e.type === "sleep");
    const todaySteps = todayEvents.find((e) => e.type === "steps");

    const caloriesConsumed = todayMeals.reduce(
      (sum, m) => sum + ((m.payload as Record<string, number>)?.totalCalories || 0),
      0
    );
    const proteinConsumed = todayMeals.reduce(
      (sum, m) => sum + ((m.payload as Record<string, number>)?.totalProteinG || 0),
      0
    );

    // Week calculations
    const weekMeals = weekEvents.filter((e) => e.type === "meal");
    const weekWorkouts = weekEvents.filter((e) => e.type === "workout");
    const weekSleeps = weekEvents.filter((e) => e.type === "sleep");

    // Calculate unique meal logging days (avoid dividing by 7 if they only logged 2 days)
    const uniqueMealDays = new Set(
      weekMeals.map((m) => new Date(m.timestamp).toDateString())
    ).size;
    const mealDivisionDays = uniqueMealDays || 1;

    const avgCalories =
      weekMeals.length > 0
        ? weekMeals.reduce(
            (sum, m) => sum + ((m.payload as Record<string, number>)?.totalCalories || 0),
            0
          ) / mealDivisionDays
        : 0;

    const avgProtein =
      weekMeals.length > 0
        ? weekMeals.reduce(
            (sum, m) => sum + ((m.payload as Record<string, number>)?.totalProteinG || 0),
            0
          ) / mealDivisionDays
        : 0;

    const avgSleep =
      weekSleeps.length > 0
        ? weekSleeps.reduce(
            (sum, s) => sum + ((s.payload as Record<string, number>)?.hours || 0),
            0
          ) / weekSleeps.length
        : 0;

    // ── Active Calendar/Busy Event Detection ──
    const todayDate = new Date();
    const activeBusyEvent = allNotes.find((n: any) => {
      if (!n.payload || !n.payload.startDate || !n.payload.endDate) return false;
      const start = new Date(n.payload.startDate);
      const end = new Date(n.payload.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      return todayDate >= start && todayDate <= end;
    }) || null;

    // Calculate Adaptive TDEE for AI Coach Context
    const tdeeResult = calculateAdaptiveTdee(profile, tdeeEvents);

    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const todayIndex = new Date().getDay();
    const todayWeekday = weekdays[todayIndex];

    let todayMessMenu = null;
    if (profile.messMenu && profile.messMenu.parsedMenu) {
      todayMessMenu = (profile.messMenu.parsedMenu as any)[todayWeekday] || null;
    }

    const scheduledWorkout = getTodaysWorkout(profile);
    const scheduledWorkoutName = scheduledWorkout?.name || "Rest Day";

    const context: CoachContext = {
      profile: {
        name: profile.name,
        goal: profile.goal,
        targetCalories: profile.targetCalories || 2200,
        targetProteinG: profile.targetProteinG || 150,
      },
      todayMessMenu,
      today: {
        caloriesConsumed,
        proteinConsumed,
        workoutCompleted: !!todayWorkout,
        scheduledWorkoutName,
        sleepHours: todaySleep
          ? (todaySleep.payload as Record<string, number>)?.hours
          : null,
        stepsCount: todaySteps
          ? (todaySteps.payload as Record<string, number>)?.count
          : null,
      },
      weekTrend: {
        avgCalories: Math.round(avgCalories),
        avgProtein: Math.round(avgProtein),
        workoutsCompleted: weekWorkouts.length,
        avgSleep: Math.round(avgSleep * 10) / 10,
      },
      recentWeightKg: latestWeight
        ? (latestWeight.payload as Record<string, number>)?.weightKg
        : null,
      activeEvent: activeBusyEvent
        ? {
            title: activeBusyEvent.payload.title,
            event_type: activeBusyEvent.payload.event_type,
            startDate: activeBusyEvent.payload.startDate,
            endDate: activeBusyEvent.payload.endDate,
          }
        : null,
      tdeeMode: tdeeResult.status,
      daysRemaining: tdeeResult.daysRemaining,
      avgCalories14d: tdeeResult.avgCalories,
      weightDeltaKg14d: tdeeResult.weightDeltaKg,
    };

    // ── AI Engine: Generate coaching recommendation ──
    let recommendation;
    try {
      recommendation = await generateDailyCoach(context);
    } catch (aiError) {
      console.warn("⚠️ Gemini AI call failed. Using standard coaching rules fallback.");
      
      const deficitRemaining = context.profile.targetCalories - context.today.caloriesConsumed;
      const proteinRemaining = context.profile.targetProteinG - context.today.proteinConsumed;
      
      let status: "on_track" | "needs_attention" | "great_job" = "on_track";
      let primaryInsight = "Your nutrition and logs are steady today. Keep focus on consistency.";
      const actionItems: string[] = [];
      let motivation = "Consistency beats perfection. Focus on stacking successful days.";

      if (activeBusyEvent) {
        const type = activeBusyEvent.payload.event_type;
        const eventLabel = type === "exam" ? "exam period" : type === "travel" ? "travel period" : "sick day";
        status = "needs_attention";
        primaryInsight = `Health OS adapted: We detected you are in your ${eventLabel}. Targets scaled down to prioritize recovery.`;
        motivation = "Health over perfection. Rest, recover, and focus on what matters most today.";
        
        actionItems.push("Prioritize rest and recover your physical & mental energy.");
        actionItems.push("Ensure you stay hydrated and have light, nourishing meals.");
        if (type !== "sick") {
          actionItems.push("Short 15-min recovery walks to clear your mind.");
        } else {
          actionItems.push("Zero workout session today. Focus entirely on sleep.");
        }
      } else {
        // 1. Evaluate Status & Primary Insight
        if (context.today.sleepHours && context.today.sleepHours < 6) {
          status = "needs_attention";
          primaryInsight = `Sleep was short last night (${context.today.sleepHours}h). Your CNS recovery will be reduced today.`;
          actionItems.push("Reduce today's lifting volume by 15-20% and avoid heavy single-rep PRs.");
        } else if (proteinRemaining > 50 && context.today.caloriesConsumed > context.profile.targetCalories * 0.7) {
          status = "needs_attention";
          primaryInsight = "Calorie intake is high but protein is lagging. Prioritize lean protein sources next.";
        } else if (context.today.workoutCompleted && proteinRemaining <= 10) {
          status = "great_job";
          primaryInsight = "Outstanding performance today! Workout completed and macros are perfectly dialed in.";
        }

        // 2. Add dynamic Action Items based on logs
        const todaysWorkoutPlan = getTodaysWorkout(profile);
        if (!context.today.workoutCompleted) {
          if (todaysWorkoutPlan.name === "Rest Day") {
            actionItems.push("Today is a scheduled Rest Day. Focus on recovery, light mobility, and hydration.");
          } else {
            actionItems.push(`${todaysWorkoutPlan.name} is scheduled. Focus on progressive overload suggestions (beat previous weights).`);
          }
        } else {
          actionItems.push("Workout session logged successfully. Rest, rehydrate, and recover.");
        }
      }

      // Protein target (only for non-fallback or normal days)
      if (!activeBusyEvent) {
        if (proteinRemaining > 0) {
          let source = "lean protein";
          if (profile.dietPreference === "vegetarian" || profile.dietPreference === "vegan") {
            source = "paneer, curd, tofu, or lentils";
          } else {
            source = "egg whites, chicken breasts, or whey";
          }
          actionItems.push(`Need ${proteinRemaining}g more protein. Consider having ${source} to hit your target.`);
        } else {
          actionItems.push("Protein target met for the day! Excellent job fueling your muscles.");
        }
      }

      // Steps target (scaled if busy event is active)
      let stepsGoal = profile.stepsTarget || 10000;
      if (activeBusyEvent) {
        const type = activeBusyEvent.payload.event_type;
        if (type === "exam") stepsGoal = 5000;
        else if (type === "travel") stepsGoal = 6000;
        else if (type === "sick") stepsGoal = 3000;
      }
      const stepsRemaining = stepsGoal - (context.today.stepsCount || 0);
      if (stepsRemaining > 0) {
        actionItems.push(`Aim for ${stepsGoal} steps today (${stepsRemaining} left). A short walk will clear your mind.`);
      } else {
        actionItems.push("Step target achieved! Keeping your neat activity high is excellent.");
      }

      // 3. Custom medical/injury checks
      if (profile.medicalConditions && profile.medicalConditions.length > 0) {
        const hasShoulderIssue = profile.medicalConditions.some((c: string) => c.toLowerCase().includes("shoulder"));
        const hasKneeIssue = profile.medicalConditions.some((c: string) => c.toLowerCase().includes("knee") || c.toLowerCase().includes("leg"));
        if (hasShoulderIssue && !context.today.workoutCompleted) {
          actionItems.push("⚠️ Care: Maintain shoulder health. Swap overhead pressing with lateral raises today.");
        }
        if (hasKneeIssue && !context.today.workoutCompleted) {
          actionItems.push("⚠️ Care: Avoid heavy knee flexion. Limit squat depth or swap with leg extensions.");
        }
      }

      // 4. Custom schedule checks
      if (profile.collegeSchedule && !context.today.workoutCompleted) {
        motivation = `Training around your classes (${profile.collegeSchedule}) helps maintain consistency.`;
      }

      recommendation = {
        greeting: `Hey ${profile.name}`,
        status,
        primaryInsight,
        actionItems: actionItems.slice(0, 3), // limit to top 3 actions (Principle #8)
        motivation,
      };
    }

    return Response.json({
      recommendation,
      context,
    });
  } catch (error) {
    console.error("Coach POST error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

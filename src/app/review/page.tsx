"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import ReviewCard from "@/components/ReviewCard";
import GlassCard from "@/components/GlassCard";

/* ─────────────────────────────────────────────
 * Types (mirrors API response)
 * ───────────────────────────────────────────── */

interface WeeklyReview {
  weekNumber: number;
  dateRange: { start: string; end: string };
  weight: {
    startKg: number | null;
    endKg: number | null;
    deltaKg: number | null;
  };
  nutrition: {
    avgCalories: number;
    avgProteinG: number;
    calorieAdherence: number;
    proteinAdherence: number;
    daysLogged: number;
  };
  training: {
    sessionsCompleted: number;
    totalVolumeKg: number;
    topExercise: string | null;
  };
  recovery: {
    avgSleepHours: number;
    avgSteps: number;
    daysWithSleep: number;
  };
  profile: {
    name: string;
    targetCalories: number;
    targetProteinG: number;
    goal: string;
    gymFrequency: number;
  };
}

/* ─────────────────────────────────────────────
 * Coach Summary Generator (deterministic rules)
 * ───────────────────────────────────────────── */

function generateCoachSummary(review: WeeklyReview): {
  mainText: string;
  adjustment: string;
} {
  const sentences: string[] = [];
  const { weight, nutrition, training, recovery, profile } = review;

  // Weight insight
  if (weight.deltaKg !== null) {
    if (weight.deltaKg < 0 && profile.goal === "lose_fat") {
      sentences.push(
        `Great progress on your cut, ${profile.name}! You dropped ${Math.abs(weight.deltaKg).toFixed(1)} kg this week.`
      );
    } else if (weight.deltaKg < 0 && profile.goal === "build_muscle") {
      sentences.push(
        `You lost ${Math.abs(weight.deltaKg).toFixed(1)} kg this week — keep an eye on your surplus to support muscle growth.`
      );
    } else if (weight.deltaKg > 0 && profile.goal === "build_muscle") {
      sentences.push(
        `Nice lean gain of ${weight.deltaKg.toFixed(1)} kg this week, ${profile.name}. Keep the surplus controlled.`
      );
    } else if (weight.deltaKg > 0 && profile.goal === "lose_fat") {
      sentences.push(
        `Weight moved up by ${weight.deltaKg.toFixed(1)} kg — could be water retention, but let's tighten up nutrition this week.`
      );
    } else if (weight.deltaKg === 0) {
      sentences.push(`Weight held steady this week — right on track for maintenance.`);
    } else {
      sentences.push(
        `Weight changed by ${weight.deltaKg > 0 ? "+" : ""}${weight.deltaKg.toFixed(1)} kg this week.`
      );
    }
  }

  // Training insight
  if (training.sessionsCompleted >= profile.gymFrequency) {
    sentences.push("Perfect gym attendance this week!");
  } else if (training.sessionsCompleted > 0) {
    sentences.push(
      `You completed ${training.sessionsCompleted} of ${profile.gymFrequency} planned sessions — aim for full attendance next week.`
    );
  } else {
    sentences.push("No workouts logged this week — let's get back on track!");
  }

  // Nutrition insight
  if (nutrition.proteinAdherence > 80) {
    sentences.push("Protein game is strong!");
  } else if (nutrition.proteinAdherence > 50) {
    sentences.push(
      `Protein adherence was ${nutrition.proteinAdherence}% — try to hit your ${profile.targetProteinG}g target more consistently.`
    );
  }

  // Recovery insight
  if (recovery.avgSleepHours >= 7.5) {
    sentences.push(`Sleep is dialed in at ${recovery.avgSleepHours} hrs average.`);
  } else if (recovery.avgSleepHours > 0 && recovery.avgSleepHours < 6.5) {
    sentences.push(
      `Your sleep averaged only ${recovery.avgSleepHours} hrs — poor recovery will stall progress.`
    );
  }

  // Generate adjustment recommendation
  let adjustment = "Stay consistent with the current plan.";
  if (
    weight.deltaKg !== null &&
    weight.deltaKg < -1.0 &&
    profile.goal === "lose_fat"
  ) {
    adjustment =
      "Weight is dropping a bit fast — keep calories stable to preserve strength.";
  } else if (
    training.sessionsCompleted >= profile.gymFrequency &&
    training.totalVolumeKg > 0
  ) {
    adjustment =
      "Try adding 2.5 kg to your main compound lifts next week for progressive overload.";
  } else if (nutrition.calorieAdherence < 60 && nutrition.daysLogged > 0) {
    adjustment =
      "Focus on hitting your calorie target more consistently — meal prep could help.";
  }

  return {
    mainText:
      sentences.length > 0
        ? sentences.slice(0, 3).join(" ")
        : `Keep going, ${profile.name}! Log more data for a detailed weekly insight.`,
    adjustment,
  };
}

/* ─────────────────────────────────────────────
 * Format helpers
 * ───────────────────────────────────────────── */

function fmtNum(n: number): string {
  return n.toLocaleString("en-IN");
}

function hasAnyData(review: WeeklyReview): boolean {
  return (
    review.weight.startKg !== null ||
    review.nutrition.daysLogged > 0 ||
    review.training.sessionsCompleted > 0 ||
    review.recovery.daysWithSleep > 0
  );
}

/* ─────────────────────────────────────────────
 * Page Component
 * ───────────────────────────────────────────── */

export default function WeeklyReview() {
  const router = useRouter();
  const [slide, setSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadReview() {
      try {
        // Step 1: Check profile
        const profileRes = await fetch("/api/profile");
        const profileData = await profileRes.json();

        if (profileData.notInitialized) {
          router.push("/onboarding");
          return;
        }

        const userId =
          profileData.profile?._id ?? profileData.profile?.id ?? null;
        if (!userId) {
          setError("Could not determine user ID");
          return;
        }

        // Step 2: Fetch review
        const reviewRes = await fetch(`/api/review?userId=${userId}`);
        if (!reviewRes.ok) {
          const errData = await reviewRes.json().catch(() => ({}));
          setError(errData.error ?? "Failed to load review");
          return;
        }

        const reviewData = await reviewRes.json();
        setReview(reviewData.review);
      } catch (err) {
        console.error("Failed to load weekly review:", err);
        setError("Something went wrong loading your review.");
      } finally {
        setLoading(false);
      }
    }
    loadReview();
  }, [router]);

  const totalSlides = 5;

  const nextSlide = () => {
    if (slide < totalSlides - 1) setSlide(slide + 1);
  };

  const prevSlide = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  /* ── Loading State ─────────────────────── */
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">
          Loading Weekly Insights...
        </p>
      </div>
    );
  }

  /* ── Error State ───────────────────────── */
  if (error || !review) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white gap-4">
        <span className="text-4xl">⚠️</span>
        <p className="text-zinc-400 text-sm">{error ?? "No review data available."}</p>
        <button
          onClick={() => router.push("/")}
          type="button"
          className="btn-primary px-6 py-2 text-sm"
        >
          Go Home
        </button>
      </div>
    );
  }

  /* ── No Data State ─────────────────────── */
  if (!hasAnyData(review)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white gap-4">
        <span className="text-5xl">📊</span>
        <h2 className="text-xl font-bold">No data yet</h2>
        <p className="text-zinc-400 text-sm text-center max-w-xs">
          Start logging meals, workouts, weight, and sleep to see your weekly
          review here.
        </p>
        <button
          onClick={() => router.push("/")}
          type="button"
          className="btn-primary px-6 py-2 text-sm mt-2"
        >
          Go Home
        </button>
      </div>
    );
  }

  const coachSummary = generateCoachSummary(review);

  /* ── Delta display helpers ─────────────── */
  const deltaDisplay =
    review.weight.deltaKg !== null
      ? `${review.weight.deltaKg > 0 ? "+" : ""}${review.weight.deltaKg.toFixed(1)} kg`
      : "— kg";

  const deltaColor =
    review.weight.deltaKg !== null
      ? review.weight.deltaKg <= 0
        ? "text-brand-400"
        : "text-red-400"
      : "text-zinc-500";

  const weightSubtitle =
    review.weight.deltaKg !== null
      ? review.weight.deltaKg < 0
        ? "Your weight trend is decreasing stably"
        : review.weight.deltaKg > 0
          ? "Weight increased this week"
          : "Weight stayed stable this week"
      : "No weight data logged this week";

  return (
    <div className="page-container flex flex-col justify-between min-h-dvh pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Pillar 5
          </span>
          <h1 className="text-xl font-bold text-white mt-0.5">
            Weekly Report
          </h1>
        </div>
        <span className="badge-success">Week {review.weekNumber}</span>
      </div>

      {/* Swipeable Carousel Slides */}
      <div className="flex-1 flex flex-col justify-center my-6 relative min-h-[350px]">
        {/* ── Slide 0: Weight ─────────────── */}
        {slide === 0 && (
          <div className="animate-in">
            <ReviewCard
              title="Weight Journey"
              subtitle={weightSubtitle}
              accentColor="#22c55e"
              icon="📉"
            >
              <div className="space-y-6 pt-2">
                <div className="flex items-center justify-around text-center">
                  <div>
                    <span className="text-xs text-zinc-500">Started</span>
                    <p className="text-lg font-bold text-white mt-1">
                      {review.weight.startKg !== null
                        ? `${review.weight.startKg} kg`
                        : "— kg"}
                    </p>
                  </div>
                  <div className="text-brand-400 text-xl font-black">
                    {review.weight.deltaKg !== null && review.weight.deltaKg <= 0
                      ? "↓"
                      : review.weight.deltaKg !== null && review.weight.deltaKg > 0
                        ? "↑"
                        : "—"}
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Current</span>
                    <p className="text-lg font-bold text-white mt-1">
                      {review.weight.endKg !== null
                        ? `${review.weight.endKg} kg`
                        : "— kg"}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-brand-500/5 border border-brand-500/20 rounded-2xl text-center">
                  <span className="text-xs text-zinc-400">
                    Total Change This Week
                  </span>
                  <h2
                    className={`text-3xl font-black mt-1 ${deltaColor}`}
                  >
                    {deltaDisplay}
                  </h2>
                </div>

                <p className="text-[11px] text-zinc-500 leading-relaxed text-center">
                  {review.weight.deltaKg !== null
                    ? "Weight fluctuations are normal. Focus on the weekly trend, not daily numbers."
                    : "Log your weight daily for the most accurate weekly trend."}
                </p>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 1: Nutrition ──────────── */}
        {slide === 1 && (
          <div className="animate-in">
            <ReviewCard
              title="Nutrition & Fuel"
              subtitle={`Tracked ${review.nutrition.daysLogged} day${review.nutrition.daysLogged !== 1 ? "s" : ""} this week`}
              accentColor="#06b6d4"
              icon="🍛"
            >
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <GlassCard className="p-3 text-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      Daily Average
                    </span>
                    <p className="text-lg font-extrabold text-white mt-1">
                      {fmtNum(review.nutrition.avgCalories)} kcal
                    </p>
                  </GlassCard>
                  <GlassCard className="p-3 text-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      Avg Protein
                    </span>
                    <p className="text-lg font-extrabold text-cyan-400 mt-1">
                      {review.nutrition.avgProteinG} g
                    </p>
                  </GlassCard>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Calorie Adherence:</span>
                    <span className="font-semibold text-brand-400">
                      {review.nutrition.calorieAdherence}% consistent
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(review.nutrition.calorieAdherence, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Protein Adherence:</span>
                    <span className="font-semibold text-cyan-400">
                      {review.nutrition.proteinAdherence}% consistent
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(review.nutrition.proteinAdherence, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 2: Training ───────────── */}
        {slide === 2 && (
          <div className="animate-in">
            <ReviewCard
              title="Gym Adherence"
              subtitle="Progression and overload achievements"
              accentColor="#8b5cf6"
              icon="⚡"
            >
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-2xl text-center">
                  <span className="text-xs text-zinc-400">
                    Workouts Logged
                  </span>
                  <h2 className="text-3xl font-black text-purple-400 mt-1">
                    {review.training.sessionsCompleted} / {review.profile.gymFrequency} sessions
                  </h2>
                </div>

                <GlassCard className="p-3.5 space-y-2">
                  {review.training.topExercise && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Top Exercise</span>
                      <span className="text-purple-400 font-bold">
                        {review.training.topExercise}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400">
                      Total Weekly Lift Volume
                    </span>
                    <span className="text-purple-400 font-bold">
                      {fmtNum(review.training.totalVolumeKg)} kg
                    </span>
                  </div>
                </GlassCard>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 3: Recovery ───────────── */}
        {slide === 3 && (
          <div className="animate-in">
            <ReviewCard
              title="Sleep & Recovery"
              subtitle="Rest quality and schedule consistency"
              accentColor="#3b82f6"
              icon="😴"
            >
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <GlassCard className="p-3 text-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      Avg Sleep
                    </span>
                    <p className="text-lg font-extrabold text-white mt-1">
                      {review.recovery.avgSleepHours > 0
                        ? `${review.recovery.avgSleepHours} hrs`
                        : "— hrs"}
                    </p>
                  </GlassCard>
                  <GlassCard className="p-3 text-center">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                      Avg Steps
                    </span>
                    <p className="text-lg font-extrabold text-blue-400 mt-1">
                      {review.recovery.avgSteps > 0
                        ? fmtNum(review.recovery.avgSteps)
                        : "—"}
                    </p>
                  </GlassCard>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed text-center">
                  {review.recovery.avgSleepHours >= 7.5
                    ? `Your sleep averaged ${review.recovery.avgSleepHours} hrs across ${review.recovery.daysWithSleep} nights — excellent recovery.`
                    : review.recovery.avgSleepHours > 0
                      ? `Your sleep averaged ${review.recovery.avgSleepHours} hrs across ${review.recovery.daysWithSleep} nights. Aim for 7.5+ hours for optimal recovery.`
                      : "No sleep data logged this week. Track your sleep to unlock recovery insights."}
                </p>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 4: Coach Summary ─────── */}
        {slide === 4 && (
          <div className="animate-in">
            <ReviewCard
              title="Coach Insight"
              subtitle="Your personalized weekly feedback"
              accentColor="#f59e0b"
              icon="💡"
            >
              <div className="space-y-4 pt-2">
                <p className="text-xs text-zinc-300 leading-relaxed bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl">
                  &ldquo;{coachSummary.mainText}&rdquo;
                </p>
                <GlassCard className="p-3 text-center text-xs">
                  <p className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                    Next Week&apos;s Focus
                  </p>
                  <p className="font-bold text-amber-400 mt-1">
                    {coachSummary.adjustment}
                  </p>
                </GlassCard>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* Slide Indicators */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{
                background:
                  i === slide ? "#22c55e" : "rgba(255,255,255,0.2)",
                transform: i === slide ? "scale(1.3)" : "scale(1)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center gap-3 pt-6 border-t border-white/5">
        {slide > 0 ? (
          <button
            onClick={prevSlide}
            type="button"
            className="btn-ghost flex-1 py-3 text-center"
          >
            Prev
          </button>
        ) : (
          <div className="flex-1" />
        )}

        {slide === totalSlides - 1 ? (
          <button
            onClick={() => router.push("/")}
            type="button"
            className="btn-primary flex-[2] py-3 text-center font-bold"
          >
            Done
          </button>
        ) : (
          <button
            onClick={nextSlide}
            type="button"
            className="btn-primary flex-[2] py-3 text-center font-bold"
          >
            Next Slide
          </button>
        )}
      </div>
    </div>
  );
}

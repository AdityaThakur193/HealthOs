"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReviewCard from "@/components/ReviewCard";
import GlassCard from "@/components/GlassCard";
import { Scale, Utensils, Zap, Moon, Lightbulb, BarChart2, Calendar, ArrowDown, ArrowUp } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";

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

  const { userId, loading: authLoading } = useAuthGuard();

  const loadReview = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
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
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadReview();
    }
  }, [userId, loadReview]);

  const totalSlides = 6;

  const nextSlide = () => {
    if (slide < totalSlides - 1) setSlide(slide + 1);
  };

  const prevSlide = () => {
    if (slide > 0) setSlide(slide - 1);
  };

  /* ── Loading State ─────────────────────── */
  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white">
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white gap-4">
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white gap-4">
        <BarChart2 className="w-12 h-12 text-[#8ba893]" />
        <h2 className="text-xl font-bold font-heading">No data yet</h2>
        <p className="text-zinc-400 text-xs text-center max-w-xs leading-relaxed">
          Start logging meals, workouts, weight, and sleep to see your weekly review here. Every data point helps calibrate the metabolic engine!
        </p>
        <button
          onClick={() => router.push("/")}
          type="button"
          className="btn-primary px-6 py-2.5 text-xs font-bold mt-2"
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
        ? "text-[#8ba893]"
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
    <div className="page-container flex flex-col justify-between min-h-dvh pb-10 pt-4">
      {/* Spotify Wrapped Top Segment Progress Bars */}
      <div className="flex gap-1.5 w-full px-1 animate-in">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#8ba893] rounded-full transition-all duration-300"
              style={{ 
                width: i < slide ? "100%" : i === slide ? "100%" : "0%",
                transitionDuration: i === slide ? "300ms" : "0ms"
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-white/5 animate-in">
        <div>
          <span className="text-[9px] font-bold uppercase tracking-widest text-[#c87a53] font-mono">
            Pillar 5 • Weekly Story
          </span>
          <h1 className="text-base font-bold text-white mt-0.5 font-heading">
            {slide === 0 ? "Your Weekly Wrapped" : `Story ${slide} of ${totalSlides - 1}`}
          </h1>
        </div>
        <span className="px-2 py-0.5 rounded bg-[#8ba893]/10 border border-[#8ba893]/20 text-[#8ba893] text-[9px] font-bold uppercase tracking-wider font-mono">
          Week {review.weekNumber}
        </span>
      </div>

      {/* Swipeable Carousel Slides Container */}
      <div className="flex-1 flex flex-col justify-center my-6 relative min-h-[350px]">
        {/* Tap areas for navigation (left 30% / right 70%) */}
        <div className="absolute inset-0 flex z-30 select-none pointer-events-none">
          <div 
            onClick={prevSlide} 
            className="w-[30%] h-full cursor-w-resize pointer-events-auto" 
            title="Previous slide"
          />
          <div 
            onClick={nextSlide} 
            className="w-[70%] h-full cursor-e-resize pointer-events-auto" 
            title="Next slide"
          />
        </div>

        {/* ── Slide 0: The Hook (Cover Slide) ────────── */}
        {slide === 0 && (
          <div className="animate-in text-center space-y-6 max-w-sm mx-auto py-8">
            <div className="w-16 h-16 rounded-full bg-[#8ba893]/10 border border-[#8ba893]/20 flex items-center justify-center mx-auto animate-pulse">
              <BarChart2 className="w-8 h-8 text-[#8ba893]" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-black text-white font-heading tracking-tight leading-tight">
                Hey {review.profile.name},<br />
                Your Weekly Wrapped is Ready.
              </h2>
              <p className="text-[10px] text-zinc-500 leading-relaxed uppercase tracking-wider font-mono">
                {review.dateRange.start} — {review.dateRange.end}
              </p>
            </div>
            <div className="p-4 bg-white/2 border border-white/5 rounded-2xl text-xs text-zinc-400 leading-relaxed">
              We tracked your weight, workouts, sleep, and mess intake to structure your body's metabolic report.
            </div>
            <div className="text-[9px] text-[#c87a53] font-bold uppercase tracking-widest font-mono animate-bounce pt-4">
              Tap right side of screen to start →
            </div>
          </div>
        )}

        {/* ── Slide 1: Weight ─────────────── */}
        {slide === 1 && (
          <div className="animate-in">
            <ReviewCard
              title="Weight Progress"
              subtitle={weightSubtitle}
              accentColor="#8ba893"
              icon={<Scale className="w-5 h-5 text-[#8ba893]" />}
            >
              <div className="space-y-4 pt-2 text-left">
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-5 space-y-3.5 border-r border-white/5 pr-4 py-2">
                    <div>
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Initial</span>
                      <p className="text-base font-extrabold text-white mt-1 font-heading">
                        {review.weight.startKg !== null
                          ? `${review.weight.startKg} kg`
                          : "— kg"}
                      </p>
                    </div>
                    <div className="pt-2.5 border-t border-white/5">
                      <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">Current</span>
                      <p className="text-base font-extrabold text-white mt-1 font-heading">
                        {review.weight.endKg !== null
                          ? `${review.weight.endKg} kg`
                          : "— kg"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="col-span-7 p-4 bg-white/2 border border-white/5 rounded-tl-2xl rounded-br-2xl text-center flex flex-col justify-center min-h-[110px]">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                      Weekly Delta
                    </span>
                    <h2 className={`text-2xl font-black mt-1 font-heading ${deltaColor}`}>
                      {deltaDisplay}
                    </h2>
                    {review.weight.deltaKg !== null && (
                      <span className="inline-flex items-center justify-center gap-0.5 mt-1.5 px-2 py-0.5 rounded-full bg-white/5 text-[9px] font-semibold text-zinc-400 mx-auto">
                        {review.weight.deltaKg <= 0 ? (
                          <>
                            <ArrowDown className="w-3.5 h-3.5 text-[#8ba893]" />
                            Loss
                          </>
                        ) : (
                          <>
                            <ArrowUp className="w-3.5 h-3.5 text-red-400" />
                            Gain
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-[10px] text-zinc-500 leading-relaxed text-center mt-2">
                  {review.weight.deltaKg !== null
                    ? "Weight fluctuations are normal. Focus on the weekly trend, not daily numbers."
                    : "Log your weight daily for the most accurate weekly trend."}
                </p>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 2: Nutrition ──────────── */}
        {slide === 2 && (
          <div className="animate-in">
            <ReviewCard
              title="Nutrition & Fuel"
              subtitle={`Tracked ${review.nutrition.daysLogged} day${review.nutrition.daysLogged !== 1 ? "s" : ""} this week`}
              accentColor="#8ba893"
              icon={<Utensils className="w-5 h-5 text-[#8ba893]" />}
            >
              <div className="space-y-4 pt-2 text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/2 border border-white/5 rounded-tl-xl rounded-br-xl text-center">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold block">
                      Daily Average
                    </span>
                    <p className="text-base font-extrabold text-white mt-1 font-heading">
                      {fmtNum(review.nutrition.avgCalories)} kcal
                    </p>
                  </div>
                  <div className="p-3 bg-white/2 border border-white/5 rounded-tl-xl rounded-br-xl text-center">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold block">
                      Avg Protein
                    </span>
                    <p className="text-base font-extrabold text-[#8ba893] mt-1 font-heading">
                      {review.nutrition.avgProteinG} g
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Calorie Adherence:</span>
                    <span className="font-bold text-[#8ba893]">
                      {review.nutrition.calorieAdherence}% consistent
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#8ba893] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(review.nutrition.calorieAdherence, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500 font-medium">Protein Adherence:</span>
                    <span className="font-bold text-[#c87a53]">
                      {review.nutrition.proteinAdherence}% consistent
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#c87a53] rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(review.nutrition.proteinAdherence, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 3: Training ───────────── */}
        {slide === 3 && (
          <div className="animate-in">
            <ReviewCard
              title="Training & Iron"
              subtitle="Progression and overload achievements"
              accentColor="#c87a53"
              icon={<Zap className="w-5 h-5 text-[#c87a53]" />}
            >
              <div className="space-y-4 pt-2 text-left">
                <div className="p-4 bg-[#c87a53]/5 border border-[#c87a53]/20 rounded-tl-2xl rounded-br-2xl text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
                    Workouts Logged
                  </span>
                  <h2 className="text-xl font-black text-[#c87a53] mt-1 font-heading">
                    {review.training.sessionsCompleted} sessions completed
                  </h2>
                </div>

                <GlassCard className="p-3.5 space-y-2 border border-white/5">
                  {review.training.topExercise && (
                    <div className="flex items-center justify-between text-xs border-b border-white/5 pb-2">
                      <span className="text-zinc-400">Top Exercise</span>
                      <span className="text-[#c87a53] font-bold">
                        {review.training.topExercise}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-400">
                      Total Weekly Lift Volume
                    </span>
                    <span className="text-[#8ba893] font-bold font-mono">
                      {fmtNum(review.training.totalVolumeKg)} kg
                    </span>
                  </div>
                </GlassCard>
              </div>
            </ReviewCard>
          </div>
        )}

        {/* ── Slide 4: Recovery ───────────── */}
        {slide === 4 && (
          <div className="animate-in">
            <ReviewCard
              title="Sleep & Recovery"
              subtitle="Rest quality and schedule consistency"
              accentColor="#8ba893"
              icon={<Moon className="w-5 h-5 text-[#8ba893]" />}
            >
              <div className="space-y-4 pt-2 text-left">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white/2 border border-white/5 rounded-tl-xl rounded-br-xl text-center">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold block">
                      Avg Sleep
                    </span>
                    <p className="text-base font-extrabold text-white mt-1 font-heading">
                      {review.recovery.avgSleepHours > 0
                        ? `${review.recovery.avgSleepHours} hrs`
                        : "— hrs"}
                    </p>
                  </div>
                  <div className="p-3 bg-white/2 border border-white/5 rounded-tl-xl rounded-br-xl text-center">
                    <span className="text-[9px] text-zinc-500 uppercase tracking-widest font-mono font-bold block">
                      Avg Steps
                    </span>
                    <p className="text-base font-extrabold text-[#c87a53] mt-1 font-heading">
                      {review.recovery.avgSteps > 0
                        ? fmtNum(review.recovery.avgSteps)
                        : "—"}
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-zinc-400 leading-relaxed text-center bg-white/3 border border-white/5 p-3.5 rounded-xl mt-2">
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

        {/* ── Slide 5: Coach Summary (Final Slide) ─────── */}
        {slide === 5 && (
          <div className="animate-in">
            <ReviewCard
              title="Coach Verdict"
              subtitle="Your personalized weekly feedback"
              accentColor="#c87a53"
              icon={<Lightbulb className="w-5 h-5 text-[#c87a53]" />}
            >
              <div className="space-y-4 pt-2 text-left">
                <div className="relative p-4 rounded-2xl bg-white/2 border-l-2 border-[#c87a53]/60 border-t border-r border-b border-white/5">
                  <p className="text-xs text-zinc-300 leading-relaxed italic">
                    &ldquo;{coachSummary.mainText}&rdquo;
                  </p>
                </div>
                <GlassCard className="p-3.5 border border-white/5 text-center">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono block">
                    Next Week's Focus
                  </span>
                  <p className="font-bold text-[#c87a53] text-xs mt-1.5 leading-snug">
                    {coachSummary.adjustment}
                  </p>
                </GlassCard>
              </div>
            </ReviewCard>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center gap-3 pt-6 border-t border-white/5 animate-in">
        {slide > 0 ? (
          <button
            onClick={prevSlide}
            type="button"
            className="btn-ghost flex-1 py-3 text-center text-xs font-bold cursor-pointer"
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
            className="btn-primary flex-[2] py-3 text-center font-bold text-xs cursor-pointer bg-[#8ba893] text-[#0c0f0d]"
          >
            Go to Dashboard
          </button>
        ) : (
          <button
            onClick={nextSlide}
            type="button"
            className="btn-primary flex-[2] py-3 text-center font-bold text-xs cursor-pointer"
          >
            Next Slide
          </button>
        )}
      </div>
    </div>
  );
}

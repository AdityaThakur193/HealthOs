"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ExerciseCard from "@/components/ExerciseCard";
import { getTodaysWorkout, type WorkoutPlan } from "@/lib/workoutPlans";

interface ExerciseState {
  id: string;
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string;
  previousWeight?: number;
  suggestedWeight?: number;
  sets: { weight: number; reps: number; completed: boolean }[];
}

export default function WorkoutTracker() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [pastWorkouts, setPastWorkouts] = useState<any[]>([]);

  useEffect(() => {
    async function checkProfileAndLoadHistory() {
      try {
        const email = localStorage.getItem("healthos_email");
        if (!email) {
          router.push("/login");
          return;
        }

        const profileRes = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const profileData = await profileRes.json();
        if (profileData.notInitialized) {
          router.push(`/onboarding?email=${encodeURIComponent(email)}`);
          return;
        }

        const userId = profileData.profile._id;
        localStorage.setItem("healthos_userId", userId);

        // Generate today's workout from profile
        const profile = profileData.profile;
        const todaysPlan = getTodaysWorkout({
          gymFrequency: profile.gymFrequency,
          gymExperience: profile.gymExperience,
          goal: profile.goal,
        });
        setPlan(todaysPlan);

        // If rest day, no exercises to load
        if (todaysPlan.exercises.length === 0) {
          setFetchingHistory(false);
          return;
        }

        // Initialize exercises state from plan
        const initialExercises: ExerciseState[] = todaysPlan.exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          muscleGroup: ex.muscle,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          sets: Array.from({ length: ex.targetSets }, () => ({
            weight: 0,
            reps: 0,
            completed: false,
          })),
        }));

        // Fetch timeline workout events to find previous history
        const res = await fetch(`/api/timeline?userId=${userId}&type=workout&limit=5`);
        if (res.ok) {
          const data = await res.json();
          const pastEvents = data.events || [];
          setPastWorkouts(pastEvents);

          // Match exercises by ID across all recent workouts to find previous weights
          const updatedExercises = initialExercises.map((currentEx) => {
            // Search through recent workouts for matching exercise
            for (const workout of pastEvents) {
              const prevExercises = workout.payload?.exercises;
              if (!prevExercises) continue;

              const prevEx = prevExercises.find(
                (pe: any) => pe.id === currentEx.id || pe.name === currentEx.name
              );

              if (prevEx && prevEx.sets && prevEx.sets.length > 0) {
                console.log(`📊 Found history for ${currentEx.name}. Calculating progressive overload...`);

                // Filter completed sets to determine their maximum lifting weight & reps
                const completedSets = prevEx.sets.filter((s: any) => s.completed);
                const activeSets = completedSets.length > 0 ? completedSets : prevEx.sets;

                // Find maximum weight lifted
                const maxWeight = Math.max(...activeSets.map((s: any) => s.weight || 0));

                // Find sets completed at that max weight
                const setsAtMaxWeight = activeSets.filter((s: any) => s.weight === maxWeight);
                const maxRepsAtMaxWeight = setsAtMaxWeight.length > 0
                  ? Math.max(...setsAtMaxWeight.map((s: any) => s.reps || 0))
                  : 0;

                // ── Progressive Overload Logic (Double Progression) ──
                // Parse rep range (e.g. "8-10" -> max target is 10)
                const targetRepParts = currentEx.targetReps.split("-");
                const maxTargetReps = parseInt(targetRepParts[targetRepParts.length - 1]);

                let suggestedWeight = maxWeight;

                if (maxRepsAtMaxWeight >= maxTargetReps && maxWeight > 0) {
                  // If they hit the ceiling reps last time, increase the load
                  const isDumbbell =
                    currentEx.id.includes("dumbbell") ||
                    currentEx.id.includes("db") ||
                    currentEx.id.includes("lateral");
                  const increment = isDumbbell ? 2 : 2.5;
                  suggestedWeight = maxWeight + increment;
                }

                return {
                  ...currentEx,
                  previousWeight: maxWeight > 0 ? maxWeight : undefined,
                  suggestedWeight: suggestedWeight > 0 ? suggestedWeight : undefined,
                  // Pre-fill fields with recommended suggestion values to reduce friction
                  sets: currentEx.sets.map(() => ({
                    weight: suggestedWeight,
                    reps: 0,
                    completed: false,
                  })),
                };
              }
            }

            // If no history exists for this specific exercise, start blank
            return currentEx;
          });

          setExercises(updatedExercises);
        } else {
          setExercises(initialExercises);
        }
      } catch (err) {
        console.error("Failed to load progressive overload context:", err);
      } finally {
        setFetchingHistory(false);
      }
    }
    checkProfileAndLoadHistory();
  }, [router]);

  const handleLogSet = (exerciseId: string, setIndex: number, weight: number, reps: number) => {
    const safeWeight = isNaN(weight) ? 0 : weight;
    const safeReps = isNaN(reps) ? 0 : reps;
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          const newSets = [...ex.sets];
          newSets[setIndex] = { ...newSets[setIndex], weight: safeWeight, reps: safeReps };
          return { ...ex, sets: newSets };
        }
        return ex;
      })
    );
  };

  const handleToggleSet = (exerciseId: string, setIndex: number) => {
    setExercises((prev) =>
      prev.map((ex) => {
        if (ex.id === exerciseId) {
          const newSets = [...ex.sets];
          newSets[setIndex] = { ...newSets[setIndex], completed: !newSets[setIndex].completed };
          return { ...ex, sets: newSets };
        }
        return ex;
      })
    );
  };

  const handleFinishWorkout = async () => {
    const userId = localStorage.getItem("healthos_userId");
    if (!userId || !plan) return;

    setLoading(true);

    let totalVolume = 0;
    let loggedSetsCount = 0;

    const exercisesLogged = exercises.map((ex) => {
      const completedSets = ex.sets.filter((s) => s.completed);
      const exVolume = completedSets.reduce((sum, s) => sum + (s.weight || 0) * (s.reps || 0), 0);
      totalVolume += exVolume;
      loggedSetsCount += completedSets.length;

      return {
        id: ex.id,
        name: ex.name,
        sets: ex.sets.map((s) => ({
          weight: s.weight,
          reps: s.reps,
          completed: s.completed,
        })),
      };
    });

    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "workout",
          payload: {
            name: plan.name,
            totalVolumeKg: totalVolume,
            completedSets: loggedSetsCount,
            exercises: exercisesLogged,
          },
          source: "manual",
        }),
      });

      if (res.ok) {
        router.push("/");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const suggestedVolume = plan
    ? plan.exercises.reduce((total, ex) => {
        // Estimate ~20kg avg weight per set as baseline suggestion
        const avgWeight = 20;
        const cleanReps = ex.targetReps.replace(/[^0-9\-]/g, "");
        const repParts = cleanReps.split("-");
        const avgReps = repParts.length === 2
          ? (parseInt(repParts[0] || "8") + parseInt(repParts[1] || "12")) / 2
          : parseInt(repParts[0] || "10");
        return total + ex.targetSets * avgReps * avgWeight;
      }, 0)
    : 0;

  if (fetchingHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Loading Overload Targets...</p>
      </div>
    );
  }

  // ── Rest Day View ──
  if (plan && plan.exercises.length === 0) {
    return (
      <div className="page-container space-y-6">
        <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pillar 3</span>
            <h1 className="text-xl font-bold text-white mt-0.5">{plan.name}</h1>
          </div>
          <span className="badge-info">{plan.focus}</span>
        </div>

        <GlassCard className="p-6 text-center animate-in-delay-1">
          <div className="text-4xl mb-3">🧘</div>
          <h2 className="text-lg font-semibold text-white mb-2">Rest & Recover</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Your muscles grow during recovery, not during the workout. Take today to recharge.
          </p>
          <div className="space-y-3 text-left max-w-xs mx-auto">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="text-brand-400">✓</span> Get 7-9 hours of sleep tonight
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="text-brand-400">✓</span> Stay hydrated — aim for 3L+ of water
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="text-brand-400">✓</span> Light stretching or a 20-min walk
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <span className="text-brand-400">✓</span> Hit your protein target (1.6-2g/kg)
            </div>
          </div>
        </GlassCard>

        <div className="pt-4 border-t border-white/5 animate-in-delay-2">
          <button
            onClick={() => router.push("/")}
            type="button"
            className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pillar 3</span>
          <h1 className="text-xl font-bold text-white mt-0.5">{plan?.name}</h1>
        </div>
        <span className="badge-info">Target: ~{plan?.targetDurationMin}m</span>
      </div>

      {/* Routine focus info */}
      <GlassCard className="p-4 flex justify-between text-xs animate-in-delay-1">
        <div>
          <span className="text-zinc-500">Focus:</span>
          <p className="font-semibold text-white mt-0.5">{plan?.focus}</p>
        </div>
        <div className="text-right">
          <span className="text-zinc-500">Suggested Volume:</span>
          <p className="font-semibold text-brand-400 mt-0.5">~ {Math.round(suggestedVolume).toLocaleString()} kg</p>
        </div>
      </GlassCard>

      {/* Exercise card list */}
      <div className="space-y-4 animate-in-delay-2">
        {exercises.map((ex) => (
          <ExerciseCard
            key={ex.id}
            name={ex.name}
            muscleGroup={ex.muscleGroup}
            targetSets={ex.targetSets}
            targetReps={ex.targetReps}
            previousWeight={ex.previousWeight}
            suggestedWeight={ex.suggestedWeight}
            sets={ex.sets}
            onLogSet={(setIndex, w, r) => handleLogSet(ex.id, setIndex, w, r)}
            onToggleSet={(setIndex) => handleToggleSet(ex.id, setIndex)}
          />
        ))}
      </div>

      {/* Finish button */}
      <div className="pt-4 border-t border-white/5 animate-in-delay-3">
        <button
          onClick={handleFinishWorkout}
          type="button"
          className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Finish Workout Session"
          )}
        </button>
      </div>

      {/* Workout History Section */}
      {pastWorkouts.length > 0 && (
        <div className="pt-6 border-t border-white/5 animate-in-delay-3 space-y-3">
          <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Recent Workout Logs</h3>
          <div className="space-y-3">
            {pastWorkouts.map((w, idx) => (
              <GlassCard key={idx} className="p-4 space-y-2 border border-white/5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white capitalize">{w.payload.name || "Logged Workout"}</h4>
                  <span className="text-[10px] text-zinc-500">
                    {new Date(w.timestamp).toLocaleDateString([], { month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-zinc-400">
                  <span>💪 Volume: <strong className="text-brand-400">{w.payload.totalVolumeKg?.toLocaleString()} kg</strong></span>
                  <span>🔥 Sets: <strong className="text-cyan-400">{w.payload.completedSets}</strong></span>
                </div>
                <div className="border-t border-white/5 pt-2 mt-1">
                  <details className="cursor-pointer group">
                    <summary className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider select-none hover:text-zinc-300 transition-colors flex items-center justify-between">
                      <span>View Exercises Log</span>
                      <span className="group-open:rotate-180 transition-transform">▼</span>
                    </summary>
                    <ul className="mt-2 space-y-1.5 pl-1 text-[10px] text-zinc-400 list-disc list-inside">
                      {w.payload.exercises?.map((ex: any, eIdx: number) => {
                        const doneSets = ex.sets?.filter((s: any) => s.completed) || [];
                        return (
                          <li key={eIdx} className="capitalize">
                            <strong>{ex.name}</strong>: {doneSets.length} sets logged (max {Math.max(...doneSets.map((s: any) => s.weight || 0))}kg)
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

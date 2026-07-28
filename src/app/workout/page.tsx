"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ExerciseCard from "@/components/ExerciseCard";
import CustomPopup from "@/components/CustomPopup";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { getTodaysWorkout, getWeekSchedule, type WorkoutPlan } from "@/lib/workoutPlans";
import { Dumbbell, Flame, Lightbulb, Plus, Activity, BookOpen, Compass, ChevronDown, CheckCircle, Info } from "lucide-react";

interface ExerciseState {
  id: string;
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string;
  previousWeight?: number;
  suggestedWeight?: number;
  sets: { weight: number; reps: number; completed: boolean }[];
  youtubeId?: string;
}

export default function WorkoutTracker() {
  const router = useRouter();
  const { profile, userId, loading: authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [pastWorkouts, setPastWorkouts] = useState<any[]>([]);
  const [showHowToLog, setShowHowToLog] = useState(false);
  const [customExName, setCustomExName] = useState("");
  const [customExMuscle, setCustomExMuscle] = useState("");
  const [showAddCustomForm, setShowAddCustomForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const { popupState, showCustomAlert, showCustomConfirm } = useConfirmDialog();

  const loadWorkoutData = useCallback(async () => {
    if (!userId || !profile) return;
    setFetchingHistory(true);
    try {
      const todaysPlan = getTodaysWorkout({
        gymFrequency: profile.gymFrequency,
        gymExperience: profile.gymExperience,
        goal: profile.goal,
      }, selectedDay);
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
        youtubeId: ex.youtubeId,
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
          for (const workout of pastEvents) {
            const prevExercises = workout.payload?.exercises;
            if (!prevExercises) continue;

            const prevEx = prevExercises.find(
              (pe: any) => pe.id === currentEx.id || pe.name === currentEx.name
            );

            if (prevEx && prevEx.sets && prevEx.sets.length > 0) {
              const completedSets = prevEx.sets.filter((s: any) => s.completed);
              const activeSets = completedSets.length > 0 ? completedSets : prevEx.sets;

              const maxWeight = Math.max(...activeSets.map((s: any) => s.weight || 0));

              const setsAtMaxWeight = activeSets.filter((s: any) => s.weight === maxWeight);
              const maxRepsAtMaxWeight = setsAtMaxWeight.length > 0
                ? Math.max(...setsAtMaxWeight.map((s: any) => s.reps || 0))
                : 0;

              const targetRepParts = currentEx.targetReps.split("-");
              const maxTargetReps = parseInt(targetRepParts[targetRepParts.length - 1]);

              let suggestedWeight = maxWeight;

              if (maxRepsAtMaxWeight >= maxTargetReps && maxWeight > 0) {
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
                sets: currentEx.sets.map(() => ({
                  weight: suggestedWeight,
                  reps: 0,
                  completed: false,
                })),
              };
            }
          }

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
  }, [userId, profile, selectedDay]);

  useEffect(() => {
    if (userId && profile) {
      loadWorkoutData();
    }
  }, [userId, profile, loadWorkoutData]);

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

  const handleAddCustomExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExName.trim() || !customExMuscle.trim()) return;

    const targetSets = exercises[0]?.targetSets || 3;
    const targetReps = exercises[0]?.targetReps || "8-12";

    const newEx: ExerciseState = {
      id: `custom_${Date.now()}`,
      name: customExName.trim(),
      muscleGroup: customExMuscle.trim(),
      targetSets,
      targetReps,
      sets: Array.from({ length: targetSets }, () => ({
        weight: 0,
        reps: 0,
        completed: false,
      })),
    };

    setExercises((prev) => [...prev, newEx]);
    setCustomExName("");
    setCustomExMuscle("");
    setShowAddCustomForm(false);
  };

  const handleFinishWorkout = async () => {
    const userId = localStorage.getItem("healthos_userId");
    if (!userId || !plan) return;

    let totalVolume = 0;
    let loggedSetsCount = 0;

    const testLoggedCount = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
    if (testLoggedCount === 0) {
      const confirmLogEmpty = await showCustomConfirm(
        "Empty Workout ⚠️",
        "You haven't checked off any completed sets today! Do you want to log this as an empty workout session?",
        false
      );
      if (!confirmLogEmpty) {
        return;
      }
    }

    setLoading(true);

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

  if (authLoading || fetchingHistory) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white">
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

        <div className="p-6 text-center animate-in-delay-1 border border-white/5 bg-white/2 rounded-tl-3xl rounded-br-3xl">
          <Compass className="w-10 h-10 text-[#8ba893] mx-auto animate-pulse mb-3" />
          <h2 className="text-lg font-bold text-white mb-2 font-heading">Rest & Recover</h2>
          <p className="text-xs text-zinc-400 mb-4 max-w-xs mx-auto leading-relaxed">
            Your muscles grow during recovery, not during the workout. Take today to recharge.
          </p>
          <div className="space-y-3 text-left max-w-xs mx-auto border-t border-white/5 pt-4">
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <CheckCircle className="w-4 h-4 text-[#8ba893] flex-shrink-0" /> 
              <span>Get 7-9 hours of sleep tonight</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <CheckCircle className="w-4 h-4 text-[#8ba893] flex-shrink-0" /> 
              <span>Stay hydrated — aim for 3L+ of water</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <CheckCircle className="w-4 h-4 text-[#8ba893] flex-shrink-0" /> 
              <span>Light stretching or a 20-min walk</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-400">
              <CheckCircle className="w-4 h-4 text-[#8ba893] flex-shrink-0" /> 
              <span>Hit your protein target (1.6-2g/kg)</span>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-white/5 space-y-3 text-left max-w-xs mx-auto">
            <span className="text-[9px] text-[#8ba893] font-extrabold uppercase tracking-wider block">Active Mobility & Posture Drills</span>
            <div className="space-y-2 text-[11px] text-zinc-400 pl-1">
              <div className="flex items-start gap-2">
                <span className="text-[#8ba893] font-bold mt-0.5">•</span>
                <span><strong>Daily Steps</strong>: Target 12,000–15,000 steps today</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8ba893] font-bold mt-0.5">•</span>
                <span><strong>Spine Health</strong>: Thoracic Extension Stretch</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8ba893] font-bold mt-0.5">•</span>
                <span><strong>Lower Body</strong>: Hip Flexor & Hamstring Stretches</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8ba893] font-bold mt-0.5">•</span>
                <span><strong>Upper Posture</strong>: Chest Opener & Band Pull-Aparts</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-[#8ba893] font-bold mt-0.5">•</span>
                <span><strong>Shoulder Safety</strong>: External Rotations</span>
              </div>
            </div>
          </div>
        </div>

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
          <h1 className="text-xl font-bold text-white mt-0.5 font-heading">{plan?.name}</h1>
        </div>
        <span className="badge-info">Target: ~{plan?.targetDurationMin}m</span>
      </div>

      <GlassCard className="p-4 flex justify-between text-xs animate-in-delay-1">
        <div>
          <span className="text-zinc-500">Focus:</span>
          <p className="font-semibold text-white mt-0.5">{plan?.focus}</p>
        </div>
        <div className="text-right">
          <span className="text-zinc-500 flex items-center justify-end gap-1">
            Suggested Workload:
            <span 
              title="Total load lifted (sets × reps × weight) across the entire workout. This is a progression target, not a single lift!" 
              className="cursor-pointer text-zinc-400 bg-white/5 border border-white/10 rounded-full w-3.5 h-3.5 flex items-center justify-center text-[9px] font-bold"
              onClick={() => setShowHowToLog(true)}
            >
              ?
            </span>
          </span>
          <p className="font-semibold text-brand-400 mt-0.5">~ {Math.round(suggestedVolume).toLocaleString()} kg</p>
          <span className="text-[8px] text-zinc-500 block mt-0.5">(Cumulative weight lifted today)</span>
        </div>
      </GlassCard>

      {/* Weekly Program Split HUD */}
      {profile && (() => {
        const frequency = profile.gymFrequency ?? 4;
        const schedule = getWeekSchedule(frequency);
        const daysOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
        const currentDay = new Date().getDay();
        const getDayLabel = (d: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d];

        return (
          <GlassCard className="p-4 space-y-3 border border-white/10 relative overflow-hidden animate-in-delay-1">
            <div className="flex justify-between items-baseline">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Your Weekly Program</h3>
              <span className="text-[10px] text-brand-400 font-bold">{frequency}-Day Split</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {daysOrder.map((d) => {
                const scheduled = schedule.find((s) => s.day === d);
                const isToday = d === currentDay;
                const isSelected = d === selectedDay;
                return (
                  <button 
                    key={d} 
                    type="button"
                    onClick={() => setSelectedDay(d)}
                    className={`p-2 rounded-xl flex flex-col items-center justify-between text-center transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-[#8ba893]/20 border border-[#8ba893]/50 glow-green relative" 
                        : isToday 
                          ? "bg-cyan-500/5 border border-cyan-500/20 relative" 
                          : "bg-white/2 border border-white/5 hover:bg-white/5"
                    }`}
                  >
                    <span className={`text-[9px] font-bold ${isSelected ? "text-[#8ba893]" : isToday ? "text-cyan-400" : "text-zinc-500"}`}>
                      {getDayLabel(d)}
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-tighter mt-1 block truncate w-full ${
                      scheduled 
                        ? "text-brand-400 font-bold" 
                        : "text-zinc-600 font-normal"
                    }`}>
                      {scheduled ? (scheduled.name.includes(" — ") ? scheduled.name.split(" — ")[1] : scheduled.name).replace(" Day", "").replace(" A", "").replace(" B", "") : "Rest"}
                    </span>
                    {isToday && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </GlassCard>
        );
      })()}

      {/* Dynamic Overload Guide Card */}
      <GlassCard 
        className="p-3.5 flex items-center justify-between border border-white/10 bg-white/2 cursor-pointer hover:bg-white/5 transition-all animate-in-delay-1" 
        onClick={() => setShowHowToLog(true)}
      >
        <div className="flex items-center gap-2.5">
          <Lightbulb className="w-4 h-4 text-[#c87a53]" />
          <div className="text-left">
            <h4 className="text-[11px] font-bold text-white">How does progressive overload work?</h4>
            <p className="text-[9px] text-zinc-500 mt-0.5">Learn how suggested weights are calculated</p>
          </div>
        </div>
        <span className="text-zinc-500 text-xs">→</span>
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
            youtubeId={ex.youtubeId}
            onLogSet={(setIndex, w, r) => handleLogSet(ex.id, setIndex, w, r)}
            onToggleSet={(setIndex) => handleToggleSet(ex.id, setIndex)}
          />
        ))}
      </div>

      {/* Custom Exercise Section */}
      <div className="animate-in-delay-2">
        {!showAddCustomForm ? (
          <button
            type="button"
            onClick={() => setShowAddCustomForm(true)}
            className="w-full py-3 rounded-xl border border-dashed border-white/10 hover:border-white/20 bg-white/2 hover:bg-white/5 text-zinc-400 hover:text-white transition-all text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Custom Exercise to Session
          </button>
        ) : (
          <GlassCard className="p-4 border border-white/10 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Add Custom Exercise</h4>
            <form onSubmit={handleAddCustomExercise} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    Exercise Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hammer Strength Row"
                    value={customExName}
                    onChange={(e) => setCustomExName(e.target.value)}
                    className="input-glass text-xs py-2 px-3"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    Muscle Group
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Back"
                    value={customExMuscle}
                    onChange={(e) => setCustomExMuscle(e.target.value)}
                    className="input-glass text-xs py-2 px-3"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomForm(false);
                    setCustomExName("");
                    setCustomExMuscle("");
                  }}
                  className="px-3 py-1.5 rounded-lg border border-white/5 text-zinc-400 hover:text-white transition-all text-[10px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-3 py-1.5 rounded-lg text-white font-bold text-[10px] cursor-pointer"
                >
                  Add Exercise
                </button>
              </div>
            </form>
          </GlassCard>
        )}
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
                  <span className="flex items-center gap-1"><Dumbbell className="w-3 h-3 text-[#8ba893]" /> Volume: <strong className="text-brand-400">{w.payload.totalVolumeKg?.toLocaleString()} kg</strong></span>
                  <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-[#c87a53]" /> Sets: <strong className="text-cyan-400">{w.payload.completedSets}</strong></span>
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
      {/* How To Log Guide Modal */}
      <HowToLogModal open={showHowToLog} onClose={() => setShowHowToLog(false)} />

      {/* Premium Alert/Confirm Toast Popup */}
      <CustomPopup
        isOpen={popupState.isOpen}
        type={popupState.type}
        title={popupState.title}
        message={popupState.message}
        confirmText={popupState.confirmText}
        cancelText={popupState.cancelText}
        isDestructive={popupState.isDestructive}
        onConfirm={popupState.onConfirm}
        onCancel={popupState.onCancel}
      />
    </div>
  );
}

// How To Log Guide Modal Overlay
function HowToLogModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in">
      <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden flex flex-col max-h-[80vh] space-y-4">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold z-10"
        >
          ×
        </button>
        
        {/* Header */}
        <div className="space-y-1.5 text-center flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto">
            <Dumbbell className="w-5 h-5 text-[#8ba893]" />
          </div>
          <h3 className="text-base font-bold text-white mt-2">
            Progressive Overload Guide
          </h3>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
            Double Progression Method
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 pr-1 space-y-4 border-t border-white/5 pt-3 text-xs text-zinc-300">
          <div className="space-y-1">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-brand-400">1. Suggested Weights</h4>
            <p className="leading-relaxed text-[11px]">
              Suggested weights are calculated dynamically from your past logged workouts. The app tracks the maximum weight you successfully lifted for a completed set of an exercise.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-brand-400">2. How to Level Up</h4>
            <p className="leading-relaxed text-[11px]">
              If you hit the maximum reps in your target rep range (e.g. 12 reps on a 10-12 range) on all sets, the algorithm automatically increments your suggested weight next time:
            </p>
            <ul className="list-disc pl-4 mt-1 text-[10px] text-zinc-400 space-y-0.5">
              <li><strong>+2.5 kg</strong> for Barbell exercises</li>
              <li><strong>+2.0 kg</strong> for Dumbbell exercises</li>
            </ul>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-brand-400">3. Logging a Set</h4>
            <p className="leading-relaxed text-[11px]">
              Fill in your weight and reps for each set, then tap the checkmark. Completed sets turn green and are recorded to your timeline.
            </p>
          </div>

          <div className="space-y-1">
            <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-brand-400">4. Workout Workload (Volume)</h4>
            <p className="leading-relaxed text-[11px]">
              This is the cumulative weight lifted across all your completed sets:
              <span className="block mt-1 bg-white/5 p-1.5 rounded text-[10px] text-center font-mono">
                Volume = Sets × Reps × Weight
              </span>
              For example: doing 3 sets of 10 reps at 50 kg equals 1,500 kg of workload. It is a macro measure of your session capacity, not a single lift!
            </p>
          </div>
        </div>

        {/* Footer Action Button */}
        <button
          onClick={onClose}
          className="btn-primary w-full py-2.5 font-bold text-xs flex-shrink-0"
        >
          Let's Lift
        </button>
      </GlassCard>
    </div>
  );
}

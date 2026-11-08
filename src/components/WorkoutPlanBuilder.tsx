"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Exercise, LibraryExercise, WeekPlan } from "@/lib/workoutPlans";

const DAYS = [
  { index: 1, label: "Mon" },
  { index: 2, label: "Tue" },
  { index: 3, label: "Wed" },
  { index: 4, label: "Thu" },
  { index: 5, label: "Fri" },
  { index: 6, label: "Sat" },
  { index: 0, label: "Sun" },
];

const REST_NAME = "Rest Day";

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
}

export default function WorkoutPlanBuilder({ onClose, onSaved }: { onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [draft, setDraft] = useState<WeekPlan | null>(null);
  const [template, setTemplate] = useState<WeekPlan | null>(null);
  const [library, setLibrary] = useState<LibraryExercise[]>([]);
  const [isCustom, setIsCustom] = useState(false);
  const [day, setDay] = useState(new Date().getDay());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/workout-plan", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setDraft(data.week);
        setTemplate(data.template);
        setLibrary(data.library);
        setIsCustom(data.isCustom);
      } catch {
        setError("Your workout plan couldn't be loaded. Please try again.");
      }
    }
    load();
  }, []);

  const current = draft?.[day];

  const updateDay = (changes: Partial<WeekPlan[string]>) => {
    setDraft((week) => (week ? { ...week, [day]: { ...week[day], ...changes } } : week));
  };

  const updateExercise = (id: string, changes: Partial<Exercise>) => {
    if (current) updateDay({ exercises: current.exercises.map((item) => (item.id === id ? { ...item, ...changes } : item)) });
  };

  const addExercise = (base: Pick<LibraryExercise, "id" | "name" | "muscle" | "equipment" | "youtubeId">) => {
    if (!current || current.exercises.some((item) => item.id === base.id)) return;
    const exercise: Exercise = { ...base, targetSets: 3, targetReps: "8-12", restSeconds: 90 };
    updateDay({
      name: current.name === REST_NAME ? "Workout" : current.name,
      focus: "",
      targetDurationMin: 0,
      exercises: [...current.exercises, exercise],
    });
    setSearch("");
  };

  const makeRestDay = () => updateDay({ name: REST_NAME, focus: "Recovery & Mobility", targetDurationMin: 20, exercises: [] });

  const finish = async () => {
    await onSaved();
    onClose();
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/workout-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: draft }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Your plan couldn't be saved.");
        return;
      }
      await finish();
    } catch {
      setError("Your plan couldn't be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const resetToTemplate = async () => {
    if (!isCustom) {
      setDraft(template);
      return;
    }
    if (!window.confirm("Replace your whole plan with the default template? Your current plan will be lost.")) return;

    setSaving(true);
    try {
      const res = await fetch("/api/workout-plan", { method: "DELETE" });
      if (!res.ok) throw new Error();
      await finish();
    } catch {
      setError("Your plan couldn't be reset. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const term = search.trim().toLowerCase();
  const matches = term
    ? library.filter((item) => item.name.toLowerCase().includes(term) || item.muscle.toLowerCase().includes(term)).slice(0, 6)
    : [];
  const exactMatch = library.some((item) => item.name.toLowerCase() === term);

  return (
    <div className="fixed inset-0 bg-[#0c0f0d]/90 backdrop-blur-md z-[100] overflow-y-auto">
      <div className="max-w-lg mx-auto p-4 pb-28 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Edit Workout Plan</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">{isCustom ? "This is your own plan." : "Starting from the default template."}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-white/5 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {!draft && !error && <div className="shimmer h-40 w-full rounded-xl" />}

        {draft && current && (
          <>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map(({ index, label }) => (
                <button
                  key={index}
                  type="button"
                  aria-pressed={index === day}
                  onClick={() => {
                    setDay(index);
                    setSearch("");
                  }}
                  className={`py-2 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                    index === day ? "bg-[#8ba893] text-[#0c0f0d]" : draft[index].exercises.length ? "bg-white/10 text-white" : "bg-white/5 text-zinc-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {current.exercises.length > 0 && (
              <div>
                <label htmlFor="day-name" className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Day Name</label>
                <input id="day-name" value={current.name} maxLength={40} onChange={(e) => updateDay({ name: e.target.value })} className="input-glass text-xs h-11" />
              </div>
            )}

            <div className="space-y-2">
              {current.exercises.length === 0 && <p className="text-xs text-zinc-500 py-3 text-center">Rest day. Add an exercise to train on this day.</p>}
              {current.exercises.map((exercise) => (
                <div key={exercise.id} className="p-3 rounded-xl border border-white/5 bg-white/2 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-white block">{exercise.name}</span>
                      <span className="text-[10px] text-zinc-500 capitalize">{exercise.muscle}</span>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${exercise.name}`}
                      onClick={() => updateDay({ exercises: current.exercises.filter((item) => item.id !== exercise.id), focus: "", targetDurationMin: 0 })}
                      className="text-zinc-600 hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg">
                      <button type="button" aria-label={`Fewer sets of ${exercise.name}`} onClick={() => updateExercise(exercise.id, { targetSets: Math.max(1, exercise.targetSets - 1) })} className="w-7 h-7 rounded bg-white/5 text-white font-bold cursor-pointer">-</button>
                      <span className="text-xs text-white font-mono px-1">{exercise.targetSets} sets</span>
                      <button type="button" aria-label={`More sets of ${exercise.name}`} onClick={() => updateExercise(exercise.id, { targetSets: Math.min(10, exercise.targetSets + 1) })} className="w-7 h-7 rounded bg-white/5 text-white font-bold cursor-pointer">+</button>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-zinc-500">
                      Reps
                      <input
                        aria-label={`Reps for ${exercise.name}`}
                        value={exercise.targetReps}
                        maxLength={20}
                        onChange={(e) => updateExercise(exercise.id, { targetReps: e.target.value })}
                        className="input-glass text-xs h-9 w-20 px-2"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <input
                aria-label="Find an exercise"
                placeholder="Add an exercise, e.g. curl or chest"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-glass text-xs h-11"
              />
              {matches.map((item) => (
                <button key={item.id} type="button" onClick={() => addExercise(item)} className="w-full text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white cursor-pointer">
                  {item.name} <span className="text-zinc-500 capitalize">· {item.muscle}</span>
                </button>
              ))}
              {term && !exactMatch && (
                <button
                  type="button"
                  onClick={() => addExercise({ id: `custom_${slug(search)}`, name: search.trim(), muscle: "other", equipment: "bodyweight" })}
                  className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-white/10 text-xs text-zinc-300 cursor-pointer"
                >
                  Add &quot;{search.trim()}&quot; as my own exercise
                </button>
              )}
            </div>

            {current.exercises.length > 0 && (
              <button type="button" onClick={makeRestDay} className="text-[11px] text-zinc-500 hover:text-white cursor-pointer">
                Make this a rest day
              </button>
            )}

            <button type="button" onClick={save} disabled={saving} className="btn-primary w-full py-3 font-bold text-xs disabled:opacity-50">
              {saving ? "Saving..." : "Save My Plan"}
            </button>
            <button type="button" onClick={resetToTemplate} disabled={saving} className="w-full text-[11px] text-zinc-500 hover:text-white cursor-pointer">
              Reset to the default template
            </button>
          </>
        )}
      </div>
    </div>
  );
}

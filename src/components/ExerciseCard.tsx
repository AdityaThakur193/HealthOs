"use client";

interface ExerciseSet {
  weight: number;
  reps: number;
  completed: boolean;
}

interface ExerciseCardProps {
  name: string;
  muscleGroup: string;
  targetSets: number;
  targetReps: string;
  previousWeight?: number;
  suggestedWeight?: number;
  sets: ExerciseSet[];
  onLogSet: (setIndex: number, weight: number, reps: number) => void;
  onToggleSet: (setIndex: number) => void;
}

export default function ExerciseCard({
  name,
  muscleGroup,
  targetSets,
  targetReps,
  previousWeight,
  suggestedWeight,
  sets,
  onLogSet,
  onToggleSet,
}: ExerciseCardProps) {
  const completedSets = sets.filter((s) => s.completed).length;
  const allDone = completedSets === targetSets;

  return (
    <div className={`glass-card p-4 transition-all duration-300 ${allDone ? "border-brand-500/30" : ""}`}
      style={allDone ? { background: "rgba(34,197,94,0.04)" } : {}}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{name}</h3>
          <p className="text-xs text-zinc-500 mt-0.5">{muscleGroup} · {targetSets}×{targetReps}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: targetSets }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                background: i < completedSets ? "#22c55e" : "rgba(255,255,255,0.12)",
                boxShadow: i < completedSets ? "0 0 6px rgba(34,197,94,0.5)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Progressive overload hint */}
      {suggestedWeight && (
        <div className="mb-3 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2"
          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
          <span className="text-brand-400">↑</span>
          <span className="text-zinc-400">Suggested: <span className="text-brand-400 font-semibold">{suggestedWeight}kg</span></span>
          {previousWeight && <span className="text-zinc-600 ml-auto">prev {previousWeight}kg</span>}
        </div>
      )}

      {/* Sets */}
      <div className="space-y-2">
        {sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-zinc-600 w-6">#{i + 1}</span>
            <input
              type="number"
              placeholder="kg"
              value={set.weight || ""}
              onChange={(e) => onLogSet(i, parseFloat(e.target.value), set.reps)}
              className="input-glass text-center h-9 text-xs flex-1"
            />
            <input
              type="number"
              placeholder={targetReps.replace(/[^0-9\-]/g, "").split("-")[0] || "10"}
              value={set.reps || ""}
              onChange={(e) => onLogSet(i, set.weight, parseInt(e.target.value))}
              className="input-glass text-center h-9 text-xs flex-1"
            />
            <button
              onClick={() => onToggleSet(i)}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                set.completed
                  ? "text-white"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              style={set.completed ? { background: "#22c55e", boxShadow: "0 0 12px rgba(34,197,94,0.3)" } : { background: "rgba(255,255,255,0.06)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

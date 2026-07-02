"use client";

interface MealFood {
  name: string;
  portionSize: "small" | "medium" | "large";
  estimatedCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

interface MealResultCardProps {
  food: MealFood;
  onPortionChange: (portion: "small" | "medium" | "large") => void;
  onRemove: () => void;
}

const portionMultipliers = { small: 0.7, medium: 1.0, large: 1.4 };

export default function MealResultCard({ food, onPortionChange, onRemove }: MealResultCardProps) {
  const mult = portionMultipliers[food.portionSize];
  const cal = Math.round(food.estimatedCalories * mult);
  const protein = Math.round(food.proteinG * mult);

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-white capitalize">{food.name}</h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            <span className="text-brand-400 font-medium">{cal} kcal</span>
            {" · "}{protein}g protein
          </p>
        </div>
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Portion selector */}
      <div className="flex gap-2">
        {(["small", "medium", "large"] as const).map((p) => (
          <button
            key={p}
            onClick={() => onPortionChange(p)}
            className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 capitalize ${
              food.portionSize === p ? "chip-active" : "chip"
            }`}
          >
            {p === "small" ? "S" : p === "medium" ? "M" : "L"}
          </button>
        ))}
      </div>
    </div>
  );
}

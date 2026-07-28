"use client";

import { calculateFoodMacros } from "@/lib/ifctData";

export interface MealFood {
  name: string;
  dishName?: string;
  preparationStyle?: string;
  portionSize?: "small" | "medium" | "large";
  quantity?: number;
  unitType?: string;
  estimatedCalories: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
  weightGrams?: number;
}

interface MealResultCardProps {
  food: MealFood;
  onQuantityChange: (newQuantity: number) => void;
  onRemove: () => void;
}

export default function MealResultCard({ food, onQuantityChange, onRemove }: MealResultCardProps) {
  const currentQty = Math.max(0.5, food.quantity || 1);
  const unit = food.unitType || "piece";

  // Calculate real-time IFCT 2017 macros
  const calculated = calculateFoodMacros(
    food.dishName || food.name,
    currentQty,
    unit,
    food.preparationStyle || "standard"
  );

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-white capitalize">{food.name}</h4>
            {food.preparationStyle && food.preparationStyle !== "standard" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 capitalize">
                {food.preparationStyle.replace("_", " ")}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            <span className="text-brand-400 font-bold">{calculated.calories} kcal</span>
            {" · "}
            <span className="text-white font-medium">{calculated.proteinG}g protein</span>
            {" · "}
            <span className="text-zinc-500 text-[10px]">{calculated.weightGrams}g total</span>
          </p>
        </div>

        <button
          onClick={onRemove}
          type="button"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-600 hover:text-rose-400 transition-colors"
          style={{ background: "rgba(255,255,255,0.04)" }}
          title="Remove dish"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      </div>

      {/* Interactive Portion Counter Controls */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Portion ({unit})
        </span>

        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => onQuantityChange(Math.max(0.5, currentQty - 0.5))}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer"
          >
            -
          </button>
          <span className="px-2 text-xs font-bold text-white font-mono min-w-[28px] text-center">
            {currentQty}
          </span>
          <button
            type="button"
            onClick={() => onQuantityChange(currentQty + 0.5)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

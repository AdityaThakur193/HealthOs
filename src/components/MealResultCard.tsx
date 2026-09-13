"use client";

import { calculateFoodMacros } from "@/lib/ifctData";
import { AlertTriangle } from "lucide-react";

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
  unmatched?: boolean;
}

interface MealResultCardProps {
  food: MealFood;
  onQuantityChange: (newQuantity: number) => void;
  onRemove: () => void;
  onFoodChange?: (updatedFood: MealFood) => void;
}

export default function MealResultCard({
  food,
  onQuantityChange,
  onRemove,
  onFoodChange,
}: MealResultCardProps) {
  const currentQty = Math.max(0.5, food.quantity || 1);
  const unit = food.unitType || "piece";

  // Check if item is unmatched in database
  const isUnmatched = Boolean(
    food.unmatched || !calculateFoodMacros(food.dishName || food.name, 1).matched
  );

  // If matched, compute real-time IFCT 2017 macros; if unmatched, use current food values
  const calculated = isUnmatched
    ? {
        calories: food.estimatedCalories || 0,
        proteinG: food.proteinG || 0,
        carbsG: food.carbsG || 0,
        fatG: food.fatG || 0,
        weightGrams: food.weightGrams || 0,
      }
    : calculateFoodMacros(
        food.dishName || food.name,
        currentQty,
        unit,
        food.preparationStyle || "standard"
      );

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-sm font-semibold text-white capitalize">{food.name}</h4>
            {food.preparationStyle && food.preparationStyle !== "standard" && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20 capitalize">
                {food.preparationStyle.replace("_", " ")}
              </span>
            )}
            {isUnmatched && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" /> Not in database
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            <span className={isUnmatched ? "text-amber-400 font-bold" : "text-brand-400 font-bold"}>
              {calculated.calories} kcal
            </span>
            {" · "}
            <span className="text-white font-medium">{calculated.proteinG}g protein</span>
            {calculated.weightGrams > 0 && (
              <>
                {" · "}
                <span className="text-zinc-500 text-[10px]">{calculated.weightGrams}g total</span>
              </>
            )}
            {isUnmatched && calculated.calories === 0 && (
              <span className="text-amber-400/80 text-[10px] block mt-0.5">
                ⚠️ Enter macros manually below to track this item
              </span>
            )}
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

      {/* Manual Macro Entry for Unmatched Items */}
      {isUnmatched && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2 animate-in">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Enter Macros Manually
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">
              Portion: {currentQty} {unit}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="text-[8px] text-zinc-400 block mb-1 font-bold uppercase tracking-wider">
                Calories
              </label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={food.estimatedCalories || ""}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  onFoodChange?.({ ...food, estimatedCalories: val });
                }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-400 block mb-1 font-bold uppercase tracking-wider">
                Protein (g)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={food.proteinG || ""}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  onFoodChange?.({ ...food, proteinG: val });
                }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-400 block mb-1 font-bold uppercase tracking-wider">
                Carbs (g)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={food.carbsG || ""}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  onFoodChange?.({ ...food, carbsG: val });
                }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="text-[8px] text-zinc-400 block mb-1 font-bold uppercase tracking-wider">
                Fat (g)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={food.fatG || ""}
                onChange={(e) => {
                  const val = Math.max(0, Number(e.target.value) || 0);
                  onFoodChange?.({ ...food, fatG: val });
                }}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      )}

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

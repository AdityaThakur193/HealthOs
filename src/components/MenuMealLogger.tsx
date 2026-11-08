"use client";

import { useCallback, useEffect, useState } from "react";
import GlassCard from "./GlassCard";

type MealName = "breakfast" | "lunch" | "snacks" | "dinner";

interface MenuFood {
  name: string;
  unit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  source: "ifct" | "estimated" | "unknown";
  start: number;
  step: number;
  lastQuantity: number | null;
}

interface MenuMeal {
  meal: MealName;
  hours: string;
  state: "open" | "upcoming" | "closed";
  logged: boolean;
}

interface TodayMenu {
  meal: MealName;
  meals: MenuMeal[];
  foods: MenuFood[];
}

const MAX_QUANTITY = 10;

function label(meal: string): string {
  return meal.charAt(0).toUpperCase() + meal.slice(1);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export default function MenuMealLogger({
  onLogged,
  onUnavailable,
  onError,
}: {
  onLogged: () => void;
  onUnavailable: () => void;
  onError: (message: string) => void;
}) {
  const [menu, setMenu] = useState<TodayMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Nothing is selected until the user taps it, so nothing is ever assumed.
  const [selected, setSelected] = useState<Record<string, number>>({});

  const loadMeal = useCallback(
    async (meal?: MealName) => {
      try {
        const res = await fetch(`/api/mess-menu/today${meal ? `?meal=${meal}` : ""}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.available) {
          onUnavailable();
          return;
        }
        setMenu(data);
        setSelected({});
      } catch (err) {
        console.error("Failed to load today's menu:", err);
        onUnavailable();
      } finally {
        setLoading(false);
      }
    },
    [onUnavailable]
  );

  useEffect(() => {
    // Async data load: state only changes after the response arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMeal();
  }, [loadMeal]);

  const toggle = (food: MenuFood) => {
    setSelected((current) => {
      if (food.name in current) {
        const remaining = { ...current };
        delete remaining[food.name];
        return remaining;
      }
      return { ...current, [food.name]: food.lastQuantity ?? food.start };
    });
  };

  const adjust = (food: MenuFood, direction: number) => {
    setSelected((current) => {
      const quantity = round((current[food.name] ?? food.start) + direction * food.step);
      if (quantity <= 0) {
        const remaining = { ...current };
        delete remaining[food.name];
        return remaining;
      }
      return { ...current, [food.name]: Math.min(MAX_QUANTITY, quantity) };
    });
  };

  if (loading) return <div className="shimmer h-40 w-full rounded-xl" />;
  if (!menu) return null;

  const chosen = menu.foods.filter((food) => food.name in selected);
  const sumOf = (key: "calories" | "proteinG" | "carbsG" | "fatG") =>
    round(chosen.reduce((sum, food) => sum + food[key] * selected[food.name], 0));
  const current = menu.meals.find((meal) => meal.meal === menu.meal);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "meal",
          source: "manual",
          tags: [menu.meal, "menu"],
          payload: {
            mealType: menu.meal,
            loggedVia: "menu",
            totalCalories: Math.round(sumOf("calories")),
            totalProteinG: sumOf("proteinG"),
            totalCarbsG: sumOf("carbsG"),
            totalFatG: sumOf("fatG"),
            foods: chosen.map((food) => ({
              name: food.name,
              quantity: selected[food.name],
              unitType: food.unit,
              estimatedCalories: Math.round(food.calories * selected[food.name]),
              proteinG: round(food.proteinG * selected[food.name]),
              carbsG: round(food.carbsG * selected[food.name]),
              fatG: round(food.fatG * selected[food.name]),
              estimated: food.source !== "ifct",
            })),
          },
        }),
      });

      if (res.ok) {
        onLogged();
      } else {
        const data = await res.json().catch(() => ({}));
        onError(data.error || "We could not save this meal. Please try again.");
      }
    } catch (err) {
      console.error("Failed to log menu meal:", err);
      onError("We could not reach the server to save this meal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {menu.meals.map((meal) => (
          <button
            key={meal.meal}
            type="button"
            aria-pressed={meal.meal === menu.meal}
            onClick={() => loadMeal(meal.meal)}
            className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              meal.meal === menu.meal
                ? "bg-brand-500 text-white border-brand-500"
                : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
            }`}
          >
            {label(meal.meal)}
            {meal.logged ? " ✓" : ""}
          </button>
        ))}
      </div>

      <GlassCard className="p-5 space-y-3 border border-white/10">
        <div>
          <h3 className="text-sm font-bold text-white">What did you take?</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            {label(menu.meal)}, {current?.hours}
            {current?.logged ? " · Already logged today" : ""}
          </p>
        </div>

        {menu.foods.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">Nothing is listed for this meal today.</p>
        ) : (
          <div className="space-y-2">
            {menu.foods.map((food) => {
              const isSelected = food.name in selected;
              const quantity = selected[food.name] ?? 0;
              return (
                <div
                  key={food.name}
                  className={`p-3 rounded-xl border transition-all ${
                    isSelected ? "border-brand-500/50 bg-brand-500/10" : "border-white/5 bg-white/2"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => toggle(food)}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <span className="text-xs font-semibold text-white block">{food.name}</span>
                      <span className="text-[10px] text-zinc-500 block mt-0.5">
                        {food.source === "unknown"
                          ? "No nutrition data, won't be counted"
                          : isSelected
                            ? `${Math.round(food.calories * quantity)} kcal · ${round(food.proteinG * quantity)}g protein${food.source === "estimated" ? " · estimated" : ""}`
                            : food.lastQuantity
                              ? `Last time: ${food.lastQuantity} ${food.unit}`
                              : `Tap if you took this`}
                      </span>
                    </button>

                    {isSelected && (
                      <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/5 flex-shrink-0">
                        <button
                          type="button"
                          aria-label={`Less ${food.name}`}
                          onClick={() => adjust(food, -1)}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-sm cursor-pointer"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold text-white font-mono min-w-[52px] text-center">
                          {quantity} {food.unit === "piece" ? "pc" : food.unit}
                        </span>
                        <button
                          type="button"
                          aria-label={`More ${food.name}`}
                          onClick={() => adjust(food, 1)}
                          className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-sm cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={chosen.length === 0 || saving}
          className="btn-primary w-full py-3 font-bold text-xs disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : chosen.length === 0
              ? "Tap what you took"
              : `Log ${label(menu.meal)} · ${Math.round(sumOf("calories"))} kcal · ${sumOf("proteinG")}g protein`}
        </button>
      </GlassCard>
    </div>
  );
}

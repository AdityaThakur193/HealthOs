"use client";

import { MEAL_NAMES, MealName, MessTimings } from "@/lib/mealWindows";

export default function MessHoursEditor({ value, onChange }: { value: MessTimings; onChange: (next: MessTimings) => void }) {
  const update = (kind: keyof MessTimings, meal: MealName, edge: "start" | "end", time: string) => {
    onChange({ ...value, [kind]: { ...value[kind], [meal]: { ...value[kind][meal], [edge]: time } } });
  };

  return (
    <>
      {(["regular", "holiday"] as const).map((kind) => (
        <div key={kind} className="space-y-2">
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            {kind === "regular" ? "Monday to Saturday" : "Sundays & Holidays"}
          </p>
          {MEAL_NAMES.map((meal) => (
            <div key={meal} className="grid grid-cols-[72px_1fr_1fr] gap-2 items-center">
              <span className="text-xs text-zinc-300 capitalize">{meal}</span>
              {(["start", "end"] as const).map((edge) => (
                <input
                  key={edge}
                  type="time"
                  aria-label={`${kind} ${meal} ${edge === "start" ? "opens" : "closes"}`}
                  value={value[kind][meal][edge]}
                  onChange={(e) => update(kind, meal, edge, e.target.value)}
                  className="input-glass text-xs h-10 px-2 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                />
              ))}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

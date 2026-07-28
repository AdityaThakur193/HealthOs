"use client";

interface MacroBarProps {
  label: string;
  value: number;
  max: number;
  unit?: string;
  color: string;
}

export default function MacroBar({
  label,
  value,
  max,
  unit = "g",
  color,
}: MacroBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="flex items-center gap-3">
      <div className="w-16 text-xs font-medium text-zinc-400">{label}</div>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}, ${color}dd)`,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
      <div className="w-20 text-right">
        <span className="text-xs font-semibold text-white">{value}</span>
        <span className="text-xs text-zinc-500"> / {max}{unit}</span>
      </div>
    </div>
  );
}

"use client";

interface StepIndicatorProps {
  total: number;
  current: number;
}

export default function StepIndicator({ total, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all duration-500"
          style={{
            width: i === current ? 24 : 6,
            height: 6,
            background:
              i < current
                ? "rgba(34, 197, 94, 0.4)"
                : i === current
                ? "#22c55e"
                : "rgba(255,255,255,0.1)",
          }}
        />
      ))}
    </div>
  );
}

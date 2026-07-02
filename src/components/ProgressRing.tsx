"use client";

interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  bgColor?: string;
}

export default function ProgressRing({
  value,
  max,
  size = 160,
  strokeWidth = 10,
  label,
  sublabel,
  color = "#22c55e",
  bgColor = "rgba(255,255,255,0.06)",
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const strokeDashoffset = circumference * (1 - percentage);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ filter: `drop-shadow(0 0 8px ${color}20)` }}
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Glow circle at tip */}
        {percentage > 0.02 && (
          <circle
            cx={size / 2 + radius * Math.cos(2 * Math.PI * percentage - Math.PI / 2)}
            cy={size / 2 + radius * Math.sin(2 * Math.PI * percentage - Math.PI / 2)}
            r={strokeWidth / 2 + 2}
            fill={color}
            opacity={0.3}
            className="animate-pulse"
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <span className="text-2xl font-bold text-white">{label}</span>
        )}
        {sublabel && (
          <span className="text-xs text-zinc-400 mt-0.5">{sublabel}</span>
        )}
      </div>
    </div>
  );
}

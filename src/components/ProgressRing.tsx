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

  const isVarColor = color.startsWith("var");

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ filter: isVarColor ? "drop-shadow(0 0 6px var(--brand-glow))" : `drop-shadow(0 0 8px ${color}30)` }}
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
          style={{
            strokeDashoffset: strokeDashoffset,
            transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
        />
        {/* Glow circle at tip */}
        {percentage > 0.01 && (
          <circle
            cx={size / 2 + radius * Math.cos(2 * Math.PI * percentage - Math.PI / 2)}
            cy={size / 2 + radius * Math.sin(2 * Math.PI * percentage - Math.PI / 2)}
            r={strokeWidth / 2 + 1}
            fill={color}
            opacity={0.8}
            className="animate-pulse"
          />
        )}
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label && (
          <span 
            className="font-bold text-white"
            style={{ fontSize: size < 100 ? `${size * 0.18}px` : "24px" }}
          >
            {label}
          </span>
        )}
        {sublabel && (
          <span 
            className="text-zinc-400 mt-0.5"
            style={{ fontSize: size < 100 ? `${size * 0.1}px` : "12px" }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

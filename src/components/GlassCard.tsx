import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  glow?: "green" | "cyan" | "purple" | "none";
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className = "",
  elevated = false,
  glow = "none",
  onClick,
}: GlassCardProps) {
  const glowClass = {
    green: "glow-green",
    cyan: "glow-cyan",
    purple: "glow-purple",
    none: "",
  }[glow];

  return (
    <div
      className={`${elevated ? "glass-card-elevated" : "glass-card"} ${glowClass} ${className} ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

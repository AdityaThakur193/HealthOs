"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  elevated?: boolean;
  glow?: "green" | "cyan" | "purple" | "none";
  onClick?: () => void;
  hoverScale?: boolean;
}

export default function GlassCard({
  children,
  className = "",
  elevated = false,
  glow = "none",
  onClick,
  hoverScale = true,
}: GlassCardProps) {
  const glowClass = {
    green: "glow-green",
    cyan: "glow-cyan",
    purple: "glow-purple",
    none: "",
  }[glow];

  const isInteractive = !!onClick;
  const Tag = isInteractive && hoverScale ? motion.div : "div";

  return (
    <Tag
      className={`${elevated ? "glass-card-elevated" : "glass-card"} ${glowClass} ${className} ${isInteractive ? "cursor-pointer" : ""}`}
      onClick={onClick}
      {...(isInteractive && hoverScale
        ? {
            whileHover: { scale: 1.015, y: -2, transition: { type: "spring", stiffness: 400, damping: 25 } },
            whileTap: { scale: 0.985 },
          }
        : {})}
    >
      {children}
    </Tag>
  );
}

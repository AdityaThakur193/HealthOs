"use client";

import { ReactNode } from "react";

interface ReviewCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accentColor?: string;
  icon?: string;
}

export default function ReviewCard({ title, subtitle, children, accentColor = "#22c55e", icon }: ReviewCardProps) {
  return (
    <div
      className="glass-card-elevated p-6 min-h-64 flex flex-col"
      style={{
        background: `linear-gradient(135deg, rgba(10,10,15,0.9), rgba(10,10,15,0.7))`,
        borderTop: `2px solid ${accentColor}40`,
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1"
            style={{ color: accentColor }}>Weekly Review</p>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        {icon && (
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}20` }}
          >
            {icon}
          </div>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

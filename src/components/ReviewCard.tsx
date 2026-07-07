"use client";

import { ReactNode } from "react";

interface ReviewCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  accentColor?: string;
  icon?: ReactNode;
}

export default function ReviewCard({
  title,
  subtitle,
  children,
  accentColor = "#8ba893",
  icon,
}: ReviewCardProps) {
  return (
    <div
      className="p-5 min-h-[340px] flex flex-col justify-between transition-all duration-300 relative rounded-tl-3xl rounded-br-3xl"
      style={{
        background: "rgba(20, 24, 21, 0.65)",
        borderLeft: `2.5px solid ${accentColor}`,
        borderTop: "1px solid rgba(255, 255, 255, 0.03)",
        borderRight: "1px solid rgba(255, 255, 255, 0.03)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.03)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.35)",
      }}
    >
      {/* Card Header (Asymmetric, Left Aligned) */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="text-left flex-1 min-w-0">
          <span 
            className="text-[8px] font-extrabold uppercase tracking-widest block font-mono"
            style={{ color: accentColor }}
          >
            Weekly Review
          </span>
          <h3 className="text-lg font-bold text-white mt-1 font-heading leading-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-zinc-500 mt-1 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-tr-xl rounded-bl-xl flex items-center justify-center flex-shrink-0 border"
            style={{ 
              background: `${accentColor}08`, 
              borderColor: `${accentColor}18` 
            }}
          >
            {icon}
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="flex-1 flex flex-col justify-center">{children}</div>
    </div>
  );
}

"use client";

import React from "react";
import GlassCard from "./GlassCard";

interface CustomPopupProps {
  isOpen: boolean;
  type: "alert" | "confirm" | "error" | "success" | "warning";
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function CustomPopup({
  isOpen,
  type,
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}: CustomPopupProps) {
  if (!isOpen) return null;

  let icon = "💡";
  let iconBg = "bg-cyan-500/10 border-cyan-500/20";
  let buttonStyle = "bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d]";

  if (type === "error" || isDestructive) {
    icon = "⚠️";
    iconBg = "bg-red-500/10 border-red-500/20 text-red-400";
    buttonStyle = "bg-red-500 hover:bg-red-600 text-white";
  } else if (type === "success") {
    icon = "✅";
    iconBg = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
    buttonStyle = "bg-emerald-500 hover:bg-emerald-600 text-white";
  } else if (type === "warning") {
    icon = "🚨";
    iconBg = "bg-amber-500/10 border-amber-500/20 text-amber-400";
    buttonStyle = "bg-amber-500 hover:bg-amber-600 text-white";
  }

  return (
    <div className="fixed inset-0 bg-[#0c0f0d]/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in">
      <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden flex flex-col space-y-4 shadow-2xl">
        <div className="space-y-2 text-center">
          {/* Icon Header */}
          <div className={`w-12 h-12 rounded-full ${iconBg} border flex items-center justify-center mx-auto text-xl`}>
            {icon}
          </div>
          
          {/* Title */}
          <h3 className="text-sm font-bold text-white mt-3">
            {title}
          </h3>
          
          {/* Message Description */}
          <p className="text-[11px] text-zinc-400 leading-relaxed pt-1">
            {message}
          </p>
        </div>

        {/* Action Controls */}
        <div className="pt-2 flex flex-col gap-2">
          <button
            onClick={onConfirm}
            className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${buttonStyle}`}
          >
            {confirmText}
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-bold text-xs transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

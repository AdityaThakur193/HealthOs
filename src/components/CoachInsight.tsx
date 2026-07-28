"use client";

import { CheckCircle2, ShieldAlert, Award, ArrowUpRight } from "lucide-react";

interface CoachInsightProps {
  status: "on_track" | "needs_attention" | "great_job";
  greeting: string;
  primaryInsight: string;
  actionItems: string[];
  motivation: string;
  loading?: boolean;
}

const statusConfig = {
  on_track: {
    badge: "On Track",
    color: "#8ba893",
    Icon: CheckCircle2,
  },
  needs_attention: {
    badge: "Needs Attention",
    color: "#c87a53",
    Icon: ShieldAlert,
  },
  great_job: {
    badge: "Great Job",
    color: "#8ba893",
    Icon: Award,
  },
};

export default function CoachInsight({
  status,
  greeting,
  primaryInsight,
  actionItems,
  motivation,
  loading = false,
}: CoachInsightProps) {
  if (loading) {
    return (
      <div className="py-5 border-y border-white/5 space-y-3">
        <div className="shimmer h-4 w-24 rounded-full" />
        <div className="shimmer h-6 w-48 rounded-lg" />
        <div className="shimmer h-4 w-full rounded-lg" />
        <div className="shimmer h-4 w-3/4 rounded-lg" />
      </div>
    );
  }

  const config = statusConfig[status] || statusConfig.on_track;
  const Icon = config.Icon;

  return (
    <div className="py-5 border-y border-white/5 space-y-4 animate-in">
      {/* Header (Left Aligned, Editorial) */}
      <div className="flex items-start justify-between gap-3">
        <div className="text-left">
          <span 
            className="text-[8px] font-extrabold uppercase tracking-widest font-mono px-2 py-0.5 rounded"
            style={{ 
              color: config.color,
              background: `${config.color}08` 
            }}
          >
            {config.badge}
          </span>
          <h3 className="text-sm font-extrabold text-white mt-2.5 font-heading leading-tight">{greeting}</h3>
        </div>
        <div
          className="w-9 h-9 rounded-tr-lg rounded-bl-lg flex items-center justify-center flex-shrink-0 border"
          style={{ 
            background: `${config.color}05`, 
            borderColor: `${config.color}15` 
          }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
      </div>

      {/* Primary Pull-Quote Insight */}
      <div className="border-l-2 pl-3 py-0.5 text-left" style={{ borderColor: `${config.color}50` }}>
        <p className="text-xs text-zinc-300 leading-relaxed font-medium italic">
          &ldquo;{primaryInsight}&rdquo;
        </p>
      </div>

      {/* Action Items List */}
      <div className="space-y-2.5 pt-1 text-left">
        {actionItems.map((item: any, i) => {
          let text = "";
          if (item && typeof item === "object") {
            const task = item.task || item.text || item.action || "";
            const why = item.why || item.reason || "";
            text = why ? `${task} (${why})` : `${task}`;
          } else {
            text = String(item);
          }
          return (
            <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
              <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-zinc-600" />
              <span className="leading-snug">{text}</span>
            </div>
          );
        })}
      </div>

      {/* Motivation */}
      <p className="text-[10px] text-zinc-600 font-mono tracking-wide text-left pt-1 border-t border-white/5 uppercase">
        {motivation}
      </p>
    </div>
  );
}

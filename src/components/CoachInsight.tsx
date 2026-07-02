"use client";

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
    badgeClass: "badge-info",
    dot: "bg-cyan-400",
    icon: "→",
  },
  needs_attention: {
    badge: "Needs Attention",
    badgeClass: "badge-warning",
    dot: "bg-amber-400",
    icon: "!",
  },
  great_job: {
    badge: "Great Job",
    badgeClass: "badge-success",
    dot: "bg-brand-400",
    icon: "★",
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
      <div className="glass-card p-5 space-y-3">
        <div className="shimmer h-4 w-24 rounded-full" />
        <div className="shimmer h-6 w-48 rounded-lg" />
        <div className="shimmer h-4 w-full rounded-lg" />
        <div className="shimmer h-4 w-3/4 rounded-lg" />
      </div>
    );
  }

  const config = statusConfig[status];

  return (
    <div className="glass-card p-5 space-y-4 border border-white/10">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className={config.badgeClass}>{config.badge}</span>
          <h3 className="text-base font-semibold text-white mt-2">{greeting}</h3>
        </div>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0`}
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {config.icon}
        </div>
      </div>

      {/* Primary Insight */}
      <p className="text-sm text-zinc-300 leading-relaxed border-l-2 border-brand-500/40 pl-3">
        {primaryInsight}
      </p>

      {/* Action Items */}
      <div className="space-y-2">
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
            <div key={i} className="flex items-start gap-2.5">
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
              <span className="text-xs text-zinc-400 leading-relaxed">{text}</span>
            </div>
          );
        })}
      </div>

      {/* Motivation */}
      <p className="text-xs text-zinc-500 italic pt-1 border-t border-white/5">{motivation}</p>
    </div>
  );
}

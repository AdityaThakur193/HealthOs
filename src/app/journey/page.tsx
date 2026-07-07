"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ProgressRing from "@/components/ProgressRing";

interface WeightPoint {
  date: string;
  weight: number;
}

export default function Journey() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Stats states
  const [weightHistory, setWeightHistory] = useState<WeightPoint[]>([]);
  const [weeklyWorkouts, setWeeklyWorkouts] = useState(0);
  const [avgSleepHours, setAvgSleepHours] = useState(0);
  const [weightDelta, setWeightDelta] = useState<number | null>(null);
  const [allEvents, setAllEvents] = useState<any[]>([]);

  // UI state
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const email = localStorage.getItem("healthos_email");
    const userId = localStorage.getItem("healthos_userId");
    if (!email || !userId) {
      router.push("/login");
      return;
    }

    async function loadJourneyData() {
      try {
        // 1. Fetch Profile
        const profRes = await fetch(`/api/profile?email=${email}`);
        if (!profRes.ok) {
          router.push("/onboarding");
          return;
        }
        const profData = await profRes.json();
        setProfile(profData.profile);

        // 2. Fetch Timeline Events
        const timelineRes = await fetch(`/api/timeline?userId=${userId}`);
        if (timelineRes.ok) {
          const timelineData = await timelineRes.json();
          const events = timelineData.events || [];
          setAllEvents(events);

          // Process Weight History (last 14 days)
          const weightEvents = events
            .filter((e: any) => e.type === "weight")
            .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

          const weightPoints: WeightPoint[] = weightEvents.map((w: any) => ({
            date: new Date(w.timestamp).toLocaleDateString([], { month: "short", day: "numeric" }),
            weight: Number(w.payload.weightKg),
          }));
          setWeightHistory(weightPoints);

          if (weightPoints.length >= 2) {
            const first = weightPoints[0].weight;
            const last = weightPoints[weightPoints.length - 1].weight;
            setWeightDelta(Math.round((last - first) * 10) / 10);
          }

          // Process weekly stats
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const recentEvents = events.filter(
            (e: any) => new Date(e.timestamp).getTime() >= sevenDaysAgo.getTime()
          );

          const workoutCount = recentEvents.filter((e: any) => e.type === "workout").length;
          setWeeklyWorkouts(workoutCount);

          const sleepEvents = recentEvents.filter((e: any) => e.type === "sleep");
          const totalSleep = sleepEvents.reduce((sum: number, s: any) => sum + (s.payload.hours || 0), 0);
          setAvgSleepHours(sleepEvents.length ? Math.round((totalSleep / sleepEvents.length) * 10) / 10 : 0);
        }
      } catch (err) {
        console.error("Failed to load journey data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadJourneyData();
  }, [router]);

  const handleExportData = () => {
    if (!profile || allEvents.length === 0) return;
    setExporting(true);

    try {
      const dataArchive = {
        exportedAt: new Date().toISOString(),
        profile: {
          name: profile.name,
          email: profile.email,
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          targetWeightKg: profile.targetWeightKg,
          goal: profile.goal,
          activityLevel: profile.activityLevel,
          sleepTarget: profile.sleepTarget,
        },
        timelineHistory: allEvents.map((e) => ({
          type: e.type,
          timestamp: e.timestamp,
          payload: e.payload,
          source: e.source,
        })),
      };

      const jsonStr = JSON.stringify(dataArchive, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `healthos_data_export_${profile.name.toLowerCase().replace(/\s+/g, "_")}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export data:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;
    const confirmDelete = window.confirm(
      "Are you absolutely sure you want to delete your profile and ALL logged history? This action is irreversible."
    );
    if (!confirmDelete) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/profile?email=${profile.email}`, {
        method: "DELETE",
      });
      if (res.ok) {
        localStorage.clear();
        router.push("/login");
      }
    } catch (err) {
      console.error("Failed to delete account:", err);
      alert("Failed to delete account. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this log?")) return;
    try {
      const res = await fetch(`/api/timeline?eventId=${eventId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const userId = localStorage.getItem("healthos_userId");
        if (userId) {
          const timelineRes = await fetch(`/api/timeline?userId=${userId}`);
          if (timelineRes.ok) {
            const data = await timelineRes.json();
            setAllEvents(data.events || []);
          }
        }
      } else {
        alert("Failed to delete log.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting log.");
    }
  };

  const getGroupedEvents = () => {
    const groups: Record<string, any[]> = {};
    allEvents.forEach((event) => {
      const dateStr = new Date(event.timestamp).toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(event);
    });
    return Object.entries(groups);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="w-8 h-8 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Loading Journey...</p>
      </div>
    );
  }

  // Calculate SVG line points for weight chart
  const renderWeightChart = () => {
    if (weightHistory.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
          <span className="text-2xl">📉</span>
          <p className="text-xs text-zinc-400 font-medium">No Weight Logs Found</p>
          <p className="text-[10px] text-zinc-600 max-w-xs leading-relaxed">
            We need your weight entries to display your trend. Log weight on the home dashboard to generate this graph.
          </p>
        </div>
      );
    }

    const chartWidth = 300;
    const chartHeight = 150;
    const padding = 20;

    const weights = weightHistory.map((pt) => pt.weight);
    const minW = Math.min(...weights) - 1;
    const maxW = Math.max(...weights) + 1;
    const weightRange = maxW - minW || 1;

    const points = weightHistory.map((pt, idx) => {
      const x = padding + (idx / (weightHistory.length - 1 || 1)) * (chartWidth - padding * 2);
      const y = chartHeight - padding - ((pt.weight - minW) / weightRange) * (chartHeight - padding * 2);
      return { x, y, label: pt.weight, date: pt.date };
    });

    const dPath = points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-bold px-1">
          <span>Weight History</span>
          <span className={weightDelta !== null && weightDelta < 0 ? "text-green-400" : "text-amber-400"}>
            {weightDelta !== null ? `${weightDelta > 0 ? "+" : ""}${weightDelta} kg trend` : "Baseline Set"}
          </span>
        </div>
        <div className="w-full flex justify-center bg-white/2 p-3 rounded-2xl border border-white/5">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto">
            {/* Grid Lines */}
            <line x1={padding} y1={padding} x2={chartWidth - padding} y2={padding} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <line x1={padding} y1={chartHeight / 2} x2={chartWidth - padding} y2={chartHeight / 2} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
            <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />

            {/* Line Path */}
            {points.length > 1 && (
              <path
                d={dPath}
                fill="none"
                stroke="#06b6d4"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Dots */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={3.5}
                  fill="#0a0a0f"
                  stroke="#06b6d4"
                  strokeWidth={2}
                />
                {/* Value Label */}
                {(idx === 0 || idx === points.length - 1 || points.length <= 5) && (
                  <text
                    x={p.x}
                    y={p.y - 8}
                    fill="#a1a1aa"
                    fontSize={8}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                )}
                {/* Date Label */}
                {(idx === 0 || idx === points.length - 1 || points.length <= 5) && (
                  <text
                    x={p.x}
                    y={chartHeight - 4}
                    fill="#71717a"
                    fontSize={7}
                    textAnchor="middle"
                  >
                    {p.date}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container space-y-6 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pillar 5</span>
          <h1 className="text-xl font-bold text-white mt-0.5">Journey Progress</h1>
        </div>
      </div>

      {/* Main Single Question Indicator */}
      <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-2xl p-4 animate-in-delay-1 text-center">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400 block mb-1">Single Core Question</span>
        <h2 className="text-sm font-semibold text-white">"How am I changing?"</h2>
      </div>

      {/* SVG Weight Chart Card */}
      <GlassCard className="p-5 animate-in-delay-1 border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full -z-10" />
        {renderWeightChart()}
      </GlassCard>

      {/* Weekly Review Launcher wrapper */}
      <GlassCard 
        onClick={() => router.push("/review")}
        className="p-5 animate-in-delay-2 border border-white/10 hover:border-brand-500/40 cursor-pointer relative overflow-hidden transition-all duration-300 group"
      >
        <div className="absolute top-1/2 right-4 -translate-y-1/2 w-24 h-24 bg-brand-500/5 blur-[40px] rounded-full -z-10" />
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-brand-400">Weekly Performance Recap</span>
            <h3 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors">Launch Weekly Performance Wrapped</h3>
            <p className="text-[10px] text-zinc-500 max-w-xs leading-relaxed">
              Review your weekly macro consistency scores, average sleeping hours, total gym volume, and top exercise sets.
            </p>
          </div>
          <span className="text-zinc-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all text-xl">➔</span>
        </div>
      </GlassCard>

      {/* Health Highlights & Milestones list */}
      <div className="space-y-3 animate-in-delay-2">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Temporal Highlights (Past 7 Days)</h3>
        
        <div className="grid grid-cols-2 gap-3">
          <GlassCard className="p-4 flex flex-col justify-between border border-white/5 min-h-[90px]">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Gym Attendance</span>
            <div className="mt-2">
              <span className="text-xl font-extrabold text-white">{weeklyWorkouts}</span>
              <span className="text-[10px] text-zinc-500 ml-1">sessions done</span>
            </div>
          </GlassCard>

          <GlassCard className="p-4 flex flex-col justify-between border border-white/5 min-h-[90px]">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Average Sleep</span>
            <div className="mt-2">
              <span className="text-xl font-extrabold text-white">{avgSleepHours}</span>
              <span className="text-[10px] text-zinc-500 ml-1">hours / night</span>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Historical Timeline Feed */}
      <div className="space-y-4 animate-in-delay-3 pt-4 border-t border-white/5">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Chronological Log History</h3>
        {allEvents.length === 0 ? (
          <GlassCard className="p-6 text-center text-zinc-500 text-xs">
            No history logs found. Start logging on the dashboard!
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {getGroupedEvents().map(([dateStr, events]) => (
              <div key={dateStr} className="space-y-2">
                <span className="text-[10px] font-bold text-brand-400 uppercase tracking-wider block pl-1">
                  {dateStr}
                </span>
                <div className="space-y-2">
                  {events.map((event: any) => {
                    let details = "";
                    let title = event.type.toUpperCase();
                    
                    if (event.type === "meal") {
                      title = "Meal Log";
                      const foodsList = event.payload.foods?.map((f: any) => f.name).join(", ") || "Meal Log";
                      details = `${foodsList} (${event.payload.totalCalories || 0} kcal, ${event.payload.totalProteinG || 0}g protein)`;
                    } else if (event.type === "weight") {
                      title = "Weight Log";
                      details = `${event.payload.weightKg || 0} kg logged`;
                    } else if (event.type === "steps") {
                      title = "Daily Steps";
                      details = `${event.payload.count?.toLocaleString() || 0} steps`;
                    } else if (event.type === "sleep") {
                      title = "Sleep Log";
                      details = `${event.payload.hours || 0} hours of sleep`;
                    } else if (event.type === "water") {
                      title = "Water Log";
                      details = `${event.payload.amountL || 0} L consumed`;
                    } else if (event.type === "workout") {
                      title = "Workout Session";
                      details = `${event.payload.name || "Workout"} (${event.payload.totalVolumeKg?.toLocaleString() || 0} kg volume)`;
                    } else if (event.type === "note") {
                      title = "Calendar Event";
                      details = `${event.payload.title || "Busy schedule note"}`;
                    }

                    return (
                      <div 
                        key={event._id || event.id} 
                        className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 transition-all text-xs"
                      >
                        <div className="text-left">
                          <span className="font-bold text-zinc-300 block">{title}</span>
                          <span className="text-[10px] text-zinc-500 mt-0.5 block capitalize">{details}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteEvent(event._id || event.id)}
                          className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-bold text-xs select-none cursor-pointer"
                          title="Delete log"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Data Ownership & Controls Card */}
      <div className="animate-in-delay-3 pt-6 border-t border-white/5 space-y-4">
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Privacy & Data Control</h3>
          <p className="text-[10px] text-zinc-600 leading-relaxed">
            Per the Health OS Product Constitution (Rule 7), you own your data. You can download a complete copy or scrub it entirely from our systems.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleExportData}
            disabled={exporting}
            className="flex-1 py-3 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-all flex items-center justify-center gap-1.5"
          >
            📥 {exporting ? "Exporting..." : "Export Data"}
          </button>
          
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="flex-1 py-3 text-xs font-semibold rounded-xl bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 transition-all flex items-center justify-center gap-1.5"
          >
            ⚠️ {deleting ? "Deleting..." : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

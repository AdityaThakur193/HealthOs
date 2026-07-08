"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ProgressRing from "@/components/ProgressRing";
import { Download, AlertTriangle, Scale, Activity, TrendingDown } from "lucide-react";

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

  // Collapsible Day Folder State
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // Log Editing states
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editMealCalories, setEditMealCalories] = useState("");
  const [editMealProtein, setEditMealProtein] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editSteps, setEditSteps] = useState("");
  const [editSleep, setEditSleep] = useState("");
  const [editWater, setEditWater] = useState("");

  async function loadJourneyData() {
    const email = localStorage.getItem("healthos_email");
    const userId = localStorage.getItem("healthos_userId");
    if (!email || !userId) {
      router.push("/login");
      return;
    }

    try {
      // 1. Fetch Profile
      const profRes = await fetch(`/api/profile?email=${email}&t=${Date.now()}`, { cache: "no-store" });
      if (!profRes.ok) {
        router.push("/onboarding");
        return;
      }
      const profData = await profRes.json();
      setProfile(profData.profile);

      // 2. Fetch Timeline Events
      const timelineRes = await fetch(`/api/timeline?userId=${userId}&t=${Date.now()}`, { cache: "no-store" });
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

  useEffect(() => {
    loadJourneyData();
  }, [router]);

  // Set default collapsed headers on initial load (collapse all except the first day)
  useEffect(() => {
    if (allEvents.length > 0) {
      const groups = getGroupedEvents();
      if (groups.length > 0 && Object.keys(collapsedDates).length === 0) {
        const initialCollapsed: Record<string, boolean> = {};
        groups.forEach(([dateStr], idx) => {
          initialCollapsed[dateStr] = idx > 0; // collapse older days
        });
        setCollapsedDates(initialCollapsed);
      }
    }
  }, [allEvents]);

  const handleStartEditEvent = (event: any) => {
    setEditingEvent(event);
    if (event.type === "meal") {
      const mealName = event.payload.mealName || event.payload.foods?.map((f: any) => f.name).join(", ") || "Meal";
      setEditMealName(mealName);
      setEditMealCalories(String(event.payload.totalCalories || 0));
      setEditMealProtein(String(event.payload.totalProteinG || 0));
    } else if (event.type === "weight") {
      setEditWeight(String(event.payload.weightKg || ""));
    } else if (event.type === "steps") {
      setEditSteps(String(event.payload.count || ""));
    } else if (event.type === "sleep") {
      setEditSleep(String(event.payload.hours || ""));
    } else if (event.type === "water") {
      setEditWater(String(event.payload.amountL || ""));
    }
  };

  const handleSaveEditEvent = async () => {
    if (!editingEvent) return;

    // Handle updates for a consolidated water event
    if (editingEvent.payload.isConsolidated) {
      // Save each updated sub-event individually in parallel
      try {
        const promises = editingEvent.payload.subEvents.map((sub: any) => {
          return fetch("/api/timeline", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              eventId: sub._id || sub.id,
              payload: { amountL: Number(sub.payload.amountL) || 0 }
            })
          });
        });
        await Promise.all(promises);
        setEditingEvent(null);
        loadJourneyData();
        window.dispatchEvent(new Event("profileUpdated"));
      } catch (err) {
        console.error(err);
        alert("Failed to save consolidated updates.");
      }
      return;
    }

    const payload: any = { ...editingEvent.payload };
    const timestamp = editingEvent.timestamp;

    if (editingEvent.type === "meal") {
      payload.mealName = editMealName;
      payload.totalCalories = Number(editMealCalories) || 0;
      payload.totalProteinG = Number(editMealProtein) || 0;
      if (payload.foods && payload.foods.length > 0) {
        payload.foods[0].name = editMealName;
        payload.foods[0].calories = Number(editMealCalories) || 0;
        payload.foods[0].proteinG = Number(editMealProtein) || 0;
      }
    } else if (editingEvent.type === "weight") {
      payload.weightKg = Number(editWeight) || 0;
    } else if (editingEvent.type === "steps") {
      payload.count = Number(editSteps) || 0;
    } else if (editingEvent.type === "sleep") {
      payload.hours = Number(editSleep) || 0;
    } else if (editingEvent.type === "water") {
      payload.amountL = Number(editWater) || 0;
    }

    try {
      const res = await fetch("/api/timeline", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: editingEvent._id || editingEvent.id,
          payload,
          timestamp
        })
      });

      if (res.ok) {
        setEditingEvent(null);
        loadJourneyData();
        window.dispatchEvent(new Event("profileUpdated"));
      } else {
        alert("Failed to update log.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving log updates.");
    }
  };

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
          const timelineRes = await fetch(`/api/timeline?userId=${userId}&t=${Date.now()}`, { cache: "no-store" });
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
    
    // Sort events descending first so they display newest first
    const sortedEvents = [...allEvents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    sortedEvents.forEach((event) => {
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

    // Consolidate water logs for each date group
    const consolidatedGroups: [string, any[]][] = Object.entries(groups).map(([dateStr, dayEvents]) => {
      const waterEvents = dayEvents.filter((e) => e.type === "water");
      const nonWater = dayEvents.filter((e) => e.type !== "water");
      
      if (waterEvents.length > 0) {
        // Sum total water amount
        const totalAmount = waterEvents.reduce((sum, e) => sum + (Number(e.payload?.amountL || e.payload?.waterL) || 0), 0);
        // Create a consolidated water event
        const consolidatedWaterEvent = {
          _id: `consolidated_water_${dateStr}`,
          type: "water",
          timestamp: waterEvents[0].timestamp, // use the latest timestamp
          payload: {
            amountL: Math.round(totalAmount * 10) / 10,
            isConsolidated: true,
            originalEventIds: waterEvents.map((e) => e._id || e.id),
            subEvents: waterEvents // store references to show inside the editor
          }
        };
        // Put the water event at the end or maintain sort
        return [dateStr, [...nonWater, consolidatedWaterEvent]];
      }
      
      return [dateStr, dayEvents];
    });

    return consolidatedGroups;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white">
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
          <Scale className="w-8 h-8 text-zinc-600 animate-pulse" />
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
                  fill="#0c0f0d"
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
          <h1 className="text-xl font-bold text-white mt-0.5 font-heading">Journey Progress</h1>
        </div>
      </div>

      {/* Main Single Question Indicator */}
      <div className="bg-[#8ba893]/5 border border-[#8ba893]/10 rounded-2xl p-4 animate-in-delay-1 text-center">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#8ba893] block mb-1">Single Core Question</span>
        <h2 className="text-sm font-semibold text-white font-heading">"How am I changing?"</h2>
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
          <div className="space-y-3">
            {getGroupedEvents().map(([dateStr, events]) => {
              const isCollapsed = collapsedDates[dateStr] ?? false;
              return (
                <div key={dateStr} className="space-y-1.5 border-b border-white/3 pb-2 last:border-b-0">
                  <button
                    onClick={() => setCollapsedDates(prev => ({ ...prev, [dateStr]: !isCollapsed }))}
                    className="w-full flex items-center justify-between py-1.5 text-[9px] font-bold text-brand-400 hover:text-brand-300 uppercase tracking-wider pl-1 cursor-pointer select-none"
                  >
                    <span>{dateStr}</span>
                    <span className="text-zinc-500 text-[10px]">
                      {isCollapsed ? "▶ Expand" : "▼ Collapse"}
                    </span>
                  </button>
                  
                  {!isCollapsed && (
                    <div className="space-y-2 pl-1 transition-all">
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
                          if (event.payload?.isConsolidated) {
                            details = `${event.payload.amountL || 0} L Consumed (${event.payload.subEvents?.length || 0} entries consolidated)`;
                          } else {
                            details = `${event.payload.amountL || 0} L consumed`;
                          }
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
                            onClick={() => handleStartEditEvent(event)}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-[#8ba893]/30 transition-all text-xs cursor-pointer"
                          >
                            <div className="text-left">
                              <span className="font-bold text-zinc-300 block text-[11px]">{title}</span>
                              <span className="text-[10px] text-zinc-500 mt-0.5 block capitalize">{details}</span>
                            </div>
                            
                            {!event.payload?.isConsolidated ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteEvent(event._id || event.id);
                                }}
                                className="w-5.5 h-5.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center font-bold text-xs select-none cursor-pointer"
                                title="Delete log"
                              >
                                ×
                              </button>
                            ) : (
                              <span className="text-[9px] text-[#8ba893] font-bold uppercase mr-1">Consolidated</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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
            className="flex-1 py-3 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exporting ? "Exporting..." : "Export Data"}</span>
          </button>
          
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="flex-1 py-3 text-xs font-semibold rounded-xl bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{deleting ? "Deleting..." : "Delete Account"}</span>
          </button>
        </div>
      </div>

      {/* Log Editor Modal Overlay */}
      {editingEvent && (
        <div className="fixed inset-0 bg-[#0c0f0d]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in">
          <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden flex flex-col space-y-4">
            <button 
              onClick={() => setEditingEvent(null)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold z-10"
            >
              ×
            </button>
            
            <div className="space-y-1.5 text-center flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-[#8ba893]/10 border border-[#8ba893]/20 flex items-center justify-center mx-auto text-xl">
                ✏️
              </div>
              <h3 className="text-base font-bold text-white mt-2">
                Edit {editingEvent.type.toUpperCase()} Log
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                Update or delete your timeline entry
              </p>
            </div>

            <div className="space-y-3 pt-3 border-t border-white/5 text-xs">
              {/* Special View for Consolidated Water Logs */}
              {editingEvent.payload?.isConsolidated ? (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Consolidated Entries:</p>
                  {editingEvent.payload.subEvents?.map((sub: any, idx: number) => (
                    <div key={sub._id || sub.id || idx} className="flex items-center justify-between p-2 bg-white/5 rounded-xl border border-white/5 text-[11px]">
                      <span className="text-[10px] text-zinc-400 font-medium pl-1">
                        {new Date(sub.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.1"
                          defaultValue={sub.payload.amountL || 0}
                          onChange={(e) => {
                            sub.payload.amountL = Number(e.target.value) || 0;
                          }}
                          className="w-14 bg-zinc-950/60 border border-white/10 rounded-lg px-1.5 py-0.5 text-center text-white text-[11px]"
                        />
                        <span className="text-zinc-500 text-[10px] mr-1.5">L</span>
                        <button
                          onClick={async () => {
                            if (confirm("Delete this entry?")) {
                              await fetch(`/api/timeline?eventId=${sub._id || sub.id}`, { method: "DELETE" });
                              editingEvent.payload.subEvents = editingEvent.payload.subEvents.filter((item: any) => (item._id || item.id) !== (sub._id || sub.id));
                              const total = editingEvent.payload.subEvents.reduce((sum: number, item: any) => sum + (Number(item.payload.amountL) || 0), 0);
                              editingEvent.payload.amountL = Math.round(total * 10) / 10;
                              if (editingEvent.payload.subEvents.length === 0) {
                                setEditingEvent(null);
                              } else {
                                setEditingEvent({ ...editingEvent });
                              }
                              loadJourneyData();
                              window.dispatchEvent(new Event("profileUpdated"));
                            }
                          }}
                          className="w-5 h-5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center cursor-pointer select-none"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {editingEvent.type === "meal" && (
                    <>
                      <div className="space-y-1">
                        <label className="text-[10px] text-zinc-500 font-bold uppercase">Meal Name</label>
                        <input
                          type="text"
                          value={editMealName}
                          onChange={(e) => setEditMealName(e.target.value)}
                          className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase">Calories (kcal)</label>
                          <input
                            type="number"
                            value={editMealCalories}
                            onChange={(e) => setEditMealCalories(e.target.value)}
                            className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-500 font-bold uppercase">Protein (g)</label>
                          <input
                            type="number"
                            value={editMealProtein}
                            onChange={(e) => setEditMealProtein(e.target.value)}
                            className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {editingEvent.type === "weight" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editWeight}
                        onChange={(e) => setEditWeight(e.target.value)}
                        className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                      />
                    </div>
                  )}

                  {editingEvent.type === "steps" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Steps Count</label>
                      <input
                        type="number"
                        value={editSteps}
                        onChange={(e) => setEditSteps(e.target.value)}
                        className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                      />
                    </div>
                  )}

                  {editingEvent.type === "sleep" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Sleep Hours</label>
                      <input
                        type="number"
                        step="0.5"
                        value={editSleep}
                        onChange={(e) => setEditSleep(e.target.value)}
                        className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                      />
                    </div>
                  )}

                  {editingEvent.type === "water" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase">Water Consumed (L)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={editWater}
                        onChange={(e) => setEditWater(e.target.value)}
                        className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893] transition-all"
                      />
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2 flex-shrink-0">
              <button
                onClick={handleSaveEditEvent}
                className="w-full py-2.5 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] font-bold text-xs transition-all cursor-pointer"
              >
                Save Changes
              </button>
              
              <div className="flex gap-2">
                {!editingEvent.payload?.isConsolidated && (
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this log?")) {
                        handleDeleteEvent(editingEvent._id || editingEvent.id);
                        setEditingEvent(null);
                      }
                    }}
                    className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 font-bold text-[10px] transition-all cursor-pointer"
                  >
                    Delete Log
                  </button>
                )}
                <button
                  onClick={() => setEditingEvent(null)}
                  className={`py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-bold text-[10px] transition-all cursor-pointer ${
                    editingEvent.payload?.isConsolidated ? "w-full" : "flex-1"
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

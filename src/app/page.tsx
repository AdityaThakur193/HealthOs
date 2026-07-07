"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ProgressRing from "@/components/ProgressRing";
import MacroBar from "@/components/MacroBar";
import CoachInsight from "@/components/CoachInsight";
import { getTodaysWorkout } from "@/lib/workoutPlans";

interface TodayState {
  calories: number;
  protein: number;
  workoutDone: boolean;
  sleepHours: number;
  steps: number;
  waterL: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [today, setToday] = useState<TodayState>({
    calories: 0,
    protein: 0,
    workoutDone: false,
    sleepHours: 0,
    steps: 0,
    waterL: 0,
  });
  const [coachData, setCoachData] = useState<any>(null);
  const [coachLoading, setCoachLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [tdeeMode, setTdeeMode] = useState<"adaptive" | "calibrating">("calibrating");
  const [daysRemaining, setDaysRemaining] = useState(14);
  const [avgCalories, setAvgCalories] = useState(0);
  const [weightDeltaKg, setWeightDeltaKg] = useState(0);
  const [showTdeeModal, setShowTdeeModal] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [streak, setStreak] = useState(0);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);

  // Quick log states
  const [weightInput, setWeightInput] = useState("");
  const [stepsInput, setStepsInput] = useState("");
  const [sleepInput, setSleepInput] = useState("");
  const [mealNameInput, setMealNameInput] = useState("");
  const [mealCalInput, setMealCalInput] = useState("");
  const [mealProtInput, setMealProtInput] = useState("");

  // Controls which input form is expanded in the quick log drawer
  const [activeForm, setActiveForm] = useState<"none" | "steps" | "sleep" | "meal">("none");

  const fetchDashboardData = async (userId: string) => {
    try {
      // 1. Fetch Today's events
      const todayRes = await fetch(`/api/timeline?userId=${userId}`);
      if (todayRes.ok) {
        const data = await todayRes.json();
        const events = data.events || [];

        // Filter and find active busy calendar events (travel, exams, sick)
        const notes = events.filter((e: any) => e.type === "note");
        const todayDate = new Date();
        const foundActiveEvent = notes.find((n: any) => {
          if (!n.payload || !n.payload.startDate || !n.payload.endDate) return false;
          const start = new Date(n.payload.startDate);
          const end = new Date(n.payload.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return todayDate >= start && todayDate <= end;
        });
        setActiveEvent(foundActiveEvent || null);

        // Aggregate today's stats
        let cal = 0;
        let prot = 0;
        let wDone = false;
        let sleep = 0;
        let stepCount = 0;
        let water = 0;

        events.forEach((event: any) => {
          // Check if event is from today
          const eventDate = new Date(event.timestamp).toDateString();
          const todayDateStr = new Date().toDateString();
          if (eventDate === todayDateStr) {
            if (event.type === "meal") {
              cal += event.payload.totalCalories || 0;
              prot += event.payload.totalProteinG || 0;
            } else if (event.type === "workout") {
              wDone = true;
            } else if (event.type === "sleep") {
              sleep = event.payload.hours || 0;
            } else if (event.type === "steps") {
              stepCount = event.payload.count || 0;
            } else if (event.type === "water") {
              water += event.payload.amountL || 0;
            }
          }
        });

        // Store today's events for log management/deletion
        const todayDateStr = new Date().toDateString();
        const todaysLogs = events.filter((event: any) => 
          new Date(event.timestamp).toDateString() === todayDateStr
        );
        setTodayEvents(todaysLogs);

        setToday({
          calories: Math.round(cal),
          protein: Math.round(prot),
          workoutDone: wDone,
          sleepHours: sleep,
          steps: stepCount,
          waterL: Math.round(water * 10) / 10,
        });
      }

      // 2. Fetch AI Coach insight
      setCoachLoading(true);
      const coachRes = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (coachRes.ok) {
        const data = await coachRes.json();
        setCoachData(data.recommendation);
      }
    } catch (err) {
      console.error("Error loading dashboard metrics", err);
    } finally {
      setCoachLoading(false);
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
          await initDashboard();
        }
      } else {
        alert("Failed to delete log. Please try again.");
      }
    } catch (err) {
      console.error("Delete event error:", err);
      alert("Error deleting log.");
    }
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initDashboard = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const email = localStorage.getItem("healthos_email");
      if (!email) {
        router.push("/login");
        return;
      }

      const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      const data = await res.json();

      if (data.notInitialized) {
        router.push(`/onboarding?email=${encodeURIComponent(email)}`);
        return;
      }

      if (!data || !data.profile) {
        throw new Error("Missing profile info. Database configuration may be incomplete.");
      }

      setProfile(data.profile);
      setTdeeMode(data.tdeeMode || "calibrating");
      setDaysRemaining(typeof data.daysRemaining === "number" ? data.daysRemaining : 14);
      setAvgCalories(data.avgCalories || 0);
      setWeightDeltaKg(data.weightDeltaKg || 0);
      setStreak(data.streak || 0);
      localStorage.setItem("healthos_userId", data.profile._id);
      await fetchDashboardData(data.profile._id);
    } catch (err: any) {
      console.error("Dashboard init error", err);
      setErrorMsg(err.message || "Failed to load dashboard metrics. Ensure database is online.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initDashboard();
  }, [router]);

  const handleQuickLog = async (type: string, payload: any) => {
    const userId = localStorage.getItem("healthos_userId");
    if (!userId) return;

    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type,
          payload,
          source: "manual",
        }),
      });

      if (res.ok) {
        await fetchDashboardData(userId);
        setQuickLogOpen(false);
      }
    } catch (err) {
      console.error("Quick log error", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase animate-pulse">Syncing Health OS...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white p-4">
        <GlassCard className="p-6 text-center border border-white/10 max-w-sm w-full space-y-4">
          <div className="text-3xl">⚠️</div>
          <h2 className="text-base font-bold text-white">System Offline</h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {errorMsg}
          </p>
          <button 
            onClick={initDashboard}
            className="btn-primary w-full py-2.5 font-bold text-xs"
          >
            Retry Connection
          </button>
        </GlassCard>
      </div>
    );
  }

  const targetCal = profile?.targetCalories || 2200;
  const targetProt = profile?.targetProteinG || 150;
  const sleepTarget = profile?.sleepTarget || 8;
  
  // Scale steps goal if busy event is active (guilt-free dynamic target scaling)
  let stepsTarget = profile?.stepsTarget || 10000;
  if (activeEvent) {
    const type = activeEvent.payload.event_type;
    if (type === "exam") stepsTarget = 5000;
    else if (type === "travel") stepsTarget = 6000;
    else if (type === "sick") stepsTarget = 3000;
  }

  // Resolve today's scheduled workout name dynamically
  const todaysWorkout = profile
    ? getTodaysWorkout({
        gymFrequency: profile.gymFrequency,
        gymExperience: profile.gymExperience,
        goal: profile.goal,
      })
    : null;

  let workoutLabel = todaysWorkout
    ? todaysWorkout.name === "Rest Day"
      ? "Recovery & Mobility (Rest Day)"
      : `Complete ${todaysWorkout.name}`
    : "Hit Gym (Workout)";

  if (activeEvent) {
    const type = activeEvent.payload.event_type;
    if (type === "sick") {
      workoutLabel = "Rest & Recover Mode (Sick Day)";
    } else {
      workoutLabel = "Active Recovery & Mobility (Rest)";
    }
  }

  // Calculate Readiness Score dynamically based on Sleep & Sick states (guilt-free & honest)
  let readinessScore: number | null = null;
  let readinessStatus = "Calibrating 🔋";
  let readinessDescription = "Log last night's sleep to calculate today's readiness score.";

  const isSick = activeEvent && activeEvent.payload.event_type === "sick";

  if (isSick) {
    readinessScore = 30;
    readinessStatus = "Low Energy (Sick) 🤒";
    readinessDescription = "Take it easy today. Focus on rest and hydration without guilt.";
  } else if (today.sleepHours > 0) {
    readinessScore = Math.min(100, Math.round((today.sleepHours / sleepTarget) * 100));
    readinessStatus = readinessScore >= 80 ? "Fully Charged ⚡" : readinessScore >= 60 ? "Steady State 🔋" : "Low Energy ⚠️";
    readinessDescription = readinessScore >= 80 
      ? "Sleep goal met. You are physically ready for optimal performance today." 
      : "Under-slept. Scale down workout intensity and prioritize recovery.";
  } else {
    readinessScore = null;
    readinessStatus = "Calibrating 🔋";
    readinessDescription = "Log last night's sleep to unlock today's readiness score.";
  }

  // Checklist computation
  const missionItems = [
    { label: workoutLabel, done: today.workoutDone },
    { label: `Eat ${targetProt}g Protein (${today.protein}g logged)`, done: today.protein >= targetProt },
    { label: `Walk ${stepsTarget.toLocaleString()} steps (${today.steps.toLocaleString()} completed)`, done: today.steps >= stepsTarget },
    { label: `Sleep ${sleepTarget} hours (${today.sleepHours} logged)`, done: today.sleepHours >= sleepTarget },
  ];

  const totalMissionItems = missionItems.length;
  const completedMissionItems = missionItems.filter((i) => i.done).length;
  const missionScore = totalMissionItems ? Math.round((completedMissionItems / totalMissionItems) * 100) : 0;

  // Dynamic time-of-day greeting
  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return "Good morning";
    if (hr < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="page-container space-y-6 pb-28">
      {/* Top Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            Command Center • {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <h1 className="text-xl font-bold text-white mt-0.5">{getGreeting()}, {profile?.name}</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {streak > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[9px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1">
              🔥 {streak} {streak === 1 ? "Day" : "Days"}
            </span>
          )}
          {tdeeMode === "adaptive" ? (
            <button 
              onClick={() => setShowTdeeModal(true)}
              className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[9px] font-extrabold text-cyan-400 uppercase tracking-widest flex items-center gap-1 hover:bg-cyan-500/20 transition-all cursor-pointer"
            >
              <span>⚡</span> Adaptive
            </button>
          ) : (
            <button 
              onClick={() => setShowTdeeModal(true)}
              className="px-2.5 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-[9px] font-extrabold text-yellow-400 uppercase tracking-widest flex items-center gap-1 hover:bg-yellow-500/20 transition-all cursor-pointer"
            >
              <span>🔋</span> Calibrating ({daysRemaining}d)
            </button>
          )}
          <span className="badge-success glow-green">Active</span>
        </div>
      </div>

      {/* Active Calendar Event Alert if present (guilt-free recovery scaling) */}
      {activeEvent && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl flex items-center gap-2 animate-in">
          <span className="text-sm">📅</span>
          <span>
            Active Event: <strong>{activeEvent.payload.title}</strong> is active today. Daily targets are scaled back.
          </span>
        </div>
      )}

      {/* Readiness HUD Card */}
      <GlassCard className="p-4 flex items-center justify-between animate-in-delay-1 border border-white/10 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full -z-10" />
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Readiness Score</span>
          <h2 className="text-base font-extrabold text-white">
            {readinessStatus}
          </h2>
          <p className="text-[10px] text-zinc-400 max-w-[210px] leading-tight">
            {readinessDescription}
          </p>
        </div>
        <div className="flex-shrink-0 relative">
          <ProgressRing
            value={readinessScore ?? 0}
            max={100}
            size={70}
            strokeWidth={6}
            color={readinessScore === null ? "#52525b" : "#06b6d4"}
            label={readinessScore !== null ? `${readinessScore}%` : "—"}
          />
        </div>
      </GlassCard>

      {/* Main Calorie Ring Card */}
      <GlassCard className="p-6 flex flex-col items-center text-center animate-in-delay-1 border border-white/10 relative overflow-hidden">
        {/* Glow behind ring */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-brand-500/10 blur-[80px] rounded-full -z-10" />

        <ProgressRing
          value={today.calories}
          max={targetCal}
          size={180}
          strokeWidth={12}
          color="#22c55e"
          label={`${today.calories}`}
          sublabel={`of ${targetCal} kcal`}
        />

        <div className="w-full mt-6 space-y-3 pt-6 border-t border-white/5">
          <MacroBar label="Protein" value={today.protein} max={targetProt} color="#06b6d4" />
          <MacroBar label="Water" value={today.waterL} max={3.5} unit="L" color="#3b82f6" />
        </div>
      </GlassCard>

      {/* Coach Card */}
      <div className="animate-in-delay-2">
        <CoachInsight
          status={coachData?.status || "on_track"}
          greeting={coachData?.greeting || `Hey ${profile?.name}`}
          primaryInsight={
            coachData?.primaryInsight ||
            "Coaching engine is building context. Complete your checklist items to receive personalized daily recommendations."
          }
          actionItems={coachData?.actionItems || ["Complete your scheduled gym session today.", "Stay consistent with hydration."] }
          motivation={coachData?.motivation || "Simplicity beats complexity. Focus on your checklist."}
          loading={coachLoading}
        />
      </div>

      {/* Targets Explanation Guide Card */}
      <GlassCard 
        className="p-4 flex items-center justify-between border border-cyan-500/20 bg-cyan-950/10 cursor-pointer hover:bg-cyan-950/20 transition-all animate-in-delay-2" 
        onClick={() => setShowGuideModal(true)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🎓</span>
          <div className="text-left">
            <h4 className="text-xs font-bold text-white">Your Targets Explained</h4>
            <p className="text-[10px] text-zinc-400 mt-0.5">Learn how Health OS calculated your {targetCal} kcal budget</p>
          </div>
        </div>
        <span className="text-zinc-500 text-sm">→</span>
      </GlassCard>

      {/* Today's Checklist */}
      <GlassCard className="p-5 space-y-4 animate-in-delay-3">
        <div className="flex justify-between items-baseline">
          <h3 className="text-sm font-bold text-white">Today's Mission</h3>
          <span className="text-xs font-bold text-brand-400">{missionScore}% Done</span>
        </div>

        <div className="space-y-3">
          {missionItems.map((item, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl flex items-center justify-between border transition-all duration-300 ${
                item.done
                  ? "border-brand-500/20 bg-brand-500/5 text-zinc-300"
                  : "border-white/5 bg-white/2 text-zinc-400"
              }`}
            >
              <span className="text-xs font-medium">{item.label}</span>
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  item.done ? "bg-brand-500 text-white" : "border border-zinc-600 bg-transparent"
                }`}
              >
                {item.done && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Today's Activity Logs */}
      <GlassCard className="p-5 space-y-4 animate-in-delay-3">
        <h3 className="text-sm font-bold text-white">Today's Logs</h3>
        {todayEvents.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-2xl">
            <span className="text-2xl">⚡</span>
            <h4 className="text-xs font-bold text-zinc-300 mt-2">No activity logged today</h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed max-w-xs mx-auto">
              Tap the green <strong>+</strong> button below to log your weight, sleep, or meals. Every entry helps calibrate your Adaptive TDEE!
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              <button 
                onClick={() => {
                  setQuickLogOpen(true);
                  setActiveForm("steps");
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold hover:bg-white/10 text-zinc-300 cursor-pointer"
              >
                👣 Log Steps
              </button>
              <button 
                onClick={() => {
                  setQuickLogOpen(true);
                  setActiveForm("sleep");
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold hover:bg-white/10 text-zinc-300 cursor-pointer"
              >
                💤 Log Sleep
              </button>
              <button 
                onClick={() => router.push("/meal")}
                className="px-2.5 py-1.5 rounded-lg bg-brand-500/10 border border-brand-500/20 text-[9px] font-bold hover:bg-brand-500/20 text-brand-400 cursor-pointer"
              >
                📸 Scan Meal
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.map((event) => {
              let details = "";
              let title = event.type.toUpperCase();
              
              if (event.type === "meal") {
                title = "Meal Capture";
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
                details = `${event.payload.name || "Workout"} logged`;
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
        )}
      </GlassCard>

      {/* Quick Action Drawer toggle */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => {
            setQuickLogOpen(!quickLogOpen);
            setActiveForm("none");
          }}
          className="w-12 h-12 rounded-full flex items-center justify-center text-white glow-green hover:scale-105 active:scale-95 transition-all duration-300"
          style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className={`w-6 h-6 transition-transform duration-300 ${quickLogOpen ? "rotate-45" : ""}`}
          >
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Quick Log Drawer */}
      {quickLogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 flex items-end justify-center">
          <div className="absolute inset-0" onClick={() => setQuickLogOpen(false)} />
          <GlassCard className="w-full max-w-lg p-6 space-y-4 rounded-t-3xl border-t border-white/10 z-40 relative animate-in max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-base font-bold text-white">Log Health Event</h3>
              <button onClick={() => setQuickLogOpen(false)} className="text-xs text-zinc-500 hover:text-zinc-300">
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quick workout log */}
              <button
                onClick={() => {
                  const name = todaysWorkout?.name || "Workout Session";
                  if (todaysWorkout?.name === "Rest Day") {
                    alert("Today is a scheduled Rest Day! Rest, recover, and hydrate.");
                    return;
                  }
                  const vol = todaysWorkout
                    ? todaysWorkout.exercises.reduce((total, ex) => {
                        const avgWeight = 20;
                        const cleanReps = ex.targetReps.replace(/[^0-9\-]/g, "");
                        const repParts = cleanReps.split("-");
                        const avgReps = repParts.length === 2
                          ? (parseInt(repParts[0] || "8") + parseInt(repParts[1] || "12")) / 2
                          : parseInt(repParts[0] || "10");
                        return total + ex.targetSets * avgReps * avgWeight;
                      }, 0)
                    : 2400;

                  handleQuickLog("workout", { name, volumeKg: Math.round(vol) });
                }}
                className="p-3 bg-white/4 border border-white/5 rounded-2xl flex flex-col items-center gap-1.5 hover:border-brand-500/30 transition-all text-xs"
              >
                <span className="text-lg">🏋️</span>
                <span className="font-semibold text-white">Complete Workout</span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[120px]">{todaysWorkout?.name || "Gym Routine"}</span>
              </button>

              {/* Custom step log */}
              <button
                onClick={() => setActiveForm(activeForm === "steps" ? "none" : "steps")}
                className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-xs ${
                  activeForm === "steps" ? "border-brand-500 bg-brand-500/5" : "bg-white/4 border-white/5"
                }`}
              >
                <span className="text-lg">👟</span>
                <span className="font-semibold text-white">Log Steps</span>
                <span className="text-[10px] text-zinc-500">Custom count</span>
              </button>

              {/* Custom meal log */}
              <button
                onClick={() => setActiveForm(activeForm === "meal" ? "none" : "meal")}
                className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-xs ${
                  activeForm === "meal" ? "border-brand-500 bg-brand-500/5" : "bg-white/4 border-white/5"
                }`}
              >
                <span className="text-lg">🍛</span>
                <span className="font-semibold text-white">Log Custom Meal</span>
                <span className="text-[10px] text-zinc-500">Add macros</span>
              </button>

              {/* Custom sleep log */}
              <button
                onClick={() => setActiveForm(activeForm === "sleep" ? "none" : "sleep")}
                className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-xs ${
                  activeForm === "sleep" ? "border-brand-500 bg-brand-500/5" : "bg-white/4 border-white/5"
                }`}
              >
                <span className="text-lg">😴</span>
                <span className="font-semibold text-white">Log Sleep</span>
                <span className="text-[10px] text-zinc-500">Custom hours</span>
              </button>
            </div>

            {/* Custom Steps Form */}
            {activeForm === "steps" && (
              <div className="p-3 bg-white/2 border border-white/5 rounded-2xl flex gap-2 items-end animate-in">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    Steps Walked
                  </label>
                  <input
                    type="number"
                    placeholder={`Target: ${stepsTarget.toLocaleString()}`}
                    value={stepsInput}
                    onChange={(e) => setStepsInput(e.target.value)}
                    className="input-glass text-xs h-10"
                  />
                </div>
                <button
                  onClick={() => {
                    const count = parseInt(stepsInput);
                    if (count > 0) {
                      handleQuickLog("steps", { count });
                      setStepsInput("");
                      setActiveForm("none");
                    }
                  }}
                  className="btn-primary px-4 py-2.5 h-10 rounded-xl"
                >
                  Save
                </button>
              </div>
            )}

            {/* Custom Sleep Form */}
            {activeForm === "sleep" && (
              <div className="p-3 bg-white/2 border border-white/5 rounded-2xl flex gap-2 items-end animate-in">
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    Sleep Duration (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Target: ${sleepTarget} hrs`}
                    value={sleepInput}
                    onChange={(e) => setSleepInput(e.target.value)}
                    className="input-glass text-xs h-10"
                  />
                </div>
                <button
                  onClick={() => {
                    const hours = parseFloat(sleepInput);
                    if (hours > 0) {
                      handleQuickLog("sleep", { hours });
                      setSleepInput("");
                      setActiveForm("none");
                    }
                  }}
                  className="btn-primary px-4 py-2.5 h-10 rounded-xl"
                >
                  Save
                </button>
              </div>
            )}

            {/* Custom Meal Form */}
            {activeForm === "meal" && (
              <div className="p-4 bg-white/2 border border-white/5 rounded-2xl space-y-3 animate-in">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    Meal Item Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Lunch Roti Paneer Curry"
                    value={mealNameInput}
                    onChange={(e) => setMealNameInput(e.target.value)}
                    className="input-glass text-xs h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Calories (kcal)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 600"
                      value={mealCalInput}
                      onChange={(e) => setMealCalInput(e.target.value)}
                      className="input-glass text-xs h-10"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Protein (g)
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 25"
                      value={mealProtInput}
                      onChange={(e) => setMealProtInput(e.target.value)}
                      className="input-glass text-xs h-10"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    const name = mealNameInput.trim() || "Logged Meal";
                    const calories = parseInt(mealCalInput) || 0;
                    const protein = parseInt(mealProtInput) || 0;
                    handleQuickLog("meal", {
                      name,
                      totalCalories: calories,
                      totalProteinG: protein,
                      foods: [{ name, portionSize: "medium" }],
                    });
                    setMealNameInput("");
                    setMealCalInput("");
                    setMealProtInput("");
                    setActiveForm("none");
                  }}
                  className="btn-primary w-full py-2.5 rounded-xl text-xs font-bold"
                >
                  Save Meal
                </button>
              </div>
            )}

            {/* Quick manual weight */}
            <div className="flex gap-2 items-end pt-2">
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                  Log Current Weight
                </label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 70.2"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  className="input-glass text-xs h-10"
                />
              </div>
              <button
                onClick={() => weightInput && handleQuickLog("weight", { weightKg: parseFloat(weightInput) })}
                className="btn-primary px-4 py-2.5 h-10 rounded-xl"
              >
                Log kg
              </button>
            </div>

            {/* Quick manual water */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                  Log Water Intake
                </label>
                <div className="flex gap-2">
                  {[0.25, 0.5, 1.0].map((liters) => (
                    <button
                      key={liters}
                      onClick={() => handleQuickLog("water", { amountL: liters })}
                      className="chip flex-1 text-center py-2 h-10 text-xs font-semibold"
                    >
                      +{liters}L
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
      {/* TDEE Calibration Info Drawer Modal */}
      {showTdeeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden space-y-4">
            <button 
              onClick={() => setShowTdeeModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold"
            >
              ×
            </button>
            
            <div className="space-y-1.5 text-center">
              <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-xl">
                {tdeeMode === "adaptive" ? "⚡" : "🔋"}
              </div>
              <h3 className="text-base font-bold text-white mt-2">
                {tdeeMode === "adaptive" ? "Empirical TDEE Active" : "Metabolic Calibration"}
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                MacroFactor Calorie Engine
              </p>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-white/5 text-xs text-zinc-300">
              {tdeeMode === "adaptive" ? (
                <>
                  <p className="leading-relaxed">
                    Health OS has successfully calibrated your metabolism. Your daily budget is adjusted dynamically using actual changes in your body weight compared to your daily calorie logs.
                  </p>
                  <div className="p-3 bg-white/5 rounded-xl space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">14d Average Calories:</span>
                      <span className="font-semibold text-white">{avgCalories} kcal</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">14d Weight Change:</span>
                      <span className={`font-semibold ${weightDeltaKg < 0 ? "text-green-400" : "text-amber-400"}`}>
                        {weightDeltaKg > 0 ? `+${weightDeltaKg}` : weightDeltaKg} kg
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-1.5">
                      <span className="text-zinc-500 font-medium">True Maintenance (TDEE):</span>
                      <span className="font-bold text-cyan-400">{profile?.tdee} kcal</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="leading-relaxed">
                    To estimate your exact daily calorie expenditure (TDEE) and prevent metabolic overestimation, the algorithm needs a rolling window of calorie and weight logs.
                  </p>
                  <div className="p-3 bg-white/5 rounded-xl space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Weight Logs (Min 3):</span>
                      <span className="font-semibold text-white">{14 - daysRemaining > 3 ? 3 : 14 - daysRemaining}/3 logged</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Calorie Logs (Min 7):</span>
                      <span className="font-semibold text-white">{14 - daysRemaining > 7 ? 7 : 14 - daysRemaining}/7 logged</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-1.5">
                      <span className="text-zinc-500 font-medium">Calibration State:</span>
                      <span className="font-bold text-yellow-400">Needs {daysRemaining} more days of data</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-snug">
                    💡 Tip: Try to log your morning weight and track every meal. Inconsistent logging extends calibration.
                  </p>
                </>
              )}
            </div>

            <button
              onClick={() => setShowTdeeModal(false)}
              className="btn-primary w-full py-2.5 font-bold text-xs"
            >
              Understood
            </button>
          </GlassCard>
        </div>
      )}

      {/* Target Explanation Guide Modal Overlay */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in">
          <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden space-y-4 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold"
            >
              ×
            </button>
            
            <div className="space-y-1.5 text-center">
              <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto text-xl">
                🎓
              </div>
              <h3 className="text-base font-bold text-white mt-2">
                Your Targets Explained
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                How Health OS Metaphor works
              </p>
            </div>

            <div className="space-y-3.5 pt-2 border-t border-white/5 text-xs text-zinc-300">
              <div className="space-y-1.5">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-cyan-400">1. What is Health OS?</h4>
                <p className="leading-relaxed text-[11px]">
                  Unlike apps that use standard estimations and shame you for missing days, Health OS acts as a <strong>Command Center</strong>. It adapts to your actual biology through mathematical calibration instead of forcing rigid rules.
                </p>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-cyan-400">2. Calorie Budget Math</h4>
                <div className="p-3 bg-white/5 rounded-xl space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Your Base Metabolism (BMR):</span>
                    <span className="font-semibold text-white">{profile?.bmr || 1964} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Activity Level Factor:</span>
                    <span className="font-semibold text-white">
                      {profile?.activityLevel === "sedentary" ? "1.2 (Sedentary)" :
                       profile?.activityLevel === "light" ? "1.375 (Lightly Active)" :
                       profile?.activityLevel === "moderate" ? "1.55 (Moderately Active)" :
                       profile?.activityLevel === "active" ? "1.725 (Active)" : "1.9 (Very Active)"}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-zinc-500">Estimated Maintenance (TDEE):</span>
                    <span className="font-semibold text-white">{profile?.tdee || 3041} kcal</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Goal Target Adjustment:</span>
                    <span className="font-semibold text-amber-400">
                      {profile?.goal === "lose_fat" ? "-500 kcal (Deficit)" :
                       profile?.goal === "build_muscle" ? "+300 kcal (Surplus)" :
                       profile?.goal === "recomp" ? "-100 kcal (Body Recomp)" : "0 kcal (Maintenance)"}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-white/5 pt-1.5">
                    <span className="text-zinc-500 font-medium">Daily Calorie Target:</span>
                    <span className="font-bold text-brand-400">{profile?.targetCalories || 2125} kcal</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-cyan-400">3. Protein Target Math</h4>
                <p className="leading-relaxed text-[11px]">
                  Your Protein target of <strong>{profile?.targetProteinG || 154}g</strong> is set to protect your lean mass. This is calculated dynamically:
                </p>
                <div className="p-3 bg-white/5 rounded-xl text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Goal Target Weight:</span>
                    <span className="font-semibold text-white">{profile?.targetWeightKg || profile?.weightKg || 89} kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Multiplier:</span>
                    <span className="font-semibold text-white">
                      {profile?.goal === "lose_fat" ? "2.2g per kg" :
                       profile?.goal === "recomp" ? "2.3g per kg" :
                       profile?.goal === "build_muscle" ? "1.8g per kg" : "2.0g per kg"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className="font-bold text-white text-[11px] uppercase tracking-wider text-cyan-400">4. What you need to do</h4>
                <ul className="list-disc pl-4 space-y-1 text-[10px] text-zinc-400">
                  <li><strong>Log Morning Weight:</strong> Tracks rate of body weight changes.</li>
                  <li><strong>Snap Meal Photos:</strong> AI analyzes and updates your calories/protein.</li>
                  <li><strong>Track Sleep:</strong> Unlocks your daily readiness HUD and scales targets if you're fatigued.</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="btn-primary w-full py-2.5 font-bold text-xs"
            >
              Start Tracking
            </button>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

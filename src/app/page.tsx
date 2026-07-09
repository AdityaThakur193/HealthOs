"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ProgressRing from "@/components/ProgressRing";
import MacroBar from "@/components/MacroBar";
import CoachInsight from "@/components/CoachInsight";
import CustomPopup from "@/components/CustomPopup";
import { getTodaysWorkout } from "@/lib/workoutPlans";
import { Flame, Dumbbell, Droplet, Footprints, Moon, Sparkles, Scale, GraduationCap, Compass, Calendar, Zap, Activity, Camera, Beef } from "lucide-react";

interface TodayState {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
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
    carbs: 0,
    fats: 0,
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

  // Custom Popup Alert/Confirm States
  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm" | "error" | "success" | "warning";
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    type: "alert",
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const showCustomAlert = (title: string, message: string, type: "alert" | "error" | "success" | "warning" = "alert") => {
    return new Promise<void>((resolve) => {
      setPopupState({
        isOpen: true,
        type,
        title,
        message,
        confirmText: "OK",
        onConfirm: () => {
          setPopupState((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
      });
    });
  };

  const showCustomConfirm = (title: string, message: string, isDestructive = false) => {
    return new Promise<boolean>((resolve) => {
      setPopupState({
        isOpen: true,
        type: "confirm",
        title,
        message,
        confirmText: isDestructive ? "Delete" : "Confirm",
        cancelText: "Cancel",
        isDestructive,
        onConfirm: () => {
          setPopupState((prev) => ({ ...prev, isOpen: false }));
          resolve(true);
        },
        onCancel: () => {
          setPopupState((prev) => ({ ...prev, isOpen: false }));
          resolve(false);
        },
      });
    });
  };

  // Log editing states
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [editMealName, setEditMealName] = useState("");
  const [editMealCalories, setEditMealCalories] = useState("");
  const [editMealProtein, setEditMealProtein] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editSteps, setEditSteps] = useState("");
  const [editSleep, setEditSleep] = useState("");
  const [editWater, setEditWater] = useState("");

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
        const userId = localStorage.getItem("healthos_userId");
        if (userId) {
          fetchDashboardData(userId);
        }
        window.dispatchEvent(new Event("profileUpdated"));
      } else {
        showCustomAlert("Update Failed", "We could not save the changes to this log entry. Please try again.", "error");
      }
    } catch (err) {
      console.error(err);
      showCustomAlert("Connection Error", "An error occurred while saving your log updates.", "error");
    }
  };

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
      const todayRes = await fetch(`/api/timeline?userId=${userId}&t=${Date.now()}`, { cache: "no-store" });
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
        let carbsVal = 0;
        let fatsVal = 0;
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
              carbsVal += event.payload.totalCarbsG || event.payload.foods?.reduce((s: number, f: any) => s + (Number(f.carbsG) || 0), 0) || 0;
              fatsVal += event.payload.totalFatG || event.payload.foods?.reduce((s: number, f: any) => s + (Number(f.fatG) || 0), 0) || 0;
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
          carbs: Math.round(carbsVal),
          fats: Math.round(fatsVal),
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
    const confirmed = await showCustomConfirm("Delete Entry", "Are you sure you want to permanently delete this timeline entry?", true);
    if (!confirmed) return;
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
        showCustomAlert("Deletion Failed", "We could not delete the log entry. Please try again.", "error");
      }
    } catch (err) {
      console.error("Delete event error:", err);
      showCustomAlert("Connection Error", "An error occurred while deleting the log entry.", "error");
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

      const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}&t=${Date.now()}`, { cache: "no-store" });
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

  // Re-fetch dashboard whenever chatbot logs health data
  useEffect(() => {
    const refresh = () => {
      const uid = localStorage.getItem("healthos_userId");
      if (uid) fetchDashboardData(uid);
    };
    window.addEventListener("chatbotDataLogged", refresh);
    return () => window.removeEventListener("chatbotDataLogged", refresh);
  }, []);

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
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase animate-pulse">Syncing Health OS...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white p-4">
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
  const targetFats = Math.round((targetCal * 0.25) / 9);
  const targetCarbs = Math.round((targetCal - (targetProt * 4) - (targetFats * 9)) / 4);
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
      : `Complete ${todaysWorkout.name.includes(" — ") ? todaysWorkout.name.split(" — ")[1] : todaysWorkout.name}`
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
      <div className="flex items-start justify-between py-2 border-b border-white/5 animate-in">
        <div className="text-left">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#c87a53] font-mono">
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </span>
          <h1 className="text-xl font-bold text-white mt-1 font-heading leading-tight">{getGreeting()}, {profile?.name || "User"}</h1>
          <div className="flex items-center gap-1.5 mt-2">
            {streak > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-[#c87a53]/10 border border-[#c87a53]/30 text-[8px] font-extrabold text-[#e29b74] uppercase tracking-wider flex items-center gap-1 font-mono">
                <Flame className="w-3 h-3 text-[#c87a53]" /> {streak} {streak === 1 ? "Day" : "Days"}
              </span>
            )}
            {tdeeMode === "adaptive" ? (
              <button 
                onClick={() => setShowTdeeModal(true)}
                className="px-2 py-0.5 rounded-md bg-[#8ba893]/10 border border-[#8ba893]/30 text-[8px] font-extrabold text-[#a8c3af] uppercase tracking-wider flex items-center gap-1 hover:bg-[#8ba893]/20 transition-all cursor-pointer font-mono"
              >
                <Zap className="w-2.5 h-2.5 text-[#8ba893]" /> Adaptive
              </button>
            ) : (
              <button 
                onClick={() => setShowTdeeModal(true)}
                className="px-2 py-0.5 rounded-md bg-[#c87a53]/10 border border-[#c87a53]/20 text-[8px] font-extrabold text-[#e29b74] uppercase tracking-wider flex items-center gap-1 hover:bg-[#c87a53]/20 transition-all cursor-pointer font-mono"
              >
                <Compass className="w-2.5 h-2.5 text-[#e29b74] animate-spin" style={{ animationDuration: '8s' }} /> Calibration ({daysRemaining}d)
              </button>
            )}
          </div>
        </div>

        {/* Compact Readiness Indicator Card */}
        <button 
          onClick={() => {
            if (today.sleepHours === 0) {
              setQuickLogOpen(true);
              setActiveForm("sleep");
            } else {
              setShowTdeeModal(true);
            }
          }}
          className="p-2 border border-white/5 bg-white/2 rounded-tr-2xl rounded-bl-2xl flex items-center gap-2.5 hover:bg-white/5 transition-all text-left max-w-[170px]"
        >
          <ProgressRing
            value={readinessScore ?? 0}
            max={100}
            size={38}
            strokeWidth={4}
            color={readinessScore === null ? "#5a645d" : "#8ba893"}
            label={readinessScore !== null ? `${readinessScore}%` : "—"}
          />
          <div className="min-w-0">
            <span className="text-[8px] text-zinc-500 font-extrabold uppercase tracking-wider block font-mono">Readiness</span>
            <span className="text-[10px] font-bold text-white block truncate leading-snug">{readinessStatus.split(" ")[0]}</span>
          </div>
        </button>
      </div>

      {/* Active Calendar Event Alert if present */}
      {activeEvent && (
        <div className="p-3 bg-[#c87a53]/10 border border-[#c87a53]/20 text-[#e29b74] text-xs rounded-xl flex items-center gap-2 animate-in text-left">
          <Calendar className="w-4 h-4 text-[#e29b74] flex-shrink-0" />
          <span>
            Active Event: <strong>{activeEvent.payload.title}</strong> is active today. Daily targets are scaled back.
          </span>
        </div>
      )}

      {/* 3-Column Compact Primary HUD (Asymmetric Rounded Corners, Hover Actions) */}
      <div className="grid grid-cols-3 gap-3 animate-in-delay-1">
        {/* Calories Card (Clickable: redirects to meal log) */}
        <div 
          onClick={() => router.push("/meal")}
          className="p-3.5 flex flex-col justify-between border border-white/5 bg-white/2 hover:border-[#8ba893]/20 min-h-[110px] relative overflow-hidden rounded-tl-2xl rounded-br-2xl transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <Flame className="w-4 h-4 text-[#c87a53] group-hover:scale-110 transition-transform" />
            <ProgressRing
              value={today.calories}
              max={targetCal}
              size={28}
              strokeWidth={3}
              color="var(--brand)"
              label=""
            />
          </div>
          <div className="mt-4 text-left">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Calories</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block font-heading">{today.calories}</span>
            <span className="text-[8px] text-zinc-600 block mt-0.5">of {targetCal} kcal</span>
          </div>
        </div>

        {/* Protein Card (Clickable: redirects to meal log) */}
        <div 
          onClick={() => router.push("/meal")}
          className="p-3.5 flex flex-col justify-between border border-white/5 bg-white/2 hover:border-[#8ba893]/20 min-h-[110px] relative overflow-hidden rounded-tl-2xl rounded-br-2xl transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <Beef className="w-4 h-4 text-[#8ba893] group-hover:scale-110 transition-transform" />
            <ProgressRing
              value={today.protein}
              max={targetProt}
              size={28}
              strokeWidth={3}
              color="var(--brand)"
              label=""
            />
          </div>
          <div className="mt-4 text-left">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Protein</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block font-heading">{today.protein}g</span>
            <span className="text-[8px] text-zinc-600 block mt-0.5">of {targetProt}g</span>
          </div>
        </div>

        {/* Water Card (Interactive: Direct Quick-Log Action Buttons) */}
        <div className="p-3 flex flex-col justify-between border border-white/5 bg-white/2 min-h-[125px] relative overflow-hidden rounded-tl-2xl rounded-br-2xl transition-all">
          <div className="flex justify-between items-start">
            <Droplet className="w-4 h-4 text-blue-400" />
            <ProgressRing
              value={today.waterL}
              max={3.5}
              size={28}
              strokeWidth={3}
              color="var(--brand)"
              label=""
            />
          </div>
          <div className="mt-2 text-left">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Water</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block font-heading">{today.waterL}L</span>
            <span className="text-[8px] text-zinc-600 block mt-0.5">of 3.5L</span>
          </div>
          {/* Inline Action Pills */}
          <div className="flex gap-1 mt-2 pt-1.5 border-t border-white/5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickLog("water", { amountL: 0.25 });
              }}
              className="flex-1 py-0.5 rounded bg-white/5 hover:bg-[#8ba893]/15 text-[8px] font-bold text-zinc-400 hover:text-white transition-all border border-white/5 hover:border-[#8ba893]/30 cursor-pointer"
            >
              +0.25L
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickLog("water", { amountL: 0.5 });
              }}
              className="flex-1 py-0.5 rounded bg-white/5 hover:bg-[#8ba893]/15 text-[8px] font-bold text-zinc-400 hover:text-white transition-all border border-white/5 hover:border-[#8ba893]/30 cursor-pointer"
            >
              +0.5L
            </button>
          </div>
        </div>
      </div>

      {/* Macronutrient Breakdown (Protein, Carbs, Fats progress) */}
      <div className="animate-in-delay-1">
        <GlassCard className="p-4 border border-white/5 bg-white/2 space-y-3">
          <div className="flex justify-between items-center pb-1.5 border-b border-white/5">
            <h4 className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <span>🥗</span> Macronutrient Breakdown
            </h4>
            <span className="text-[9px] text-[#8ba893] font-bold uppercase tracking-wider">Daily Balance</span>
          </div>
          
          <div className="space-y-3">
            <MacroBar
              label="Protein"
              value={today.protein}
              max={targetProt}
              unit="g"
              color="#8ba893"
            />
            <MacroBar
              label="Carbs"
              value={today.carbs}
              max={targetCarbs}
              unit="g"
              color="#c87a53"
            />
            <MacroBar
              label="Fats"
              value={today.fats}
              max={targetFats}
              unit="g"
              color="#eab308"
            />
          </div>
        </GlassCard>
      </div>

      {/* 2-Column Secondary HUD */}
      <div className="grid grid-cols-2 gap-3 animate-in-delay-1">
        {/* Steps Card (Clickable: opens steps log drawer) */}
        <div 
          onClick={() => {
            setQuickLogOpen(true);
            setActiveForm("steps");
          }}
          className="p-3.5 flex flex-col justify-between border border-white/5 bg-white/2 hover:border-[#8ba893]/20 min-h-[105px] relative overflow-hidden rounded-tl-2xl rounded-br-2xl transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <Footprints className="w-4 h-4 text-[#c87a53] group-hover:scale-110 transition-transform" />
            <ProgressRing
              value={today.steps}
              max={stepsTarget}
              size={28}
              strokeWidth={3}
              color="var(--brand)"
              label=""
            />
          </div>
          <div className="mt-3 text-left">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Steps</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block font-heading">{today.steps.toLocaleString()}</span>
            <span className="text-[8px] text-zinc-600 block mt-0.5">of {stepsTarget.toLocaleString()} steps</span>
          </div>
        </div>

        {/* Sleep Card (Clickable: opens sleep log drawer) */}
        <div 
          onClick={() => {
            setQuickLogOpen(true);
            setActiveForm("sleep");
          }}
          className="p-3.5 flex flex-col justify-between border border-white/5 bg-white/2 hover:border-[#8ba893]/20 min-h-[105px] relative overflow-hidden rounded-tl-2xl rounded-br-2xl transition-all cursor-pointer group"
        >
          <div className="flex justify-between items-start">
            <Moon className="w-4 h-4 text-[#8ba893] group-hover:scale-110 transition-transform" />
            <ProgressRing
              value={today.sleepHours}
              max={sleepTarget}
              size={28}
              strokeWidth={3}
              color="var(--brand)"
              label=""
            />
          </div>
          <div className="mt-3 text-left">
            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider font-mono block">Sleep</span>
            <span className="text-sm font-extrabold text-white mt-0.5 block font-heading">{today.sleepHours}h</span>
            <span className="text-[8px] text-zinc-600 block mt-0.5">of {sleepTarget} hours</span>
          </div>
        </div>
      </div>

      {/* Coach Card (Bespoke Editorial Pull-Quote Block) */}
      <div className="animate-in-delay-2">
        <CoachInsight
          status={coachData?.status || "on_track"}
          greeting={coachData?.greeting || `Hey ${profile?.name || "User"}`}
          primaryInsight={
            coachData?.primaryInsight ||
            "Coaching engine is building context. Complete your checklist items to receive personalized daily recommendations."
          }
          actionItems={coachData?.actionItems || ["Complete your scheduled gym session today.", "Stay consistent with hydration."] }
          motivation={coachData?.motivation || "Simplicity beats complexity. Focus on your checklist."}
          loading={coachLoading}
        />
      </div>

      {/* Today's Checklist (Bespoke Unified Dividers List) */}
      <div className="p-5 space-y-4 animate-in-delay-3 border border-white/5 bg-white/2 rounded-tl-3xl rounded-br-3xl text-left">
        <div className="flex justify-between items-baseline">
          <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Today's Mission</h3>
          <span className="text-xs font-bold text-brand-400">{missionScore}% Done</span>
        </div>

        <div className="divide-y divide-white/5">
          {(() => {
            const nextStepIndex = missionItems.findIndex((item) => !item.done);
            return missionItems.map((item, i) => {
              const isNextStep = i === nextStepIndex;
              return (
                <div
                  key={i}
                  className={`py-3 flex items-center justify-between transition-all duration-300 ${
                    item.done
                      ? "text-zinc-500 opacity-55"
                      : isNextStep
                      ? "text-white relative"
                      : "text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2 text-left">
                    {isNextStep && (
                      <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider bg-[#c87a53] text-[#0c0f0d] rounded font-mono animate-pulse">
                        Next Step
                      </span>
                    )}
                    <span className="text-xs font-semibold">{item.label}</span>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                      item.done ? "bg-[#8ba893] text-[#0c0f0d]" : "border border-zinc-600 bg-transparent"
                    }`}
                  >
                    {item.done && (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {/* Today's Activity Logs */}
      <div className="p-5 space-y-4 animate-in-delay-3 border border-white/5 bg-white/2 rounded-tl-3xl rounded-br-3xl text-left">
        <h3 className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Today's Logs</h3>
        {todayEvents.length === 0 ? (
          <div className="text-center py-6 px-4 border border-dashed border-white/10 rounded-2xl">
            <Sparkles className="w-5 h-5 text-[#8ba893] mx-auto animate-pulse" />
            <h4 className="text-xs font-bold text-zinc-300 mt-2">No activity logged today</h4>
            <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed max-w-xs mx-auto">
              Tap the floating action button below to quickly log your daily steps, sleep, water, weight, or meals.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
            {todayEvents.map((event) => {
              let details = "";
              let title = event.type.toUpperCase();
              
              if (event.type === "meal") {
                title = event.payload.loggedVia === "chatbot" ? "Meal Log" : "Meal Capture";
                const foodsList = event.payload.foods?.map((f: any) => f.name).join(", ") || event.payload.mealType || "Meal";
                details = `${foodsList} (${event.payload.totalCalories || 0} kcal, ${event.payload.totalProteinG || event.payload.totalProtein || 0}g protein)`;
              } else if (event.type === "weight") {
                title = "Weight Log";
                details = `${event.payload.weightKg || 0} kg logged`;
              } else if (event.type === "steps") {
                title = "Daily Steps";
                details = `${(event.payload.count || event.payload.steps || 0).toLocaleString()} steps`;
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
                  onClick={() => handleStartEditEvent(event)}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-[#8ba893]/30 transition-all text-xs cursor-pointer"
                >
                  <div className="text-left">
                    <span className="font-bold text-zinc-300 block">{title}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5 block capitalize">{details}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEvent(event._id || event.id);
                    }}
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
      </div>

      {/* Floating Action Button (FAB) for Unified Logging Drawer */}
      <div className="fixed bottom-24 right-6 z-40">
        <button
          onClick={() => {
            setQuickLogOpen(true);
            setActiveForm("none");
          }}
          className="w-14 h-14 rounded-full flex items-center justify-center text-[#0c0f0d] hover:scale-105 active:scale-95 transition-all duration-300 shadow-xl border border-white/10"
          style={{ 
            background: "linear-gradient(135deg, #8ba893, #7aa085)",
            boxShadow: "0 8px 30px rgba(139, 168, 147, 0.4)"
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-7 h-7"
          >
            <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Unified Bottom Drawer Modal */}
      {quickLogOpen && (
        <div className="fixed inset-0 bg-[#0c0f0d]/70 backdrop-blur-md z-50 flex items-end justify-center animate-in">
          <div className="absolute inset-0" onClick={() => setQuickLogOpen(false)} />
          
          <GlassCard className="w-full max-w-lg p-6 space-y-5 rounded-t-3xl border-t border-white/10 z-50 relative max-h-[90vh] overflow-y-auto bg-[#0c0f0d] text-left">
            {/* Drawer drag handle visual cue */}
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto -mt-1 mb-2" />
            
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="text-sm font-bold text-white font-heading uppercase tracking-wider">Log Health Entry</h3>
              <button 
                onClick={() => setQuickLogOpen(false)} 
                className="w-6 h-6 rounded-full bg-white/5 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Quick workout log */}
              <button
                onClick={() => {
                  const name = todaysWorkout?.name || "Workout Session";
                  if (todaysWorkout?.name === "Rest Day") {
                    showCustomAlert("Rest Day Scheduled", "Today is a scheduled Rest Day! Focus on recovery, light mobility, and hydration.", "alert");
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
                className={`p-3 bg-white/3 border border-white/5 rounded-2xl flex flex-col items-center gap-1.5 hover:border-[#8ba893]/30 transition-all text-xs cursor-pointer`}
              >
                <Dumbbell className="w-5 h-5 text-[#c87a53]" />
                <span className="font-bold text-white">Complete Workout</span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[125px]">{todaysWorkout?.name || "Workout"}</span>
              </button>

              {/* Scan Meal Route */}
              <button
                onClick={() => {
                  setQuickLogOpen(false);
                  router.push("/meal");
                }}
                className={`p-3 bg-white/3 border border-white/5 rounded-2xl flex flex-col items-center gap-1.5 hover:border-[#8ba893]/30 transition-all text-xs cursor-pointer`}
              >
                <Camera className="w-5 h-5 text-[#8ba893]" />
                <span className="font-bold text-white">Scan Meal (AI)</span>
                <span className="text-[10px] text-zinc-500">Vision Analysis</span>
              </button>

              {/* Log Steps */}
              <button
                onClick={() => setActiveForm(activeForm === "steps" ? "none" : "steps")}
                className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  activeForm === "steps" ? "border-[#8ba893] bg-[#8ba893]/5" : "bg-white/3 border-white/5"
                }`}
              >
                <Footprints className="w-5 h-5 text-[#c87a53]" />
                <span className="font-bold text-white">Log Steps</span>
                <span className="text-[10px] text-zinc-500">Add count</span>
              </button>

              {/* Log Sleep */}
              <button
                onClick={() => setActiveForm(activeForm === "sleep" ? "none" : "sleep")}
                className={`p-3 border rounded-2xl flex flex-col items-center gap-1.5 transition-all text-xs cursor-pointer ${
                  activeForm === "sleep" ? "border-[#8ba893] bg-[#8ba893]/5" : "bg-white/3 border-white/5"
                }`}
              >
                <Moon className="w-5 h-5 text-[#8ba893]" />
                <span className="font-bold text-white">Log Sleep</span>
                <span className="text-[10px] text-zinc-500">Add hours</span>
              </button>
            </div>

            {/* Custom Steps Form */}
            {activeForm === "steps" && (
              <div className="p-3.5 bg-white/2 border border-white/5 rounded-2xl flex gap-2 items-end animate-in">
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1 font-mono">
                    <Footprints className="w-3.5 h-3.5 text-zinc-600 mr-1 inline" /> Steps Walked
                  </label>
                  <input
                    type="number"
                    placeholder={`Goal: ${stepsTarget.toLocaleString()}`}
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
                  className="btn-primary px-4 py-2.5 h-10 rounded-xl cursor-pointer"
                >
                  Save
                </button>
              </div>
            )}

            {/* Custom Sleep Form */}
            {activeForm === "sleep" && (
              <div className="p-3.5 bg-white/2 border border-white/5 rounded-2xl flex gap-2 items-end animate-in">
                <div className="flex-1">
                  <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1 font-mono">
                    <Moon className="w-3.5 h-3.5 text-zinc-600 mr-1 inline" /> Sleep Duration (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Goal: ${sleepTarget} hrs`}
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
                  className="btn-primary px-4 py-2.5 h-10 rounded-xl cursor-pointer"
                >
                  Save
                </button>
              </div>
            )}

            {/* Manual Weight Form */}
            <div className="flex gap-2 items-end pt-2 border-t border-white/5">
              <div className="flex-1">
                <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1 font-mono">
                  <Scale className="w-3.5 h-3.5 text-zinc-600 mr-1 inline" /> Log Current Weight (kg)
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
                onClick={() => {
                  if (weightInput) {
                    handleQuickLog("weight", { weightKg: parseFloat(weightInput) });
                    setWeightInput("");
                  }
                }}
                className="btn-primary px-4 py-2.5 h-10 rounded-xl cursor-pointer"
              >
                Log kg
              </button>
            </div>

            {/* Manual Water Form */}
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block font-mono">
                <Droplet className="w-3.5 h-3.5 text-zinc-600 mr-1 inline" /> Quick Log Water
              </label>
              <div className="flex gap-2">
                {[0.25, 0.5, 1.0].map((liters) => (
                  <button
                    key={liters}
                    onClick={() => handleQuickLog("water", { amountL: liters })}
                    className="chip flex-1 text-center py-2 h-10 text-xs font-semibold cursor-pointer"
                  >
                    +{liters}L
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      )}
      {/* TDEE Calibration Info Drawer Modal */}
      {showTdeeModal && (
        <div className="fixed inset-0 bg-[#0c0f0d]/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in">
          <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden flex flex-col max-h-[80vh] space-y-4">
            <button 
              onClick={() => setShowTdeeModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold z-10"
            >
              ×
            </button>
            
            {/* Header */}
            <div className="space-y-1.5 text-center flex-shrink-0">
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

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-3 border-t border-white/5 pt-3 text-xs text-zinc-300">
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

            {/* Footer Action Button */}
            <button
              onClick={() => setShowTdeeModal(false)}
              className="btn-primary w-full py-2.5 font-bold text-xs flex-shrink-0"
            >
              Understood
            </button>
          </GlassCard>
        </div>
      )}

      {/* Target Explanation Guide Modal Overlay */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-[#0c0f0d]/70 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in">
          <GlassCard className="p-6 max-w-sm w-full border border-white/10 relative overflow-hidden flex flex-col max-h-[80vh] space-y-4">
            <button 
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold z-10"
            >
              ×
            </button>
            
            {/* Header */}
            <div className="space-y-1.5 text-center flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center mx-auto text-xl">
                🎓
              </div>
              <h3 className="text-base font-bold text-white mt-2">
                Your Targets Explained
              </h3>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                How Health OS Metaphor works
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-3.5 border-t border-white/5 pt-3 text-xs text-zinc-300">
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

            {/* Footer Action Button */}
            <button
              onClick={() => setShowGuideModal(false)}
              className="btn-primary w-full py-2.5 font-bold text-xs flex-shrink-0"
            >
              Start Tracking
            </button>
          </GlassCard>
        </div>
      )}

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
            </div>

            <div className="pt-4 border-t border-white/5 space-y-2 flex-shrink-0">
              <button
                onClick={handleSaveEditEvent}
                className="w-full py-2.5 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] font-bold text-xs transition-all cursor-pointer"
              >
                Save Changes
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const confirmed = await showCustomConfirm("Delete Log", "Are you sure you want to permanently delete this timeline entry?", true);
                    if (confirmed) {
                      handleDeleteEvent(editingEvent._id || editingEvent.id);
                      setEditingEvent(null);
                    }
                  }}
                  className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white text-red-400 font-bold text-[10px] transition-all cursor-pointer"
                >
                  Delete Log
                </button>
                <button
                  onClick={() => setEditingEvent(null)}
                  className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-bold text-[10px] transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Premium Alert/Confirm Toast Popup */}
      <CustomPopup
        isOpen={popupState.isOpen}
        type={popupState.type}
        title={popupState.title}
        message={popupState.message}
        confirmText={popupState.confirmText}
        cancelText={popupState.cancelText}
        isDestructive={popupState.isDestructive}
        onConfirm={popupState.onConfirm}
        onCancel={popupState.onCancel}
      />
    </div>
  );
}

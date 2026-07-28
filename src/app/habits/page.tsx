"use client";

import { useState, useEffect } from "react";
import GlassCard from "@/components/GlassCard";
import BottomNav from "@/components/BottomNav";
import CoachInsight from "@/components/CoachInsight";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { HabitWithStats } from "@/lib/habitEngine";
import {
  CheckSquare,
  Plus,
  Flame,
  TrendingUp,
  Sparkles,
  Check,
  RotateCcw,
  Trash2,
  Edit3,
  Calendar,
  X,
  Target,
  Award,
  Layers,
  Code,
  Soup,
  BookOpen,
  Dumbbell,
  Heart,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["All", "Spiritual", "Health", "Career", "Self Growth", "Misc"];

const COLOR_PALETTE = [
  { name: "Emerald", value: "#34d399" },
  { name: "Purple", value: "#a78bfa" },
  { name: "Sky Blue", value: "#38bdf8" },
  { name: "Amber", value: "#fbbf24" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Indigo", value: "#818cf8" },
  { name: "Teal", value: "#2dd4bf" },
];

const ICON_OPTIONS = [
  { name: "Sparkles", icon: Sparkles },
  { name: "Code", icon: Code },
  { name: "Soup", icon: Soup },
  { name: "BookOpen", icon: BookOpen },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Heart", icon: Heart },
  { name: "Zap", icon: Zap },
  { name: "Target", icon: Target },
];

export default function HabitsPage() {
  const { loading: authLoading, email } = useAuthGuard();
  const [habits, setHabits] = useState<HabitWithStats[]>([]);
  const [summary, setSummary] = useState({
    totalHabits: 0,
    completedTodayCount: 0,
    completionRateToday: 0,
    avgHabitStrength: 0,
    bestStreakOverall: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal State for Habit Creation & Editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    category: "Health",
    targetType: "boolean" as "boolean" | "numeric" | "duration",
    targetValue: 1,
    unit: "",
    frequency: "daily" as "daily" | "weekdays" | "weekly_count",
    colorTag: "#34d399",
    icon: "Sparkles",
    notes: "",
  });

  const fetchHabits = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/habits?email=${encodeURIComponent(email || "adityath2305@gmail.com")}`);
      const data = await res.json();
      if (data.success) {
        setHabits(data.habits || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (err) {
      console.error("Failed to fetch habits:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchHabits();
    }
    const handleUpdate = () => fetchHabits();
    window.addEventListener("habitsUpdated", handleUpdate);
    return () => window.removeEventListener("habitsUpdated", handleUpdate);
  }, [authLoading, email]);

  const handleToggleHabit = async (habit: HabitWithStats) => {
    const nextCompleted = !habit.completedToday;
    const nextValue = nextCompleted ? habit.targetValue : 0;

    // Optimistic UI Update
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id === habit.id) {
          return {
            ...h,
            completedToday: nextCompleted,
            todayValue: nextValue,
            currentStreak: nextCompleted ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1),
          };
        }
        return h;
      })
    );

    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          email,
          checkin: {
            habitId: habit.id,
            completed: nextCompleted,
            value: nextValue,
          },
        }),
      });
      fetchHabits();
    } catch (err) {
      console.error("Failed to checkin habit:", err);
      fetchHabits();
    }
  };

  const handleIncrementValue = async (habit: HabitWithStats, delta: number) => {
    const currentVal = habit.todayValue || 0;
    const newVal = Math.max(0, currentVal + delta);
    const isDone = newVal >= habit.targetValue;

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id === habit.id) {
          return { ...h, todayValue: newVal, completedToday: isDone };
        }
        return h;
      })
    );

    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkin",
          email,
          checkin: {
            habitId: habit.id,
            completed: isDone,
            value: newVal,
          },
        }),
      });
      fetchHabits();
    } catch (err) {
      console.error("Failed to update habit value:", err);
      fetchHabits();
    }
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    const payload = {
      id: editingHabitId || undefined,
      title: formData.title.trim(),
      category: formData.category,
      targetType: formData.targetType,
      targetValue: Number(formData.targetValue) || 1,
      unit: formData.unit.trim(),
      frequency: formData.frequency,
      colorTag: formData.colorTag,
      icon: formData.icon,
      notes: formData.notes.trim(),
    };

    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          email,
          habit: payload,
        }),
      });

      setIsModalOpen(false);
      resetForm();
      fetchHabits();
    } catch (err) {
      console.error("Failed to save habit:", err);
    }
  };

  const handleDeleteHabit = async (habitId: string) => {
    if (!confirm("Are you sure you want to delete this custom habit?")) return;
    try {
      await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          email,
          habitId,
        }),
      });
      fetchHabits();
    } catch (err) {
      console.error("Failed to delete habit:", err);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (h: HabitWithStats) => {
    setEditingHabitId(h.id);
    setFormData({
      title: h.title,
      category: h.category,
      targetType: h.targetType,
      targetValue: h.targetValue,
      unit: h.unit || "",
      frequency: h.frequency,
      colorTag: h.colorTag,
      icon: h.icon,
      notes: h.notes || "",
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingHabitId(null);
    setFormData({
      title: "",
      category: "Health",
      targetType: "boolean",
      targetValue: 1,
      unit: "",
      frequency: "daily",
      colorTag: "#34d399",
      icon: "Sparkles",
      notes: "",
    });
  };

  const filteredHabits = selectedCategory === "All"
    ? habits
    : habits.filter((h) => h.category.toLowerCase() === selectedCategory.toLowerCase());

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0c0f0d] text-white flex items-center justify-center">
        <div className="animate-spin text-[#8ba893] text-2xl">⏳</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0f0d] text-white pb-32 pt-6 px-4 max-w-lg mx-auto font-sans selection:bg-[#8ba893]/30">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-[#8ba893]" /> Dynamic Habit HUD
          </h1>
          <p className="text-[11px] text-zinc-400 font-medium">
            Custom routines, exponential strength scoring & streaks
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-3 py-2 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-[#8ba893]/10 active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Habit
        </button>
      </div>

      {/* AI Coach Insight */}
      <div className="mb-6">
        <CoachInsight
          status={summary.completionRateToday >= 70 ? "on_track" : "needs_attention"}
          greeting="Habit Strength Overview"
          primaryInsight={`Your overall habit strength is ${summary.avgHabitStrength}%. You've completed ${summary.completedTodayCount} of ${summary.totalHabits} custom habits today (${summary.completionRateToday}%).`}
          actionItems={[
            `Best overall streak is ${summary.bestStreakOverall} days across all active routines.`,
            "Tap any habit card to toggle completion or increment numeric counts.",
          ]}
          motivation="Consistency is not perfection; it's momentum."
        />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-6">
        <GlassCard className="p-3.5 border border-white/5 bg-white/2 text-left">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
            Habit Score
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-[#8ba893]">{summary.avgHabitStrength}%</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <span className="text-[9px] text-zinc-400 mt-1 block">Loop Exponential EWMA</span>
        </GlassCard>

        <GlassCard className="p-3.5 border border-white/5 bg-white/2 text-left">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
            Today&apos;s Done
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-white">
              {summary.completedTodayCount}/{summary.totalHabits}
            </span>
          </div>
          <span className="text-[9px] text-[#8ba893] mt-1 block font-bold">
            {summary.completionRateToday}% Completed
          </span>
        </GlassCard>

        <GlassCard className="p-3.5 border border-white/5 bg-white/2 text-left">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
            Best Streak
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-amber-400">{summary.bestStreakOverall}</span>
            <span className="text-xs text-amber-400/80 font-bold">Days</span>
          </div>
          <span className="text-[9px] text-zinc-400 mt-1 block">Consecutive Days</span>
        </GlassCard>

        <GlassCard className="p-3.5 border border-white/5 bg-white/2 text-left">
          <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block mb-1">
            Active Habits
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-sky-400">{summary.totalHabits}</span>
          </div>
          <span className="text-[9px] text-zinc-400 mt-1 block">Custom Routines</span>
        </GlassCard>
      </div>

      {/* Category Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-4 scrollbar-none mb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-[#8ba893] text-[#0c0f0d] shadow-md shadow-[#8ba893]/20"
                : "bg-white/5 text-zinc-400 hover:text-white border border-white/5"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Habit List Section */}
      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-xs">
          <div className="animate-spin text-lg mb-2">⚡</div> Loading custom habits...
        </div>
      ) : filteredHabits.length === 0 ? (
        <GlassCard className="p-8 text-center border border-white/5 space-y-3">
          <Layers className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">No habits found in &quot;{selectedCategory}&quot;</h3>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Click &quot;Add Habit&quot; above to create your own custom routine, goal, or daily habit!
          </p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-[#8ba893]/10 border border-[#8ba893]/30 text-[#8ba893] font-bold text-xs hover:bg-[#8ba893]/20 transition-all cursor-pointer"
          >
            + Create New Custom Habit
          </button>
        </GlassCard>
      ) : (
        <div className="space-y-3.5">
          {filteredHabits.map((habit) => {
            return (
              <GlassCard
                key={habit.id}
                className="p-4 border border-white/5 bg-white/2 space-y-3 relative overflow-hidden transition-all hover:border-white/10"
              >
                {/* Accent Color Left Strip */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: habit.colorTag || "#34d399" }}
                />

                {/* Top Row: Title, Category, Action Menu */}
                <div className="flex justify-between items-start pl-2">
                  <div className="text-left space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: habit.colorTag || "#34d399" }}
                      />
                      <h3
                        className={`text-sm font-bold transition-all ${
                          habit.completedToday ? "text-zinc-400 line-through" : "text-white"
                        }`}
                      >
                        {habit.title}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-medium">
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                        {habit.category}
                      </span>
                      <span>
                        {habit.frequency === "daily"
                          ? "Everyday"
                          : habit.frequency === "weekdays"
                          ? "Mon - Fri"
                          : `${habit.weeklyTargetCount}x / week`}
                      </span>
                    </div>
                  </div>

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(habit)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                      title="Edit Habit"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteHabit(habit.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Delete Habit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Middle Row: Progress & Interactive Check-in Button */}
                <div className="flex justify-between items-center pl-2 pt-1 border-t border-white/5">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-amber-400 font-bold">
                      <Flame className="w-4 h-4 fill-amber-400/20" />
                      <span>{habit.currentStreak}d streak</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#8ba893] font-bold">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{habit.habitStrength}% score</span>
                    </div>
                  </div>

                  {/* Checkin Controls */}
                  {habit.targetType === "boolean" ? (
                    <button
                      onClick={() => handleToggleHabit(habit)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        habit.completedToday
                          ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                          : "bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                          habit.completedToday
                            ? "bg-emerald-500 border-emerald-400 text-[#0c0f0d]"
                            : "border-zinc-500"
                        }`}
                      >
                        {habit.completedToday && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>{habit.completedToday ? "Completed" : "Mark Done"}</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleIncrementValue(habit, -1)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-bold flex items-center justify-center cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-bold text-white min-w-[45px] text-center">
                        {habit.todayValue} / {habit.targetValue} {habit.unit}
                      </span>
                      <button
                        onClick={() => handleIncrementValue(habit, 1)}
                        className="w-7 h-7 rounded-lg bg-[#8ba893] text-[#0c0f0d] text-xs font-bold flex items-center justify-center cursor-pointer hover:bg-[#8ba893]/90"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>

                {/* Bottom Row: 30-Day GitHub Style Heatmap Grid */}
                <div className="pl-2 pt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                      30-Day Consistency Heatmap
                    </span>
                    <span className="text-[9px] text-zinc-500">Last 30 days</span>
                  </div>
                  <div className="flex gap-1 overflow-x-auto scrollbar-none py-1">
                    {habit.heatmap30Days.map((cell, idx) => (
                      <div
                        key={idx}
                        title={`${cell.date}: ${cell.status}`}
                        className={`w-3 h-3 rounded-[3px] transition-all flex-shrink-0 ${
                          cell.status === "completed"
                            ? "bg-emerald-400 shadow-sm shadow-emerald-400/30"
                            : cell.status === "partial"
                            ? "bg-amber-400/60"
                            : cell.status === "missed"
                            ? "bg-red-500/30"
                            : "bg-white/5"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Dynamic Habit Creator & Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[#121613] border border-white/10 rounded-2xl p-5 space-y-4 shadow-2xl text-left"
            >
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#8ba893]" />
                  {editingHabitId ? "Edit Custom Habit" : "Create Custom Habit"}
                </h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveHabit} className="space-y-3 text-xs">
                {/* Title */}
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Habit Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pray 5 Times, Min 5 Leetcode, Read 15 mins"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8ba893]"
                  />
                </div>

                {/* Category & Frequency */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893]"
                    >
                      {CATEGORIES.filter((c) => c !== "All").map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Frequency</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893]"
                    >
                      <option value="daily">Everyday</option>
                      <option value="weekdays">Mon - Fri Only</option>
                    </select>
                  </div>
                </div>

                {/* Target Type & Value */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Target Type</label>
                    <select
                      value={formData.targetType}
                      onChange={(e) => setFormData({ ...formData, targetType: e.target.value as any })}
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893]"
                    >
                      <option value="boolean">Yes / No</option>
                      <option value="numeric">Count Target</option>
                      <option value="duration">Duration (Mins)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Target Value</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.targetValue}
                      onChange={(e) => setFormData({ ...formData, targetValue: Number(e.target.value) || 1 })}
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893]"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 font-bold mb-1">Unit</label>
                    <input
                      type="text"
                      placeholder="e.g. mins, problems"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8ba893]"
                    />
                  </div>
                </div>

                {/* Color Tag Selection */}
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Color Tag</label>
                  <div className="flex gap-2">
                    {COLOR_PALETTE.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, colorTag: c.value })}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                          formData.colorTag === c.value
                            ? "scale-110 border-white ring-2 ring-white/20"
                            : "border-transparent opacity-70 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: c.value }}
                      />
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-zinc-400 font-bold mb-1">Notes / Description</label>
                  <input
                    type="text"
                    placeholder="Optional notes or goal details..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full bg-zinc-950/60 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-[#8ba893]"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-1/2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] font-bold cursor-pointer shadow-lg shadow-[#8ba893]/20"
                  >
                    {editingHabitId ? "Save Changes" : "Create Habit"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

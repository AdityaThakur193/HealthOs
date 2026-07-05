"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

export default function ProfilePage() {
  const router = useRouter();
  
  // Tab control: 'specs' | 'calendar'
  const [activeTab, setActiveTab] = useState<"specs" | "calendar">("specs");

  // Profile data state
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [showSuccessSpecs, setShowSuccessSpecs] = useState(false);

  // Specs Form States
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");
  const [sleepTarget, setSleepTarget] = useState("8");
  const [goal, setGoal] = useState("lose_fat");
  const [activityLevel, setActivityLevel] = useState("moderate");
  const [dietPreference, setDietPreference] = useState("none");
  const [gymExperience, setGymExperience] = useState("beginner");
  const [collegeSchedule, setCollegeSchedule] = useState("");
  const [neckCm, setNeckCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [useCustomMacros, setUseCustomMacros] = useState(false);

  // Calendar Event Manager States
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<"exam" | "travel" | "sick">("exam");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  useEffect(() => {
    const initialEmail = localStorage.getItem("healthos_email");
    const initialUserId = localStorage.getItem("healthos_userId");
    if (!initialEmail || !initialUserId) {
      router.push("/login");
      return;
    }

    async function loadData() {
      const email = localStorage.getItem("healthos_email");
      const userId = localStorage.getItem("healthos_userId");
      if (!email || !userId) return;

      try {
        // Fetch Profile Specs
        const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const data = await res.json();
        if (data.notInitialized) {
          router.push(`/onboarding?email=${encodeURIComponent(email)}`);
          return;
        }

        const prof = data.profile;
        setProfile(prof);
        
        // Initialize specs form
        setName(prof.name || "");
        setAge(prof.age ? String(prof.age) : "");
        setHeightCm(prof.heightCm ? String(prof.heightCm) : "");
        setWeightKg(prof.weightKg ? String(prof.weightKg) : "");
        setTargetWeightKg(prof.targetWeightKg ? String(prof.targetWeightKg) : "");
        setSleepTarget(prof.sleepTarget ? String(prof.sleepTarget) : "8");
        setGoal(prof.goal || "lose_fat");
        setActivityLevel(prof.activityLevel || "moderate");
        setDietPreference(prof.dietPreference || "none");
        setGymExperience(prof.gymExperience || "beginner");
        setCollegeSchedule(prof.collegeSchedule || "");
        setNeckCm(prof.neckCm ? String(prof.neckCm) : "");
        setWaistCm(prof.waistCm ? String(prof.waistCm) : "");
        setHipCm(prof.hipCm ? String(prof.hipCm) : "");
        setCustomCalories(prof.customCalories ? String(prof.customCalories) : "");
        setCustomProtein(prof.customProtein ? String(prof.customProtein) : "");
        setUseCustomMacros(prof.useCustomMacros || false);

        // Fetch Timeline Events to filter for busy calendar events (notes)
        const timelineRes = await fetch(`/api/timeline?userId=${userId}`);
        if (timelineRes.ok) {
          const timelineData = await timelineRes.json();
          const notes = (timelineData.events || []).filter((e: any) => e.type === "note");
          setEvents(notes);
        }
      } catch (err) {
        console.error("Failed to load profile specs", err);
      } finally {
        setLoading(false);
        setLoadingEvents(false);
      }
    }
    loadData();
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age || !heightCm || !weightKg) return;

    setSavingSpecs(true);
    try {
      const email = localStorage.getItem("healthos_email");
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: name.trim(),
          age: parseInt(age),
          heightCm: parseFloat(heightCm),
          weightKg: parseFloat(weightKg),
          targetWeightKg: targetWeightKg ? parseFloat(targetWeightKg) : undefined,
          sleepTarget: parseInt(sleepTarget) || 8,
          goal,
          activityLevel,
          dietPreference,
          gymExperience,
          collegeSchedule: collegeSchedule.trim() || undefined,
          neckCm: neckCm ? parseFloat(neckCm) : undefined,
          waistCm: waistCm ? parseFloat(waistCm) : undefined,
          hipCm: hipCm ? parseFloat(hipCm) : undefined,
          customCalories: useCustomMacros && customCalories ? parseInt(customCalories) : undefined,
          customProtein: useCustomMacros && customProtein ? parseInt(customProtein) : undefined,
          useCustomMacros,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setShowSuccessSpecs(true);
        setTimeout(() => setShowSuccessSpecs(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save profile specifications:", err);
    } finally {
      setSavingSpecs(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const userId = localStorage.getItem("healthos_userId");
    if (!userId || !eventTitle.trim() || !startDate || !endDate) return;

    setSavingEvent(true);
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "note",
          payload: {
            title: eventTitle.trim(),
            event_type: eventType,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
          },
          source: "manual",
        }),
      });

      if (res.ok) {
        setEventTitle("");
        setStartDate("");
        setEndDate("");

        // Refresh events list
        const timelineRes = await fetch(`/api/timeline?userId=${userId}`);
        if (timelineRes.ok) {
          const timelineData = await timelineRes.json();
          const notes = (timelineData.events || []).filter((e: any) => e.type === "note");
          setEvents(notes);
        }
      }
    } catch (err) {
      console.error("Failed to create calendar event:", err);
    } finally {
      setSavingEvent(false);
    }
  };

  const handleRemoveEvent = async (eventId: string) => {
    const userId = localStorage.getItem("healthos_userId");
    if (!userId) return;

    try {
      const res = await fetch(`/api/timeline?eventId=${eventId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        // Refresh events list
        const timelineRes = await fetch(`/api/timeline?userId=${userId}`);
        if (timelineRes.ok) {
          const timelineData = await timelineRes.json();
          const notes = (timelineData.events || []).filter((e: any) => e.type === "note");
          setEvents(notes);
        }
      }
    } catch (err) {
      console.error("Failed to delete event:", err);
    }
  };

  const getEventBadge = (startStr: string, endStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(startStr);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endStr);
    end.setHours(23, 59, 59, 999);

    if (today >= start && today <= end) {
      return <span className="px-2 py-0.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[9px] font-bold uppercase tracking-wider">Active Event</span>;
    } else if (today < start) {
      return <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-wider">Upcoming</span>;
    } else {
      return <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 text-[9px] font-bold uppercase tracking-wider">Completed</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="page-container space-y-6 pb-28">
      {/* Toast Notification */}
      {showSuccessSpecs && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-green-500/20 border border-green-500/30 backdrop-blur-xl shadow-lg animate-in">
          <span className="text-sm font-bold text-green-400">✓ Specifications saved!</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pillar 1</span>
          <h1 className="text-xl font-bold text-white mt-0.5">Settings & Planner</h1>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 animate-in">
        <button
          onClick={() => setActiveTab("specs")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "specs" ? "bg-brand-500 text-white shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          ⚙️ Biometric Specs
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            activeTab === "calendar" ? "bg-brand-500 text-white shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          📅 Busy Schedule
        </button>
      </div>

      {/* Single Question Indicator */}
      <div className="bg-brand-500/5 border border-brand-500/10 rounded-2xl p-4 animate-in-delay-1 text-center">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-brand-400 block mb-1">Single Core Question</span>
        <h2 className="text-sm font-semibold text-white">
          {activeTab === "specs" ? '"Who am I today?"' : '"What events affect my plan?"'}
        </h2>
      </div>

      {/* Tab 1: Biometric Specs Form */}
      {activeTab === "specs" && (
        <form onSubmit={handleUpdateProfile} className="space-y-4 animate-in-delay-1">
          <GlassCard className="p-5 space-y-4 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-500/5 blur-[50px] rounded-full -z-10" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Specs</h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-glass text-xs h-11"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Age</label>
                  <input
                    type="number"
                    required
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="input-glass text-xs h-11 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Height (cm)</label>
                  <input
                    type="number"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="input-glass text-xs h-11 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    className="input-glass text-xs h-11 text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Target Weight (kg)</label>
                  <input
                    type="number"
                    value={targetWeightKg}
                    onChange={(e) => setTargetWeightKg(e.target.value)}
                    placeholder="e.g. 70"
                    className="input-glass text-xs h-11 text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Sleep Target (hrs)</label>
                  <input
                    type="number"
                    required
                    value={sleepTarget}
                    onChange={(e) => setSleepTarget(e.target.value)}
                    className="input-glass text-xs h-11 text-center"
                  />
                </div>
              </div>

              {/* Optional Body Measurements (Navy Body Fat Method) */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Body Measurements (Optional)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Neck (cm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 38"
                      value={neckCm}
                      onChange={(e) => setNeckCm(e.target.value)}
                      className="input-glass text-xs h-11 text-center"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Waist (cm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 92"
                      value={waistCm}
                      onChange={(e) => setWaistCm(e.target.value)}
                      className="input-glass text-xs h-11 text-center"
                    />
                  </div>
                </div>

                {((profile?.gender === "female" || profile?.gender === "other")) && (
                  <div>
                    <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Hip (cm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 104"
                      value={hipCm}
                      onChange={(e) => setHipCm(e.target.value)}
                      className="input-glass text-xs h-11 text-center"
                    />
                  </div>
                )}
              </div>

              {/* Custom Macro Targets Overrides */}
              <div className="border-t border-white/5 pt-4 space-y-3">
                <div 
                  onClick={() => setUseCustomMacros(!useCustomMacros)}
                  className="flex items-center gap-2 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={useCustomMacros}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 rounded text-cyan-500 bg-zinc-900 border-white/10 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Manual Calorie Override</span>
                </div>

                {useCustomMacros && (
                  <div className="grid grid-cols-2 gap-3 animate-in">
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Custom Calories (kcal)</label>
                      <input
                        type="number"
                        placeholder="e.g. 2500"
                        value={customCalories}
                        onChange={(e) => setCustomCalories(e.target.value)}
                        className="input-glass text-xs h-11 text-center"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Custom Protein (g)</label>
                      <input
                        type="number"
                        placeholder="e.g. 170"
                        value={customProtein}
                        onChange={(e) => setCustomProtein(e.target.value)}
                        className="input-glass text-xs h-11 text-center"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-4 border border-white/10 relative overflow-hidden">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Goals & Preferences</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Primary Goal</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                >
                  <option value="lose_fat">Lose Fat (Caloric Deficit)</option>
                  <option value="build_muscle">Build Muscle (Hypertrophy)</option>
                  <option value="maintain">Maintain Weight</option>
                  <option value="recomp">Body Recomposition</option>
                  <option value="general_health">General Health</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Activity Level</label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                >
                  <option value="sedentary">Sedentary (Desk Job)</option>
                  <option value="light">Lightly Active (Some Walks)</option>
                  <option value="moderate">Moderately Active (Workout 3-4x)</option>
                  <option value="active">Highly Active (Workout 5-6x)</option>
                  <option value="very_active">Athlete (Daily Training)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Diet Preference</label>
                  <select
                    value={dietPreference}
                    onChange={(e) => setDietPreference(e.target.value)}
                    className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                  >
                    <option value="none">No preference</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="eggetarian">Eggetarian</option>
                    <option value="non_veg">Non-Vegetarian</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Gym Experience</label>
                  <select
                    value={gymExperience}
                    onChange={(e) => setGymExperience(e.target.value)}
                    className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                  >
                    <option value="beginner">Beginner (0-1 yrs)</option>
                    <option value="intermediate">Intermediate (1-3 yrs)</option>
                    <option value="advanced">Advanced (3+ yrs)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Daily Schedule Context</label>
                <input
                  type="text"
                  placeholder="e.g. Classes 9am-4pm, evening free"
                  value={collegeSchedule}
                  onChange={(e) => setCollegeSchedule(e.target.value)}
                  className="input-glass text-xs h-11"
                />
              </div>
            </div>
          </GlassCard>

          <button
            type="submit"
            disabled={savingSpecs}
            className="btn-primary w-full py-3 flex items-center justify-center font-bold text-xs"
          >
            {savingSpecs ? "Saving..." : "Update Specifications"}
          </button>
        </form>
      )}

      {/* Tab 2: Calendar Busy Event Manager */}
      {activeTab === "calendar" && (
        <div className="space-y-6 animate-in-delay-1">
          {/* Create Event Form */}
          <GlassCard className="p-5 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-[50px] rounded-full -z-10" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Schedule Busy Period</h3>
            
            <form onSubmit={handleCreateEvent} className="space-y-4 mt-3">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End Semester Exams, Family Vacation"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="input-glass text-xs h-11"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Type of Event</label>
                <select
                  value={eventType}
                  onChange={(e: any) => setEventType(e.target.value)}
                  className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                >
                  <option value="exam">📝 Exams Prep Period (Steps target $\rightarrow$ 5,000)</option>
                  <option value="travel">✈️ Travel / Vacation (Steps target $\rightarrow$ 6,000)</option>
                  <option value="sick">🤒 Illness / Sick Days (Steps target $\rightarrow$ 3,000)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-glass text-xs h-11 px-3 bg-zinc-950 text-white border border-white/10 rounded-xl w-full"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingEvent}
                className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center"
              >
                {savingEvent ? "Scheduling..." : "Schedule Event"}
              </button>
            </form>
          </GlassCard>

          {/* List of Events */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Scheduled Event Logs</h3>
            {loadingEvents ? (
              <div className="shimmer h-16 w-full rounded-xl" />
            ) : events.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No events scheduled. Use the form above to add busy periods.</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev, i) => {
                  const payload = ev.payload;
                  const startStr = new Date(payload.startDate).toLocaleDateString([], { month: "short", day: "numeric" });
                  const endStr = new Date(payload.endDate).toLocaleDateString([], { month: "short", day: "numeric" });
                  const emoji = payload.event_type === "exam" ? "📝" : payload.event_type === "travel" ? "✈️" : "🤒";

                  return (
                    <GlassCard key={ev._id || i} className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{emoji}</span>
                          <span className="text-xs font-bold text-white capitalize">{payload.title}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500">
                          {startStr} — {endStr}
                        </p>
                        <div className="pt-1">
                          {getEventBadge(payload.startDate, payload.endDate)}
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveEvent(ev._id)}
                        className="p-2 bg-red-950/20 hover:bg-red-950/40 text-red-400 border border-red-900/20 rounded-lg text-[10px] font-bold transition-all"
                      >
                        Remove
                      </button>
                    </GlassCard>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

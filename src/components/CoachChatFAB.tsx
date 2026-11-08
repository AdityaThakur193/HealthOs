"use client";

import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Sparkles } from "lucide-react";
import { COACH_AVATAR_URL } from "@/lib/constants";
import { formatMessageContent } from "@/lib/markdownFormat";
import { CoachActionData, normalizeCoachMeal, normalizeCoachSteps, normalizeCoachWater } from "@/lib/coachActions";
import { motion, AnimatePresence } from "framer-motion";

type ChatProfile = Record<string, unknown> & { name?: string; weightKg?: number };

interface ChatHabit {
  id: string;
  title: string;
  targetValue: number;
}

interface Message {
  role: "user" | "model";
  content: string;
}


export default function CoachChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0, top: 0, bottom: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Free Draggable gesture state (managed automatically by Framer Motion)
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const updateConstraints = () => {
      if (typeof window !== "undefined") {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
          // Mobile starts bottom-24, left-6
          setDragConstraints({
            left: -12,
            right: window.innerWidth - 80,
            top: -window.innerHeight + 160,
            bottom: 60,
          });
        } else {
          // Desktop starts bottom-6, right-6
          setDragConstraints({
            left: -window.innerWidth + 80,
            right: 12,
            top: -window.innerHeight + 80,
            bottom: 12,
          });
        }
      }
    };
    updateConstraints();
    window.addEventListener("resize", updateConstraints);
    return () => window.removeEventListener("resize", updateConstraints);
  }, []);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = () => {
    // Small timeout to allow click handler to register that drag occurred
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 100);
  };

  const handleFABClick = () => {
    if (!isDraggingRef.current) {
      setIsOpen((prev) => !prev);
    }
  };

  // Pre-load profile stats for coach context
  const loadProfile = async () => {
    const email = localStorage.getItem("healthos_email");
    if (!email) return;
    try {
      const res = await fetch(`/api/profile?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        if (data.profile) {
          const name = data.profile.name ? data.profile.name.split(" ")[0] : "there";
          setMessages((prev) =>
            prev.length > 0
              ? prev
              : [{ role: "model", content: `Hey ${name}! I'm your AI health coach. Need to tweak your diet plan, customize your gym workouts, or ask a question? Talk to me here!` }]
          );
        }
      }
    } catch (err) {
      console.error("Chatbot failed to load user profile:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Fetches context from the server; state only changes once it responds.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadProfile();
    }
  }, [isOpen]);

  useEffect(() => {
    // Listen for profile changes from elsewhere to keep context updated
    const handleUpdate = () => loadProfile();
    window.addEventListener("profileUpdated", handleUpdate);
    return () => window.removeEventListener("profileUpdated", handleUpdate);
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sending) return;

    const email = localStorage.getItem("healthos_email");
    if (!email) return;

    const userMsg = inputValue.trim();
    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSending(true);

    try {
      // Fetch latest profile again to ensure freshest context
      const profRes = await fetch("/api/profile");
      let currentProfile = profile;
      if (profRes.ok) {
        const profData = await profRes.json();
        currentProfile = profData.profile;
        setProfile(currentProfile);
      }

      // Send chat message
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: messages.slice(-10), // Send last 10 messages for context
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "model", content: data.message }]);

        // Handle structural plan updates
        if (data.action && data.action !== "none" && data.updatedData) {
          await saveUpdatedPlan(data.action, data.updatedData, currentProfile);
        }
      } else {
        setMessages((prev) => [...prev, { role: "model", content: "Sorry, I had trouble processing that request. Please try again." }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "model", content: "Error connecting to server. Make sure you are online." }]);
    } finally {
      setSending(false);
    }
  };

  const saveUpdatedPlan = async (action: string, updatedData: CoachActionData, currentProfile: ChatProfile | null) => {
    const email = localStorage.getItem("healthos_email");
    if (!email || !currentProfile) return;
    // Use the stored ObjectId string from localStorage (same format as handleQuickLog)

    // Helper: post a timeline event
    const postTimeline = async (type: string, payload: object, tags: string[] = []) => {
      try {
        const res = await fetch("/api/timeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, timestamp: new Date().toISOString(), payload, tags, source: "chatbot" }),
        });
        if (!res.ok) {
          const err = await res.text();
          console.error(`❌ Timeline POST failed (${res.status}):`, err);
        }
        return res.ok;
      } catch (e) {
        console.error("❌ Timeline POST network error:", e);
        return false;
      }
    };

    // Helper: append confirm message AND trigger dashboard refresh
    const confirm = (msg: string) => {
      setMessages((prev) => [...prev, { role: "model", content: msg }]);
      window.dispatchEvent(new Event("chatbotDataLogged"));
    };

    try {
      // ── 1. LOG MEAL ──────────────────────────────────────────────────────
      if (action === "log_meal") {
        const meal = normalizeCoachMeal(updatedData);
        const { totalCalories, totalProteinG } = meal;
        const ok = await postTimeline("meal", meal, [meal.mealType, "chatbot"]);
        if (ok) {
          confirm(`✅ **${(updatedData.mealType || "meal").replace(/^\w/, (c: string) => c.toUpperCase())} Logged!** ${totalCalories} kcal · ${totalProteinG}g protein saved to your timeline 🍽️`);
          window.dispatchEvent(new Event("mealLogged"));
        }
        return;
      }

      // ── 2. LOG STEPS ─────────────────────────────────────────────────────
      if (action === "log_steps") {
        const stepsPayload = normalizeCoachSteps(updatedData);
        const { steps, distanceKm: distKm, caloriesBurned: kcal } = stepsPayload;
        const ok = await postTimeline("steps", stepsPayload, ["steps", "chatbot"]);
        if (ok) {
          confirm(`✅ **Steps Logged!** ${steps.toLocaleString()} steps · ${distKm}km · ~${kcal} kcal burned 👟`);
          window.dispatchEvent(new Event("stepsLogged"));
        }
        return;
      }

      // ── 3. LOG WATER ─────────────────────────────────────────────────────
      if (action === "log_water") {
        const waterPayload = normalizeCoachWater(updatedData);
        const { amountMl: ml, glasses } = waterPayload;
        const ok = await postTimeline("water", waterPayload, ["water", "chatbot"]);
        if (ok) {
          confirm(`✅ **Water Logged!** ${glasses} glass${glasses !== 1 ? "es" : ""} (${ml}ml) 💧`);
          window.dispatchEvent(new Event("waterLogged"));
        }
        return;
      }

      // ── 4. LOG SLEEP ─────────────────────────────────────────────────────
      if (action === "log_sleep") {
        const ok = await postTimeline("sleep", {
          hours: updatedData.hours || 0,
          quality: updatedData.quality || 7,
          bedtime: updatedData.bedtime || "",
          wakeTime: updatedData.wakeTime || "",
          notes: updatedData.notes || "",
          loggedVia: "chatbot",
        }, ["sleep", "chatbot"]);
        if (ok) {
          confirm(`✅ **Sleep Logged!** ${updatedData.hours}h · quality ${updatedData.quality}/10${updatedData.bedtime ? ` · ${updatedData.bedtime} → ${updatedData.wakeTime}` : ""} 😴`);
          window.dispatchEvent(new Event("sleepLogged"));
        }
        return;
      }

      // ── 5. LOG WEIGHT ────────────────────────────────────────────────────
      if (action === "log_weight") {
        const logged = await postTimeline("weight", { weightKg: updatedData.weightKg, notes: updatedData.notes || "", loggedVia: "chatbot" }, ["weight", "chatbot"]);
        if (!logged) return;
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...currentProfile, weightKg: updatedData.weightKg }),
        });
        const newWeight = updatedData.weightKg as number;
        const diff = (newWeight - (currentProfile.weightKg || newWeight)).toFixed(1);
        const diffStr = parseFloat(diff) !== 0 ? ` (${parseFloat(diff) > 0 ? "+" : ""}${diff}kg from last)` : "";
        confirm(`✅ **Weight Logged!** ${updatedData.weightKg}kg${diffStr} — profile updated ⚖️`);
        window.dispatchEvent(new Event("profileUpdated"));
        window.dispatchEvent(new Event("weightLogged"));
        return;
      }

      // ── 6. LOG WORKOUT DONE ──────────────────────────────────────────────
      if (action === "log_workout_done") {
        const dur = updatedData.durationMin || 60;
        const kcal = updatedData.caloriesBurned || Math.round(dur * 7);
        const ok = await postTimeline("workout", {
          name: updatedData.workoutName || "Gym Session",
          workoutName: updatedData.workoutName || "Gym Session",
          durationMin: dur,
          musclesWorked: updatedData.musclesWorked || [],
          exercisesCompleted: updatedData.exercisesCompleted || [],
          caloriesBurned: kcal,
          notes: updatedData.notes || "",
          loggedVia: "chatbot",
        }, ["workout", "chatbot"]);
        if (ok) {
          confirm(`✅ **Workout Logged!** ${updatedData.workoutName || "Session"} · ${dur}min · ~${kcal} kcal 🏋️`);
          window.dispatchEvent(new Event("workoutLogged"));
        }
        return;
      }

      // ── 7. UPDATE DIET PLAN ──────────────────────────────────────────────
      if (action === "update_diet") {
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...currentProfile, dietPlan: { generatedPlan: updatedData, generatedAt: new Date().toISOString() } }),
        });
        if (res.ok) window.dispatchEvent(new Event("profileUpdated"));
        return;
      }

      // ── 8. UPDATE WORKOUT PLAN ───────────────────────────────────────────
      if (action === "update_workout") {
        const newFrequency = updatedData?.gymFrequency;
        const gymFrequency = parseInt(String(newFrequency));
        if (![3, 4, 5, 6].includes(gymFrequency)) return;
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...currentProfile, gymFrequency }),
        });
        if (res.ok) window.dispatchEvent(new Event("profileUpdated"));
        return;
      }

      // ── 9. LOG HABIT ─────────────────────────────────────────────
      if (action === "log_habit") {
        const habitTitle = String(updatedData?.habitTitle || "").trim();
        if (!habitTitle) return;
        const hRes = await fetch("/api/habits");
        const hData = await hRes.json();
        if (hData.success && hData.habits) {
          const matched = hData.habits.find(
            (h: ChatHabit) => h.title.toLowerCase().includes(habitTitle.toLowerCase()) || habitTitle.toLowerCase().includes(h.title.toLowerCase())
          );
          if (matched) {
            await fetch("/api/habits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "checkin",
                checkin: {
                  habitId: matched.id,
                  completed: updatedData?.completed !== undefined ? updatedData.completed : true,
                  value: updatedData?.value !== undefined ? updatedData.value : updatedData?.completed === false ? 0 : matched.targetValue,
                },
              }),
            });
            window.dispatchEvent(new Event("habitsUpdated"));
          }
        }
        return;
      }

    } catch (err) {
      console.error("Failed to sync chatbot action:", err);
    }
  };

  return (
    <>
      {/* Draggable Floating Action Button with Spring Hover Scale */}
      <motion.button
        drag
        dragConstraints={dragConstraints}
        dragMomentum={true}
        dragElastic={0.1}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleFABClick}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-24 left-6 md:left-auto md:right-6 md:bottom-6 z-50 w-14 h-14 rounded-full bg-[#0c0f0d] border border-[#8ba893] flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing hover:scale-105 transition-all group overflow-hidden touch-none select-none"
        style={{ 
          boxShadow: "0 0 15px rgba(139, 168, 147, 0.25)",
        }}
      >
        <div className="absolute inset-0 bg-[#8ba893]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <img 
          src={COACH_AVATAR_URL} 
          alt="Coach Avatar"
          className="w-11 h-11 object-contain rounded-full"
        />
        {/* Pulsing notification dot */}
        <span className="absolute top-0 right-1 w-3.5 h-3.5 bg-[#c87a53] border-2 border-[#0c0f0d] rounded-full animate-pulse" />
      </motion.button>

      {/* Chat Drawer Side Panel with Spring Animations */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 350, damping: 26 } }}
            exit={{ opacity: 0, scale: 0.95, y: 15, transition: { duration: 0.15, ease: "easeOut" } }}
            className="fixed bottom-[82px] right-3 left-3 md:left-auto md:right-6 md:bottom-24 z-50 w-auto md:w-[385px] bg-[#0c0f0d]/95 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden" 
            style={{ maxHeight: 'min(480px, calc(100dvh - 160px))' }}
          >
          {/* Header */}
          <div className="p-4 bg-white/3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src={COACH_AVATAR_URL} 
                  alt="Coach Avatar"
                  className="w-10 h-10 object-contain rounded-full border border-[#8ba893]/30"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border border-[#0c0f0d] rounded-full" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1">
                  AI Coach Assistant <Sparkles className="w-3 h-3 text-[#c87a53]" />
                </h4>
                <p className="text-[9px] text-[#8ba893] font-bold uppercase tracking-wider">Active Calibration</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Log */}
          <div className="flex-1 min-h-0 p-4 overflow-y-auto space-y-4 scrollbar-thin bg-gradient-to-b from-transparent to-white/1">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "model" && (
                  <img 
                    src={COACH_AVATAR_URL} 
                    alt="Coach Avatar"
                    className="w-7 h-7 object-contain rounded-full flex-shrink-0 border border-white/10"
                  />
                )}
                
                <div
                  className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed animate-in duration-300 fade-in slide-in-from-bottom-2 ${
                    msg.role === "user"
                      ? "bg-gradient-to-tr from-[#8ba893] to-[#9cbda5] text-[#0c0f0d] rounded-tr-none font-bold shadow-lg shadow-[#8ba893]/10"
                      : "bg-white/5 text-zinc-300 border border-white/10 rounded-tl-none backdrop-blur-sm"
                  }`}
                >
                  {formatMessageContent(msg.content, msg.role === "user")}
                </div>
              </div>
            ))}
            
            {sending && (
              <div className="flex gap-2.5 justify-start">
                <img 
                  src={COACH_AVATAR_URL} 
                  alt="Coach Avatar"
                  className="w-7 h-7 object-contain rounded-full flex-shrink-0 border border-white/10"
                />
                <div className="bg-white/5 border border-white/5 text-zinc-400 p-3 rounded-2xl rounded-tl-none flex items-center gap-1.5 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8ba893]" /> Coach is calibrating...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Prompt Suggestions */}
          {messages.length === 1 && (
            <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto scrollbar-none">
              <button
                onClick={() => setInputValue("Generate my custom sports diet plan for this week")}
                className="px-2.5 py-1 bg-[#8ba893]/10 border border-[#8ba893]/30 rounded-full text-[9px] font-bold text-[#8ba893] hover:bg-[#8ba893]/20 transition-all cursor-pointer whitespace-nowrap"
              >
                🥗 Generate AI Diet Plan
              </button>
              <button
                onClick={() => setInputValue("Update my gym split to a 5-day training program")}
                className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-bold text-zinc-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
              >
                🏋️ Update 5-Day Gym Split
              </button>
              <button
                onClick={() => setInputValue("What are my macro targets and intake today?")}
                className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-bold text-zinc-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
              >
                ⚡ Check Target Macros
              </button>
            </div>
          )}

          {/* Chat Input form */}
          <form onSubmit={handleSend} className="flex-shrink-0 p-3 bg-white/2 border-t border-white/5 flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask coach to modify your diet or split..."
              className="flex-1 bg-zinc-950/60 border border-white/10 rounded-xl px-3.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#8ba893] transition-all h-10"
            />
            <button
              type="submit"
              disabled={sending || !inputValue.trim()}
              className="w-10 h-10 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

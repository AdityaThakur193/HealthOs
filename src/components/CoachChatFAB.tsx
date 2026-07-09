"use client";

import { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, X, Send, Loader2, Sparkles, User, HelpCircle, 
  Settings, CheckCircle2, ChevronRight 
} from "lucide-react";
import GlassCard from "./GlassCard";

interface Message {
  role: "user" | "model";
  content: string;
}

function formatMessageContent(content: string, isUser = false) {
  return content.split("\n").map((line, lineIdx) => {
    let cleanLine = line.trim();
    if (!cleanLine) return <div key={lineIdx} className="h-2" />;

    // Handle headers (### or ## or #)
    let isHeader = false;
    let headerText = cleanLine;
    if (cleanLine.startsWith("### ")) {
      headerText = cleanLine.substring(4);
      isHeader = true;
    } else if (cleanLine.startsWith("## ")) {
      headerText = cleanLine.substring(3);
      isHeader = true;
    } else if (cleanLine.startsWith("# ")) {
      headerText = cleanLine.substring(2);
      isHeader = true;
    }

    if (isHeader) {
      // Strip any inner bold markings inside header
      const title = headerText.replace(/\*\*/g, "");
      return (
        <h5 
          key={lineIdx} 
          className={`font-bold text-[10px] uppercase tracking-wider mt-3 mb-1.5 ${
            isUser ? "text-zinc-950" : "text-[#8ba893]"
          }`}
        >
          {title}
        </h5>
      );
    }

    // Handle bullet points
    let isBullet = false;
    if (cleanLine.startsWith("* ") || cleanLine.startsWith("- ")) {
      cleanLine = cleanLine.substring(2);
      isBullet = true;
    }

    // Handle inline bolding (**text**)
    const parts: React.ReactNode[] = [];
    const regex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanLine)) !== null) {
      const textBefore = cleanLine.substring(lastIndex, match.index);
      const boldText = match[1];
      
      if (textBefore) parts.push(textBefore);
      parts.push(
        <strong key={match.index} className={`font-bold ${isUser ? "text-zinc-950" : "text-white"}`}>
          {boldText}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    const textAfter = cleanLine.substring(lastIndex);
    if (textAfter) parts.push(textAfter);

    if (isBullet) {
      return (
        <div key={lineIdx} className="flex items-start gap-1 ml-1 my-0.5">
          <span className={`${isUser ? "text-zinc-900" : "text-[#8ba893]"} text-[10px] mt-1 mr-0.5 flex-shrink-0`}>•</span>
          <span className={`flex-1 ${isUser ? "text-zinc-900" : "text-zinc-300"}`}>{parts}</span>
        </div>
      );
    }

    return <p key={lineIdx} className="my-0.5 leading-relaxed">{parts}</p>;
  });
}

export default function CoachChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pre-load profile stats for coach context
  const loadProfile = async () => {
    const email = localStorage.getItem("healthos_email");
    if (!email) return;
    try {
      const res = await fetch(`/api/profile?email=${encodeURIComponent(email)}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
      }
    } catch (err) {
      console.error("Chatbot failed to load user profile:", err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProfile();
    }
  }, [isOpen]);

  // Load first greeting
  useEffect(() => {
    if (!profile) return;
    setMessages((prev) => {
      if (prev.length === 0) {
        const name = profile?.name || "Aditya";
        return [
          { 
            role: "model", 
            content: `Hey ${name}! I'm your AI health coach. Need to tweak your diet plan, customize your gym workouts, or ask a question? Talk to me here!` 
          }
        ];
      }
      return prev;
    });
  }, [profile]);

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
      const profRes = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
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
          email,
          message: userMsg,
          history: messages.slice(-10), // Send last 10 messages for context
          profile: currentProfile,
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

  const saveUpdatedPlan = async (action: string, updatedData: any, currentProfile: any) => {
    const email = localStorage.getItem("healthos_email");
    if (!email || !currentProfile) return;
    // Use the stored ObjectId string from localStorage (same format as handleQuickLog)
    const userId = localStorage.getItem("healthos_userId") || String(currentProfile._id || email);

    // Helper: post a timeline event
    const postTimeline = async (type: string, payload: object, tags: string[] = []) => {
      try {
        const res = await fetch("/api/timeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, type, timestamp: new Date().toISOString(), payload, tags, source: "chatbot" }),
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
        const ok = await postTimeline("meal", {
          mealType: updatedData.mealType || "meal",
          foods: updatedData.items || [],
          totalCalories: updatedData.totalCalories || 0,
          totalProteinG: updatedData.totalProtein || 0,
          totalCarbsG: updatedData.totalCarbs || (updatedData.items || []).reduce((s: number, f: any) => s + (f.carbsG || 0), 0),
          totalFatG: updatedData.totalFat || (updatedData.items || []).reduce((s: number, f: any) => s + (f.fatG || 0), 0),
          notes: updatedData.notes || "",
          loggedVia: "chatbot",
        }, [updatedData.mealType || "meal", "chatbot"]);
        if (ok) {
          confirm(`✅ **${(updatedData.mealType || "meal").replace(/^\w/, (c: string) => c.toUpperCase())} Logged!** ${updatedData.totalCalories || 0} kcal · ${updatedData.totalProtein || 0}g protein saved to your timeline 🍽️`);
          window.dispatchEvent(new Event("mealLogged"));
        }
        return;
      }

      // ── 2. LOG STEPS ─────────────────────────────────────────────────────
      if (action === "log_steps") {
        const steps = updatedData.steps || 0;
        const distKm = updatedData.distanceKm || parseFloat((steps * 0.00075).toFixed(2));
        const kcal = updatedData.caloriesBurned || Math.round(steps * 0.04);
        const ok = await postTimeline("steps", { count: steps, steps, distanceKm: distKm, caloriesBurned: kcal, notes: updatedData.notes || "", loggedVia: "chatbot" }, ["steps", "chatbot"]);
        if (ok) {
          confirm(`✅ **Steps Logged!** ${steps.toLocaleString()} steps · ${distKm}km · ~${kcal} kcal burned 👟`);
          window.dispatchEvent(new Event("stepsLogged"));
        }
        return;
      }

      // ── 3. LOG WATER ─────────────────────────────────────────────────────
      if (action === "log_water") {
        const glasses = updatedData.glasses || Math.round((updatedData.amountMl || 0) / 250);
        const ml = updatedData.amountMl || glasses * 250;
        const ok = await postTimeline("water", { amountL: +(ml / 1000).toFixed(2), amountMl: ml, glasses, notes: updatedData.notes || "", loggedVia: "chatbot" }, ["water", "chatbot"]);
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
        await postTimeline("weight", { weightKg: updatedData.weightKg, notes: updatedData.notes || "", loggedVia: "chatbot" }, ["weight", "chatbot"]);
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...currentProfile, email, weightKg: updatedData.weightKg }),
        });
        const diff = (updatedData.weightKg - (currentProfile.weightKg || updatedData.weightKg)).toFixed(1);
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
          body: JSON.stringify({ ...currentProfile, email, dietPlan: { generatedPlan: updatedData, generatedAt: new Date().toISOString() } }),
        });
        if (res.ok) window.dispatchEvent(new Event("profileUpdated"));
        return;
      }

      // ── 8. UPDATE WORKOUT PLAN ───────────────────────────────────────────
      if (action === "update_workout") {
        const res = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...currentProfile, email, workouts: updatedData }),
        });
        if (res.ok) window.dispatchEvent(new Event("profileUpdated"));
        return;
      }

    } catch (err) {
      console.error("Failed to sync chatbot action:", err);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-24 left-6 md:left-auto md:right-6 md:bottom-6 z-50 w-14 h-14 rounded-full bg-[#0c0f0d] border border-[#8ba893] flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-all group overflow-hidden"
        style={{ boxShadow: "0 0 15px rgba(139, 168, 147, 0.25)" }}
      >
        <div className="absolute inset-0 bg-[#8ba893]/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <img 
          src="https://user-images.githubusercontent.com/74038190/216654095-6f6772e4-e433-4bba-9164-1ca6f463ac3f.gif" 
          alt="Coach Avatar"
          className="w-11 h-11 object-contain rounded-full"
        />
        {/* Pulsing notification dot */}
        <span className="absolute top-0 right-1 w-3.5 h-3.5 bg-[#c87a53] border-2 border-[#0c0f0d] rounded-full animate-pulse" />
      </button>

      {/* Chat Drawer Side Panel */}
      {isOpen && (
        <div className="fixed bottom-[82px] right-3 left-3 md:left-auto md:right-6 md:bottom-24 z-50 w-auto md:w-[385px] bg-[#0c0f0d]/95 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in" style={{ maxHeight: 'min(480px, calc(100dvh - 160px))' }}>
          {/* Header */}
          <div className="p-4 bg-white/3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img 
                  src="https://user-images.githubusercontent.com/74038190/216654095-6f6772e4-e433-4bba-9164-1ca6f463ac3f.gif" 
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
                    src="https://user-images.githubusercontent.com/74038190/216654095-6f6772e4-e433-4bba-9164-1ca6f463ac3f.gif" 
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
                  src="https://user-images.githubusercontent.com/74038190/216654095-6f6772e4-e433-4bba-9164-1ca6f463ac3f.gif" 
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
                onClick={() => setInputValue("Adjust Monday's breakfast...")}
                className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-bold text-zinc-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
              >
                ✏️ Edit Monday Breakfast
              </button>
              <button
                onClick={() => setInputValue("Suggest high-protein additions for today's mess menu")}
                className="px-2.5 py-1 bg-white/5 border border-white/5 rounded-full text-[9px] font-bold text-zinc-400 hover:text-white transition-all cursor-pointer whitespace-nowrap"
              >
                🥣 Daily Protein Additions
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
        </div>
      )}
    </>
  );
}

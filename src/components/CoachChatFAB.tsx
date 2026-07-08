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
    const name = profile?.name || "Aditya";
    setMessages([
      { 
        role: "model", 
        content: `Hey ${name}! I'm your AI health coach. Need to tweak your diet plan, customize your gym workouts, or ask a question? Talk to me here!` 
      }
    ]);
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

    try {
      const payload: any = {
        email,
        name: currentProfile.name,
        age: currentProfile.age,
        gender: currentProfile.gender,
        heightCm: currentProfile.heightCm,
        weightKg: currentProfile.weightKg,
        targetWeightKg: currentProfile.targetWeightKg,
        goal: currentProfile.goal,
        activityLevel: currentProfile.activityLevel,
        gymExperience: currentProfile.gymExperience,
        gymFrequency: currentProfile.gymFrequency,
        gymAccess: currentProfile.gymAccess,
        messAccess: currentProfile.messAccess,
        dietPreference: currentProfile.dietPreference,
        foodAllergies: currentProfile.foodAllergies,
        medicalConditions: currentProfile.medicalConditions,
        sleepTarget: currentProfile.sleepTarget,
        collegeSchedule: currentProfile.collegeSchedule,
        neckCm: currentProfile.neckCm,
        waistCm: currentProfile.waistCm,
        hipCm: currentProfile.hipCm,
        customCalories: currentProfile.customCalories,
        customProtein: currentProfile.customProtein,
        useCustomMacros: currentProfile.useCustomMacros,
      };

      if (action === "update_diet") {
        payload.dietPlan = {
          generatedPlan: updatedData,
          generatedAt: new Date().toISOString(),
        };
      }

      const updateRes = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (updateRes.ok) {
        console.log("Plan updated successfully via chatbot!");
        window.dispatchEvent(new Event("profileUpdated"));
      }
    } catch (err) {
      console.error("Failed to sync chatbot plan edits:", err);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 md:bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#0c0f0d] border border-[#8ba893] flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-all group overflow-hidden"
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
        <div className="fixed bottom-0 right-0 left-0 md:left-auto md:right-6 md:bottom-24 z-50 w-full md:w-[385px] h-[520px] bg-[#0c0f0d]/95 border-t md:border border-white/10 rounded-t-3xl md:rounded-2xl backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in">
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
          <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin bg-gradient-to-b from-transparent to-white/1">
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
                  className={`max-w-[75%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#8ba893] text-[#0c0f0d] rounded-tr-none font-medium"
                      : "bg-white/5 text-zinc-300 border border-white/5 rounded-tl-none"
                  }`}
                >
                  {msg.content}
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
          <form onSubmit={handleSend} className="p-3 bg-white/2 border-t border-white/5 flex gap-2">
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

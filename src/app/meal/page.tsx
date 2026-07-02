"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import MealResultCard from "@/components/MealResultCard";

interface FoodItem {
  name: string;
  portionSize: "small" | "medium" | "large";
  estimatedCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export default function MealCapture() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Flow State: 'idle' | 'analyzing' | 'results'
  const [state, setState] = useState<"idle" | "analyzing" | "results">("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [confidence, setConfidence] = useState(0.9);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    async function checkProfileAndLoadHistory() {
      try {
        const email = localStorage.getItem("healthos_email");
        if (!email) {
          router.push("/login");
          return;
        }

        const profileRes = await fetch(`/api/profile?email=${encodeURIComponent(email)}`);
        const profileData = await profileRes.json();
        if (profileData.notInitialized) {
          router.push(`/onboarding?email=${encodeURIComponent(email)}`);
          return;
        }

        const userId = profileData.profile._id;
        localStorage.setItem("healthos_userId", userId);

        const res = await fetch(`/api/timeline?userId=${userId}&type=meal`);
        if (res.ok) {
          const data = await res.json();
          const todayStr = new Date().toDateString();
          const todayEvents = (data.events || []).filter(
            (event: any) => new Date(event.timestamp).toDateString() === todayStr
          );
          setHistory(todayEvents);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingHistory(false);
      }
    }
    checkProfileAndLoadHistory();
  }, [router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
      setState("analyzing");

      try {
        const res = await fetch("/api/vision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setFoods(data.analysis.foods || []);
          setConfidence(data.analysis.confidence || 0.9);
          setIsMock(data.isMock === true);
          setState("results");
        } else {
          alert("Analysis failed. Try again.");
          setState("idle");
        }
      } catch (err) {
        console.error(err);
        setState("idle");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleTriggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handlePortionChange = (index: number, size: "small" | "medium" | "large") => {
    setFoods((prev) =>
      prev.map((f, i) => (i === index ? { ...f, portionSize: size } : f))
    );
  };

  const handleRemoveFood = (index: number) => {
    setFoods((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveMeal = async () => {
    const userId = localStorage.getItem("healthos_userId");
    if (!userId) return;

    const portionMultipliers = { small: 0.7, medium: 1.0, large: 1.4 };

    // Calculate adjusted values
    const finalFoods = foods.map((f) => {
      const mult = portionMultipliers[f.portionSize];
      return {
        ...f,
        estimatedCalories: Math.round(f.estimatedCalories * mult),
        proteinG: Math.round(f.proteinG * mult),
        carbsG: Math.round(f.carbsG * mult),
        fatG: Math.round(f.fatG * mult),
      };
    });

    const totalCalories = finalFoods.reduce((sum, f) => sum + f.estimatedCalories, 0);
    const totalProteinG = finalFoods.reduce((sum, f) => sum + f.proteinG, 0);

    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "meal",
          payload: {
            foods: finalFoods,
            totalCalories,
            totalProteinG,
            imagePreview,
          },
          source: "ai_vision",
        }),
      });

      if (res.ok) {
        setShowSuccess(true);
        setTimeout(() => router.push("/"), 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-container space-y-6">
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-green-500/20 border border-green-500/30 backdrop-blur-xl shadow-lg animate-in">
          <span className="text-sm font-bold text-green-400">✓ Meal logged successfully!</span>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pillar 2</span>
          <h1 className="text-xl font-bold text-white mt-0.5">AI Meal Capture</h1>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Camera Capture Area */}
      {state === "idle" && (
        <div className="space-y-6 animate-in-delay-1">
          <GlassCard
            onClick={handleTriggerCamera}
            className="border-2 border-dashed border-zinc-800 hover:border-brand-500/40 p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-60"
          >
            <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 mb-4 glow-green">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8">
                <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                <path fillRule="evenodd" d="M9.344 3.071a2.18 2.18 0 011.785-.92h1.744c.66 0 1.258.307 1.636.845l.9 1.286c.26.372.697.587 1.157.587h1.684a2.977 2.977 0 012.977 2.977v8.993a2.977 2.977 0 01-2.977 2.977H5.251a2.977 2.977 0 01-2.977-2.977V7.844a2.977 2.977 0 012.977-2.977h1.684c.46 0 .897-.215 1.157-.587l.9-1.286zM12 7.5a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5z" clipRule="evenodd" />
              </svg>
            </div>
            <h3 className="text-sm font-bold text-white">Snap your plate</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
              Aim camera at food. Health OS identifies ingredients and portions instantly.
            </p>
          </GlassCard>


          {/* Today's Meals History */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Today's Logs</h3>
            {loadingHistory ? (
              <div className="shimmer h-16 w-full rounded-xl" />
            ) : history.length === 0 ? (
              <p className="text-xs text-zinc-600 italic">No meals logged today.</p>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <GlassCard key={i} className="p-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white capitalize">{h.payload.foods?.[0]?.name || h.payload.name || "Logged Meal"}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-brand-400">{h.payload.totalCalories} kcal</span>
                      <p className="text-[10px] text-zinc-500 mt-0.5">{h.payload.totalProteinG}g protein</p>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Scanning State */}
      {state === "analyzing" && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6 animate-in">
          {imagePreview && (
            <div className="relative w-44 h-44 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img src={imagePreview} className="w-full h-full object-cover opacity-60" alt="Scanned food" />
              {/* Scan sweep animation */}
              <div
                className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-brand-400 to-accent-cyan opacity-80"
                style={{
                  top: 0,
                  animation: "scan 1.5s ease-in-out infinite",
                  boxShadow: "0 0 12px #22c55e",
                }}
              />
            </div>
          )}
          <div className="text-center space-y-1">
            <h3 className="text-sm font-bold text-white">AI Analyzing Plate...</h3>
            <p className="text-xs text-zinc-500">Estimating portions & ingredients</p>
          </div>

          <style jsx global>{`
            @keyframes scan {
              0% { top: 0%; }
              50% { top: 96%; }
              100% { top: 0%; }
            }
          `}</style>
        </div>
      )}

      {/* Results Adjust/Verification State */}
      {state === "results" && (
        <div className="space-y-5 animate-in">
          {isMock && (
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
              <span className="text-xs text-yellow-400">⚠️ Demo mode — connect Gemini API for real food analysis</span>
            </div>
          )}
          {/* Summary header */}
          <div className="p-4 bg-brand-500/5 border border-brand-500/20 rounded-2xl flex items-center justify-between">
            <div>
              <span className="badge-success">Confidence: {Math.round(confidence * 100)}%</span>
              <h4 className="text-sm font-bold text-white mt-2">Adjust portions to finalize</h4>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-brand-400">
                {foods.reduce((sum, f) => {
                  const mult = f.portionSize === "small" ? 0.7 : f.portionSize === "large" ? 1.4 : 1.0;
                  return sum + Math.round(f.estimatedCalories * mult);
                }, 0)}
              </span>
              <p className="text-[10px] text-zinc-500">Estimated kcal</p>
            </div>
          </div>

          {/* Food items result cards */}
          <div className="space-y-3">
            {foods.length === 0 ? (
              <p className="text-xs text-zinc-500 italic text-center py-4">No foods identified. Add items manually.</p>
            ) : (
              foods.map((food, i) => (
                <MealResultCard
                  key={i}
                  food={food}
                  onPortionChange={(size) => handlePortionChange(i, size)}
                  onRemove={() => handleRemoveFood(i)}
                />
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <button
              onClick={() => setState("idle")}
              type="button"
              className="btn-ghost flex-1 py-3"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveMeal}
              type="button"
              className="btn-primary flex-[2] py-3 text-center"
              disabled={foods.length === 0}
            >
              Log Meal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

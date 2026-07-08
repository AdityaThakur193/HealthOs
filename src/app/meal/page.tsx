"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import MealResultCard from "@/components/MealResultCard";
import CustomPopup from "@/components/CustomPopup";
import { Camera, Edit3, AlertTriangle, Play, CheckCircle } from "lucide-react";

interface FoodItem {
  name: string;
  portionSize: "small" | "medium" | "large";
  estimatedCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function compressImage(file: File, maxWidth: number = 800, maxHeight: number = 800, quality: number = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

export default function MealCapture() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Flow State: 'idle' | 'analyzing' | 'results'
  const [state, setState] = useState<"idle" | "analyzing" | "results">("idle");
  const [mode, setMode] = useState<"photo" | "manual">("photo");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [confidence, setConfidence] = useState(0.9);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isMock, setIsMock] = useState(false);

  // Custom Popup Alert States
  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    type: "alert" | "confirm" | "error" | "success" | "warning";
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
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

  // Manual meal form states
  const [manualName, setManualName] = useState("");
  const [manualCal, setManualCal] = useState("");
  const [manualProt, setManualProt] = useState("");
  const [manualCarbs, setManualCarbs] = useState("");
  const [manualFats, setManualFats] = useState("");

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState("analyzing");

    try {
      // Compress image to fit Vercel payload constraints (max 800px, 70% quality JPEG)
      const compressedBase64 = await compressImage(file, 800, 800, 0.7);
      setImagePreview(compressedBase64);

      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: compressedBase64,
          mimeType: "image/jpeg",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setFoods(data.analysis.foods || []);
        setConfidence(data.analysis.confidence || 0.9);
        setIsMock(data.isMock === true);
        setState("results");
      } else if (res.status === 429) {
        const data = await res.json();
        showCustomAlert("Quota Reached ⏳", `Gemini API quota reached.\n\n${data.message}`, "warning");
        setState("idle");
      } else {
        showCustomAlert("Analysis Failed", "Analysis failed. Please try again.", "error");
        setState("idle");
      }
    } catch (err) {
      console.error("Compression/Upload error:", err);
      showCustomAlert("Upload Error", "Failed to analyze image. Ensure it is a valid photo.", "error");
      setState("idle");
    }
  };

  const handleTriggerCamera = () => {
    cameraInputRef.current?.click();
  };

  const handleTriggerGallery = () => {
    galleryInputRef.current?.click();
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

  const handleSaveManualMeal = async () => {
    const userId = localStorage.getItem("healthos_userId");
    if (!userId || !manualName.trim()) return;

    setLoadingHistory(true);
    try {
      const res = await fetch("/api/timeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          type: "meal",
          payload: {
            name: manualName.trim(),
            totalCalories: parseInt(manualCal) || 0,
            totalProteinG: parseInt(manualProt) || 0,
            totalCarbsG: parseInt(manualCarbs) || 0,
            totalFatG: parseInt(manualFats) || 0,
            foods: [
              {
                name: manualName.trim(),
                portionSize: "medium",
                estimatedCalories: parseInt(manualCal) || 0,
                proteinG: parseInt(manualProt) || 0,
                carbsG: parseInt(manualCarbs) || 0,
                fatG: parseInt(manualFats) || 0,
              },
            ],
          },
          source: "manual",
        }),
      });

      if (res.ok) {
        setShowSuccess(true);
        setManualName("");
        setManualCal("");
        setManualProt("");
        setManualCarbs("");
        setManualFats("");
        
        // Reload today's log history
        const histRes = await fetch(`/api/timeline?userId=${userId}&type=meal`);
        if (histRes.ok) {
          const histData = await histRes.json();
          const todayStr = new Date().toDateString();
          const todayEvents = (histData.events || []).filter(
            (event: any) => new Date(event.timestamp).toDateString() === todayStr
          );
          setHistory(todayEvents);
        }
        
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save manual meal:", err);
    } finally {
      setLoadingHistory(false);
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

      {/* Hidden file inputs */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        ref={galleryInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Mode Selector Tabs (only in idle state) */}
      {state === "idle" && (
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 animate-in">
          <button
            onClick={() => setMode("photo")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === "photo" ? "bg-brand-500 text-white shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Camera className="w-3.5 h-3.5" /> AI Photo Capture
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              mode === "manual" ? "bg-brand-500 text-white shadow-md" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Manual Meal Log
          </button>
        </div>
      )}

      {/* Capture Forms Area */}
      {state === "idle" && (
        <div className="space-y-6 animate-in-delay-1">
          {mode === "photo" ? (
            <div className="grid grid-cols-2 gap-4">
              {/* Camera Action Card */}
              <GlassCard
                onClick={handleTriggerCamera}
                className="border border-white/10 hover:border-brand-500/40 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[160px] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 blur-[40px] rounded-full -z-10" />
                <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-400 mb-3 glow-green">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                    <path fillRule="evenodd" d="M9.344 3.071a2.18 2.18 0 011.785-.92h1.744c.66 0 1.258.307 1.636.845l.9 1.286c.26.372.697.587 1.157.587h1.684a2.977 2.977 0 012.977 2.977v8.993a2.977 2.977 0 01-2.977 2.977H5.251a2.977 2.977 0 01-2.977-2.977V7.844a2.977 2.977 0 012.977-2.977h1.684c.46 0 .897-.215 1.157-.587l.9-1.286zM12 7.5a5.25 5.25 0 100 10.5 5.25 5.25 0 000-10.5z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-white">Live Camera</h3>
                <p className="text-[9px] text-zinc-500 mt-1 max-w-[120px] mx-auto leading-relaxed">
                  Snap a fresh photo of your meal now
                </p>
              </GlassCard>

              {/* Gallery Action Card */}
              <GlassCard
                onClick={handleTriggerGallery}
                className="border border-white/10 hover:border-cyan-500/40 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[160px] relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 blur-[40px] rounded-full -z-10" />
                <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-3 glow-cyan">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-xs font-bold text-white">Photo Gallery</h3>
                <p className="text-[9px] text-zinc-500 mt-1 max-w-[120px] mx-auto leading-relaxed">
                  Choose a saved photo from your device library
                </p>
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="p-5 space-y-4 border border-white/10 relative overflow-hidden">
              <div className="absolute top-1/2 right-0 -translate-y-1/2 w-32 h-32 bg-cyan-500/5 blur-[50px] rounded-full -z-10" />
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Log Custom Plate</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                    Meal Name / Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2 Paneer Roti + Curd"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="input-glass text-xs h-11"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Cal (kcal)
                    </label>
                    <input
                      type="number"
                      placeholder="520"
                      value={manualCal}
                      onChange={(e) => setManualCal(e.target.value)}
                      className="input-glass text-xs h-11 px-2"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Prot (g)
                    </label>
                    <input
                      type="number"
                      placeholder="22"
                      value={manualProt}
                      onChange={(e) => setManualProt(e.target.value)}
                      className="input-glass text-xs h-11 px-2"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Carbs (g)
                    </label>
                    <input
                      type="number"
                      placeholder="45"
                      value={manualCarbs}
                      onChange={(e) => setManualCarbs(e.target.value)}
                      className="input-glass text-xs h-11 px-2"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                      Fats (g)
                    </label>
                    <input
                      type="number"
                      placeholder="12"
                      value={manualFats}
                      onChange={(e) => setManualFats(e.target.value)}
                      className="input-glass text-xs h-11 px-2"
                    />
                  </div>
                </div>
              </div>
              <button
                onClick={handleSaveManualMeal}
                className="btn-primary w-full py-3 mt-2 flex items-center justify-center font-bold text-xs"
                disabled={!manualName.trim()}
              >
                Log Meal Event
              </button>
            </GlassCard>
          )}

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
                      <p className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                        P: {h.payload.totalProteinG || 0}g | C: {h.payload.totalCarbsG || h.payload.foods?.reduce((s: number, f: any) => s + (Number(f.carbsG) || 0), 0) || 0}g | F: {h.payload.totalFatG || h.payload.foods?.reduce((s: number, f: any) => s + (Number(f.fatG) || 0), 0) || 0}g
                      </p>
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
            <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center space-y-1">
              <p className="text-xs font-bold text-yellow-400 flex items-center justify-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Demo Result — Not Your Actual Food</p>
              <p className="text-[10px] text-yellow-600 leading-snug">
                Gemini API quota reached (20 req/day on free tier). Resets daily at midnight UTC, or enable billing at{" "}
                <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">console.cloud.google.com</a>
                {" "}for higher limits.
              </p>
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
      {/* Premium Alert/Confirm Toast Popup */}
      <CustomPopup
        isOpen={popupState.isOpen}
        type={popupState.type}
        title={popupState.title}
        message={popupState.message}
        confirmText={popupState.confirmText}
        onConfirm={popupState.onConfirm}
      />
    </div>
  );
}

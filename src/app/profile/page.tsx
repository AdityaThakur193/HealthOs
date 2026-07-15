"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import { 
  User, Calendar, Soup, Sparkles, Upload, Trash2, 
  Settings, AlertTriangle, Clock, ArrowRight, Save, Loader2, Bell
} from "lucide-react";
import { 
  registerServiceWorker, 
  requestNotificationPermission, 
  getNotificationPermission, 
  sendLocalTestNotification 
} from "@/lib/notifications";
import CustomPopup from "@/components/CustomPopup";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function ProfilePage() {
  const router = useRouter();
  
  // Tab control: 'specs' | 'calendar' | 'mess' | 'diet'
  const [activeTab, setActiveTab] = useState<"specs" | "calendar" | "mess" | "diet">("specs");

  const { profile, setProfile, userId, loading: authLoading } = useAuthGuard();
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
  const [strictMessOnly, setStrictMessOnly] = useState(false);
  const [customDietPreferences, setCustomDietPreferences] = useState("");

  // Notification States
  const [notificationPermission, setNotificationPermission] = useState<string>("default");
  const [morningReminders, setMorningReminders] = useState(true);
  const [workoutReminders, setWorkoutReminders] = useState(true);
  const [eveningReminders, setEveningReminders] = useState(true);

  // PWA Install Prompt States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    registerServiceWorker();
    setNotificationPermission(getNotificationPermission());

    // Listen for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Detect iOS and verify display mode
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      setIsInstallable(false);
    } else if (isIosDevice) {
      // iOS doesn't support beforeinstallprompt but is always installable via share menu
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
  };

  const handleInstallApp = async () => {
    if (isIOS) {
      showCustomAlert(
        "Install on iPhone 📲",
        "Tap the Share button (📤) in Safari, then select 'Add to Home Screen' (➕) to install the app on your home screen!",
        "alert"
      );
      return;
    }

    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User installation choice outcome: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const handleSendTestNotification = async () => {
    const userName = profile?.name || "Aditya";
    
    // Zomato/Swiggy-style creative notification copy templates
    const notifications = [
      {
        title: `${userName}, your dumbbells are getting lonely... 🥺🏋️‍♂️`,
        body: "Your gym split is scheduled for today. Don't leave your muscles waiting — hit the gym and crush those targets!",
        image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop"
      },
      {
        title: `Did you log that meal, ${userName}? 📸🥣`,
        body: "Protein check! Missing tracking meals can throw off your macros. Take a quick photo or manually enter it now.",
        image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop"
      },
      {
        title: `${userName}, is that your stomach rumbling? 🚨`,
        body: "Time for your post-workout protein window. Check out what is served at your hostel mess menu today!",
        image: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=600&auto=format&fit=crop"
      }
    ];

    // Pick one at random for a fun, personalized experience!
    const choice = notifications[Math.floor(Math.random() * notifications.length)];

    await sendLocalTestNotification(
      choice.title,
      choice.body,
      "/",
      choice.image
    );
  };

  const { popupState, showCustomAlert, showCustomConfirm } = useConfirmDialog();

  const [neckCm, setNeckCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [useCustomMacros, setUseCustomMacros] = useState(false);

  // Mess Menu States
  const [rawMenuInput, setRawMenuInput] = useState("");
  const [parsedMenu, setParsedMenu] = useState<any>(null);
  const [parsingMenu, setParsingMenu] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [menuActiveDay, setMenuActiveDay] = useState<string>("monday");
  const [showSuccessMenu, setShowSuccessMenu] = useState(false);

  // Diet Plan States
  const [dietPlan, setDietPlan] = useState<any>(null);
  const [generatingDiet, setGeneratingDiet] = useState(false);
  const [dietActiveDay, setDietActiveDay] = useState<string>("monday");

  // Calendar Event Manager States
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<"exam" | "travel" | "sick">("exam");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLoading(false);

    if (profile.messMenu) {
      setRawMenuInput(profile.messMenu.rawText || "");
      setParsedMenu(profile.messMenu.parsedMenu || null);
    }
    if (profile.dietPlan) {
      setDietPlan(profile.dietPlan.generatedPlan || null);
    }

    // Initialize specs form
    setName(profile.name || "");
    setAge(profile.age ? String(profile.age) : "");
    setHeightCm(profile.heightCm ? String(profile.heightCm) : "");
    setWeightKg(profile.weightKg ? String(profile.weightKg) : "");
    setTargetWeightKg(profile.targetWeightKg ? String(profile.targetWeightKg) : "");
    setSleepTarget(profile.sleepTarget ? String(profile.sleepTarget) : "8");
    setGoal(profile.goal || "lose_fat");
    setActivityLevel(profile.activityLevel || "moderate");
    setDietPreference(profile.dietPreference || "none");
    setGymExperience(profile.gymExperience || "beginner");
    setStrictMessOnly(profile.strictMessOnly || false);
    setCollegeSchedule(profile.collegeSchedule || "");
    setNeckCm(profile.neckCm ? String(profile.neckCm) : "");
    setWaistCm(profile.waistCm ? String(profile.waistCm) : "");
    setHipCm(profile.hipCm ? String(profile.hipCm) : "");
    setCustomCalories(profile.customCalories ? String(profile.customCalories) : "");
    setCustomProtein(profile.customProtein ? String(profile.customProtein) : "");
    setUseCustomMacros(profile.useCustomMacros || false);
    setCustomDietPreferences(profile.customDietPreferences || "");
  }, [profile]);

  const renderFoodList = (text: string, isAdditions: boolean = false) => {
    if (!text) {
      return (
        <span className="text-xs text-zinc-500 italic block py-1 text-left">None suggested</span>
      );
    }

    const cleanText = text.trim();
    if (
      cleanText.toLowerCase() === "none" || 
      cleanText.toLowerCase() === "none (strict mess only)" ||
      cleanText.toLowerCase().includes("none (strict mess only)")
    ) {
      return (
        <div className="flex items-center gap-1.5 py-1 text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
          <span className="text-[11px] font-semibold">None (Strict Mess Only)</span>
        </div>
      );
    }

    // Split items by line
    const items = cleanText.split("\n").map(l => l.trim()).filter(l => l.length > 0);

    return (
      <div className="space-y-1.5 py-0.5">
        {items.map((line, idx) => {
          // Clean bullet symbols
          const cleanLine = line.replace(/^[•\-\*\s]+/, "");
          
          // Match Parentheses: Name (Portion - Macros)
          const parenMatch = cleanLine.match(/^([^(]+)\(([^)]+)\)$/);
          if (parenMatch) {
            const name = parenMatch[1].trim();
            const details = parenMatch[2].trim();
            
            // Split details by '-'
            const parts = details.split("-").map(p => p.trim());
            const portion = parts[0] || "";
            const macros = parts[1] || "";

            return (
              <div key={idx} className="flex items-start justify-between py-1 border-b border-white/5 last:border-b-0 last:pb-0 gap-2">
                <div className="text-left min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${isAdditions ? "bg-[#8ba893]" : "bg-[#c87a53]"}`} />
                    <span className="text-[11px] font-semibold text-zinc-100 truncate">{name}</span>
                  </div>
                  {portion && (
                    <span className="text-[9px] text-zinc-500 pl-2.5 block truncate leading-tight">{portion}</span>
                  )}
                </div>
                {macros && (
                  <div className="flex-shrink-0 flex items-center">
                    <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                      isAdditions 
                        ? "bg-[#8ba893]/10 border-[#8ba893]/20 text-[#8ba893]" 
                        : "bg-white/5 border-white/10 text-zinc-300"
                    }`}>
                      {macros}
                    </span>
                  </div>
                )}
              </div>
            );
          }

          // Fallback if formatting doesn't match
          return (
            <div key={idx} className="flex items-start gap-1.5 py-1 text-left border-b border-white/5 last:border-b-0 last:pb-0">
              <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${isAdditions ? "bg-[#8ba893]" : "bg-[#c87a53]"}`} />
              <span className="text-[11px] text-zinc-300 font-medium leading-relaxed">{cleanLine}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const loadCalendarEvents = useCallback(async () => {
    if (!userId) return;
    setLoadingEvents(true);
    try {
      const timelineRes = await fetch(`/api/timeline?userId=${userId}&t=${Date.now()}`, { cache: "no-store" });
      if (timelineRes.ok) {
        const timelineData = await timelineRes.json();
        const notes = (timelineData.events || []).filter((e: any) => e.type === "note");
        setEvents(notes);
      }
    } catch (err) {
      console.error("Failed to load calendar events:", err);
    } finally {
      setLoadingEvents(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadCalendarEvents();
    }
  }, [userId, loadCalendarEvents]);

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
          gender: profile?.gender,
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
          strictMessOnly,
          customDietPreferences,
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

  const handleParseMessMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawMenuInput.trim()) return;

    setParsingMenu(true);
    try {
      const res = await fetch("/api/mess-menu/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawMenuInput }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.parsedMenu) {
          setParsedMenu(data.parsedMenu);
        } else {
          showCustomAlert("Extraction Failed", "Could not extract menu. Please make sure the text contains days and meals.", "warning");
        }
      } else {
        showCustomAlert("Parse Failed", "Failed to parse menu. Please verify server connection.", "error");
      }
    } catch (err) {
      console.error(err);
      showCustomAlert("Connection Error", "Error parsing mess menu.", "error");
    } finally {
      setParsingMenu(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setParsingMenu(true);
      try {
        const res = await fetch("/api/mess-menu/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.parsedMenu) {
            setParsedMenu(data.parsedMenu);
            setRawMenuInput("");
          } else {
            showCustomAlert("Extraction Failed", "Could not extract menu. Try copy-pasting the text menu instead.", "warning");
          }
        } else {
          showCustomAlert("Parse Failed", "Failed to parse menu image. Try copy-pasting the text menu.", "error");
        }
      } catch (err) {
        console.error(err);
        showCustomAlert("Connection Error", "Error parsing menu image.", "error");
      } finally {
        setParsingMenu(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateMealField = (day: string, meal: string, value: string) => {
    setParsedMenu((prev: any) => ({
      ...prev,
      [day]: {
        ...prev?.[day],
        [meal]: value,
      },
    }));
  };

  const handleSaveMessMenu = async () => {
    const email = localStorage.getItem("healthos_email");
    if (!email || !profile) return;

    setSavingMenu(true);
    try {
      const menuPayload = {
        rawText: rawMenuInput,
        parsedMenu: parsedMenu,
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          targetWeightKg: profile.targetWeightKg,
          goal: profile.goal,
          activityLevel: profile.activityLevel,
          gymExperience: profile.gymExperience,
          gymFrequency: profile.gymFrequency,
          gymAccess: profile.gymAccess,
          messAccess: profile.messAccess,
          dietPreference: profile.dietPreference,
          foodAllergies: profile.foodAllergies,
          medicalConditions: profile.medicalConditions,
          sleepTarget: profile.sleepTarget,
          collegeSchedule: profile.collegeSchedule,
          neckCm: profile.neckCm,
          waistCm: profile.waistCm,
          hipCm: profile.hipCm,
          customCalories: profile.customCalories,
          customProtein: profile.customProtein,
          useCustomMacros: profile.useCustomMacros,
          messMenu: menuPayload,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setShowSuccessMenu(true);
        setTimeout(() => setShowSuccessMenu(false), 2000);
      } else {
        showCustomAlert("Save Failed", "Failed to save mess menu.", "error");
      }
    } catch (err) {
      console.error(err);
      showCustomAlert("Connection Error", "Error saving mess menu.", "error");
    } finally {
      setSavingMenu(false);
    }
  };

  const handleGenerateDietPlan = async () => {
    const email = localStorage.getItem("healthos_email");
    if (!email) return;

    setGeneratingDiet(true);
    try {
      const res = await fetch("/api/diet/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email,
          strictMessOnly,
          targetCalories: profile?.targetCalories || 2000,
          targetProteinG: profile?.targetProteinG || 150,
          goal: profile?.goal || "recomp",
          dietPreference: profile?.dietPreference || "none"
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.dietPlan) {
          setDietPlan(data.dietPlan);
          showCustomAlert("Success! 🎉", "AI custom diet plan generated successfully!", "success");
        } else {
          showCustomAlert("Configuration Needed", "Could not generate diet plan. Please check if your mess menu is uploaded.", "warning");
        }
      } else {
        const errData = await res.json();
        showCustomAlert("Generation Failed", errData.error || "Failed to generate diet plan.", "error");
      }
    } catch (err) {
      console.error(err);
      showCustomAlert("Connection Error", "Error generating diet plan.", "error");
    } finally {
      setGeneratingDiet(false);
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

  if (authLoading || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white">
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

      {showSuccessMenu && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-green-500/20 border border-green-500/30 backdrop-blur-xl shadow-lg animate-in">
          <span className="text-sm font-bold text-green-400">✓ Mess menu saved!</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#c87a53]">Pillar 1 & 2</span>
          <h1 className="text-xl font-bold text-white mt-0.5 font-heading">Settings & Mess</h1>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 animate-in">
        <button
          onClick={() => setActiveTab("specs")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "specs" ? "bg-[#8ba893] text-[#0c0f0d] shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <User className="w-3.5 h-3.5" /> Specs
        </button>
        <button
          onClick={() => setActiveTab("calendar")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "calendar" ? "bg-[#8ba893] text-[#0c0f0d] shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Schedule
        </button>
        <button
          onClick={() => setActiveTab("mess")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "mess" ? "bg-[#8ba893] text-[#0c0f0d] shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Soup className="w-3.5 h-3.5" /> Mess Menu
        </button>
        <button
          onClick={() => setActiveTab("diet")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === "diet" ? "bg-[#8ba893] text-[#0c0f0d] shadow-md" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" /> AI Diet
        </button>
      </div>

      {/* Single Question Indicator */}
      <div className="bg-[#8ba893]/5 border border-[#8ba893]/10 rounded-2xl p-4 animate-in-delay-1 text-center">
        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#8ba893] block mb-1">Single Core Question</span>
        <h2 className="text-sm font-semibold text-white">
          {activeTab === "specs" 
            ? '"Who am I today?"' 
            : activeTab === "calendar" 
              ? '"What events affect my plan?"' 
              : activeTab === "mess" 
                ? '"What is the mess serving today?"' 
                : '"What, when, and how should I eat?"'}
        </h2>
      </div>

      {/* Tab 1: Biometric Specs Form */}
      {activeTab === "specs" && (
        <>
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

              <div className="p-3.5 bg-white/2 border border-white/5 rounded-xl flex items-center justify-between">
                <div className="text-left space-y-0.5 pr-2">
                  <span className="font-bold text-zinc-200 block text-xs">Strict Budget / Mess Food Only</span>
                  <span className="text-[9px] text-zinc-500 block leading-normal">
                    AI will not suggest external purchases or expensive supplements (e.g. no whey, paneer, eggs bought outside). Rebuilds plan relying strictly on hostel mess items.
                  </span>
                </div>
                <input
                  type="checkbox"
                  id="strictMessOnlyToggle"
                  checked={strictMessOnly}
                  onChange={(e) => setStrictMessOnly(e.target.checked)}
                  className="w-4 h-4 accent-[#8ba893] cursor-pointer flex-shrink-0"
                />
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Custom Dietary Rules & AI Memory Guidelines</label>
                <textarea
                  value={customDietPreferences}
                  onChange={(e) => setCustomDietPreferences(e.target.value)}
                  placeholder="Enter custom guidelines (e.g. 'No Soya chunks', 'Limit chapatis to 2 per day', 'Only suggest curd or milk instead of eggs'). The AI Diet Planner reads these rules and adapts all future generations accordingly."
                  rows={3}
                  className="input-glass text-xs py-2.5 px-3.5 resize-none h-20"
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

        {/* PWA Web Push Notification Settings */}
        <GlassCard className="p-5 mt-5 border border-white/5 bg-white/2 space-y-4 text-left">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-[#8ba893]" /> Web Push Notification Center
            </h3>
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
              notificationPermission === "granted" 
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-amber-500/10 border border-amber-500/20 text-amber-400"
            }`}>
              {notificationPermission === "granted" ? "Active" : "Disabled"}
            </span>
          </div>

          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Enable native push reminders to keep you updated on mess menu choices, scheduled gym workouts, and bedtime calorie/protein logs even when your browser is closed.
          </p>

          {notificationPermission !== "granted" ? (
            <button
              type="button"
              onClick={handleRequestPermission}
              className="w-full py-2.5 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              🔔 Enable Push Reminders
            </button>
          ) : (
            <div className="space-y-3.5">
              <div className="space-y-2">
                {/* Morning checkin */}
                <div className="flex items-center justify-between p-2.5 bg-zinc-950/30 border border-white/5 rounded-xl">
                  <div className="text-left space-y-0.5 pr-2">
                    <span className="font-bold text-zinc-300 block text-xs">🌅 Morning Nutrition Check (8:00 AM)</span>
                    <span className="text-[9px] text-zinc-500 block leading-normal">
                      Reminds you to check breakfast choices from mess menu and log your sleep duration.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={morningReminders}
                    onChange={(e) => setMorningReminders(e.target.checked)}
                    className="w-4 h-4 accent-[#8ba893] cursor-pointer flex-shrink-0"
                  />
                </div>

                {/* Workout checkin */}
                <div className="flex items-center justify-between p-2.5 bg-zinc-950/30 border border-white/5 rounded-xl">
                  <div className="text-left space-y-0.5 pr-2">
                    <span className="font-bold text-zinc-300 block text-xs">🏋️‍♂️ Workout Accountability Nudge (6:00 PM)</span>
                    <span className="text-[9px] text-zinc-500 block leading-normal">
                      Checks on your scheduled workout status and nudges you to log sets.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={workoutReminders}
                    onChange={(e) => setWorkoutReminders(e.target.checked)}
                    className="w-4 h-4 accent-[#8ba893] cursor-pointer flex-shrink-0"
                  />
                </div>

                {/* Evening checkin */}
                <div className="flex items-center justify-between p-2.5 bg-zinc-950/30 border border-white/5 rounded-xl">
                  <div className="text-left space-y-0.5 pr-2">
                    <span className="font-bold text-zinc-300 block text-xs">🌙 Bedtime Macro Review (10:00 PM)</span>
                    <span className="text-[9px] text-zinc-500 block leading-normal">
                      Reviews remaining water intake and warns you if protein/calories are lagging.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={eveningReminders}
                    onChange={(e) => setEveningReminders(e.target.checked)}
                    className="w-4 h-4 accent-[#8ba893] cursor-pointer flex-shrink-0"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSendTestNotification}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-bold text-xs border border-white/5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                ⚡ Send Test Push Reminder
              </button>
            </div>
          )}
        </GlassCard>

        {/* PWA Home Screen Installation Card */}
        {isInstallable && (
          <GlassCard className="p-5 mt-5 border border-[#8ba893]/20 bg-[#8ba893]/5 space-y-3.5 text-left animate-in duration-300">
            <div className="flex items-center gap-2">
              <span className="text-xl">📲</span>
              <div>
                <h3 className="text-xs font-bold text-white">Add Health OS to Home Screen</h3>
                <p className="text-[9px] text-[#8ba893] font-bold uppercase tracking-wider">Fast Standalone Access</p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 leading-relaxed">
              Install this app directly on your device's home screen. Enjoy full-screen standalone view, offline tracking support, and direct access from your app library.
            </p>
            <button
              type="button"
              onClick={handleInstallApp}
              className="w-full py-2.5 rounded-xl bg-gradient-to-tr from-[#8ba893] to-[#9cbda5] text-[#0c0f0d] font-bold text-xs shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              📥 {isIOS ? "Show iOS Install Guide" : "Install Health OS App"}
            </button>
          </GlassCard>
        )}
      </>
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

      {/* Tab 3: Hostel Mess Menu Parser */}
      {activeTab === "mess" && (
        <div className="space-y-5 animate-in-delay-1">
          {/* Paste Menu Card */}
          <GlassCard className="p-5 space-y-4 border border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#8ba893]/5 blur-[50px] rounded-full -z-10" />
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center justify-between">
              <span>Hostel Mess Menu Upload</span>
              <span className="text-[9px] text-zinc-500 font-mono">Pillar 2</span>
            </h3>

            <div className="space-y-4">
              <div className="text-zinc-400 text-xs leading-relaxed space-y-1.5 bg-white/2 p-3.5 rounded-xl border border-white/5">
                <p className="font-semibold text-white flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[#8ba893]" /> Mess-Diet Auto-Calibration</p>
                <p className="text-[10px] text-zinc-500">Provide your mess menu below. Our AI Daily Coach will automatically study the dishes served and suggest custom protein additions or adjustments so you never miss your targets.</p>
              </div>

              {/* Image upload block */}
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Option A: Upload Menu Photo</label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer hover:bg-white/2 border-white/10 hover:border-[#8ba893]/40 transition-all bg-zinc-950/30">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-6 h-6 text-zinc-500 mb-2" />
                      <p className="text-[10px] text-zinc-500 font-bold">Upload screenshot or photo (JPG/PNG)</p>
                      <p className="text-[8px] text-zinc-600 mt-1 font-mono">Or paste text menu below</p>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Text area paste block */}
              <form onSubmit={handleParseMessMenu} className="space-y-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">Option B: Paste Menu Text</label>
                  <textarea
                    rows={4}
                    value={rawMenuInput}
                    onChange={(e) => setRawMenuInput(e.target.value)}
                    placeholder="e.g.&#10;Monday Lunch: Rajma Chawal, Roti, Curd&#10;Monday Dinner: Mix Veg, Dal Fry, Roti&#10;Tuesday Lunch: Kadhi Chawal, Sabzi..."
                    className="input-glass text-xs p-3 font-mono leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={parsingMenu || !rawMenuInput.trim()}
                  className="w-full py-3 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {parsingMenu ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Structuring Menu...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> AI Parse pasted Menu
                    </>
                  )}
                </button>
              </form>
            </div>
          </GlassCard>

          {/* Parsed / Editor Panel */}
          {parsedMenu && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Active Mess Calendar</h3>
                <button
                  onClick={handleSaveMessMenu}
                  disabled={savingMenu}
                  className="px-4 py-1.5 rounded-lg bg-[#c87a53] hover:bg-[#c87a53]/90 text-white text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> {savingMenu ? "Saving..." : "Save Menu"}
                </button>
              </div>

              {/* Day Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin">
                {Object.keys(parsedMenu).map((day) => (
                  <button
                    key={day}
                    onClick={() => setMenuActiveDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex-shrink-0 cursor-pointer transition-all ${
                      menuActiveDay === day
                        ? "bg-[#8ba893] text-[#0c0f0d]"
                        : "bg-white/5 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {day.substring(0, 3)}
                  </button>
                ))}
              </div>

              {/* Editor Fields */}
              <GlassCard className="p-5 space-y-4.5 border border-white/5 bg-white/2 relative">
                <div className="space-y-4.5">
                  {/* Breakfast Sub-card */}
                  <div className="p-4.5 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 focus-within:border-[#8ba893]/30 hover:border-white/10 transition-all duration-300">
                    <label className="text-[10px] text-[#c87a53] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <span>🌅</span> Breakfast Menu
                    </label>
                    <textarea
                      rows={3}
                      value={parsedMenu[menuActiveDay]?.breakfast || ""}
                      onChange={(e) => updateMealField(menuActiveDay, "breakfast", e.target.value)}
                      placeholder="Enter breakfast items (e.g. Milk Bread, Corn Flakes, Idly)..."
                      className="w-full bg-transparent border-0 p-0 text-xs text-white placeholder-zinc-600 focus:ring-0 focus:outline-none resize-none min-h-[70px] leading-relaxed font-sans"
                    />
                  </div>

                  {/* Lunch Sub-card */}
                  <div className="p-4.5 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 focus-within:border-[#8ba893]/30 hover:border-white/10 transition-all duration-300">
                    <label className="text-[10px] text-[#8ba893] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <span>☀️</span> Lunch Menu
                    </label>
                    <textarea
                      rows={3}
                      value={parsedMenu[menuActiveDay]?.lunch || ""}
                      onChange={(e) => updateMealField(menuActiveDay, "lunch", e.target.value)}
                      placeholder="Enter lunch items (e.g. Plain Curd, Rajma Masala, Chapati)..."
                      className="w-full bg-transparent border-0 p-0 text-xs text-white placeholder-zinc-600 focus:ring-0 focus:outline-none resize-none min-h-[70px] leading-relaxed font-sans"
                    />
                  </div>

                  {/* Snacks Sub-card */}
                  <div className="p-4.5 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 focus-within:border-[#8ba893]/30 hover:border-white/10 transition-all duration-300">
                    <label className="text-[10px] text-[#c87a53] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <span>☕</span> Snacks Menu
                    </label>
                    <textarea
                      rows={3}
                      value={parsedMenu[menuActiveDay]?.snacks || ""}
                      onChange={(e) => updateMealField(menuActiveDay, "snacks", e.target.value)}
                      placeholder="Enter snacks items (e.g. Bread, Bournvita, Biscuits)..."
                      className="w-full bg-transparent border-0 p-0 text-xs text-white placeholder-zinc-600 focus:ring-0 focus:outline-none resize-none min-h-[70px] leading-relaxed font-sans"
                    />
                  </div>

                  {/* Dinner Sub-card */}
                  <div className="p-4.5 bg-zinc-950/40 border border-white/5 rounded-xl space-y-2 focus-within:border-[#8ba893]/30 hover:border-white/10 transition-all duration-300">
                    <label className="text-[10px] text-[#8ba893] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <span>🌙</span> Dinner Menu
                    </label>
                    <textarea
                      rows={3}
                      value={parsedMenu[menuActiveDay]?.dinner || ""}
                      onChange={(e) => updateMealField(menuActiveDay, "dinner", e.target.value)}
                      placeholder="Enter dinner items (e.g. Egg Curry, Chapati, Dal Tadka)..."
                      className="w-full bg-transparent border-0 p-0 text-xs text-white placeholder-zinc-600 focus:ring-0 focus:outline-none resize-none min-h-[70px] leading-relaxed font-sans"
                    />
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: AI Custom Diet Planner */}
      {activeTab === "diet" && (
        <div className="space-y-5 animate-in-delay-1">
          {!parsedMenu ? (
            <GlassCard className="p-6 text-center space-y-4 border border-red-500/10 bg-red-950/5">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-white">Hostel Mess Menu Required</h3>
                <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
                  Before we can construct your custom diet plan, we need your hostel's mess menu. Please go to the **Mess Menu** tab first to paste or upload it.
                </p>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-5">
              {/* Generator Card */}
              <GlassCard className="p-5 space-y-4 border border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#8ba893]/5 blur-[50px] rounded-full -z-10" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2 flex items-center justify-between">
                  <span>Custom AI Diet Configurator</span>
                  <span className="text-[9px] text-[#c87a53] font-mono">Pillar 2 & 4</span>
                </h3>

                <div className="text-zinc-400 text-xs leading-relaxed space-y-2 bg-white/2 p-3.5 rounded-xl border border-white/5">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#8ba893]" /> Sports-Science Diet Calibration
                  </p>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    This engine designs a tailored diet chart combining your biometric stats, target macros, and college schedule with what is actually served in your hostel.
                  </p>
                  <ul className="text-[9px] text-zinc-500 list-disc pl-4 space-y-0.5">
                    <li>Protein spaced into 4-5 meals (~{Math.round((profile?.targetProteinG || 150) / 4.5)}g per sitting) to optimize protein synthesis.</li>
                    <li>Complex carbohydrates positioned pre-workout to maximize muscle glycogen.</li>
                    <li>Low-fat windows around training to accelerate digestion and performance.</li>
                  </ul>
                </div>

                <button
                  onClick={handleGenerateDietPlan}
                  disabled={generatingDiet}
                  className="w-full py-3 rounded-xl bg-[#8ba893] hover:bg-[#8ba893]/90 text-[#0c0f0d] text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {generatingDiet ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Generating Diet Chart...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> {dietPlan ? "Regenerate AI Diet Plan" : "Generate Custom AI Diet Plan"}
                    </>
                  )}
                </button>
              </GlassCard>

              {/* Diet Plan Timeline */}
              {dietPlan && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-2">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8ba893]" /> Your Weekly Diet Schedule
                    </h3>
                  </div>

                  {/* Day tabs */}
                  <div className="flex gap-1 overflow-x-auto pb-1.5 scrollbar-thin">
                    {Object.keys(dietPlan).map((day) => (
                      <button
                        key={day}
                        onClick={() => setDietActiveDay(day)}
                        className={`px-3.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider flex-shrink-0 cursor-pointer transition-all ${
                          dietActiveDay === day
                            ? "bg-[#8ba893] text-[#0c0f0d] shadow-sm"
                            : "bg-white/5 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>

                  {/* Daily Totals Summary */}
                  {dietPlan && dietPlan[dietActiveDay] && dietPlan[dietActiveDay].meals && dietPlan[dietActiveDay].meals.length > 0 && (
                    (() => {
                      const meals = dietPlan[dietActiveDay].meals;
                      const plannedCal = meals.reduce((sum: number, m: any) => sum + (Number(m.calories) || 0), 0);
                      const plannedProt = meals.reduce((sum: number, m: any) => sum + (Number(m.proteinG) || 0), 0);
                      const targetCal = profile?.targetCalories || 2000;
                      const targetProt = profile?.targetProteinG || 150;
                      const calPercent = Math.min(100, Math.round((plannedCal / targetCal) * 100));
                      const protPercent = Math.min(100, Math.round((plannedProt / targetProt) * 100));
                      
                      const calMatch = Math.abs(plannedCal - targetCal) <= 50;
                      const protMatch = Math.abs(plannedProt - targetProt) <= 5;
                      const isPerfectFit = calMatch && protMatch;

                      return (
                        <GlassCard className="p-4 border border-[#8ba893]/20 bg-[#8ba893]/5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              Daily Planned Totals
                            </h4>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                              isPerfectFit 
                                ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                                : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                            }`}>
                              {isPerfectFit ? "🎯 Perfect Fit" : "⚠️ Needs Recalibration"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            {/* Calories Tracker */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase">Calories</span>
                                <span className="text-xs font-mono font-bold text-white">
                                  {plannedCal} <span className="text-[9px] text-zinc-500">/ {targetCal} kcal</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#8ba893] to-green-400 transition-all duration-500"
                                  style={{ width: `${calPercent}%` }}
                                />
                              </div>
                            </div>

                            {/* Protein Tracker */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-baseline">
                                <span className="text-[9px] text-zinc-500 font-bold uppercase">Protein</span>
                                <span className="text-xs font-mono font-bold text-white">
                                  {plannedProt}g <span className="text-[9px] text-zinc-500">/ {targetProt}g</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#c87a53] to-orange-400 transition-all duration-500"
                                  style={{ width: `${protPercent}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </GlassCard>
                      );
                    })()
                  )}

                  {/* Meals list */}
                  <div className="space-y-3">
                    {(!dietPlan[dietActiveDay] || !dietPlan[dietActiveDay].meals || dietPlan[dietActiveDay].meals.length === 0) ? (
                      <p className="text-xs text-zinc-500 italic text-center py-4 bg-white/2 border border-white/5 rounded-2xl">
                        No meals configured for this day. Regenerate to populate.
                      </p>
                    ) : (
                      dietPlan[dietActiveDay].meals.map((meal: any, idx: number) => (
                        <GlassCard key={idx} className="p-4 border border-white/5 bg-white/1 relative overflow-hidden flex flex-col gap-2.5">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-[#c87a53]/2 blur-[30px] rounded-full -z-10" />
                          
                          {/* Meal Header */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-[#c87a53] px-2 py-0.5 rounded bg-[#c87a53]/10 border border-[#c87a53]/20">
                                {meal.name}
                              </span>
                              <span className="text-[10px] text-zinc-400 font-bold font-mono flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-zinc-500" /> {meal.time}
                              </span>
                            </div>
                            
                            {/* Macros Badge */}
                            <div className="flex items-center gap-2 text-[10px] font-bold font-mono">
                              <span className="text-[#8ba893]">{meal.proteinG}g P</span>
                              <span className="text-zinc-500">•</span>
                              <span className="text-zinc-300">{meal.calories} kcal</span>
                            </div>
                          </div>

                          {/* Meal Choices */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            {/* Mess Items Choice */}
                            <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/5">
                              <span className="text-[8.5px] font-extrabold text-zinc-500 uppercase tracking-widest block mb-2 text-left">🥣 From Hostel Mess</span>
                              {renderFoodList(meal.messItems)}
                            </div>

                            {/* Required Additions */}
                            <div className="p-3 bg-[#8ba893]/3 rounded-xl border border-[#8ba893]/10">
                              <span className="text-[8.5px] font-extrabold text-[#8ba893] uppercase tracking-widest block mb-2 text-left">➕ Custom Additions / Supplements</span>
                              {renderFoodList(meal.additions, true)}
                            </div>
                          </div>

                          {/* Coach Timing Reason */}
                          {meal.timingReason && (
                            <div className="text-[10px] text-zinc-400 bg-white/2 p-2.5 rounded-lg border-l border-[#c87a53]/60 italic leading-relaxed">
                              &ldquo;{meal.timingReason}&rdquo;
                            </div>
                          )}
                        </GlassCard>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
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

"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ChipSelect from "@/components/ChipSelect";
import StepIndicator from "@/components/StepIndicator";
import { Flame, Dumbbell, Zap, Scale, Heart } from "lucide-react";

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [age, setAge] = useState(21);
  const [heightCm, setHeightCm] = useState(175);
  const [weightKg, setWeightKg] = useState(70);
  const [targetWeightKg, setTargetWeightKg] = useState(65);
  const [goal, setGoal] = useState<"lose_fat" | "build_muscle" | "maintain" | "recomp" | "general_health">("lose_fat");
  const [activityLevel, setActivityLevel] = useState<"sedentary" | "light" | "moderate" | "active" | "very_active">("moderate");
  const [gymExperience, setGymExperience] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [gymFrequency, setGymFrequency] = useState(4); // days/week
  
  const [gymAccess, setGymAccess] = useState("college_gym"); // college_gym, commercial, home
  const [messAccess, setMessAccess] = useState("hostel_mess"); // hostel_mess, home_cooked, tiffin, dining_out
  
  const [dietPreference, setDietPreference] = useState<"none" | "vegetarian" | "vegan" | "eggetarian" | "non_veg">("none");
  const [foodAllergies, setFoodAllergies] = useState<string[]>([]);
  const [medicalConditions, setMedicalConditions] = useState<string[]>([]);
  const [sleepTarget, setSleepTarget] = useState(8);
  const [collegeSchedule, setCollegeSchedule] = useState("");

  const [allergyInput, setAllergyInput] = useState("");
  const [conditionInput, setConditionInput] = useState("");
  const [hasManuallyAdjustedTarget, setHasManuallyAdjustedTarget] = useState(false);
  const [neckCm, setNeckCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [hipCm, setHipCm] = useState("");
  const [customCalories, setCustomCalories] = useState("");
  const [customProtein, setCustomProtein] = useState("");
  const [useCustomMacros, setUseCustomMacros] = useState(false);

  // Auto-calculate suggested ideal target weight when height changes (guilt-free, effort-reducing)
  useEffect(() => {
    if (!hasManuallyAdjustedTarget && heightCm > 100) {
      const ideal = Math.round(22 * (heightCm / 100) * (heightCm / 100));
      setTargetWeightKg(ideal);
    }
  }, [heightCm, hasManuallyAdjustedTarget]);

  // Load existing profile if any
  useEffect(() => {
    async function loadProfile() {
      const targetEmail = emailParam || localStorage.getItem("healthos_email");
      if (!targetEmail) return;

      try {
        const res = await fetch(`/api/profile?email=${encodeURIComponent(targetEmail)}`);
        const data = await res.json();
        if (data.profile) {
          const p = data.profile;
          setName(p.name || "");
          setEmail(p.email || "");
          setGender(p.gender || "male");
          setAge(p.age || 21);
          setHeightCm(p.heightCm || 175);
          setWeightKg(p.weightKg || 70);
          setTargetWeightKg(p.targetWeightKg || 65);
          if (p.targetWeightKg) setHasManuallyAdjustedTarget(true);
          setGoal(p.goal || "lose_fat");
          setActivityLevel(p.activityLevel || "moderate");
          setGymExperience(p.gymExperience || "beginner");
          setGymFrequency(p.gymFrequency || 4);
          setGymAccess(p.gymAccess || "college_gym");
          setMessAccess(p.messAccess || "hostel_mess");
          setDietPreference(p.dietPreference || "none");
          setFoodAllergies(p.foodAllergies || []);
          setMedicalConditions(p.medicalConditions || []);
          setSleepTarget(p.sleepTarget || 8);
          setCollegeSchedule(p.collegeSchedule || "");
          setNeckCm(p.neckCm ? String(p.neckCm) : "");
          setWaistCm(p.waistCm ? String(p.waistCm) : "");
          setHipCm(p.hipCm ? String(p.hipCm) : "");
          setCustomCalories(p.customCalories ? String(p.customCalories) : "");
          setCustomProtein(p.customProtein ? String(p.customProtein) : "");
          setUseCustomMacros(p.useCustomMacros || false);
        } else if (emailParam) {
          setEmail(emailParam);
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    }
    loadProfile();
  }, [emailParam]);

  const totalSteps = 6;

  const nextStep = () => {
    if (step === 0) {
      if (!name || !email) {
        setError("Please fill in your name and email.");
        return;
      }
      if (!age || age <= 0 || age > 120) {
        setError("Please enter a valid age between 1 and 120.");
        return;
      }
    }
    if (step === 1) {
      if (!heightCm || heightCm <= 50 || heightCm > 250) {
        setError("Please enter a valid height between 50 and 250 cm.");
        return;
      }
      if (!weightKg || weightKg <= 20 || weightKg > 300) {
        setError("Please enter a valid weight between 20 and 300 kg.");
        return;
      }
      if (!targetWeightKg || targetWeightKg <= 20 || targetWeightKg > 300) {
        setError("Please enter a valid target weight between 20 and 300 kg.");
        return;
      }
    }
    setError("");
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    setError("");
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          gender,
          age,
          heightCm,
          weightKg,
          targetWeightKg,
          goal,
          activityLevel,
          gymExperience,
          gymFrequency,
          gymAccess,
          messAccess,
          dietPreference,
          foodAllergies,
          medicalConditions,
          sleepTarget,
          collegeSchedule,
          neckCm: neckCm ? parseFloat(neckCm) : undefined,
          waistCm: waistCm ? parseFloat(waistCm) : undefined,
          hipCm: hipCm ? parseFloat(hipCm) : undefined,
          customCalories: useCustomMacros && customCalories ? parseInt(customCalories) : undefined,
          customProtein: useCustomMacros && customProtein ? parseInt(customProtein) : undefined,
          useCustomMacros,
        }),
      });

      const data = await res.json();

      if (res.ok && data.profile) {
        localStorage.setItem("healthos_userId", data.profile._id);
        localStorage.setItem("healthos_email", data.profile.email.toLowerCase());
        router.push("/");
      } else {
        setError(data.error || "Something went wrong saving your profile.");
      }
    } catch (err) {
      setError("Failed to connect to the server.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper calculations for review step (using Katch-McArdle if body fat measurements are provided)
  const getBodyFatForBmr = () => {
    const neck = parseFloat(neckCm);
    const waist = parseFloat(waistCm);
    const height = heightCm;
    if (isNaN(neck) || isNaN(waist) || height <= 0 || waist <= neck) return null;
    
    if (gender === "male") {
      const waistIn = waist / 2.54;
      const neckIn = neck / 2.54;
      const heightIn = height / 2.54;
      if (waistIn <= neckIn) return null;
      return 86.010 * Math.log10(waistIn - neckIn) - 70.041 * Math.log10(heightIn) + 36.76;
    } else {
      const hip = parseFloat(hipCm);
      if (isNaN(hip)) return null;
      const waistIn = waist / 2.54;
      const hipIn = hip / 2.54;
      const neckIn = neck / 2.54;
      const heightIn = height / 2.54;
      if ((waistIn + hipIn) <= neckIn) return null;
      return 163.205 * Math.log10(waistIn + hipIn - neckIn) - 97.684 * Math.log10(heightIn) - 78.387;
    }
  };

  const bfPct = getBodyFatForBmr();
  const calculatedBmr = bfPct !== null && bfPct > 0
    ? 370 + 21.6 * (weightKg * (1 - bfPct / 100))
    : 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : gender === "female" ? -161 : -80);

  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const calculatedTdee = Math.round(calculatedBmr * multipliers[activityLevel]);
  
  const standardCalGoal = Math.round(goal === "lose_fat" ? calculatedTdee - 500 : goal === "build_muscle" ? calculatedTdee + 300 : goal === "recomp" ? calculatedTdee - 100 : calculatedTdee);
  const calGoal = useCustomMacros && customCalories ? parseInt(customCalories) : standardCalGoal;
  
  // Calculate reference weight based on body composition (BMI rules)
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const referenceWeight = bmi > 25 ? (targetWeightKg || Math.round(22 * heightM * heightM)) : weightKg;
  
  const standardProteinGoal = Math.round(referenceWeight * (goal === "lose_fat" ? 2.2 : goal === "build_muscle" ? 1.8 : goal === "recomp" ? 2.3 : 2.0));
  const proteinGoal = useCustomMacros && customProtein ? parseInt(customProtein) : standardProteinGoal;

  return (
    <div className="page-container flex flex-col justify-between min-h-dvh pb-10">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <div>
          <span className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">Health OS Setup</span>
          <h1 className="text-xl font-bold text-white mt-0.5">Let's build your model</h1>
        </div>
        <StepIndicator total={totalSteps} current={step} />
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl mb-4 animate-in">
          {error}
        </div>
      )}

      {/* Main wizard forms */}
      <div className="flex-1 flex flex-col justify-center my-6">
        {step === 0 && (
          <div className="space-y-5 animate-in">
            <h2 className="text-base font-semibold text-white">Who are we coaching?</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">Full Name</label>
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">Email Address</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-2 block">Gender Identification</label>
                <ChipSelect
                  options={[
                    { value: "male", label: "Male", emoji: "♂️" },
                    { value: "female", label: "Female", emoji: "♀️" },
                    { value: "other", label: "Non-binary", emoji: "✨" },
                  ]}
                  value={gender}
                  onChange={(v) => setGender(v as "male" | "female" | "other")}
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5 animate-in">
            <h2 className="text-base font-semibold text-white">Physical details</h2>
            <div className="space-y-6">
              {/* Age slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs text-zinc-500 font-semibold">Age</label>
                  <span className="text-brand-400 font-bold text-lg">{age} yrs</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="60"
                  value={age}
                  onChange={(e) => setAge(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Height slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs text-zinc-500 font-semibold">Height</label>
                  <span className="text-brand-400 font-bold text-lg">{heightCm} cm</span>
                </div>
                <input
                  type="range"
                  min="130"
                  max="220"
                  value={heightCm}
                  onChange={(e) => setHeightCm(parseInt(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Current Weight slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs text-zinc-500 font-semibold">Current Weight</label>
                  <span className="text-brand-400 font-bold text-lg">{weightKg} kg</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  step="0.5"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>

              {/* Target Weight slider */}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <label className="text-xs text-zinc-500 font-semibold">Target weight Goal</label>
                  <span className="text-cyan-400 font-bold text-lg">{targetWeightKg} kg</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  step="0.5"
                  value={targetWeightKg}
                  onChange={(e) => {
                    setTargetWeightKg(parseFloat(e.target.value));
                    setHasManuallyAdjustedTarget(true);
                  }}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />

                {heightCm > 100 && (
                  <div className="space-y-2 mt-3">
                    <div className="p-3 rounded-xl bg-white/2 border border-white/5 flex items-center justify-between text-left">
                      <div className="space-y-0.5">
                        <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold block">Starting Estimate</span>
                        <span className="text-[10px] text-zinc-400 block leading-tight">
                          Healthy Range: <strong>{Math.round(18.5 * (heightCm / 100) * (heightCm / 100))} - {Math.round(24.9 * (heightCm / 100) * (heightCm / 100))} kg</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setTargetWeightKg(Math.round(22 * (heightCm / 100) * (heightCm / 100)));
                          setHasManuallyAdjustedTarget(true);
                        }}
                        className="px-2.5 py-1 bg-cyan-950/40 hover:bg-cyan-950/60 border border-cyan-800/30 rounded-lg text-[9px] font-extrabold text-cyan-400 transition-all uppercase tracking-wider"
                      >
                        Use Baseline ({Math.round(22 * (heightCm / 100) * (heightCm / 100))}kg)
                      </button>
                    </div>
                    <p className="text-[9px] text-zinc-600 leading-tight">
                      ⚠️ Note: Every body is unique. This standard BMI baseline (22.0) does not account for muscle mass or bone density. Health OS will adapt this as you log workouts and actual weight trends.
                    </p>
                  </div>
                )}
              </div>

              {/* Optional Body Measurements (Navy Body Fat Method) */}
              <div className="border-t border-white/5 pt-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white mb-0.5">Body Measurements (Optional)</h3>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Add measurements to estimate body fat % and calculate a highly personalized calorie/protein baseline (Katch-McArdle).
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-semibold mb-1 block">Neck Circumference (cm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 38"
                      value={neckCm}
                      onChange={(e) => setNeckCm(e.target.value)}
                      className="input-glass text-xs py-2 px-3"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-semibold mb-1 block">Waist Circumference (cm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 92"
                      value={waistCm}
                      onChange={(e) => setWaistCm(e.target.value)}
                      className="input-glass text-xs py-2 px-3"
                    />
                  </div>
                </div>

                {(gender === "female" || gender === "other") && (
                  <div>
                    <label className="text-[10px] text-zinc-500 font-semibold mb-1 block">Hip Circumference (cm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 104"
                      value={hipCm}
                      onChange={(e) => setHipCm(e.target.value)}
                      className="input-glass text-xs py-2 px-3"
                    />
                  </div>
                )}

                {bfPct !== null && (
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/10 text-cyan-400 text-[10px] leading-relaxed flex items-center justify-between">
                    <div>
                      <span>Estimated Body Fat: <strong>{bfPct}%</strong></span>
                      <span className="block text-[9px] text-cyan-500 mt-0.5">
                        Lean Body Mass: <strong>{Math.round(weightKg * (1 - bfPct / 100))} kg</strong>
                      </span>
                    </div>
                    <span className="badge-info text-[9px]">Katch-McArdle BMR Active</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in">
            <h2 className="text-base font-bold text-white font-heading">What is your primary focus?</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: "lose_fat", label: "Lose Fat", desc: "Sustainable caloric deficit focused on maintaining muscle", icon: <Flame className="w-6 h-6 text-[#c87a53]" /> },
                { value: "build_muscle", label: "Build Muscle", desc: "Controlled caloric surplus optimized for hypertrophy", icon: <Dumbbell className="w-6 h-6 text-[#8ba893]" /> },
                { value: "recomp", label: "Body Recomposition", desc: "Gain muscle and lose fat simultaneously", icon: <Zap className="w-6 h-6 text-[#c87a53]" /> },
                { value: "maintain", label: "Maintain Weight", desc: "Stabilize weight and focus purely on recovery & energy", icon: <Scale className="w-6 h-6 text-[#8ba893]" /> },
                { value: "general_health", label: "General Health", desc: "Overall cardiovascular and metabolic fitness", icon: <Heart className="w-6 h-6 text-red-400" /> },
              ].map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setGoal(opt.value as any)}
                  className={`p-4 border text-left transition-all rounded-tl-2xl rounded-br-2xl cursor-pointer ${
                    goal === opt.value
                      ? "border-[#8ba893] bg-[#8ba893]/5 glow-green"
                      : "border-white/5 bg-white/2 hover:border-[#8ba893]/20"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex-shrink-0">{opt.icon}</div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{opt.label}</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 animate-in">
            <h2 className="text-base font-semibold text-white">Lifestyle & experience</h2>
            <div className="space-y-5">
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-2 block">Daily Activity Level</label>
                <ChipSelect
                  options={[
                    { value: "sedentary", label: "Deskbound (Sedentary)", emoji: "🪑" },
                    { value: "light", label: "Light Activity", emoji: "🚶" },
                    { value: "moderate", label: "Moderately Active", emoji: "🏃" },
                    { value: "active", label: "Highly Active", emoji: "🚴" },
                    { value: "very_active", label: "Athlete/Hard Labor", emoji: "🏋️" },
                  ]}
                  value={activityLevel}
                  onChange={(v) => setActivityLevel(v as any)}
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-2 block">Gym Weightlifting Experience</label>
                <ChipSelect
                  options={[
                    { value: "beginner", label: "Beginner (< 1 yr)", emoji: "🥚" },
                    { value: "intermediate", label: "Intermediate (1-3 yrs)", emoji: "🐣" },
                    { value: "advanced", label: "Advanced (3+ yrs)", emoji: "🦅" },
                  ]}
                  value={gymExperience}
                  onChange={(v) => setGymExperience(v as any)}
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">Weekly Training Frequency Goal</label>
                <div className="flex gap-2">
                  {[3, 4, 5, 6].map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setGymFrequency(freq)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                        gymFrequency === freq ? "chip-active" : "chip"
                      }`}
                    >
                      {freq} Days
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5 animate-in">
            <h2 className="text-base font-semibold text-white">Dietary & Environments Context</h2>
            <div className="space-y-5">
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-2 block">Diet Type</label>
                <ChipSelect
                  options={[
                    { value: "none", label: "Anything", emoji: "🍔" },
                    { value: "non_veg", label: "Non-Veg Only", emoji: "🍗" },
                    { value: "vegetarian", label: "Vegetarian", emoji: "🥗" },
                    { value: "eggetarian", label: "Eggitarian", emoji: "🍳" },
                    { value: "vegan", label: "Vegan", emoji: "🥦" },
                  ]}
                  value={dietPreference}
                  onChange={(v) => setDietPreference(v as any)}
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-2 block">Dining Context (Mess Access)</label>
                <ChipSelect
                  options={[
                    { value: "hostel_mess", label: "Hostel Mess Food", emoji: "🏢" },
                    { value: "home_cooked", label: "Home Cooked Meals", emoji: "🏠" },
                    { value: "tiffin", label: "Tiffin Service", emoji: "🍱" },
                    { value: "dining_out", label: "Eating Out / Restaurant", emoji: "🍕" },
                  ]}
                  value={messAccess}
                  onChange={(v) => setMessAccess(v as string)}
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-2 block">Workout Location (Gym Access)</label>
                <ChipSelect
                  options={[
                    { value: "college_gym", label: "College Gym", emoji: "🏫" },
                    { value: "commercial", label: "Commercial Gym", emoji: "🏬" },
                    { value: "home", label: "Home Gym / Bodyweight", emoji: "🏠" },
                  ]}
                  value={gymAccess}
                  onChange={(v) => setGymAccess(v as string)}
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">Daily Sleep Goal</label>
                <div className="flex gap-2">
                  {[6, 7, 8, 9].map((hr) => (
                    <button
                      key={hr}
                      type="button"
                      onClick={() => setSleepTarget(hr)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold ${
                        sleepTarget === hr ? "chip-active" : "chip"
                      }`}
                    >
                      {hr} Hours
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">College Class Timings Schedule</label>
                <input
                  type="text"
                  placeholder="e.g. 8 AM - 4 PM Classes"
                  value={collegeSchedule}
                  onChange={(e) => setCollegeSchedule(e.target.value)}
                  className="input-glass"
                />
              </div>

              {/* Custom Food Allergies Tag List */}
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">Food Allergies</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Peanuts, Gluten"
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && allergyInput.trim()) {
                        e.preventDefault();
                        if (!foodAllergies.includes(allergyInput.trim())) {
                          setFoodAllergies([...foodAllergies, allergyInput.trim()]);
                        }
                        setAllergyInput("");
                      }
                    }}
                    className="input-glass flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (allergyInput.trim() && !foodAllergies.includes(allergyInput.trim())) {
                        setFoodAllergies([...foodAllergies, allergyInput.trim()]);
                        setAllergyInput("");
                      }
                    }}
                    className="btn-primary py-2 px-4 rounded-xl text-xs"
                  >
                    Add
                  </button>
                </div>
                {foodAllergies.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {foodAllergies.map((allergy) => (
                      <span
                        key={allergy}
                        onClick={() => setFoodAllergies(foodAllergies.filter((a) => a !== allergy))}
                        className="badge-warning cursor-pointer hover:bg-amber-500/20 transition-all text-[10px]"
                      >
                        {allergy} <span className="text-amber-600 font-bold ml-1">×</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Medical Conditions Tag List */}
              <div>
                <label className="text-xs text-zinc-500 font-semibold mb-1 block">Injuries / Medical Conditions</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Shoulder Pain, Asthma"
                    value={conditionInput}
                    onChange={(e) => setConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && conditionInput.trim()) {
                        e.preventDefault();
                        if (!medicalConditions.includes(conditionInput.trim())) {
                          setMedicalConditions([...medicalConditions, conditionInput.trim()]);
                        }
                        setConditionInput("");
                      }
                    }}
                    className="input-glass flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (conditionInput.trim() && !medicalConditions.includes(conditionInput.trim())) {
                        setMedicalConditions([...medicalConditions, conditionInput.trim()]);
                        setConditionInput("");
                      }
                    }}
                    className="btn-primary py-2 px-4 rounded-xl text-xs"
                  >
                    Add
                  </button>
                </div>
                {medicalConditions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {medicalConditions.map((cond) => (
                      <span
                        key={cond}
                        onClick={() => setMedicalConditions(medicalConditions.filter((c) => c !== cond))}
                        className="badge-info cursor-pointer hover:bg-cyan-500/20 transition-all text-[10px]"
                      >
                        {cond} <span className="text-cyan-600 font-bold ml-1">×</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in">
            <div className="text-center">
              <h2 className="text-lg font-extrabold text-white">Your digital twin is ready</h2>
              <p className="text-xs text-zinc-500 mt-1">Health OS calculated targets based on your bio-metrics</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <GlassCard className="p-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Daily Budget</p>
                <h3 className="text-2xl font-black text-brand-400 mt-1">{calGoal}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">kcal / day</p>
              </GlassCard>

              <GlassCard className="p-4 text-center">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Protein Target</p>
                <h3 className="text-2xl font-black text-cyan-400 mt-1">{proteinGoal}g</h3>
                <p className="text-xs text-zinc-400 mt-0.5">protein / day</p>
              </GlassCard>
            </div>

            <GlassCard className="p-4 space-y-2.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Current Weight:</span>
                <span className="font-semibold text-white">{weightKg} kg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Goal Target Weight:</span>
                <span className="font-semibold text-cyan-400">{targetWeightKg} kg</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Estimated Expenditure (TDEE):</span>
                <span className="font-semibold text-white">{calculatedTdee} kcal</span>
              </div>
              <div className="flex justify-between text-xs border-t border-white/5 pt-2.5">
                <span className="text-zinc-500">Dining Mode:</span>
                <span className="font-semibold text-brand-400 capitalize">{messAccess.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Training Split Target:</span>
                <span className="font-semibold text-brand-400">{gymFrequency} Days / Week ({gymAccess.replace("_", " ")})</span>
              </div>
            </GlassCard>

            {/* Custom Target Override (Respect human autonomy, Philosophy 18) */}
            <div className="space-y-3">
              <div 
                onClick={() => setUseCustomMacros(!useCustomMacros)}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 select-none cursor-pointer hover:bg-white/10 transition-all"
              >
                <input
                  type="checkbox"
                  checked={useCustomMacros}
                  onChange={() => {}}
                  className="w-4 h-4 rounded text-cyan-500 bg-zinc-900 border-white/10 focus:ring-0 cursor-pointer"
                />
                <div className="text-left">
                  <span className="text-xs font-bold text-white block">Override Targets Manually</span>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">Use custom target daily calories and protein goals.</span>
                </div>
              </div>

              {useCustomMacros && (
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-white/2 border border-white/5 animate-in">
                  <div>
                    <label className="text-[10px] text-zinc-500 font-semibold mb-1 block">Custom Calories (kcal)</label>
                    <input
                      type="number"
                      placeholder={String(standardCalGoal)}
                      value={customCalories}
                      onChange={(e) => setCustomCalories(e.target.value)}
                      className="input-glass text-xs py-2 px-3"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 font-semibold mb-1 block">Custom Protein (g)</label>
                    <input
                      type="number"
                      placeholder={String(standardProteinGoal)}
                      value={customProtein}
                      onChange={(e) => setCustomProtein(e.target.value)}
                      className="input-glass text-xs py-2 px-3"
                    />
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-zinc-500 leading-relaxed text-center">
              Target calories are adjusted for your goal. Health OS will automatically shift these targets dynamically based on your actual weekly weight changes and recovery context.
            </p>
          </div>
        )}
      </div>

      {/* Button footer */}
      <div className="flex items-center gap-3 pt-4 border-t border-white/5">
        {step > 0 && (
          <button
            onClick={prevStep}
            type="button"
            className="btn-ghost flex-1 py-3"
            disabled={loading}
          >
            Back
          </button>
        )}
        <button
          onClick={step === totalSteps - 1 ? handleSubmit : nextStep}
          type="button"
          className="btn-primary flex-[2] py-3 flex items-center justify-center gap-2"
          disabled={loading}
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : step === totalSteps - 1 ? (
            "Initialize Engine"
          ) : (
            "Continue"
          )}
        </button>
      </div>
    </div>
  );
}

export default function Onboarding() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c0f0d] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Loading Onboarding Wizard...</p>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}

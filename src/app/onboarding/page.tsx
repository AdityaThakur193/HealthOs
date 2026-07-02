"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";
import ChipSelect from "@/components/ChipSelect";
import StepIndicator from "@/components/StepIndicator";

export default function Onboarding() {
  const router = useRouter();
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

  // Load existing profile if any
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
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
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    }
    loadProfile();
  }, []);

  const totalSteps = 6;

  const nextStep = () => {
    if (step === 0 && (!name || !email)) {
      setError("Please fill in your name and email.");
      return;
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
        }),
      });

      const data = await res.json();

      if (res.ok && data.profile) {
        localStorage.setItem("healthos_userId", data.profile._id);
        router.push("/"); // route to daily command center (Pillar 4)
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

  // Helper calculations for review step
  const calculatedBmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === "male" ? 5 : gender === "female" ? -161 : -80);
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  const calculatedTdee = Math.round(calculatedBmr * multipliers[activityLevel]);
  const calGoal = Math.round(goal === "lose_fat" ? calculatedTdee - 500 : goal === "build_muscle" ? calculatedTdee + 300 : goal === "recomp" ? calculatedTdee - 100 : calculatedTdee);
  const proteinGoal = Math.round(weightKg * (goal === "lose_fat" ? 2.2 : goal === "build_muscle" ? 1.8 : goal === "recomp" ? 2.3 : 2.0));

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
                  onChange={(e) => setTargetWeightKg(parseFloat(e.target.value))}
                  className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-in">
            <h2 className="text-base font-semibold text-white">What is your primary focus?</h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { value: "lose_fat", label: "Lose Fat", desc: "Sustainable caloric deficit focused on maintaining muscle", emoji: "🔥" },
                { value: "build_muscle", label: "Build Muscle", desc: "Controlled caloric surplus optimized for hypertrophy", emoji: "💪" },
                { value: "recomp", label: "Body Recomposition", desc: "Gain muscle and lose fat simultaneously", emoji: "⚡" },
                { value: "maintain", label: "Maintain Weight", desc: "Stabilize weight and focus purely on recovery & energy", emoji: "⚖️" },
                { value: "general_health", label: "General Health", desc: "Overall cardiovascular and metabolic fitness", emoji: "🌱" },
              ].map((opt) => (
                <GlassCard
                  key={opt.value}
                  onClick={() => setGoal(opt.value as any)}
                  className={`p-4 border text-left transition-all ${
                    goal === opt.value
                      ? "border-brand-500 bg-brand-500/5 glow-green"
                      : "border-white/5 bg-white/2"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.emoji}</span>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{opt.label}</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </div>
                </GlassCard>
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

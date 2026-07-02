"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile");
        const data = await res.json();
        if (data.notInitialized) {
          router.push("/onboarding");
          return;
        }
        setProfile(data.profile);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0a0a0f] text-white">
        <div className="w-8 h-8 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mb-4" />
        <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase">Loading Profile...</p>
      </div>
    );
  }

  const goalLabels = {
    lose_fat: "Lose Fat (Caloric Deficit)",
    build_muscle: "Build Muscle (Hypertrophy)",
    maintain: "Maintain Weight",
    recomp: "Body Recomposition",
    general_health: "General Health",
  };

  const activityLabels = {
    sedentary: "Sedentary (Desk Job)",
    light: "Lightly Active",
    moderate: "Moderately Active",
    active: "Highly Active",
    very_active: "Athlete",
  };

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-white/5 animate-in">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pillar 1</span>
          <h1 className="text-xl font-bold text-white mt-0.5">My Health Profile</h1>
        </div>
        <button
          onClick={() => router.push("/onboarding")}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-semibold text-brand-400 transition-all"
        >
          Edit Specs
        </button>
      </div>

      {/* Main Target Cards */}
      <div className="grid grid-cols-2 gap-3 animate-in-delay-1">
        <GlassCard className="p-4 text-center">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Daily Calorie Target</span>
          <h3 className="text-2xl font-black text-brand-400 mt-1">{profile?.targetCalories}</h3>
          <p className="text-[10px] text-zinc-400 mt-0.5">kcal / day</p>
        </GlassCard>

        <GlassCard className="p-4 text-center">
          <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Daily Protein Target</span>
          <h3 className="text-2xl font-black text-cyan-400 mt-1">{profile?.targetProteinG}g</h3>
          <p className="text-[10px] text-zinc-400 mt-0.5">protein / day</p>
        </GlassCard>
      </div>

      {/* Bio-Metrics */}
      <GlassCard className="p-5 space-y-4 animate-in-delay-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Bio-metrics</h3>
        <div className="grid grid-cols-2 gap-y-4 gap-x-2">
          <div>
            <span className="text-[10px] text-zinc-500 block">Name</span>
            <span className="text-sm font-semibold text-white">{profile?.name}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Email</span>
            <span className="text-sm font-semibold text-white truncate block">{profile?.email}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Age</span>
            <span className="text-sm font-semibold text-white">{profile?.age} Years</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Gender</span>
            <span className="text-sm font-semibold text-white capitalize">{profile?.gender}</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Height</span>
            <span className="text-sm font-semibold text-white">{profile?.heightCm} cm</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-500 block">Weight</span>
            <span className="text-sm font-semibold text-white">{profile?.weightKg} kg</span>
          </div>
        </div>
      </GlassCard>

      {/* Fitness Targets */}
      <GlassCard className="p-5 space-y-4 animate-in-delay-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Targets & Goals</h3>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Primary Goal:</span>
            <span className="font-semibold text-white">{goalLabels[profile?.goal as keyof typeof goalLabels]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Activity Level:</span>
            <span className="font-semibold text-white">{activityLabels[profile?.activityLevel as keyof typeof activityLabels]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Gym Experience:</span>
            <span className="font-semibold text-white capitalize">{profile?.gymExperience}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Diet Preference:</span>
            <span className="font-semibold text-white capitalize">{profile?.dietPreference}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Daily Sleep Goal:</span>
            <span className="font-semibold text-white">{profile?.sleepTarget} Hours</span>
          </div>
          {profile?.collegeSchedule && (
            <div className="flex justify-between">
              <span className="text-zinc-500">Schedule Context:</span>
              <span className="font-semibold text-white">{profile?.collegeSchedule}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Health Conditions / Allergies */}
      <GlassCard className="p-5 space-y-4 animate-in-delay-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-white/5 pb-2">Medical & Allergies</h3>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] text-zinc-500 block mb-1">Food Allergies</span>
            {profile?.foodAllergies && profile.foodAllergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.foodAllergies.map((allergy: string) => (
                  <span key={allergy} className="badge-warning text-[10px]">
                    {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-600 italic">None logged</span>
            )}
          </div>

          <div>
            <span className="text-[10px] text-zinc-500 block mb-1">Injuries / Medical Conditions</span>
            {profile?.medicalConditions && profile.medicalConditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.medicalConditions.map((cond: string) => (
                  <span key={cond} className="badge-info text-[10px]">
                    {cond}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-600 italic">None logged</span>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

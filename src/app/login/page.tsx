"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/GlassCard";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [hash, setHash] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      
      const data = await res.json();
      
      if (res.ok && data.success) {
        setHash(data.hash);
        setStep(2);
      } else {
        setError(data.error || "Failed to send login code.");
      }
    } catch (err) {
      console.error("OTP send error:", err);
      setError("Something went wrong. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Verify OTP
      const verifyRes = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp, hash }),
      });

      if (!verifyRes.ok) {
        const verifyData = await verifyRes.json();
        setError(verifyData.error || "Invalid or expired code.");
        setLoading(false);
        return;
      }

      // 2. If OTP is valid, proceed with login/profile fetching
      const profileRes = await fetch(`/api/profile?email=${encodeURIComponent(email.trim())}`);
      
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        
        // Save to local storage for session isolation
        localStorage.setItem("healthos_email", email.trim().toLowerCase());

        if (profileData.notInitialized) {
          // New user -> direct to onboarding wizard
          router.push(`/onboarding?email=${encodeURIComponent(email.trim())}`);
        } else {
          // Existing user -> set ID and enter dashboard
          localStorage.setItem("healthos_userId", profileData.profile._id);
          router.push("/");
        }
      } else {
        setError("Verified, but unable to load profile data.");
      }
    } catch (err) {
      console.error("Login connection error:", err);
      setError("Something went wrong. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-[#0c0f0d] text-white p-4 relative overflow-hidden">
      {/* Background glow animations */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-500/10 blur-[100px] rounded-full -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-cyan-500/10 blur-[100px] rounded-full -z-10 animate-pulse" />

      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-400 bg-brand-500/10 px-3 py-1 rounded-full border border-brand-500/20">
            Engine Boot
          </span>
          <h1 className="text-3xl font-black tracking-tight text-white mt-4">Health OS</h1>
          <p className="text-xs text-zinc-500 mt-2">
            {step === 1 ? "The decision engine for your health. Enter your email to begin." : "Enter the 6-digit code sent to your email."}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl text-center animate-in">
            {error}
          </div>
        )}

        <GlassCard className="p-6 border border-white/10 relative overflow-hidden">
          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                  Your Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-glass h-11"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold"
                disabled={loading}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Send Login Code"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block mb-1">
                  6-Digit Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} // Only allow numbers
                  className="input-glass h-11 text-center tracking-[0.5em] text-xl font-mono"
                  disabled={loading}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold"
                disabled={loading || otp.length !== 6}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Verify & Enter"
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="text-xs text-zinc-500 hover:text-white w-full text-center mt-2 transition-colors"
                disabled={loading}
              >
                Use a different email
              </button>
            </form>
          )}
        </GlassCard>

        <p className="text-[10px] text-zinc-600 text-center leading-relaxed max-w-xs mx-auto">
          Health OS stores your information locally or in isolated databases. No social feeds, no badge walls, no guilt.
        </p>
      </div>
    </div>
  );
}

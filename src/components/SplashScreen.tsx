"use client";

import { useState, useEffect, useCallback } from "react";

export default function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  const handleComplete = useCallback(onComplete, [onComplete]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 300);
    const t2 = setTimeout(() => setPhase("exit"), 2400);
    const t3 = setTimeout(() => handleComplete(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [handleComplete]);

  return (
    <>
      <style>{`
        @keyframes ring-expand {
          0%   { transform: scale(0.6); opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes logo-spring {
          0%   { transform: scale(0.3) rotate(-10deg); opacity: 0; }
          60%  { transform: scale(1.12) rotate(2deg); opacity: 1; }
          80%  { transform: scale(0.95) rotate(-1deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes text-rise {
          0%   { transform: translateY(20px); opacity: 0; letter-spacing: 0.4em; }
          100% { transform: translateY(0); opacity: 1; letter-spacing: 0.25em; }
        }
        @keyframes tagline-fade {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-fill {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.2); }
        }
        @keyframes splash-exit {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-100%); }
        }
        @keyframes glow-breathe {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(139,168,147,0.15); }
          50%       { box-shadow: 0 0 80px 30px rgba(139,168,147,0.30); }
        }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#0c0f0d",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          animation: phase === "exit" ? "splash-exit 0.6s cubic-bezier(0.4,0,0.2,1) forwards" : undefined,
        }}
      >
        {/* Expanding rings — 3 staggered */}
        {[0, 0.6, 1.2].map((delay, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              border: "1.5px solid rgba(139,168,147,0.45)",
              animation: `ring-expand 2.4s ${delay}s ease-out infinite`,
            }}
          />
        ))}

        {/* Logo container with glow */}
        <div
          style={{
            width: 110,
            height: 110,
            borderRadius: 28,
            background: "#111815",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: phase !== "enter"
              ? "logo-spring 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards, glow-breathe 2.5s 0.8s ease-in-out infinite"
              : "none",
            opacity: phase === "enter" ? 0 : 1,
            border: "1px solid rgba(139,168,147,0.2)",
            overflow: "hidden",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Health OS"
            style={{ width: 80, height: 80, objectFit: "contain" }}
          />
        </div>

        {/* App name */}
        <div
          style={{
            marginTop: 28,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 13,
            fontWeight: 800,
            color: "#e2e8e4",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            animation: phase !== "enter" ? "text-rise 0.6s 0.3s cubic-bezier(0.34,1.2,0.64,1) both" : "none",
            opacity: phase === "enter" ? 0 : undefined,
          }}
        >
          Health OS
        </div>

        {/* Tagline */}
        <div
          style={{
            marginTop: 8,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 10,
            fontWeight: 500,
            color: "#8ba893",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            animation: phase !== "enter" ? "tagline-fade 0.5s 0.7s ease both" : "none",
            opacity: phase === "enter" ? 0 : undefined,
          }}
        >
          Personal Intelligence Engine
        </div>

        {/* Progress bar */}
        <div
          style={{
            position: "absolute",
            bottom: 52,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 2,
            background: "rgba(139,168,147,0.1)",
            borderRadius: 2,
            overflow: "hidden",
            opacity: phase !== "enter" ? 1 : 0,
          }}
        >
          <div
            style={{
              height: "100%",
              background: "linear-gradient(90deg, #8ba893, #9cbda5)",
              borderRadius: 2,
              animation: phase !== "enter" ? "bar-fill 2s 0.4s linear both" : "none",
            }}
          />
        </div>

        {/* 3 animated dots */}
        <div
          style={{
            position: "absolute",
            bottom: 36,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 6,
            opacity: phase !== "enter" ? 1 : 0,
          }}
        >
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "#8ba893",
                animation: `dot-pulse 1.2s ${delay}s ease-in-out infinite`,
              }}
            />
          ))}
        </div>
      </div>
    </>
  );
}

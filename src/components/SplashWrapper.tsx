"use client";

import { useState, useEffect } from "react";
import SplashScreen from "./SplashScreen";

export default function SplashWrapper({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only show once per browser session
    const seen = sessionStorage.getItem("healthos_splash_seen");
    if (!seen) {
      setShowSplash(true);
    }
    setMounted(true);
  }, []);

  const handleComplete = () => {
    sessionStorage.setItem("healthos_splash_seen", "1");
    setShowSplash(false);
  };

  // Avoid SSR/hydration mismatch — render nothing until mounted
  if (!mounted) return null;

  return (
    <>
      {/* App renders underneath so it loads in the background */}
      {children}
      {/* Splash overlays on top */}
      {showSplash && <SplashScreen onComplete={handleComplete} />}
    </>
  );
}

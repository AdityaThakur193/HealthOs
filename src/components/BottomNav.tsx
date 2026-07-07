"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Camera, Dumbbell, TrendingUp, User } from "lucide-react";

const tabs = [
  {
    name: "Home",
    href: "/",
    Icon: Home,
  },
  {
    name: "Meal",
    href: "/meal",
    Icon: Camera,
  },
  {
    name: "Workout",
    href: "/workout",
    Icon: Dumbbell,
  },
  {
    name: "Journey",
    href: "/journey",
    Icon: TrendingUp,
  },
  {
    name: "Profile",
    href: "/profile",
    Icon: User,
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  // Don't show nav on onboarding, login, or review
  if (pathname === "/onboarding" || pathname === "/login" || pathname === "/review") return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 animate-in">
      <div className="max-w-lg mx-auto">
        <div
          className="mx-3 mb-3 rounded-2xl flex items-center justify-around py-2"
          style={{
            background: "rgba(12, 15, 13, 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            boxShadow: "0 -4px 30px rgba(0, 0, 0, 0.4)",
          }}
        >
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const Icon = tab.Icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "text-[#8ba893]"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <div className={`relative ${isActive ? "scale-110" : ""} transition-transform duration-300`}>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.75} />
                  {isActive && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#8ba893] shadow-md shadow-[#8ba893]/50 animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-medium mt-1">{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

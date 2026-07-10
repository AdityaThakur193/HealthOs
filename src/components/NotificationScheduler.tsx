"use client";

import { useEffect, useRef } from "react";
import { sendLocalTestNotification } from "@/lib/notifications";

interface NotificationSchedule {
  hour: number;
  minute: number;
  key: string; // unique per day to avoid duplicates
  getTitle: (userName: string) => string;
  getBody: (userName: string) => string;
  image: string;
}

const DAILY_NOTIFICATIONS: NotificationSchedule[] = [
  {
    hour: 8,
    minute: 30,
    key: "morning",
    getTitle: (n) => `Good morning, ${n}! 🌅 Ready to crush today?`,
    getBody: () =>
      "Don't forget to log your breakfast and check your workout plan for today. Every rep and every meal counts!",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600&auto=format&fit=crop",
  },
  {
    hour: 13,
    minute: 0,
    key: "lunch",
    getTitle: (n) => `Protein check, ${n}! 🥗`,
    getBody: () =>
      "Midday reminder — did you log your lunch? Staying on top of your macros now means hitting your targets by dinner.",
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=600&auto=format&fit=crop",
  },
  {
    hour: 17,
    minute: 30,
    key: "water",
    getTitle: (n) => `${n}, stay hydrated! 💧`,
    getBody: () =>
      "Afternoon check-in: Have you hit your water goal today? Dehydration kills performance. Log your water intake now.",
    image:
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=600&auto=format&fit=crop",
  },
  {
    hour: 20,
    minute: 0,
    key: "evening",
    getTitle: (n) => `Evening wrap-up, ${n} 🌙`,
    getBody: () =>
      "Great time to log your dinner, check your steps, and review how today went. Sleep well and recover strong!",
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?q=80&w=600&auto=format&fit=crop",
  },
];

function getTodayKey(key: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `healthos_notif_${key}_${today}`;
}

function hasNotificationFiredToday(key: string): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(getTodayKey(key)) === "1";
}

function markNotificationFired(key: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(getTodayKey(key), "1");
}

export default function NotificationScheduler() {
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // Only run if notification permission is granted
    if (typeof window === "undefined" || Notification.permission !== "granted") return;

    const userName =
      localStorage.getItem("healthos_name") ||
      localStorage.getItem("healthos_email")?.split("@")[0] ||
      "Champ";

    const now = new Date();

    DAILY_NOTIFICATIONS.forEach((schedule) => {
      if (hasNotificationFiredToday(schedule.key)) return;

      const target = new Date();
      target.setHours(schedule.hour, schedule.minute, 0, 0);

      const msUntil = target.getTime() - now.getTime();
      if (msUntil <= 0) return; // time already passed today

      const timer = setTimeout(async () => {
        if (hasNotificationFiredToday(schedule.key)) return;
        markNotificationFired(schedule.key);
        await sendLocalTestNotification(
          schedule.getTitle(userName),
          schedule.getBody(userName),
          "/",
          schedule.image
        );
      }, msUntil);

      timersRef.current.push(timer);
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  return null; // invisible component
}

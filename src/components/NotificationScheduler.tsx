"use client";

import { useEffect, useRef } from "react";
import { 
  registerServiceWorker, 
  sendLocalTestNotification, 
  getCustomNotifications, 
  markCustomNotificationFired 
} from "@/lib/notifications";

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
    if (typeof window === "undefined" || !("Notification" in window)) return;

    // Auto-register service worker if permission is granted
    if (Notification.permission === "granted") {
      registerServiceWorker();
    } else {
      return;
    }

    const userName =
      localStorage.getItem("healthos_name") ||
      localStorage.getItem("healthos_email")?.split("@")[0] ||
      "Champ";

    const checkAndSchedule = () => {
      // Clear existing scheduled timers
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      const now = new Date();

      // 1. Process daily static schedules
      DAILY_NOTIFICATIONS.forEach((schedule) => {
        if (hasNotificationFiredToday(schedule.key)) return;

        const target = new Date();
        target.setHours(schedule.hour, schedule.minute, 0, 0);

        const msUntil = target.getTime() - now.getTime();
        // If within 5 minutes or in the future
        if (msUntil <= 0 && Math.abs(msUntil) < 5 * 60 * 1000) {
          // Time just passed within last 5 minutes
          markNotificationFired(schedule.key);
          sendLocalTestNotification(
            schedule.getTitle(userName),
            schedule.getBody(userName),
            "/",
            schedule.image
          );
        } else if (msUntil > 0) {
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
        }
      });

      // 2. Process custom notifications set via Coach AI or Profile
      const customList = getCustomNotifications();
      customList.forEach((item) => {
        if (item.fired) return;

        let msUntil = -1;

        if (item.triggerAt) {
          msUntil = item.triggerAt - Date.now();
        } else if (item.time) {
          const [hStr, mStr] = item.time.split(":");
          const target = new Date();
          target.setHours(parseInt(hStr, 10) || 0, parseInt(mStr, 10) || 0, 0, 0);
          msUntil = target.getTime() - now.getTime();
        }

        if (msUntil <= 0 && Math.abs(msUntil) < 2 * 60 * 1000) {
          // Fire right away if due within past 2 mins
          markCustomNotificationFired(item.id);
          sendLocalTestNotification(item.title, item.body, "/", item.image);
        } else if (msUntil > 0) {
          const timer = setTimeout(async () => {
            markCustomNotificationFired(item.id);
            await sendLocalTestNotification(item.title, item.body, "/", item.image);
          }, msUntil);
          timersRef.current.push(timer);
        }
      });
    };

    checkAndSchedule();

    // Listen for dynamically scheduled custom notifications
    window.addEventListener("customNotificationScheduled", checkAndSchedule);

    // Periodic check every 30 seconds
    const interval = setInterval(checkAndSchedule, 30000);

    return () => {
      window.removeEventListener("customNotificationScheduled", checkAndSchedule);
      clearInterval(interval);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, []);

  return null;
}

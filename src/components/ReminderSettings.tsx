"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import GlassCard from "./GlassCard";
import { MEAL_NAMES, MealName } from "@/lib/mealWindows";

type Status = "loading" | "unsupported" | "not_configured" | "blocked" | "off" | "on";

function toKeyBytes(base64: string): Uint8Array<ArrayBuffer> {
  const normalized = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
}

function pushIsSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export default function ReminderSettings() {
  const [status, setStatus] = useState<Status>("loading");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [meals, setMeals] = useState<MealName[]>([...MEAL_NAMES]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!pushIsSupported()) {
        setStatus("unsupported");
        return;
      }
      try {
        const res = await fetch("/api/reminders", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data.publicKey) {
          setStatus("not_configured");
          return;
        }
        setPublicKey(data.publicKey);
        setMeals(data.meals);
        setStatus(data.enabled ? "on" : Notification.permission === "denied" ? "blocked" : "off");
      } catch {
        setStatus("not_configured");
      }
    }
    load();
  }, []);

  const post = (body: object) =>
    fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  const turnOn = async () => {
    if (!publicKey) return;
    setBusy(true);
    setError("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }

      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKeyBytes(publicKey),
      });

      const res = await post({
        action: "subscribe",
        subscription: subscription.toJSON(),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (!res.ok) throw new Error("Subscribe failed");
      setStatus("on");
    } catch (err) {
      console.error("Could not turn on reminders:", err);
      setError("Reminders couldn't be turned on. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      await subscription?.unsubscribe();
      await post({ action: "unsubscribe" });
      setStatus("off");
    } catch (err) {
      console.error("Could not turn off reminders:", err);
      setError("Reminders couldn't be turned off. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleMeal = async (meal: MealName) => {
    const next = meals.includes(meal) ? meals.filter((name) => name !== meal) : MEAL_NAMES.filter((name) => meals.includes(name) || name === meal);
    setMeals(next);
    const res = await post({ action: "meals", meals: next }).catch(() => null);
    if (!res?.ok) {
      setMeals(meals);
      setError("That change couldn't be saved. Please try again.");
    }
  };

  if (status === "loading" || status === "not_configured") return null;

  return (
    <GlassCard className="p-5 space-y-3 border border-white/10">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
        <Bell className="w-3.5 h-3.5" /> Meal Reminders
      </h3>
      <p className="text-[11px] text-zinc-400 leading-relaxed">
        A nudge in the last hour before a meal closes, only if you haven&apos;t logged it.
      </p>

      {status === "unsupported" && (
        <p className="text-[11px] text-amber-300 leading-relaxed">
          This browser can&apos;t show reminders. On iPhone, add Health OS to your Home Screen first, then open it from there.
        </p>
      )}

      {status === "blocked" && (
        <p className="text-[11px] text-amber-300 leading-relaxed">
          Notifications are blocked for this site. Allow them in your browser settings, then come back here.
        </p>
      )}

      {status === "off" && (
        <button onClick={turnOn} disabled={busy} className="btn-primary w-full py-3 font-bold text-xs disabled:opacity-50">
          {busy ? "Turning on..." : "Turn On Reminders"}
        </button>
      )}

      {status === "on" && (
        <>
          <p className="text-[11px] text-zinc-400">Tap a meal to switch its reminder on or off.</p>
          <div className="grid grid-cols-2 gap-2">
            {MEAL_NAMES.map((meal) => (
              <button
                key={meal}
                type="button"
                aria-pressed={meals.includes(meal)}
                onClick={() => toggleMeal(meal)}
                className={`py-2 rounded-xl text-xs font-bold capitalize border transition-all cursor-pointer ${
                  meals.includes(meal) ? "bg-brand-500/20 text-white border-brand-500/50" : "bg-white/5 text-zinc-500 border-white/10"
                }`}
              >
                {meal} · {meals.includes(meal) ? "On" : "Off"}
              </button>
            ))}
          </div>
          <button onClick={turnOff} disabled={busy} className="text-[11px] text-zinc-500 hover:text-white transition-colors cursor-pointer">
            {busy ? "Turning off..." : "Turn off reminders on all devices"}
          </button>
        </>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </GlassCard>
  );
}

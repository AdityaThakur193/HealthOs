/**
 * PWA Web Push Notification Manager Helper
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    console.log("✅ Service Worker registered successfully:", registration.scope);
    return registration;
  } catch (error) {
    console.error("❌ Service Worker registration failed:", error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }

  const permission = await Notification.requestPermission();
  console.log("🔔 Notification permission state changed:", permission);
  if (permission === "granted") {
    await registerServiceWorker();
  }
  return permission;
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

export async function sendLocalTestNotification(
  title: string,
  body: string,
  url: string = "/",
  image?: string
): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    console.warn("⚠️ Notification API not supported in this browser environment.");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("⚠️ Notification permission not granted.");
    return false;
  }

  // 1. Ensure Service Worker is registered and active
  let registration: ServiceWorkerRegistration | null | undefined = null;
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      registration = reg || null;
      if (!registration) {
        registration = await registerServiceWorker();
      }
    } catch (e) {
      console.warn("Failed to get or register ServiceWorker:", e);
    }
  }

  const bannerImage =
    image ||
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop";

  // 2. Prefer Service Worker showNotification (works on Android & Desktop PWA)
  if (registration) {
    try {
      await registration.showNotification(title, {
        body,
        icon: "/logo.png",
        badge: "/logo-badge.png",
        image: bannerImage,
        color: "#8ba893",
        vibrate: [200, 100, 200],
        tag: "healthos-reminder-" + Date.now(),
        renotify: true,
        data: { url: url || "/" },
      } as any);
      console.log("✅ Notification displayed via ServiceWorker!");
      return true;
    } catch (err) {
      console.warn("ServiceWorker showNotification failed, trying fallback:", err);
    }
  }

  // 3. Fallback: Native browser Notification constructor (Desktop Chrome/Firefox/Safari)
  try {
    const notif = new Notification(title, {
      body,
      icon: "/logo.png",
    });
    notif.onclick = () => {
      window.focus();
      if (url && url !== "/") window.location.href = url;
    };
    console.log("✅ Notification displayed via native Notification constructor!");
    return true;
  } catch (err) {
    console.error("❌ Both ServiceWorker and native Notification failed:", err);
    return false;
  }
}

export interface CustomNotificationItem {
  id: string;
  title: string;
  body: string;
  time?: string; // HH:MM 24hr format, e.g. "17:30"
  triggerAt?: number; // timestamp in ms
  image?: string;
  createdAt: string;
  fired?: boolean;
}

const CUSTOM_NOTIF_KEY = "healthos_custom_notifications";

export function getCustomNotifications(): CustomNotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_NOTIF_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomNotification(item: Omit<CustomNotificationItem, "id" | "createdAt">): CustomNotificationItem {
  const newItem: CustomNotificationItem = {
    ...item,
    id: "notif_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    createdAt: new Date().toISOString(),
    fired: false,
  };

  if (typeof window !== "undefined") {
    const list = getCustomNotifications();
    list.push(newItem);
    localStorage.setItem(CUSTOM_NOTIF_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("customNotificationScheduled"));
  }

  return newItem;
}

export function markCustomNotificationFired(id: string) {
  if (typeof window === "undefined") return;
  const list = getCustomNotifications();
  const updated = list.map((item) => (item.id === id ? { ...item, fired: true } : item));
  localStorage.setItem(CUSTOM_NOTIF_KEY, JSON.stringify(updated));
}


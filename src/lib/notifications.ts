/**
 * PWA Web Push Notification Manager Helper
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
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
  return permission;
}

export function getNotificationPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission;
}

export async function sendLocalTestNotification(title: string, body: string, url: string = "/", image?: string) {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if (registration && registration.active) {
    // Post message to service worker to trigger the notification block
    registration.active.postMessage({
      type: "SHOW_NOTIFICATION",
      payload: { title, body, url, image },
    });
  } else {
    // Fallback: Browser notification directly if active service worker isn't loaded yet
    if (Notification.permission === "granted") {
      new Notification(title, { body, icon: "/logo-notification.png" });
    }
  }
}

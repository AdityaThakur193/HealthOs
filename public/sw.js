self.addEventListener("push", (event) => {
  let data = { title: "Health OS", body: "Don't forget to track your day!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Health OS", body: event.data.text() };
    }
  }

  // Choose a rich motivational/nutritional banner image dynamically if none provided
  const bannerImage = data.image || "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop";

  const options = {
    body: data.body,
    icon: "/logo.png", // Raster icon (compatible with Android/Chrome)
    badge: "/logo.png", // Raster badge icon
    image: bannerImage, // Large rich content banner image
    color: "#8ba893", // App color scheme theme accent
    vibrate: [200, 100, 200],
    tag: data.tag || "healthos-reminder",
    renotify: true,
    data: {
      url: data.url || "/",
    },
    actions: [
      {
        action: "workout",
        title: "Log Workout 🏋️‍♂️",
      },
      {
        action: "meal",
        title: "Track Meal 📸",
      }
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  
  let urlToOpen = event.notification.data?.url || "/";

  // Handle action buttons
  if (event.action === "workout") {
    urlToOpen = "/workout";
  } else if (event.action === "meal") {
    urlToOpen = "/meal";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open on this path, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If no tab is open on this path, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Support direct messages to trigger local mock push notifications
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, url, image } = event.data.payload;
    const bannerImage = image || "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=600&auto=format&fit=crop";
    
    self.registration.showNotification(title, {
      body,
      icon: "/logo.png",
      badge: "/logo.png",
      image: bannerImage,
      color: "#8ba893",
      vibrate: [250, 100, 250],
      tag: "healthos-reminder",
      renotify: true,
      data: { url: url || "/" },
      actions: [
        {
          action: "workout",
          title: "Log Workout 🏋️‍♂️",
        },
        {
          action: "meal",
          title: "Track Meal 📸",
        }
      ],
    });
  }
});

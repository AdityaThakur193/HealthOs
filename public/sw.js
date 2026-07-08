self.addEventListener("push", (event) => {
  let data = { title: "Health OS", body: "Don't forget to track your day!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Health OS", body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: "/file.svg", // Default icon
    badge: "/file.svg",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If a tab is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && "focus" in client) {
          return client.focus();
        }
      }
      // If no tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Support direct messages to trigger local mock push notifications
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, body, url } = event.data.payload;
    self.registration.showNotification(title, {
      body,
      icon: "/file.svg",
      badge: "/file.svg",
      vibrate: [200, 100, 200],
      data: { url: url || "/" },
    });
  }
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: "LaaWa", body: event.data?.text() || "You have a new notification." }; }
  const title = payload.title || "LaaWa notification";
  const options = {
    body: payload.body || "You have a new notification.",
    tag: payload.notificationId || payload.eventType || "laawa-notification",
    renotify: true,
    data: { url: "/", ...(payload.data || {}) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => "focus" in window);
    if (existing) return existing.focus();
    return clients.openWindow(target);
  }));
});

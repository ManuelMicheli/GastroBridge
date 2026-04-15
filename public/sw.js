/* GastroBridge Service Worker — push notifications */
/* eslint-disable no-restricted-globals */

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: "GastroBridge", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "GastroBridge";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/next.svg",
    badge: payload.badge || "/next.svg",
    data: { url: payload.url || "/supplier/dashboard" },
    tag: payload.tag,
    renotify: Boolean(payload.tag),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/supplier/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          if (url.pathname === targetUrl || client.url.endsWith(targetUrl)) {
            return client.focus();
          }
        } catch (err) {
          // ignore
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return null;
    })
  );
});

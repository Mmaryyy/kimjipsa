self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    /* Show a safe fallback. */
  }
  event.waitUntil(
    self.registration.showNotification("김집사", {
      body:
        typeof payload.body === "string" ? payload.body : "새 알림이 있어요.",
      tag: payload.id,
      data: { url: payload.url },
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/?notifications=open",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows.find(
        (entry) => new URL(entry.url).origin === target.origin,
      );
      if (client) {
        try {
          await client.focus();
          if (await client.navigate(target.href)) return;
        } catch {
          // Uncontrolled windows may reject navigation or focus.
        }
        await self.clients.openWindow(target.href);
      } else await self.clients.openWindow(target.href);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      // A renewal must be linked explicitly from settings in the signed-in app.
      // Discard an automatic replacement to avoid retaining an unowned endpoint.
      await event.newSubscription?.unsubscribe();
      if (!event.oldSubscription) return;
      try {
        await fetch("/api/push/subscriptions", {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: event.oldSubscription.endpoint }),
        });
      } catch {
        // Expired endpoints are also removed by the dispatcher's 404/410 handling.
      }
    })(),
  );
});

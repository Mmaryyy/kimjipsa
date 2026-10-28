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
    self.registration.showNotification("일정 알림", {
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

// CART-14: only the cart shell and the data needed to read it survive a disconnected restart.
const cartCachePrefix = "kimjipsa-cart-v1-";
const cartIdentityCache = "kimjipsa-cart-identity-v1";
const cartAssetCache = "kimjipsa-cart-assets-v1";
const cartIdentityKey = new URL("/__cart_identity", self.location.origin).href;
let cartCacheEpoch = 0;
const warmedCartScopes = new Set();
async function cartScope() {
  const identity = await caches.open(cartIdentityCache);
  return (await identity.match(cartIdentityKey))?.text();
}
async function clearCartCaches() {
  cartCacheEpoch += 1;
  warmedCartScopes.clear();
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith("kimjipsa-cart-"))
      .map((name) => caches.delete(name)),
  );
}
self.addEventListener("message", (event) => {
  if (event.data?.type !== "CLEAR_CART_CACHE") return;
  event.waitUntil(
    clearCartCaches().then(() => event.ports[0]?.postMessage({ ok: true })),
  );
});
async function cartApiResponse(request, event) {
  let epoch = cartCacheEpoch;
  const url = new URL(request.url);
  let scope = await cartScope();
  try {
    const response = await fetch(request);
    if (response.status === 401 || response.status === 403) {
      await clearCartCaches();
      return response;
    }
    if (!response.ok) return response;
    const result = await response.clone().json();
    if (!result.ok || epoch !== cartCacheEpoch) return response;
    if (url.pathname === "/api/account") {
      const { userId, membership } = result.data;
      if (!userId || !membership?.familyId) {
        await clearCartCaches();
        return response;
      }
      const nextScope = `${membership.familyId}-${userId}`;
      if (scope && scope !== nextScope) {
        await clearCartCaches();
        epoch = cartCacheEpoch;
      }
      scope = nextScope;
      const identity = await caches.open(cartIdentityCache);
      if (epoch !== cartCacheEpoch) return response;
      await identity.put(cartIdentityKey, new Response(scope));
      if (epoch !== cartCacheEpoch) {
        await caches.delete(cartIdentityCache);
        return response;
      }
    }
    if (!scope) return response;
    // Never put a response into another family's cache, even during an account switch.
    if (
      url.pathname === "/api/cart" &&
      `${result.data.familyId}-${result.data.actorId}` !== scope
    )
      return response;
    const cache = await caches.open(cartCachePrefix + scope);
    if (epoch !== cartCacheEpoch || (await cartScope()) !== scope)
      return response;
    await cache.put(url.pathname, response.clone());
    if (epoch !== cartCacheEpoch) {
      await caches.delete(cartCachePrefix + scope);
      return response;
    }
    if (url.pathname === "/api/cart" && !warmedCartScopes.has(scope)) {
      warmedCartScopes.add(scope);
      const shellEpoch = cartCacheEpoch;
      event.waitUntil(
        fetch("/cart", { headers: { Accept: "text/html" }, cache: "no-store" })
          .then(async (shell) => {
            if (
              shell.ok &&
              !shell.redirected &&
              shellEpoch === cartCacheEpoch &&
              (await cartScope()) === scope
            ) {
              const html = await shell.clone().text();
              await cache.put("/cart", shell);
              const assets = await caches.open(cartAssetCache);
              const sources = [
                ...html.matchAll(
                  /(?:src|href)="([^" ]*\/_next\/static\/[^" ]+)"/g,
                ),
              ];
              await Promise.all(
                sources.map(async ([, source]) => {
                  const assetUrl = new URL(
                    source.replaceAll("&amp;", "&"),
                    self.location.origin,
                  );
                  if (assetUrl.origin !== self.location.origin) return;
                  const asset = await fetch(assetUrl.href);
                  if (asset.ok && shellEpoch === cartCacheEpoch)
                    await assets.put(assetUrl.href, asset);
                }),
              );
              if (shellEpoch !== cartCacheEpoch) {
                await caches.delete(cartCachePrefix + scope);
                await caches.delete(cartAssetCache);
              }
            }
          })
          .catch(() => warmedCartScopes.delete(scope)),
      );
    }
    return response;
  } catch {
    if (epoch !== cartCacheEpoch || !scope) return Response.error();
    const cache = await caches.open(cartCachePrefix + scope);
    const cached = await cache.match(url.pathname);
    if (!cached) return Response.error();
    if (url.pathname !== "/api/cart") return cached;
    const result = await cached.json();
    result.data.networkError = true;
    return Response.json(result);
  }
}
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (
    ["/api/cart", "/api/account", "/api/inventory-meta"].includes(url.pathname)
  ) {
    event.respondWith(cartApiResponse(request, event));
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    ["/manifest.webmanifest", "/favicon.ico"].includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(cartAssetCache);
        try {
          const response = await fetch(request);
          if (response.ok) await cache.put(request, response.clone());
          return response;
        } catch {
          return (await cache.match(request)) ?? Response.error();
        }
      })(),
    );
  } else if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const scope = await cartScope();
          if (!scope) return Response.error();
          const cache = await caches.open(cartCachePrefix + scope);
          const shell = await cache.match("/cart");
          if (!shell) return Response.error();
          return url.pathname === "/cart"
            ? shell
            : Response.redirect(new URL("/cart", url).href);
        }
      })(),
    );
  }
});

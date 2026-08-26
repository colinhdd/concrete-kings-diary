// CK Central, Fuel & Batching - Offline-First Service Worker
// Strategy: Network-first for fresh updates, offline-fallback cache

const CACHE_VERSION = "ck-apps-v4";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// App shell assets to pre-cache on install
const SHELL_ASSETS = [
  "/",
  "/batching",
  "/gate",
  "/fuel",
  "/parts",
  "/favicon.svg",
  "/icons.svg",
  "/manifest-gate.json",
  "/manifest-fuel.json",
  "/manifest-parts.json",
  "/gate-icon.png",
  "/fuel-pump-icon.png",
  "/parts-icon.png",
];

// ── Install: pre-cache the app shell ───────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      await Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Failed to pre-cache ${url}:`, err)
          )
        )
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: purge all old caches immediately ─────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== SHELL_CACHE && n !== RUNTIME_CACHE)
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first with offline fallback ─────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Skip non-GET requests, cross-origin requests, internal Next.js assets, and HMR
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.hostname === "localhost" ||
    url.pathname.includes("webpack-hmr") ||
    url.pathname.includes("_turbopack_") ||
    url.pathname.includes("turbopack") ||
    url.pathname.startsWith("/_next/")
  ) {
    return;
  }

  // 2. API routes: network-only (never cache)
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // 3. For all pages and assets: try network first, then cache, then offline shell
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful response in runtime cache
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        // Network failed (offline) -> Check cache
        const runtimeMatch = await caches.match(request);
        if (runtimeMatch) return runtimeMatch;

        const shellCache = await caches.open(SHELL_CACHE);
        const shellMatch = await shellCache.match(request);
        if (shellMatch) return shellMatch;

        // Route fallback for app sections
        if (url.pathname.startsWith("/batching")) {
          const batchingMatch = await shellCache.match("/batching");
          if (batchingMatch) return batchingMatch;
        }
        if (url.pathname.startsWith("/gate")) {
          const gateMatch = await shellCache.match("/gate");
          if (gateMatch) return gateMatch;
        }
        if (url.pathname.startsWith("/fuel")) {
          const fuelMatch = await shellCache.match("/fuel");
          if (fuelMatch) return fuelMatch;
        }

        // Generic offline fallback
        return new Response(
          `<!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <title>Offline — Concrete Kings</title>
              <style>
                body { background: #0d0e12; color: #f3f4f6; font-family: system-ui, sans-serif;
                       display: flex; flex-direction: column; align-items: center;
                       justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 2rem; }
                h1 { font-size: 1.5rem; color: #e05300; margin-bottom: .5rem; }
                p  { color: #9ca3af; font-size: .95rem; max-width: 380px; line-height: 1.6; }
              </style>
            </head>
            <body>
              <h1>⚠ No Connection</h1>
              <p>You are offline. The Batching Diary saves all entries locally to IndexedDB and will synchronize when back online.</p>
            </body>
          </html>`,
          { headers: { "Content-Type": "text/html" } }
        );
      })
  );
});

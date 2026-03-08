// Service Worker для офлайн роботи та кешування
const CACHE_NAME = "car-analytics-v3";
const STATIC_CACHE = "car-analytics-static-v3";
const API_CACHE = "car-analytics-api-v3";

// Static assets to cache on install
const staticUrlsToCache = [
  "/",
  "/index.html",
  "/reports.html",
  "/analytics.html",
  "/styles.css",
  "/app.js",
  "/config/partsConfig.js",
  "/utils/formatters.js",
  "/cache/cacheManager.js",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(staticUrlsToCache);
      })
      .catch((err) => console.log("[SW] Cache failed:", err)),
  );
  self.skipWaiting();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // API requests - network first, cache fallback
  if (url.pathname.includes("/api/") || url.hostname.includes("google")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets - cache first, network fallback
  event.respondWith(cacheFirst(request));
});

// Cache first strategy for static assets
async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    // Return cached and update in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
      })
      .catch(() => {});
    return cached;
  }

  // Not in cache, fetch and cache
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log("[SW] Fetch failed:", error);
    throw error;
  }
}

// Network first strategy for API
async function networkFirst(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      console.log("[SW] Serving cached API response");
      return cached;
    }
    throw error;
  }
}

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

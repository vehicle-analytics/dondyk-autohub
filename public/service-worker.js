// Service Worker для офлайн роботи та кешування
const CACHE_NAME = "car-analytics-v5";
const STATIC_CACHE = "car-analytics-static-v5";
const API_CACHE = "car-analytics-api-v5";

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
  // Не кешуємо важкі відповіді від Google Sheets через Service Worker Cache API
  // Оскільки ми вже використовуємо IndexedDB у CacheManager для зберігання цих даних,
  // подвійне кешування призводить до QuotaExceededError.
  const url = new URL(request.url);
  const isGoogleSheets = url.hostname.includes("google") || 
                         url.pathname.includes("spreadsheets") ||
                         url.searchParams.has("key");

  if (isGoogleSheets) {
    console.log("[SW] Bypassing cache for Google Sheets request");
    return await fetch(request);
  }

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

// Periodic Background Sync - оновлення даних о 06:00
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "update-car-data") {
    console.log("[SW] Periodic background sync triggered");
    event.waitUntil(updateDataInBackground());
  }
});

// Функція для оновлення даних у фоні
async function updateDataInBackground() {
  try {
    // В реальному сценарії тут був би запит до API або Google Sheets
    // Але Service Worker не має прямого доступу до IndexedDB напряму без бібліотек або хитрих обгортку
    // Ми можемо просто відправити повідомлення всім клієнтам, щоб вони оновилися при наступному відкритті
    // Або спробувати виконати fetch для прогріву кешу HTTP (якщо він є)
    console.log("[SW] Background update started...");
    
    // Повідомляємо клієнтів (якщо вони відкриті)
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'BACKGROUND_UPDATE_TRIGGERED' });
    });
    
    return true;
  } catch (error) {
    console.error("[SW] Background update failed:", error);
    return false;
  }
}

// Повідомлення від основної нитки
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === "REGISTER_PERIODIC_SYNC") {
    registerPeriodicSync();
  }
});

async function registerPeriodicSync() {
  const registration = await self.registration;
  if ("periodicSync" in registration) {
    try {
      await registration.periodicSync.register("update-car-data", {
        minInterval: 24 * 60 * 60 * 1000, // 24 години
      });
      console.log("[SW] Periodic Sync registered successfully");
    } catch (error) {
      console.warn("[SW] Periodic Sync could not be registered:", error);
    }
  }
}

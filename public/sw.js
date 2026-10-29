// ExplainBack service worker: makes the site installable and keeps the shell and
// hashed assets available offline. Model requests (/api/*) and analytics are never cached.
const VERSION = "explainback-shell-v1";
const SHELL = ["/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function store(request, response) {
  if (response && response.ok) {
    const cache = await caches.open(VERSION);
    await cache.put(request, response.clone());
  }
  return response;
}

// Pages: the network first, so a new release shows at once; the cached shell when offline.
async function networkFirst(request) {
  try {
    return await store(request, await fetch(request));
  } catch {
    return (await caches.match(request)) || (await caches.match("/")) || Response.error();
  }
}

// Hashed build assets never change under the same name.
async function cacheFirst(request) {
  return (await caches.match(request)) || store(request, await fetch(request));
}

// Brand and gallery files: serve what we have, refresh in the background.
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request).then((response) => store(request, response)).catch(() => cached);
  return cached || refresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_vercel/")) return;
  if (request.mode === "navigate") event.respondWith(networkFirst(request));
  else if (url.pathname.startsWith("/assets/")) event.respondWith(cacheFirst(request));
  else event.respondWith(staleWhileRevalidate(request));
});

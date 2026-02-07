const CACHE_NAME = "cut-buddy-shell-v5";
const APP_SHELL = [
  "/",
  "/index.html",
  "/mobile-benchmark.html",
  "/wasm-smoke.html",
  "/favicon.svg",
  "/favicon.ico",
  "/favicon.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/styles/main.css",
  "/scripts/app.js",
  "/scripts/engine.js",
  "/scripts/exact-solver-worker.js",
  "/scripts/approx-improver-worker.js",
  "/scripts/mobile-benchmark.js",
  "/scripts/wasm/cut_buddy_exact_wasm.wasm",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("/index.html"));
    })
  );
});

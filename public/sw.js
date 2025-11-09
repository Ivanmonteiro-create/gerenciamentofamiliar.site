/* sw.js – cache básico para PWA */
const CACHE = "gf-cache-v1";
const OFFLINE_URL = "/offline.html";

/* arquivos que vale a pena pré-cachear */
const PRECACHE = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/* instala e faz precache */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

/* ativa SW antigo -> novo */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

/* estratégia: network first, fallback cache, e por fim offline */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((resp) => {
        const respClone = resp.clone();
        caches.open(CACHE).then((c) => c.put(request, respClone));
        return resp;
      })
      .catch(async () => {
        const cacheResp = await caches.match(request);
        if (cacheResp) return cacheResp;
        if (request.mode === "navigate") {
          return caches.match(OFFLINE_URL);
        }
        return new Response("", { status: 504, statusText: "Offline" });
      })
  );
});

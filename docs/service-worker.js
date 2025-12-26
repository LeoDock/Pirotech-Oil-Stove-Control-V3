const CACHE_NAME = "pirotech-cache-v3";  // ← aumenta la versione quando aggiorni i file

const ASSETS = [
    "/", 
    "/index.html",
    "/style.css",
    "/script.js",
    "/manifest.json",
    "/icons/icon-192.png",
    "/icons/icon-512.png"
];

// INSTALL
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting(); // aggiorna subito
});

// ATTIVAZIONE
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim(); // applica subito la nuova versione
});

// FETCH — sempre preferisci la rete, fallback alla cache
self.addEventListener("fetch", event => {
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // aggiorna la cache con la versione nuova
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

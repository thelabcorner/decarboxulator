const cacheName = 'my-cache-v1';

const filesToCache = [
    "/",
    "/index.html",
    "/mobile.css",
    "/service-worker.js",
    "/manifest.json",
    "/icon-192.png",
    "/icon-512.png"
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(cacheName)
            .then(function(cache) {
                console.log('[ServiceWorker] Caching app shell');
                cache.addAll(filesToCache);
                return console.log('[ServiceWorker] Files Cached');
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                return response || fetch(event.request);
            })
    );
});


const cacheName = 'my-cache-v2';

const filesToCache = [
    "/",
    "/index.html",
    "/mobile.css",
    "/serviceWorker.js",
    "/calculatorJS/calculateCartridgeIsolate.js",
    "/calculatorJS/calculateDecarbTime.js",
    "/calculatorJS/THCtoTHCA.js",
    "/calculatorJS/splashJS.js",
    "/calculatorJS/spoilerJS.js",
    "/calculatorJS/decarbTimePlot.js",
    "/calculatorJS/calculateDecarbProgress.js",
    "/calculatorJS/THCAtoTHC.js",
    "/manifest.json",
    "/modalJS.js",
    "/icon-192.png",
    "/icon-512.png"
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(cacheName)
            .then(function(cache) {
                console.log('[ServiceWorker] Caching app shell');
                return cache.addAll(filesToCache);
            })
            .then(function() {
                console.log('[ServiceWorker] Files Cached');
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }

                return fetch(event.request)
                    .then(function(response) {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        var responseToCache = response.clone();

                        caches.open(cacheName)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    });
            })
    );
});


if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('./serviceWorker.js').then(function (registration) {
            console.log('ServiceWorker registration successful with scope:', registration.scope);
        }, function (err) {
            console.log('ServiceWorker registration failed:', err);
        });
    });
}

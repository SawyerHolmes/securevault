// ============================================================
// SW.JS — service worker for offline + installability.
// Caches the static shell on install; serves from cache first
// with a network fallback. The encrypted vault lives in
// localStorage and never touches this cache.
// ============================================================

const CACHE = "securevault-v51";

const ASSETS = [
    "./",
    "./login.html",
    "./vault.html",
    "./add-entry.html",
    "./settings.html",
    "./trash.html",
    "./archive.html",
    "./history.html",
    "./about.html",
    "./tags.html",
    "./css/styles.css",
    "./manifest.webmanifest",
    "./assets/icons/icon.svg",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/apple-touch-icon.png",
    "./assets/icons/splash-1290x2796.png",
    "./assets/icons/splash-1284x2778.png",
    "./assets/icons/splash-1179x2556.png",
    "./assets/icons/splash-1170x2532.png",
    "./assets/fonts/Inter-Regular.woff2",
    "./assets/fonts/Inter-Medium.woff2",
    "./js/lib/icons.js",
    "./js/lib/haptic.js",
    "./js/lib/nav.js",
    "./js/lib/toast.js",
    "./js/lib/sw-register.js",
    "./js/lib/crypto-utils.js",
    "./js/lib/auth.js",
    "./js/lib/list-nav.js",
    "./js/lib/reauth.js",
    "./js/lib/sync.js",
    "./js/pages/login.js",
    "./js/pages/vault.js",
    "./js/pages/add-entry.js",
    "./js/pages/settings.js",
    "./js/lib/totp.js",
    "./js/lib/qr.js",
    "./js/lib/health.js",
    "./js/pages/trash.js",
    "./js/pages/archive.js",
    "./js/pages/history.js",
    "./js/lib/biometric.js",
    "./js/lib/markdown.js",
    "./js/lib/recovery.js",
    "./js/lib/portation.js",
    "./js/pages/tags.js"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => cache.addAll(ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

const FAVICON_CACHE = "securevault-favicons";

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);

    // Favicons: cache-first in a dedicated cache. Cross-origin opaque
    // responses are fine to store + re-serve to an <img>. This stops
    // the list re-fetching icons on every render.
    if (url.hostname === "www.google.com" && url.pathname.startsWith("/s2/favicons")) {
        event.respondWith(
            caches.open(FAVICON_CACHE).then(cache =>
                cache.match(req).then(hit =>
                    hit || fetch(req).then(res => {
                        cache.put(req, res.clone());
                        return res;
                    }).catch(() => hit)
                )
            )
        );
        return;
    }

    // Same-origin only — never cache the GitHub Gist API or anything else.
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        caches.match(req).then(cached => {
            if (cached) return cached;
            return fetch(req).then(res => {
                // Stash future successful GETs so navigation works offline.
                if (res && res.status === 200 && res.type === "basic") {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put(req, copy));
                }
                return res;
            }).catch(() => cached);
        })
    );
});

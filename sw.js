// ============================================================
// SW.JS — service worker for offline + installability.
// Caches the static shell on install; serves from cache first
// with a network fallback. The encrypted vault lives in
// localStorage and never touches this cache.
// ============================================================

const CACHE = "securevault-v2";

const ASSETS = [
    "./",
    "./login.html",
    "./vault.html",
    "./add-entry.html",
    "./settings.html",
    "./trash.html",
    "./styles.css",
    "./manifest.webmanifest",
    "./icons/icon.svg",
    "./fonts/Inter-Regular.woff2",
    "./fonts/Inter-Medium.woff2",
    "./js/icons.js",
    "./js/nav.js",
    "./js/toast.js",
    "./js/sw-register.js",
    "./js/crypto-utils.js",
    "./js/auth.js",
    "./js/sync.js",
    "./js/login.js",
    "./js/vault.js",
    "./js/add-entry.js",
    "./js/settings.js",
    "./js/totp.js",
    "./js/health.js",
    "./js/trash.js"
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

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;

    // Same-origin only — never cache the GitHub Gist API or anything else.
    const url = new URL(req.url);
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

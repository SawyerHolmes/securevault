// Register the service worker so the app installs + works offline.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {
            // Service workers don't work over file:// — that's expected
            // when opening the HTML files locally without a server.
        });
    });
}

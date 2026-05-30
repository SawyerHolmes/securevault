// ============================================================
// SYNC-STATUS.JS — small black square in the header tracking
// network state + push/pull progress. Lives on every page that
// loads nav.js so the indicator is consistent everywhere the
// header pill is shown. If sync.js is loaded on the page the
// existing pushToGist / pullFromGist are transparently wrapped
// so the dot flips to "syncing" / "error" as appropriate; on
// pages without sync.js the dot still tracks online / offline.
// lastSyncAt persists in localStorage so the "Synced Xm ago"
// hover survives reloads.
// ============================================================
(function () {
    let pill;
    let lastSyncAt = parseInt(localStorage.getItem("lastSyncAt") || "0", 10);

    function relativeTime(ts) {
        const s = Math.floor((Date.now() - ts) / 1000);
        if (s < 5)      return "just now";
        if (s < 60)     return s + "s ago";
        if (s < 3600)   return Math.floor(s / 60) + "m ago";
        if (s < 86400)  return Math.floor(s / 3600) + "h ago";
        return Math.floor(s / 86400) + "d ago";
    }

    function setState(state, title) {
        if (!pill) return;
        pill.setAttribute("data-state", state);
        pill.setAttribute("title", title);
        pill.setAttribute("aria-label", "Sync status: " + title);
    }

    function refresh() {
        if (!pill) return;
        if (!navigator.onLine) {
            setState("offline", "Offline — vault still works locally");
            return;
        }
        const hasSync = typeof window.syncConfigured === "function";
        if (lastSyncAt)   setState("online", "Synced " + relativeTime(lastSyncAt));
        else if (hasSync) setState("online", "Online — not synced yet");
        else              setState("online", "Online");
    }

    function wrap(fnName) {
        const orig = window[fnName];
        if (typeof orig !== "function") return;
        window[fnName] = async function () {
            setState("syncing", "Syncing…");
            try {
                const r = await orig.apply(this, arguments);
                lastSyncAt = Date.now();
                localStorage.setItem("lastSyncAt", String(lastSyncAt));
                refresh();
                return r;
            } catch (e) {
                setState("error", "Sync error — last action did not sync");
                setTimeout(refresh, 4000);
                throw e;
            }
        };
    }

    function init() {
        const menu = document.querySelector("header .menu");
        if (!menu) return;
        pill = document.createElement("span");
        pill.className = "sync-pill";
        menu.insertBefore(pill, menu.firstChild);
        refresh();
        wrap("pushToGist");
        wrap("pullFromGist");
    }

    window.addEventListener("online",  refresh);
    window.addEventListener("offline", refresh);
    setInterval(refresh, 60 * 1000);  // keep the "Xm ago" hover fresh

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

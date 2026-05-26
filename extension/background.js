// ============================================================
// BACKGROUND.JS — extension service worker.
//
// Coordinates the autofill flow:
//   1) request-fill   ← content script (origin tab)
//      → Open the vault URL with a hash-encoded requestId + origin
//      → Remember which tab originated the request
//   2) vault-pick     ← content script (vault tab, relaying postMessage)
//      → Look up the request, send the credential payload to the
//        original tab, close the vault tab.
//   3) open-vault     ← popup
//      → Just opens the stored vault URL with no fill request.
// ============================================================

const REQUEST_TTL_MS = 5 * 60 * 1000;
const pendingRequests = new Map(); // requestId → { sourceTabId, vaultTabId, origin, expires }

function newRequestId() {
    return Math.random().toString(36).slice(2, 18);
}

function purgeExpired() {
    const now = Date.now();
    for (const [id, req] of pendingRequests) {
        if (req.expires < now) pendingRequests.delete(id);
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message) return false;

    if (message.type === "open-vault") {
        chrome.storage.local.get(["vaultUrl"], result => {
            if (result.vaultUrl) chrome.tabs.create({ url: result.vaultUrl });
            else                 chrome.runtime.openOptionsPage();
        });
        sendResponse({ ok: true });
        return true;
    }

    if (message.type === "request-fill") {
        chrome.storage.local.get(["vaultUrl"], result => {
            if (!result.vaultUrl) { chrome.runtime.openOptionsPage(); return; }
            purgeExpired();
            const requestId    = newRequestId();
            const sourceTabId  = sender.tab && sender.tab.id;
            const origin       = message.origin || "";
            const fillHashUrl  = result.vaultUrl
                + (result.vaultUrl.includes("#") ? "&" : "#")
                + "sv-fill=" + requestId
                + "&origin=" + encodeURIComponent(origin);
            chrome.tabs.create({ url: fillHashUrl }, vaultTab => {
                pendingRequests.set(requestId, {
                    sourceTabId,
                    vaultTabId: vaultTab.id,
                    origin,
                    expires: Date.now() + REQUEST_TTL_MS
                });
            });
        });
        sendResponse({ ok: true });
        return true;
    }

    if (message.type === "vault-pick") {
        const req = pendingRequests.get(message.requestId);
        if (!req) { sendResponse({ ok: false, error: "expired" }); return true; }
        pendingRequests.delete(message.requestId);
        chrome.tabs.sendMessage(req.sourceTabId, {
            type:     "fill",
            username: message.username || "",
            password: message.password || ""
        }, () => {
            // Ignore lastError; the source tab may have been navigated away.
            void chrome.runtime.lastError;
        });
        // Close the vault tab that served the pick
        if (req.vaultTabId) chrome.tabs.remove(req.vaultTabId, () => { void chrome.runtime.lastError; });
        sendResponse({ ok: true });
        return true;
    }

    return false;
});

// Drop pending requests if the vault tab gets closed without a pick
chrome.tabs.onRemoved.addListener(tabId => {
    for (const [id, req] of pendingRequests) {
        if (req.vaultTabId === tabId) pendingRequests.delete(id);
    }
});

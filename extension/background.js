// ============================================================
// BACKGROUND.JS — extension service worker.
// Single job for now: handle "open-vault" messages from the
// content script and open the stored vault URL in a new tab.
// ============================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === "open-vault") {
        chrome.storage.local.get(["vaultUrl"], result => {
            if (result.vaultUrl) {
                chrome.tabs.create({ url: result.vaultUrl });
            } else {
                chrome.runtime.openOptionsPage();
            }
        });
        sendResponse({ ok: true });
        return true;
    }
    return false;
});

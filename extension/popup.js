// ============================================================
// POPUP.JS — Securevault toolbar popup.
// Persists the user's vault URL and opens it in a new tab.
// ============================================================

const urlInput   = document.getElementById("vault-url");
const openBtn    = document.getElementById("open-vault");
const statusEl   = document.getElementById("status");

chrome.storage.local.get(["vaultUrl"], result => {
    if (result.vaultUrl) urlInput.value = result.vaultUrl;
});

openBtn.addEventListener("click", () => {
    const url = (urlInput.value || "").trim();
    if (!url) { statusEl.textContent = "Enter your vault URL."; return; }
    if (!/^https?:\/\//.test(url)) {
        statusEl.textContent = "URL must start with http(s)://";
        return;
    }
    chrome.storage.local.set({ vaultUrl: url }, () => {
        chrome.tabs.create({ url });
    });
});

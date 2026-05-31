// ============================================================
// HISTORY.JS — flat chronological log of every password change.
// Each row reveals the previous password on click and supports
// copy to clipboard.
// ============================================================

checkAuth();
startActivityTracking();

let vault = [];
const list = document.getElementById("history-list");

async function loadVault() {
    const key = await getStoredKey();
    if (!key) { logout(); return; }
    const encrypted = localStorage.getItem("vault");
    if (!encrypted) { vault = []; return; }
    try   { vault = await decryptData(encrypted, key); }
    catch { sessionStorage.clear(); window.location.replace("login.html"); }
}

function formatDate(ts) {
    const diff = Date.now() - ts;
    const day  = 24 * 60 * 60 * 1000;
    const days = Math.floor(diff / day);
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7)  return days + " days ago";
    if (days < 30) return Math.floor(days / 7)   + " weeks ago";
    if (days < 365) return Math.floor(days / 30) + " months ago";
    return Math.floor(days / 365) + " years ago";
}

function render() {
    list.innerHTML = "";

    // Flatten across entries: { entryName, oldPassword, changedAt }
    const items = [];
    for (const entry of vault) {
        if (!entry.passwordHistory || !entry.passwordHistory.length) continue;
        for (const h of entry.passwordHistory) {
            items.push({
                entryId: entry.id,
                entryName: entry.name || "No title",
                value: h.value,
                changedAt: h.changedAt
            });
        }
    }
    items.sort((a, b) => b.changedAt - a.changedAt);

    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML =
            '<div class="empty-icon"><span class="empty-icon-shape"></span></div>' +
            '<h2>No password changes yet</h2>' +
            '<p>When you change an entry\'s password, the old one shows up here so you can recover it if a site rejects the new one.</p>';
        list.appendChild(empty);
        return;
    }

    items.forEach((it, i) => {
        const row = document.createElement("div");
        row.className = "vault-card history-row";

        const num = document.createElement("div");
        num.className   = "row-num";
        num.textContent = String(i + 1).padStart(2, "0");
        row.appendChild(num);

        const text = document.createElement("div");
        text.className = "row-text";

        const h2 = document.createElement("h2");
        h2.className   = "row-name";
        h2.textContent = it.entryName;
        text.appendChild(h2);

        const sub = document.createElement("p");
        sub.className   = "row-username";
        sub.textContent = `Changed ${formatDate(it.changedAt)} · ${it.value.length} chars`;
        text.appendChild(sub);

        const reveal = document.createElement("div");
        reveal.className = "history-reveal";
        reveal.textContent = "••••••••";
        text.appendChild(reveal);

        row.appendChild(text);

        const actionsCell = document.createElement("div");
        actionsCell.className = "trash-row-actions";

        const showBtn = document.createElement("button");
        showBtn.type        = "button";
        showBtn.className   = "btn-white btn-row";
        showBtn.textContent = "Show";
        showBtn.addEventListener("click", () => {
            const showing = reveal.dataset.shown === "1";
            reveal.textContent     = showing ? "••••••••" : it.value;
            reveal.dataset.shown   = showing ? "0" : "1";
            showBtn.textContent    = showing ? "Show" : "Hide";
        });
        actionsCell.appendChild(showBtn);

        const copyBtn = document.createElement("button");
        copyBtn.type        = "button";
        copyBtn.className   = "btn-white btn-row";
        copyBtn.textContent = "Copy";
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(it.value).then(() => {
                window.showToast("Old password copied", { duration: 1500 });
            });
        });
        actionsCell.appendChild(copyBtn);

        row.appendChild(actionsCell);
        list.appendChild(row);
    });

    renderIcons();
}

document.getElementById("logout-btn").addEventListener("click", logout);

(async () => {
    await loadVault();
    render();
})();

// Keyboard list navigation (j / k / arrows) — outline-only; no Enter binding.
if (typeof attachListNav === "function") attachListNav(list);

// ============================================================
// TRASH.JS — list, restore, or permanently delete trashed entries.
// Active vault filter happens elsewhere; here we show the inverse.
// ============================================================

checkAuth();
startActivityTracking();

let vault = [];
let pendingPermanentDelete = null;

const list           = document.getElementById("trash-list");
const actions        = document.getElementById("trash-actions");
const emptyBtn       = document.getElementById("empty-trash-btn");
const confirmOverlay = document.getElementById("confirmation-overlay");
const confirmYes     = document.getElementById("confirm-yes");
const confirmNo      = document.getElementById("confirm-no");
const confirmMsg     = document.getElementById("confirm-message");

async function loadVault() {
    const key = await getStoredKey();
    if (!key) { logout(); return; }
    const encrypted = localStorage.getItem("vault");
    if (!encrypted) { vault = []; return; }
    try   { vault = await decryptData(encrypted, key); }
    catch { sessionStorage.clear(); window.location.replace("login.html"); }
}

async function saveVault() {
    const key = await getStoredKey();
    if (!key) { logout(); return; }
    localStorage.setItem("vault", await encryptData(vault, key));
    if (typeof pushToGist === "function") pushToGist().catch(() => {});
}

function formatRelative(ts) {
    const diff = Date.now() - ts;
    const day  = 24 * 60 * 60 * 1000;
    const days = Math.floor(diff / day);
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return days + " days ago";
    return Math.floor(days / 7) + " weeks ago";
}

function render() {
    list.innerHTML = "";
    const trashed = vault
        .filter(e => !!e.deleted)
        .sort((a, b) => b.deleted - a.deleted);

    if (!trashed.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML =
            '<div class="empty-icon"><span class="empty-icon-shape"></span></div>' +
            '<h2>Trash is empty</h2>' +
            '<p>Deleted entries show up here for 30 days before they\'re purged.</p>';
        list.appendChild(empty);
        actions.style.display = "none";
        return;
    }

    actions.style.display = "";

    trashed.forEach((entry, i) => {
        const card = document.createElement("div");
        card.className = "vault-card";

        const num = document.createElement("div");
        num.className   = "row-num";
        num.textContent = String(i + 1).padStart(2, "0");
        card.appendChild(num);

        const text = document.createElement("div");
        text.className = "row-text";

        const h2 = document.createElement("h2");
        h2.className   = "row-name";
        h2.textContent = entry.name || "No title";
        text.appendChild(h2);

        const sub = document.createElement("p");
        sub.className   = "row-username";
        sub.textContent = `${(entry.type || "login").toUpperCase()} · Deleted ${formatRelative(entry.deleted)}`;
        text.appendChild(sub);
        card.appendChild(text);

        const actionsCell = document.createElement("div");
        actionsCell.className = "trash-row-actions";

        const restore = document.createElement("button");
        restore.type        = "button";
        restore.className   = "btn-white btn-row";
        restore.textContent = "Restore";
        restore.addEventListener("click", async () => {
            delete entry.deleted;
            await saveVault();
            window.showToast("Restored", { tone: "success", duration: 1500 });
            render();
        });
        actionsCell.appendChild(restore);

        const perm = document.createElement("button");
        perm.type        = "button";
        perm.className   = "btn-danger btn-row";
        perm.textContent = "Delete";
        perm.addEventListener("click", () => {
            pendingPermanentDelete = entry.id;
            confirmMsg.textContent = `Permanently delete “${entry.name || "this entry"}”? This cannot be undone.`;
            confirmOverlay.style.display = "flex";
        });
        actionsCell.appendChild(perm);

        card.appendChild(actionsCell);
        list.appendChild(card);
    });

    renderIcons();
}

confirmYes.addEventListener("click", async () => {
    confirmOverlay.style.display = "none";
    if (pendingPermanentDelete === "ALL") {
        vault = vault.filter(e => !e.deleted);
    } else if (pendingPermanentDelete) {
        const idx = vault.findIndex(e => e.id === pendingPermanentDelete);
        if (idx >= 0) vault.splice(idx, 1);
    }
    pendingPermanentDelete = null;
    await saveVault();
    window.showToast("Permanently deleted", { tone: "error", duration: 1500 });
    render();
});
confirmNo.addEventListener("click", () => {
    pendingPermanentDelete = null;
    confirmOverlay.style.display = "none";
});
confirmOverlay.addEventListener("click", e => {
    if (e.target === confirmOverlay) { pendingPermanentDelete = null; confirmOverlay.style.display = "none"; }
});

emptyBtn.addEventListener("click", () => {
    pendingPermanentDelete = "ALL";
    confirmMsg.textContent = "Permanently delete every entry in the trash? This cannot be undone.";
    confirmOverlay.style.display = "flex";
});

document.getElementById("logout-btn").addEventListener("click", logout);

(async () => {
    await loadVault();
    render();
})();

// Keyboard list navigation (j / k / arrows) — outline-only; no Enter binding.
if (typeof attachListNav === "function") attachListNav(list);

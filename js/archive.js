// ============================================================
// ARCHIVE.JS — list archived entries; unarchive returns them to
// the active vault. Unlike trash, archive is forever (until you
// unarchive or delete).
// ============================================================

checkAuth();
startActivityTracking();

let vault = [];
const list = document.getElementById("archive-list");

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
    if (days < 7)  return days + " days ago";
    if (days < 30) return Math.floor(days / 7)   + " weeks ago";
    if (days < 365) return Math.floor(days / 30) + " months ago";
    return Math.floor(days / 365) + " years ago";
}

function render() {
    list.innerHTML = "";
    const archived = vault
        .filter(e => !!e.archived && !e.deleted)
        .sort((a, b) => b.archived - a.archived);

    if (!archived.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML =
            '<div class="empty-icon"><span class="empty-icon-shape"></span></div>' +
            '<h2>Nothing archived</h2>' +
            '<p>Archive an entry from its detail view to move it out of the active vault.</p>';
        list.appendChild(empty);
        return;
    }

    archived.forEach((entry, i) => {
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
        sub.textContent = `${(entry.type || "login").toUpperCase()} · Archived ${formatRelative(entry.archived)}`;
        text.appendChild(sub);
        card.appendChild(text);

        const actionsCell = document.createElement("div");
        actionsCell.className = "trash-row-actions";

        const restore = document.createElement("button");
        restore.type        = "button";
        restore.className   = "btn-white btn-row";
        restore.textContent = "Unarchive";
        restore.addEventListener("click", async () => {
            delete entry.archived;
            await saveVault();
            window.showToast("Restored to vault", { tone: "success", duration: 1500 });
            render();
        });
        actionsCell.appendChild(restore);

        card.appendChild(actionsCell);
        list.appendChild(card);
    });

    renderIcons();
}

document.getElementById("logout-btn").addEventListener("click", logout);

(async () => {
    await loadVault();
    render();
})();

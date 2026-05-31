// ============================================================
// TAGS.JS — bulk tag management: rename, merge, delete.
// Operates on every entry's tags array directly.
// ============================================================

checkAuth();
startActivityTracking();

let vault = [];
const list = document.getElementById("tag-list");

const promptOverlay = document.getElementById("prompt-overlay");
const promptTitle   = document.getElementById("prompt-title");
const promptMessage = document.getElementById("prompt-message");
const promptInput   = document.getElementById("prompt-input");
const promptConfirm = document.getElementById("prompt-confirm");
const promptCancel  = document.getElementById("prompt-cancel");

const confirmOverlay = document.getElementById("confirmation-overlay");
const confirmMessage = document.getElementById("confirm-message");
const confirmYes     = document.getElementById("confirm-yes");
const confirmNo      = document.getElementById("confirm-no");

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

function ask(title, message, initial) {
    promptTitle.textContent   = title;
    promptMessage.textContent = message;
    promptInput.value         = initial || "";
    promptOverlay.style.display = "flex";
    promptInput.focus();
    return new Promise(resolve => {
        function done(value) {
            promptConfirm.removeEventListener("click", onConfirm);
            promptCancel.removeEventListener("click",  onCancel);
            promptInput.removeEventListener("keydown", onKey);
            promptOverlay.style.display = "none";
            resolve(value);
        }
        function onConfirm() { done(promptInput.value.trim().toLowerCase() || null); }
        function onCancel()  { done(null); }
        function onKey(e)    { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }
        promptConfirm.addEventListener("click", onConfirm);
        promptCancel.addEventListener("click",  onCancel);
        promptInput.addEventListener("keydown", onKey);
    });
}

function confirm2(message) {
    confirmMessage.textContent = message;
    confirmOverlay.style.display = "flex";
    return new Promise(resolve => {
        function done(ok) {
            confirmYes.removeEventListener("click", onYes);
            confirmNo.removeEventListener("click",  onNo);
            confirmOverlay.style.display = "none";
            resolve(ok);
        }
        function onYes() { done(true); }
        function onNo()  { done(false); }
        confirmYes.addEventListener("click", onYes);
        confirmNo.addEventListener("click",  onNo);
    });
}

function collectTags() {
    const counts = new Map();
    for (const entry of vault) {
        if (entry.deleted || entry.archived) continue;
        for (const t of (entry.tags || [])) {
            counts.set(t, (counts.get(t) || 0) + 1);
        }
    }
    return Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function renameTag(oldName, newName) {
    for (const entry of vault) {
        if (!entry.tags) continue;
        const next = [];
        for (const t of entry.tags) {
            if (t === oldName) {
                if (!next.includes(newName)) next.push(newName);
            } else {
                if (!next.includes(t)) next.push(t);
            }
        }
        entry.tags = next;
        if (!entry.tags.length) delete entry.tags;
    }
}

function deleteTag(name) {
    for (const entry of vault) {
        if (!entry.tags) continue;
        entry.tags = entry.tags.filter(t => t !== name);
        if (!entry.tags.length) delete entry.tags;
    }
}

function render() {
    list.innerHTML = "";
    const tags = collectTags();

    if (!tags.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.innerHTML =
            '<div class="empty-icon"><span class="empty-icon-shape"></span></div>' +
            '<h2>No tags yet</h2>' +
            '<p>Add a tag when creating or editing an entry to see it here.</p>';
        list.appendChild(empty);
        return;
    }

    tags.forEach(([tag, count], i) => {
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
        h2.textContent = tag;
        text.appendChild(h2);

        const sub = document.createElement("p");
        sub.className   = "row-username";
        sub.textContent = `${count} entr${count === 1 ? "y" : "ies"}`;
        text.appendChild(sub);

        card.appendChild(text);

        const actionsCell = document.createElement("div");
        actionsCell.className = "trash-row-actions";

        const renameBtn = document.createElement("button");
        renameBtn.type        = "button";
        renameBtn.className   = "btn-white btn-row";
        renameBtn.textContent = "Rename";
        renameBtn.addEventListener("click", async () => {
            const next = await ask("Rename tag", `Rename "${tag}" to:`, tag);
            if (!next || next === tag) return;
            renameTag(tag, next);
            await saveVault();
            window.showToast(`Renamed to "${next}"`, { tone: "success", duration: 1500 });
            render();
        });
        actionsCell.appendChild(renameBtn);

        const mergeBtn = document.createElement("button");
        mergeBtn.type        = "button";
        mergeBtn.className   = "btn-white btn-row";
        mergeBtn.textContent = "Merge";
        mergeBtn.addEventListener("click", async () => {
            const target = await ask("Merge tag", `Merge "${tag}" into which tag?`, "");
            if (!target || target === tag) return;
            renameTag(tag, target);
            await saveVault();
            window.showToast(`Merged into "${target}"`, { tone: "success", duration: 1500 });
            render();
        });
        actionsCell.appendChild(mergeBtn);

        const delBtn = document.createElement("button");
        delBtn.type        = "button";
        delBtn.className   = "btn-danger btn-row";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", async () => {
            const ok = await confirm2(`Remove "${tag}" from ${count} entr${count === 1 ? "y" : "ies"}? Entries themselves stay.`);
            if (!ok) return;
            deleteTag(tag);
            await saveVault();
            window.showToast(`Deleted "${tag}"`, { tone: "error", duration: 1500 });
            render();
        });
        actionsCell.appendChild(delBtn);

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

// Keyboard list navigation (j / k / arrows) — outline-only; no Enter binding.
if (typeof attachListNav === "function") attachListNav(document.getElementById("tag-list"));

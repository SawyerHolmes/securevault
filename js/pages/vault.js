// ============================================================
// VAULT.JS — SecureVault
// ============================================================

// ============================================================
// STATE
// ============================================================
let vault            = [];
let currentEntryId   = null;
let passwordVisible  = false;
let sortField        = "name";
let sortOrder        = "asc";
let activeTagFilter  = null;
let activeTypeFilter = null;  // null = all types; "login" | "note" | "card" otherwise
let selectMode       = false;
let selectedIds      = new Set();
let currentVisibleEntries = [];  // populated by renderVault, used by keyboard nav
let focusedIndex     = -1;       // index into currentVisibleEntries for j/k/arrow nav
let fillRequestId    = null;
let fillOrigin       = null;
let fillHost         = null;

function findEntry(id) {
    return vault.find(e => e.id === id);
}
function findEntryIndex(id) {
    return vault.findIndex(e => e.id === id);
}
function renderTagFilterBar() {
    const bar = document.getElementById("tag-filter-bar");
    if (!bar) return;

    // Discover present types + tags from the active set.
    const tagSet  = new Set();
    const typeSet = new Set();
    vault.forEach(e => {
        if (e.deleted || e.archived) return;
        (e.tags || []).forEach(t => tagSet.add(t));
        typeSet.add(e.type || "login");
    });
    const tags = Array.from(tagSet).sort();

    // Hide the bar only when there's nothing to choose from in either axis.
    if (!tags.length && typeSet.size <= 1) {
        bar.style.display = "none";
        bar.innerHTML = "";
        return;
    }
    bar.innerHTML  = "";
    bar.style.display = "";

    const mkTag = (label, value, isAll) => {
        const c = document.createElement("button");
        c.type      = "button";
        c.className = "tag-chip tag-chip-filter" +
            ((value === activeTagFilter || (isAll && !activeTagFilter && !activeTypeFilter)) ? " active" : "");
        c.textContent = label;
        c.addEventListener("click", () => {
            if (isAll) { activeTagFilter = null; activeTypeFilter = null; }
            else       { activeTagFilter = (activeTagFilter === value) ? null : value; }
            renderVault(searchInput.value);
        });
        return c;
    };

    const mkType = (label, type) => {
        const c = document.createElement("button");
        c.type      = "button";
        c.className = "tag-chip tag-chip-filter tag-chip-type" +
            (activeTypeFilter === type ? " active" : "");
        c.textContent = label;
        c.addEventListener("click", () => {
            activeTypeFilter = (activeTypeFilter === type) ? null : type;
            renderVault(searchInput.value);
        });
        return c;
    };

    bar.appendChild(mkTag("All", null, true));

    // Only surface type pills when more than one type actually exists in the
    // vault — otherwise filtering by type is pointless noise.
    if (typeSet.size > 1) {
        const TYPE_LABELS = { login: "Logins", note: "Notes", card: "Cards" };
        ["login", "note", "card"].forEach(t => {
            if (typeSet.has(t)) bar.appendChild(mkType(TYPE_LABELS[t], t));
        });
    }

    tags.forEach(t => bar.appendChild(mkTag(t, t, false)));
}

// Remembers which domains resolved a favicon this session so re-renders
// (search keystrokes, sort changes) don't flash the fallback letter or
// re-attempt icons that are known to 404. The bytes themselves are
// cached by the service worker.
const faviconStatus = new Map(); // domain -> "ok" | "fail"

function entryIconElement(entry) {
    const wrap = document.createElement("div");
    wrap.className = "row-icon";
    const type = entry.type || "login";

    // Cards and notes get a generic geometric mark — no domain to look up.
    if (type === "card") { wrap.textContent = "■"; wrap.classList.add("row-icon-glyph"); return wrap; }
    if (type === "note") { wrap.textContent = "≡"; wrap.classList.add("row-icon-glyph"); return wrap; }

    let domain = "";
    if (entry.url && /^https?:\/\//i.test(entry.url)) {
        try { domain = new URL(entry.url).hostname; } catch { domain = ""; }
    }

    const fallback = () => {
        wrap.textContent = (entry.name || "?")[0].toUpperCase();
        wrap.classList.add("row-icon-fallback");
    };

    // No domain, or we already know this domain has no favicon → letter
    if (!domain || faviconStatus.get(domain) === "fail") { fallback(); return wrap; }

    const img   = document.createElement("img");
    img.src     = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    img.alt     = "";
    img.loading = "lazy";
    img.addEventListener("load",  () => faviconStatus.set(domain, "ok"));
    img.addEventListener("error", () => {
        faviconStatus.set(domain, "fail");
        img.remove();
        fallback();
    });
    wrap.appendChild(img);
    return wrap;
}

function renderTagsInto(el, tags) {
    el.innerHTML = "";
    if (!tags || !tags.length) { el.textContent = "—"; return; }
    tags.forEach(t => {
        const chip = document.createElement("span");
        chip.className   = "tag-chip";
        chip.textContent = t;
        el.appendChild(chip);
    });
}

function entrySecondaryText(entry) {
    const type = entry.type || "login";
    if (type === "note") {
        const first = (entry.content || "").split("\n")[0].slice(0, 50);
        return first ? "Note · " + first : "Note";
    }
    if (type === "card") {
        const last4 = (entry.cardNumber || "").replace(/\s+/g, "").slice(-4);
        return last4 ? "Card · •••• " + last4 : "Card";
    }
    return entry.username || entry.url || "";
}
function newEntryId() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
           ("e_" + Date.now() + "_" + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, "0")).join(""));
}

const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {
    appearance:    "dark",
    viewMode:      "list",
    defaultSort:   "name",
    confirmDelete: true
};

// ============================================================
// AUTH
// ============================================================
checkAuth();
startActivityTracking();

window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// ============================================================
// ELEMENTS
// ============================================================
const vaultContainer    = document.getElementById("vault-container");
const searchInput       = document.getElementById("search-input");
const sortToggle        = document.getElementById("sort-toggle");
const sortMenu          = document.getElementById("sort-menu");
const expandedCard      = document.getElementById("expanded-card");
const expandedName      = document.getElementById("expanded-name");
const expandedUrl       = document.getElementById("expanded-url");
const expandedUsername  = document.getElementById("expanded-username");
const expandedPassword  = document.getElementById("expanded-password");
const expandedNotes     = document.getElementById("expanded-notes");
const expandedModified  = document.getElementById("expanded-modified");
const totpField         = document.getElementById("totp-field");
const expandedTotp      = document.getElementById("expanded-totp");
const expandedTotpRing  = document.getElementById("expanded-totp-ring");
const TOTP_RING_CIRC    = 2 * Math.PI * 13; // matches the SVG r=13
const copyTotpBtn       = document.getElementById("copy-totp-btn");
const editBtn           = document.getElementById("edit-btn");
const saveCancelWrapper = document.getElementById("save-cancel-wrapper");
const saveBtn           = document.getElementById("save-btn");
const cancelBtn         = document.getElementById("cancel-btn");
const togglePasswordBtn = document.getElementById("toggle-password");
const copyIconBtn       = document.getElementById("copy-btn");
const copyUsernameBtn   = document.getElementById("copy-username-btn");
const removeBtn         = document.getElementById("remove-btn");
const confirmOverlay    = document.getElementById("confirmation-overlay");
const confirmYes        = document.getElementById("confirm-yes");
const confirmNo         = document.getElementById("confirm-no");

// ============================================================
// LOAD / SAVE VAULT
// ============================================================
async function loadVault() {
    const key = await getStoredKey();
    if (!key) { logout(); return; }

    const encrypted = localStorage.getItem("vault");
    if (!encrypted) { vault = []; return; }

    try {
        vault = await decryptData(encrypted, key);
    } catch {
        sessionStorage.clear();
        window.location.replace("login.html");
        return;
    }

    // Backfill stable IDs + default type on any legacy entries
    let mutated = false;
    for (const entry of vault) {
        if (!entry.id)   { entry.id   = newEntryId(); mutated = true; }
        if (!entry.type) { entry.type = "login";      mutated = true; }
    }
    // Auto-purge trashed entries older than 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const before = vault.length;
    vault = vault.filter(e => !e.deleted || e.deleted > cutoff);
    if (vault.length !== before) mutated = true;
    if (mutated) saveVault();
}

async function saveVault() {
    const key = await getStoredKey();
    if (!key) { logout(); return; }
    localStorage.setItem("vault", await encryptData(vault, key));
    if (typeof pushToGist === "function") pushToGist().catch(() => {});
}

// ============================================================
// SETTINGS
// ============================================================
function applyAppearance() {
    let appearance = settings.appearance || (settings.lightMode ? "light" : "dark");
    if (appearance === "system") {
        appearance = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    const dark = appearance !== "light";
    document.body.classList.toggle("dark", dark);
    document.documentElement.classList.toggle("dark", dark);
}

// Live-update the theme if the OS scheme flips while in "system" mode
if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
        if ((settings.appearance || "dark") === "system") applyAppearance();
    });
}

function applyViewMode(mode) {
    mode = mode || settings.viewMode || "grid";
    document.body.classList.remove("grid-view", "list-view", "gallery-view");
    document.body.classList.add(mode + "-view");
    vaultContainer.classList.toggle("list-view", mode === "list");
}

// ============================================================
// CLIPBOARD + TOAST
// ============================================================
const CLIPBOARD_CLEAR_MS = 60 * 1000;
let clipboardClearTimer = null;

function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
        window.showToast(msg || "Copied", { duration: 1800 });
        haptic([8, 20, 8]);
        // Best-effort clipboard wipe after 60s so a copied password
        // doesn't linger. Browsers only allow clipboard writes while
        // the document has focus — if it fails, we silently move on.
        if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
        clipboardClearTimer = setTimeout(() => {
            navigator.clipboard.writeText("").catch(() => {});
        }, CLIPBOARD_CLEAR_MS);
    });
}

function markUsed(entry) {
    if (!entry) return;
    entry.lastUsed = Date.now();
    saveVault();
}

// ============================================================
// COPY MENU — small floating menu on vault cards
// ============================================================
let activeCopyMenu = null;

function closeCopyMenu() {
    if (activeCopyMenu) {
        activeCopyMenu.remove();
        activeCopyMenu = null;
    }
}

function showCopyMenu(e, entry) {
    e.stopPropagation();
    closeCopyMenu();
    haptic(4);

    const menu = document.createElement("div");
    menu.className = "copy-menu";

    [
        { label: "Copy username", value: entry.username || "", msg: "Username copied!" },
        { label: "Copy password", value: entry.password || "", msg: "Password copied!" },
    ].forEach(item => {
        const btn = document.createElement("button");
        btn.className   = "copy-menu-item";
        btn.textContent = item.label;
        btn.addEventListener("click", ev => {
            ev.stopPropagation();
            copyToClipboard(item.value, item.msg);
            closeCopyMenu();
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    activeCopyMenu = menu;

    const rect     = e.currentTarget.getBoundingClientRect();
    const mRect    = menu.getBoundingClientRect();
    let top  = rect.bottom + 6;
    let left = rect.left;

    if (left + mRect.width > window.innerWidth - 12)  left = window.innerWidth - mRect.width - 12;
    if (top  + mRect.height > window.innerHeight - 12) top  = rect.top - mRect.height - 6;

    menu.style.top     = top  + "px";
    menu.style.left    = left + "px";
    menu.style.opacity = "1";
}

document.addEventListener("click", () => closeCopyMenu());
// Menu is position: fixed, so it would visually detach from its trigger
// if the page scrolls. Close it instead.
window.addEventListener("scroll", () => closeCopyMenu(), { passive: true });

// ============================================================
// FORMAT DATE
// ============================================================
function formatDate(ts) {
    if (!ts) return null;
    return new Date(ts).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric"
    });
}

// ============================================================
// RENDER VAULT
// ============================================================
function renderVault(filter) {
    filter = filter || "";
    vaultContainer.innerHTML = "";
    renderTagFilterBar();

    // Active vault excludes soft-deleted + archived entries
    let items = vault.filter(e => !e.deleted && !e.archived);
    if (fillRequestId) {
        // In fill mode show only login entries whose URL matches the origin
        items = items.filter(e => (e.type || "login") === "login" && entryMatchesFill(e));
    }
    if (activeTagFilter) {
        items = items.filter(e => (e.tags || []).includes(activeTagFilter));
    }
    if (activeTypeFilter) {
        items = items.filter(e => (e.type || "login") === activeTypeFilter);
    }
    const q = filter.toLowerCase();

    if (q) {
        items = items.filter(e =>
            (e.name       || "").toLowerCase().includes(q) ||
            (e.username   || "").toLowerCase().includes(q) ||
            (e.url        || "").toLowerCase().includes(q) ||
            (e.notes      || "").toLowerCase().includes(q) ||
            (e.content    || "").toLowerCase().includes(q) ||
            (e.cardholder || "").toLowerCase().includes(q) ||
            (e.cardNumber || "").toLowerCase().includes(q) ||
            (e.tags       || []).some(t => t.toLowerCase().includes(q))
        );
    }

    if (sortField === "manual") {
        items.sort((a, b) => {
            const va = (typeof a.order === "number") ? a.order : Number.MAX_SAFE_INTEGER;
            const vb = (typeof b.order === "number") ? b.order : Number.MAX_SAFE_INTEGER;
            return sortOrder === "asc" ? (va - vb) : (vb - va);
        });
    } else if (sortField === "lastUsed") {
        items.sort((a, b) => {
            // Default sort for "Recently used" is descending (newest first)
            const va = a.lastUsed || 0;
            const vb = b.lastUsed || 0;
            return sortOrder === "asc" ? (va - vb) : (vb - va);
        });
    } else {
        items.sort((a, b) => {
            const va = (a[sortField] || "").toLowerCase();
            const vb = (b[sortField] || "").toLowerCase();
            if (va < vb) return sortOrder === "asc" ? -1 : 1;
            if (va > vb) return sortOrder === "asc" ?  1 : -1;
            return 0;
        });
    }

    // Snapshot what's about to be drawn so keyboard nav can index into it.
    // Resetting focus on every render keeps things predictable across
    // filter / sort changes — the next Arrow / j / k re-focuses row 0.
    currentVisibleEntries = items;
    focusedIndex = -1;

    if (!items.length) {
        const div = document.createElement("div");
        div.className = "empty-state";
        div.innerHTML = q
            ? `<div class="empty-icon"><span class="empty-icon-shape search"></span></div>
               <h2>No results</h2><p>Try a different search term</p>`
            : `<div class="empty-icon"><span class="empty-icon-shape"></span></div>
               <h2>Your vault is empty</h2>
               <p>Add your first password to get started</p>
               <a href="add-entry.html" class="empty-add-btn">Add entry</a>`;
        vaultContainer.appendChild(div);
        return;
    }

    const viewMode = settings.viewMode || "list";

    // ---- GRID VIEW (square tiles, denser than list, more info than gallery) ----
    if (viewMode === "grid") {
        vaultContainer.style.display = "";
        items.forEach((entry, i) => {
            const tile     = document.createElement("div");
            tile.className = "vault-grid-tile";

            const head = document.createElement("div");
            head.className = "tile-head";
            const num = document.createElement("div");
            num.className   = "tile-num";
            num.textContent = String(i + 1).padStart(2, "0");
            head.appendChild(num);

            const icon = entryIconElement(entry);
            icon.classList.add("tile-icon");
            head.appendChild(icon);
            tile.appendChild(head);

            const name = document.createElement("h2");
            name.className   = "tile-name";
            name.textContent = entry.name || "No title";
            tile.appendChild(name);

            const secondary = entrySecondaryText(entry);
            if (secondary) {
                const url = document.createElement("p");
                url.className   = "tile-url";
                url.textContent = secondary;
                tile.appendChild(url);
            }

            const bottom = document.createElement("div");
            bottom.className = "tile-bottom";

            const user = document.createElement("p");
            user.className   = "tile-username";
            user.textContent = (entry.type === "login")
                ? (entry.url || "")
                : ((entry.type || "login").toUpperCase());
            bottom.appendChild(user);

            const cb = document.createElement("button");
            cb.className = "card-copy-btn";
            cb.setAttribute("aria-label", "Copy credentials");
            cb.innerHTML = `<i data-lucide="copy"></i>`;
            cb.addEventListener("click", e => showCopyMenu(e, entry));
            bottom.appendChild(cb);

            tile.appendChild(bottom);

            tile.dataset.id = entry.id;
            tile.addEventListener("click", e => {
                if (e.target.closest(".card-copy-btn")) return;
                haptic(6); openCard(entry);
            });
            vaultContainer.appendChild(tile);
        });
        renderIcons();
        return;
    }

    // ---- GALLERY VIEW ----
    if (viewMode === "gallery") {
        vaultContainer.style.display = "";
        items.forEach(entry => {
            const card      = document.createElement("div");
            card.className  = "vault-gallery-card";

            const icon = document.createElement("div");
            icon.className = "gallery-icon";
            if (entry.url && /^https?:\/\//i.test(entry.url)) {
                try {
                    const domain = new URL(entry.url).hostname;
                    const img    = document.createElement("img");
                    img.src      = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
                    img.onerror  = () => { icon.textContent = (entry.name || "?")[0].toUpperCase(); };
                    icon.appendChild(img);
                } catch { icon.textContent = (entry.name || "?")[0].toUpperCase(); }
            } else {
                icon.textContent = (entry.name || "?")[0].toUpperCase();
            }

            const title   = document.createElement("div");
            title.className   = "gallery-title";
            title.textContent = entry.name || "No title";

            const sub   = document.createElement("div");
            sub.className   = "gallery-subtitle";
            sub.textContent = entrySecondaryText(entry);

            const cb = document.createElement("button");
            cb.className = "gallery-copy-btn";
            cb.setAttribute("aria-label", "Copy credentials");
            cb.innerHTML = `<i data-lucide="copy"></i>`;
            cb.addEventListener("click", e => showCopyMenu(e, entry));

            card.appendChild(icon);
            card.appendChild(title);
            card.appendChild(sub);
            card.appendChild(cb);
            card.dataset.id = entry.id;
            card.addEventListener("click", e => {
                if (e.target.closest(".gallery-copy-btn")) return;
                haptic(6); openCard(entry);
            });
            vaultContainer.appendChild(card);
        });
        renderIcons();
        return;
    }

    // ---- LIST VIEW (default — horizontal stripes) ----
    vaultContainer.style.display = "";
    items.forEach((entry, i) => {
        const card     = document.createElement("div");
        card.className = "vault-card";
        if (selectedIds.has(entry.id)) card.classList.add("selected");

        const checkbox = document.createElement("div");
        checkbox.className = "vault-card-checkbox";
        if (selectedIds.has(entry.id)) checkbox.classList.add("checked");
        card.appendChild(checkbox);

        const num = document.createElement("div");
        num.className   = "row-num";
        num.textContent = String(i + 1).padStart(2, "0");
        card.appendChild(num);

        card.appendChild(entryIconElement(entry));

        const text = document.createElement("div");
        text.className = "row-text";

        const h2 = document.createElement("h2");
        h2.className   = "row-name";
        h2.textContent = entry.name || "No title";
        text.appendChild(h2);

        const sub = document.createElement("p");
        sub.className   = "row-username";
        sub.textContent = entrySecondaryText(entry);
        text.appendChild(sub);

        if (entry.tags && entry.tags.length) {
            const tagBar = document.createElement("div");
            tagBar.className = "row-tags";
            entry.tags.slice(0, 3).forEach(t => {
                const chip = document.createElement("span");
                chip.className   = "tag-chip-small";
                chip.textContent = t;
                tagBar.appendChild(chip);
            });
            text.appendChild(tagBar);
        }

        card.appendChild(text);

        const cb = document.createElement("button");
        cb.className = "card-copy-btn";
        cb.setAttribute("aria-label", "Copy credentials");
        cb.innerHTML = `<i data-lucide="copy"></i>`;
        cb.addEventListener("click", e => showCopyMenu(e, entry));
        card.appendChild(cb);

        card.dataset.id = entry.id;
        card.addEventListener("click", e => {
            // Swipe just snapped this row open/closed — swallow the trailing click.
            if (card.dataset.suppressClick === "1") {
                delete card.dataset.suppressClick;
                e.stopPropagation();
                return;
            }
            if (fillRequestId) {
                if (e.target.closest(".card-copy-btn")) return;
                sendFillPick(entry);
                return;
            }
            if (selectMode) {
                if (selectedIds.has(entry.id)) selectedIds.delete(entry.id);
                else                            selectedIds.add(entry.id);
                updateBulkCount();
                renderVault(searchInput.value);
                haptic(4);
                return;
            }
            if (e.target.closest(".card-copy-btn")) return;
            haptic(6); openCard(entry);
        });
        card.addEventListener("contextmenu", e => {
            if (isTouchDevice) return;
            if (selectMode || fillRequestId) return;
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, entry, card);
        });
        if (sortField === "manual" && !selectMode && !fillRequestId) attachDragReorder(card, entry);

        // Touch-only: wrap with a swipe row exposing Copy / Archive / Delete.
        if (isTouchDevice && !selectMode && !fillRequestId) {
            vaultContainer.appendChild(wrapWithSwipeRow(card, entry));
        } else {
            vaultContainer.appendChild(card);
        }
    });
    renderIcons();
    updateVaultMeta();
}

// HTML5 drag-and-drop: only enabled in manual sort mode.
function attachDragReorder(card, entry) {
    card.draggable = true;
    card.classList.add("draggable");
    card.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", entry.id);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    card.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", e => {
        e.preventDefault();
        card.classList.remove("drag-over");
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === entry.id) return;
        reorderEntries(draggedId, entry.id);
    });
}

function reorderEntries(draggedId, targetId) {
    const displayed = vault
        .filter(e => !e.deleted && !e.archived)
        .sort((a, b) => {
            const va = (typeof a.order === "number") ? a.order : Number.MAX_SAFE_INTEGER;
            const vb = (typeof b.order === "number") ? b.order : Number.MAX_SAFE_INTEGER;
            return va - vb;
        });
    const fromIdx = displayed.findIndex(e => e.id === draggedId);
    let   toIdx   = displayed.findIndex(e => e.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = displayed.splice(fromIdx, 1);
    if (toIdx > fromIdx) toIdx -= 1;
    displayed.splice(toIdx, 0, moved);
    displayed.forEach((e, i) => { e.order = i; });
    saveVault();
    renderVault(searchInput.value);
    haptic(6);
}

// ============================================================
// EXPANDED CARD
// ============================================================
let expandedCardRelease = null;
let totpTimer           = null;

async function refreshTotp() {
    const entry = findEntry(currentEntryId);
    if (!entry || !entry.totp) return;
    try {
        const { code, secondsRemaining, period } = await generateTOTP(entry.totp);
        expandedTotp.textContent  = formatTOTP(code);
        expandedTotp.dataset.code = code;

        // Ring fill represents seconds remaining: full at 30s, empty at 0s.
        const newOffset = TOTP_RING_CIRC * (1 - secondsRemaining / period);
        const oldOffset = parseFloat(expandedTotpRing.style.strokeDashoffset || "0");
        // Rollover (offset would animate backwards) — snap without transition.
        if (newOffset < oldOffset - 1) {
            expandedTotpRing.style.transition = "none";
            expandedTotpRing.style.strokeDashoffset = String(newOffset);
            void expandedTotpRing.offsetWidth; // force a reflow
            expandedTotpRing.style.transition = "";
        } else {
            expandedTotpRing.style.strokeDashoffset = String(newOffset);
        }
        expandedTotpRing.classList.toggle("low", secondsRemaining <= 5);
    } catch {
        expandedTotp.textContent = "Invalid secret";
        expandedTotpRing.style.strokeDashoffset = String(TOTP_RING_CIRC);
        expandedTotpRing.classList.remove("low");
        delete expandedTotp.dataset.code;
    }
}

function stopTotpTimer() {
    if (totpTimer) { clearInterval(totpTimer); totpTimer = null; }
}

function openCard(entry) {
    currentEntryId  = entry.id;
    passwordVisible = false;
    markUsed(entry);

    document.body.dataset.viewType = entry.type || "login";

    expandedName.textContent = entry.name || "No title";

    const urlField = document.getElementById("url-field");
    if (entry.url) {
        expandedUrl.innerHTML = "";
        const safeUrl = /^https?:\/\//i.test(entry.url) ? entry.url : "#";
        const a = document.createElement("a");
        a.href = safeUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
        a.textContent = entry.url;
        expandedUrl.appendChild(a);
        urlField.style.display = "";
    } else {
        urlField.style.display = "none";
    }

    expandedUsername.textContent = entry.username || "—";
    expandedPassword.textContent = "••••••••";
    expandedNotes.innerHTML = entry.notes
        ? renderMarkdown(entry.notes)
        : '<span class="value-empty">No notes</span>';

    // Tags
    const tagsEl = document.getElementById("expanded-tags");
    if (tagsEl) renderTagsInto(tagsEl, entry.tags);

    // Type-specific fields
    const cardholderEl = document.getElementById("expanded-cardholder");
    const cardNumberEl = document.getElementById("expanded-card-number");
    const cardExpiryEl = document.getElementById("expanded-card-expiry");
    const cardCvvEl    = document.getElementById("expanded-card-cvv");
    const contentEl    = document.getElementById("expanded-content");
    if (cardholderEl) cardholderEl.textContent = entry.cardholder || "—";
    if (cardNumberEl) cardNumberEl.textContent = entry.cardNumber || "—";
    if (cardExpiryEl) cardExpiryEl.textContent = entry.cardExpiry || "—";
    if (cardCvvEl)    cardCvvEl.textContent    = "•••";
    if (contentEl)    contentEl.innerHTML = entry.content
        ? renderMarkdown(entry.content)
        : '<span class="value-empty">—</span>';

    // Surface a "found in N breaches" warning if the user has run a
    // health scan and this password came back compromised.
    const warning = document.getElementById("password-warning");
    if (warning) {
        const breachCount = typeof breachCache !== "undefined" && entry.password
            ? breachCache.get(entry.password) : undefined;
        if (typeof breachCount === "number" && breachCount > 0) {
            warning.textContent  = `Found in ${breachCount.toLocaleString()} breach${breachCount === 1 ? "" : "es"} — change it`;
            warning.style.display = "flex";
        } else {
            warning.style.display = "none";
        }
    }

    if (expandedModified) {
        const date = formatDate(entry.updatedAt || entry.createdAt);
        expandedModified.textContent   = date ? `Modified ${date}` : "";
        expandedModified.style.display = date ? "" : "none";
    }

    setIcon(togglePasswordBtn, "eye-off");
    editBtn.style.display           = "inline-flex";
    saveCancelWrapper.style.display = "none";
    expandedCard.style.display      = "flex";

    // Two-factor: show the field, render current code, refresh every second
    if (totpField) {
        if (entry.totp) {
            totpField.style.display = "";
            refreshTotp();
            stopTotpTimer();
            totpTimer = setInterval(refreshTotp, 1000);
        } else {
            totpField.style.display = "none";
        }
    }

    if (window.trapFocus) expandedCardRelease = window.trapFocus(expandedCard);
}

expandedCard.addEventListener("click", e => {
    if (e.target === expandedCard) { haptic(4); closeCard(); }
});

function closeCard() {
    expandedCard.style.display      = "none";
    saveCancelWrapper.style.display = "none";
    editBtn.style.display           = "inline-flex";
    currentEntryId = null;
    stopTotpTimer();
    if (expandedCardRelease) { expandedCardRelease(); expandedCardRelease = null; }
}

// Esc closes the expanded entry modal
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (expandedCard.style.display === "flex") {
        if (confirmOverlay.style.display === "flex") {
            confirmOverlay.style.display = "none";
        } else {
            closeCard();
        }
    }
});

// ============================================================
// EDIT MODE
// ============================================================
editBtn.addEventListener("click", () => {
    const e = findEntry(currentEntryId);
    if (!e) return;
    const type = e.type || "login";

    editBtn.style.display           = "none";
    saveCancelWrapper.style.display = "flex";

    const makeInput = (id, val, type = "text") => {
        const el = document.createElement("input");
        el.type = type; el.id = id; el.className = "value"; el.value = val;
        return el;
    };

    if (type === "login") {
        document.getElementById("url-field").style.display = "";
        expandedUrl.innerHTML      = ""; expandedUrl.appendChild(makeInput("edit-url", e.url || ""));
        expandedUsername.innerHTML = ""; expandedUsername.appendChild(makeInput("edit-username", e.username || ""));
        expandedPassword.innerHTML = ""; expandedPassword.appendChild(makeInput("edit-password", e.password || "", passwordVisible ? "text" : "password"));
        if (totpField) {
            totpField.style.display = "";
            stopTotpTimer();
            setTotpEditMode(e.totp || "");
        }
    } else if (type === "note") {
        const ce = document.getElementById("expanded-content");
        ce.innerHTML = "";
        const ta = document.createElement("textarea");
        ta.id = "edit-content"; ta.className = "value notes"; ta.value = e.content || "";
        ce.appendChild(ta);
    } else if (type === "card") {
        const ch = document.getElementById("expanded-cardholder");
        const cn = document.getElementById("expanded-card-number");
        const cx = document.getElementById("expanded-card-expiry");
        const cv = document.getElementById("expanded-card-cvv");
        if (ch) { ch.innerHTML = ""; ch.appendChild(makeInput("edit-cardholder", e.cardholder || "")); }
        if (cn) { cn.innerHTML = ""; cn.appendChild(makeInput("edit-card-number", e.cardNumber || "")); }
        if (cx) { cx.innerHTML = ""; cx.appendChild(makeInput("edit-card-expiry", e.cardExpiry || "")); }
        if (cv) { cv.innerHTML = ""; cv.appendChild(makeInput("edit-card-cvv", e.cardCvv || "")); }
    }

    // Tags input on every type
    const tagsEl = document.getElementById("expanded-tags");
    if (tagsEl) {
        tagsEl.innerHTML = "";
        const tagsInput = document.createElement("input");
        tagsInput.type        = "text";
        tagsInput.id          = "edit-tags";
        tagsInput.className   = "value";
        tagsInput.placeholder = "banking, personal";
        tagsInput.value       = (e.tags || []).join(", ");
        tagsEl.appendChild(tagsInput);
    }

    // Notes field is on every type
    const ta = document.createElement("textarea");
    ta.id = "edit-notes"; ta.className = "value notes"; ta.value = e.notes || "";
    expandedNotes.innerHTML = ""; expandedNotes.appendChild(ta);

    haptic(6);
});

function setTotpDisplayMode() {
    const row = totpField && totpField.querySelector(".totp-row");
    if (!row) return;
    row.querySelectorAll(".totp-code, .totp-countdown, #copy-totp-btn")
        .forEach(el => el.style.display = "");
    const input = document.getElementById("edit-totp");
    if (input) input.style.display = "none";
}

function setTotpEditMode(currentValue) {
    const row = totpField && totpField.querySelector(".totp-row");
    if (!row) return;
    row.querySelectorAll(".totp-code, .totp-countdown, #copy-totp-btn")
        .forEach(el => el.style.display = "none");
    const input = document.getElementById("edit-totp");
    if (input) {
        input.value = currentValue;
        input.style.display = "";
    }
}

saveBtn.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry) return;
    const type = entry.type || "login";

    if (type === "login") {
        entry.url       = (document.getElementById("edit-url")?.value      || "").trim();
        entry.username  = (document.getElementById("edit-username")?.value  || "").trim();
        const newPassword = document.getElementById("edit-password")?.value || "";
        // Track password history when it actually changes (last 10 versions)
        if (entry.password && newPassword && newPassword !== entry.password) {
            entry.passwordHistory = entry.passwordHistory || [];
            entry.passwordHistory.unshift({ value: entry.password, changedAt: Date.now() });
            if (entry.passwordHistory.length > 10) entry.passwordHistory.length = 10;
        }
        entry.password = newPassword;
        const totpVal   = (document.getElementById("edit-totp")?.value || "")
                              .replace(/\s+/g, "").toUpperCase();
        if (totpVal) entry.totp = totpVal;
        else delete entry.totp;
    } else if (type === "note") {
        entry.content = (document.getElementById("edit-content")?.value || "").trim();
    } else if (type === "card") {
        entry.cardholder = (document.getElementById("edit-cardholder")?.value  || "").trim();
        entry.cardNumber = (document.getElementById("edit-card-number")?.value || "").replace(/\s+/g, "");
        entry.cardExpiry = (document.getElementById("edit-card-expiry")?.value || "").trim();
        entry.cardCvv    = (document.getElementById("edit-card-cvv")?.value    || "").trim();
    }
    entry.notes     = (document.getElementById("edit-notes")?.value || "").trim();
    const tagsVal   = (document.getElementById("edit-tags")?.value || "")
        .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    if (tagsVal.length) entry.tags = tagsVal;
    else                delete entry.tags;
    entry.updatedAt = Date.now();
    saveVault();
    renderVault(searchInput.value);
    exitEditMode();
    haptic([8, 20, 8]);
});

cancelBtn.addEventListener("click", () => { haptic(4); exitEditMode(); });

function exitEditMode() {
    const e = findEntry(currentEntryId);
    if (!e) return;
    const type = e.type || "login";
    editBtn.style.display           = "inline-flex";
    saveCancelWrapper.style.display = "none";

    if (type === "login") {
        const urlField = document.getElementById("url-field");
        if (e.url) {
            expandedUrl.innerHTML = "";
            const safeUrl = /^https?:\/\//i.test(e.url) ? e.url : "#";
            const a = document.createElement("a");
            a.href = safeUrl; a.target = "_blank"; a.rel = "noopener noreferrer";
            a.textContent = e.url;
            expandedUrl.appendChild(a);
            urlField.style.display = "";
        } else {
            urlField.style.display = "none";
        }
        expandedUsername.textContent = e.username || "—";
        expandedPassword.textContent = passwordVisible ? e.password : "••••••••";
    } else if (type === "card") {
        const ch = document.getElementById("expanded-cardholder");
        const cn = document.getElementById("expanded-card-number");
        const cx = document.getElementById("expanded-card-expiry");
        const cv = document.getElementById("expanded-card-cvv");
        if (ch) ch.textContent = e.cardholder || "—";
        if (cn) cn.textContent = e.cardNumber || "—";
        if (cx) cx.textContent = e.cardExpiry || "—";
        if (cv) cv.textContent = "•••";
    } else if (type === "note") {
        const ce = document.getElementById("expanded-content");
        if (ce) ce.innerHTML = e.content
            ? renderMarkdown(e.content)
            : '<span class="value-empty">—</span>';
    }

    expandedNotes.innerHTML = e.notes
        ? renderMarkdown(e.notes)
        : '<span class="value-empty">No notes</span>';

    const tagsEl = document.getElementById("expanded-tags");
    if (tagsEl) renderTagsInto(tagsEl, e.tags);

    if (expandedModified) {
        const date = formatDate(e.updatedAt || e.createdAt);
        expandedModified.textContent   = date ? `Modified ${date}` : "";
        expandedModified.style.display = date ? "" : "none";
    }

    // Restore TOTP display mode and resume the timer if there's a secret
    if (totpField) {
        setTotpDisplayMode();
        if (e.totp) {
            totpField.style.display = "";
            refreshTotp();
            stopTotpTimer();
            totpTimer = setInterval(refreshTotp, 1000);
        } else {
            totpField.style.display = "none";
        }
    }
}

// ============================================================
// TOGGLE PASSWORD
// ============================================================
togglePasswordBtn.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry) return;
    passwordVisible = !passwordVisible;
    const editInput = document.getElementById("edit-password");
    if (editInput) {
        editInput.type = passwordVisible ? "text" : "password";
    } else {
        expandedPassword.textContent = passwordVisible ? entry.password : "••••••••";
    }
    setIcon(togglePasswordBtn, passwordVisible ? "eye" : "eye-off");
    haptic(4);
});

// ============================================================
// COPY BUTTONS (expanded card)
// ============================================================
copyIconBtn.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry) return;
    copyToClipboard(entry.password, "Password copied!");
});

copyUsernameBtn.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry) return;
    copyToClipboard(entry.username, "Username copied!");
});

if (copyTotpBtn) {
    copyTotpBtn.addEventListener("click", () => {
        const code = expandedTotp.dataset.code;
        if (!code) return;
        copyToClipboard(code, "Code copied!");
    });
}

function buildOtpauthUri(entry) {
    const label   = encodeURIComponent((entry.name || "vault") + (entry.username ? ":" + entry.username : ""));
    const secret  = entry.totp.replace(/\s+/g, "");
    const issuer  = encodeURIComponent(entry.name || "Securevault");
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

document.getElementById("copy-totp-uri-btn")?.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry || !entry.totp) return;
    copyToClipboard(buildOtpauthUri(entry), "otpauth URI copied — paste into a QR generator or authenticator");
});

// ============================================================
// TOTP QR overlay — renders the otpauth URI as a scannable QR
// using the local js/lib/qr.js (no external API; the secret
// never leaves the device).
// ============================================================
const qrOverlay = document.getElementById("qr-overlay");
const qrCanvas  = document.getElementById("qr-canvas");
const qrError   = document.getElementById("qr-error");

document.getElementById("show-totp-qr-btn")?.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry || !entry.totp) return;
    const uri = buildOtpauthUri(entry);
    const svg = typeof generateQR === "function" ? generateQR(uri, { moduleSize: 8 }) : null;
    if (svg) {
        qrCanvas.innerHTML = svg;
        qrError.hidden = true;
    } else {
        qrCanvas.innerHTML = "";
        qrError.hidden = false;
    }
    qrOverlay.hidden = false;
});

document.getElementById("qr-close")?.addEventListener("click", () => { qrOverlay.hidden = true; });
qrOverlay?.addEventListener("click", e => { if (e.target === qrOverlay) qrOverlay.hidden = true; });
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && qrOverlay && !qrOverlay.hidden) { e.preventDefault(); qrOverlay.hidden = true; }
});

document.getElementById("copy-card-number-btn")?.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (entry && entry.cardNumber) copyToClipboard(entry.cardNumber, "Card number copied!");
});
document.getElementById("copy-card-cvv-btn")?.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (entry && entry.cardCvv) copyToClipboard(entry.cardCvv, "CVV copied!");
});

// ============================================================
// DELETE
// ============================================================
removeBtn.addEventListener("click", () => {
    if (!currentEntryId) return;
    if (!settings.confirmDelete) { deleteEntry(); return; }
    haptic(10);
    confirmOverlay.style.display = "flex";
});

document.getElementById("duplicate-btn")?.addEventListener("click", () => {
    const original = findEntry(currentEntryId);
    if (!original) return;
    const copy = JSON.parse(JSON.stringify(original));
    copy.id        = newEntryId();
    copy.name      = (copy.name || "Entry") + " (copy)";
    copy.createdAt = Date.now();
    delete copy.updatedAt;
    delete copy.lastUsed;
    delete copy.deleted;
    delete copy.archived;
    vault.push(copy);
    saveVault();
    closeCard();
    renderVault(searchInput.value);
    haptic([8, 20, 8]);
    window.showToast("Entry duplicated", { tone: "success", duration: 1500 });
});

document.getElementById("archive-btn")?.addEventListener("click", () => {
    const entry = findEntry(currentEntryId);
    if (!entry) return;
    entry.archived = Date.now();
    saveVault();
    closeCard();
    renderVault(searchInput.value);
    haptic([8, 20, 8]);
    window.showToast("Entry archived", {
        duration: 5000,
        action: {
            label: "Undo",
            onClick: () => {
                delete entry.archived;
                saveVault();
                renderVault(searchInput.value);
                window.showToast("Restored", { tone: "success", duration: 1500 });
            }
        }
    });
});

confirmYes.addEventListener("click", deleteEntry);
confirmNo.addEventListener("click",  () => { haptic(4); confirmOverlay.style.display = "none"; });
confirmOverlay.addEventListener("click", e => {
    if (e.target === confirmOverlay) { haptic(4); confirmOverlay.style.display = "none"; }
});

function deleteEntry() {
    const entry = findEntry(currentEntryId);
    if (!entry) return;
    entry.deleted = Date.now();
    saveVault();
    closeCard();
    confirmOverlay.style.display = "none";
    renderVault(searchInput.value);
    haptic([10, 30, 10]);

    window.showToast("Entry moved to trash", {
        duration: 5000,
        tone: "error",
        action: {
            label: "Undo",
            onClick: () => {
                delete entry.deleted;
                saveVault();
                renderVault(searchInput.value);
                window.showToast("Restored", { tone: "success", duration: 1500 });
            }
        }
    });
}

// ============================================================
// SEARCH + SORT
// ============================================================
searchInput.addEventListener("input", () => {
    document.querySelector(".search-wrapper").classList.toggle("has-text", !!searchInput.value);
    renderVault(searchInput.value);
    if (searchInput.value) hideRecentSearches();
    else if (document.activeElement === searchInput) showRecentSearches();
});

const searchClearBtn = document.getElementById("search-clear");
if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
        searchInput.value = "";
        document.querySelector(".search-wrapper").classList.remove("has-text");
        renderVault("");
        searchInput.focus();
    });
}
searchInput.addEventListener("focus", () => {
    sortMenu.style.display = "none";
    sortToggle.classList.remove("active");
    if (!searchInput.value) showRecentSearches();
});
searchInput.addEventListener("blur", () => {
    // Capture the search the user just finished doing into recents.
    if (searchInput.value.trim()) addRecentSearch(searchInput.value.trim());
    // Delay so a click on a recent item still fires before the dropdown hides.
    setTimeout(hideRecentSearches, 120);
});

// ============================================================
// RECENT SEARCHES DROPDOWN
// ============================================================
const RECENT_KEY      = "vaultRecentSearches";
const RECENT_MAX      = 6;
const searchRecentEl  = document.getElementById("search-recent");
const searchRecentList = document.getElementById("search-recent-list");

function loadRecentSearches() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; }
    catch { return []; }
}
function saveRecentSearches(arr) {
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr.slice(0, RECENT_MAX)));
}
function addRecentSearch(q) {
    const list = loadRecentSearches().filter(x => x.toLowerCase() !== q.toLowerCase());
    list.unshift(q);
    saveRecentSearches(list);
}
function clearRecentSearches() {
    localStorage.removeItem(RECENT_KEY);
    hideRecentSearches();
}
function showRecentSearches() {
    const list = loadRecentSearches();
    if (!list.length || !searchRecentEl) return;
    searchRecentList.innerHTML = "";
    list.forEach(q => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "search-recent-item";
        btn.textContent = q;
        btn.addEventListener("mousedown", e => e.preventDefault()); // don't blur the input
        btn.addEventListener("click", () => {
            searchInput.value = q;
            document.querySelector(".search-wrapper").classList.add("has-text");
            renderVault(q);
            hideRecentSearches();
            searchInput.focus();
        });
        li.appendChild(btn);
        searchRecentList.appendChild(li);
    });
    searchRecentEl.hidden = false;
}
function hideRecentSearches() {
    if (searchRecentEl) searchRecentEl.hidden = true;
}
document.getElementById("search-recent-clear")?.addEventListener("mousedown", e => e.preventDefault());
document.getElementById("search-recent-clear")?.addEventListener("click", clearRecentSearches);

sortToggle.addEventListener("click", e => {
    e.stopPropagation();
    const open = sortMenu.style.display === "flex";
    sortMenu.style.display = open ? "none" : "flex";
    sortToggle.classList.toggle("active", !open);
    haptic(4);
});

document.addEventListener("click", () => {
    sortMenu.style.display = "none";
    sortToggle.classList.remove("active");
});

function persistSort() {
    localStorage.setItem("vaultSort", JSON.stringify({ field: sortField, order: sortOrder }));
}

// Reflect the current sortField / sortOrder in the menu's indicator dots
function syncSortIndicators() {
    document.querySelectorAll(".sort-field").forEach(el => {
        el.querySelector(".indicator").classList.toggle("active", el.dataset.field === sortField);
    });
    document.querySelectorAll(".sort-order").forEach(el => {
        el.querySelector(".indicator").classList.toggle("active", el.dataset.order === sortOrder);
    });
}

document.querySelectorAll(".sort-field").forEach(el => {
    el.addEventListener("click", e => {
        e.stopPropagation();
        sortField = el.dataset.field;
        syncSortIndicators();
        persistSort();
        renderVault(searchInput.value);
        haptic(4);
    });
});

document.querySelectorAll(".sort-order").forEach(el => {
    el.addEventListener("click", e => {
        e.stopPropagation();
        sortOrder = el.dataset.order;
        syncSortIndicators();
        persistSort();
        renderVault(searchInput.value);
        haptic(4);
    });
});

// ============================================================
// LOGOUT — final sync before leaving
// ============================================================
document.getElementById("logout-btn").addEventListener("click", async e => {
    e.preventDefault();
    haptic([10, 20, 10]);
    const cfg = JSON.parse(localStorage.getItem("syncConfig") || "{}");
    if (cfg.token && cfg.gistId) {
        try { await pushToGist(); } catch {}
    }
    logout();
});

// ============================================================
// IMPORT / EXPORT
// ============================================================
// (Import / export moved to Settings → Storage; see js/lib/portation.js.
//  downloadFile + entriesToCsv come from portation.js, used by the
//  bulk-export action below.)

// ============================================================
// BULK SELECT
// ============================================================
const selectToggleBtn = document.getElementById("select-toggle");
const bulkActions     = document.getElementById("bulk-actions");
const bulkCountEl     = document.getElementById("bulk-count");
const vaultCountEl    = document.getElementById("vault-count");
const vaultMetaRow    = document.getElementById("vault-meta-row");

function updateBulkCount() {
    bulkCountEl.textContent = `${selectedIds.size} selected`;
}

function enterSelectMode() {
    selectMode = true;
    selectedIds.clear();
    document.body.classList.add("select-mode");
    selectToggleBtn.textContent = "Done";
    bulkActions.hidden = false;
    updateBulkCount();
    renderVault(searchInput.value);
}

function exitSelectMode() {
    selectMode = false;
    selectedIds.clear();
    document.body.classList.remove("select-mode");
    selectToggleBtn.textContent = "Select";
    bulkActions.hidden = true;
    renderVault(searchInput.value);
}

function toggleSelectMode() {
    if (selectMode) exitSelectMode();
    else            enterSelectMode();
}

function updateVaultMeta() {
    const count = vault.filter(e => !e.deleted && !e.archived).length;
    if (count === 0) {
        vaultMetaRow.hidden = true;
        return;
    }
    vaultMetaRow.hidden = false;
    vaultCountEl.textContent = `${count} entr${count === 1 ? "y" : "ies"}`;
}

selectToggleBtn.addEventListener("click", toggleSelectMode);
document.getElementById("bulk-cancel").addEventListener("click", exitSelectMode);

document.getElementById("bulk-export").addEventListener("click", () => {
    if (!selectedIds.size) return;
    const chosen = [];
    for (const id of selectedIds) {
        const e = findEntry(id);
        if (e) chosen.push(e);
    }
    const csv = entriesToCsv(chosen);
    downloadFile(`securevault-export-${chosen.length}.csv`, csv, "text/csv");
    window.showToast(`Exported ${chosen.length}`, { tone: "success", duration: 1500 });
    exitSelectMode();
});

document.getElementById("bulk-archive").addEventListener("click", () => {
    if (!selectedIds.size) return;
    const entries = [];
    for (const id of selectedIds) {
        const e = findEntry(id);
        if (e) entries.push(e);
    }
    exitSelectMode();
    undoableArchive(entries);
});

document.getElementById("bulk-delete").addEventListener("click", () => {
    if (!selectedIds.size) return;
    const entries = [];
    for (const id of selectedIds) {
        const e = findEntry(id);
        if (e) entries.push(e);
    }
    exitSelectMode();
    undoableTrash(entries);
});

document.getElementById("bulk-tag").addEventListener("click", () => {
    if (!selectedIds.size) return;
    const raw = prompt("Add a tag to the selected entries:");
    if (!raw) return;
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    for (const id of selectedIds) {
        const e = findEntry(id);
        if (!e) continue;
        e.tags = e.tags || [];
        if (!e.tags.includes(tag)) e.tags.push(tag);
    }
    const n = selectedIds.size;
    saveVault();
    window.showToast(`Tagged ${n} entr${n === 1 ? "y" : "ies"}`, { tone: "success", duration: 1500 });
    exitSelectMode();
});

// ============================================================
// UNDOABLE ARCHIVE / TRASH — shared by swipe, context menu, bulk bar.
// Each entry's previous state is captured by id so an Undo still works
// if a sync pull replaces the in-memory vault array between then and now.
// ============================================================
function undoableArchive(entries) {
    if (!entries.length) return;
    const before = entries.map(e => ({ id: e.id, archived: e.archived }));
    const now = Date.now();
    entries.forEach(e => { e.archived = now; });
    saveVault();
    renderVault(searchInput.value);
    const n = entries.length;
    window.showToast(n === 1 ? "Entry archived" : `${n} archived`, {
        tone: "success",
        duration: 5000,
        action: {
            label: "Undo",
            onClick: () => {
                before.forEach(b => {
                    const e = findEntry(b.id);
                    if (!e) return;
                    if (b.archived) e.archived = b.archived;
                    else            delete e.archived;
                });
                saveVault();
                renderVault(searchInput.value);
                window.showToast("Restored", { duration: 1500 });
            }
        }
    });
}

function undoableTrash(entries) {
    if (!entries.length) return;
    const before = entries.map(e => ({ id: e.id, deleted: e.deleted }));
    const now = Date.now();
    entries.forEach(e => { e.deleted = now; });
    saveVault();
    renderVault(searchInput.value);
    const n = entries.length;
    window.showToast(n === 1 ? "Entry moved to trash" : `${n} moved to trash`, {
        tone: "error",
        duration: 5000,
        action: {
            label: "Undo",
            onClick: () => {
                before.forEach(b => {
                    const e = findEntry(b.id);
                    if (!e) return;
                    if (b.deleted) e.deleted = b.deleted;
                    else           delete e.deleted;
                });
                saveVault();
                renderVault(searchInput.value);
                window.showToast("Restored", { duration: 1500 });
            }
        }
    });
}

// ============================================================
// SWIPE-TO-ACTION + LONG-PRESS SELECT (touch devices only)
// ============================================================
const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
let openSwipeRow = null;

function closeOpenSwipe() {
    if (!openSwipeRow) return;
    openSwipeRow.classList.remove("open");
    openSwipeRow = null;
}

function enterSelectModeWith(id) {
    selectMode = true;
    selectedIds.clear();
    selectedIds.add(id);
    document.body.classList.add("select-mode");
    selectToggleBtn.textContent = "Done";
    bulkActions.hidden = false;
    updateBulkCount();
    renderVault(searchInput.value);
}

function wrapWithSwipeRow(card, entry) {
    const row = document.createElement("div");
    row.className = "vault-row";

    const actions = document.createElement("div");
    actions.className = "vault-row-actions";
    actions.innerHTML =
        '<button class="act-copy"    type="button" aria-label="Copy"><i data-lucide="copy"></i>Copy</button>' +
        '<button class="act-archive" type="button" aria-label="Archive"><i data-lucide="archive"></i>Archive</button>' +
        '<button class="act-delete"  type="button" aria-label="Delete"><i data-lucide="trash-2"></i>Delete</button>';

    row.appendChild(card);
    row.appendChild(actions);

    actions.querySelector(".act-copy").addEventListener("click", e => {
        e.stopPropagation();
        showCopyMenu(e, entry);
        closeOpenSwipe();
    });
    actions.querySelector(".act-archive").addEventListener("click", e => {
        e.stopPropagation();
        closeOpenSwipe();
        undoableArchive([entry]);
    });
    actions.querySelector(".act-delete").addEventListener("click", e => {
        e.stopPropagation();
        closeOpenSwipe();
        undoableTrash([entry]);
    });

    attachSwipeGesture(row, card, entry);
    return row;
}

function attachSwipeGesture(row, card, entry) {
    const SWIPE_OFFSET   = 180;
    const LOCK_THRESHOLD = 8;
    const OPEN_THRESHOLD = 100;
    const LONG_PRESS_MS  = 500;

    let startX = 0, startY = 0, dx = 0;
    let pressing = false;
    let locked   = "none"; // "none" | "horizontal" | "vertical"
    let pressTimer = null;

    card.addEventListener("pointerdown", e => {
        if (e.pointerType !== "touch") return;
        if (selectMode || fillRequestId) return;
        if (row.classList.contains("open")) {
            // Tap on already-open card → close + swallow the click.
            row.classList.remove("open");
            openSwipeRow = null;
            card.dataset.suppressClick = "1";
            setTimeout(() => delete card.dataset.suppressClick, 100);
            return;
        }
        if (openSwipeRow && openSwipeRow !== row) closeOpenSwipe();

        startX = e.clientX; startY = e.clientY;
        dx = 0;
        locked = "none";
        pressing = true;
        card.classList.add("swiping");
        try { card.setPointerCapture(e.pointerId); } catch {}

        pressTimer = setTimeout(() => {
            if (!pressing || locked !== "none") return;
            pressTimer = null;
            pressing = false;
            card.classList.remove("swiping");
            haptic(8);
            enterSelectModeWith(entry.id);
        }, LONG_PRESS_MS);
    });

    card.addEventListener("pointermove", e => {
        if (!pressing) return;
        dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (locked === "none") {
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > LOCK_THRESHOLD) {
                locked = "horizontal";
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
            } else if (Math.abs(dy) > LOCK_THRESHOLD) {
                locked = "vertical";
                pressing = false;
                card.classList.remove("swiping");
                if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
                return;
            }
        }

        if (locked === "horizontal") {
            const tx = Math.min(0, Math.max(dx, -(SWIPE_OFFSET + 30)));
            card.style.transform = `translateX(${tx}px)`;
        }
    });

    function release() {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        const wasHorizontal = locked === "horizontal";
        const movedDx = dx;
        pressing = false;
        locked = "none";
        card.classList.remove("swiping");
        if (!wasHorizontal) return;

        card.style.transform = "";
        if (movedDx < -OPEN_THRESHOLD) {
            row.classList.add("open");
            openSwipeRow = row;
        } else {
            row.classList.remove("open");
            if (openSwipeRow === row) openSwipeRow = null;
        }
        // Always swallow the trailing click after a horizontal swipe.
        card.dataset.suppressClick = "1";
        setTimeout(() => delete card.dataset.suppressClick, 100);
    }
    card.addEventListener("pointerup",     release);
    card.addEventListener("pointercancel", release);
}

// Tap outside the open row → close it.
if (isTouchDevice) {
    document.addEventListener("pointerdown", e => {
        if (!openSwipeRow) return;
        if (openSwipeRow.contains(e.target)) return;
        closeOpenSwipe();
    });
}

// ============================================================
// RIGHT-CLICK CONTEXT MENU (desktop equivalent of the swipe tray)
// ============================================================
let ctxMenuEl = null;

function ensureCtxMenu() {
    if (ctxMenuEl) return ctxMenuEl;
    ctxMenuEl = document.createElement("div");
    ctxMenuEl.className = "context-menu";
    document.body.appendChild(ctxMenuEl);
    return ctxMenuEl;
}

function hideContextMenu() {
    if (ctxMenuEl) ctxMenuEl.classList.remove("open");
}

function showContextMenu(x, y, entry, card) {
    const menu = ensureCtxMenu();
    menu.innerHTML = "";
    menu.classList.add("open");

    const items = [
        { label: "Copy…", icon: "copy", onClick: () => {
            hideContextMenu();
            showCopyMenu({ stopPropagation: () => {}, currentTarget: card }, entry);
        }},
        { label: "Edit", icon: "pencil", onClick: () => {
            hideContextMenu();
            openCard(entry);
            setTimeout(() => editBtn.click(), 0);
        }},
        { sep: true },
        { label: "Archive", icon: "archive", onClick: () => {
            hideContextMenu();
            undoableArchive([entry]);
        }},
        { label: "Delete", icon: "trash-2", danger: true, onClick: () => {
            hideContextMenu();
            undoableTrash([entry]);
        }},
    ];

    items.forEach(it => {
        if (it.sep) { menu.appendChild(document.createElement("hr")); return; }
        const btn = document.createElement("button");
        btn.type = "button";
        if (it.danger) btn.classList.add("danger");
        btn.innerHTML = `<i data-lucide="${it.icon}"></i><span>${it.label}</span>`;
        btn.addEventListener("click", e => { e.stopPropagation(); it.onClick(); });
        menu.appendChild(btn);
    });

    renderIcons();

    // Position with viewport clamping (measure after content is in place).
    menu.style.left = "0px";
    menu.style.top  = "0px";
    const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth  - r.width  - 8)) + "px";
    menu.style.top  = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + "px";
}

// Dismiss on outside click, scroll, Escape, or any other contextmenu firing.
document.addEventListener("click", hideContextMenu);
window.addEventListener("scroll", hideContextMenu, { passive: true });
document.addEventListener("keydown", e => { if (e.key === "Escape") hideContextMenu(); });
document.addEventListener("contextmenu", e => {
    if (!ctxMenuEl || !ctxMenuEl.classList.contains("open")) return;
    if (ctxMenuEl.contains(e.target)) return;
    hideContextMenu();
});

// ============================================================
// AUTO-PULL — silent sync pull on focus + every 5 min while open.
// Throttled so we never hammer the Gist API.
// ============================================================
let lastAutoPull = 0;
const AUTO_PULL_THROTTLE_MS = 30 * 1000;        // 30s minimum between auto-pulls
const AUTO_PULL_INTERVAL_MS = 5  * 60 * 1000;   // 5-min background tick

async function silentPull() {
    const now = Date.now();
    if (now - lastAutoPull < AUTO_PULL_THROTTLE_MS) return;
    if (typeof syncConfigured !== "function" || !(await syncConfigured())) return;
    lastAutoPull = now;
    try {
        const result = await pullFromGist();
        if (result && result.ok && !result.reauth) {
            await loadVault();
            renderVault(searchInput.value);
        }
    } catch {
        // Silent — auto-pull failures are non-blocking
    }
}

window.addEventListener("focus", () => { silentPull(); });
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) silentPull();
});
setInterval(() => {
    if (!document.hidden) silentPull();
}, AUTO_PULL_INTERVAL_MS);

// ============================================================
// PULL-TO-REFRESH (mobile only)
// ============================================================
(function setupPullToRefresh() {
    const indicator = document.getElementById("pull-indicator");
    if (!indicator) return;
    const PULL_THRESHOLD = 80;
    let startY = null;
    let delta  = 0;
    let pulling = false;

    function modalOpen() {
        return (expandedCard && expandedCard.style.display === "flex") ||
               (confirmOverlay && confirmOverlay.style.display === "flex") ||
               document.body.classList.contains("drawer-open");
    }

    function setIndicator(progress, loading) {
        indicator.style.opacity   = progress.toString();
        indicator.style.transform = `translateX(-50%) translateY(${Math.min(progress * 32, 32)}px)`;
        indicator.classList.toggle("loading", !!loading);
    }

    window.addEventListener("touchstart", e => {
        if (window.scrollY > 0 || e.touches.length !== 1 || modalOpen()) return;
        startY = e.touches[0].clientY;
        delta  = 0;
        pulling = true;
    }, { passive: true });

    window.addEventListener("touchmove", e => {
        if (!pulling) return;
        if (window.scrollY > 0) { pulling = false; setIndicator(0, false); return; }
        const d = e.touches[0].clientY - startY;
        if (d <= 0) { setIndicator(0, false); return; }
        delta = d;
        setIndicator(Math.min(d / PULL_THRESHOLD, 1), false);
    }, { passive: true });

    window.addEventListener("touchend", async () => {
        if (!pulling) return;
        const triggered = delta >= PULL_THRESHOLD;
        pulling = false;
        if (!triggered) { setIndicator(0, false); return; }

        setIndicator(1, true);
        try {
            if (typeof syncConfigured === "function" && await syncConfigured()) {
                await pullFromGist();
                await loadVault();
                renderVault(searchInput.value);
                window.showToast("Pulled from Gist", { tone: "success", duration: 1500 });
            } else {
                window.showToast("Sync not configured", { duration: 1500 });
            }
        } catch {
            window.showToast("Pull failed", { tone: "error" });
        }
        setIndicator(0, false);
    }, { passive: true });
})();

// ============================================================
// EXTENSION FILL MODE
// When the page is opened with #sv-fill=<requestId>&origin=<origin>
// (only ever set by the companion extension), we render a banner at
// the top, filter the list to entries whose URL matches the origin,
// and route clicks into a postMessage handshake instead of the
// regular modal.
// ============================================================
function setupFillMode() {
    const hash = window.location.hash || "";
    const id   = /[#&]sv-fill=([\w-]+)/.exec(hash);
    const og   = /[#&]origin=([^&]+)/.exec(hash);
    if (!id || !og) return;

    fillRequestId = id[1];
    fillOrigin    = decodeURIComponent(og[1]);
    try { fillHost = new URL(fillOrigin).hostname; } catch { fillHost = fillOrigin; }
    document.body.classList.add("fill-mode");

    const pageContent = document.querySelector(".page-content");
    if (!pageContent) return;
    const banner = document.createElement("div");
    banner.className = "fill-banner";
    banner.innerHTML =
        '<div class="fill-banner-text">' +
            '<span class="fill-banner-label">Fill credentials</span>' +
            '<span class="fill-banner-origin"></span>' +
        '</div>' +
        '<button type="button" class="btn-white btn-row" id="fill-cancel">Cancel</button>';
    banner.querySelector(".fill-banner-origin").textContent = fillHost || fillOrigin;
    pageContent.insertBefore(banner, pageContent.firstChild);
    document.getElementById("fill-cancel").addEventListener("click", () => window.close());
}

function entryMatchesFill(entry) {
    if (!entry.url || !fillHost) return false;
    try {
        const u = new URL(entry.url).hostname.toLowerCase();
        const h = fillHost.toLowerCase();
        return u === h || u.endsWith("." + h) || h.endsWith("." + u);
    } catch { return false; }
}

function sendFillPick(entry) {
    if (!fillRequestId) return;
    window.postMessage({
        __securevault: true,
        type:      "vault-pick",
        requestId: fillRequestId,
        username:  entry.username || "",
        password:  entry.password || ""
    }, "*");
    // The background closes this tab once the message is relayed.
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
// ============================================================
// COMMAND PALETTE (Cmd/Ctrl+K) — fuzzy search across entries +
// a fixed list of actions. Open with the shortcut, type to filter,
// Arrow / Enter to navigate, Esc or outside-click to close.
// ============================================================
const paletteOverlay = document.getElementById("palette-overlay");
const paletteInput   = document.getElementById("palette-input");
const paletteList    = document.getElementById("palette-list");
const paletteEmpty   = document.getElementById("palette-empty");

const PALETTE_ACTIONS = [
    { label: "Add entry",              hint: "N",  icon: "pencil",   run: () => window.location.href = "add-entry.html" },
    { label: "Open settings",          hint: ",",  icon: null,       run: () => window.location.href = "settings.html" },
    { label: "Open trash",             hint: null, icon: null,       run: () => window.location.href = "trash.html" },
    { label: "Open archive",           hint: null, icon: null,       run: () => window.location.href = "archive.html" },
    { label: "Open history",           hint: null, icon: null,       run: () => window.location.href = "history.html" },
    { label: "Open tags",              hint: null, icon: null,       run: () => window.location.href = "tags.html" },
    { label: "About",                  hint: null, icon: "info",     run: () => window.location.href = "about.html" },
    { label: "Lock vault",             hint: "L",  icon: "lock",     run: () => document.getElementById("logout-btn")?.click() },
    { label: "Keyboard shortcuts",     hint: "?",  icon: null,       run: () => openShortcuts() },
    { label: "Switch to list view",    hint: null, icon: null,       run: () => paletteSetViewMode("list") },
    { label: "Switch to grid view",    hint: null, icon: null,       run: () => paletteSetViewMode("grid") },
    { label: "Switch to gallery view", hint: null, icon: null,       run: () => paletteSetViewMode("gallery") },
];

function paletteSetViewMode(mode) {
    settings.viewMode = mode;
    localStorage.setItem("vaultSettings", JSON.stringify(settings));
    applyViewMode(mode);
    renderVault(searchInput.value);
}

let paletteResults = [];  // [{ kind: "action" | "entry", action?, entry? }]
let paletteFocused = 0;

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;"
    })[c]);
}

function openPalette() {
    if (!paletteOverlay) return;
    paletteOverlay.hidden = false;
    paletteInput.value = "";
    paletteInput.focus();
    refreshPalette();
}

function closePalette() {
    if (!paletteOverlay) return;
    paletteOverlay.hidden = true;
    paletteInput.blur();
}

function refreshPalette() {
    const q = paletteInput.value.trim().toLowerCase();
    paletteResults = [];

    PALETTE_ACTIONS.forEach(action => {
        if (!q || action.label.toLowerCase().includes(q)) {
            paletteResults.push({ kind: "action", action });
        }
    });

    if (q) {
        const matches = vault
            .filter(e => !e.deleted && !e.archived)
            .filter(e =>
                (e.name     || "").toLowerCase().includes(q) ||
                (e.username || "").toLowerCase().includes(q) ||
                (e.url      || "").toLowerCase().includes(q) ||
                (e.tags     || []).some(t => t.toLowerCase().includes(q))
            )
            .slice(0, 8);
        matches.forEach(entry => paletteResults.push({ kind: "entry", entry }));
    }

    paletteFocused = 0;
    paletteList.innerHTML = "";
    paletteEmpty.hidden = paletteResults.length > 0;

    paletteResults.forEach((r, i) => {
        const li = document.createElement("li");
        li.className = "palette-item" + (i === 0 ? " focused" : "");
        li.setAttribute("role", "option");

        if (r.kind === "action") {
            const iconHtml = r.action.icon
                ? `<i data-lucide="${r.action.icon}"></i>`
                : `<span class="palette-item-bullet"></span>`;
            li.innerHTML =
                `<span class="palette-item-icon">${iconHtml}</span>` +
                `<span class="palette-item-label">${escapeHtml(r.action.label)}</span>` +
                (r.action.hint ? `<kbd class="palette-item-hint">${escapeHtml(r.action.hint)}</kbd>` : "<span></span>");
        } else {
            const sub = entrySecondaryText(r.entry) || "";
            li.innerHTML =
                `<span class="palette-item-icon"></span>` +
                `<span class="palette-item-label">${escapeHtml(r.entry.name || "Untitled")}</span>` +
                `<span class="palette-item-sub">${escapeHtml(sub)}</span>`;
            li.querySelector(".palette-item-icon").appendChild(entryIconElement(r.entry));
        }

        li.addEventListener("click", () => activatePaletteItem(i));
        paletteList.appendChild(li);
    });
    renderIcons();
}

function setPaletteFocus(i) {
    if (!paletteResults.length) return;
    paletteFocused = Math.max(0, Math.min(i, paletteResults.length - 1));
    Array.from(paletteList.children).forEach((el, idx) =>
        el.classList.toggle("focused", idx === paletteFocused));
    const target = paletteList.children[paletteFocused];
    if (target) target.scrollIntoView({ block: "nearest" });
}

function activatePaletteItem(i) {
    const r = paletteResults[i];
    if (!r) return;
    closePalette();
    if (r.kind === "action") r.action.run();
    else                     openCard(r.entry);
}

paletteInput?.addEventListener("input", refreshPalette);
paletteInput?.addEventListener("keydown", e => {
    if (e.key === "ArrowDown")    { e.preventDefault(); setPaletteFocus(paletteFocused + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setPaletteFocus(paletteFocused - 1); }
    else if (e.key === "Enter")   { e.preventDefault(); activatePaletteItem(paletteFocused); }
    else if (e.key === "Escape")  { e.preventDefault(); closePalette(); }
});
paletteOverlay?.addEventListener("click", e => {
    if (e.target === paletteOverlay) closePalette();
});

// Cmd/Ctrl+K toggles the palette from anywhere on the page.
document.addEventListener("keydown", e => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        if (paletteOverlay.hidden) openPalette();
        else                       closePalette();
    }
});

const shortcutsOverlay = document.getElementById("shortcuts-overlay");
function openShortcuts()  { shortcutsOverlay.style.display = "flex"; }
function closeShortcuts() { shortcutsOverlay.style.display = "none"; }
document.getElementById("shortcuts-close")?.addEventListener("click", closeShortcuts);
shortcutsOverlay?.addEventListener("click", e => { if (e.target === shortcutsOverlay) closeShortcuts(); });

// Outline the Nth direct child of vault-container and scroll it into view.
// Children are .vault-row (touch) or .vault-card / .vault-grid-tile /
// .vault-gallery-card (desktop), each at the same index as currentVisibleEntries.
function focusEntry(index) {
    vaultContainer.querySelectorAll(".kbd-focused").forEach(el => el.classList.remove("kbd-focused"));
    if (index < 0 || index >= currentVisibleEntries.length) { focusedIndex = -1; return; }
    focusedIndex = index;
    const child = vaultContainer.children[index];
    if (!child) return;
    child.classList.add("kbd-focused");
    child.scrollIntoView({ block: "nearest" });
}

document.addEventListener("keydown", e => {
    // Skip when the user is typing in an input/textarea/contentEditable
    const t = e.target;
    const inField = t && (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
    );

    // Shortcuts help is modal: Esc closes it, swallow other keys
    if (shortcutsOverlay.style.display === "flex") {
        if (e.key === "Escape") { e.preventDefault(); closeShortcuts(); }
        return;
    }

    // Skip when any modifier is held (browser shortcuts win)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    // Skip when the drawer or a modal is open (Esc already handled there)
    if (document.body.classList.contains("drawer-open")) return;
    if (expandedCard.style.display === "flex") {
        if (!inField && e.key.toLowerCase() === "e") {
            e.preventDefault();
            editBtn.click();
        }
        return;
    }

    if (inField) {
        // Esc out of the search box clears + blurs
        if (e.key === "Escape" && t.id === "search-input") {
            t.value = "";
            document.querySelector(".search-wrapper").classList.remove("has-text");
            renderVault("");
            t.blur();
        }
        return;
    }

    if (e.key === "?") {
        e.preventDefault();
        openShortcuts();
    } else if (e.key === "/") {
        e.preventDefault();
        searchInput.focus();
    } else if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        window.location.href = "add-entry.html";
    } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        sortToggle.click();
    } else if (e.key === ",") {
        e.preventDefault();
        window.location.href = "settings.html";
    } else if (e.key === "l" || e.key === "L") {
        // Quick lock: reuse the header Logout handler (which flushes to Gist
        // first on this page, then clears the session and heads to login).
        e.preventDefault();
        document.getElementById("logout-btn")?.click();
    } else if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        if (!currentVisibleEntries.length) return;
        e.preventDefault();
        focusEntry(focusedIndex < 0 ? 0 : Math.min(focusedIndex + 1, currentVisibleEntries.length - 1));
    } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        if (!currentVisibleEntries.length) return;
        e.preventDefault();
        focusEntry(focusedIndex < 0 ? 0 : Math.max(focusedIndex - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        openCard(currentVisibleEntries[focusedIndex]);
    }
});

// ============================================================
// FIRST-RUN WELCOME
// ============================================================
function maybeShowWelcome() {
    const overlay = document.getElementById("welcome-overlay");
    const dismiss = document.getElementById("welcome-dismiss");
    if (!overlay || !dismiss) return;
    const s = JSON.parse(localStorage.getItem("vaultSettings") || "{}");
    if (s.onboarded) return;
    overlay.style.display = "flex";
    dismiss.addEventListener("click", () => {
        overlay.style.display = "none";
        const next = { ...s, onboarded: true };
        localStorage.setItem("vaultSettings", JSON.stringify(next));
    });
}

// ============================================================
// INIT
// ============================================================
(async () => {
    await loadVault();
    applyAppearance();
    applyViewMode(settings.viewMode || "list");

    // Restore the last-used sort if there is one, else fall back to
    // the default sort from Settings.
    const savedSort = JSON.parse(localStorage.getItem("vaultSort") || "null");
    if (savedSort && savedSort.field) {
        sortField = savedSort.field;
        sortOrder = savedSort.order || "asc";
    } else {
        sortField = settings.defaultSort || "name";
    }
    syncSortIndicators();

    setupFillMode();
    renderVault();
    if (!fillRequestId) maybeShowWelcome();

    // ?edit=<id> deep-link (used by Health page Fix buttons) — opens the
    // entry in edit mode, then strips the query so a refresh doesn't repeat.
    const editId = new URLSearchParams(location.search).get("edit");
    if (editId) {
        const entry = findEntry(editId);
        if (entry) {
            openCard(entry);
            setTimeout(() => editBtn.click(), 0);
        }
        history.replaceState({}, "", location.pathname);
    }
})();

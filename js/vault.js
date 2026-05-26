// ============================================================
// VAULT.JS — SecureVault
// ============================================================

// ============================================================
// STATE
// ============================================================
let vault           = [];
let currentEntryId  = null;
let passwordVisible = false;
let sortField       = "name";
let sortOrder       = "asc";

function findEntry(id) {
    return vault.find(e => e.id === id);
}
function findEntryIndex(id) {
    return vault.findIndex(e => e.id === id);
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
           ("e_" + Date.now() + "_" + Math.random().toString(36).slice(2));
}

const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {
    lightMode:     false,
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
// HAPTIC FEEDBACK
// ============================================================
function haptic(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

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
const expandedTotpBar   = document.getElementById("expanded-totp-bar");
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
function applyLightMode() {
    const isLight = !!settings.lightMode;
    document.body.classList.toggle("dark", !isLight);
    document.documentElement.classList.toggle("dark", !isLight);
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
function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => {
        window.showToast(msg || "Copied", { duration: 1800 });
        haptic([8, 20, 8]);
    });
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

    // Active vault excludes soft-deleted + archived entries
    let items = vault.filter(e => !e.deleted && !e.archived);
    const q   = filter.toLowerCase();

    if (q) {
        items = items.filter(e =>
            (e.name       || "").toLowerCase().includes(q) ||
            (e.username   || "").toLowerCase().includes(q) ||
            (e.url        || "").toLowerCase().includes(q) ||
            (e.notes      || "").toLowerCase().includes(q) ||
            (e.content    || "").toLowerCase().includes(q) ||
            (e.cardholder || "").toLowerCase().includes(q) ||
            (e.cardNumber || "").toLowerCase().includes(q)
        );
    }

    items.sort((a, b) => {
        const va = (a[sortField] || "").toLowerCase();
        const vb = (b[sortField] || "").toLowerCase();
        if (va < vb) return sortOrder === "asc" ? -1 : 1;
        if (va > vb) return sortOrder === "asc" ?  1 : -1;
        return 0;
    });

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

            const num = document.createElement("div");
            num.className   = "tile-num";
            num.textContent = String(i + 1).padStart(2, "0");
            tile.appendChild(num);

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
        sub.textContent = entrySecondaryText(entry);
        text.appendChild(sub);

        card.appendChild(text);

        const cb = document.createElement("button");
        cb.className = "card-copy-btn";
        cb.setAttribute("aria-label", "Copy credentials");
        cb.innerHTML = `<i data-lucide="copy"></i>`;
        cb.addEventListener("click", e => showCopyMenu(e, entry));
        card.appendChild(cb);

        card.dataset.id = entry.id;
        card.addEventListener("click", e => {
            if (e.target.closest(".card-copy-btn")) return;
            haptic(6); openCard(entry);
        });
        vaultContainer.appendChild(card);
    });
    renderIcons();
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
        expandedTotp.textContent     = formatTOTP(code);
        expandedTotpBar.style.width  = (100 * secondsRemaining / period) + "%";
        expandedTotp.dataset.code    = code;
    } catch {
        expandedTotp.textContent  = "Invalid secret";
        expandedTotpBar.style.width = "0%";
        delete expandedTotp.dataset.code;
    }
}

function stopTotpTimer() {
    if (totpTimer) { clearInterval(totpTimer); totpTimer = null; }
}

function openCard(entry) {
    currentEntryId  = entry.id;
    passwordVisible = false;

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
    expandedNotes.textContent    = entry.notes || "No notes";

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
    if (contentEl)    contentEl.textContent    = entry.content || "—";

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
        entry.password  =  document.getElementById("edit-password")?.value  || "";
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
        if (ce) ce.textContent = e.content || "—";
    }

    expandedNotes.textContent = e.notes || "No notes";

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
searchInput.addEventListener("input", () => renderVault(searchInput.value));
searchInput.addEventListener("focus", () => {
    sortMenu.style.display = "none";
    sortToggle.classList.remove("active");
});

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

document.querySelectorAll(".sort-field").forEach(el => {
    el.addEventListener("click", e => {
        e.stopPropagation();
        sortField = el.dataset.field;
        document.querySelectorAll(".sort-field .indicator").forEach(i => i.classList.remove("active"));
        el.querySelector(".indicator").classList.add("active");
        renderVault(searchInput.value);
        haptic(4);
    });
});

document.querySelectorAll(".sort-order").forEach(el => {
    el.addEventListener("click", e => {
        e.stopPropagation();
        sortOrder = el.dataset.order;
        document.querySelectorAll(".sort-order .indicator").forEach(i => i.classList.remove("active"));
        el.querySelector(".indicator").classList.add("active");
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
function exportVault(format) {
    if (!sessionStorage.getItem("vaultKey")) return;

    if (format === "encrypted") {
        // Export raw encrypted blob — only restoreable with master password + same salt
        const data     = JSON.stringify({
            vault:     localStorage.getItem("vault"),
            salt:      localStorage.getItem("vaultSalt"),
            exportedAt: Date.now()
        });
        downloadFile("securevault-backup.json", data, "application/json");
    } else if (format === "csv") {
        // Plain CSV — warn user this is unencrypted
        const rows = [["Name", "URL", "Username", "Password", "Notes"]];
        vault.forEach(e => rows.push([
            e.name     || "",
            e.url      || "",
            e.username || "",
            e.password || "",
            e.notes    || ""
        ]));
        const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadFile("securevault-export.csv", csv, "text/csv");
    }
}

// RFC-4180-style CSV parser: handles quoted commas, embedded
// newlines, and "" as an escaped quote inside a quoted field.
function parseCSV(text) {
    const rows = [];
    let row    = [];
    let field  = "";
    let inQuotes = false;
    let i = 0;

    while (i < text.length) {
        const c = text[i];

        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += c; i++; continue;
        }

        if (c === '"')                  { inQuotes = true;        i++; continue; }
        if (c === ",")                  { row.push(field); field = ""; i++; continue; }
        if (c === "\r" && text[i+1] === "\n") {
            row.push(field); rows.push(row); row = []; field = ""; i += 2; continue;
        }
        if (c === "\n" || c === "\r")   {
            row.push(field); rows.push(row); row = []; field = ""; i++; continue;
        }
        field += c; i++;
    }

    // Flush the final field/row if the file didn't end with a newline.
    if (field.length || row.length) { row.push(field); rows.push(row); }

    // Drop trailing empty row from a final newline.
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

function importFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const text = e.target.result;
            if (file.name.endsWith(".json")) {
                // Encrypted backup
                const { vault: encVault, salt } = JSON.parse(text);
                if (!encVault || !salt) throw new Error("Invalid backup file");
                const confirmed = confirm(
                    "This will replace your current vault with the backup.\n\nYou will need your original master password to unlock it. Continue?"
                );
                if (!confirmed) return;
                localStorage.setItem("vaultSalt",     salt);
                localStorage.setItem("vault",          encVault);
                localStorage.removeItem("vaultVerifier");
                sessionStorage.clear();
                window.location.replace("login.html");
            } else if (file.name.endsWith(".csv")) {
                if (!sessionStorage.getItem("vaultKey")) return;
                const rows = parseCSV(text).slice(1); // skip header
                const imported = [];
                rows.forEach(cols => {
                    if (!cols[0]) return;
                    imported.push({
                        id:        newEntryId(),
                        name:      cols[0] || "",
                        url:       cols[1] || "",
                        username:  cols[2] || "",
                        password:  cols[3] || "",
                        notes:     cols[4] || "",
                        createdAt: Date.now()
                    });
                });
                vault.push(...imported);
                saveVault();
                renderVault();
                window.showToast(`Imported ${imported.length} entries`, { tone: "success" });
            }
        } catch (err) {
            alert("Import failed: " + err.message);
        }
    };
    reader.readAsText(file);
}

// Wire export/import buttons if they exist on this page
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("export-encrypted-btn")?.addEventListener("click", () => exportVault("encrypted"));
    document.getElementById("export-csv-btn")?.addEventListener("click", () => {
        if (confirm("CSV export is unencrypted. Anyone with this file can read your passwords. Continue?")) {
            exportVault("csv");
        }
    });
    const importInput = document.getElementById("import-file-input");
    document.getElementById("import-btn")?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", e => {
        const file = e.target.files[0];
        if (file) importFromFile(file);
        e.target.value = "";
    });
});

// ============================================================
// INIT
// ============================================================
(async () => {
    await loadVault();
    applyLightMode();
    applyViewMode(settings.viewMode || "list");
    sortField = settings.defaultSort || "name";
    renderVault();
})();

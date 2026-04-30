// ============================================================
// VAULT.JS — SecureVault
// ============================================================

// ============================================================
// STATE
// ============================================================
let vault           = [];
let currentIndex    = null;
let passwordVisible = false;
let sortField       = "name";
let sortOrder       = "asc";

const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {
    darkMode:      false,
    viewMode:      "grid",
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

const editBtn           = document.getElementById("edit-btn");
const saveCancelWrapper = document.getElementById("save-cancel-wrapper");
const saveBtn           = document.getElementById("save-btn");
const cancelBtn         = document.getElementById("cancel-btn");

const togglePasswordBtn = document.getElementById("toggle-password");
const copyIconBtn       = document.getElementById("copy-btn");
const copyUsernameBtn   = document.getElementById("copy-username-btn");
const removeBtn         = document.getElementById("remove-btn");
const copyToast         = document.getElementById("copy-toast");

const confirmOverlay    = document.getElementById("confirmation-overlay");
const confirmYes        = document.getElementById("confirm-yes");
const confirmNo         = document.getElementById("confirm-no");

// ============================================================
// LOAD / SAVE VAULT
// ============================================================
function loadVault() {
    const key = getStoredKey();
    if (!key) { logout(); return; }

    const encrypted = localStorage.getItem("vault");
    if (!encrypted) { vault = []; return; }

    try {
        vault = decryptData(encrypted, key);
    } catch {
        sessionStorage.clear();
        window.location.replace("login.html");
    }
}

function saveVault() {
    const key = getStoredKey();
    if (!key) { logout(); return; }
    localStorage.setItem("vault", encryptData(vault, key));
}

// ============================================================
// SETTINGS
// ============================================================
function applyDarkMode() {
    document.body.classList.toggle("dark", settings.darkMode);
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
function showToast(msg) {
    copyToast.textContent = msg || "Copied!";
    copyToast.classList.add("show");
    setTimeout(() => copyToast.classList.remove("show"), 1800);
}

function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => showToast(msg));
}

// ============================================================
// XSS-SAFE TEXT HELPER
// ============================================================
function safeText(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
}

// ============================================================
// RENDER VAULT
// ============================================================
function renderVault(filter) {
    filter = filter || "";
    vaultContainer.innerHTML = "";

    let items = [...vault];

    const q = filter.toLowerCase();
    if (q) {
        items = items.filter(e =>
            (e.name     || "").toLowerCase().includes(q) ||
            (e.username || "").toLowerCase().includes(q) ||
            (e.url      || "").toLowerCase().includes(q) ||
            (e.notes    || "").toLowerCase().includes(q)
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
            ? `<div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
               <h2>No results</h2>
               <p>Try a different search term</p>`
            : `<div class="empty-icon"><i class="fa-solid fa-vault"></i></div>
               <h2>Your vault is empty</h2>
               <p>Add your first password to get started</p>
               <a href="add-entry.html" class="btn-black empty-add-btn">Add Entry</a>`;
        vaultContainer.appendChild(div);
        return;
    }

    const viewMode = settings.viewMode || "grid";

    if (viewMode === "list") {
        vaultContainer.style.display = "flex";
        vaultContainer.style.justifyContent = "center";
        const table = document.createElement("table");
        table.className = "vault-list-table";
        table.innerHTML = `<thead><tr>
            <th>Name</th><th>URL</th><th>Username</th><th>Password</th>
        </tr></thead>`;
        const tbody = document.createElement("tbody");
        items.forEach(entry => {
            const realIndex = vault.indexOf(entry);
            const tr = document.createElement("tr");
            // Safe: use textContent via DOM, not innerHTML with raw data
            const cells = [entry.name, entry.url || "—", entry.username, "••••••••"];
            cells.forEach(text => {
                const td = document.createElement("td");
                td.textContent = text || "";
                tr.appendChild(td);
            });
            tr.addEventListener("click", () => openCard(entry, realIndex));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        vaultContainer.appendChild(table);
        return;
    }

    vaultContainer.style.display = "";
    items.forEach(entry => {
        const realIndex = vault.indexOf(entry);
        const card = document.createElement("div");

        if (viewMode === "gallery") {
            card.className = "vault-gallery-card";
            // Safe: build with textContent, not innerHTML
            const title = document.createElement("div");
            title.className = "gallery-title";
            title.textContent = entry.name || "No Title";

            const details = document.createElement("div");
            details.className = "gallery-details";

            [
                ["URL", entry.url || "—"],
                ["Username", entry.username || ""],
                ["Password", "••••••••"]
            ].forEach(([label, val]) => {
                const p = document.createElement("p");
                p.innerHTML = `<strong>${label}:</strong> `;
                p.appendChild(document.createTextNode(val));
                details.appendChild(p);
            });

            card.appendChild(title);
            card.appendChild(details);
        } else {
            card.className = "vault-card";
            const h2 = document.createElement("h2");
            h2.textContent = entry.name || "No Title";
            card.appendChild(h2);
            if (entry.url) {
                const p = document.createElement("p");
                p.textContent = entry.url;
                card.appendChild(p);
            }
            const p2 = document.createElement("p");
            p2.textContent = entry.username || "";
            card.appendChild(p2);
        }

        card.dataset.id = realIndex;
        card.addEventListener("click", () => openCard(entry, realIndex));
        vaultContainer.appendChild(card);
    });
}

// ============================================================
// EXPANDED CARD
// ============================================================
function openCard(entry, index) {
    currentIndex    = index;
    passwordVisible = false;

    expandedName.textContent = entry.name || "No Title";

    const urlField = document.getElementById("url-field");
    if (entry.url) {
        // Safe URL: validate scheme before making it a link
        const safeUrl = /^https?:\/\//i.test(entry.url) ? entry.url : "#";
        expandedUrl.innerHTML = "";
        const a = document.createElement("a");
        a.href = safeUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = entry.url;
        expandedUrl.appendChild(a);
        urlField.style.display = "";
    } else {
        urlField.style.display = "none";
    }

    expandedUsername.textContent = entry.username || "—";
    expandedPassword.textContent = "••••••••";
    expandedNotes.textContent    = entry.notes || "No notes";

    togglePasswordBtn.querySelector("i").className = "fa-solid fa-eye-slash";
    editBtn.style.display           = "inline-block";
    saveCancelWrapper.style.display = "none";
    expandedCard.style.display      = "flex";
}

expandedCard.addEventListener("click", e => {
    if (e.target === expandedCard) {
        expandedCard.style.display = "none";
        exitEditMode();
    }
});

// ============================================================
// EDIT MODE
// ============================================================
editBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    const e = vault[currentIndex];

    editBtn.style.display           = "none";
    saveCancelWrapper.style.display = "flex";

    document.getElementById("url-field").style.display = "";

    const urlInput = document.createElement("input");
    urlInput.type = "text"; urlInput.id = "edit-url";
    urlInput.className = "value"; urlInput.value = e.url || "";
    expandedUrl.innerHTML = ""; expandedUrl.appendChild(urlInput);

    const userInput = document.createElement("input");
    userInput.type = "text"; userInput.id = "edit-username";
    userInput.className = "value"; userInput.value = e.username || "";
    expandedUsername.innerHTML = ""; expandedUsername.appendChild(userInput);

    const pwdInput = document.createElement("input");
    pwdInput.type = passwordVisible ? "text" : "password";
    pwdInput.id = "edit-password";
    pwdInput.className = "value"; pwdInput.value = e.password || "";
    expandedPassword.innerHTML = ""; expandedPassword.appendChild(pwdInput);

    const notesInput = document.createElement("textarea");
    notesInput.id = "edit-notes";
    notesInput.className = "value"; notesInput.value = e.notes || "";
    expandedNotes.innerHTML = ""; expandedNotes.appendChild(notesInput);
});

saveBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    vault[currentIndex].url      = (document.getElementById("edit-url")?.value      || "").trim();
    vault[currentIndex].username = (document.getElementById("edit-username")?.value  || "").trim();
    vault[currentIndex].password = (document.getElementById("edit-password")?.value  || "").trim();
    vault[currentIndex].notes    = (document.getElementById("edit-notes")?.value     || "").trim();
    saveVault();
    renderVault(searchInput.value);
    exitEditMode();
});

cancelBtn.addEventListener("click", exitEditMode);

function exitEditMode() {
    if (currentIndex === null) return;
    editBtn.style.display           = "inline-block";
    saveCancelWrapper.style.display = "none";
    const e = vault[currentIndex];
    openCard(e, currentIndex); // reuse openCard to safely re-render
    expandedCard.style.display = "flex"; // ensure it stays open
}

// ============================================================
// TOGGLE PASSWORD
// ============================================================
togglePasswordBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    passwordVisible = !passwordVisible;
    const editInput = document.getElementById("edit-password");
    if (editInput) {
        editInput.type = passwordVisible ? "text" : "password";
    } else {
        expandedPassword.textContent = passwordVisible
            ? vault[currentIndex].password
            : "••••••••";
    }
    togglePasswordBtn.querySelector("i").className = passwordVisible
        ? "fa-solid fa-eye"
        : "fa-solid fa-eye-slash";
});

// ============================================================
// COPY BUTTONS
// ============================================================
copyIconBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    copyToClipboard(vault[currentIndex].password, "Password copied!");
});

copyUsernameBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    copyToClipboard(vault[currentIndex].username, "Username copied!");
});

// ============================================================
// DELETE
// ============================================================
removeBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    if (!settings.confirmDelete) { deleteEntry(); return; }
    confirmOverlay.style.display = "flex";
});

confirmYes.addEventListener("click", deleteEntry);
confirmNo.addEventListener("click",  () => confirmOverlay.style.display = "none");
confirmOverlay.addEventListener("click", e => {
    if (e.target === confirmOverlay) confirmOverlay.style.display = "none";
});

function deleteEntry() {
    if (currentIndex === null) return;
    vault.splice(currentIndex, 1);
    saveVault();
    expandedCard.style.display   = "none";
    confirmOverlay.style.display = "none";
    currentIndex = null;
    renderVault(searchInput.value);
}

// ============================================================
// SEARCH
// ============================================================
searchInput.addEventListener("input", () => renderVault(searchInput.value));
searchInput.addEventListener("focus", () => {
    sortMenu.style.display = "none";
    sortToggle.classList.remove("active");
});

// ============================================================
// SORT
// ============================================================
sortToggle.addEventListener("click", e => {
    e.stopPropagation();
    const open = sortMenu.style.display === "flex";
    sortMenu.style.display = open ? "none" : "flex";
    sortToggle.classList.toggle("active", !open);
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
    });
});

document.querySelectorAll(".sort-order").forEach(el => {
    el.addEventListener("click", e => {
        e.stopPropagation();
        sortOrder = el.dataset.order;
        document.querySelectorAll(".sort-order .indicator").forEach(i => i.classList.remove("active"));
        el.querySelector(".indicator").classList.add("active");
        renderVault(searchInput.value);
    });
});

// ============================================================
// LOGOUT
// ============================================================
document.getElementById("logout-btn").addEventListener("click", logout);

// ============================================================
// INIT
// ============================================================
loadVault();
applyDarkMode();
applyViewMode(settings.viewMode || "grid");
sortField = settings.defaultSort || "name";
renderVault();

// =========================
// GLOBAL STATE
// =========================
let vault = [];
let currentIndex = null;
let passwordVisible = false;
let sortField = "name";
let sortOrder = "asc";

const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {
    darkMode: false,
    viewMode: "grid",
    defaultSort: "name",
    confirmDelete: true
};

// =========================
// AUTH
// =========================
checkAuth();
startActivityTracking();

window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// =========================
// ELEMENTS
// =========================
const vaultContainer    = document.getElementById("vault-container");
const searchInput       = document.getElementById("search-input");
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
const copyBtn           = document.getElementById("copy-btn");
const copyUsernameBtn   = document.getElementById("copy-username-btn");
const removeBtn         = document.getElementById("remove-btn");
const togglePasswordBtn = document.getElementById("toggle-password");
const confirmOverlay    = document.getElementById("confirmation-overlay");
const confirmYes        = document.getElementById("confirm-yes");
const confirmNo         = document.getElementById("confirm-no");
const copyToast         = document.getElementById("copy-toast");

// =========================
// LOAD / SAVE VAULT
// =========================
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

// =========================
// APPLY SETTINGS
// =========================
function applyDarkMode() {
    document.body.classList.toggle("dark", settings.darkMode);
}

function applyViewMode(mode) {
    mode = mode || settings.viewMode || "grid";
    document.body.classList.remove("grid-view", "list-view", "gallery-view");
    document.body.classList.add(mode + "-view");
    if (mode === "list") {
        vaultContainer.classList.add("list-view");
    } else {
        vaultContainer.classList.remove("list-view");
    }
}

// =========================
// COPY TOAST
// =========================
function showToast(msg = "Copied!") {
    copyToast.textContent = msg;
    copyToast.classList.add("show");
    setTimeout(() => copyToast.classList.remove("show"), 1800);
}

function copyToClipboard(text, msg) {
    navigator.clipboard.writeText(text).then(() => showToast(msg));
}

// =========================
// RENDER VAULT
// =========================
function renderVault(filter = "") {
    vaultContainer.innerHTML = "";
    let displayVault = [...vault];

    const q = filter.toLowerCase();
    if (q) {
        displayVault = displayVault.filter(e =>
            (e.name     || "").toLowerCase().includes(q) ||
            (e.username || "").toLowerCase().includes(q) ||
            (e.url      || "").toLowerCase().includes(q) ||
            (e.notes    || "").toLowerCase().includes(q)
        );
    }

    displayVault.sort((a, b) => {
        const valA = (a[sortField] || "").toLowerCase();
        const valB = (b[sortField] || "").toLowerCase();
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
    });

    const viewMode = settings.viewMode || "grid";

    if (!displayVault.length) {
        const emptyDiv = document.createElement("div");
        emptyDiv.classList.add("empty-state");
        emptyDiv.innerHTML = `<h2>No entries</h2><p>Add your first entry to get started</p>`;
        vaultContainer.appendChild(emptyDiv);
        return;
    }

    if (viewMode === "list") {
        vaultContainer.style.display = "flex";
        vaultContainer.style.justifyContent = "center";
        const table = document.createElement("table");
        table.classList.add("vault-list-table");
        table.innerHTML = `<thead><tr>
            <th>Name</th><th>URL</th><th>Username</th><th>Password</th>
        </tr></thead>`;
        const tbody = document.createElement("tbody");
        displayVault.forEach(entry => {
            const realIndex = vault.indexOf(entry);
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${entry.name || ""}</td>
                <td>${entry.url || "—"}</td>
                <td>${entry.username || ""}</td>
                <td>••••••••</td>`;
            tr.addEventListener("click", () => openExpandedCard(entry, realIndex));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        vaultContainer.appendChild(table);
        return;
    }

    vaultContainer.style.display = "";
    displayVault.forEach(entry => {
        const realIndex = vault.indexOf(entry);
        const card = document.createElement("div");

        if (viewMode === "grid") {
            card.classList.add("vault-card");
            card.innerHTML = `
                <h2>${entry.name || "No Title"}</h2>
                <p>${entry.url || ""}</p>
                <p>${entry.username || ""}</p>`;
        } else if (viewMode === "gallery") {
            card.classList.add("vault-gallery-card");
            card.innerHTML = `
                <div class="gallery-title">${entry.name || "No Title"}</div>
                <div class="gallery-details">
                    <p><strong>URL:</strong> ${entry.url || "—"}</p>
                    <p><strong>Username:</strong> ${entry.username || ""}</p>
                    <p><strong>Password:</strong> ••••••••</p>
                </div>`;
        }

        card.dataset.id = realIndex;
        card.addEventListener("click", () => openExpandedCard(entry, realIndex));
        vaultContainer.appendChild(card);
    });
}

// =========================
// EXPANDED CARD
// =========================
expandedCard.addEventListener("click", e => {
    if (e.target === expandedCard) {
        expandedCard.style.display = "none";
        exitEditMode();
    }
});

function openExpandedCard(entry, index) {
    currentIndex = index;
    expandedName.textContent = entry.name || "No Title";

    // URL — show as clickable link if present
    if (entry.url) {
        expandedUrl.innerHTML = `<a href="${entry.url}" target="_blank" rel="noopener">${entry.url}</a>`;
        document.getElementById("url-field").style.display = "";
    } else {
        document.getElementById("url-field").style.display = "none";
    }

    expandedUsername.textContent = entry.username || "—";
    expandedPassword.textContent = "••••••••";
    expandedNotes.textContent    = entry.notes || "No notes";

    expandedCard.style.display = "flex";
    editBtn.style.display = "inline-block";
    saveCancelWrapper.style.display = "none";

    passwordVisible = false;
    togglePasswordBtn.querySelector("i").className = "fa-solid fa-eye-slash";
}

// =========================
// EDIT MODE
// =========================
editBtn.addEventListener("click", enterEditMode);

function enterEditMode() {
    if (currentIndex === null) return;
    editBtn.style.display = "none";
    saveCancelWrapper.style.display = "flex";
    const e = vault[currentIndex];
    document.getElementById("url-field").style.display = "";
    expandedUrl.innerHTML      = `<input type="text" id="edit-url" class="value" value="${e.url || ""}">`;
    expandedUsername.innerHTML = `<input type="text" id="edit-username" class="value" value="${e.username || ""}">`;
    expandedPassword.innerHTML = `<input type="${passwordVisible ? "text" : "password"}" id="edit-password" class="value" value="${e.password || ""}">`;
    expandedNotes.innerHTML    = `<textarea id="edit-notes" class="value">${e.notes || ""}</textarea>`;
}

saveBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    vault[currentIndex].url      = (document.getElementById("edit-url")?.value || "").trim();
    vault[currentIndex].username = document.getElementById("edit-username").value.trim();
    vault[currentIndex].password = document.getElementById("edit-password").value.trim();
    vault[currentIndex].notes    = document.getElementById("edit-notes").value.trim();
    saveVault();
    exitEditMode();
    renderVault(searchInput.value);
});

cancelBtn.addEventListener("click", () => {
    exitEditMode();
});

function exitEditMode() {
    if (currentIndex === null) return;
    editBtn.style.display = "inline-block";
    saveCancelWrapper.style.display = "none";
    const e = vault[currentIndex];
    if (e.url) {
        expandedUrl.innerHTML = `<a href="${e.url}" target="_blank" rel="noopener">${e.url}</a>`;
        document.getElementById("url-field").style.display = "";
    } else {
        document.getElementById("url-field").style.display = "none";
    }
    expandedUsername.textContent = e.username || "—";
    expandedPassword.textContent = passwordVisible ? e.password : "••••••••";
    expandedNotes.textContent    = e.notes || "No notes";
}

// =========================
// TOGGLE PASSWORD
// =========================
togglePasswordBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    const pwdInput = document.getElementById("edit-password");
    passwordVisible = !passwordVisible;
    if (pwdInput) {
        pwdInput.type = passwordVisible ? "text" : "password";
    } else {
        expandedPassword.textContent = passwordVisible ? vault[currentIndex].password : "••••••••";
    }
    togglePasswordBtn.querySelector("i").className = passwordVisible
        ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
});

// =========================
// COPY BUTTONS
// =========================
copyBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    copyToClipboard(vault[currentIndex].password, "Password copied!");
});

copyUsernameBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    copyToClipboard(vault[currentIndex].username, "Username copied!");
});

// =========================
// DELETE
// =========================
removeBtn.addEventListener("click", () => {
    if (currentIndex === null) return;
    if (!settings.confirmDelete) { deleteCurrentEntry(); return; }
    confirmOverlay.style.display = "flex";
});

confirmYes.addEventListener("click", deleteCurrentEntry);
confirmNo.addEventListener("click", () => confirmOverlay.style.display = "none");
confirmOverlay.addEventListener("click", e => {
    if (e.target === confirmOverlay) confirmOverlay.style.display = "none";
});

function deleteCurrentEntry() {
    if (currentIndex === null) return;
    vault.splice(currentIndex, 1);
    saveVault();
    expandedCard.style.display = "none";
    confirmOverlay.style.display = "none";
    currentIndex = null;
    renderVault(searchInput.value);
}

// =========================
// SEARCH + SORT
// =========================
searchInput.addEventListener("input", () => renderVault(searchInput.value));

const sortToggle = document.getElementById("sort-toggle");
const sortMenu   = document.getElementById("sort-menu");

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

// =========================
// LOGOUT
// =========================
document.getElementById("logout-btn").addEventListener("click", logout);

// =========================
// INIT
// =========================
loadVault();
applyDarkMode();
applyViewMode(settings.viewMode || "grid");
sortField = settings.defaultSort || "name";
renderVault();
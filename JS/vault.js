// =========================
// GLOBAL STATE
// =========================
let vault = [];
let currentIndex = null;
let passwordVisible = false;
let sortField = "name";
let sortOrder = "asc";

// =========================
// SETTINGS
// =========================
const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {
    darkMode: false,
    viewMode: "grid",      // grid, list, gallery
    defaultSort: "name",
    confirmDelete: true
};

// =========================
// ELEMENTS
// =========================
const vaultContainer = document.getElementById("vault-container");
const searchInput = document.getElementById("search-input");

const expandedCard = document.getElementById("expanded-card");
const expandedName = document.getElementById("expanded-name");
const expandedUsername = document.getElementById("expanded-username");
const expandedPassword = document.getElementById("expanded-password");
const expandedNotes = document.getElementById("expanded-notes");

const editBtn = document.getElementById("edit-btn");
const saveCancelWrapper = document.getElementById("save-cancel-wrapper");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");

const copyBtn = document.getElementById("copy-btn");
const removeBtn = document.getElementById("remove-btn");
const togglePasswordBtn = document.getElementById("toggle-password");

const confirmOverlay = document.getElementById("confirmation-overlay");
const confirmYes = document.getElementById("confirm-yes");
const confirmNo = document.getElementById("confirm-no");

// =========================
// AUTH GUARD + SESSION CHECK
// =========================
function checkAuth() {
    const isAuth   = localStorage.getItem("authenticated") === "true";
    const vaultKey = sessionStorage.getItem("vaultKey");
    if (!isAuth || !vaultKey) { window.location.replace("login.html"); return; }

    const last    = parseInt(localStorage.getItem("lastActive"), 10);
    const timeout = 5 * 60 * 1000;
    if (last && Date.now() - last > timeout) {
        localStorage.removeItem("authenticated");
        sessionStorage.removeItem("vaultKey");
        window.location.replace("login.html");
        return;
    }
    localStorage.setItem("lastActive", Date.now());
}


checkAuth();

// Prevent back navigation
window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// =========================
// LOAD / SAVE VAULT
// =========================
function loadVault() {
    const key = getStoredKey();
    if (!key) { window.location.replace("login.html"); return; }
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
    if (!key) { window.location.replace("login.html"); return; }
    localStorage.setItem("vault", encryptData(vault, key));
}

// =========================
// SETTINGS AND VIEW MODE
// =========================
function applyDarkMode() {
    document.body.classList.toggle("dark", settings.darkMode);
}

function applyViewMode(mode) {
    document.body.classList.remove("grid-view", "list-view", "gallery-view");
    document.body.classList.add(mode + "-view");

    // Add/remove container class
    if (mode === "list") {
        vaultContainer.classList.add("list-view");
    } else {
        vaultContainer.classList.remove("list-view");
    }
}

// =========================
// RENDER VAULT
// =========================
function renderVault(filter = "") {
    vaultContainer.innerHTML = "";
    let displayVault = [...vault];

    const q = filter.toLowerCase();
    if (q) {
        displayVault = displayVault.filter(
            e => (e.name||"").toLowerCase().includes(q) ||
                 (e.username||"").toLowerCase().includes(q) ||
                 (e.notes||"").toLowerCase().includes(q)
        );
    }

    displayVault.sort((a, b) => {
        const valA = (a[sortField]||"").toLowerCase();
        const valB = (b[sortField]||"").toLowerCase();
        if (valA < valB) return sortOrder==="asc"?-1:1;
        if (valA > valB) return sortOrder==="asc"?1:-1;
        return 0;
    });

    const viewMode = settings.viewMode || "grid";

    if (!displayVault.length) {
        const emptyDiv = document.createElement("div");
        emptyDiv.classList.add("empty-state");
        emptyDiv.innerHTML = `<h2>No results</h2><p>Try a different search or add a new entry</p>`;
        vaultContainer.appendChild(emptyDiv);
        return;
    }

    if (viewMode === "list") {
        vaultContainer.style.display = "flex";
        vaultContainer.style.justifyContent = "center";

        const table = document.createElement("table");
        table.classList.add("vault-list-table");

        const thead = document.createElement("thead");
        thead.innerHTML = `<tr>
            <th>Site Name</th>
            <th>Username</th>
            <th>Password</th>
            <th>Notes</th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        displayVault.forEach(entry => {
            const realIndex = vault.indexOf(entry);
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${entry.name||""}</td>
                            <td>${entry.username||""}</td>
                            <td>••••••••</td>
                            <td>${entry.notes||"No notes"}</td>`;

            // Click a row to open expanded card
            tr.addEventListener("click", () => openExpandedCard(entry, realIndex));

            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        vaultContainer.appendChild(table);
        return; // only return for list view
    } else {
        vaultContainer.style.display = ""; // reset for grid/gallery
    }

    // GRID or GALLERY view
    displayVault.forEach(entry => {
        const realIndex = vault.indexOf(entry);
        const card = document.createElement("div");

        if (viewMode === "grid") {
            card.classList.add("vault-card");
            card.innerHTML = `
                <h2>${entry.name||"No Title"}</h2>
                <p>${entry.username||""}</p>
                <p>••••••••</p>
            `;
        } else if (viewMode === "gallery") {
            card.classList.add("vault-gallery-card");
            card.innerHTML = `
                <div class="gallery-title">${entry.name||"No Title"}</div>
                <div class="gallery-details">
                    <p><strong>Username:</strong> ${entry.username||""}</p>
                    <p><strong>Password:</strong> ••••••••</p>
                    <p><strong>Notes:</strong> ${entry.notes||""}</p>
                </div>
            `;
        }

        card.dataset.id = realIndex;
        card.addEventListener("click", () => openExpandedCard(entry, realIndex));
        vaultContainer.appendChild(card);
    });
}

// Close expanded card if clicking outside it
expandedCard.addEventListener("click", e => {
    if (e.target === expandedCard) {
        expandedCard.style.display = "none";
        exitEditMode();
    }
});

// =========================
// EXPANDED CARD + EDIT MODE
// =========================
function openExpandedCard(entry,index){
    currentIndex=index;
    expandedName.textContent = entry.name||"No Title";

    expandedUsername.innerHTML = `<div class="value">${entry.username||""}</div>`;
    expandedPassword.innerHTML = `<div class="value" id="password-text">••••••••</div>`;
    expandedNotes.innerHTML = `<div class="value" style="min-height:60px;">${entry.notes||"No notes"}</div>`;

    expandedCard.style.display="flex";
    editBtn.style.display="inline-block";
    saveCancelWrapper.style.display="none";

    passwordVisible=false;
    togglePasswordBtn.innerHTML='<i class="fa-solid fa-eye-slash"></i>';
}

editBtn.addEventListener("click",enterEditMode);
function enterEditMode(){
    if(currentIndex===null) return;
    editBtn.style.display="none";
    saveCancelWrapper.style.display="flex";
    const e=vault[currentIndex];
    expandedUsername.innerHTML=`<input type="text" id="edit-username" class="value" value="${e.username||""}">`;
    expandedPassword.innerHTML=`<input type="${passwordVisible?"text":"password"}" id="edit-password" class="value" value="${e.password||""}">`;
    expandedNotes.innerHTML=`<textarea id="edit-notes" class="value" rows="1">${e.notes||""}</textarea>`;
}

saveBtn.addEventListener("click",()=>{
    if(currentIndex===null) return;
    vault[currentIndex].username=document.getElementById("edit-username").value.trim();
    vault[currentIndex].password=document.getElementById("edit-password").value.trim();
    vault[currentIndex].notes=document.getElementById("edit-notes").value.trim();
    saveVault();
    exitEditMode();
    renderVault(searchInput.value);
});

cancelBtn.addEventListener("click",()=>{
    exitEditMode();
    renderVault(searchInput.value);
});

function exitEditMode(){
    if(currentIndex===null) return;
    editBtn.style.display="inline-block";
    saveCancelWrapper.style.display="none";
    const e=vault[currentIndex];
    expandedUsername.innerHTML=`<div class="value">${e.username}</div>`;
    expandedPassword.innerHTML=`<div class="value" id="password-text">${passwordVisible?e.password:"••••••••"}</div>`;
    expandedNotes.innerHTML=`<div class="value" style="min-height:60px;">${e.notes||"No notes"}</div>`;
}

// =========================
// COPY / DELETE ENTRY
// =========================
togglePasswordBtn.addEventListener("click",()=>{
    if(currentIndex===null) return;
    const pwdInput=document.getElementById("edit-password");
    const pwdText=document.getElementById("password-text");
    passwordVisible=!passwordVisible;
    if(pwdInput) pwdInput.type=passwordVisible?"text":"password";
    if(pwdText) pwdText.textContent=passwordVisible?vault[currentIndex].password:"••••••••";
});

removeBtn.addEventListener("click",()=>{
    if(currentIndex===null) return;
    if(!settings.confirmDelete){ deleteCurrentEntry(); return; }
    confirmOverlay.style.display="flex";
});
confirmYes.addEventListener("click",deleteCurrentEntry);
confirmNo.addEventListener("click",()=>confirmOverlay.style.display="none");
confirmOverlay.addEventListener("click",(e)=>{if(e.target===confirmOverlay) confirmOverlay.style.display="none";});

function deleteCurrentEntry(){
    if(currentIndex===null) return;
    vault.splice(currentIndex,1);
    saveVault();
    expandedCard.style.display="none";
    confirmOverlay.style.display="none";
    renderVault(searchInput.value);
}

// =========================
// SEARCH + SORT
// =========================
searchInput.addEventListener("input",()=>renderVault(searchInput.value));

// Sort indicator logic left same as before...
// View mode radio
document.querySelectorAll('[name="vault-view"]').forEach(radio=>{
    radio.addEventListener("change",()=>{
        settings.viewMode=radio.value;
        localStorage.setItem("vaultSettings",JSON.stringify(settings));
        applyViewMode();
        renderVault(searchInput.value);
    });
});

// =========================
// LOGOUT
// =========================
document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("authenticated");
    sessionStorage.removeItem("vaultKey");
    window.location.replace("login.html");
});

// =========================
// INIT
// =========================
loadVault();
applyDarkMode();
applyViewMode();
sortField=settings.defaultSort||"name";
renderVault();
// =========================
// ADD ENTRY
// =========================

const saveBtn      = document.getElementById("save-entry");
const cancelBtn    = document.getElementById("cancel-entry");
const nameInput    = document.getElementById("entry-name");
const usernameInput= document.getElementById("entry-username");
const passwordInput= document.getElementById("entry-password");
const notesInput   = document.getElementById("entry-notes");
const toggleBtn    = document.getElementById("toggle-password");
const toggleIcon   = toggleBtn.querySelector("i");

// =========================
// AUTH GUARD
// =========================
function checkAuth() {
    const isAuth   = localStorage.getItem("authenticated") === "true";
    const vaultKey = sessionStorage.getItem("vaultKey");

    if (!isAuth || !vaultKey) {
        window.location.replace("login.html");
        return;
    }

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

window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// =========================
// APPLY SETTINGS (dark mode only — no settings.js needed)
// =========================
document.addEventListener("DOMContentLoaded", () => {
    const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {};
    document.body.classList.toggle("dark", settings.darkMode);
});

// =========================
// TOGGLE PASSWORD VISIBILITY
// =========================
toggleBtn.addEventListener("click", () => {
    const isVisible = passwordInput.type === "text";
    passwordInput.type = isVisible ? "password" : "text";
    toggleIcon.className = isVisible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});

// =========================
// SAVE ENTRY
// =========================
saveBtn.addEventListener("click", () => {
    const name     = nameInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const notes    = notesInput.value.trim();

    if (!name || !username || !password) {
        alert("Name, username, and password are required.");
        return;
    }

    const key = getStoredKey();
    if (!key) { window.location.replace("JS/login.html"); return; }

    // Load existing vault
    let vault = [];
    const encrypted = localStorage.getItem("vault");
    if (encrypted) {
        try { vault = decryptData(encrypted, key); }
        catch { vault = []; }
    }

    vault.push({ name, username, password, notes });
    localStorage.setItem("vault", encryptData(vault, key));
    window.location.href = "vault.html";
});

// =========================
// CANCEL
// =========================
cancelBtn.addEventListener("click", () => {
    window.location.href = "vault.html";
});

document.getElementById("logout-btn").addEventListener("click", () => {
    localStorage.removeItem("authenticated");
    sessionStorage.removeItem("vaultKey");
    window.location.replace("login.html");
});
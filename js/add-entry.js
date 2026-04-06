// =========================
// AUTH
// =========================
checkAuth();
startActivityTracking();

window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// Apply dark mode
const _s = JSON.parse(localStorage.getItem("vaultSettings")) || {};
document.body.classList.toggle("dark", _s.darkMode);

// =========================
// ELEMENTS
// =========================
const saveBtn       = document.getElementById("save-entry");
const cancelBtn     = document.getElementById("cancel-entry");
const nameInput     = document.getElementById("entry-name");
const urlInput      = document.getElementById("entry-url");
const usernameInput = document.getElementById("entry-username");
const passwordInput = document.getElementById("entry-password");
const notesInput    = document.getElementById("entry-notes");
const toggleBtn     = document.getElementById("toggle-password");
const toggleIcon    = toggleBtn.querySelector("i");
const generateBtn   = document.getElementById("generate-btn");
const genLength     = document.getElementById("gen-length");
const genLengthLabel= document.getElementById("gen-length-label");
const strengthBar   = document.getElementById("strength-bar");
const strengthLabel = document.getElementById("strength-label");

// =========================
// TOGGLE PASSWORD VISIBILITY
// =========================
toggleBtn.addEventListener("click", () => {
    const isVisible = passwordInput.type === "text";
    passwordInput.type = isVisible ? "password" : "text";
    toggleIcon.className = isVisible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
});

// =========================
// PASSWORD GENERATOR
// =========================
genLength.addEventListener("input", () => {
    genLengthLabel.textContent = genLength.value;
});

generateBtn.addEventListener("click", () => {
    const upper   = document.getElementById("gen-upper").checked;
    const numbers = document.getElementById("gen-numbers").checked;
    const symbols = document.getElementById("gen-symbols").checked;
    const length  = parseInt(genLength.value);

    let chars = "abcdefghijklmnopqrstuvwxyz";
    if (upper)   chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (numbers) chars += "0123456789";
    if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    if (chars.length === 0) { alert("Select at least one character type"); return; }

    // Use crypto.getRandomValues for true randomness
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    const password = Array.from(array).map(n => chars[n % chars.length]).join("");

    passwordInput.value = password;
    passwordInput.type  = "text";
    toggleIcon.className = "fa-solid fa-eye";
    checkStrength(password);
});

// =========================
// STRENGTH INDICATOR
// =========================
function checkStrength(password) {
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const levels = [
        { label: "",        color: "transparent", width: "0%" },
        { label: "Weak",    color: "#e74c3c",     width: "25%" },
        { label: "Fair",    color: "#e67e22",     width: "50%" },
        { label: "Good",    color: "#f1c40f",     width: "75%" },
        { label: "Strong",  color: "#2ecc71",     width: "100%" },
    ];

    const level = score <= 1 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;
    strengthBar.style.width      = levels[level].width;
    strengthBar.style.background = levels[level].color;
    strengthLabel.textContent    = levels[level].label;
    strengthLabel.style.color    = levels[level].color;
}

passwordInput.addEventListener("input", () => checkStrength(passwordInput.value));

// =========================
// SAVE ENTRY
// =========================
saveBtn.addEventListener("click", () => {
    const name     = nameInput.value.trim();
    const url      = urlInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const notes    = notesInput.value.trim();

    if (!name || !username || !password) {
        alert("Name, username, and password are required.");
        return;
    }

    const key = getStoredKey();
    if (!key) { window.location.replace("login.html"); return; }

    let vault = [];
    const encrypted = localStorage.getItem("vault");
    if (encrypted) {
        try { vault = decryptData(encrypted, key); }
        catch { vault = []; }
    }

    vault.push({ name, url, username, password, notes });
    localStorage.setItem("vault", encryptData(vault, key));
    window.location.href = "vault.html";
});

// =========================
// CANCEL
// =========================
cancelBtn.addEventListener("click", () => {
    window.location.href = "vault.html";
});

document.getElementById("logout-btn").addEventListener("click", logout);
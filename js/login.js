// =========================
// LOGIN
// =========================

document.addEventListener("DOMContentLoaded", () => {
    applyVaultSettings();

    // Already logged in — go straight to vault
    const isAuth = localStorage.getItem("authenticated") === "true";
    const vaultKey = sessionStorage.getItem("vaultKey");
    if (isAuth && vaultKey) {
        window.location.replace("vault.html");
    }
});

const loginBtn      = document.getElementById("login-btn");
const passwordInput = document.getElementById("master-password");
const loginError    = document.getElementById("login-error");
const toggleBtn     = document.getElementById("toggle-password");
const toggleIcon    = toggleBtn.querySelector("i");

function applyVaultSettings() {
    const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {};
    document.body.classList.toggle("dark", settings.darkMode);
}

loginBtn.addEventListener("click", () => {
    const password = passwordInput.value.trim();
    if (!password) {
        loginError.textContent = "Enter a password";
        loginError.style.display = "block";
        return;
    }

    // Derive key from password + stored salt
    const key = loginAndStoreKey(password);

    // If a vault already exists, verify the password is correct by
    // attempting decryption. If it fails, the password is wrong.
    const encryptedVault = localStorage.getItem("vault");
    if (encryptedVault) {
        try {
            decryptData(encryptedVault, key);
        } catch {
            // Wrong password — clear the bad key from session
            sessionStorage.removeItem("vaultKey");
            loginError.textContent = "Incorrect master password";
            loginError.style.display = "block";
            return;
        }
    }

    localStorage.setItem("authenticated", "true");
    localStorage.setItem("lastActive", Date.now());
    window.location.replace("vault.html");
});

toggleBtn.addEventListener("click", () => {
    const isPassword = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    toggleIcon.className = isPassword ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
});

passwordInput.addEventListener("keyup", e => {
    if (e.key === "Enter") loginBtn.click();
});
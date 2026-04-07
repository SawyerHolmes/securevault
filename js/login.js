console.log("login.js loaded");


// =========================
// LOGIN
// =========================

const MAX_ATTEMPTS  = 5;
const LOCKOUT_TIME  = 30 * 1000; // 30 seconds

function getLockoutState() {
    const attempts  = parseInt(localStorage.getItem("loginAttempts") || "0", 10);
    const lockedAt  = parseInt(localStorage.getItem("lockedAt") || "0", 10);
    return { attempts, lockedAt };
}

function isLockedOut() {
    const { attempts, lockedAt } = getLockoutState();
    if (attempts >= MAX_ATTEMPTS) {
        const remaining = LOCKOUT_TIME - (Date.now() - lockedAt);
        if (remaining > 0) return Math.ceil(remaining / 1000);
        // Lockout expired — reset
        localStorage.removeItem("loginAttempts");
        localStorage.removeItem("lockedAt");
    }
    return false;
}

function recordFailedAttempt() {
    const { attempts } = getLockoutState();
    const newAttempts = attempts + 1;
    localStorage.setItem("loginAttempts", newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
        localStorage.setItem("lockedAt", Date.now());
    }
}

function resetAttempts() {
    localStorage.removeItem("loginAttempts");
    localStorage.removeItem("lockedAt");
}

// =========================
// APPLY SETTINGS
// =========================
function applyVaultSettings() {
    const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {};
    document.body.classList.toggle("dark", settings.darkMode);
}

// =========================
// INIT
// =========================
applyVaultSettings();

const isAuth   = localStorage.getItem("authenticated") === "true";
const vaultKey = sessionStorage.getItem("vaultKey");
if (isAuth && vaultKey) {
    window.location.replace("vault.html");
}

const loginBtn      = document.getElementById("login-btn");
const passwordInput = document.getElementById("master-password");
const loginError    = document.getElementById("login-error");
const toggleBtn     = document.getElementById("toggle-password");
const toggleIcon    = toggleBtn.querySelector("i");

// Check lockout state on page load
(function checkLockoutOnLoad() {
    const remaining = isLockedOut();
    if (remaining) {
        loginBtn.disabled = true;
        loginError.style.display = "block";
        loginError.textContent = `Too many attempts. Try again in ${remaining}s`;
        startLockoutTimer();
    }
})();

function startLockoutTimer() {
    const interval = setInterval(() => {
        const remaining = isLockedOut();
        if (!remaining) {
            clearInterval(interval);
            loginBtn.disabled = false;
            loginError.style.display = "none";
        } else {
            loginError.textContent = `Too many attempts. Try again in ${remaining}s`;
        }
    }, 1000);
}

// =========================
// LOGIN
// =========================
loginBtn.addEventListener("click", () => {
    const remaining = isLockedOut();
    if (remaining) return;

    const password = passwordInput.value.trim();
    if (!password) {
        loginError.textContent = "Enter a password";
        loginError.style.display = "block";
        return;
    }

    const key = loginAndStoreKey(password);

    const encryptedVault = localStorage.getItem("vault");
    if (encryptedVault) {
        try {
            decryptData(encryptedVault, key);
        } catch {
            sessionStorage.removeItem("vaultKey");
            recordFailedAttempt();

            const { attempts } = getLockoutState();
            const left = MAX_ATTEMPTS - attempts;
            const stillLocked = isLockedOut();

            if (stillLocked) {
                loginBtn.disabled = true;
                loginError.textContent = `Too many attempts. Try again in ${stillLocked}s`;
                startLockoutTimer();
            } else {
                loginError.textContent = left > 0
                    ? `Incorrect password. ${left} attempt${left === 1 ? "" : "s"} remaining`
                    : "Incorrect password";
            }
            loginError.style.display = "block";
            return;
        }
    }

    resetAttempts();
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
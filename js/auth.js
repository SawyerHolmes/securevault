// =========================
// AUTH UTILITIES
// Shared across vault.js, settings.js, add-entry.js
// =========================

const SESSION_TIMEOUT  = 5 * 60 * 1000; // 5 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION   = 30 * 1000; // 30 seconds

// =========================
// AUTH GUARD
// =========================
function checkAuth() {
    // Use sessionStorage for auth state — clears on tab/browser close
    const isAuth   = sessionStorage.getItem("authenticated") === "true";
    const vaultKey = sessionStorage.getItem("vaultKey");

    if (!isAuth || !vaultKey) {
        window.location.replace("login.html");
        return;
    }

    const last = parseInt(sessionStorage.getItem("lastActive"), 10);
    if (last && Date.now() - last > SESSION_TIMEOUT) {
        logout();
        return;
    }

    updateActivity();
}

// =========================
// ACTIVITY TRACKING
// =========================
function updateActivity() {
    sessionStorage.setItem("lastActive", Date.now());
}

function startActivityTracking() {
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
    });

    setInterval(() => {
        const last = parseInt(sessionStorage.getItem("lastActive"), 10);
        if (last && Date.now() - last > SESSION_TIMEOUT) {
            logout();
        }
    }, 30000);
}

// =========================
// BRUTE FORCE PROTECTION
// =========================
function getLoginAttempts() {
    return parseInt(localStorage.getItem("loginAttempts") || "0", 10);
}

function getLockoutTime() {
    return parseInt(localStorage.getItem("lockoutUntil") || "0", 10);
}

function isLockedOut() {
    const lockoutUntil = getLockoutTime();
    if (!lockoutUntil) return false;
    if (Date.now() < lockoutUntil) return true;
    // Lockout expired — clear it
    localStorage.removeItem("lockoutUntil");
    localStorage.removeItem("loginAttempts");
    return false;
}

function recordFailedAttempt() {
    const attempts = getLoginAttempts() + 1;
    localStorage.setItem("loginAttempts", attempts);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
        const lockoutUntil = Date.now() + LOCKOUT_DURATION;
        localStorage.setItem("lockoutUntil", lockoutUntil);
        localStorage.setItem("loginAttempts", "0");
        return { locked: true, seconds: LOCKOUT_DURATION / 1000 };
    }
    return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - attempts };
}

function clearLoginAttempts() {
    localStorage.removeItem("loginAttempts");
    localStorage.removeItem("lockoutUntil");
}

// =========================
// LOGOUT
// =========================
function logout() {
    sessionStorage.removeItem("authenticated");
    sessionStorage.removeItem("vaultKey");
    sessionStorage.removeItem("lastActive");
    window.location.replace("login.html");
}

// =========================
// CHANGE MASTER PASSWORD
// =========================
async function changeMasterPassword(currentPassword, newPassword) {
    const currentKey = deriveKey(currentPassword);
    const encryptedVault = localStorage.getItem("vault");
    let vaultData = [];

    if (encryptedVault) {
        try {
            vaultData = decryptData(encryptedVault, currentKey);
        } catch {
            return { ok: false, error: "Current password is incorrect" };
        }
    }

    // Generate new salt and derive new key
    localStorage.removeItem("vaultSalt");
    const newKey = loginAndStoreKey(newPassword);

    // Re-encrypt vault with new key
    localStorage.setItem("vault", encryptData(vaultData, newKey));
    sessionStorage.setItem("authenticated", "true");

    if (typeof syncConfigured === "function" && syncConfigured()) {
        const result = await pushToGist();
        if (!result.ok) {
            return { ok: true, warning: "Password changed locally but Gist push failed: " + result.error };
        }
    }

    return { ok: true };
}

// ============================================================
// AUTH.JS — SecureVault
// Shared across vault.js, settings.js, add-entry.js
// ============================================================

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// ============================================================
// AUTH GUARD
// Called at the top of every protected page
// ============================================================
function checkAuth() {
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

// ============================================================
// ACTIVITY TRACKING
// Resets the session timeout on any user interaction
// ============================================================
function updateActivity() {
    sessionStorage.setItem("lastActive", Date.now());
}

function startActivityTracking() {
    ["click", "keydown", "touchstart", "scroll"].forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
    });

    setInterval(() => {
        const last = parseInt(sessionStorage.getItem("lastActive"), 10);
        if (last && Date.now() - last > SESSION_TIMEOUT) {
            logout();
        }
    }, 30000);
}

// ============================================================
// LOGOUT
// ============================================================
function logout() {
    sessionStorage.removeItem("authenticated");
    sessionStorage.removeItem("vaultKey");
    sessionStorage.removeItem("lastActive");
    window.location.replace("login.html");
}

// ============================================================
// CHANGE MASTER PASSWORD
// Verifies current password, derives new key, re-encrypts vault
// ============================================================
async function changeMasterPassword(currentPassword, newPassword) {
    const currentKey     = deriveKey(currentPassword);
    const encryptedVault = localStorage.getItem("vault");
    let vaultData        = [];

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

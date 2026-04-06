// =========================
// AUTH UTILITIES
// Shared across vault.js, settings.js, add-entry.js
// =========================

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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

    const last = parseInt(localStorage.getItem("lastActive"), 10);
    if (last && Date.now() - last > SESSION_TIMEOUT) {
        logout();
        return;
    }

    updateActivity();
}

// =========================
// ACTIVITY TRACKING
// Reset timeout on any user interaction
// =========================
function updateActivity() {
    localStorage.setItem("lastActive", Date.now());
}

function startActivityTracking() {
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach(event => {
        document.addEventListener(event, updateActivity, { passive: true });
    });

    // Check timeout every 30 seconds
    setInterval(() => {
        const last = parseInt(localStorage.getItem("lastActive"), 10);
        if (last && Date.now() - last > SESSION_TIMEOUT) {
            logout();
        }
    }, 30000);
}

// =========================
// LOGOUT
// =========================
function logout() {
    localStorage.removeItem("authenticated");
    sessionStorage.removeItem("vaultKey");
    window.location.replace("login.html");
}

// =========================
// CHANGE MASTER PASSWORD
// Re-derives key with new password, re-encrypts vault, updates Gist
// =========================
async function changeMasterPassword(currentPassword, newPassword) {
    // Verify current password first
    const currentKey = deriveKey(currentPassword);
    const encryptedVault = localStorage.getItem("vault");

    let vault = [];
    if (encryptedVault) {
        try {
            vault = decryptData(encryptedVault, currentKey);
        } catch {
            return { ok: false, error: "Current password is incorrect" };
        }
    }

    // Generate new salt and derive new key
    localStorage.removeItem("vaultSalt"); // force new salt
    const newKey = loginAndStoreKey(newPassword);

    // Re-encrypt vault with new key
    localStorage.setItem("vault", encryptData(vault, newKey));
    localStorage.setItem("authenticated", "true");

    // Push to Gist if configured
    if (syncConfigured()) {
        const result = await pushToGist();
        if (!result.ok) {
            return { ok: true, warning: "Password changed locally but Gist push failed: " + result.error };
        }
    }

    return { ok: true };
}
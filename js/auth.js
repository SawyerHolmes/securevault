// ============================================================
// AUTH.JS — SecureVault
// Shared across vault.js, settings.js, add-entry.js
// ============================================================

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Auto-lock is opt-out: default ON for a password vault.
// Toggling "Auto-lock vault" off in Settings disables the timer.
function autoLockEnabled() {
    const s = JSON.parse(localStorage.getItem("vaultSettings") || "{}");
    return s.autoLock !== false;
}

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

    if (autoLockEnabled()) {
        const last = parseInt(sessionStorage.getItem("lastActive"), 10);
        if (last && Date.now() - last > SESSION_TIMEOUT) {
            logout();
            return;
        }
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
        if (!autoLockEnabled()) return;
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
// Atomic-ish: decrypt with old key, build all new ciphertexts in
// memory, then write salt + vault + sync token + session key
// together so a mid-operation failure can't brick the vault.
// ============================================================
async function changeMasterPassword(currentPassword, newPassword) {
    // 1) Verify with current key
    const currentKey     = await deriveKey(currentPassword);
    const encryptedVault = localStorage.getItem("vault");
    let vaultData        = [];

    if (encryptedVault) {
        try {
            vaultData = await decryptData(encryptedVault, currentKey);
        } catch {
            return { ok: false, error: "Current password is incorrect" };
        }
    }

    // 2) Decrypt the sync token (if any) with the OLD key
    const rawCfg = JSON.parse(localStorage.getItem("syncConfig") || "{}");
    const gistId = rawCfg.gistId || "";
    let plainToken = "";
    if (rawCfg.encryptedToken) {
        try   { plainToken = await decryptData(rawCfg.encryptedToken, currentKey); }
        catch { plainToken = ""; }
    }

    // 3) Build all new ciphertexts under a fresh salt + key
    const newSaltBytes  = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const newSaltB64    = bytesToBase64(newSaltBytes);
    const newKey        = await deriveKeyFromSalt(newPassword, newSaltBytes);
    const newVaultBlob  = await encryptData(vaultData, newKey);
    const newTokenBlob  = plainToken ? await encryptData(plainToken, newKey) : null;
    const newKeyRaw     = await crypto.subtle.exportKey("raw", newKey);
    const newSyncCfg    = newTokenBlob
        ? { gistId, encryptedToken: newTokenBlob }
        : (gistId ? { gistId } : null);

    // 4) Commit — only after every new value is in hand
    localStorage.setItem("vaultSalt", newSaltB64);
    localStorage.setItem("vault",     newVaultBlob);
    if (newSyncCfg) localStorage.setItem("syncConfig", JSON.stringify(newSyncCfg));
    sessionStorage.setItem("vaultKey",      bytesToBase64(new Uint8Array(newKeyRaw)));
    sessionStorage.setItem("authenticated", "true");

    // 5) Best-effort sync push
    if (typeof syncConfigured === "function" && await syncConfigured()) {
        const result = await pushToGist();
        if (!result.ok) {
            return { ok: true, warning: "Password changed locally but Gist push failed: " + result.error };
        }
    }

    return { ok: true };
}

// ============================================================
// RECOVERY.JS — recovery-code escape hatch.
// A recovery code wraps a copy of the vault key (same additive
// model as biometric.js — the vault itself is untouched). If the
// master password is forgotten, the code unwraps the vault key and
// the user immediately sets a new master password.
//
// The code is shown once and never stored in plaintext. Changing
// the master password (or using recovery) invalidates the wrap, so
// a fresh code must be generated afterwards.
// ============================================================

const RECOVERY_STORAGE_KEY = "recovery";
// Crockford-ish alphabet: no 0/O/1/I/L to avoid transcription errors
const RECOVERY_ALPHABET    = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function recoveryConfigured() {
    return !!localStorage.getItem(RECOVERY_STORAGE_KEY);
}

function disableRecovery() {
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
}

function generateRecoveryCode() {
    // 24 chars (~120 bits), grouped 4-4-4-4-4-4 for readability
    const raw = generatePassword(24, RECOVERY_ALPHABET);
    return raw.match(/.{1,4}/g).join("-");
}

function normalizeRecoveryCode(code) {
    return (code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function wrapKeyBytes(wrappingKey, keyBytes) {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, keyBytes);
    return bytesToBase64(iv) + ":" + bytesToBase64(new Uint8Array(ct));
}

async function unwrapKeyBytes(wrappingKey, packed) {
    const [ivB64, ctB64] = packed.split(":");
    const pt = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base64ToBytes(ivB64) },
        wrappingKey,
        base64ToBytes(ctB64)
    );
    return new Uint8Array(pt);
}

// Generate a fresh code and wrap the current vault key under it.
// Returns the formatted code (shown once).
async function enableRecovery() {
    const vaultKeyB64 = sessionStorage.getItem("vaultKey");
    if (!vaultKeyB64) throw new Error("Unlock the vault first.");

    const code        = generateRecoveryCode();
    const salt        = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const recoveryKey = await deriveKeyFromSalt(normalizeRecoveryCode(code), salt);
    const wrapped     = await wrapKeyBytes(recoveryKey, base64ToBytes(vaultKeyB64));

    localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify({
        salt:    bytesToBase64(salt),
        wrapped: wrapped
    }));
    return code;
}

// Unwrap the vault key with the supplied code and put it in the
// session. Throws on a wrong code (AES-GCM auth) or a mismatched vault.
async function recoverWithCode(code) {
    const raw = localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) throw new Error("No recovery code is set up on this device.");
    const cfg = JSON.parse(raw);

    const recoveryKey = await deriveKeyFromSalt(normalizeRecoveryCode(code), base64ToBytes(cfg.salt));

    let vaultKeyBytes;
    try {
        vaultKeyBytes = await unwrapKeyBytes(recoveryKey, cfg.wrapped);
    } catch {
        throw new Error("Incorrect recovery code.");
    }

    // Sanity-check the recovered key against the actual vault, if present
    const encryptedVault = localStorage.getItem("vault");
    if (encryptedVault) {
        const vaultKey = await crypto.subtle.importKey(
            "raw", vaultKeyBytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
        );
        try { await decryptData(encryptedVault, vaultKey); }
        catch { throw new Error("That code doesn't match this vault."); }
    }

    sessionStorage.setItem("vaultKey",      bytesToBase64(vaultKeyBytes));
    sessionStorage.setItem("authenticated", "true");
    sessionStorage.setItem("lastActive",    Date.now());
}

// After a successful recovery, set a brand-new master password.
// Re-encrypts the vault under the new key and invalidates the old
// recovery + biometric wraps (both wrapped the now-replaced key).
async function rekeyAfterRecovery(newPassword) {
    const vaultKeyB64 = sessionStorage.getItem("vaultKey");
    if (!vaultKeyB64) throw new Error("Not in a recovered session.");
    const oldKey = await crypto.subtle.importKey(
        "raw", base64ToBytes(vaultKeyB64), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
    );

    let vaultData = [];
    const enc = localStorage.getItem("vault");
    if (enc) {
        try { vaultData = await decryptData(enc, oldKey); }
        catch { throw new Error("Could not read the vault during re-key."); }
    }

    // Carry the encrypted sync token across, if any
    const rawCfg = JSON.parse(localStorage.getItem("syncConfig") || "{}");
    let plainToken = "";
    if (rawCfg.encryptedToken) {
        try { plainToken = await decryptData(rawCfg.encryptedToken, oldKey); }
        catch { plainToken = ""; }
    }

    const newSaltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
    const newKey       = await deriveKeyFromSalt(newPassword, newSaltBytes);
    const newVaultBlob = await encryptData(vaultData, newKey);
    const newTokenBlob = plainToken ? await encryptData(plainToken, newKey) : null;
    const newKeyRaw    = await crypto.subtle.exportKey("raw", newKey);

    localStorage.setItem("vaultSalt", bytesToBase64(newSaltBytes));
    localStorage.setItem("vault",     newVaultBlob);
    if (newTokenBlob) {
        localStorage.setItem("syncConfig", JSON.stringify({
            gistId: rawCfg.gistId || "", encryptedToken: newTokenBlob
        }));
    }
    sessionStorage.setItem("vaultKey",      bytesToBase64(new Uint8Array(newKeyRaw)));
    sessionStorage.setItem("authenticated", "true");

    // The old wraps reference the replaced key — clear them
    localStorage.removeItem(RECOVERY_STORAGE_KEY);
    localStorage.removeItem("biometric");
}

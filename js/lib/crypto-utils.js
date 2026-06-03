// ============================================================
// CRYPTO-UTILS.JS — SecureVault
// PBKDF2-HMAC-SHA-256 (600k iter) + AES-GCM, via WebCrypto.
// All exports are async — callers must await.
// ============================================================

const PBKDF2_ITERATIONS = 600000;
const KEY_BITS          = 256;
const SALT_BYTES        = 16;
const IV_BYTES          = 12; // 96-bit IV is the recommended size for GCM

// ============================================================
// ENCODING HELPERS
// ============================================================
function bytesToBase64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
}

function base64ToBytes(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
}

// ============================================================
// SALT
// 16 random bytes, base64-encoded, persisted per device/vault
// ============================================================
function getOrCreateSalt() {
    let salt = localStorage.getItem("vaultSalt");
    if (!salt) {
        const bytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
        salt = bytesToBase64(bytes);
        localStorage.setItem("vaultSalt", salt);
    }
    return base64ToBytes(salt);
}

// ============================================================
// KEY DERIVATION
// ============================================================
async function deriveKeyFromSalt(password, saltBytes) {
    const baseKey = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
        {
            name:       "PBKDF2",
            salt:       saltBytes,
            iterations: PBKDF2_ITERATIONS,
            hash:       "SHA-256"
        },
        baseKey,
        { name: "AES-GCM", length: KEY_BITS },
        true, // extractable — needed to persist the key across page navigations
        ["encrypt", "decrypt"]
    );
}

async function deriveKey(password) {
    return deriveKeyFromSalt(password, getOrCreateSalt());
}

async function loginAndStoreKey(password) {
    const key = await deriveKey(password);
    const raw = await crypto.subtle.exportKey("raw", key);
    sessionStorage.setItem("vaultKey", bytesToBase64(new Uint8Array(raw)));
    return key;
}

async function getStoredKey() {
    const keyStr = sessionStorage.getItem("vaultKey");
    if (!keyStr) return null;
    return crypto.subtle.importKey(
        "raw",
        base64ToBytes(keyStr),
        { name: "AES-GCM", length: KEY_BITS },
        false,
        ["encrypt", "decrypt"]
    );
}

// ============================================================
// ENCRYPT / DECRYPT
// Format: base64(iv12) + ":" + base64(ciphertext||authTag)
// ============================================================
async function encryptData(data, key) {
    const iv         = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const plaintext  = new TextEncoder().encode(JSON.stringify(data));
    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        plaintext
    );
    return bytesToBase64(iv) + ":" + bytesToBase64(new Uint8Array(ciphertext));
}

async function decryptData(encrypted, key) {
    const parts = encrypted.split(":");
    if (parts.length !== 2) throw new Error("The stored vault data looks corrupt. Restore from your most recent .svault backup.");
    const iv         = base64ToBytes(parts[0]);
    const ciphertext = base64ToBytes(parts[1]);
    try {
        const plaintext = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );
        return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
        throw new Error("Couldn't decrypt — either the password is wrong or the data is corrupt. Log out and back in, then try again.");
    }
}

// ============================================================
// SECURE PASSWORD GENERATOR
// Rejection sampling to avoid modulo bias from non-power-of-2 alphabets
// ============================================================
function generatePassword(length, chars) {
    if (length <= 0) return "";
    if (!chars.length) throw new Error("No character types selected. Turn on at least one of A–Z, 0–9, or symbols.");
    const max = Math.floor(0xFFFFFFFF / chars.length) * chars.length;
    const buf = new Uint32Array(1);
    let out   = "";
    while (out.length < length) {
        crypto.getRandomValues(buf);
        if (buf[0] < max) out += chars[buf[0] % chars.length];
    }
    return out;
}

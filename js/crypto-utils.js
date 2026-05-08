// ============================================================
// CRYPTO-UTILS.JS — SecureVault
// AES-256 encryption via CryptoJS + PBKDF2 key derivation
// ============================================================

const PBKDF2_ITERATIONS = 100000;
const KEY_SIZE          = 256 / 32;

// ============================================================
// SALT
// Created once per device/vault, stored in localStorage
// ============================================================
function getOrCreateSalt() {
    let salt = localStorage.getItem("vaultSalt");
    if (!salt) {
        salt = CryptoJS.lib.WordArray.random(16).toString();
        localStorage.setItem("vaultSalt", salt);
    }
    return salt;
}

// ============================================================
// KEY DERIVATION
// PBKDF2 with 100,000 iterations — slow enough to resist brute force
// ============================================================
function deriveKey(password) {
    const salt = getOrCreateSalt();
    return CryptoJS.PBKDF2(password, salt, {
        keySize:    KEY_SIZE,
        iterations: PBKDF2_ITERATIONS
    });
}

function loginAndStoreKey(password) {
    const key = deriveKey(password);
    sessionStorage.setItem("vaultKey", key.toString());
    return key;
}

function getStoredKey() {
    const keyStr = sessionStorage.getItem("vaultKey");
    if (!keyStr) return null;
    return CryptoJS.enc.Hex.parse(keyStr);
}

// ============================================================
// ENCRYPT
// Generates a random IV per encryption, prepends as hex: "ivHex:ciphertext"
// ============================================================
function encryptData(data, key) {
    const iv        = CryptoJS.lib.WordArray.random(16);
    const encrypted = CryptoJS.AES.encrypt(JSON.stringify(data), key, { iv });
    return iv.toString() + ":" + encrypted.toString();
}

// ============================================================
// DECRYPT
// Splits IV from ciphertext, decrypts, parses JSON
// ============================================================
function decryptData(encrypted, key) {
    const parts = encrypted.split(":");
    if (parts.length < 2) throw new Error("Invalid encrypted format");

    const iv         = CryptoJS.enc.Hex.parse(parts[0]);
    const ciphertext = parts.slice(1).join(":");
    const bytes      = CryptoJS.AES.decrypt(ciphertext, key, { iv });
    const text       = bytes.toString(CryptoJS.enc.Utf8);

    if (!text) throw new Error("Decryption failed — wrong key or corrupt data");
    return JSON.parse(text);
}

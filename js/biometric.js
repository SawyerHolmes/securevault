// ============================================================
// BIOMETRIC.JS — Touch ID / Face ID unlock via WebAuthn + the PRF
// extension. The PRF output deterministically derives an AES key
// that wraps the vault key. Without the authenticator, the wrapped
// key cannot be unwrapped.
//
// PRF support varies by platform (Chrome 132+, Safari 17+); the
// toggle exposes itself when isBiometricAvailable() resolves true.
// ============================================================

const BIO_STORAGE_KEY = "biometric";

async function isBiometricAvailable() {
    if (!window.PublicKeyCredential) return false;
    if (!window.isSecureContext) return false;
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
}

function biometricConfigured() {
    return !!localStorage.getItem(BIO_STORAGE_KEY);
}

function disableBiometric() {
    localStorage.removeItem(BIO_STORAGE_KEY);
}

async function enableBiometric() {
    const vaultKeyB64 = sessionStorage.getItem("vaultKey");
    if (!vaultKeyB64) throw new Error("Unlock the vault first.");

    const prfSalt   = crypto.getRandomValues(new Uint8Array(32));
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId    = crypto.getRandomValues(new Uint8Array(16));

    const cred = await navigator.credentials.create({
        publicKey: {
            rp: { name: "Securevault", id: window.location.hostname || "localhost" },
            user: {
                id: userId,
                name: "vault@local",
                displayName: "Vault user"
            },
            challenge,
            pubKeyCredParams: [
                { type: "public-key", alg: -7  }, // ES256
                { type: "public-key", alg: -257 } // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification:        "required",
                residentKey:             "preferred"
            },
            timeout: 60000,
            extensions: { prf: { eval: { first: prfSalt } } }
        }
    });

    const ext = cred.getClientExtensionResults();
    if (!ext || !ext.prf || !ext.prf.results || !ext.prf.results.first) {
        throw new Error("This device's authenticator doesn't support the PRF extension required for biometric unlock.");
    }

    const wrappingKey = await deriveWrappingKey(new Uint8Array(ext.prf.results.first));
    const wrapped     = await wrapVaultKey(wrappingKey, base64ToBytes(vaultKeyB64));

    localStorage.setItem(BIO_STORAGE_KEY, JSON.stringify({
        credentialId: bytesToBase64(new Uint8Array(cred.rawId)),
        prfSalt:      bytesToBase64(prfSalt),
        wrapped:      wrapped
    }));
}

async function unlockBiometric() {
    const raw = localStorage.getItem(BIO_STORAGE_KEY);
    if (!raw) throw new Error("Biometric unlock isn't set up on this device.");
    const cfg = JSON.parse(raw);

    const credentialId = base64ToBytes(cfg.credentialId);
    const prfSalt      = base64ToBytes(cfg.prfSalt);
    const challenge    = crypto.getRandomValues(new Uint8Array(32));

    const assertion = await navigator.credentials.get({
        publicKey: {
            challenge,
            allowCredentials: [{
                type:       "public-key",
                id:         credentialId,
                transports: ["internal"]
            }],
            userVerification: "required",
            timeout:          60000,
            extensions: { prf: { eval: { first: prfSalt } } }
        }
    });

    const ext = assertion.getClientExtensionResults();
    if (!ext || !ext.prf || !ext.prf.results || !ext.prf.results.first) {
        throw new Error("PRF result missing — re-enable biometric unlock.");
    }

    const wrappingKey = await deriveWrappingKey(new Uint8Array(ext.prf.results.first));
    const vaultKey    = await unwrapVaultKey(wrappingKey, cfg.wrapped);

    sessionStorage.setItem("vaultKey", bytesToBase64(vaultKey));
    sessionStorage.setItem("authenticated", "true");
    sessionStorage.setItem("lastActive", Date.now());
}

// ---- helpers ----
async function deriveWrappingKey(prfOutput) {
    return crypto.subtle.importKey(
        "raw",
        prfOutput.slice(0, 32),
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

async function wrapVaultKey(wrappingKey, vaultKeyBytes) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrappingKey, vaultKeyBytes);
    return bytesToBase64(iv) + ":" + bytesToBase64(new Uint8Array(ct));
}

async function unwrapVaultKey(wrappingKey, packed) {
    const [ivB64, ctB64] = packed.split(":");
    const iv = base64ToBytes(ivB64);
    const ct = base64ToBytes(ctB64);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, wrappingKey, ct);
    return new Uint8Array(pt);
}

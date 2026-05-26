// ============================================================
// TOTP.JS — RFC 6238 time-based one-time passwords.
// HMAC-SHA-1, 30-second window, 6 digits — matches Google
// Authenticator / Authy defaults. The base32 secret is what
// providers display under their "Can't scan?" link.
// ============================================================

function base32Decode(input) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const cleaned  = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
    const bytes    = [];
    let buffer = 0;
    let bits   = 0;
    for (const ch of cleaned) {
        const v = alphabet.indexOf(ch);
        if (v === -1) continue;
        buffer = (buffer << 5) | v;
        bits  += 5;
        if (bits >= 8) {
            bits -= 8;
            bytes.push((buffer >> bits) & 0xff);
        }
    }
    return new Uint8Array(bytes);
}

async function generateTOTP(base32Secret, opts) {
    opts = opts || {};
    const digits = opts.digits || 6;
    const period = opts.period || 30;
    const time   = Math.floor((opts.time || Date.now()) / 1000);
    const counter = Math.floor(time / period);

    const keyBytes = base32Decode(base32Secret);
    if (!keyBytes.length) throw new Error("Invalid TOTP secret");

    const counterBuf = new ArrayBuffer(8);
    new DataView(counterBuf).setBigUint64(0, BigInt(counter), false);

    const cryptoKey = await crypto.subtle.importKey(
        "raw", keyBytes,
        { name: "HMAC", hash: "SHA-1" },
        false, ["sign"]
    );
    const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, counterBuf));

    const offset = hmac[hmac.length - 1] & 0x0f;
    const bin = ((hmac[offset]     & 0x7f) << 24) |
                ((hmac[offset + 1] & 0xff) << 16) |
                ((hmac[offset + 2] & 0xff) <<  8) |
                ( hmac[offset + 3] & 0xff);

    const code = String(bin % Math.pow(10, digits)).padStart(digits, "0");
    const secondsRemaining = period - (time % period);
    return { code, secondsRemaining, period };
}

// Format "123456" as "123 456" for legibility
function formatTOTP(code) {
    if (code.length === 6) return code.slice(0, 3) + " " + code.slice(3);
    if (code.length === 8) return code.slice(0, 4) + " " + code.slice(4);
    return code;
}

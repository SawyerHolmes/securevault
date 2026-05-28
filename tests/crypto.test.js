// ============================================================
// CRYPTO.TEST.JS — open tests/crypto.test.html to run.
// Verifies the security-critical primitives still behave:
// AES-GCM round-trip, PBKDF2 determinism, wrong-key failure,
// base32 decode, TOTP against the RFC 6238 vectors, and the
// password generator. No build tooling — just open the page.
// ============================================================

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function assert(cond, msg) {
    if (!cond) throw new Error(msg || "assertion failed");
}
function assertEqual(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label ? label + ": " : ""}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

// ---- AES-GCM + PBKDF2 ----
test("encrypt → decrypt round-trip preserves the object", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await deriveKeyFromSalt("hunter2", salt);
    const data = { a: 1, b: "héllo ✓", c: [1, 2, 3], nested: { x: true } };
    const enc  = await encryptData(data, key);
    const dec  = await decryptData(enc, key);
    assertEqual(JSON.stringify(dec), JSON.stringify(data));
});

test("ciphertext is not the plaintext", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await deriveKeyFromSalt("pw", salt);
    const enc  = await encryptData({ secret: "swordfish" }, key);
    assert(!enc.includes("swordfish"), "plaintext leaked into ciphertext");
    assert(enc.includes(":"), "expected iv:ciphertext format");
});

test("decrypting with the wrong key throws", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyA = await deriveKeyFromSalt("password-a", salt);
    const keyB = await deriveKeyFromSalt("password-b", salt);
    const enc  = await encryptData({ secret: 42 }, keyA);
    let threw = false;
    try { await decryptData(enc, keyB); } catch { threw = true; }
    assert(threw, "decryption with the wrong key should have thrown");
});

test("PBKDF2 is deterministic for the same password + salt", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const k1 = await deriveKeyFromSalt("same-password", salt);
    const k2 = await deriveKeyFromSalt("same-password", salt);
    const r1 = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", k1)));
    const r2 = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", k2)));
    assertEqual(r1, r2);
});

test("different salt → different derived key", async () => {
    const k1 = await deriveKeyFromSalt("same", crypto.getRandomValues(new Uint8Array(16)));
    const k2 = await deriveKeyFromSalt("same", crypto.getRandomValues(new Uint8Array(16)));
    const r1 = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", k1)));
    const r2 = bytesToBase64(new Uint8Array(await crypto.subtle.exportKey("raw", k2)));
    assert(r1 !== r2, "keys derived from different salts should differ");
});

test("a tampered ciphertext is rejected (GCM auth tag)", async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key  = await deriveKeyFromSalt("pw", salt);
    const enc  = await encryptData({ x: "data" }, key);
    // Flip a character in the ciphertext portion
    const [iv, ct] = enc.split(":");
    const flipped  = ct[0] === "A" ? "B" : "A";
    const tampered = iv + ":" + flipped + ct.slice(1);
    let threw = false;
    try { await decryptData(tampered, key); } catch { threw = true; }
    assert(threw, "tampered ciphertext should fail authentication");
});

// ---- base32 + TOTP ----
test("base32 decode matches a known vector", () => {
    const bytes = base32Decode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    const ascii = String.fromCharCode.apply(null, bytes);
    assertEqual(ascii, "12345678901234567890");
});

test("TOTP matches the RFC 6238 SHA-1 vectors (8 digits)", async () => {
    const secret  = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // ASCII "12345678901234567890"
    const vectors = [
        [59,         "94287082"],
        [1111111109, "07081804"],
        [1111111111, "14050471"],
        [1234567890, "89005924"],
        [2000000000, "69279037"]
    ];
    for (const [t, expected] of vectors) {
        const { code } = await generateTOTP(secret, { time: t * 1000, digits: 8 });
        assertEqual(code, expected, `T=${t}`);
    }
});

test("TOTP 6-digit code is the last 6 of the 8-digit code", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const { code } = await generateTOTP(secret, { time: 59 * 1000 });
    assertEqual(code, "287082");
});

test("formatTOTP groups 6 digits as 3 + 3", () => {
    assertEqual(formatTOTP("287082"), "287 082");
});

// ---- password generator ----
test("generatePassword respects length and charset", () => {
    const pw = generatePassword(24, "abc");
    assertEqual(pw.length, 24);
    assert(/^[abc]+$/.test(pw), "generated password used characters outside the set");
});

test("generatePassword is (almost certainly) not constant", () => {
    const a = generatePassword(32, "abcdefghijklmnopqrstuvwxyz0123456789");
    const b = generatePassword(32, "abcdefghijklmnopqrstuvwxyz0123456789");
    assert(a !== b, "two generated passwords were identical — RNG suspicious");
});

// ============================================================
// RUNNER
// ============================================================
(async () => {
    const results = document.getElementById("results");
    const summary = document.getElementById("summary");
    let passed = 0;

    for (const t of tests) {
        const row = document.createElement("div");
        row.className = "test-row";
        let ok = true, detail = "";
        try {
            await t.fn();
        } catch (e) {
            ok = false;
            detail = e.message;
        }
        if (ok) passed++;
        row.classList.add(ok ? "test-pass" : "test-fail");
        row.innerHTML =
            '<span class="test-status">' + (ok ? "PASS" : "FAIL") + '</span>' +
            '<span class="test-name"></span>' +
            (detail ? '<span class="test-detail"></span>' : "");
        row.querySelector(".test-name").textContent = t.name;
        if (detail) row.querySelector(".test-detail").textContent = detail;
        results.appendChild(row);
    }

    const allPass = passed === tests.length;
    summary.textContent = `${passed} / ${tests.length} passing`;
    summary.style.color = allPass ? "var(--accent)" : "var(--danger)";
})();

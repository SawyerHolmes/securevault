// ============================================================
// HEALTH.JS — password health checks.
// Strength scoring, reuse detection, and breach lookup against
// the Have I Been Pwned k-anonymity API (SHA-1 prefix, only the
// first 5 hex chars leave the device).
// ============================================================

const breachCache = new Map(); // password → count (-1 = lookup failed)

async function sha1Hex(text) {
    const buf  = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-1", buf);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
}

async function checkBreach(password) {
    if (!password) return 0;
    if (breachCache.has(password)) return breachCache.get(password);

    const hash   = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    try {
        const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
            headers: { "Add-Padding": "true" }
        });
        if (!res.ok) {
            breachCache.set(password, -1);
            return -1;
        }
        const text = await res.text();
        let count = 0;
        for (const line of text.split("\n")) {
            const [hashSuffix, hits] = line.trim().split(":");
            if (hashSuffix === suffix) {
                count = parseInt(hits, 10) || 0;
                break;
            }
        }
        breachCache.set(password, count);
        return count;
    } catch {
        breachCache.set(password, -1);
        return -1;
    }
}

function passwordStrength(password) {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8)         score++;
    if (password.length >= 12)        score++;
    if (password.length >= 16)        score++;
    if (/[A-Z]/.test(password))       score++;
    if (/[0-9]/.test(password))       score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score <= 1 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;
}

async function scanVault(entries, onProgress) {
    const report = {
        total: entries.length,
        weak: 0, fair: 0, good: 0, strong: 0,
        reused: 0, breached: 0, unknown: 0,
        problems: []
    };

    // Group by password to dedupe breach lookups
    const groups = new Map();
    for (const entry of entries) {
        const pwd = entry.password || "";
        if (!groups.has(pwd)) groups.set(pwd, []);
        groups.get(pwd).push(entry);
    }

    // Strength counts (per entry, not per unique password)
    for (const entry of entries) {
        const lvl = passwordStrength(entry.password || "");
        if (lvl === 1) report.weak++;
        else if (lvl === 2) report.fair++;
        else if (lvl === 3) report.good++;
        else if (lvl === 4) report.strong++;
    }

    // Reuse counting — any password held by 2+ entries
    const reusedPasswords = new Set();
    for (const [pwd, group] of groups) {
        if (pwd && group.length > 1) {
            reusedPasswords.add(pwd);
            report.reused += group.length;
        }
    }

    // Breach lookup per unique password
    let done = 0;
    for (const [pwd, group] of groups) {
        if (!pwd) { done++; continue; }
        const breachCount = await checkBreach(pwd);
        const isBreached  = breachCount > 0;
        const isUnknown   = breachCount === -1;
        const isReused    = reusedPasswords.has(pwd);
        const isWeak      = passwordStrength(pwd) <= 2;

        if (isBreached) report.breached += group.length;
        if (isUnknown)  report.unknown  += group.length;

        if (isBreached || isReused || isWeak) {
            for (const entry of group) {
                const issues = [];
                if (isBreached) issues.push("breached");
                if (isReused)   issues.push("reused");
                if (isWeak)     issues.push("weak");
                report.problems.push({ entry, issues, breachCount });
            }
        }
        done++;
        if (onProgress) onProgress(done, groups.size);
    }

    return report;
}

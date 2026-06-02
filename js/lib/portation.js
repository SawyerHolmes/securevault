// ============================================================
// PORTATION.JS — import / export helpers (shared).
// CSV parsing + building, a download helper, and header-aware
// mapping so CSVs exported by Chrome, Bitwarden, 1Password,
// LastPass, Firefox, Safari, etc. all import sensibly.
// ============================================================

function downloadFile(name, content, type) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

// RFC-4180-style parser: quoted commas, embedded newlines, "" escapes.
function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false, i = 0;
    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                inQuotes = false; i++; continue;
            }
            field += c; i++; continue;
        }
        if (c === '"')                        { inQuotes = true; i++; continue; }
        if (c === ",")                        { row.push(field); field = ""; i++; continue; }
        if (c === "\r" && text[i + 1] === "\n") { row.push(field); rows.push(row); row = []; field = ""; i += 2; continue; }
        if (c === "\n" || c === "\r")         { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
        field += c; i++;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""));
}

function csvEscape(value) {
    return '"' + String(value == null ? "" : value).replace(/"/g, '""') + '"';
}

// Build our own export CSV from entry objects.
function entriesToCsv(entries) {
    const header = ["Name", "URL", "Username", "Password", "Notes", "Tags", "Type", "TOTP"];
    const rows = [header];
    entries.forEach(e => rows.push([
        e.name       || "",
        e.url        || "",
        e.username   || "",
        e.password   || "",
        e.notes      || "",
        (e.tags || []).join("; "),
        e.type       || "login",
        e.totp       || ""
    ]));
    return rows.map(r => r.map(csvEscape).join(",")).join("\n");
}

// Map a header row to our fields by recognising common column names.
function csvHeaderMap(headers) {
    const norm = headers.map(h => h.trim().toLowerCase());
    const find = (...names) => {
        for (const n of names) {
            const idx = norm.indexOf(n);
            if (idx !== -1) return idx;
        }
        return -1;
    };
    return {
        name:     find("name", "title", "account", "item name", "entry name"),
        url:      find("url", "urls", "login_uri", "website", "web site", "login uri", "site"),
        username: find("username", "login_username", "user", "user name", "login username", "email", "e-mail"),
        password: find("password", "login_password", "pass", "login password"),
        notes:    find("notes", "note", "extra", "comments", "memo", "comment"),
        totp:     find("totp", "login_totp", "otpauth", "otp", "one-time password", "2fa", "otpauth url"),
        tags:     find("tags", "tag", "grouping", "folder", "category", "collection"),
        type:     find("type", "kind")
    };
}

// Pull a base32 secret out of an otpauth:// URI, or accept a bare one.
function extractTotpSecret(value) {
    if (!value) return "";
    const v = value.trim();
    const m = /[?&]secret=([^&\s]+)/i.exec(v);
    if (m) return m[1].replace(/\s/g, "").toUpperCase();
    if (/^[A-Z2-7][A-Z2-7\s=]*$/i.test(v) && v.replace(/[\s=]/g, "").length >= 8) {
        return v.replace(/\s/g, "").toUpperCase();
    }
    return "";
}

function portationNewId() {
    return (crypto.randomUUID && crypto.randomUUID()) ||
           ("e_" + Date.now() + "_" + Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(16).padStart(2, "0")).join(""));
}

// Turn parsed CSV rows into entry objects. Header-aware; falls back
// to positional (Name, URL, Username, Password, Notes) if no
// recognisable headers are present.
function csvRowsToEntries(rows) {
    if (!rows.length) return [];
    const map = csvHeaderMap(rows[0]);
    const recognised = map.name >= 0 || map.username >= 0 || map.password >= 0;

    const entries = [];
    const dataRows = rows.slice(1);

    dataRows.forEach(cols => {
        const get = i => (i >= 0 && i < cols.length) ? (cols[i] || "").trim() : "";

        let name, url, username, password, notes, totp, tagsRaw, typeRaw;
        if (recognised) {
            name     = get(map.name);
            url      = get(map.url);
            username = get(map.username);
            password = get(map.password);
            notes    = get(map.notes);
            totp     = extractTotpSecret(get(map.totp));
            tagsRaw  = get(map.tags);
            typeRaw  = get(map.type).toLowerCase();
        } else {
            // positional fallback: Name, URL, Username, Password, Notes
            name = get(0); url = get(1); username = get(2); password = get(3); notes = get(4);
            totp = ""; tagsRaw = ""; typeRaw = "";
        }

        if (!name && !username && !password && !notes) return; // skip blank
        if (!name) name = url || username || "Untitled";

        let type = "login";
        if (/note/.test(typeRaw))            type = "note";
        else if (/card|credit/.test(typeRaw)) type = "card";

        const entry = { id: portationNewId(), type, name, notes, createdAt: Date.now() };
        if (type === "login") {
            entry.url = url; entry.username = username; entry.password = password;
            if (totp) entry.totp = totp;
        } else if (type === "note") {
            entry.content = notes;
            delete entry.notes;
        }
        if (tagsRaw) {
            const tags = tagsRaw.split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean);
            if (tags.length) entry.tags = tags;
        }
        entries.push(entry);
    });

    return entries;
}

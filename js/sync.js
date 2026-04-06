// =========================
// GITHUB GIST SYNC
// =========================

const GIST_FILENAME = "vault.json";

function getSyncConfig() {
    const cfg = JSON.parse(localStorage.getItem("syncConfig")) || {};
    return { token: cfg.token || "", gistId: cfg.gistId || "" };
}

function syncConfigured() {
    const { token, gistId } = getSyncConfig();
    return token.length > 0 && gistId.length > 0;
}

// Push local vault to Gist
async function pushToGist() {
    if (!syncConfigured()) return { ok: false, error: "Sync not configured" };
    const { token, gistId } = getSyncConfig();

    const vaultData = localStorage.getItem("vault") || "";
    const salt      = localStorage.getItem("vaultSalt") || "";

    const payload = JSON.stringify({ vault: vaultData, salt: salt });

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                files: { [GIST_FILENAME]: { content: payload } }
            })
        });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// Pull vault from Gist and merge into localStorage
async function pullFromGist() {
    if (!syncConfigured()) return { ok: false, error: "Sync not configured" };
    const { token, gistId } = getSyncConfig();

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

        const data = await res.json();
        const fileContent = data.files?.[GIST_FILENAME]?.content;
        if (!fileContent) throw new Error("vault.json not found in Gist");

        const { vault, salt } = JSON.parse(fileContent);

        // Only update salt if we don't have one yet (first pull on new device)
        if (salt && !localStorage.getItem("vaultSalt")) {
            localStorage.setItem("vaultSalt", salt);
        }

        if (vault) {
            localStorage.setItem("vault", vault);
        }

        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}
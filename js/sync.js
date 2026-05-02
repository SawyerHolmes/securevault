// ============================================================
// SYNC.JS — GitHub Gist sync
// ============================================================

const GIST_FILENAME = "vault.json";

// ============================================================
// CONFIG
// ============================================================
function getSyncConfig() {
    const cfg = JSON.parse(localStorage.getItem("syncConfig")) || {};
    return { token: cfg.token || "", gistId: cfg.gistId || "" };
}

function syncConfigured() {
    const { token, gistId } = getSyncConfig();
    return token.length > 0 && gistId.length > 0;
}

// ============================================================
// PUSH — local vault → Gist
// ============================================================
async function pushToGist() {
    if (!syncConfigured()) return { ok: false, error: "Sync not configured" };

    const { token, gistId } = getSyncConfig();
    const vaultData = localStorage.getItem("vault") || "";
    const salt      = localStorage.getItem("vaultSalt") || "";
    const payload   = JSON.stringify({ vault: vaultData, salt, updatedAt: Date.now() });

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: "PATCH",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type":  "application/json"
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

// ============================================================
// PULL — Gist → local vault (merge strategy)
// Remote wins on conflict. If salts differ, remote takes over
// and the user must re-authenticate.
// ============================================================
async function pullFromGist() {
    if (!syncConfigured()) return { ok: false, error: "Sync not configured" };

    const { token, gistId } = getSyncConfig();

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

        const data        = await res.json();
        const fileContent = data.files?.[GIST_FILENAME]?.content;
        if (!fileContent) throw new Error("vault.json not found in Gist");

        const { vault: remoteEncrypted, salt: remoteSalt } = JSON.parse(fileContent);

        const localSalt  = localStorage.getItem("vaultSalt");
        const localVault = localStorage.getItem("vault");

        // No local salt — first pull on a new device, adopt remote salt
        if (!localSalt && remoteSalt) {
            localStorage.setItem("vaultSalt", remoteSalt);
        }

        // Salts differ — can't merge, take remote and force re-login
        if (localSalt && remoteSalt && localSalt !== remoteSalt) {
            localStorage.setItem("vaultSalt", remoteSalt);
            localStorage.setItem("vault", remoteEncrypted);
            sessionStorage.removeItem("vaultKey");
            return { ok: true, reauth: true };
        }

        // Same salt — decrypt both sides and merge
        const key = getStoredKey();
        if (!key) return { ok: false, error: "Not logged in" };

        let remoteEntries = [];
        let localEntries  = [];

        if (remoteEncrypted) {
            try   { remoteEntries = decryptData(remoteEncrypted, key); }
            catch { remoteEntries = []; }
        }

        if (localVault) {
            try   { localEntries = decryptData(localVault, key); }
            catch { localEntries = []; }
        }

        // Start with remote, add local entries not present in remote
        const merged = [...remoteEntries];
        for (const local of localEntries) {
            const exists = remoteEntries.some(r =>
                r.name === local.name && r.username === local.username
            );
            if (!exists) merged.push(local);
        }

        localStorage.setItem("vault", encryptData(merged, key));
        return { ok: true, reauth: false };

    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// ============================================================
// SYNC.JS — GitHub Gist sync
// The PAT is encrypted with the vault key before being persisted.
// ============================================================

const GIST_FILENAME = "vault.json";

// Translate a GitHub Gist API HTTP status into a plain-English message
// that also tells the user where to fix it.
function gistHttpError(status) {
    if (status === 401) return "Your GitHub token isn't accepted. Open Settings → Sync and paste a fresh one.";
    if (status === 403) return "GitHub rejected the request (rate limited or token missing the gist scope). Check Settings → Sync.";
    if (status === 404) return "Couldn't find that Gist. Double-check the Gist ID in Settings → Sync.";
    if (status === 422) return "GitHub couldn't update the Gist (bad payload). Try Push again from Settings → Sync.";
    if (status >= 500)  return "GitHub is having trouble right now. Try again in a minute.";
    return `GitHub returned HTTP ${status}. Check your token and Gist ID in Settings → Sync.`;
}

// ============================================================
// CONFIG
// Stored shape: { gistId, encryptedToken? }
// In-memory shape returned to callers: { token, gistId }
// ============================================================
function readRawSyncConfig() {
    return JSON.parse(localStorage.getItem("syncConfig") || "{}");
}

async function getSyncConfig() {
    const cfg = readRawSyncConfig();
    let token = "";
    if (cfg.encryptedToken) {
        const key = await getStoredKey();
        if (key) {
            try   { token = await decryptData(cfg.encryptedToken, key); }
            catch { token = ""; }
        }
    }
    return { token, gistId: cfg.gistId || "" };
}

async function writeSyncConfig(token, gistId) {
    const out = { gistId };
    if (token) {
        const key = await getStoredKey();
        if (!key) throw new Error("Your session expired. Log in again before changing sync settings.");
        out.encryptedToken = await encryptData(token, key);
    }
    localStorage.setItem("syncConfig", JSON.stringify(out));
}

async function syncConfigured() {
    const { token, gistId } = await getSyncConfig();
    return token.length > 0 && gistId.length > 0;
}

// ============================================================
// PUSH — local vault → Gist
// ============================================================
async function pushToGist() {
    const { token, gistId } = await getSyncConfig();
    if (!token || !gistId) return { ok: false, error: "Sync isn't configured yet. Add a GitHub token and Gist ID in Settings → Sync." };

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
        if (!res.ok) throw new Error(gistHttpError(res.status));
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
    const { token, gistId } = await getSyncConfig();
    if (!token || !gistId) return { ok: false, error: "Sync isn't configured yet. Add a GitHub token and Gist ID in Settings → Sync." };

    try {
        const res = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(gistHttpError(res.status));

        const data        = await res.json();
        const fileContent = data.files?.[GIST_FILENAME]?.content;
        if (!fileContent) throw new Error("That Gist doesn't contain a vault.json yet. Run Push from Settings → Sync to create it.");

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
        const key = await getStoredKey();
        if (!key) return { ok: false, error: "Your session expired. Log in again to pull from Gist." };

        let remoteEntries = [];
        let localEntries  = [];

        if (remoteEncrypted) {
            try   { remoteEntries = await decryptData(remoteEncrypted, key); }
            catch { remoteEntries = []; }
        }

        if (localVault) {
            try   { localEntries = await decryptData(localVault, key); }
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

        localStorage.setItem("vault", await encryptData(merged, key));
        return { ok: true, reauth: false };

    } catch (e) {
        return { ok: false, error: e.message };
    }
}

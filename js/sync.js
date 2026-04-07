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
    const payload   = JSON.stringify({ vault: vaultData, salt, updatedAt: Date.now() });

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

// Pull from Gist and MERGE with local vault
// Merge strategy: combine both, deduplicate by name+username, remote wins on conflict
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

        const { vault: remoteEncrypted, salt: remoteSalt } = JSON.parse(fileContent);

        // On a new device with no local salt, adopt the remote salt first
        // so we can decrypt the remote vault with the same master password
        const localSalt   = localStorage.getItem("vaultSalt");
        const localVault  = localStorage.getItem("vault");

        if (!localSalt && remoteSalt) {
            localStorage.setItem("vaultSalt", remoteSalt);
        }

        // If salts differ we can't merge — just take remote and re-derive key
        if (localSalt && remoteSalt && localSalt !== remoteSalt) {
            // Salts differ means different devices set up independently.
            // We can only take remote — user will need to re-login after pull.
            localStorage.setItem("vaultSalt", remoteSalt);
            localStorage.setItem("vault", remoteEncrypted);
            sessionStorage.removeItem("vaultKey");
            return { ok: true, reauth: true };
        }

        // Same salt — decrypt both and merge
        const key = getStoredKey();
        if (!key) return { ok: false, error: "Not logged in" };

        let remoteEntries = [];
        let localEntries  = [];

        if (remoteEncrypted) {
            try { remoteEntries = decryptData(remoteEncrypted, key); } catch { remoteEntries = []; }
        }
        if (localVault) {
            try { localEntries = decryptData(localVault, key); } catch { localEntries = []; }
        }

        // Merge: start with remote, add any local entries not already in remote
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
}        });
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

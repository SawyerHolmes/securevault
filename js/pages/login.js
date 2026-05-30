// ============================================================
// LOGIN.JS — SecureVault
// ============================================================

const MAX_ATTEMPTS    = 5;
const BASE_LOCKOUT_MS  = 30 * 1000;    // first lockout: 30s
const MAX_LOCKOUT_MS   = 60 * 60 * 1000; // cap: 1 hour

// ============================================================
// DARK MODE
// Applied immediately from saved settings
// ============================================================
(function applyAppearance() {
    const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {};
    let appearance = settings.appearance || (settings.lightMode ? "light" : "dark");
    if (appearance === "system") {
        appearance = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    document.body.classList.toggle("dark", appearance !== "light");
})();

// ============================================================
// REDIRECT IF ALREADY LOGGED IN
// ============================================================
if (sessionStorage.getItem("authenticated") === "true" && sessionStorage.getItem("vaultKey")) {
    window.location.replace("vault.html");
}

// ============================================================
// ELEMENTS
// ============================================================
const loginBtn          = document.getElementById("login-btn");
const passwordInput     = document.getElementById("master-password");
const confirmInput      = document.getElementById("confirm-master-password");
const confirmField      = document.getElementById("confirm-password-field");
const loginError        = document.getElementById("login-error");
const toggleBtn         = document.getElementById("toggle-password");

// ============================================================
// FIRST-TIME SETUP DETECTION
// If there's no existing vault, force a confirm-password step
// ============================================================
const isFirstTime = !localStorage.getItem("vault");
if (isFirstTime) {
    confirmField.style.display = "";
    loginBtn.textContent       = "Create vault";
    passwordInput.autocomplete = "new-password";
}

// ============================================================
// STRENGTH METER — same heuristic and visual as the add-entry
// page. Shown on setup (master password) and on recovery rekey.
// Plain login mode keeps the meter hidden because the user isn't
// choosing a password — just typing the existing one.
// ============================================================
function updateStrengthMeter(pw, bar, label) {
    if (!pw) {
        bar.style.width      = "0%";
        bar.style.background = "transparent";
        label.textContent    = "";
        return;
    }
    let score = 0;
    if (pw.length >= 8)           score++;
    if (pw.length >= 12)          score++;
    if (pw.length >= 16)          score++;
    if (/[A-Z]/.test(pw))         score++;
    if (/[0-9]/.test(pw))         score++;
    if (/[^A-Za-z0-9]/.test(pw))  score++;

    const levels = [
        { label: "",       color: "transparent", width: "0%"   },
        { label: "Weak",   color: "#FF3838",     width: "25%"  },
        { label: "Fair",   color: "#E67E22",     width: "50%"  },
        { label: "Good",   color: "#F1C40F",     width: "75%"  },
        { label: "Strong", color: "#C7F100",     width: "100%" },
    ];
    const level = score <= 1 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;
    bar.style.width      = levels[level].width;
    bar.style.background = levels[level].color;
    label.textContent    = levels[level].label;
    label.style.color    = levels[level].color;
}

if (isFirstTime) {
    const masterWrap  = document.getElementById("master-strength-wrap");
    const masterBar   = document.getElementById("master-strength-bar");
    const masterLabel = document.getElementById("master-strength-label");
    if (masterWrap && masterBar && masterLabel) {
        masterWrap.style.display = "";
        passwordInput.addEventListener("input", () =>
            updateStrengthMeter(passwordInput.value, masterBar, masterLabel));
    }
}

(function wireRecoveryMeter() {
    const recPw    = document.getElementById("recovery-new-password");
    const recBar   = document.getElementById("recovery-strength-bar");
    const recLabel = document.getElementById("recovery-strength-label");
    if (recPw && recBar && recLabel) {
        recPw.addEventListener("input", () =>
            updateStrengthMeter(recPw.value, recBar, recLabel));
    }
})();

// ============================================================
// BIOMETRIC UNLOCK
// Shown only when a credential has been registered on this device
// ============================================================
const bioBtn = document.getElementById("biometric-btn");
if (bioBtn && typeof biometricConfigured === "function" && biometricConfigured()) {
    bioBtn.style.display = "inline-flex";
    bioBtn.addEventListener("click", async () => {
        const remaining = isLockedOut();
        if (remaining) return;
        bioBtn.disabled = true;
        bioBtn.textContent = "Authenticating…";
        try {
            await unlockBiometric();
            resetAttempts();
            window.location.replace("vault.html");
        } catch (e) {
            bioBtn.disabled = false;
            bioBtn.innerHTML = '<i data-lucide="lock"></i> Use biometric';
            if (window.renderIcons) window.renderIcons();
            showError(e.message || "Biometric unlock failed.");
        }
    });
}

// ============================================================
// RECOVERY CODE
// "Use a recovery code" swaps the login form for the recovery panel:
// enter the code, set a new master password, re-key the vault.
// Only offered when a recovery code is configured on this device.
// ============================================================
const loginPanel    = document.getElementById("login-panel");
const recoveryPanel  = document.getElementById("recovery-panel");
const recoveryLink   = document.getElementById("recovery-link");
const recoveryBack   = document.getElementById("recovery-back");
const recoverBtn     = document.getElementById("recover-btn");
const recoveryError  = document.getElementById("recovery-error");
const recoveryCodeIn = document.getElementById("recovery-code-input");
const recoveryNewPw  = document.getElementById("recovery-new-password");
const recoveryConfPw = document.getElementById("recovery-confirm-password");

if (recoveryLink && typeof recoveryConfigured === "function" && recoveryConfigured() && !isFirstTime) {
    recoveryLink.style.display = "";
}

function showRecoveryError(msg) {
    recoveryError.textContent = msg;
    recoveryError.style.display = "block";
}

if (recoveryLink) {
    recoveryLink.addEventListener("click", () => {
        loginPanel.style.display = "none";
        recoveryPanel.style.display = "";
        recoveryCodeIn.focus();
    });
}
if (recoveryBack) {
    recoveryBack.addEventListener("click", () => {
        recoveryPanel.style.display = "none";
        loginPanel.style.display = "";
        recoveryError.textContent = "";
    });
}
if (recoverBtn) {
    recoverBtn.addEventListener("click", async () => {
        recoveryError.textContent = "";
        const code = recoveryCodeIn.value.trim();
        const pw   = recoveryNewPw.value;
        const conf = recoveryConfPw.value;
        if (!code)            { showRecoveryError("Enter your recovery code"); return; }
        if (!pw)              { showRecoveryError("Set a new master password"); return; }
        if (pw.length < 8)    { showRecoveryError("Use at least 8 characters"); return; }
        if (pw !== conf)      { showRecoveryError("Passwords don't match"); return; }

        recoverBtn.disabled = true;
        recoverBtn.textContent = "Recovering…";
        try {
            await recoverWithCode(code);
            await rekeyAfterRecovery(pw);
            sessionStorage.setItem("lastActive", Date.now());
            resetAttempts();
            window.location.replace("vault.html");
        } catch (e) {
            recoverBtn.disabled = false;
            recoverBtn.textContent = "Recover & set password";
            showRecoveryError(e.message || "Recovery failed.");
        }
    });
}

// ============================================================
// LOCKOUT HELPERS
// During a brute-force run, each 5-attempt cycle escalates the
// lockout window: 30s, 1m, 2m, 4m, 8m, 16m, 32m, then capped at 1h.
// A successful login clears the level so legitimate users start fresh.
// ============================================================
function getLockoutState() {
    const attempts     = parseInt(localStorage.getItem("loginAttempts") || "0", 10);
    const lockedAt     = parseInt(localStorage.getItem("lockedAt")      || "0", 10);
    const lockoutLevel = parseInt(localStorage.getItem("lockoutLevel")  || "0", 10);
    return { attempts, lockedAt, lockoutLevel };
}

function currentLockoutMs(level) {
    return Math.min(BASE_LOCKOUT_MS * Math.pow(2, level), MAX_LOCKOUT_MS);
}

function isLockedOut() {
    const { attempts, lockedAt, lockoutLevel } = getLockoutState();
    if (attempts >= MAX_ATTEMPTS) {
        const window    = currentLockoutMs(lockoutLevel);
        const remaining = window - (Date.now() - lockedAt);
        if (remaining > 0) return Math.ceil(remaining / 1000);
        localStorage.removeItem("loginAttempts");
        localStorage.removeItem("lockedAt");
    }
    return false;
}

function recordFailedAttempt() {
    const { attempts, lockoutLevel } = getLockoutState();
    const newAttempts = attempts + 1;
    localStorage.setItem("loginAttempts", newAttempts);
    if (newAttempts >= MAX_ATTEMPTS) {
        localStorage.setItem("lockedAt",     Date.now());
        localStorage.setItem("lockoutLevel", lockoutLevel + 1);
    }
}

// Only the per-lockout attempt counter resets on successful login.
// lockoutLevel sticks around so a long brute-force run keeps escalating.
function resetAttempts() {
    localStorage.removeItem("loginAttempts");
    localStorage.removeItem("lockedAt");
    localStorage.removeItem("lockoutLevel");
}

// ============================================================
// LOCKOUT TIMER
// ============================================================
function startLockoutTimer() {
    const interval = setInterval(() => {
        const remaining = isLockedOut();
        if (!remaining) {
            clearInterval(interval);
            loginBtn.disabled         = false;
            loginError.style.display  = "none";
            loginError.textContent    = "";
        } else {
            loginError.textContent = `Too many attempts. Try again in ${remaining}s`;
        }
    }, 1000);
}

// Check on page load
(function checkLockoutOnLoad() {
    const remaining = isLockedOut();
    if (remaining) {
        loginBtn.disabled        = true;
        loginError.style.display = "block";
        loginError.textContent   = `Too many attempts. Try again in ${remaining}s`;
        startLockoutTimer();
    }
})();

// ============================================================
// SHOW ERROR
// ============================================================
function showError(msg) {
    loginError.textContent   = msg;
    loginError.style.display = "block";
}

function clearError() {
    loginError.textContent   = "";
    loginError.style.display = "none";
}

// ============================================================
// AUTO-SYNC — pull from Gist on login if configured
// ============================================================
async function autoSyncOnLogin(key) {
    try {
        const cfg = JSON.parse(localStorage.getItem("syncConfig")) || {};
        if (!cfg.gistId) return;

        // PAT is stored encrypted with the vault key — decrypt before use
        let token = "";
        if (cfg.encryptedToken) {
            try   { token = await decryptData(cfg.encryptedToken, key); }
            catch { return; }
        }
        if (!token) return;

        const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data        = await res.json();
        const fileContent = data.files?.["vault.json"]?.content;
        if (!fileContent) return;

        const { vault: remoteEncrypted, salt: remoteSalt } = JSON.parse(fileContent);
        const localSalt  = localStorage.getItem("vaultSalt");
        const localVault = localStorage.getItem("vault");

        // Different salts — can't merge, take remote
        if (remoteSalt && localSalt && remoteSalt !== localSalt) {
            localStorage.setItem("vaultSalt", remoteSalt);
            localStorage.setItem("vault", remoteEncrypted);
            return;
        }

        // Same salt — merge: remote wins on conflict
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

        const merged = [...remoteEntries];
        for (const local of localEntries) {
            const exists = remoteEntries.some(r =>
                r.name === local.name && r.username === local.username
            );
            if (!exists) merged.push(local);
        }

        localStorage.setItem("vault", await encryptData(merged, key));
    } catch {
        // Sync failure is silent — don't block login
    }
}

// ============================================================
// LOGIN
// ============================================================
loginBtn.addEventListener("click", async () => {
    const remaining = isLockedOut();
    if (remaining) return;

    const password = passwordInput.value;
    if (!password) { showError("Enter your master password"); return; }

    // First-time setup: require confirm-password to match
    if (isFirstTime) {
        const confirm = confirmInput.value;
        if (!confirm) { showError("Confirm your master password"); return; }
        if (password !== confirm) { showError("Passwords don't match"); return; }
        if (password.length < 8) { showError("Use at least 8 characters"); return; }
    }

    clearError();
    loginBtn.disabled    = true;
    loginBtn.classList.add("loading");
    loginBtn.textContent = isFirstTime ? "Creating" : "Unlocking";

    const key = await loginAndStoreKey(password);

    // Verify password against existing vault
    const encryptedVault = localStorage.getItem("vault");
    if (encryptedVault) {
        try {
            await decryptData(encryptedVault, key);
        } catch {
            sessionStorage.removeItem("vaultKey");
            recordFailedAttempt();

            const { attempts } = getLockoutState();
            const left        = MAX_ATTEMPTS - attempts;
            const stillLocked = isLockedOut();

            loginBtn.classList.remove("loading");
            loginBtn.disabled    = !!stillLocked;
            loginBtn.textContent = "Unlock";

            if (stillLocked) {
                showError(`Too many attempts. Try again in ${stillLocked}s`);
                startLockoutTimer();
            } else {
                showError(left > 0
                    ? `Incorrect password. ${left} attempt${left === 1 ? "" : "s"} remaining`
                    : "Incorrect password");
            }
            return;
        }
    }

    // Auto-sync from Gist before entering vault
    await autoSyncOnLogin(key);

    resetAttempts();
    sessionStorage.setItem("authenticated", "true");
    sessionStorage.setItem("lastActive",    Date.now());
    window.location.replace("vault.html");
});

// ============================================================
// TOGGLE PASSWORD VISIBILITY
// ============================================================
toggleBtn.addEventListener("click", () => {
    const isPassword   = passwordInput.type === "password";
    passwordInput.type = isPassword ? "text" : "password";
    setIcon(toggleBtn, isPassword ? "eye" : "eye-off");
});

passwordInput.addEventListener("keyup", e => {
    if (e.key !== "Enter") return;
    if (isFirstTime && !confirmInput.value) {
        confirmInput.focus();
    } else {
        loginBtn.click();
    }
});

confirmInput.addEventListener("keyup", e => {
    if (e.key === "Enter") loginBtn.click();
});

// ============================================================
// RESET VAULT
// Wipes all local data — vault, salt, settings, auth state
// User must set a new master password on next visit
// ============================================================
// ============================================================
// RESET VAULT — uses custom modal, not window.confirm
// ============================================================
const resetOverlay    = document.getElementById("reset-overlay");
const resetConfirmYes = document.getElementById("reset-confirm-yes");
const resetConfirmNo  = document.getElementById("reset-confirm-no");

document.getElementById("reset-btn").addEventListener("click", () => {
    resetOverlay.style.display = "flex";
});

resetConfirmNo.addEventListener("click", () => {
    resetOverlay.style.display = "none";
});

resetOverlay.addEventListener("click", e => {
    if (e.target === resetOverlay) resetOverlay.style.display = "none";
});

resetConfirmYes.addEventListener("click", () => {
    const keysToRemove = [
        "vault", "vaultSalt", "authenticated", "lastActive",
        "loginAttempts", "lockedAt", "lockoutLevel",
        "vaultSettings", "syncConfig", "biometric",
        "recovery", "vaultSort", "securityNotice"
    ];
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
    window.location.replace("login.html");
});

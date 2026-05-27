// ============================================================
// SETTINGS.JS — SecureVault
// ============================================================

// ============================================================
// AUTH
// ============================================================
checkAuth();
startActivityTracking();

window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// ============================================================
// DEFAULT SETTINGS
// ============================================================
const DEFAULT_SETTINGS = {
    autoLock:      true,    // security-first default; toggle off to disable the 5-min lock
    appearance:    "dark",  // "dark" | "light" — dark by default
    viewMode:      "list",
    defaultSort:   "name",
    confirmDelete: true
};

let settings = { ...DEFAULT_SETTINGS };

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", async () => {
    loadSettings();
    await applySettingsToUI();
    attachEventListeners();
    initSegmentedControls2();
    initSegmentedControls3();
    initSettingsTabs();

    // Info tooltips
    ["pat", "gist"].forEach(key => {
        const btn     = document.getElementById(`${key}-info-btn`);
        const tooltip = document.getElementById(`${key}-tooltip`);
        if (!btn || !tooltip) return;
        btn.addEventListener("click", e => {
            e.stopPropagation();
            tooltip.classList.toggle("show");
        });
        document.addEventListener("click", () => tooltip.classList.remove("show"));
    });
});

// ============================================================
// TABS
// ============================================================
function initSettingsTabs() {
    const tabs    = Array.from(document.querySelectorAll(".settings-tab"));
    const panels  = Array.from(document.querySelectorAll(".settings-tabpanel"));
    if (!tabs.length) return;

    function showTab(name) {
        tabs.forEach(t => {
            const on = t.dataset.tab === name;
            t.classList.toggle("active", on);
            t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach(p => {
            if (p.dataset.tab === name) p.removeAttribute("hidden");
            else                        p.setAttribute("hidden", "");
        });
        const next = new URL(window.location.href);
        next.hash = "#" + name;
        history.replaceState(null, "", next.toString());
    }

    tabs.forEach(t => t.addEventListener("click", () => showTab(t.dataset.tab)));

    // Deep-link via #hash on load
    const initial = (window.location.hash || "").replace(/^#/, "");
    if (initial && tabs.some(t => t.dataset.tab === initial)) showTab(initial);
}

// ============================================================
// LOAD / SAVE
// ============================================================
function loadSettings() {
    const saved = localStorage.getItem("vaultSettings");
    if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    // Migrate legacy `lightMode` boolean → `appearance` string
    if (typeof settings.lightMode === "boolean" && !settings.appearance) {
        settings.appearance = settings.lightMode ? "light" : "dark";
    }
    delete settings.lightMode;
}

function saveSettings() {
    localStorage.setItem("vaultSettings", JSON.stringify(settings));
}

// ============================================================
// APPLY TO UI
// Sets all controls to reflect current saved settings
// ============================================================
async function applySettingsToUI() {
    document.getElementById("auto-lock").checked      = settings.autoLock;
    document.querySelectorAll('input[name="appearance"]').forEach(r => {
        r.checked = r.value === settings.appearance;
    });
    document.getElementById("confirm-delete").checked = settings.confirmDelete;

    document.querySelectorAll('input[name="default-sort"]').forEach(r => {
        r.checked = r.value === settings.defaultSort;
    });
    document.querySelectorAll('input[name="vault-view"]').forEach(r => {
        r.checked = r.value === settings.viewMode;
    });

    applyAppearance(settings.appearance);
    applyViewMode(settings.viewMode);

    const cfg = await getSyncConfig();
    document.getElementById("github-token").value = cfg.token;
    document.getElementById("gist-id").value      = cfg.gistId;

    initSegmentedControls2();
    initSegmentedControls3();
}

// ============================================================
// SYNC CONFIG
// ============================================================
async function saveSyncConfig() {
    const token  = document.getElementById("github-token").value.trim();
    const gistId = document.getElementById("gist-id").value.trim();
    await writeSyncConfig(token, gistId);
}

function setSyncStatus(msg, color) {
    const el = document.getElementById("sync-status");
    el.textContent = msg;
    el.style.color = color;
}

// ============================================================
// BIOMETRIC UNLOCK
// ============================================================
async function setupBiometricToggle() {
    const row    = document.getElementById("biometric-row");
    const toggle = document.getElementById("biometric-toggle");
    const status = document.getElementById("biometric-status");
    if (!row || !toggle) return;

    const available = await isBiometricAvailable();
    if (!available) {
        row.style.display = "";
        toggle.disabled   = true;
        if (status) status.textContent = "This device doesn't expose a platform authenticator.";
        return;
    }

    row.style.display  = "";
    toggle.checked     = biometricConfigured();

    toggle.addEventListener("change", async () => {
        if (toggle.checked) {
            try {
                await enableBiometric();
                status.textContent = "Biometric unlock enabled.";
                status.style.color = "var(--accent)";
                window.showToast("Biometric unlock enabled", { tone: "success" });
            } catch (e) {
                toggle.checked = false;
                status.textContent = e.message || "Couldn't enable biometric unlock.";
                status.style.color = "var(--danger)";
            }
        } else {
            disableBiometric();
            status.textContent = "Biometric unlock disabled.";
            status.style.color = "var(--text-secondary)";
            window.showToast("Biometric unlock disabled");
        }
    });
}

// ============================================================
// PASSWORD HEALTH
// ============================================================
async function runHealthScan(btn) {
    const status = document.getElementById("health-status");
    const list   = document.getElementById("health-problems");
    const key    = await getStoredKey();
    if (!key) { status.textContent = "Locked. Log in first."; return; }

    const encrypted = localStorage.getItem("vault");
    let entries = [];
    if (encrypted) {
        try { entries = await decryptData(encrypted, key); }
        catch { status.textContent = "Could not decrypt vault."; return; }
    }

    btn.disabled = true;
    btn.textContent = "Scanning…";
    status.textContent = "Checking 0 / " + entries.length;
    status.style.color = "var(--text-secondary)";

    const report = await scanVault(entries, (done, total) => {
        status.textContent = `Checking ${done} / ${total}`;
    });

    document.getElementById("health-total").textContent    = report.total;
    document.getElementById("health-weak").textContent     = report.weak;
    document.getElementById("health-reused").textContent   = report.reused;
    document.getElementById("health-breached").textContent = report.breached;

    list.innerHTML = "";
    if (report.problems.length === 0) {
        status.textContent = "All good — no problems found.";
        status.style.color = "var(--accent)";
    } else {
        status.textContent = `${report.problems.length} problem${report.problems.length === 1 ? "" : "s"} found.`;
        status.style.color = "var(--danger)";
        report.problems
            .sort((a, b) => b.issues.length - a.issues.length)
            .forEach(p => {
                const li = document.createElement("li");
                li.className = "health-problem";
                const name = document.createElement("span");
                name.className   = "health-problem-name";
                name.textContent = p.entry.name || "Untitled";
                const tags = document.createElement("span");
                tags.className = "health-problem-tags";
                tags.textContent = p.issues.join(" · ");
                li.appendChild(name);
                li.appendChild(tags);
                list.appendChild(li);
            });
    }

    btn.disabled = false;
    btn.textContent = "Re-scan vault";
}

// ============================================================
// LIVE EFFECTS
// ============================================================
function applyAppearance(value) {
    const dark = value !== "light";
    document.documentElement.classList.toggle("dark", dark);
    document.body.classList.toggle("dark", dark);
}

function applyViewMode(mode) {
    document.body.classList.remove("grid-view", "list-view", "gallery-view");
    document.body.classList.add(mode + "-view");
}

// ============================================================
// READ SETTINGS FROM UI
// ============================================================
function readSettingsFromUI() {
    settings.autoLock      = document.getElementById("auto-lock").checked;
    const appearancePicked = document.querySelector('input[name="appearance"]:checked');
    if (appearancePicked) settings.appearance = appearancePicked.value;
    settings.confirmDelete = document.getElementById("confirm-delete").checked;

    const sort = document.querySelector('input[name="default-sort"]:checked');
    if (sort) settings.defaultSort = sort.value;

    const view = document.querySelector('input[name="vault-view"]:checked');
    if (view) settings.viewMode = view.value;
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function attachEventListeners() {

    // Save settings
    document.getElementById("save-settings").addEventListener("click", () => {
        readSettingsFromUI();
        showConfirmation("Save changes?", async () => {
            saveSettings();
            try {
                await saveSyncConfig();
            } catch (e) {
                setSyncStatus("Could not save token: " + e.message, "var(--danger)");
            }
            applyAppearance(settings.appearance);
            applyViewMode(settings.viewMode);
        });
    });

    // Reset to defaults
    document.getElementById("reset-settings").addEventListener("click", () => {
        showConfirmation("Reset all settings to default?", async () => {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            await applySettingsToUI();
        });
    });

    // Appearance live toggle (dark / light segmented control)
    document.querySelectorAll('input[name="appearance"]').forEach(r => {
        r.addEventListener("change", () => {
            settings.appearance = r.value;
            applyAppearance(r.value);
            saveSettings();
        });
    });

    // Change master password
    document.getElementById("change-password-btn").addEventListener("click", async () => {
        const current  = document.getElementById("change-password").value.trim();
        const newPwd   = document.getElementById("confirm-password").value.trim();
        const statusEl = document.getElementById("password-change-status");

        if (!current || !newPwd) {
            statusEl.textContent = "Fill in both fields";
            statusEl.style.color = "#e74c3c";
            return;
        }

        if (current === newPwd) {
            statusEl.textContent = "New password must differ from current";
            statusEl.style.color = "#e74c3c";
            return;
        }

        statusEl.textContent = "Changing…";
        statusEl.style.color = "var(--subtext)";

        const result = await changeMasterPassword(current, newPwd);

        if (result.ok) {
            statusEl.textContent = result.warning || "Password changed successfully";
            statusEl.style.color = result.warning ? "#e67e22" : "#2ecc71";
            document.getElementById("change-password").value  = "";
            document.getElementById("confirm-password").value = "";
        } else {
            statusEl.textContent = result.error;
            statusEl.style.color = "#e74c3c";
        }
    });

    // Logout
    document.getElementById("logout-btn").addEventListener("click", logout);

    // Password health scan
    const scanBtn = document.getElementById("health-scan-btn");
    if (scanBtn) scanBtn.addEventListener("click", () => runHealthScan(scanBtn));

    // Biometric unlock
    setupBiometricToggle();

    // Push to Gist
    const pushBtn = document.getElementById("push-btn");
    if (pushBtn) {
        pushBtn.addEventListener("click", async () => {
            try { await saveSyncConfig(); }
            catch (e) { setSyncStatus(e.message, "#e74c3c"); return; }
            setSyncStatus("Pushing…", "var(--subtext)");
            const result = await pushToGist();
            setSyncStatus(
                result.ok ? "Pushed successfully" : result.error,
                result.ok ? "#2ecc71" : "#e74c3c"
            );
        });
    }

    // Pull from Gist
    const pullBtn = document.getElementById("pull-btn");
    if (pullBtn) {
        pullBtn.addEventListener("click", async () => {
            try { await saveSyncConfig(); }
            catch (e) { setSyncStatus(e.message, "#e74c3c"); return; }
            setSyncStatus("Pulling…", "var(--subtext)");
            const result = await pullFromGist();
            setSyncStatus(
                result.ok
                    ? (result.reauth ? "Pulled — please log in again" : "Pulled successfully")
                    : result.error,
                result.ok ? "#2ecc71" : "#e74c3c"
            );
        });
    }
}

// ============================================================
// SEGMENTED CONTROLS
// Moves the sliding indicator to match the checked radio
// ============================================================
function initSegmentedControls2() {
    const control = document.querySelector(".segmented-control-2");
    if (!control) return;
    const radios = control.querySelectorAll('input[type="radio"]');
    const slider = control.querySelector(".segmented-slider-2");
    if (!slider) return;
    radios.forEach((radio, i) => {
        radio.addEventListener("change", () => {
            slider.style.transform = `translateX(${i * 100}%)`;
        });
        if (radio.checked) slider.style.transform = `translateX(${i * 100}%)`;
    });
}

function initSegmentedControls3() {
    const control = document.querySelector(".segmented-control-3");
    if (!control) return;
    const radios = control.querySelectorAll('input[type="radio"]');
    const slider = control.querySelector(".segmented-slider-3");
    if (!slider) return;
    radios.forEach((radio, i) => {
        radio.addEventListener("change", () => {
            slider.style.transform = `translateX(${i * 100}%)`;
        });
        if (radio.checked) slider.style.transform = `translateX(${i * 100}%)`;
    });
}

// ============================================================
// CONFIRMATION MODAL
// ============================================================
function showConfirmation(message, onConfirm) {
    const overlay   = document.getElementById("confirmation-overlay");
    const messageEl = document.getElementById("confirm-message");
    const btnYes    = document.getElementById("confirm-yes");
    const btnNo     = document.getElementById("confirm-no");

    messageEl.textContent = message;
    overlay.style.display = "flex";

    btnYes.onclick  = () => { overlay.style.display = "none"; onConfirm(); };
    btnNo.onclick   = () => { overlay.style.display = "none"; };
    overlay.onclick = e  => { if (e.target === overlay) overlay.style.display = "none"; };
}

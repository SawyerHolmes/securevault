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
    autoLock:      false,
    darkMode:      false,
    viewMode:      "grid",
    defaultSort:   "name",
    confirmDelete: true,
    lightBg:       THEME_DEFAULTS.lightBg,
    darkBg:        THEME_DEFAULTS.darkBg,
    accent:        THEME_DEFAULTS.accent
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
// LOAD / SAVE
// ============================================================
function loadSettings() {
    const saved = localStorage.getItem("vaultSettings");
    if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
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
    document.getElementById("dark-mode").checked      = settings.darkMode;
    document.getElementById("confirm-delete").checked = settings.confirmDelete;

    document.querySelectorAll('input[name="default-sort"]').forEach(r => {
        r.checked = r.value === settings.defaultSort;
    });
    document.querySelectorAll('input[name="vault-view"]').forEach(r => {
        r.checked = r.value === settings.viewMode;
    });

    applyDarkMode(settings.darkMode);
    applyViewMode(settings.viewMode);

    const cfg = await getSyncConfig();
    document.getElementById("github-token").value = cfg.token;
    document.getElementById("gist-id").value      = cfg.gistId;

    // Sync segmented slider positions after radios are set
    initSegmentedControls2();
    initSegmentedControls3();

    renderSwatches();
    applyTheme(settings);
}

// ============================================================
// APPEARANCE SWATCHES
// ============================================================
function buildSwatchGroup(containerId, values, currentValue, kind) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    values.forEach(v => {
        const color = typeof v === "string" ? v : v.value;
        const label = typeof v === "string" ? color : v.label;
        const btn   = document.createElement("button");
        btn.type           = "button";
        btn.className      = "swatch" + (color.toLowerCase() === (currentValue || "").toLowerCase() ? " selected" : "");
        btn.style.setProperty("--swatch-color", color);
        btn.dataset.value  = color;
        btn.dataset.kind   = kind;
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", color === currentValue ? "true" : "false");
        btn.setAttribute("aria-label", `${label} (${color})`);
        btn.title          = label;
        container.appendChild(btn);
    });
}

function renderSwatches() {
    buildSwatchGroup("light-bg-swatches", THEME_LIGHT_BGS, settings.lightBg, "lightBg");
    buildSwatchGroup("dark-bg-swatches",  THEME_DARK_BGS,  settings.darkBg,  "darkBg");
    buildSwatchGroup("accent-swatches",   THEME_ACCENTS,   settings.accent,  "accent");
}

function handleSwatchClick(btn) {
    const kind  = btn.dataset.kind;
    const value = btn.dataset.value;
    if (!kind || !value) return;
    settings[kind] = value;
    applyTheme(settings);
    saveSettings();
    renderSwatches();
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
// LIVE EFFECTS
// ============================================================
function applyDarkMode(enabled) {
    document.documentElement.classList.toggle("dark", enabled);
    document.body.classList.toggle("dark", enabled);
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
    settings.darkMode      = document.getElementById("dark-mode").checked;
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
                setSyncStatus("Could not save token: " + e.message, "#e74c3c");
            }
            applyDarkMode(settings.darkMode);
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

    // Dark mode live toggle
    document.getElementById("dark-mode").addEventListener("change", e => {
        applyDarkMode(e.target.checked);
        settings.darkMode = e.target.checked;
        saveSettings();
    });

    // Appearance swatches (delegated)
    ["light-bg-swatches", "dark-bg-swatches", "accent-swatches"].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("click", e => {
            const btn = e.target.closest(".swatch");
            if (btn) handleSwatchClick(btn);
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

// =========================
// AUTH
// =========================
checkAuth();
startActivityTracking();

window.history.pushState(null, null, window.location.href);
window.addEventListener("popstate", () => {
    window.history.pushState(null, null, window.location.href);
});

// =========================
// DEFAULT SETTINGS
// =========================
const DEFAULT_SETTINGS = {
    autoLock: false,
    darkMode: false,
    viewMode: "grid",
    defaultSort: "name",
    confirmDelete: true
};

let settings = { ...DEFAULT_SETTINGS };

// =========================
// INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    applySettingsToUI();
    attachEventListeners();
    initSegmentedControls2();
    initSegmentedControls3();
});

// =========================
// LOAD / SAVE
// =========================
function loadSettings() {
    const saved = localStorage.getItem("vaultSettings");
    if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
}

function saveSettings() {
    localStorage.setItem("vaultSettings", JSON.stringify(settings));
}

// =========================
// APPLY TO UI
// =========================
function applySettingsToUI() {
    document.getElementById("auto-lock").checked    = settings.autoLock;
    document.getElementById("dark-mode").checked    = settings.darkMode;
    document.getElementById("confirm-delete").checked = settings.confirmDelete;

    document.querySelectorAll('input[name="default-sort"]').forEach(r => {
        r.checked = r.value === settings.defaultSort;
    });
    document.querySelectorAll('input[name="vault-view"]').forEach(r => {
        r.checked = r.value === settings.viewMode;
    });

    applyDarkMode(settings.darkMode);
    applyViewMode(settings.viewMode);

    const cfg = getSyncConfig();
    document.getElementById("github-token").value = cfg.token;
    document.getElementById("gist-id").value      = cfg.gistId;
}

function saveSyncConfig() {
    const token  = document.getElementById("github-token").value.trim();
    const gistId = document.getElementById("gist-id").value.trim();
    localStorage.setItem("syncConfig", JSON.stringify({ token, gistId }));
}

function setSyncStatus(msg, color) {
    const el = document.getElementById("sync-status");
    el.textContent = msg;
    el.style.color  = color;
}

// =========================
// LIVE EFFECTS
// =========================
function applyDarkMode(enabled) {
    document.body.classList.toggle("dark", enabled);
}

function applyViewMode(mode) {
    document.body.classList.remove("grid-view", "list-view", "gallery-view");
    document.body.classList.add(mode + "-view");
}

// =========================
// READ SETTINGS FROM UI
// =========================
function readSettingsFromUI() {
    settings.autoLock      = document.getElementById("auto-lock").checked;
    settings.darkMode      = document.getElementById("dark-mode").checked;
    settings.confirmDelete = document.getElementById("confirm-delete").checked;

    const sort = document.querySelector('input[name="default-sort"]:checked');
    if (sort) settings.defaultSort = sort.value;

    const view = document.querySelector('input[name="vault-view"]:checked');
    if (view) settings.viewMode = view.value;
}

// =========================
// EVENT LISTENERS
// =========================
function attachEventListeners() {

    // Save settings
    document.getElementById("save-settings").addEventListener("click", () => {
        readSettingsFromUI();
        showConfirmation("Save changes?", () => {
            saveSettings();
            saveSyncConfig();
            applyDarkMode(settings.darkMode);
            applyViewMode(settings.viewMode);
        });
    });

    // Reset settings
    document.getElementById("reset-settings").addEventListener("click", () => {
        showConfirmation("Reset all settings to default?", () => {
            settings = { ...DEFAULT_SETTINGS };
            saveSettings();
            applySettingsToUI();
        });
    });

    // Dark mode live toggle
    document.getElementById("dark-mode").addEventListener("change", (e) => {
        applyDarkMode(e.target.checked);
        settings.darkMode = e.target.checked;
        saveSettings();
    });

    // Change master password
    document.getElementById("change-password-btn").addEventListener("click", async () => {
        const current = document.getElementById("change-password").value.trim();
        const confirm = document.getElementById("confirm-password").value.trim();
        const statusEl = document.getElementById("password-change-status");

        if (!current || !confirm) {
            statusEl.textContent = "Fill in both fields";
            statusEl.style.color = "#c0392b";
            return;
        }
        if (current === confirm) {
            statusEl.textContent = "New password must be different from current";
            statusEl.style.color = "#c0392b";
            return;
        }

        statusEl.textContent = "Changing...";
        statusEl.style.color = "var(--subtext)";

        // current = existing password, confirm = new password
        const result = await changeMasterPassword(current, confirm);

        if (result.ok) {
            statusEl.textContent = result.warning || "✓ Password changed successfully";
            statusEl.style.color = result.warning ? "#e67e22" : "#2e7d32";
            document.getElementById("change-password").value  = "";
            document.getElementById("confirm-password").value = "";
        } else {
            statusEl.textContent = "✗ " + result.error;
            statusEl.style.color = "#c0392b";
        }
    });

    // Logout
    document.getElementById("logout-btn").addEventListener("click", logout);

    // Push to Gist
    document.getElementById("push-btn").addEventListener("click", async () => {
        saveSyncConfig();
        setSyncStatus("Pushing...", "var(--subtext)");
        const result = await pushToGist();
        setSyncStatus(
            result.ok ? "✓ Pushed successfully" : `✗ ${result.error}`,
            result.ok ? "#2e7d32" : "#c0392b"
        );
    });

    // Pull from Gist
    document.getElementById("pull-btn").addEventListener("click", async () => {
        saveSyncConfig();
        setSyncStatus("Pulling...", "var(--subtext)");
        const result = await pullFromGist();
        setSyncStatus(
            result.ok ? "✓ Pulled — refresh vault to see changes" : `✗ ${result.error}`,
            result.ok ? "#2e7d32" : "#c0392b"
        );
    });
}

// =========================
// SEGMENTED CONTROLS
// =========================
function initSegmentedControls2() {
    const control = document.querySelector('.segmented-control-2');
    if (!control) return;
    const radios = control.querySelectorAll('input[type="radio"]');
    const slider = control.querySelector('.segmented-slider-2');
    radios.forEach((radio, i) => {
        radio.addEventListener('change', () => {
            slider.style.transform = `translateX(${i * 100}%)`;
        });
        if (radio.checked) slider.style.transform = `translateX(${i * 100}%)`;
    });
}

function initSegmentedControls3() {
    const control = document.querySelector('.segmented-control-3');
    if (!control) return;
    const radios = control.querySelectorAll('input[type="radio"]');
    const slider = control.querySelector('.segmented-slider-3');
    radios.forEach((radio, i) => {
        radio.addEventListener('change', () => {
            slider.style.transform = `translateX(${i * 100}%)`;
        });
        if (radio.checked) slider.style.transform = `translateX(${i * 100}%)`;
    });
}

// =========================
// CONFIRMATION MODAL
// =========================
function showConfirmation(message, onConfirm) {
    const overlay   = document.getElementById("confirmation-overlay");
    const messageEl = document.getElementById("confirm-message");
    const btnYes    = document.getElementById("confirm-yes");
    const btnNo     = document.getElementById("confirm-no");

    messageEl.textContent    = message;
    overlay.style.display    = "flex";

    btnYes.onclick = () => { overlay.style.display = "none"; onConfirm(); };
    btnNo.onclick  = () => { overlay.style.display = "none"; };
    overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = "none"; };
}
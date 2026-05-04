// ============================================================
// ADD-ENTRY.JS — SecureVault
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

const _settings = JSON.parse(localStorage.getItem("vaultSettings")) || {};
document.body.classList.toggle("dark", _settings.darkMode);

// ============================================================
// HAPTIC FEEDBACK
// Triggers device vibration where supported (mobile)
// ============================================================
function haptic(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
}

// ============================================================
// ELEMENTS
// ============================================================
const saveBtn        = document.getElementById("save-entry");
const cancelBtn      = document.getElementById("cancel-entry");
const nameInput      = document.getElementById("entry-name");
const urlInput       = document.getElementById("entry-url");
const usernameInput  = document.getElementById("entry-username");
const passwordInput  = document.getElementById("entry-password");
const notesInput     = document.getElementById("entry-notes");
const toggleBtn      = document.getElementById("toggle-password");
const toggleIcon     = toggleBtn.querySelector("i");
const generateBtn    = document.getElementById("generate-btn");
const genLengthLabel = document.getElementById("gen-length-label");
const strengthBar    = document.getElementById("strength-bar");
const strengthLabel  = document.getElementById("strength-label");

// ============================================================
// CUSTOM SLIDER
// Pill track, discrete steps, inverted ticks on fill
// ============================================================
const SLIDER_MIN   = 8;
const SLIDER_MAX   = 64;
const SLIDER_STEPS = 14;

const sliderTrack   = document.getElementById("gen-slider");
const sliderFill    = document.getElementById("slider-fill");
const sliderTicksBg = document.getElementById("slider-ticks-bg");
const sliderTicksFg = document.getElementById("slider-ticks-fg");
const sliderThumb   = document.getElementById("slider-thumb");

let sliderValue = 20;
let isDragging  = false;

// Build evenly spaced snap values
function buildSnapValues() {
    const vals = [];
    for (let i = 0; i <= SLIDER_STEPS; i++) {
        vals.push(Math.round(SLIDER_MIN + (SLIDER_MAX - SLIDER_MIN) * i / SLIDER_STEPS));
    }
    return vals;
}

const snapValues = buildSnapValues();

function nearestSnap(val) {
    return snapValues.reduce((a, b) =>
        Math.abs(b - val) < Math.abs(a - val) ? b : a
    );
}

function valueToPct(val) {
    return (val - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN);
}

function buildTicks() {
    // Background ticks — dark marks on light track
    sliderTicksBg.innerHTML = "";
    snapValues.forEach(v => {
        const d = document.createElement("div");
        d.className  = "slider-tick";
        d.style.left = valueToPct(v) * 100 + "%";
        sliderTicksBg.appendChild(d);
    });

    // Foreground ticks — light marks shown over the dark fill
    // The fill colour comes from CSS (.slider-ticks-fg has background via sliderFill sibling)
    sliderTicksFg.innerHTML = "";
    snapValues.forEach(v => {
        const d = document.createElement("div");
        d.className  = "slider-tick";
        d.style.left = valueToPct(v) * 100 + "%";
        sliderTicksFg.appendChild(d);
    });
}

function renderSlider() {
    const p = valueToPct(sliderValue) * 100;
    sliderFill.style.width    = p + "%";
    sliderThumb.style.left    = p + "%";
    sliderTicksFg.style.width = p + "%";
    genLengthLabel.textContent = sliderValue;
}

function setSliderValue(val) {
    const snapped = nearestSnap(Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, val)));
    if (snapped !== sliderValue) {
        haptic(4); // tick feedback on each step change
    }
    sliderValue = snapped;
    renderSlider();
}

function valFromClientX(clientX) {
    const rect  = sliderTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return nearestSnap(SLIDER_MIN + (SLIDER_MAX - SLIDER_MIN) * ratio);
}

// Mouse events
sliderThumb.addEventListener("mousedown", e => {
    isDragging = true;
    sliderThumb.style.cursor = "grabbing";
    e.preventDefault();
});

document.addEventListener("mousemove", e => {
    if (!isDragging) return;
    setSliderValue(valFromClientX(e.clientX));
});

document.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    sliderThumb.style.cursor = "grab";
    haptic([6, 20, 6]); // release feedback
});

// Touch events
sliderThumb.addEventListener("touchstart", e => {
    isDragging = true;
    e.preventDefault();
}, { passive: false });

document.addEventListener("touchmove", e => {
    if (!isDragging) return;
    setSliderValue(valFromClientX(e.touches[0].clientX));
}, { passive: false });

document.addEventListener("touchend", () => {
    if (!isDragging) return;
    isDragging = false;
    haptic([6, 20, 6]);
});

// Click on track (not thumb)
sliderTrack.addEventListener("click", e => {
    if (e.target === sliderThumb) return;
    setSliderValue(valFromClientX(e.clientX));
    haptic(8);
});

// Init slider
setTimeout(() => { buildTicks(); renderSlider(); }, 0);
window.addEventListener("resize", () => { buildTicks(); renderSlider(); });

// ============================================================
// TOGGLE PASSWORD VISIBILITY
// ============================================================
toggleBtn.addEventListener("click", () => {
    const isVisible      = passwordInput.type === "text";
    passwordInput.type   = isVisible ? "password" : "text";
    toggleIcon.className = isVisible ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
    haptic(6);
});

// ============================================================
// PASSWORD GENERATOR
// ============================================================
generateBtn.addEventListener("click", () => {
    const upper   = document.getElementById("gen-upper").checked;
    const numbers = document.getElementById("gen-numbers").checked;
    const symbols = document.getElementById("gen-symbols").checked;
    const length  = sliderValue;

    let chars = "abcdefghijklmnopqrstuvwxyz";
    if (upper)   chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (numbers) chars += "0123456789";
    if (symbols) chars += "!@#$%^&*()_+-=[]{}|;:,.<>?";

    if (!chars.length) {
        alert("Select at least one character type.");
        return;
    }

    // crypto.getRandomValues for cryptographically secure randomness
    const array    = new Uint32Array(length);
    crypto.getRandomValues(array);
    const password = Array.from(array).map(n => chars[n % chars.length]).join("");

    passwordInput.value  = password;
    passwordInput.type   = "text";
    toggleIcon.className = "fa-solid fa-eye";
    checkStrength(password);

    haptic([10, 30, 10]); // generate feedback
});

// Haptic on pill toggle clicks
document.querySelectorAll(".gen-option").forEach(el => {
    el.addEventListener("click", () => haptic(6));
});

// ============================================================
// STRENGTH INDICATOR
// ============================================================
function checkStrength(password) {
    let score = 0;
    if (password.length >= 8)            score++;
    if (password.length >= 12)           score++;
    if (password.length >= 16)           score++;
    if (/[A-Z]/.test(password))          score++;
    if (/[0-9]/.test(password))          score++;
    if (/[^A-Za-z0-9]/.test(password))  score++;

    const levels = [
        { label: "",        color: "transparent", width: "0%"   },
        { label: "Weak",    color: "#e74c3c",     width: "25%"  },
        { label: "Fair",    color: "#e67e22",     width: "50%"  },
        { label: "Good",    color: "#f1c40f",     width: "75%"  },
        { label: "Strong",  color: "#2ecc71",     width: "100%" },
    ];

    const level = score <= 1 ? 1 : score <= 3 ? 2 : score <= 4 ? 3 : 4;

    strengthBar.style.width      = levels[level].width;
    strengthBar.style.background = levels[level].color;
    strengthLabel.textContent    = levels[level].label;
    strengthLabel.style.color    = levels[level].color;
}

passwordInput.addEventListener("input", () => checkStrength(passwordInput.value));

// ============================================================
// SAVE ENTRY
// ============================================================
saveBtn.addEventListener("click", () => {
    const name     = nameInput.value.trim();
    const url      = urlInput.value.trim();
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    const notes    = notesInput.value.trim();

    if (!name || !username || !password) {
        alert("Name, username, and password are required.");
        haptic([20, 40, 20]); // error feedback
        return;
    }

    const key = getStoredKey();
    if (!key) { window.location.replace("login.html"); return; }

    let vault = [];
    const encrypted = localStorage.getItem("vault");
    if (encrypted) {
        try   { vault = decryptData(encrypted, key); }
        catch { vault = []; }
    }

    vault.push({ name, url, username, password, notes });
    localStorage.setItem("vault", encryptData(vault, key));

    haptic([10, 20, 30]); // success feedback
    window.location.href = "vault.html";
});

// ============================================================
// CANCEL
// ============================================================
cancelBtn.addEventListener("click", () => {
    haptic(6);
    window.location.href = "vault.html";
});

document.getElementById("logout-btn").addEventListener("click", logout);

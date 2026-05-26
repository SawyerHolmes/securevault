// ============================================================
// ICONS.JS — Lucide icon helpers
// Lucide replaces every <i data-lucide="name"> with an <svg>.
// setIcon() swaps an icon at runtime (e.g. password show/hide).
// renderIcons() rescans the DOM and is safe to call repeatedly.
// ============================================================

function renderIcons() {
    if (window.lucide && typeof lucide.createIcons === "function") {
        lucide.createIcons();
    }
}

function setIcon(host, name) {
    if (!host) return;
    host.innerHTML = `<i data-lucide="${name}"></i>`;
    renderIcons();
}

// Auto-render any data-lucide markers present at DOMContentLoaded
document.addEventListener("DOMContentLoaded", renderIcons);

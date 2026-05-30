// ============================================================
// ICONS.JS — minimal in-house icon renderer.
// We only use ~10 Lucide icons; inlining their SVG paths drops
// ~600 KB of dependency for ~3 KB of source. No external CDN.
// ============================================================

const ICON_PATHS = {
    copy:      '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    eye:       '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off": '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    lock:      '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    search:    '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    menu:      '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6"  y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    x:         '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    pencil:    '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    sparkles:  '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    archive:   '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    "trash-2": '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>'
};

function svgFor(name) {
    const inner = ICON_PATHS[name];
    if (!inner) return "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"' +
           ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round"' +
           ' stroke-linejoin="round" class="lucide lucide-' + name + '"' +
           ' aria-hidden="true">' + inner + '</svg>';
}

function renderIcons() {
    document.querySelectorAll("[data-lucide]").forEach(el => {
        const name = el.getAttribute("data-lucide");
        const svg  = svgFor(name);
        if (svg) el.outerHTML = svg;
    });
}

function setIcon(host, name) {
    if (!host) return;
    host.innerHTML = svgFor(name);
}

document.addEventListener("DOMContentLoaded", renderIcons);

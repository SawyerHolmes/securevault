// ============================================================
// THEME.JS — runtime theme API for the Appearance settings.
// The FOUC-prevention bootstrap is inlined in each HTML <head>
// (same logic, kept in sync) so swatches paint correctly on
// first load without waiting for this file to fetch.
// ============================================================

const THEME_LIGHT_BGS = ["#f4f4ec", "#f0eddb", "#edf1fe", "#f0eeea", "#fbfcf6"];
const THEME_DARK_BGS  = ["#0d0907", "#040200", "#0c090a", "#060606", "#0a0b0b"];

const THEME_ACCENTS = [
    { id: "stone",   value: "#57534e", label: "Stone"   },
    { id: "indigo",  value: "#4f46e5", label: "Indigo"  },
    { id: "blue",    value: "#2563eb", label: "Blue"    },
    { id: "emerald", value: "#059669", label: "Emerald" },
    { id: "amber",   value: "#d97706", label: "Amber"   },
    { id: "rose",    value: "#e11d48", label: "Rose"    }
];

const THEME_DEFAULTS = {
    lightBg: "#f4f4ec",
    darkBg:  "#0c090a",
    accent:  "#57534e"
};

function applyTheme(settings) {
    const r = document.documentElement;
    const s = settings || {};
    if (s.lightBg) r.style.setProperty("--bg-light", s.lightBg);
    if (s.darkBg)  r.style.setProperty("--bg-dark",  s.darkBg);
    if (s.accent)  r.style.setProperty("--accent",   s.accent);
}

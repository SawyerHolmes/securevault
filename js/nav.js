// ============================================================
// NAV.JS — mobile drawer toggle.
// Hamburger inside the lime pill opens a full-screen black drawer
// with big nav items. The drawer markup is per page so the active
// link can be highlighted with the existing .active class.
// ============================================================

// ============================================================
// Focus trap — keeps Tab inside the given container. Returns a
// release() function that restores focus to whatever was focused
// before the trap was installed.
// ============================================================
window.trapFocus = function trapFocus(container) {
    const sel = 'a[href], button:not([disabled]), input:not([disabled]),' +
                ' textarea:not([disabled]), select:not([disabled]),' +
                ' [tabindex]:not([tabindex="-1"])';
    function focusables() {
        return Array.from(container.querySelectorAll(sel))
            .filter(el => el.offsetParent !== null && !el.hasAttribute("aria-hidden"));
    }
    function onKey(e) {
        if (e.key !== "Tab") return;
        const els = focusables();
        if (!els.length) return;
        const first = els[0];
        const last  = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    }
    const previous = document.activeElement;
    container.addEventListener("keydown", onKey);
    const firstEl = focusables()[0];
    if (firstEl) firstEl.focus();
    return function release() {
        container.removeEventListener("keydown", onKey);
        if (previous && typeof previous.focus === "function") previous.focus();
    };
};

(function () {
    function init() {
        const burger = document.getElementById("nav-burger");
        const drawer = document.getElementById("nav-drawer");
        const close  = document.getElementById("nav-drawer-close");
        if (!burger || !drawer) return;

        let releaseTrap = null;

        function open() {
            drawer.classList.add("open");
            document.body.classList.add("drawer-open");
            releaseTrap = window.trapFocus(drawer);
        }
        function shut() {
            drawer.classList.remove("open");
            document.body.classList.remove("drawer-open");
            if (releaseTrap) { releaseTrap(); releaseTrap = null; }
        }

        burger.addEventListener("click", open);
        close && close.addEventListener("click", shut);
        drawer.addEventListener("click", e => {
            if (e.target === drawer) shut();
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && drawer.classList.contains("open")) shut();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

// ============================================================
// NAV.JS — mobile drawer toggle.
// Hamburger inside the lime pill opens a full-screen black drawer
// with big nav items. The drawer markup is per page so the active
// link can be highlighted with the existing .active class.
// ============================================================

(function () {
    function init() {
        const burger = document.getElementById("nav-burger");
        const drawer = document.getElementById("nav-drawer");
        const close  = document.getElementById("nav-drawer-close");
        if (!burger || !drawer) return;

        function open()  { drawer.classList.add("open"); document.body.classList.add("drawer-open"); }
        function shut()  { drawer.classList.remove("open"); document.body.classList.remove("drawer-open"); }

        burger.addEventListener("click", open);
        close && close.addEventListener("click", shut);
        drawer.addEventListener("click", e => {
            // Tap the backdrop (drawer itself, not the content) to dismiss
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

// Runs on every page
(function () {
    const settings = JSON.parse(localStorage.getItem("vaultSettings")) || {};

    if (settings.darkMode) {
        document.body.classList.add("dark");
    }

    if (settings.compactView) {
        document.body.classList.add("compact");
    }
})();
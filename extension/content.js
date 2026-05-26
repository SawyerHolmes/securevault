// ============================================================
// CONTENT.JS — runs on every page.
// Scans for login forms and shows a small lime "SV" pin next to
// the password field. Clicking the pin opens the saved vault URL
// (the user copies / pastes the credential from there for now).
//
// The full autofill bridge — sending entries from the vault back
// into this page — needs a postMessage handshake on a trusted
// origin and lives in a follow-up. This stub gets the surface
// area in place.
// ============================================================

(function () {
    const seen = new WeakSet();

    function findPasswordFields() {
        return Array.from(document.querySelectorAll('input[type="password"]'))
            .filter(el => !seen.has(el) && el.offsetParent !== null);
    }

    function addPin(passwordInput) {
        seen.add(passwordInput);

        const rect = passwordInput.getBoundingClientRect();
        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "securevault-pin";
        pin.textContent = "SV";
        pin.title = "Open in Securevault";
        pin.setAttribute("aria-label", "Open Securevault");
        pin.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            chrome.runtime.sendMessage({ type: "open-vault" });
        });

        document.body.appendChild(pin);
        position();

        function position() {
            const r = passwordInput.getBoundingClientRect();
            pin.style.top  = (window.scrollY + r.top + r.height / 2 - 12) + "px";
            pin.style.left = (window.scrollX + r.right - 32) + "px";
        }
        window.addEventListener("scroll",  position, { passive: true });
        window.addEventListener("resize",  position);
    }

    function scan() {
        findPasswordFields().forEach(addPin);
    }

    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.documentElement, { childList: true, subtree: true });
})();

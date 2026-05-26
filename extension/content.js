// ============================================================
// CONTENT.JS — runs on every page (`<all_urls>`).
//
// Two responsibilities:
//   1) Find password fields and drop a small lime "SV" pin next to
//      each one. Clicking the pin asks the background to open the
//      vault in fill-request mode.
//   2) Bridge messages back from the vault: listen for window
//      postMessages from a vault tab, forward them to the background,
//      and apply incoming "fill" payloads into the page's form.
// ============================================================

(function () {
    const seen = new WeakSet();

    function findPasswordFields() {
        return Array.from(document.querySelectorAll('input[type="password"]'))
            .filter(el => !seen.has(el) && el.offsetParent !== null);
    }

    function addPin(passwordInput) {
        seen.add(passwordInput);

        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "securevault-pin";
        pin.textContent = "SV";
        pin.title = "Fill from Securevault";
        pin.setAttribute("aria-label", "Open Securevault");
        pin.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            chrome.runtime.sendMessage({
                type:   "request-fill",
                origin: location.origin,
                href:   location.href
            });
        });

        document.body.appendChild(pin);
        position();

        function position() {
            const r = passwordInput.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) { pin.style.display = "none"; return; }
            pin.style.display = "";
            pin.style.top  = (window.scrollY + r.top + r.height / 2 - 12) + "px";
            pin.style.left = (window.scrollX + r.right - 32) + "px";
        }
        window.addEventListener("scroll", position, { passive: true });
        window.addEventListener("resize", position);
    }

    function scan() {
        findPasswordFields().forEach(addPin);
    }

    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // ----------------------------------------------------------
    // Bridge from the vault tab: forward postMessage → extension
    // ----------------------------------------------------------
    window.addEventListener("message", e => {
        if (e.source !== window) return;
        const data = e.data;
        if (!data || data.__securevault !== true) return;
        if (data.type !== "vault-pick") return;
        chrome.runtime.sendMessage({
            type:      "vault-pick",
            requestId: data.requestId,
            username:  data.username,
            password:  data.password
        });
    });

    // ----------------------------------------------------------
    // Fill: background tells us to drop credentials in this tab
    // ----------------------------------------------------------
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === "fill") {
            const ok = fillIntoForm(msg.username || "", msg.password || "");
            sendResponse({ ok });
            return true;
        }
    });

    function setNativeValue(el, value) {
        // Some frameworks (React, Vue) override the input's value setter to
        // intercept changes. Use the prototype setter to bypass them and
        // dispatch a fresh event afterwards.
        const proto  = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, "value");
        if (setter && setter.set) setter.set.call(el, value);
        else el.value = value;
        el.dispatchEvent(new Event("input",  { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function fillIntoForm(username, password) {
        const pwdField = document.querySelector('input[type="password"]');
        if (!pwdField) return false;

        const userField = findUsernameField(pwdField);
        if (userField && username) setNativeValue(userField, username);
        if (password)              setNativeValue(pwdField, password);

        flashField(pwdField);
        if (userField && username) flashField(userField);
        return true;
    }

    function findUsernameField(pwdField) {
        const form   = pwdField.closest("form") || document.body;
        const fields = Array.from(form.querySelectorAll(
            'input[type="text"], input[type="email"], input[type="tel"], input:not([type])'
        ));
        // Prefer the input immediately before the password field
        let best = null;
        for (const f of fields) {
            if (f === pwdField) continue;
            if (f.offsetParent === null) continue;
            const pos = f.compareDocumentPosition(pwdField);
            if (pos & Node.DOCUMENT_POSITION_FOLLOWING) best = f;
        }
        return best;
    }

    function flashField(el) {
        el.style.transition = "outline 0.15s linear";
        el.style.outline = "2px solid #C7F100";
        setTimeout(() => { el.style.outline = ""; }, 400);
    }
})();

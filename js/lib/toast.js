// ============================================================
// TOAST.JS — generic notification system.
// window.showToast(message, opts?) where opts = {
//   tone:   "success" | "error" | undefined,
//   duration: ms (default 4000),
//   action: { label, onClick }
// }
// ============================================================

(function () {
    let container = null;

    function ensureContainer() {
        if (container) return container;
        container = document.createElement("div");
        container.className = "toast-stack";
        container.setAttribute("role", "status");
        container.setAttribute("aria-live", "polite");
        document.body.appendChild(container);
        return container;
    }

    function showToast(message, opts) {
        opts = opts || {};
        const el = document.createElement("div");
        el.className = "toast" + (opts.tone ? " toast-" + opts.tone : "");

        const text = document.createElement("span");
        text.className   = "toast-message";
        text.textContent = message;
        el.appendChild(text);

        let timer = null;
        function dismiss() {
            if (timer) clearTimeout(timer);
            el.classList.add("toast-out");
            setTimeout(() => el.remove(), 200);
        }

        if (opts.action) {
            const btn = document.createElement("button");
            btn.type        = "button";
            btn.className   = "toast-action";
            btn.textContent = opts.action.label;
            btn.addEventListener("click", () => {
                try { opts.action.onClick(); } finally { dismiss(); }
            });
            el.appendChild(btn);
        }

        ensureContainer().appendChild(el);
        requestAnimationFrame(() => el.classList.add("toast-in"));
        timer = setTimeout(dismiss, opts.duration || 4000);
        return dismiss;
    }

    window.showToast = showToast;
})();

// ============================================================
// LIST-NAV.JS — j / k / Up / Down outline navigation through a
// container's direct children, used by trash / archive /
// history / tags. Reuses the .kbd-focused style from the vault
// page (CSS section 36). No Enter binding — each row has its
// own action buttons and there's no natural primary action.
// ============================================================
window.attachListNav = function (container) {
    if (!container) return;
    let focusedIndex = -1;

    function modalOpen() {
        const candidates = document.querySelectorAll(
            ".confirmation-overlay, .reauth-overlay, .palette-overlay, .expanded-card"
        );
        for (const m of candidates) {
            if (m.hidden) continue;
            if (window.getComputedStyle(m).display !== "none") return true;
        }
        return false;
    }

    function focusRow(idx) {
        container.querySelectorAll(".kbd-focused").forEach(el => el.classList.remove("kbd-focused"));
        const children = container.children;
        if (!children.length) { focusedIndex = -1; return; }
        focusedIndex = Math.max(0, Math.min(idx, children.length - 1));
        children[focusedIndex].classList.add("kbd-focused");
        children[focusedIndex].scrollIntoView({ block: "nearest" });
    }

    document.addEventListener("keydown", e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const t = e.target;
        const inField = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
        if (inField) return;
        if (document.body.classList.contains("drawer-open")) return;
        if (modalOpen()) return;
        if (!container.children.length) return;

        if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
            e.preventDefault();
            focusRow(focusedIndex < 0 ? 0 : focusedIndex + 1);
        } else if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
            e.preventDefault();
            focusRow(focusedIndex < 0 ? 0 : focusedIndex - 1);
        }
    });

    // List mutates (restore, delete, rename, etc.) — drop the focused
    // index so the next Arrow / j / k re-anchors at row 0.
    new MutationObserver(() => { focusedIndex = -1; })
        .observe(container, { childList: true });
};

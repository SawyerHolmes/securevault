// ============================================================
// REAUTH.JS — re-prompt the master password before any action
// that would leak the vault or alter the recovery surface.
// requireMasterPassword(reason) returns a Promise<boolean>.
// True = the user typed the correct password; false = they
// cancelled. Verification works by deriving the key from the
// stored PBKDF2 salt and attempting to decrypt the current
// localStorage vault blob — same path the login screen uses,
// so we honour the same exponential lockout (TODO: hook in if
// we ever want it; for now a wrong attempt just shows an
// inline error and lets the user try again).
// ============================================================
function ensureReauthOverlay() {
    let overlay = document.getElementById("reauth-overlay");
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "reauth-overlay";
    overlay.className = "reauth-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
        '<div class="reauth-modal" role="dialog" aria-modal="true" aria-labelledby="reauth-title">' +
            '<h2 id="reauth-title" class="reauth-title">Confirm master password</h2>' +
            '<p class="reauth-reason"></p>' +
            '<input type="password" class="reauth-input" placeholder="Master password" ' +
                   'autocomplete="current-password" autocorrect="off" autocapitalize="off" spellcheck="false">' +
            '<p class="reauth-error" role="alert" aria-live="polite"></p>' +
            '<div class="reauth-buttons">' +
                '<button type="button" class="btn-white reauth-cancel">Cancel</button>' +
                '<button type="button" class="btn-black reauth-submit">Confirm</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);
    return overlay;
}

window.requireMasterPassword = function (reason) {
    return new Promise(resolve => {
        const overlay = ensureReauthOverlay();
        const reasonEl  = overlay.querySelector(".reauth-reason");
        const input     = overlay.querySelector(".reauth-input");
        const errorEl   = overlay.querySelector(".reauth-error");
        const submitBtn = overlay.querySelector(".reauth-submit");
        const cancelBtn = overlay.querySelector(".reauth-cancel");

        reasonEl.textContent = reason || "This action needs your master password.";
        input.value = "";
        errorEl.textContent = "";
        overlay.hidden = false;
        // Focus on next tick — fires after the overlay paints, so iOS Safari
        // actually surfaces the keyboard.
        setTimeout(() => input.focus(), 0);

        function close(result) {
            overlay.hidden = true;
            submitBtn.removeEventListener("click",  onSubmit);
            cancelBtn.removeEventListener("click",  onCancel);
            input    .removeEventListener("keydown", onKey);
            overlay  .removeEventListener("click",   onBackdrop);
            resolve(result);
        }

        async function onSubmit() {
            const pw = input.value;
            if (!pw) { errorEl.textContent = "Enter your master password."; return; }
            errorEl.textContent = "Checking…";
            submitBtn.disabled = true;
            try {
                const saltB64  = localStorage.getItem("vaultSalt");
                const vaultEnc = localStorage.getItem("vault");
                if (!saltB64 || !vaultEnc) {
                    errorEl.textContent = "No vault stored on this device.";
                    return;
                }
                const salt = base64ToBytes(saltB64);
                const key  = await deriveKeyFromSalt(pw, salt);
                await decryptData(vaultEnc, key); // throws on wrong password
                close(true);
            } catch {
                errorEl.textContent = "Incorrect password.";
                input.select();
            } finally {
                submitBtn.disabled = false;
            }
        }
        function onCancel() { close(false); }
        function onKey(e) {
            if (e.key === "Enter")       { e.preventDefault(); onSubmit(); }
            else if (e.key === "Escape") { e.preventDefault(); onCancel();  }
        }
        function onBackdrop(e) { if (e.target === overlay) onCancel(); }

        submitBtn.addEventListener("click",  onSubmit);
        cancelBtn.addEventListener("click",  onCancel);
        input    .addEventListener("keydown", onKey);
        overlay  .addEventListener("click",   onBackdrop);
    });
};

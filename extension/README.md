# Securevault — companion extension

A Manifest V3 extension that scans pages for `<input type="password">` and drops a small lime "SV" pin near each one. Click the pin and the extension opens your hosted Securevault instance in a new tab.

## What this extension currently does

- **Popup** with a single field — paste the URL of your hosted Securevault (e.g. `https://sawyerholmes.github.io/securevault/`). The popup persists the URL via `chrome.storage.local` and opens it in a new tab on demand.
- **Content script** runs on every page (`<all_urls>`). It finds password inputs and pins a small lime button next to them. Clicking the pin posts an `open-vault` message to the background worker, which opens the saved vault URL.
- **Options page** lets you change the saved URL later.

## What it intentionally does *not* do yet

Cross-origin autofill — sending an entry's password from the vault tab back into the page that triggered the request — needs a `window.postMessage` handshake on a trusted origin, plus a UI in the vault for picking which entry to send. That bridge is **not** implemented here. Today the pin is a fancy bookmark to your vault.

## Load locally

1. Chrome / Edge / Brave → `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Open the toolbar pin, paste your vault URL, click **Open vault**.
5. The pin button shows up on any page with a password field.

## Files

| File             | Purpose                                                |
|------------------|--------------------------------------------------------|
| `manifest.json`  | Manifest V3 declaration. No host permissions today.    |
| `popup.html/js`  | Toolbar popup — saves vault URL, opens it.             |
| `content.js`     | Scans for password inputs and pins the lime button.    |
| `content.css`    | Styling for the injected pin (single class, scoped).   |
| `background.js`  | Service worker — handles `open-vault` messages.        |
| `options.html`   | Standalone settings page (also reachable from popup).  |

## Icons

Manifest doesn't declare icons, so Chrome shows its default placeholder in the toolbar. Drop a `icon-16.png` / `icon-32.png` / `icon-48.png` / `icon-128.png` into an `icons/` folder and add an `"icons"` block + `"default_icon"` inside `"action"` to wire them in.

## Roadmap

- Establish a `postMessage` channel between the vault tab and the content script, gated by the saved vault URL's origin.
- When the user picks an entry in the vault, send `{ type: "fill", username, password }` back to the originating tab.
- Content script writes the values into the detected `<input>` elements and dispatches `input` events.
- Match logic: only suggest entries whose URL matches the current page's origin.

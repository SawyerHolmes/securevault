# Securevault — companion extension

A Manifest V3 extension that scans pages for `<input type="password">` and drops a small lime "SV" pin near each one. Click the pin and the extension opens your hosted Securevault instance in a new tab.

## What this extension does

- **Popup** with a single field — paste the URL of your hosted Securevault (e.g. `https://sawyerholmes.github.io/securevault/`). The popup persists the URL via `chrome.storage.local` and opens it in a new tab on demand.
- **Content script** runs on every page (`<all_urls>`) and pins a small lime "SV" button next to each visible `<input type="password">`.
- **Autofill bridge** — clicking the pin:
    1. Sends `{ type: "request-fill", origin }` to the background worker.
    2. Background generates a one-shot `requestId`, remembers the originating tab, and opens the vault with `#sv-fill=<requestId>&origin=<origin>` in the hash.
    3. The vault page sees the hash, renders a lime "Fill credentials for …" banner, and filters its list to logins whose URL matches the origin.
    4. The user picks an entry. The vault page calls `window.postMessage({ __securevault: true, type: "vault-pick", requestId, username, password })`.
    5. The content script on the vault tab forwards that postMessage to the background.
    6. Background looks up the request, calls `chrome.tabs.sendMessage(sourceTabId, { type: "fill", username, password })`, and closes the vault tab.
    7. The content script on the original page sets the username + password using the native setter (so React / Vue notice), dispatches `input` + `change` events, and briefly flashes a lime outline on each filled field.
- **Options page** lets you change the saved vault URL later.
- **Request lifecycle**: requests time out after 5 minutes, get dropped if the vault tab is closed without a pick, and are one-shot (no `requestId` is honoured twice).

## Load locally

### Chrome / Edge / Brave / Arc

1. Visit `chrome://extensions` (or the equivalent — `edge://extensions`, `brave://extensions`, etc.).
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select this `extension/` folder.
4. Open the toolbar pin, paste your vault URL, click **Open vault**.
5. The pin button shows up on any page with a password field.

### Safari

Safari can't load an unpacked extension directly — it has to be wrapped in a macOS app bundle. You need **Xcode** installed (App Store), then once:

```sh
xcrun safari-web-extension-converter /path/to/securevault/extension
```

That generates an Xcode project alongside the folder. Open the project, hit **Run** (Cmd+R) once — it builds and launches a tiny macOS shell app. Then in Safari:

1. Safari → Settings → **Advanced** → tick "Show features for web developers".
2. Safari → **Develop** menu → tick "Allow Unsigned Extensions".
3. Safari → Settings → **Extensions** → tick **Securevault**.

The `chrome.*` API calls in this folder are aliased to Safari's `browser.*` automatically, so no code changes are needed.

To rebuild after editing files, re-run the converter (it overwrites the Xcode project) and rebuild in Xcode. Or edit the files Xcode references in-place and rebuild.

### Firefox

Firefox also accepts the same Manifest V3 layout via `about:debugging` → "This Firefox" → "Load Temporary Add-on" → select `manifest.json`. The same `chrome.*` ↔ `browser.*` aliasing applies.

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

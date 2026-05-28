# Securevault

A local-first password manager that lives entirely in your browser. No server, no account, no telemetry. Your vault is encrypted on the device with AES-256-GCM under a key derived from your master password via PBKDF2-HMAC-SHA-256 at 600,000 iterations. If you turn on sync, only the encrypted blob ever leaves the device.

The whole app is static HTML / CSS / vanilla JS — no build step, no framework, no third-party hosted code on the auth path.

---

## Features

- **Entry types** — logins, secure notes, payment cards. Each gets its own field set in the form and the expanded view.
- **TOTP / 2FA** — paste a base32 secret on a login and the rolling 6-digit code lives inside the entry with a 30-second countdown.
- **Biometric unlock** — Touch ID / Face ID on supported devices via WebAuthn + the PRF extension. Optional, falls back to master password.
- **Password health** — HIBP k-anonymity breach check (only the first 5 hex chars of each SHA-1 hash leave the device), weak / reused detection, and a problem list in Settings → Health.
- **Tags** — comma-separated, lowercased. Filter pill bar above the vault list; a Settings → Storage → Manage tags page for bulk Rename / Merge / Delete.
- **Trash + Archive + History** — soft-delete with 30-day retention; manual archive that stays indefinitely; per-entry password history (last 10 versions per login).
- **Bulk select** — toggle Select on the vault page → checkboxes per row → bulk Add tag / Archive / Delete.
- **Sync** — push/pull the encrypted blob to a GitHub Gist. Auto-pulls on focus and every 5 minutes.
- **Mobile** — hamburger drawer, slide-up sheet modals, pull-to-refresh, fixed "+ Add entry" CTA, 16px inputs to defeat iOS auto-zoom.
- **PWA** — installable, offline-capable via a cache-first service worker.

---

## Running it

### Hosted on GitHub Pages
Settings → Pages → Deploy from a branch → `main` / `/ (root)`. After a minute the URL becomes `https://<your-username>.github.io/securevault/`. Visit it once to confirm.

### Locally for development
```bash
cd /Users/sawyerholmes/securevault
python3 -m http.server 8000
```
Then open `http://localhost:8000/`. The service worker registers; subsequent loads work offline.

---

## Sync setup

1. Generate a GitHub personal access token at https://github.com/settings/tokens — **classic**, with the `gist` scope only.
2. Create a secret gist at https://gist.github.com with one file called `vault.json` (any placeholder text). Copy the gist ID from the URL.
3. In the app: Settings → Sync → paste both → Push to Gist.

On a second device: Settings → Sync → same PAT + gist ID → Pull from Gist. The pull detects different salts and forces a re-login with your master password.

The PAT is encrypted with your vault key before being stored, so even local-storage exfiltration doesn't expose it.

---

## Security model

| Layer | What |
|---|---|
| Cipher | AES-256-GCM, 96-bit IV per blob, authenticated |
| KDF | PBKDF2-HMAC-SHA-256, 600,000 iterations, per-vault random salt |
| Key storage | Derived key sits in `sessionStorage` (cleared on tab close / lock) |
| Master password | Never leaves the device. Not stored anywhere |
| Sync token | Encrypted with the vault key before being saved |
| Breach check | HIBP range API: only the first 5 hex chars of the SHA-1 hash hit the network |
| Brute force | Exponential lockout: 30s → 1m → 2m → 4m → 8m → 16m → 32m → 1h cap |
| Biometric | WebAuthn PRF output wraps the vault key. No PRF = no unwrap |

Everything else is in `about.html` (also reachable from Settings → About Securevault).

---

## Project layout

See [DESIGN.md](DESIGN.md) for the design system and the file-by-file breakdown. Short version:

```
*.html               page templates (kept at root for clean URLs)
sw.js                service worker (root — controls scope "/")
manifest.webmanifest PWA manifest
css/styles.css       single stylesheet
assets/fonts/        self-hosted Inter
assets/icons/        favicon + manifest icon
js/lib/              shared infrastructure
js/pages/            one entry script per HTML page
```

HTML pages, `sw.js`, and `manifest.webmanifest` stay at the repo root on purpose: the pages need clean top-level URLs on GitHub Pages, and the service worker's scope is the directory it's served from.

No build step. Edit, refresh, ship.

---

## Licence

Personal project — no licence has been chosen yet. Don't redistribute.

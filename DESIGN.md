# SecureVault — Design system

The binding spec for every visible decision in the app. When in doubt, default to the **Hard rules** at the bottom: hard edges, UPPERCASE tracked labels, one accent.

This document supersedes the original spec. It reflects the app as it actually ships today, not the original brief.

---

## 1. Philosophy

Brutalist editorial. Hard edges, mono-aesthetic, type as the hero. Acid lime is sacred — used in controlled doses to draw the eye, never as wallpaper. Everything looks deliberate, almost printed. The app should feel closer to a Swiss design poster or an art magazine than a typical SaaS dashboard. Whitespace, hairline borders, and uppercase tracked labels do the work that gradients and shadows do in lesser apps.

---

## 2. Color tokens

Dark mode is the **default**. Light mode is an alternate users can opt into via Settings → Account → Appearance → Light mode. There are no user-pickable backgrounds or accents — the tokens below are fixed.

### Dark mode (default)

```
--bg:               #000000   /* true black, page background */
--surface:          #0A0A0A   /* cards, elevated panels */
--surface-raised:   #15151A   /* hovered/active surfaces, modals */
--border:           #1F1F1F   /* hairline dividers */
--border-strong:    #2C2C2C   /* emphasised borders, focus */
--text:             #FFFFFF
--text-secondary:   #888888
--text-tertiary:    #555555
--accent:           #C7F100   /* acid lime, the one accent */
--accent-ink:       #000000   /* text colour on lime */
--danger:           #FF3838
--danger-ink:       #FFFFFF
```

### Light mode

```
--bg:               #FFFFFF
--surface:          #FAFAFA
--surface-raised:   #F2F2F2
--border:           #E5E5E5
--border-strong:    #000000   /* hard black borders are part of the look */
--text:             #000000
--text-secondary:   #555555
--text-tertiary:    #999999
--accent:           #C7F100
--accent-ink:       #000000
--danger:           #DC2626
--danger-ink:       #FFFFFF
```

Borders use `--border` by default. Use `--border-strong` only for: focused inputs, the lime pill nav's inner black chips, the outer frame of confirmation modals in light mode, and pill-shaped secondary buttons.

---

## 3. Typography

Font: **Inter**, self-hosted from `/fonts/Inter-Regular.woff2` and `/fonts/Inter-Medium.woff2`. No Google Fonts. Falls back to the system stack if the WOFF2 fails.

```
font-family: 'Inter', -apple-system, BlinkMacSystemFont,
             "Segoe UI Variable", "Segoe UI", system-ui,
             "Helvetica Neue", Helvetica, Arial, sans-serif;
font-feature-settings: 'ss01', 'cv11', 'kern', 'liga', 'calt';
```

**Two weights only**: 400 (regular) and 500 (medium). Never 600/700/bold.

### Type scale

| Role                          | Size  | Weight | Case      | Letter-spacing        |
|-------------------------------|-------|--------|-----------|-----------------------|
| Display wordmark ("Enter vault.") | 48px | 500 | UPPER     | -0.045em              |
| Page title (h1)               | 32px  | 500    | sentence  | -0.03em               |
| Section header (h2)           | 18px  | 500    | UPPER     | 0.06em                |
| Entry numeral ("01", "02")    | 22px  | 500    | n/a       | -0.02em, tabular-nums |
| Entry name (in list)          | 13px  | 500    | UPPER     | 0.05em                |
| Body                          | 14px  | 400    | sentence  | 0                     |
| Label (above inputs)          | 11px  | 500    | UPPER     | 0.06em                |
| Caption / meta                | 11px  | 500    | UPPER     | 0.06em                |
| Username / secondary in row   | 11px  | 400    | sentence  | 0                     |
| Tag chip                      | 10–11px | 500  | UPPER     | 0.05em                |

Mobile (≤600px) bumps every text input to `font-size: 16px` so iOS doesn't auto-zoom on focus. Numerals in lists, counters, and the generator length display always use `font-variant-numeric: tabular-nums`.

### Casing rules

- Page titles, body text, usernames, URLs, notes, search placeholders → **sentence case** with a trailing period on titles ("Vault.", "Add entry.", "Settings.", "Tags.").
- Nav links, button text, entry names in list, labels, captions, section headers, tag chips → **UPPERCASE** with tracked letter-spacing.
- Wordmarks ("ENTER VAULT.", "■ SECUREVAULT") → **UPPERCASE**.

---

## 4. Geometry & spacing

Hard right angles **everywhere**, except:

- Top nav pill bar → `border-radius: 999px`
- Logo chip and Logout chip inside the nav → `border-radius: 999px`
- Pill buttons (Generate, Edit, tag chips, Select toggle) → `border-radius: 999px`
- Mobile fixed-bottom "+ Add entry" CTA → `border-radius: 999px`
- Tag chips (filter pills, per-row chips, expanded-card chips) → `border-radius: 999px`

Everything else — cards, modals, inputs, toggle switches, slider thumbs, segmented controls, list rows, the bulk-action footer, the bottom sheet — has `border-radius: 0`. The contrast between hard rectangles and the few pills is the whole point.

Borders: **1px solid** (not 0.5px). The pull-to-refresh indicator on mobile is a 3px lime bar.

Spacing scale (use these, not arbitrary values):

```
4px   8px   12px   16px   20px   24px   32px   48px   64px   96px
```

Page container: `max-width: 1100px` for `<main>`. Inner content column: `.page-content` at `max-width: 800px`, centred. Page padding: `32px` sides on desktop, `16px` on mobile. Vertical rhythm: `24px` between sections.

---

## 5. Page-level chrome

### Top navigation (sticky pill, on every authenticated page)

A full-width lime pill bar inside `<main>`. Height 44px, padding `8px`, `border-radius: 999px`. Sticky 16px below the viewport top on desktop, 8px on mobile.

- **Left**: logo chip — a black inner pill (`background: #000; color: var(--accent)`), padding `4px 10px`, `font-size: 11px`, UPPER tracked. Content `"■ SECUREVAULT"` (the `■` is a literal Unicode square).
- **Middle**: nav links — `font-size: 11px`, UPPER, `letter-spacing: 0.05em`, color `var(--accent-ink)`. Active: opacity 1, weight 500, `box-shadow: inset 0 -2px 0 0 currentColor`. Inactive: opacity 0.55, weight 400.
- **Right (desktop)**: Logout chip — same black pill style as the logo chip.
- **Right (mobile, ≤600px)**: nav links hide; a black round hamburger button (32×32, lime icon) takes their place. Tap opens the **mobile drawer**.

Login uses a slimmer variant (`.header-minimal`) with the logo only — no nav.

### Mobile drawer (≤600px)

Full-screen black sheet over everything. Big UPPER tracked nav items (18px) stacked vertically with 24px gaps. A round lime close button sits top-right (44×44). Backdrop tap, Escape, or close button dismiss it. `body.drawer-open` locks page scroll.

### Fixed bottom "+ Add entry" CTA (mobile, vault page only)

A 48px lime pill anchored 16px from the bottom of the viewport, respecting `env(safe-area-inset-bottom)`. Hidden on desktop.

### Pull-to-refresh indicator (mobile, vault page only)

A 64×3px lime bar fixed to the top of the viewport. Hidden by default; touch-drag from `scrollTop: 0` grows its opacity proportional to drag distance. Crossing 80px and releasing triggers a silent Gist pull. While loading: opacity 1 with `pull-pulse` animation.

### Bulk-actions bottom bar (vault, in select mode)

`position: fixed` at the bottom, full-width, `background: var(--surface)`, `border-top: 1px solid var(--border-strong)`. "`N selected`" caption on the left; Add tag / Archive / Delete / Cancel pill buttons on the right. On mobile the bar stacks vertically with full-width buttons.

---

## 6. Components

### Buttons

| Variant            | Background        | Text colour       | Border                                  | Radius | Padding      | Case  |
|--------------------|-------------------|-------------------|-----------------------------------------|--------|--------------|-------|
| Pill primary       | `var(--accent)`   | `var(--accent-ink)` | none                                  | 999px  | 8px 16px     | UPPER |
| Pill secondary     | transparent       | `var(--text)`     | 1px solid `var(--border-strong)`        | 999px  | 8px 16px     | UPPER |
| Square primary     | `var(--accent)`   | `var(--accent-ink)` | none                                  | 0      | 12px 18px    | UPPER |
| Square secondary   | transparent       | `var(--text)`     | 1px solid `var(--border-strong)`        | 0      | 12px 18px    | UPPER |
| Danger             | `var(--danger)`   | `var(--danger-ink)` | none                                  | 0      | 12px 18px    | UPPER |
| Icon button        | transparent       | `var(--text-secondary)` | 1px solid `var(--border)`         | 0      | 6px (28×28)  | n/a   |
| Row button         | (per variant)     | (per variant)     | (per variant)                           | 0      | 6px 12px     | UPPER |

All button text: `font-size: 11px`, `font-weight: 500`, `letter-spacing: 0.05em`. Hover: opacity 0.85 on primary, `border-color: var(--text)` on secondary/icon, `background: var(--surface-raised)` on icon. Active: `transform: scale(0.98)`. Transitions are `opacity 0.1s linear` only.

### Text inputs

- Background: transparent.
- Border: `1px solid var(--border)`, `border-radius: 0`.
- Padding: `12px 14px`.
- `font-size: 14px` (16px on ≤600px), `font-weight: 400`.
- Focus: `border-color: var(--text)`. No glow, no ring.
- Label above input: 11px UPPER tracked, `var(--text-secondary)`, `margin-bottom: 6px`. Inline `.label-hint` is the same label tone but sentence case and `var(--text-tertiary)`.
- Placeholder: `var(--text-tertiary)`, sentence case.

Password input gets a 28px icon button on the right (inside the border) for show/hide.

Search bar is one wrapper with a 1px outer border, a 16px magnifier on the left, the input filling the middle, and a 44px-wide sort button on the right separated by a 1px vertical divider. The whole bar highlights on `:focus-within`.

### Toggle switch — square

36×20px, `border: 1px solid var(--border-strong)`. Off: empty. On: lime fill, 16×16 black square knob slid right by 16px. No animation other than `transform` and the background change.

### Segmented control

A row of items inside a 1px outline, `border-radius: 0`. Each label is 11px UPPER tracked, equal flex. Selected: `background: var(--accent); color: var(--accent-ink)`. No animated indicator.

### Tabs (Settings page)

Horizontal row of UPPER tracked text buttons over a `1px solid var(--border)` bottom edge. Active tab: opacity 1, weight 500, `box-shadow: inset 0 -2px 0 0 var(--accent)`. Inactive: `color: var(--text-secondary)`. Mobile: horizontal scroll, no visible scrollbar. Tab state mirrored in URL hash.

### List rows (vault entries — the core unit)

Vault entries are **horizontal stripes**, not cards.

```
[ 22px numeral ][ name + secondary + tag chips stacked ][ action button ]
```

- Container: `padding: 16px 0`, `border-top: 1px solid var(--border)`. Last row also gets `border-bottom`.
- Grid: `grid-template-columns: 56px 1fr auto`, `gap: 16px`, `align-items: center`. Mobile: `32px 1fr auto`, `gap: 12px`.
- Numeral: 22px weight 500 (18px on mobile), tabular-nums, `var(--text)`. Featured rows get the numeral in `var(--accent)`.
- Name: 13px weight 500 UPPER tracked 0.05em, `var(--text)`.
- Secondary line: 11px weight 400 sentence case, `var(--text-secondary)`. Format depends on entry type:
  - **Login**: username (falls back to URL).
  - **Note**: `"Note · <first line>"`.
  - **Card**: `"Card · •••• <last4>"`.
- Tag chips (up to 3): below the secondary line. Small pill, `var(--text-secondary)` on `var(--border)`.
- Action area: a 28×28 icon button with a "copy" glyph in the right column.
- Hover: subtle lime tint via `background: linear-gradient(90deg, rgba(199,241,0,0.06), transparent)`. No transform, no shadow.

### Entry types

Every entry has a `type` of `"login"` (default), `"note"`, or `"card"`. The expanded modal and Add Entry form both gate their fields with `body[data-view-type=…]` / `body[data-entry-type=…]` plus `.type-only-login` / `.type-only-note` / `.type-only-card` on each field. Only the relevant fields render. Add Entry has a segmented control at the top to switch types; the expanded modal infers it.

### Tags

- `entry.tags` is an array of lowercased strings.
- Comma-separated input on Add Entry and in the expanded modal's edit mode.
- Vault page surfaces tags two ways: small chips inline on each row (capped at 3) and a horizontal pill filter bar above the search wrapper. The first chip is "All" (clears the filter); each tag has its own pill. Active pill: lime fill + ink black.
- A dedicated `tags.html` page lists every tag with its entry count and provides Rename / Merge / Delete actions across the whole vault.

### Bulk select mode

- A small "Select" pill button sits in a meta row above the list (alongside the entry count).
- Toggle adds `body.select-mode`. Each row reveals a square checkbox in a new left column; the row's grid becomes `24px 56px 1fr auto`.
- A fixed-bottom action bar appears: `N selected · Add tag · Archive · Delete · Cancel`. Drag-reorder is suppressed while in select mode.

### Vault views

- **List** (default): the stripe rows above.
- **Grid**: square brutalist tiles in an auto-fill `minmax(200px, 1fr)` grid. Each tile is 1px bordered, padded 16px, no shadow. Numeral, name, type-secondary, and a bottom row with username/url + copy button.
- **Gallery**: 110px square tiles. Each tile has a 48×48 lime-tinted icon area (favicon or initial letter), then UPPER tracked name + type-secondary below.

The old grid-of-rounded-cards is retired. Card grids are forbidden.

### Manual sort + drag-to-reorder

Sort menu's third option is "Manual order". When active and in list view, each stripe becomes HTML5-draggable (desktop only — touch isn't supported by DnD natively). Dropping a row onto another inserts it at that position; `entry.order` integers are rewritten on every drop. Visual: dragged row at opacity 0.4, drop target gets a lime top edge.

### Expanded card modal (when an entry is clicked)

- Backdrop: `background: rgba(0,0,0,0.7)`, no blur on mobile.
- Modal: `max-width: 480px`, `background: var(--surface)`, `border: 1px solid var(--border-strong)`, `border-radius: 0`, `padding: 24px`.
- Mobile: full-screen sheet sliding up from the bottom (`0.18s linear`, `translateY(100%)` → 0). Top edge gets a 1px lime border.
- Header: entry name as h2 (18px UPPER tracked), pill secondary "EDIT" button on the right that swaps for Save / Cancel in edit mode.
- Each field: label above (11px UPPER tracked secondary), value below (14px sentence). Field groups separated by `border-bottom: 1px solid var(--border)`, `padding: 12px 0`.
- URL value: underlined, inherits text colour.
- Password value: monospace, masked as `••••••••` until eye-toggle.
- Tags: pill chips. Edit mode swaps the chips for a comma-separated input.
- Card-type fields: cardholder, card number (with copy), expiry + CVV split row (CVV masked in view mode).
- Note-type field: rendered markdown content (see below).
- TOTP row (login only, when `entry.totp` is set): monospace 22px code with a 3px lime countdown bar draining over the 30s window, plus a copy button.
- Password breach warning (after a health scan flagged the password): `.password-warning` row below the password value, 11px UPPER tracked danger red with an 8×8 danger square marker.
- Modified date: 11px UPPER tracked secondary near the bottom.
- Footer: Archive (pill secondary) + Remove entry (full-width danger square), equal width.

Esc closes the modal; if a stacked confirmation is open, Esc closes that first.

### Markdown rendering

Note `content` and the universal `notes` field render markdown in view mode (storage stays plain text, edit mode is a plain `<textarea>`). Supported subset: `#`/`##`/`###` headings, `**bold**`, `*italic*`, `` `code` ``, `- list`, and `[text](https://…)` links (http(s) only). HTML is escaped first; only explicit transforms produce markup. Rendered headings use the brutalist UPPER tracked style; code spans get a 1px bordered `surface-raised` background; links are lime underlined.

### Password generator (Add Entry, login type only)

```
┌────────────────────────────────────────┐
│  20 chars  ──────●─────────────────────│  ← length + clean lime slider
│                                         │
│  [A-Z]  [0-9]  [!@#]      [ Generate ]  │  ← pill toggles + pill secondary
└────────────────────────────────────────┘
```

- Card: `border: 1px solid var(--border)`, `padding: 16px`, `gap: 14px` between rows. Transparent background.
- **No tick marks on the slider.** 20px-tall track with a 1px outline, a lime fill from 0 → current%, and an 18×18 square lime thumb with a 1px `border-strong` outline.
- Length is per-integer between 8 and 64. `haptic(4)` fires on each integer change.
- Three pill toggle chips for A–Z, 0–9, !@#. Selected: lime fill, ink black.
- Generate is a pill secondary button on the right (lime fill on hover).

### Strength indicator

A 3px tall full-width bar in `var(--border)` with coloured fill — single solid colour. Fill: `#FF3838` (weak), `#E67E22` (fair), `#F1C40F` (good), `var(--accent)` (strong). Label below: 11px UPPER tracked, same colour.

### Settings page

Tab nav at the top (Account / Vault / Health / Sync / Storage). Each panel is a stack of `.settings-group`s. Each group has an 11px UPPER tracked title above a 1px-bordered `.settings-section`. Rows inside are 16px-padded with hairline dividers.

- **Account**: master password change, biometric unlock toggle (only renders if the platform authenticator is available), light mode toggle.
- **Vault**: default view, default sort, confirm-before-delete, auto-lock (5-min idle lock gated on this; off means never lock).
- **Health**: 4-up stats grid (Entries / Weak / Reused / Breached), HIBP scan button, problem list. Breached count is rendered in danger red.
- **Sync**: GitHub PAT input, Gist ID input, Push / Pull buttons.
- **Storage**: featured links to Trash, Archive, Password history, Manage tags.

Save / Reset row sits below the tabs and applies to whichever fields the user touched. Featured "About Securevault" link sits below that with a black-bordered surround.

### Trash, Archive, History, Tags, About pages

Each is its own HTML file sharing the chrome (header, nav drawer, FOUC bootstrap). Layout is identical: page title with a one-line `.page-sub` subtitle, then a list of `.vault-card` stripes with per-row action buttons (Restore / Delete / Show / Copy / Rename / Merge etc.). Empty state uses the geometric icon + sentence-case body.

The About page additionally has a stack of `.about-section`s with UPPER tracked section titles, sentence-case prose, and a changelog rendered as a hairline-divided list.

### Welcome / first-run modal (vault.html)

Shown once on first visit (gated by `vaultSettings.onboarded`). Same modal frame as confirmation modals, slightly wider (460px). Four UPPER-labelled bullets explaining local-first crypto, the lime accent system, Trash / Archive, and TOTP. Single "Get started" primary button dismisses and writes `onboarded: true`.

### Confirmation / reset modal

Same modal frame as the expanded card. Title 16px UPPER tracked (`.confirm-title`). Body 14px sentence. Two equal-width buttons side by side: outline cancel on the left, danger square confirm on the right.

### Toast system

A stack at the bottom-centre of the viewport. Each toast: `border: 1px solid var(--border-strong)`, `background: var(--surface)`, `padding: 12px 16px`, `font-size: 13px`. Optional success tint borders in lime, error tint in danger red. Optional inline action button (lime square primary, used for Undo). Toasts fade in (`opacity 0.18s linear`), auto-dismiss after their duration, and fade out the same way. Stack is `aria-live: polite`.

---

## 7. Icons

Lucide outline icons, stroke 1.5, **inlined** into `js/icons.js` (no CDN, no full bundle). Available icons today: `copy`, `eye`, `eye-off`, `lock`, `search`, `info`, `menu`, `x`, `pencil`, `sparkles`. Add more by appending paths to `ICON_PATHS`.

Sizes (set on the rendered `<svg class="lucide">`):

- Inline / inside text: 14px
- Inside buttons: 14px
- Nav burger / close: 16–20px
- Empty state geometric icon: 16×16 lime square inside a 64×64 outlined frame
- Info button: 12px

Brand favicons inside gallery tiles still come from Google's `s2/favicons` endpoint, scaled inside a lime-tinted 48×48 frame so they fit the system.

---

## 8. Animation

Restrained. The only animations allowed:

- Opacity fades on hover (0.1s linear).
- `transform: scale(0.98)` on button press (0.1s linear).
- Modal / sheet slide-in (0.18s linear, no easing curve).
- Toast slide-up (0.18s linear).
- TOTP countdown bar width transition (1s linear).
- Strength bar width + background colour transition (0.18s linear).
- Login spinner pulse (0.6s linear, alternate) — the pulsing lime square during PBKDF2.
- Pull-to-refresh indicator pulse (0.6s linear, alternate) — only while the silent pull is in flight.

`@media (prefers-reduced-motion: reduce)` collapses every animation / transition duration to `0.001ms`. Brutalist apps don't wiggle, and they don't make you motion-sick either.

---

## 9. Haptics

Mobile gets light haptic feedback on these interactions (via `navigator.vibrate`, no-op on desktop):

- `haptic(4)` — slider crosses an integer step; tap a select-mode row to toggle.
- `haptic(6)` — open an entry; toggle a pill option; modal cancel.
- `haptic(8)` — click on the slider track.
- `haptic([6, 20, 6])` — slider drag release.
- `haptic([8, 20, 8])` — clipboard copy + save edit success.
- `haptic([10, 20, 30])` — Add Entry success.
- `haptic([10, 30, 10])` — Generate / Remove confirm.
- `haptic([20, 40, 20])` — validation error.

---

## 10. Accessibility

- `:focus-visible` ring: 2px solid lime, 2px offset. On the lime pill nav the ring switches to ink black (`var(--accent-ink)`) for contrast.
- Focus trap on the mobile drawer and the expanded entry modal. Tab cycles inside, Esc closes, focus restores to the trigger on close.
- Every icon-only button has an `aria-label`.
- `aria-live` regions: login error (`assertive`), sync status, password-change status, scan progress, biometric status — all `polite` or `status` role.
- Form inputs with show/hide buttons keep the show/hide button outside the input but within a `.password-wrapper` so the icon button is tab-reachable.
- All numbers in lists, counts, and counters use `font-variant-numeric: tabular-nums`.

---

## 11. Hard rules (never break)

1. **No drop shadows** anywhere. No `box-shadow` except inset focus / active-tab underlines and the bulk-action bar's top border (`border-top`, not shadow).
2. **No gradients** except the 6%-opacity lime tint on hovered list rows.
3. **No rounded corners** on cards, inputs, modals, toggles, sliders, the bulk-action bar. Only on the pill nav, pill buttons, tag chips, and the mobile bottom CTA.
4. **No italics in UI copy.** User-typed markdown in notes is allowed.
5. **No more than three colours on screen at once**: black/white/lime in dark mode, white/black/lime in light mode. Grey is allowed as text/border tone but doesn't count.
6. **Lime is never a large surface**. It appears as: the nav bar, button fills, selected tag chips, active segmented control segment, focus accents, the 6% hover tint, the strong-strength bar, the featured numeral, the breach indicator, the TOTP countdown bar, the pull-to-refresh bar, the welcome modal CTA. Nothing larger.
7. **No emoji** in UI text.
8. **No mid-sentence bold** in UI prose (settings descriptions, modal copy, etc.). Bold is for labels and section headers only. User markdown is exempt.
9. **Two weights only**: 400 and 500. Never use `font-weight: 700` or `bold`.
10. **Tabular-nums on every number** that appears in a list, card, counter, or strength meter.
11. **No tick marks on the generator slider.** The track is a clean 1px outline with a lime fill and a square lime thumb. Nothing else.

---

## 12. File layout

```
/                          ← app root
├── README.md              ← project overview
├── DESIGN.md              ← this file
├── index.html             ← meta refresh to login.html
├── login.html             ← entry point + welcome wordmark
├── vault.html             ← vault list + expanded modal + pull-to-refresh + bulk bar
├── add-entry.html         ← new entry form + generator
├── settings.html          ← tabbed settings
├── trash.html             ← deleted entries
├── archive.html           ← archived entries
├── history.html           ← per-entry password history log
├── tags.html              ← bulk tag management
├── about.html             ← version, security model, changelog
├── manifest.webmanifest
├── sw.js                  ← service worker (cache-first shell)
├── styles.css
├── fonts/                 ← self-hosted Inter (Regular + Medium)
├── icons/icon.svg         ← favicon + manifest icon
└── js/
    ├── lib/               ← shared infrastructure, loaded by multiple pages
    │   ├── auth.js              ← session timeout, master-password change
    │   ├── biometric.js         ← WebAuthn + PRF unlock
    │   ├── crypto-utils.js      ← AES-GCM + PBKDF2-SHA256 (600k)
    │   ├── health.js            ← HIBP k-anonymity, strength + reuse scan
    │   ├── icons.js             ← inlined Lucide SVG registry
    │   ├── markdown.js          ← tiny safe renderer for note content
    │   ├── nav.js               ← mobile drawer + focus trap helper
    │   ├── sw-register.js
    │   ├── sync.js              ← Gist push/pull (encrypted PAT)
    │   ├── toast.js             ← window.showToast(msg, opts)
    │   └── totp.js              ← RFC 6238
    └── pages/             ← one entry point per HTML page
        ├── add-entry.js
        ├── archive.js
        ├── history.js
        ├── login.js
        ├── settings.js
        ├── tags.js
        ├── trash.js
        └── vault.js
```

When editing UI, follow this file. When in doubt, default to: hard edges, UPPERCASE tracked labels, one accent.

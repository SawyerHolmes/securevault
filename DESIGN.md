# SecureVault — "Static" Design System

This file is the single source of truth for the SecureVault UI. Every page must follow it exactly. When in doubt, default to the hard rules at the bottom.

---

## 1. Philosophy

Brutalist editorial. Hard edges, mono-aesthetic, type as the hero. Acid lime is sacred — used in controlled doses to draw the eye, never as wallpaper. Everything looks deliberate, almost printed. The app should feel closer to a Swiss design poster or an art magazine than a typical SaaS dashboard. Whitespace, hairline borders, and uppercase tracked labels do the work that gradients and shadows do in lesser apps.

---

## 2. Color tokens

Dark mode is the **default**. Light mode is an alternate users can opt into.

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
--border-strong:    #000000   /* yes — hard black borders are part of the look */
--text:             #000000
--text-secondary:   #555555
--text-tertiary:    #999999
--accent:           #C7F100
--accent-ink:       #000000
--danger:           #DC2626
--danger-ink:       #FFFFFF
```

Borders use `--border` by default. Use `--border-strong` only for: focused inputs, the lime pill nav's inner black logo chip, and the outer frame of confirmation modals in light mode.

---

## 3. Typography

Font: **Inter** (or Helvetica Neue as fallback). Load Inter from Google Fonts.

```
font-family: 'Inter', 'Helvetica Neue', Helvetica, Arial, sans-serif;
font-feature-settings: 'ss01', 'cv11';
```

Use **two weights only**: 400 (regular) and 500 (medium). Never 600/700/bold.

### Type scale

| Role                          | Size  | Weight | Case      | Letter-spacing |
|-------------------------------|-------|--------|-----------|----------------|
| Display wordmark ("VAULT.")   | 72px  | 500    | UPPER     | -0.045em       |
| Page title (h1)               | 32px  | 500    | sentence  | -0.03em        |
| Section header (h2)           | 18px  | 500    | UPPER     | 0.06em         |
| Entry numeral ("01", "02")    | 22px  | 500    | n/a       | -0.02em, tabular-nums |
| Entry name (in list)          | 13px  | 500    | UPPER     | 0.05em         |
| Body                          | 14px  | 400    | sentence  | 0              |
| Label (above inputs)          | 11px  | 500    | UPPER     | 0.06em         |
| Caption / meta                | 11px  | 400    | UPPER     | 0.08em         |
| Username / secondary in row   | 11px  | 400    | sentence  | 0              |

### Casing rules

- Page titles, body text, usernames, URLs, notes, search placeholders → **sentence case**
- Nav links, button text, entry names in list, labels, captions, section headers → **UPPERCASE** with tracked letter-spacing
- Wordmarks ("VAULT.", "SV") → **UPPERCASE**
- All numbers in lists use `font-variant-numeric: tabular-nums`

---

## 4. Geometry & spacing

Hard right angles **everywhere**, except:

- Pill nav bar at the top → `border-radius: 999px`
- Pill buttons (Copy, Add entry in nav, etc.) → `border-radius: 999px`
- Inner logo chip in lime pill → `border-radius: 999px`

Everything else — cards, modals, inputs, text buttons, toggle switches, slider thumbs, segmented controls — has `border-radius: 0`. This is non-negotiable. The contrast between hard rectangles and the few pills is the whole point.

Borders: **1px solid** (not 0.5px — we want them visible).

Spacing scale (use these, not arbitrary values):

```
4px   8px   12px   16px   20px   24px   32px   48px   64px   96px
```

Page container: `max-width: 1100px`, centred. Page padding: `32px` sides on desktop, `16px` on mobile. Vertical rhythm: `24px` between sections.

---

## 5. Components

### Top navigation (sticky, present on vault / add-entry / settings)

A full-width lime pill bar across the top of `<main>`. Height ~44px, padding `8px 16px`, `border-radius: 999px`. Stays sticky.

- **Left**: logo chip — a black inner pill (`background: #000; color: var(--accent)`), padding `4px 10px`, `font-size: 11px`, uppercase tracked, content `"■ SECUREVAULT"`
- **Middle**: nav links — `font-size: 11px`, uppercase, `letter-spacing: 0.05em`, color `var(--accent-ink)`. Active link: opacity 1, weight 500. Inactive: opacity 0.55, weight 400.
- **Right**: primary CTA — a black inner pill matching the logo style, text `"+ ADD ENTRY"` with optional `"↗"` glyph at the end. Black bg, lime text.

The lime pill nav is the same in light and dark mode. The page background changes; the nav doesn't.

### Buttons

| Variant            | Background        | Text colour       | Border                | Radius | Padding      | Case  |
|--------------------|-------------------|-------------------|-----------------------|--------|--------------|-------|
| Pill primary       | `var(--accent)`   | `var(--accent-ink)` | none                | 999px  | 8px 16px     | UPPER |
| Pill secondary     | transparent       | `var(--text)`     | 1px solid current     | 999px  | 8px 16px     | UPPER |
| Square primary     | `var(--accent)`   | `var(--accent-ink)` | none                | 0      | 12px 18px    | UPPER |
| Square secondary   | transparent       | `var(--text)`     | 1px solid `var(--border-strong)` | 0 | 12px 18px | UPPER |
| Danger             | `var(--danger)`   | `var(--danger-ink)` | none                | 0      | 12px 18px    | UPPER |
| Icon button        | transparent       | `var(--text-secondary)` | 1px solid `var(--border)` | 0 | 6px (28px square) | n/a |

All button text: `font-size: 11px`, `font-weight: 500`, `letter-spacing: 0.05em`. Hover: opacity 0.85 on primary, `border-color: var(--text)` on secondary/icon, `background: var(--surface-raised)` on icon. Active: `transform: scale(0.98)`. No transitions on transforms — `transition: opacity 0.1s linear` only.

### Text inputs

- Background: transparent
- Border: `1px solid var(--border)`, `border-radius: 0`
- Padding: `12px 14px`
- `font-size: 14px`, `font-weight: 400`
- Focus: `border-color: var(--text)`. No glow, no ring, no offset shadow.
- Label above input: 11px uppercase tracked, `var(--text-secondary)`, `margin-bottom: 6px`
- Placeholder: `color: var(--text-tertiary)`, sentence case

Password input has a 28px icon button on the right (inside the border) for show/hide.

Search input: same style but with a 14px magnifier icon inside on the left.

### List rows (vault entries — the core unit)

Vault entries are **horizontal stripes**, not cards. No rounded corners, no background fill.

```
[ 22px numeral ][ name + username stacked ][ action pills ]
```

- Container: `padding: 14px 0`, `border-top: 1px solid var(--border)`. Last row also gets `border-bottom`.
- Grid: `grid-template-columns: 44px 1fr auto`, `gap: 14px`, `align-items: center`.
- Numeral: 22px weight 500, `font-variant-numeric: tabular-nums`, color `var(--text)`. Featured/highlighted rows get the numeral in `var(--accent)`.
- Name: 13px weight 500 UPPERCASE tracked 0.05em, color `var(--text)`.
- Username: 11px weight 400 sentence case, color `var(--text-secondary)`.
- Action area: pill secondary "COPY" + optional pill primary "OPEN ↗" for featured.
- Hover: subtle lime tint via `background: linear-gradient(90deg, rgba(199,241,0,0.06), transparent)`. No transform, no shadow.

For featured/just-used entries, the entire row gets that lime gradient tint and the numeral turns lime.

### Vault list-view / gallery-view variants

- **Default view**: the stripe rows above.
- **Gallery view**: 110px square tiles in a grid. Each tile: 1px border, 48×48px lime-tinted icon area with initial letter or favicon, then UPPERCASE name (11px tracked) and username (11px sentence) below.
- **No grid-of-cards view**. The current grid view with rounded card chunks should be removed — it conflicts with the brutalist direction.

### Expanded card modal (when an entry is clicked)

- Backdrop: `background: rgba(0,0,0,0.7)`, no blur (or `backdrop-filter: blur(2px)` max).
- Modal: `max-width: 480px`, `background: var(--surface)`, `border: 1px solid var(--border-strong)`, `border-radius: 0`, `padding: 24px`.
- Header: entry name as h2 (18px uppercase tracked), with a pill secondary "EDIT" button on the right.
- Each field: label above (11px uppercase tracked secondary), value below (14px sentence).
- Each field group separated by `border-bottom: 1px solid var(--border)`, `padding: 12px 0`.
- URL value: underlined, inherits text colour.
- Password value: monospace via `font-family: ui-monospace`, masked as `••••••••` until eye-toggle is clicked.
- Modified date: 11px uppercase tracked, secondary, at the bottom of the fields.
- Bottom: full-width danger square button "REMOVE ENTRY".

### Settings page

- Vertical stack of sections. Each section: 11px uppercase tracked header above (e.g. "ACCOUNT & SECURITY"), then a container with `border: 1px solid var(--border)`, rows inside separated by `border-bottom: 1px solid var(--border)`.
- Each row: `padding: 16px 18px`, label left, control right.
- Toggle switch: **square**, 36×20px, `border: 1px solid var(--border-strong)`. When off: empty. When on: lime fill, black 16px square knob slid to the right. No animation other than transform.
- Segmented control: row of items inside a 1px outline, `border-radius: 0`. Selected item gets `background: var(--accent); color: var(--accent-ink)`.
- "SAVE SETTINGS" / "RESET DEFAULTS" at the bottom as a pair — lime square primary + outline square secondary, side by side equal width.

### Add entry page

- Vertical fields, same input style as above.
- Below the password input: the **generator card**.
- Generator card: `background: var(--surface)`, `border: 1px solid var(--border)`, `border-radius: 0`, `padding: 16px`. Contains:
  - Top row: "GENERATE" pill secondary button on the left, big tabular-nums length number on the right (e.g. "20 CHARS")
  - Slider track: 1px solid border, lime fill, **square thumb** (18×18, lime, 1px black border in light mode). No round thumb.
  - Pill toggles for character types: "A–Z", "0–9", "!@#" as outlined pills. Active state: lime fill, black text.
- Strength indicator below the password: 3px tall full-width bar in `var(--border)` with coloured fill — single solid colour (not gradient), changing between `#FF3838` (weak), `#E67E22` (fair), `#F1C40F` (good), `var(--accent)` (strong). Label below: 11px UPPER tracked, same colour.
- Bottom: "SAVE ENTRY" lime square primary + "CANCEL" outline square secondary.

### Login

- Centred vertical stack, `max-width: 380px`, `margin: 96px auto`.
- "ENTER VAULT." as the display wordmark (48px on this page since it's narrower).
- Subline: 11px uppercase tracked, `var(--text-secondary)`, e.g. "ENCRYPTED LOCAL · 24 ENTRIES".
- Single password input, label above ("MASTER PASSWORD").
- "UNLOCK" square primary, full width.
- "FORGOT PASSWORD? RESET VAULT" as a text-only link below, 11px uppercase tracked tertiary, no underline (hover: underline).
- Error: 11px UPPER tracked, `color: var(--danger)`, shown below the input.

### Confirmation / reset modal

Same modal frame as the expanded card. Title 16px UPPER tracked. Body 14px sentence. Two square buttons side by side: outline cancel + danger square confirm.

### Toasts

Square (no radius), `1px solid var(--border-strong)`, lime background with black text. Position bottom-centre, `padding: 8px 16px`, 11px UPPER tracked. Slides up from below — no bounce, linear transition only.

### Empty state (vault.html when no entries exist)

- Centred, `max-width: 320px`, `margin-top: 96px`.
- A 64×64 outlined square icon (1px border, lime accent inside as a simple geometric shape).
- "YOUR VAULT IS EMPTY" — 18px UPPER tracked.
- "Add your first password to get started." — 14px sentence, `var(--text-secondary)`.
- "+ ADD FIRST ENTRY" lime pill primary below.

---

## 6. Icons

Use **Lucide** or **Feather** outline icons (stroke 1.5). Drop the existing Font Awesome dependency — its visual weight clashes.

Sizes:
- Inline / inside text: 14px
- Inside buttons: 14px
- Nav: 16px
- Empty state: 24–32px

Never use filled icons. Never use brand-coloured icons (no Google red, etc.) — even favicons inside gallery tiles should be wrapped in a lime-tinted square so they fit the system.

---

## 7. Mobile (≤ 600px)

- Page padding drops to 16px.
- Lime pill nav stays full-width across the top. Nav links collapse into a hamburger button on the right; tapping it opens a full-screen black drawer with big UPPER tracked nav items (18px) and a lime close button.
- The "+ ADD ENTRY" CTA in the nav becomes a **fixed bottom bar**: full-width lime pill, height 48px, sits above the safe area.
- Entries: same horizontal stripe layout, just narrower. The 44px numeral column drops to 32px.
- Modals: slide up from the bottom as a full-screen sheet. Top edge has a 1px lime border. No backdrop blur on mobile (performance).
- Search input: 16px font-size to prevent iOS auto-zoom.

---

## 8. Animation

Restrained. The only animations allowed:

- Opacity fades on hover (0.1s linear)
- `transform: scale(0.98)` on button press (0.1s linear)
- Modal/sheet slide-in (0.18s linear, no easing curves)
- Toast slide-up (0.18s linear)

No bounces, no spring physics, no cubic-bezier curves with overshoot. Brutalist apps don't wiggle.

---

## 9. Hard rules (never break)

1. **No drop shadows** anywhere. No `box-shadow` except the focus-ring overrides explicitly allowed.
2. **No gradients** except the 6%-opacity lime tint on hovered list rows.
3. **No rounded corners** on cards, inputs, modals, toggles, sliders. Only on pill buttons and the pill nav.
4. **No italics**.
5. **No more than three colours on screen at once**: black/white/lime in dark mode, white/black/lime in light mode. Grey is allowed as text/border tone but doesn't count as a fourth colour.
6. **Lime is never a large surface**. It appears as: the nav bar, button fills, focus accents, the 6% hover tint, the strength indicator at "strong", the numeral on a featured row. Nothing larger.
7. **No emoji** in UI text.
8. **No mid-sentence bold** in any prose (settings descriptions, modal copy, etc.). Bold is for labels and section headers only.
9. **Two weights only**: 400 and 500. Never use `font-weight: 700` or `bold`.
10. **Tabular-nums on every number** that appears in a list, card, or counter.

---

## 10. What to keep from the existing app

Don't rip out functionality while restyling. Preserve:

- The AES-256 + PBKDF2 crypto in `crypto-utils.js` (already correct)
- The session timeout, brute-force lockout, and reset flow in `auth.js` / `login.js`
- The Gist sync logic in `sync.js`
- The haptic feedback calls in `vault.js` and `add-entry.js`
- The dark-mode-on-html inline scripts in each `<head>` (they prevent flash)

Restyle: `styles.css`, every `*.html` page, and any inline styles in the JS that render dynamic UI (the empty-state `innerHTML` in `vault.js`, the copy menu, etc.).

---

## 11. File-by-file priority

When applying this spec, hit files in this order:

1. `styles.css` — replace the token block at the top with the new variables, then update components section-by-section
2. `login.html` — the entry point, sets the tone
3. `vault.html` — the most-visited page
4. `vault.js` — the dynamically rendered card / list / gallery markup needs to match
5. `add-entry.html` + `add-entry.js` — the generator card is unique to this page
6. `settings.html` + `settings.js` — the segmented controls and toggle switches need refactoring
7. Drop `Font Awesome` from every `<head>`, add Lucide via CDN, swap icon references

---

End of spec. When editing UI, follow this file. When in doubt, default to: hard edges, uppercase tracked labels, one accent.

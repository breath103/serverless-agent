# Terminal-HUD Design System

A cyberpunk / sci-fi HUD / terminal aesthetic for the serverless-agent app. Black canvas, monospace type, geometric status icons, hairline boxes, and amber-on-black with a single mint-cyan operational color and a red failure color. Think Alien (Nostromo MU/TH/UR readout), Severance (Lumon refiner UI), and a Cyberpunk 2077 minimap — utilitarian, diegetic, slightly menacing, never decorative.

## 1. Mood & philosophy

- **Diegetic, not decorative.** Every element looks like it belongs to a piece of equipment that does something. Avoid "designy" flourishes — gradients, soft shadows, rounded chrome, glassmorphism — they break the illusion.
- **Information-dense, but composed.** White space exists, but generous padding inside cells, not generous margins between them. The screen feels engineered, not airy.
- **High contrast, narrow palette.** Black background, amber primary, mint accent, red failure. That's the vocabulary. Resist the urge to add a fifth color "for variety."
- **Type does most of the work.** Monospace, ALL CAPS, letter-spacing, hierarchy via size and dimming — not via weight or color sprawl.
- **Sharp geometry.** Squares, triangles, circles, hairlines, diagonal hatching. No rounded corners anywhere — `border-radius: 0`. No drop shadows.

## 2. Color palette

Black canvas. Three semantic hues. Three brightness tiers per hue (full / dim / hairline) for hierarchy.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#000000` | Page background. Always pure black. |
| `--bg-elev` | `#0a0a0a` | Optional 2nd surface for stacked panels. Use sparingly. |
| `--amber` | `#FFB200` | **Default foreground.** Headings, labels, body text, default border, warnings/degraded. |
| `--amber-dim` | `#A86E00` | Captions, axis labels (`now`, `60h`), footer, disabled text. |
| `--amber-hair` | `#3A2700` | Border-only when amber is too loud (rare). |
| `--mint` | `#9DECDB` | **Operational** state, progress fill, success. Cyan-leaning teal. |
| `--mint-dim` | `#5BA89A` | Secondary mint text. |
| `--red` | `#FF3344` | **Failure / down / destructive** (DELETE, DEL, FAILURE). |
| `--red-dim` | `#A8202C` | Border on disabled-destructive or backdropped destructive chips. |

Rules:

- **Foreground defaults to amber.** Mint and red are reserved for status semantics — don't use mint just because something looks "good." If a thing isn't operational, it isn't mint.
- **Borders match content status.** A card whose service is OPERATIONAL gets a mint border. DEGRADED → amber. FAILURE → red. The chrome itself reports state.
- **No pastels, no muted neutrals, no grays.** Dimming is achieved by lowering luminance of the same hue (amber-dim), not by mixing toward gray.
- **Black is non-negotiable as the background.** Don't substitute `#0b0b0b` "for softness." The contrast is the point.

## 3. Typography

**Family:** A geometric monospace. In order of preference:

1. **Berkeley Mono** (paid, ideal — closest to the reference)
2. **JetBrains Mono** (free, excellent, readily available)
3. **IBM Plex Mono** (free, slightly warmer)
4. System fallback: `ui-monospace, SFMono-Regular, Menger, Consolas, monospace`

Pair with a single condensed display face only if a hero numeral is needed; otherwise the mono carries everything.

**Casing & spacing:**

- Headings, labels, buttons, status words: **ALL CAPS**, `letter-spacing: 0.04em–0.08em` (tighter for body, looser for small caps labels).
- Inline data (timestamps, hostnames, latency numbers): **lowercase or as-is**, no caps transform — they're values, not labels.

**Scale (rem, base 16px):**

| Role | Size | Weight | Casing | LS |
|---|---|---|---|---|
| `display` (hero status: DEGRADED) | 2.5–3rem | 700 | UPPER | 0.02em |
| `h1` (page title: STATUS MONITOR) | 1.75–2rem | 700 | UPPER | 0.03em |
| `h2` (card title: NEKOWEB) | 1.125rem | 700 | UPPER | 0.05em |
| `subtitle` (WEB HOSTING) | 0.75rem | 500 | UPPER | 0.08em |
| `body` | 0.875rem | 500 | mixed | 0 |
| `label` (SERVICES [2], OPERATIONAL legend) | 0.75rem | 600 | UPPER | 0.08em |
| `caption` (now, 60h, footer) | 0.6875rem | 500 | lower | 0.04em |
| `chip` (EDIT, DEL) | 0.6875rem | 600 | UPPER | 0.06em |

Line-height: 1.2 for headings, 1.4 for body, 1 for chips.

## 4. Iconography — geometric primitives

Status icons are **filled solid shapes**, not strokes, not Material/Lucide glyphs.

| Status | Shape | Color |
|---|---|---|
| OPERATIONAL | filled square ▪ | `--mint` |
| DEGRADED | filled triangle ▲ | `--amber` |
| FAILURE | filled circle ● | `--red` |
| UNKNOWN / pending | hollow square ▫ | `--amber-dim` |

Icon sizes: pair to text — 0.75× the text x-height for inline, 1.5–2rem for the hero status block. Render as inline SVG, not unicode (consistency across OS).

For non-status iconography (entrypoint bullets, list dots, etc.), use the same primitive set — small filled circle for operational endpoint, small filled circle in red for down. **Do not introduce a separate icon library.** If it's not a status shape, it's probably text.

## 5. Borders & containers

- **Width:** 1px default; 2px for emphasized "hero" frames (overall status block).
- **Color:** matches semantic state (see §2). Default = amber.
- **Radius:** **0**. Always.
- **Style:**
  - **Solid** = data/state container (cards, status, chips like EDIT/DEL).
  - **Dashed** = interactive affordance for *creating* or *managing* (ADD SERVICE, MANAGE USERS, ADMIN DETECTED). Dashed says "actionable / outside the data plane." Dash pattern: `4 4` (CSS `border-style: dashed` is fine; for SVG use `stroke-dasharray="4 4"`).
- **Padding:** `1rem` minimum interior; hero blocks use `1.5rem`.
- **No nested shadows or insets.** Stack relies on color and spacing.

CSS sketch:

```css
.panel        { border: 1px solid var(--amber); padding: 1rem; }
.panel-op     { border-color: var(--mint); }
.panel-down   { border-color: var(--red); }
.panel-action { border-style: dashed; }
.chip         { border: 1px solid currentColor; padding: 0.125rem 0.5rem; }
```

## 6. Status semantics & color coupling

The pairing of icon + word + color + border is **always identical**. Don't mix.

| State | Icon | Word | Text/Border |
|---|---|---|---|
| Operational | ▪ | OPERATIONAL | mint |
| Degraded | ▲ | DEGRADED | amber |
| Failure | ● | FAILURE / DOWN | red |

If you find yourself wanting a fourth state (e.g. "MAINTENANCE"), pick an existing one — maintenance is a flavor of degraded. Resist palette growth.

## 7. Page chrome — header, footer, metadata

**Header pattern (top-left):**

```
KICYA // SYSTEM
STATUS MONITOR
─────────────────────────  ← amber hairline rule under the title
```

- Eyebrow line: small caps, dim amber, `system // section` separated by `//` (two slashes, single space).
- Title: H1 size, full amber, bold, uppercase.
- Hairline rule (`border-bottom: 1px solid var(--amber)`) spans the content width below the title block.

**Header pattern (top-right, same row as eyebrow):**

```
PRIVATE ACCESS
2026-04-25 08:18:42.165 UTC
```

- Right-aligned, two stacked lines.
- Top line: meta tag (PRIVATE ACCESS, ADMIN, CHANNEL X, etc.) — small caps, dim amber.
- Bottom line: live UTC timestamp, monospace, full amber, ms precision when relevant. The clock should tick — see §13.

**Footer:** dim amber, small caps, single line: `© 2026 KICYA — ALL RIGHTS RESERVED` or similar. Aligned left.

**Section labels:** `SERVICES [2]` — uppercase, dim amber, count in square brackets. Place above the section, no border.

## 8. Buttons

Three kinds. No solid-fill buttons.

1. **Primary action (full-width / large):** dashed amber border, transparent fill, amber uppercase label. Hover: fill becomes `rgba(255, 178, 0, 0.08)`. Active: `0.15`. Use for ADD SERVICE, MANAGE USERS, the dominant CTA on a screen.
2. **Secondary action (inline, in a card footer):** solid amber border, transparent fill, smaller padding. Use for + ADD ENTRYPOINT, SUBSCRIBERS, EDIT SERVICE.
3. **Inline chip (EDIT, DEL):** solid border in `currentColor`, very tight padding (`0.125rem 0.5rem`), 0.6875rem text. DEL chips use `--red`; EDIT chips use `--amber`. Sit at the end of a row, separated by a thin gap.

Disabled = border + text both `--amber-hair` / `--red-dim`. No grayscale.

Focus ring: 1px outset border in the same color, offset 2px (`outline: 1px solid currentColor; outline-offset: 2px;`). No glow.

## 9. Progress / timeline strips

The signature element. A horizontal strip rendered as **diagonal hatching** (45° stripes), capped left/right with axis labels.

- **Width:** fills the row.
- **Height:** ~28–36px.
- **Background:** transparent (i.e. shows page black through the gaps).
- **Stripes:** `--mint` for healthy intervals, `--amber` for degraded, `--red` for failure.
- **Stripe geometry:** ~6px wide, ~6px gap, 45° angle. Implement via SVG `<pattern>` or CSS `repeating-linear-gradient(45deg, color 0 6px, transparent 6px 12px)`.
- **Axis caps:** small dim caption `now` flush left under the strip, `60h` flush right. Time flows right-to-left (now on the left, history extends to the right) — this matches the reference. Document this direction once and stick to it everywhere.
- **Anomaly markers:** a single full-saturation amber/red vertical bar replaces the stripes for the affected window.

Use this strip pattern for any time-series at-a-glance summary: uptime, agent run history, message volume, etc.

## 10. Section labels & counts

`LABEL [N]` — always uppercase, dim, count in square brackets, single space before bracket. Use for any collection where the count is meaningful (`SERVICES [2]`, `CHANNELS [4]`, `MEMORIES [128]`).

For metadata tags inside the chrome, prefer the `KEY // VALUE` pattern (`KICYA // SYSTEM`, `PRIVATE // ACCESS`).

## 11. Hierarchy patterns

The reference uses a consistent "title left / metric right" row pattern. Adopt it broadly:

```
┌───────────────────────────────────────────────────┐
│  [icon]  TITLE                       STATE        │
│          subtitle                    sub-metric   │
│  ───────────────────────────────────────────────  │
│  [progress strip]                                 │
│  caption-left                       caption-right │
│  ─                                                │
│  ● item label                       value [E][D]  │
│  ● item label                       value [E][D]  │
│  ─                                                │
│  [+ ACTION]  [ACTION]  [ACTION]  [ACTION]         │
└───────────────────────────────────────────────────┘
```

- Title block (icon + title + subtitle) anchors top-left.
- State block (status word + uptime %) anchors top-right, **right-aligned**.
- Progress strip spans full width.
- Item rows: bullet + label left, value + chips right.
- Footer actions: secondary buttons, left-aligned.

## 12. Forms & inputs

- **Input:** transparent fill, 1px solid amber border (or mint if the field is in an operational/success context), 0 radius, monospace text in amber, padding `0.5rem 0.75rem`. No floating labels — use a label *above* the input in small caps.
- **Focus:** border becomes 2px (without changing layout — pair with `outline-offset: -1px`). Optional 2-3 frame caret blink at 1Hz.
- **Placeholder:** `--amber-dim`.
- **Validation error:** border switches to `--red`; helper text below in `--red`, `caption` size, prefixed with `! ` (literal exclamation + space).
- **Select/dropdown:** same input chrome, list panel uses solid amber border, options highlight on hover with `rgba(255, 178, 0, 0.1)` background.
- **Checkbox/Toggle:** filled square = on (mint), hollow square = off (amber border). No iOS-style pill toggles.

## 13. Motion & interaction

Motion is sparing and *mechanical*. No easing curves softer than `linear` or `steps()`.

- **Live timestamp:** ticks every 100ms (matches the ms-precision clock in the reference). Implement as a single `requestAnimationFrame` updater, not a per-component setInterval.
- **Status pulse on FAILURE:** the red circle blinks at 1Hz (`steps(2)` opacity 1 → 0.4 → 1). Operational state is steady; failure is the only thing that pulses. (Degraded does not pulse — too noisy.)
- **Strip update:** new buckets slide in from the left (where `now` is) over 200ms `linear`. No fade.
- **Hover on cards:** border brightens by ~10% luminance, no transform, no shadow.
- **Page transitions:** instant. No fade, no slide. The terminal does not fade.
- **Button press:** background fill flashes to the active level for 80ms `linear`, then back. Optional CRT-style 1-frame negative flash on destructive actions.

## 14. Effects (use sparingly)

These are flavor — turn the dial down, not up. Each is opt-in.

### 14.1 Screen bloom — the "behind glass" effect

The reference video has a subtle softness that sells the illusion of looking *at* a HUD/CRT through a pane of glass, not at flat web pixels. It's a combination of three layered tricks; use all three together at low intensity rather than any one of them strongly.

**a) Per-glyph phosphor halo (the most important).** Every piece of foreground text gets a tiny shadow in its own color. This is the single biggest contributor to the "glass" feel — without it the type looks like Notepad on black.

```css
:root {
  /* Use color-mix so the halo always matches currentColor, including mint/red. */
  --bloom-near: 0 0 0.6px currentColor;
  --bloom-mid:  0 0 2px   color-mix(in oklch, currentColor 55%, transparent);
  --bloom-far:  0 0 8px   color-mix(in oklch, currentColor 25%, transparent);
}

[data-bloom="on"] body,
[data-bloom="on"] body * {
  text-shadow: var(--bloom-near), var(--bloom-mid), var(--bloom-far);
}

/* Hero text gets a wider halo so DEGRADED / STATUS MONITOR feel illuminated. */
[data-bloom="on"] .hero,
[data-bloom="on"] h1 {
  text-shadow:
    0 0 1px currentColor,
    0 0 6px  color-mix(in oklch, currentColor 60%, transparent),
    0 0 18px color-mix(in oklch, currentColor 35%, transparent);
}
```

Do the same to **borders** (treat the border as a stroked phosphor element) using `box-shadow` instead of `text-shadow`. Keep it tight — the border itself stays crisp; only the outside diffuses:

```css
[data-bloom="on"] .panel,
[data-bloom="on"] .chip,
[data-bloom="on"] [data-bloom-edge] {
  box-shadow:
    0 0 0.5px currentColor,
    0 0 6px   color-mix(in oklch, var(--amber) 25%, transparent);
}
.panel-op { --bloom-edge: var(--mint); }
.panel-down { --bloom-edge: var(--red); }
```

**b) Whole-screen soft focus (very slight).** A barely-perceptible global blur sells the "I'm looking at this through a glass pane" feel. Apply to the root, not to overlays:

```css
[data-bloom="on"] {
  /* 0.3–0.5px is the sweet spot. 1px starts to look like you forgot to focus. */
  filter: blur(0.35px);
}
```

Caveat: `filter` on the html/body element creates a stacking context that can interfere with `position: fixed` children and breaks `backdrop-filter` inside. If that's a problem, move the blur to a wrapper `<div id="screen">` that contains all routed content, and keep modals/portals as siblings outside it.

**c) Bloom overlay (the glow ring around bright pixels).** Duplicate the screen, blur it heavily, and additively composite at low opacity. Cheapest implementation is a single fixed SVG filter applied to a duplicated rendering, but the lo-fi web-friendly version is a fixed overlay that *re-uses the underlying layer via `backdrop-filter`*:

```css
[data-bloom="on"]::after {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9998;
  backdrop-filter: blur(6px) brightness(1.15);
  -webkit-backdrop-filter: blur(6px) brightness(1.15);
  mix-blend-mode: screen;
  opacity: 0.18;
}
```

This grabs whatever's behind the layer (the actual UI), blurs + brightens it, and screen-blends it back on top. The result is a soft halo around every bright element — exactly the CRT bloom you see on phosphor screens. Tune `opacity` to taste; 0.12–0.22 is the band where it reads as glass, not as smudge.

### 14.2 Curved-glass parallax (optional, premium)

If you want it to feel like a curved CRT face, add a *very* subtle barrel distortion via SVG filter on the root content wrapper. Use only on marketing/hero surfaces — it's expensive and slightly disorienting at desk distance.

```html
<svg width="0" height="0" style="position:absolute">
  <filter id="crt-warp">
    <feImage xlink:href="..." /> <!-- displacement map -->
    <feDisplacementMap in="SourceGraphic" scale="3" />
  </filter>
</svg>
```

```css
[data-crt-warp="on"] #screen { filter: url(#crt-warp); }
```

Off by default. Most surfaces should not use this.

### 14.3 The other accents

- **Scanlines:** a fixed full-screen `position: fixed; inset: 0; pointer-events: none;` overlay with `repeating-linear-gradient(transparent 0 2px, rgba(255,255,255,0.025) 2px 3px)`. Opacity ≤ 5%. Toggleable via `[data-scanlines="on"]` on `<html>`.
- **Vignette:** subtle radial darkening at edges, `background: radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.6) 100%)`. Optional.
- **Noise:** a fixed SVG `<feTurbulence>` overlay at 3% opacity. Optional.

### 14.4 Stacking & defaults

Recommended default for the app: **bloom on, scanlines on at 3%, vignette on, noise off, warp off.** The bloom is the workhorse. If you have to drop one for performance, drop the bloom overlay (14.1c) before the per-glyph halo (14.1a) — the halo carries 80% of the effect.

Performance notes:
- The per-glyph `text-shadow` is essentially free.
- The 0.35px blur on the root is cheap on GPU but blurs *everything* including images — if you ship raster avatars, exempt them: `img { filter: blur(0); }`.
- The `backdrop-filter` overlay is the most expensive of the three. On low-power devices, gate it behind a `prefers-reduced-transparency: no-preference` media query and a perf-class flag.

```css
@media (prefers-reduced-motion: reduce),
       (prefers-reduced-transparency: reduce) {
  [data-bloom="on"]::after { display: none; }
  [data-bloom="on"] { filter: none; }
}
```

Never enable everything at full strength simultaneously. The aesthetic is "engineered display," not "shader demo."

## 15. Don'ts

- ❌ No rounded corners (`border-radius: 0` everywhere; remove `--radius` from the token set or set to `0`).
- ❌ No drop shadows. The only shadow allowed is the **phosphor bloom** from §14.1 (text + border halos in `currentColor`). Don't use `box-shadow` for elevation or drop-shadow effects.
- ❌ No gradients (the diagonal-hatch progress strip is a *pattern*, not a gradient).
- ❌ No glassmorphism, no backdrop-filter blur.
- ❌ No emoji. Anywhere.
- ❌ No Material / Lucide / Heroicons / Feather icon sets. Geometric primitives only.
- ❌ No sans-serif body text. Mono is the body face.
- ❌ No light mode. This system is dark-only by design — a "light mode" of this aesthetic does not exist; it would be a different system.
- ❌ No soft pastels, no grays, no extra hues. If you need to differentiate a 4th category, use position/labeling, not a new color.
- ❌ No skeuomorphic loading spinners. Use a striped progress bar or a blinking caret.
- ❌ No avatar circles with photos. If users need representation, use 2-character monospace initials in a square border.

## 16. Token cheat-sheet (for `global.css`)

Replace the current `:root` palette with the terminal-HUD tokens. Keep names compatible with existing consumers where possible.

```css
:root {
  --bg:           #000000;
  --bg-elev:      #0a0a0a;

  --amber:        #FFB200;
  --amber-dim:    #A86E00;
  --amber-hair:   #3A2700;

  --mint:         #9DECDB;
  --mint-dim:     #5BA89A;

  --red:          #FF3344;
  --red-dim:      #A8202C;

  /* Semantic roles */
  --background:   var(--bg);
  --surface:      var(--bg);
  --surface-2:    var(--bg-elev);
  --text-1:       var(--amber);
  --text-2:       var(--amber-dim);
  --text-3:       var(--amber-hair);
  --border:       var(--amber);
  --border-op:    var(--mint);
  --border-down:  var(--red);
  --success:      var(--mint);
  --warning:      var(--amber);
  --error:        var(--red);

  --radius:       0;
  --hairline:     1px;

  /* Bloom (see §14.1). Compose into text-shadow / box-shadow on demand. */
  --bloom-near:   0 0 0.6px currentColor;
  --bloom-mid:    0 0 2px   color-mix(in oklch, currentColor 55%, transparent);
  --bloom-far:    0 0 8px   color-mix(in oklch, currentColor 25%, transparent);

  --font-mono:    "Berkeley Mono", "JetBrains Mono", "IBM Plex Mono",
                  ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

html, body {
  background: var(--bg);
  color: var(--text-1);
  font-family: var(--font-mono);
  font-feature-settings: "ss01", "zero";
}

* { border-radius: 0 !important; } /* enforcement during migration */
```

## 17. Migration notes (serverless-agent specifically)

The current frontend (`packages/frontend/src/global.css`) ships a forest-green/cream palette, Inter sans-serif, and `--radius: 0.625rem`. Migrating means:

1. **Swap `global.css` `:root` tokens** to the §16 set. Keep `--text-1`, `--text-2`, `--text-3`, `--background`, `--surface`, `--border`, `--error`, `--success` names — they're already wired through Tailwind's `@theme inline` block.
2. **Remove `--radius` usages** (or set to 0). Audit `rounded-*` Tailwind classes; remove or replace.
3. **Replace `Inter Variable` import** with a mono webfont (`@fontsource/jetbrains-mono` is the cheapest move). Update `--font-sans` → `--font-mono`, retarget `body` to `font-mono`.
4. **Audit `components/ui/*`**:
   - `button.tsx` → three variants (primary-dashed, secondary-solid, chip). Remove rounded.
   - `input.tsx`, `textarea.tsx`, `duration-input.tsx` → transparent fill, amber border, no radius.
   - `modal.tsx` → no shadow, solid amber border on black, no backdrop blur (just `rgba(0,0,0,0.7)` overlay).
   - `context-menu.tsx` → solid amber border list, no radius.
   - `DashboardBackground.tsx` → replace with a static black background; optionally add the scanline overlay from §14.
5. **Channel colors** (`--ch-phone`, `--ch-slack`, etc.) collapse into `--amber` for default and `--mint`/`--red` only when those channels report status. Don't keep brand colors — they break the aesthetic.
6. **Status indicators throughout the app** — rewire to the icon + word + color triple from §6.
7. **Add a uptime/timeline strip component** as a reusable primitive — the diagonal-hatch SVG pattern from §9. It's signature; many surfaces will want it.
8. **Drop any light-mode handling** — remove the `:root.dark` block and the `dark` custom-variant.

A reasonable migration order:

1. Tokens + font (one PR — looks broken but reveals everything that needs touching).
2. Button + input + modal primitives.
3. Page chrome (header eyebrow, timestamp, footer) — once, reused everywhere.
4. Status iconography + timeline strip primitive.
5. Per-route facelift, route by route.
6. Effects (scanlines, glow) opt-in last.

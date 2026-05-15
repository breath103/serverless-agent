# Phosphor Spectrum Design System

A warmer, multi-channel evolution of the Terminal-HUD aesthetic. Same CRT/vintage-computer DNA — monospace type, dark canvas, hairline geometry, phosphor glow — but the palette opens up from amber-only to a small **rainbow of channel colors**, the canvas warms from pure black to deep graphite, and the HUD theater (fake telemetry, ever-present "// SECTION" eyebrows, ticking clocks on every page) gets stripped out.

References: subway-poster maximalism (NER Northeast Regional), Warakami's *Google84 / Windows84 / Twitter84 / Netflix84* CRT mock-ups, vintage Korean game-arcade and karaoke-machine UIs, late-80s consumer software boot screens.

This document **supersedes** `2026-04-26_terminal-hud-design-system.md`.

## 1. Mood & philosophy

- **Warm CRT, not military HUD.** The screen is a friendly old monitor humming at the back of an arcade, not a Nostromo readout. Approachable, slightly nostalgic, never dystopian.
- **Information-first, decoration-second.** No fake telemetry, no decorative coordinates, no "PRIVATE // ACCESS" stamps unless the value is real and changes. If you wouldn't miss it, delete it.
- **Color carries hierarchy, not just brightness.** A neutral *cream* foreground does the body work. The 5-color **channel palette** marks role and section identity. Dimming is a tertiary tool, not the primary one.
- **One screen, one channel.** Each route picks a single dominant channel color (its "subway line"). Other channel colors only appear when they carry meaning — status, cross-references, comparisons. Avoids rainbow soup.
- **Sharp geometry, soft surfaces.** Still no rounded corners, still 1px hairlines, still monospace. But panels can have a faint *channel-tinted background* (5–8% wash) instead of always being a black box with a glowing border. The screen feels populated, not skeletal.
- **Mixed case is allowed.** ALL CAPS is reserved for labels, eyebrows, status words, and chips. Body text and titles can be sentence case — easier to read, less shouty.

## 2. Color palette

### 2.1 Canvas & neutrals

The page is no longer pure black. A warm near-black gives the cream/amber/coral hues something to sit against without the harsh contrast of `#000`.

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#0E0A07` | Page background. Warm graphite, almost black. |
| `--bg-elev` | `#17110C` | 2nd surface — sticky headers, popovers, hover wash on bg. |
| `--bg-tint` | derived | Channel-tinted surface: `color-mix(in oklch, var(--bg) 92%, var(--channel) 8%)`. Use for panel backgrounds (see §6). |

| Token | Hex | Role |
|---|---|---|
| `--cream` | `#EFE4CF` | **Default foreground.** Body text, headings, default borders, neutral chrome. |
| `--cream-dim` | `#A8997C` | Captions, secondary text, footer, inactive nav. |
| `--cream-hair` | `#5C5440` | Hairline rules, disabled text, muted borders. |

> The big shift from v1: **cream is the new amber.** Default text and borders are cream. Amber is now one of five channel colors, not the universal foreground.

### 2.2 Channel palette (the rainbow)

Five channel hues, each with full / dim / hair tiers. They map to **roles** (categories, sections, skills, channels). Pick the role-to-hue assignment once and stick to it.

| Token | Hex | Reads as |
|---|---|---|
| `--cyan` | `#5BC8FF` | Information / data / navigation. The "default" channel when nothing more specific applies. |
| `--magenta` | `#FF6FC8` | Identity / personal / messages. |
| `--coral` | `#FF7A55` | Connections / activity / live. Warm red-orange, distinct from error red. |
| `--amber` | `#FFC93B` | Settings / configuration / warnings. Sunshine yellow, warmer than v1's amber. |
| `--mint` | `#6BE3A8` | Operational / success / available. Slightly warmer than v1 mint. |

Each channel hue has dim and hair tiers, e.g. `--cyan-dim` `#3A8FB8`, `--cyan-hair` `#1B4257`. (Generate via OKLCH luminance steps; document exact hex per channel in `global.css`.)

### 2.3 Status palette (separate, reserved)

Status colors overlap visually with channel colors but are **role-locked** — never use them decoratively.

| Token | Hex | Role |
|---|---|---|
| `--success` | `#6BE3A8` (= `--mint`) | Operational, healthy, available. |
| `--warning` | `#FFC93B` (= `--amber`) | Degraded, needs attention, pending. |
| `--error` | `#FF4D5A` | Failure, destructive, validation error. **Distinct from `--coral`** — error is purer red, more saturated. |

Rules:
- A panel reporting `OPERATIONAL` always borders `--success`. Even if its channel is normally `--cyan`, status overrides channel.
- Don't use `--success` decoratively to mean "good vibes." If it's not actually operational, don't paint it mint.
- `--error` and `--coral` look similar but mean different things. Coral = "live activity, connections, your phone is on the line." Error = "something is wrong." If you're tempted to use coral to mean error, use error.

### 2.4 Hierarchy rules

1. **Default to cream.** When in doubt, text is cream. Borders are cream-hair. Backgrounds are `--bg`.
2. **Color a thing only if its role demands it.** A heading isn't cyan because cyan looks nice — it's cyan because this whole screen is the "cyan channel" (data/navigation).
3. **Status overrides channel.** If something is operational, it's mint. If it's failing, it's red. Even if the surrounding screen is amber.
4. **Two channels max per screen** (channel + status). More than that and the screen reads as a paint chart.
5. **Dim is for de-emphasis, not decoration.** `--cream-dim` for captions; `--<channel>-dim` for inactive states. Never use dim variants when full color is more honest.

## 3. Channel routing — the subway-line model

Each top-level section in the app gets a permanent channel assignment. Once assigned, that section's chrome (active nav item, page-title color, default border, panel tint) uses that channel. Like subway lines on a transit map: the Red Line is always red.

Initial assignments (subject to taste):

| Section | Channel | Why |
|---|---|---|
| Chat | `--cyan` | Default data/conversation surface. |
| Memory | `--magenta` | Personal / identity-adjacent. |
| Skills | `--amber` | Configuration / installed tools. |
| Profile / Settings | `--cream` | Neutral chrome — settings shouldn't shout. |
| Channels (Phone, Slack, etc.) | per-channel mapping (Phone=`--coral`, Slack=`--cyan`, Gmail=`--coral`, etc.) | Each integration gets its own line. |

Where it shows up:
- **Sidebar nav:** the active item highlights in its channel color (background = full channel, text = `--bg`).
- **Page header:** the page title can take the channel color, or stay cream with the hairline rule under it in channel color.
- **Default panel border within the section:** channel-hair (very faint).
- **Active interactive elements within the section:** channel-full.

If a route doesn't naturally belong to a section, default to cyan.

## 4. Typography

### 4.1 Family

- **Body:** `JetBrains Mono` (already shipping). Geometric monospace, excellent screen rendering. Berkeley Mono if licensed.
- **Display (optional, hero only):** a single chunky retro face for h1/hero numerals only. Recommended: **Bungee**, **Major Mono Display**, or **VT323**. Pick *one* and use it sparingly — the body face still carries 95% of the typography load. If you don't need a display face, skip it; mono can do the heavy lifting solo.

### 4.2 Casing

The biggest shift from v1: **mixed case is the default for body and headings**. ALL CAPS is reserved for *labels and chips*, where it signals "this is a metadata tag, not content."

| Use | Casing |
|---|---|
| Page titles, section titles, body text | Sentence case |
| Eyebrows, labels, status words, chip text, nav labels | UPPER CASE, letter-spaced |
| Inline data (timestamps, hostnames, IDs, numbers) | as-is, monospace |

### 4.3 Scale

| Role | Size | Weight | Casing | Color |
|---|---|---|---|---|
| `display` (hero numeral / boot screen) | 3rem | 700 | UPPER or as-is | channel |
| `h1` (page title) | 1.75rem | 700 | Sentence | cream or channel |
| `h2` (card title) | 1.125rem | 600 | Sentence | cream |
| `eyebrow` (above a title) | 0.6875rem | 600 | UPPER, ls 0.12em | cream-dim or channel-dim |
| `label` (form label, section label) | 0.75rem | 600 | UPPER, ls 0.10em | cream |
| `body` | 0.875rem | 400 | Sentence | cream |
| `caption` (timestamp, "x of y") | 0.6875rem | 400 | as-is | cream-dim |
| `chip` (EDIT, NEW, DEL, status) | 0.6875rem | 600 | UPPER, ls 0.06em | currentColor |

Line-height: 1.4 for body, 1.2 for headings, 1 for chips.

## 5. Iconography

Two icon families coexist, each with a clear job.

### 5.1 Status primitives (filled geometric shapes)

Same as v1. These are *symbols of state*, not navigation aids. Inline SVG, not unicode.

| Status | Shape | Color |
|---|---|---|
| Operational | filled square ▪ | `--success` |
| Degraded | filled triangle ▲ | `--warning` |
| Failure | filled circle ● | `--error` |
| Pending / unknown | hollow square ▫ | `--cream-dim` |

### 5.2 Pixel-art glyphs (navigation, action, content)

For nav items, content actions (edit, delete, plus), and skill identifiers: a single **pixel-art icon set** at 16×16 (or 24×24 for hero usage). Recommended: [Pixelarticons](https://pixelarticons.com/) — MIT-licensed, ~480 icons, render crisply on both retina and 1x because they're literal pixel grids.

Rules:
- One pixel-art set across the whole app — don't mix with Lucide / Material / Feather.
- Render at native 16/24px without scaling. Don't use them at 12px (illegible) or 32px (looks like Minecraft).
- Color: inherit `currentColor` so they pick up the surrounding channel.
- No emoji. Anywhere. (Korean text containing emoji should strip them.)

## 6. Borders, panels & surfaces

### 6.1 Border weights

- **Hairline** (default): 1px, color `--cream-hair`. Quiet structural border on three sides of panels, inputs, sidebars, dividers. Should never grab attention.
- **Top accent**: 2px, color `--<channel>` (the section channel), only on the top edge of panels. Carries channel identity. Has a phosphor halo above it so the bar reads as *lit*, not just printed.
- **Solid** (input focus / active): 1px, color `--<channel>`. Replaces cream-hair when an input is focused or a panel is in an active/operational/error state.
- **Dashed**: 1px dashed `--<channel>`, used *only* for "create new" affordances (`+ NEW SESSION`, `+ ADD SKILL`).

### 6.2 Panel surfaces — the locked-in pattern

Cards / panels / route detail regions follow a *single* surface pattern. We tried per-channel tinted backgrounds and matching-chroma borders — both made the screen feel muddy and turned cards into "slightly-different-colored brown blobs."

**The pattern: transparent surface + cream-hair sides + channel top bar.**

```css
.panel {
  background: transparent;            /* let the canvas show through */
  border: 1px solid var(--cream-hair); /* quiet structure on 3 sides */
  border-top: 2px solid var(--channel); /* channel identity on top */
  padding: 1rem 1.25rem;
  box-shadow:
    0 -1px 10px color-mix(in oklch, var(--channel) 26%, transparent);
  /* halo above the top bar so it reads as a lit subway-line marker */
}
```

Why it works:
- **Concept-faithful.** Real CRTs don't have z-axis depth. Cards aren't "raised tiles"; they're regions of the canvas demarcated by borders. The transparent surface matches Warakami84 / NER subway-poster maximalism — content sits *on* the canvas, not on a paper card *over* it.
- **Channel identity without rainbow soup.** One bold marker (the top bar) per card. Side borders stay neutral so a wall of cards reads as *a list of differentiated destinations*, not "three differently-colored boxes."
- **Surfaces are visually consistent.** Every panel in the app has the same chrome structure. Channel identity is delivered by content (title color, top bar), not by the container.

When the section is signaling status instead of plain channel identity, the top bar switches to the status color: `--mint` for operational, `--red` for failure, `--amber` for degraded. See §6.5.

### 6.3 Per-section canvas tint (optional, larger surfaces)

For full-bleed regions that *are* a section — the sidebar body, the chat composer area, a dedicated detail view — the canvas itself can take a very subtle channel tint:

```css
.section-canvas {
  background: color-mix(in oklch, var(--bg) 75%, var(--channel-hair) 25%);
}
```

This is the Warakami84 move ("the whole screen has a hue") but dialed *way* back — heavy enough to be felt, light enough that cream body text and bright channel-color titles still read with full contrast. **Don't apply this to small panels — it makes them look like the wrong shape of card.** Reserve it for the major region that *owns* the section.

### 6.4 No corners, no shadows (still)

- `border-radius: 0` everywhere. Non-negotiable.
- The only shadow is the phosphor halo (§11). No drop shadows for elevation.
- The `box-shadow` above the top bar in §6.2 is also phosphor halo — channel color at low opacity, simulating CRT light bleeding off the lit marker. It's not elevation.

### 6.5 Status states (override the channel top bar)

When a panel reports state, the top bar takes the status hue instead of the section channel:

| Panel state | Top bar | When |
|---|---|---|
| Default (channel identity) | `--<channel>` | Idle / informational. |
| Operational | `--mint` | Healthy active service. |
| Degraded | `--amber` | Slow, partial, refreshing. |
| Failure / destructive | `--red` | Down, errored, requires action. |
| Inactive / disabled | `--cream-hair` | Nothing to look at. |

## 7. Page chrome — simplified

v1 spec called for a fixed eyebrow + page title + ms-precision live UTC clock + footer copyright on every screen. **Remove all of this except the page title.** Most of it was decoration.

Minimum chrome per page:
- **Page title** — cream or channel, sentence case, 1.75rem, with a hairline channel-color rule below.

Optional:
- **Eyebrow** — only when there's a real parent (e.g. "Skills /" above a single-skill detail page). Don't put eyebrows on top-level pages.
- **Right-side metadata** — only when there's a real value to show (a count, a status, a connection state). Not a clock for clock's sake.

What to delete:
- ❌ Live ticking UTC clock on every page. The OS already shows the time. If a screen needs a "last updated" hint, show it once and only update on change.
- ❌ "SERVERLESS // AGENT" header on every page. Show it once in the sidebar (or as a logo), not on every route.
- ❌ "PRIVATE ACCESS" / "ADMIN DETECTED" stamps. If access matters, show it as a badge inside the avatar/profile area.
- ❌ Footer copyright on app screens. Marketing site only.
- ❌ "SECURE" indicator in the sidebar bottom-left. Either it's true everywhere (don't say it) or it's not (show *insecure*, not secure).

## 8. Buttons

Three kinds. All transparent fill except the active/primary variant.

1. **Primary** — solid channel-color fill, `--bg` text. For the dominant CTA per screen. Hover: 86% mix toward bg (darken). Active: 75% mix.
2. **Secondary** — transparent fill, 1px solid channel border, channel text. Hover: 12% channel wash background. Use for inline actions, footer actions, secondary CTAs.
3. **Chip** — 1px solid `currentColor`, very tight padding, 0.6875rem caps. Use for EDIT, DEL, status pills. Color comes from the surrounding context (cream by default; error for DEL; status color for status chips).

Disabled = both border and text drop to `*-hair` tier.

Focus ring: 1px outset in `currentColor`, offset 2px. No glow on focus (the phosphor bloom already gives it presence).

**Removed from v1:** the "primary action = dashed amber border, transparent fill" pattern. v1 had no truly-filled buttons; v2 reintroduces filled primary because the multi-color palette can support it without screaming.

## 9. Forms & inputs

- **Input:** transparent fill, 1px solid `--cream-hair` border (or channel-hair if inside a channel-colored section), cream text, padding `0.5rem 0.75rem`. No floating labels — label sits above in §4 `label` style.
- **Focus:** border switches to full channel color (or cream if no channel). No 2px border swap (caused layout shift in v1) — the bloom does the work.
- **Placeholder:** `--cream-dim`.
- **Validation error:** border switches to `--error`; helper text below in `--error`, caption size, prefixed with `! `.
- **Checkbox:** filled square = on (channel color), hollow square = off (cream-hair border).
- **Select / dropdown:** same input chrome; popover surface uses `--bg-elev` background, channel-hair border, hover row = 8% channel wash.

## 10. Progress / timeline strips (kept from v1, retuned)

The diagonal-hatch progress strip stays — it's signature. Tune the colors:
- Healthy bucket: `--success` (mint)
- Degraded: `--warning` (amber)
- Failure: `--error` (red)
- Idle / no-data: `--cream-hair`

Implementation unchanged: `repeating-linear-gradient(45deg, color 0 6px, transparent 6px 12px)`, 28–36px tall, axis caps in `--cream-dim`.

Use sparingly. v1 implied this strip on every card; v2 reserves it for surfaces where time-series uptime is the *primary* information (skill health page, agent run history).

## 11. Effects

The CRT character — scanlines, phosphor bloom, edge vignette — is **kept at v1 intensity**. It's the defining texture of the system, and dialing it down made the screen feel like a flat web page with retro colors. Only the expensive backdrop-filter overlay is dropped.

### 11.1 Phosphor halo (keep at full strength)

Per-glyph `text-shadow` in `currentColor`. Visible halo around every glyph and every bright border — this is what makes the screen feel lit instead of printed.

```css
:root {
  --bloom-near: 0 0 0.6px currentColor;
  --bloom-mid:  0 0 2.5px color-mix(in oklch, currentColor 55%, transparent);
  --bloom-far:  0 0 10px  color-mix(in oklch, currentColor 28%, transparent);
}
body, body * { text-shadow: var(--bloom-near), var(--bloom-mid), var(--bloom-far); }
```

Borders get the equivalent `box-shadow` but only on *bright* borders (full channel / status). Hairlines (`*-hair` tier) stay crisp without halo — they're structural, not lit.

### 11.2 Scanlines (keep)

Fixed full-screen `repeating-linear-gradient` (1px line every 2px), `mix-blend-mode: screen`, opacity **`0.10`**. Same as v1. Don't drop below 0.08 — at 0.05 the screen reads as "flat black with retro fonts" instead of "I am looking at a monitor."

### 11.3 Vignette (keep)

Radial darkening at corners, intensity **`0.22`**. Slightly punchier than v1's 0.20 — the warmer canvas can absorb a bit more edge falloff without going muddy in the center.

### 11.4 Bloom backdrop overlay (drop)

The expensive `backdrop-filter: blur + brightness; mix-blend: screen` overlay from v1 §14.1c is **removed**. Per-glyph halo carries the look; the overlay was 80% of the cost and 20% of the effect.

### 11.5 Slight chromatic aberration (optional, new)

Very subtle RGB fringe on hero text, gives the Warakami84 chrome-on-CRT feel.

```css
.hero-display {
  text-shadow:
    -0.5px 0 0 color-mix(in oklch, var(--coral) 70%, transparent),
     0.5px 0 0 color-mix(in oklch, var(--cyan)  70%, transparent),
    var(--bloom-near), var(--bloom-mid), var(--bloom-far);
}
```

Use on h1/display only. Never on body.

### 11.6 Reduced-motion / reduced-transparency

```css
@media (prefers-reduced-motion: reduce),
       (prefers-reduced-transparency: reduce) {
  body, body * { text-shadow: none; }
  .scanline-overlay, .vignette-overlay { display: none; }
}
```

## 12. Motion

Mechanical and minimal — same philosophy as v1.

- **Live timestamps**: on demand only (skill last-run, message timestamp). Update on data change, not on a tick.
- **Failure pulse**: `--error` icons pulse at 1Hz `steps(2)`. Operational and degraded states do not pulse.
- **Hover**: background fill flashes, no transform. 120ms `linear`.
- **Page transitions**: instant. No fade.
- **Loading**: stepped spinner (`animate-hud-tick`) or striped progress bar. Never a smooth iOS spinner.

## 13. Don'ts

- ❌ No rounded corners.
- ❌ No drop shadows for elevation. Only the phosphor halo.
- ❌ No gradients (the diagonal-hatch progress strip is a *pattern*).
- ❌ No glassmorphism, no backdrop-blur on overlays.
- ❌ No emoji. Strip them from user content where reasonable.
- ❌ No Material / Lucide / Heroicons. Pixelarticons only (+ filled status primitives).
- ❌ No sans-serif body. Mono is the body face.
- ❌ No light mode. Dark-only by design.
- ❌ No fake telemetry — no decorative "SYS // OK" stamps, no bogus coordinates, no clocks for atmosphere.
- ❌ No three+ channel colors on one screen. One channel + status = max.
- ❌ No skeuomorphic spinners. Stepped tick or striped bar.
- ❌ No avatar photos in circles. Use 2-character monospace initials in a square (channel-tinted).
- ❌ No ALL CAPS body text. Caps is for *labels and chips*, not paragraphs.

## 14. Token cheat-sheet (for `global.css`)

```css
:root {
  /* Canvas */
  --bg:           #0E0A07;
  --bg-elev:      #17110C;

  /* Neutral foreground (replaces v1's amber as default) */
  --cream:        #EFE4CF;
  --cream-dim:    #A8997C;
  --cream-hair:   #5C5440;

  /* Channel palette — five subway lines */
  --cyan:         #5BC8FF;
  --cyan-dim:     #3A8FB8;
  --cyan-hair:    #1B4257;

  --magenta:      #FF6FC8;
  --magenta-dim:  #B84A92;
  --magenta-hair: #5C2347;

  --coral:        #FF7A55;
  --coral-dim:    #B85439;
  --coral-hair:   #5C281B;

  --amber:        #FFC93B;
  --amber-dim:    #B8902A;
  --amber-hair:   #5C4515;

  --mint:         #6BE3A8;
  --mint-dim:     #4AA37A;
  --mint-hair:    #245040;

  /* Status (role-locked) */
  --success:      var(--mint);
  --warning:      var(--amber);
  --error:        #FF4D5A;
  --error-dim:    #B83540;
  --error-hair:   #5C1A20;

  /* Semantic roles */
  --background:   var(--bg);
  --surface:      var(--bg);
  --surface-2:    var(--bg-elev);
  --text-1:       var(--cream);
  --text-2:       var(--cream-dim);
  --text-3:       var(--cream-hair);
  --border:       var(--cream-hair);

  --radius:       0;
  --hairline:     1px;

  /* Phosphor bloom — visible halo on every glyph + bright border. */
  --bloom-near:   0 0 0.5px currentColor;
  --bloom-mid:    0 0 2px   color-mix(in oklch, currentColor 50%, transparent);
  --bloom-far:    0 0 8px   color-mix(in oklch, currentColor 22%, transparent);

  /* CRT knobs — dialed down slightly from v1. Don't drop scanlines below
     0.05 or the screen reads as "flat black with retro fonts" instead of
     "I am looking at a monitor." */
  --scanline-opacity:   0.07;
  --vignette-intensity: 0.17;

  /* The dominant CTA channel for the section. Routes can override locally
     via .channel-cyan / .channel-magenta / etc. to swap the section's hue;
     this also drives primary button fill, hairline rule under titles, focus
     rings, selectable-row backgrounds, and the channel top bar on panels. */
  --accent-1:     var(--cyan);
  --accent-1-fg:  var(--bg);

  /* Fonts */
  --font-mono:    "JetBrains Mono Variable", "JetBrains Mono", "Berkeley Mono",
                  ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  --font-display: "Bungee", "VT323", var(--font-mono);  /* hero only, optional */
}

html, body {
  background: var(--bg);
  color: var(--cream);
  font-family: var(--font-mono);
  font-feature-settings: "ss01", "zero", "calt";
}

* { border-radius: 0 !important; }
```

## 15. Migration notes (from Terminal-HUD v1)

Per-area moves, in suggested order:

1. **Tokens (`global.css`).** Swap palette to §14. Keep semantic-role names (`--text-1`, `--background`, `--border`) so call sites mostly keep working — they just point at cream/channel instead of amber. Add `.channel-cyan / .channel-magenta / .channel-coral / .channel-amber / .channel-mint` utilities that set `--accent-1` to the named hue.
2. **Default text color sweep.** Replace `border-amber` / `text-amber-as-chrome` with `border-cream-hair` / `text-cream` everywhere structural (sidebar dividers, modal headers, chat composer, list rows, form select borders). Keep amber only where it's literally an amber channel label (e.g. the skills section) — and even there, drive it via `var(--accent-1)` so it follows the channel, not a hardcoded hex.
3. **Drop the HUD theater.** Remove: the live ticking UTC clock in every `<PageHeader>`; the `SECURE` badge in `<SidebarBottomBar>`; the typewriter animation on page titles; the entire fake `ProcessLog` / `BackgroundReticle` / `CodenameBadges` / `SessionStrip` chrome from `/login`. Keep page title + hairline rule + a minimal `Dashboard // <Section>` eyebrow.
4. **Channel routing.** Pick channel-per-section assignments (§3). Add a `channel` prop to `PageShell` that wraps the page in the appropriate `channel-*` utility. Per-sidebar-item: each `SidebarItem` carries its own channel class so the active fill picks up the section hue without route-level coordination.
5. **Panels.** Update `hud-panel` to the §6.2 locked-in pattern (transparent surface + cream-hair sides + channel-color top bar + halo). Default top bar reads from `--accent-1`. Status variants override it (`hud-panel-op` → mint, `hud-panel-down` → red).
6. **Primitives.** Inputs: cream-hair rest border, `--accent-1` on focus. Buttons: `primary` variant fills with `--accent-1` so it follows channel routing; `secondary` outlined `--accent-1`; `default` outlined cream; `destructive` red. Selects: same chrome as input.
7. **Title casing.** Drop `text-transform: uppercase` from `hud-title` and `hud-display`. Pass titles as sentence case (`"Memory"`, `"Sign in"`). Labels, chips, button text stay uppercase via their own utilities.
6. **Iconography.** Add Pixelarticons (or chosen pixel set). Replace any inline SVG nav glyphs. Status icons (filled square/triangle/circle) stay.
7. **Casing pass.** Lowercase body and titles where they were ALL CAPS in v1. Keep caps on eyebrows, labels, chips, status words, button labels (still uppercase).
8. **Effects.** Keep scanlines (0.10), vignette (0.22), and full per-glyph phosphor halo — they're the CRT character of the system. Only the expensive backdrop-filter overlay is dropped.
9. **Buttons.** Reintroduce filled-primary variant for dominant CTAs. Remove "dashed amber" as the default primary; dashed is now reserved for "+ NEW" affordances only.
10. **Design check route.** Add channel-color swatches, panel-tint examples, mixed-case typography samples to `/design-check` so the new system is eyeballable end-to-end.

A reasonable PR sequence: tokens + default-text-color sweep (one PR — looks broken but reveals everything) → page chrome strip → channel routing → panel restyle → iconography → effects retune → per-route polish.

# Flyer Generator — Design & Constraints

> What the **🎨 Make a share image** button in `assets/js/lineup-maker-2000.js` produces, the design rules it inherits from the [IN YOUR FACE Design System](../inyourface_design_system), and — most importantly — **which decisions are fixed and which are free** so we can build new flyer styles without breaking the artifact or the brand.
>
> Source of truth for the brand: `inyourface_design_system/` (tokens + README + ISA).
> Source of truth for the flyer: `assets/js/lineup-maker-2000.js`, lines ~797–1392 ("Flyer Maker" section).
> Behaviour pinned by `assets/js/__tests__/` (`bun test`) — the pure layout helpers are unit-tested.

---

## 1. What the flyer is

A **client-side, zero-server PNG generator**. From the lineup the user has assembled in the Lineup Maker, it draws an on-brand show flyer onto a `<canvas>` and lets them download it as a PNG. Two Instagram-native formats:

| Format | Canvas | Ratio | Safe inset (top / bottom) | Date label | Bottom band |
|--------|--------|-------|---------------------------|------------|-------------|
| **Story** (default) | 1080 × 1920 | 9:16 | 250 / 320 | weekday only (`THU`) — it's ephemeral | left **empty** for the user's IG link sticker |
| **Post** | 1080 × 1350 | 4:5 | 70 / 70 | full date (`THU 4 JUN`) — it's archival | used by the layout |

The whole pipeline is `openFlyer()` → `drawFlyer()` (resolve lineup → load assets → `paintFlyer()`) → `downloadCanvas()`. A sibling button copies every on-flyer comedian's Instagram `@handle` for tagging.

**Why it matters for variants:** every new style is a different `paintFlyer()` (the compositor), drawing into the *same* `spec` (the canvas + safe insets) from the *same* `m` model (show, bg, logo, host, bill). The data contract and the canvas contract are the stable spine; the painting is the variable part.

---

## 2. The brand foundation it inherits

The design system is **logo-derived**: the palette is sampled from `assets/img/inyourface.png` (red ring, yellow face, black mic/outline, cream inner ring). The flyer is the most literal expression of the system's stated philosophy — *"comedy-poster energy, not blog energy… bold display type, tight letter-spacing, confident colour."*

### Palette (the only legitimate hues)

| Token | Hex | Role in the system | Where the flyer uses it |
|-------|-----|--------------------|--------------------------|
| `--brand-red` | `#E53935` | logo ring, CTA | date pill, host ring, headliner star badge |
| `--brand-red-deep` | `#B71C1C` | pressed/hover | — (available for variants) |
| `--brand-yellow` | `#FFD54F` | logo face | tagline, venue, placeholder initials, star glyph, HOST pill text |
| `--brand-yellow-hot` | `#FFB300` | "tonight" badge | — (available for variants) |
| `--brand-cream` | `#FFF3E0` | paper feel, on-dark text | date-pill text |
| `--surface-elev` | `#FFF8EE` | raised cards on light | polaroid paper, show title, host name |
| `--brand-ink` | `#0F0F10` | outline, body ink | caption ink, HOST pill fill, placeholder fill, scrim |

### Type — three faces, one role each

| Role | Family | `paintFlyer` constant | Used for |
|------|--------|------------------------|----------|
| Display | **Anton** (`400`, uppercase, condensed) | `FONT_DISPLAY = '"Anton", Impact, sans-serif'` | show title, placeholder initials |
| Body | **Inter** (`400–700`) | `FONT_BODY = '"Inter", system-ui, sans-serif'` | date pill, venue, "HOST" |
| Accent | **Permanent Marker** (handwritten) | `FONT_ACCENT = '"Permanent Marker", cursive'` | tagline, polaroid captions, host name |

All three load in a **single Google Fonts request** — the exact same URL the design system mandates — and the flyer waits on `document.fonts.load(...)` before drawing so glyphs never fall back mid-render.

### Other inherited primitives
- **Pill geometry** = `border-radius: 999px` (`--radius-pill`). The date pill and HOST pill are full-radius capsules, matching `.iyf-badge`.
- **8px spacing rhythm** — the flyer works in canvas pixels, not rem, but the gaps (16, 22, 40, 64) echo the 8px scale.
- **The ticket/CTA discipline** — the system's #1 rule is "the ticket button is the most important pixel." On the flyer the equivalent loudest pixel is the **show title + date pill**; red is reserved for the things that drive action.

---

## 3. Layout anatomy (the compositor, top → bottom)

`paintFlyer(ctx, spec, m)` paints in a fixed Z-order. Understanding these seven layers is the key to building a variant — a new style re-arranges or re-skins these, it doesn't invent a new data flow.

1. **Background** — the show's feature image, `drawCover`-fit to bleed the full canvas (fallback: solid `#10204a`).
2. **Brand overlays** — a vertical blue wash for cohesion + a bottom ink scrim for legibility behind text.
3. **Logo + tagline** — IYF logo centered at top inside the safe-top inset; *"English stand-up comedy"* in Permanent Marker below it.
4. **Faces zone** — the heart of the flyer:
   - **Host** (optional): a circular portrait with a red ring, a `HOST` pill straddling the bottom of the ring, and the host's first name beneath.
   - **Bill grid**: every other performer as a tilted **polaroid** (cream frame, photo, first-name caption). Headliners get a red **star badge**.
5. **Show title** — the show name in Anton, uppercase, auto-fit to ≤3 lines, drawn up from a baseline anchored above the safe bottom.
6. **Meta line** — a red **date pill** + the **venue** in yellow.
7. **Story only** — the bottom safe band is deliberately left empty for the user to drop an Instagram link sticker.

### The face-layout algorithm (the cleverest constraint)
- **Every performer is shown — there is no cap.** The grid *scales itself* to fit the band: it searches column counts and picks the one that makes the polaroids **as large as possible** while still fitting both dimensions (capped at 205px post / 230px story).
- **Priority drives prominence**, three ways at once:
  - sort by `priority` (`high → medium → low`),
  - `centerOut()` places the highest priority **dead-centre** and fans lower priority to the edges,
  - `faceScale()` sizes each polaroid by priority (`high 1.0`, `medium 0.82`, `low 0.70`).
- **Headliner** (`hasNorm(st.headliner, …)`) → red star badge on the polaroid.
- **Crowded bill** (>6 acts) → host ring shrinks to 80% and grid gaps tighten to free vertical room for the title.
- **Tilts** rotate through `[-4, 3, -3, 4, -2, 2]°` so the polaroids feel scattered-on-a-table, never gridded.

---

## 4. Constraint classification — the core of this report

Borrowing a first-principles split: **hard** constraints are physics/brand-immovable (a variant that breaks one is broken); **soft** constraints are conventions a variant *should* respect but *may* deviate from with intent; **assumptions** are current choices that look fixed but are actually free.

### 🔴 HARD — must hold for every variant

| # | Constraint | Why it's immovable |
|---|------------|--------------------|
| H1 | **Canvas stays untainted** — all image sources same-origin (or CORS-clean) | A tainted canvas makes `toBlob()`/`toDataURL()` throw → **no download**. This is the whole point of the artifact. |
| H2 | **Output is exactly 1080×1350 (post) or 1080×1920 (story)** | Instagram's native post/story dimensions. Wrong size = cropped or letterboxed when posted. |
| H3 | **Respect the safe insets** (story 250 top / 320 bottom) | IG's own UI (avatar/top bar, reply bar, link sticker) overlays these bands. Content there is covered. |
| H4 | **Only the brand palette** (red / yellow / cream / ink, + the blue background system) | The flyer *is* the brand in the wild. Off-palette colour reads as not-IYF. |
| H5 | **Only the three brand faces** (Anton / Inter / Permanent Marker), loaded before draw | Type *is* the poster energy. A render before fonts load ships a fallback flyer. |
| H6 | **Every booked performer appears** | A flyer that silently drops an act is a promise broken to that comedian. The grid scales instead of capping. |
| H7 | **Pure vanilla JS, no new runtime dependency** | The page ships no bundler/framework; the generator runs in the browser as-is. |
| H8 | **Never hang the render** — 6s per-image timeout, missing photo → initial-letter placeholder | A stuck remote image must degrade to a placeholder, never block the PNG. |
| H9 | **Legibility floor** — text over photography needs its scrim/shadow | Backgrounds are arbitrary show photos; the scrim+shadow is what keeps title/meta readable (and honours the system's documented AA/AAA contrast intent). |

### 🟡 SOFT — strong conventions; deviate only with intent

| # | Convention | Variant latitude |
|---|------------|------------------|
| S1 | Logo + tagline anchored top-centre | A variant could move/resize the lockup — as long as the logo is present and clear. |
| S2 | Title at the bottom, date pill + venue beneath it | Re-positionable; the *information* (title, date, venue) must remain, the *placement* is style. |
| S3 | Polaroid treatment (cream frame, tilt, caption) | The face-card *visual* is the most style-bearing element — a variant can reskin it entirely (ticket-stub, halftone, neon outline…) while keeping one card per act. |
| S4 | Host as a ringed circle with a HOST pill | Host emphasis is required; the *form* of that emphasis is open. |
| S5 | Priority → centre-out + size scaling | The "most important act is most prominent" rule should hold; the geometry that expresses it can change. |
| S6 | Blue wash + bottom ink scrim | The legibility mechanism (H9) is required; *this particular* wash is a style choice. |
| S7 | First-name-only captions, uppercase | Readable density choice; a variant could show full names if it has room. |

### 🟢 ASSUMPTIONS — look fixed, are actually free to vary

| # | Current choice | Reality |
|---|----------------|---------|
| A1 | Background is the **show feature image** | Could be a solid brand field, a pattern, a duotone of the photo, or a comedian collage. |
| A2 | Tilt set `[-4,3,-3,4,-2,2]` and the "scattered polaroids" metaphor | Entirely a style signature. A clean-grid or stacked-ticket variant is valid. |
| A3 | Solid `#10204a` background fallback + blue gradient wash | **Blue is not in the design-system palette** (see §5). A variant could drop blue for a cream or ink field and arguably be *more* on-brand. |
| A4 | `#FFF8EE` vs `#FFF3E0` for "cream" | The flyer mixes `--surface-elev` (`#FFF8EE`) for paper and `--brand-cream` (`#FFF3E0`) for pill text. Pick one per variant. |
| A5 | Star = headliner marker | Could be a banner, a "HEADLINER" pill (mirroring the HOST pill), a larger card, etc. |
| A6 | Two formats only | A 1:1 (1080×1080) feed-square variant is a plausible third spec. |

---

## 5. Where the flyer drifts from the design system

Worth ratifying or fixing *before* we fork new styles, so variants inherit a clean base:

- **Blue is not a brand token.** `#10204a` (bg fallback) and the `rgba(12,28,72…)` wash have no counterpart in `tokens/colors.scss` — the system is red/yellow/cream/ink only. It works (it cools busy show photos and unifies the set), but it's an undocumented brand extension. Decision for variants: **promote blue to a real token** (e.g. `--brand-blue`/`--flyer-wash`) or **drop it**.
- **Two creams in play** (`#FFF8EE` and `#FFF3E0`) — see A4.
- **Hardcoded hexes in JS.** The system's rule is *"no hex literal lives in a component partial — add a token first."* The flyer (being canvas, not CSS) hardcodes every colour. A variant system would benefit from a **shared `FLYER_TOKENS` object** in JS mirroring the SCSS tokens, so the canvas and the site can't drift.
- **No `--show-*` per-show theming.** The site supports per-show palettes (La Tarima yellow-on-brown, etc.) via `--show-*` overrides; the flyer ignores them and always paints brand-default. A high-value variant axis: **read the show's palette** so the flyer matches its show page.

---

## 6. The variant design surface — a checklist for new styles

When we build "different flyer styles for more variety," each new style is free to change everything in the **Style** column and must preserve everything in the **Contract** column.

**Contract (inherited, do not break):**
- canvas size + safe insets per format (H2, H3) — keep using `flyerSpec()`
- same-origin asset loading + untaint guarantee (H1, H8) — reuse `loadImg`/`drawCover`/`assetURL`
- the `m` model (show, bg, logo, host, bill with priority/headliner) — reuse `drawFlyer`'s resolution
- brand fonts loaded before draw (H5) — reuse `loadBrandFonts`
- every act shown (H6) and priority-respecting prominence (S5)
- brand palette + legibility floor (H4, H9)
- export + filename behaviour (`downloadCanvas`) and the `@handle` copy feature

**Style (free to reinvent per variant):**
- background treatment (A1, A3) — photo / solid / duotone / pattern / collage
- face-card visual (S3) — polaroid / ticket-stub / halftone / neon / clean grid
- layout geometry (S1, S2, S4) — where logo, title, faces, meta sit
- headliner marker (A5) and host emphasis form (S4)
- colour emphasis within the palette, optional `--show-*` theming (§5)
- tilt / scatter vs. order (A2)

**Suggested implementation shape:** factor the current `paintFlyer` into a **default style module** behind a `style` key on the model, so `drawFlyer(canvas, st, format, style, done)` can dispatch to `paintFlyer_polaroid` (current), `paintFlyer_ticketstub`, `paintFlyer_minimal`, etc. — all sharing the helpers in §"canvas primitives" and the `m` model. Add a style toggle next to the existing format toggle in `openFlyer()`.

---

## 7. Testing & verification constraints

- The **pure layout helpers** (`dayLabel`, `flyerDate`, `faceScale`, `flyerSpec`) are exported behind the CommonJS test seam (lines ~30–45) and covered by `bun test` (happy-dom). Any variant that adds pure helpers should export and test them the same way.
- `window.__iyfDrawFlyer` / `__iyfOpenFlyer` / `__iyfFlyerHandles` are exposed so a harness can render a flyer **headlessly** without walking the wizard — use this to screenshot-verify variants.
- The canvas carries `role="img"` + `aria-label` — keep that on any variant canvas.
- **Verify visually** before shipping: render each variant in both formats, at the real 1080-wide size, and check the safe bands are respected and text is legible over a *busy* show photo (the worst case).

---

## 8. One-paragraph summary

The IYF flyer generator is a dependency-free canvas PNG maker that turns an assembled lineup into an Instagram post or story, drawing a fixed seven-layer composition (background → overlays → logo → faces → title → meta) in the brand's logo-derived palette and three poster fonts. Its non-negotiables are mechanical and brand-level: native IG dimensions with safe insets, an untainted same-origin canvas so the download works, the brand palette and fonts, and the promise that *every booked act appears*, with priority driving size and centre-placement. Almost everything *visual* — background treatment, the polaroid face-card, layout geometry, headliner/host markers, tilt — is a style choice we're free to reinvent. The cleanest path to "more variety" is to factor the current composition into a swappable style module behind the existing data + canvas contract, promote the undocumented blue to a real token (or drop it), and optionally let variants read each show's `--show-*` palette so the flyer matches its show page.

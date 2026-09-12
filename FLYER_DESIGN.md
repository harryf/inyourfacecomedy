# Flyer Generator — Design & Constraints

> What the **🎨 Make a share image** button in `assets/js/lineup-maker-2000.js` produces, the design rules it inherits from the [IN YOUR FACE Design System](../inyourface_design_system), and — most importantly — **which decisions are fixed and which are free** so we can build new flyer styles without breaking the artifact or the brand.
>
> Source of truth for the brand: `inyourface_design_system/` (tokens + README + ISA).
> Source of truth for the flyer: `assets/js/lineup-maker-2000.js`, lines ~797–1392 ("Flyer Maker" section).
> Behaviour pinned by `assets/js/__tests__/` (`bun test`) — the pure layout helpers are unit-tested.

---

## 1. What the flyer is

A **client-side, zero-server PNG generator**. From the lineup the user has assembled in the Lineup Maker, it draws an on-brand show flyer onto a `<canvas>` and lets them download it as a PNG. Two Instagram-native formats:

| Format | Canvas | Ratio | Key-content area (requirement) | Legacy inset (top / bottom) | Date label | Bottom band |
|--------|--------|-------|--------------------------------|-----------------------------|------------|-------------|
| **Story** (default) | 1080 × 1920 | 9:16 | y 250 → 1580 (1080 × 1330), ~60 px side margins | 250 / 320 | weekday only (`THU`) — it's ephemeral | left **empty** for the user's IG link sticker |
| **Post** | 1080 × 1350 | 4:5 | central 1080 × 1080 (y 135 → 1215) fully safe; outer ~135 px top and bottom fine in feed, may be trimmed elsewhere; ~50 px side margins | 70 / 70 | full date (`THU 4 JUN`) — it's archival | used by the layout |

**Safe-area requirement (stored as `keyTop` / `keyBottom` / `keySide` on `flyerSpec()`, pinned by `bun test`):**

- **Story:** keep the first ~250 px clear (progress bar, profile name, close button) and the last ~340 px clear (reply bar, "Send message", sticker or link tap areas). Keep ~50 to 65 px free on each side: some devices crop slightly and stickers or link buttons sit near the edges. Key content lives in the 1080 × 1330 band from y = 250 to y = 1580.
- **Post (4:5):** treat the central 1080 × 1080 as fully safe. The outer ~135 px at the top and bottom are fine in the feed but may be trimmed elsewhere. Keep ~50 px side margins so nothing sits on the frame edge.
- `safeTop` / `safeBottom` are the **legacy** insets the polaroid painter (and the older alternates) were tuned against. They are deliberately unchanged so those layouts do not move. New styles position against the key-content fields.

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
| H3 | **Respect the key-content area** (story: y 250 → 1580, ~60 px sides; post: central 1080 × 1080, ~50 px sides; see §1) | IG's own UI (progress bar, profile name, close button, reply bar, "Send message", stickers, link buttons) overlays the bands outside it, and some devices crop the edges. Content there is covered or cut. |
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
| S7 | Short-name captions, uppercase: `firstName()` keeps the whole name when it is 8 characters or fewer (so "Dr Val" is not cut to "Dr"), otherwise the first word | Readable density choice; a variant could show full names if it has room. |

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

## 6b. Ticket style: paper palettes and the audience backdrop

The `ticket` painter (`paintTicketStub`) is a vintage admission stub standing inside the key-content area. Two things about it are algorithmic rather than styled by hand:

**Paper palette per show.** `ticketPalettes()` holds the paper sets: dark papers only, in the red (roll red, brick, wine), blue (roll blue, ink blue), charcoal and brown families, all with off-white print like a raffle roll or a railway stub. Cream and yellow papers are deliberately out. `ticketPalette(slug)` hashes the show slug and picks one, so the same show always prints on the same paper and a brand-new show gets a palette the moment it exists. No show names appear in the code. Each palette fills every role the ticket paints with (`paper`, `ink`, `accent`, `chip`, `chipText`, `host`, `hostText`), and `bun test` pins the rules for every palette: WCAG contrast ink on paper at least 4.5, accent on paper, chip text on chip and host text on host at least 3.0, and paper relative luminance under 0.25 (the "no cream, no yellow" rule as a number). Roll red is `#C43E33` rather than the swatch's `#D9463B` so off-white print clears 4.5. Adding a palette means adding an object to that list; the test tells you if it is unreadable or too light. A thin ink rule printed just inside the ticket edge separates a dark paper from the dark field. The small print on the stub comes from `stubLines()` (jokes, never warnings: "No refunds · none needed", "Tear here · laugh there" and so on), one picked per show and date by `stubLine(slug, iso)`, the same seeding the Lineup charge line uses.

**Audience backdrop.** Behind the ticket is an audience photo from the gallery, drawn monochrome under a heavy ink layer and a vignette so it never competes with the ticket. The pool is built in Liquid on `pages/lineup.md` from `_data/gallery.yml` (`type: audience`, at least 4 faces, aesthetic at least 0.45) into an `iyf-backdrops` JSON list, so it grows as photos are added. `pickBackdrop()` picks one at random on every render, so re-opening the flyer or switching format gives a fresh crowd (the paper stays per show; the crowd does not). If the list is empty or the image fails to load, the field is plain ink. The photos are the full gallery files (about 570 KB on average today); if phone load time becomes a problem, add a resize step rather than a hand-picked list.

## 6c. Style status (2026-09-11)

| Style | Positions against | Status |
|---|---|---|
| Polaroid (`classic`) | legacy `safeTop` / `safeBottom` | done, do not touch |
| Ticket | key-content area | done |
| Risograph | legacy insets | done; tagline on a cream label, venue in cream, captions and host name in cream with an ink offset so everything reads on the red duotone |
| Neon | legacy insets | left as is by choice |
| Bold Type | key-content area | done; faces in the shared `faceGrid` as ringed circles, slim photo band, bar on the key-content bottom |
| Lava Lamp (`lava`) | key-content area | done; Barbarella 1968: ink-to-red field, glowing blobs seeded per show by `lavaSeeds` and kept out of the text bands, space-helmet faces, dimensional yellow Anton title on an ink scrim, date and venue as a billing line (picker label Lava) |
| Swiss (`swiss`) | key-content area | done; International style without the flag: a near-white paper (`SWISS_PAPER`, a cool off-white, deliberately not the brand cream), Inter 700 flush left in ink, one red circle, square black-and-white photos with ink keylines, red labels, DATE and VENUE information block on 4px rules; a three-line title drops to two lines at a smaller size when that gives the faces room |
| Lineup (`lineup`) | key-content area | done; the tool's own joke: an almost-white booking-room wall lit from above (radial fall-off to soft grey at the borders reads as shadow) with ink height marks, mugshot frames with paper placards carrying the case number plus an act index, HOST placard in yellow, PRIME SUSPECT stamp on the headliner, title as the case name measured before the faces are laid out so it never lands on them, a charge line from `chargeLines()` picked per show, date and bill (act slugs sorted, so order does not matter); the strip says LINEUP only (no law-enforcement wording, which could trip platform moderation) and the picker uses a ruler emoji for the same reason |

**Numbers from the date.** `showCode(slug, iso)` takes the show date as YYMMDD and jumbles the six digits with a Fisher-Yates shuffle driven by a hash of show plus date, so the ticket serial (`Nº 021620`) and the lineup case number (`IYF 021620`) are really the date without reading as one, and every re-render of the same night gives the same number. `bun test` pins that the code is a permutation of the date, never the plain date in either order, and changes with show and date.

Legibility for these three is a unit test, not a screenshot: `newStylePairs()` lists every text/field pair they paint and `bun test` holds WCAG contrast at 4.5 for body and 3.0 for display via the exported `contrastRatio`.

## 6d. Closing notes (2026-09-12)

Eight styles ship: Polaroid, Ticket, Risograph, Neon, Bold Type, Lava, Swiss, Lineup. What held up across all of them, and what to keep doing when a ninth arrives:

- **One metaphor object per style, drawn big.** The ticket stub, the lava blob, the red circle, the height wall. If a style has no object that reads at thumbnail size, it is a colour scheme, not a style.
- **Position against the key-content area** (`keyTop` / `keyBottom` / `keySide`) and verify with pixel probes at the band edges in both formats. Polaroid alone keeps the legacy insets and is not to be touched.
- **Measure the title before laying out the faces.** Every late bug in this round was a fixed-height title block stealing room from the grid, or a fitter measuring at the wrong weight. Fit in the weight you draw.
- **Render the longest live titles and the biggest bill first** (The NERDY COMEDY Show, Gratis Comedy Zum Mitnehmen, twelve acts plus a guest), then check four acts does not look empty.
- **Fields are where taste diverges.** No orange cream as a whole-canvas fill; Swiss sits on a cool near-white, Lineup on a lit white wall. Offer two swatches before painting a whole style.
- **Anything random is seeded** by show slug, date and, where it matters, the bill (`ticketHash`), so a re-render is identical. The one exception is the ticket backdrop, random by request.
- **Legibility is a unit test.** `newStylePairs()` and `ticketPalettes()` are checked against WCAG floors by `bun test`; add a pair for every new text-on-field combination.
- **No law-enforcement wording** on the Lineup style, on the canvas or in the picker, so nothing trips platform moderation.
- **Captions** use `firstName()`: whole name at 8 characters or fewer, first word otherwise.

## 6e. Week Story (2026-09-12)

The `/week/` page reuses the flyer machinery for a list instead of a bill: every calendar event from a chosen day through the following seven days (eight days inclusive, so this Sunday and next Sunday are both in), one row or card per event, each carrying the show's own artwork (the post's `thumbnail`, else `image`, else `feature-img`, centre-cropped into a rounded square; every thumbnail on the site is square or 4:5). Harry asked for no host faces on this image: the hosts are reached through the copy-handles button instead. Four painters, chosen where the metaphor carries a list: Polaroid wall (`paintWeekPolaroid`, show name as the caption, a yellow day tag), Ticket strip (`paintWeekTicket`, one stub per show on the week's paper from `ticketPalette`, serial from `showCode`), Swiss timetable (`paintWeekSwiss`, day numerals, red rules, mono squares) and Bold Type stack (`paintWeekType`, giant weekday words, red CTA bar). Lava, Neon and Lineup were left out on purpose: a list has no blob, marquee or wall to stand on.

The headline comes from `weekHeadlines()`, picked by `weekCopy(from, v)`: deterministic for a given week and `v`, and the page rolls a random `v` on every load without one (Harry wanted a new title each time he opens the page), then writes it into the URL so a copied link re-opens the same words; "other words" bumps it. There is no call to action on the image (a first draft had one on the key-area floor with a chevron; Harry called it ugly): the link sticker added in Instagram is the call to action, and the rows simply stop above the sticker zone (`weekFloor`). Rows scale to the count (seven is the busiest real window so far); an empty window draws a friendly "no shows" image. Contrast pairs for the week styles live in `newStylePairs()` next to the flyer ones.

Three more week styles followed the same day (Harry: a funky lava list, a comic page with a frame per show, and one to blow his mind). **Lava list** (`paintWeekLava`): the Lava Lamp field, stars and blobs seeded from the window and kept out of the headline band, the headline in the three-layer dimensional type, then one row per event: the weekday and date on a wobbly hot blob (`blobPath`), the show name in cream and the time and venue in yellow on a smoked-glass pill (0.78 ink, so the text clears 4.5:1 even over the hottest blob), the artwork in a space helmet (`weekHelmet`). **Comic page** (`paintWeekComic`): newsprint with a coarse red dot screen (20 px pitch, so it survives Instagram's downscale without moiré), a yellow masthead in an ink frame with the headline as the issue title (ink face over a red offset) and the ISO week as the issue number (`weekIsoWeek`, pure), then `weekComicLayout(n)` (pure: a splash panel over the grid for odd counts, three across at most), each panel an ink-bordered frame with the artwork as the drawing, a yellow caption box top-left (day, date, time, venue) and a speech balloon bottom-right with the show name in Permanent Marker. **Departures board** (`paintWeekFlap`): a split-flap board, one tall tile per character (Anton, condensed, so 21 tiles across the key width still read at phone size), the split line across every tile, the headline in yellow tiles with a few tiles caught mid-flip (seeded; never inside a name, date or time, where a half-turned glyph would be wrong rather than charming), per event a cream name row (names over 20 tiles wrap at a word boundary via `flapLines`, so one long name does not shrink the whole board), a dim sub row that drops the venue rather than shrink below a legible tile, and the artwork on a split tile at the right; rows spread over the board when the width, not the height, capped the tiles. The advisor's checks that shaped this round: mid-flip tiles must not touch content, the board must abbreviate instead of shrinking, the four older styles were hash-compared before and after (byte-identical except Ticket, whose crowd backdrop is picked at random by design), and every new painter renders pixel-identically on repeat.

Round five, same night. **Station board** (`paintWeekStation`, `style=station`): the look of the Swiss station general display boards. The first draft was a blue field with a header band; Harry pointed at the reference graphic of the board and asked for the rectangle and its colour, so the painter now follows that graphic: a black surround, an indigo board rectangle (#2D3184) inside the key sides, a red notice banner on top with a white pictogram box and a bold lead-in (the headline) followed by the count and dates in regular weight, a light grey strip (#D6D6D6) with "Woche n" at the left where the clock sits and the labels Nach · Gleis · Hinweis in the board blue, then white rows: the weekday in a white type box, bold time, bold show name, "via venue" in regular weight (dropping to two lines when long), the date number as the Gleis, "15 Sept" as the Hinweis (Harry: no prices on the board), a red "Heute" or "Morgen" box for shows on the story day and the day after (the red box needed a purpose that was not a price), and the show's tagline (`showTagline`, the second title segment of the show page) in yellow under the row like the reference's alternative-route line, 1 px white separators. No artwork, because the reference has none. The split-flap board stays as its own style. **Comic, weighted** (`weekComicWeight`, pure): Comedy Brew carries +0.35 (Harry: always a bit bigger), Friday and Saturday shows +0.25 (people go out); within a row the panel widths follow the weights, across rows the heights follow the row's mean weight, the chronological order is kept; the balloon is one outline path now (an ellipse arc that leaves a gap for the tail, then the tail), rounder, with the marker lettering centred. **Chalkboard** (`paintWeekChalk`, `style=chalk`): a near-black board wall to wall with a vignette, seeded chalk dust and wiped smudges, a hand-drawn chalk frame inside the key area, the logo in mono, the headline in chalk yellow marker lettering with a wobbly underline, rows with the weekday and date in yellow chalk and the show name in white chalk (`chalkText`: three faint offset passes under one solid pass, then board-coloured specks over the strokes), time and venue in a plainer hand, chalk rules between rows; no artwork. **Menu** (`paintWeekMenu`, `style=menu`): a paper card with double ink rules on a deep red cover, the logo, a spaced red line with the city and dates, the headline as the menu title over a rule-diamond-rule ornament, one course heading per day (the full weekday, small spaced red caps between rules), items in Inter 800 with dotted leaders to the calendar price (`weekMenuPrice`: 0 prints FREE, blank prints nothing, else CHF n; the rows carry `price` from `#iyf-week-events` now), and "from 20:00 · venue" as the description; sizes scale up in a quiet week and down in a busy one; no artwork on the card, but the Ticket style's crowd backdrop sits behind the cover, multiplied into the red at 0.45 so it stays red (Harry's ask in round six). Both chalkboard and menu are typography on purpose: the show names carry the recognition.

Round eight: the calendar's Info lines. `/calendar/` prints one punchy line per show and date (assigned from the pools in `calendar-copy.json` by `refresh-calendar-page.rb`); Harry pointed out they sell the show. The pools file moved from `script/` to `_data/` so Jekyll can read it (the refresh script reads, writes and git-adds the new path, and check-site fails if anything still names the old one, so an edit to the pools stays consistent between the calendar and the story), `/week/` embeds the assigned lines as `#iyf-week-info`, and `weekInfoFor` gives each row its line. Where it is printed: the station board's yellow line (emoji stripped, the tagline as the fallback), the menu item's description, a smaller chalk hand on the chalkboard (emoji stripped), the ticket stub's small print, a third line under the venue in Bold Type and on the Lava pill, and a second yellow caption box, bottom left, on the comic's splash panels (narrow panels have no room next to the balloon). The split-flap board (tiles), the Swiss timetable (restraint) and the polaroids (caption is the name) stay as they were. The post caption lists the line under each show.

Round nine: information architecture. Harry: the Ticket was too noisy, the Info too small on Lava and Bold Type, the Station could carry the Info right under the show name, Swiss had none, the Menu's weight was wrong and its emoji had to go. The rule behind the fixes: a 1080 px story shows at about 390 pt on a phone, so 1 canvas px is 0.36 pt; names want 40 px and up, secondary lines 24 px and up, and the Info the same, which means a 64 character line (about 800 px at 24 px) must wrap to two lines rather than shrink to fit a 600 px column. `weekInfoLines` does that for every style (two lines at the start size, shrinking only when two lines will not hold it), and each list style centres a stack of name, time and venue, Info on its row with the Info at a fifth of the row per line. Ticket: the serial is gone, the name sits at the top of the stub, the time and venue under it, the Info under those. Bold Type: the day word drops to 0.62 of the row so the name column widens. Lava: the pill is 0.92 of the row. Swiss: name, then time (bold) and venue (grey) on one line, then the Info in regular ink, emoji stripped. Station: a pre-pass fits the name and via together down to 0.8 of the row size; when they still do not fit the via takes its own white line and the Info follows in yellow, and the whole board uses one line grid so the day boxes align; the Info is never dropped for the via (it was, on a seven-show week). Menu: the time and venue move onto the name line in grey (fitted to at most 55 percent of the line so a long venue cannot run into the price), the Info is the second line in regular ink at 28 px times the scale, emoji stripped, two lines only when the week is quiet; the scale settles over three measuring passes so the card fills to the floor. Chalk gets the two-line Info too. Emoji are stripped from the Info once, in the row model, so no style prints one (Harry: none on any flyer); the caption keeps them. Venues print their first two words on the image (`weekVenueShort`; the museum's full name was throwing the rows off); the caption keeps the full name. Swiss draws its rules between rows only (the last one fell 2 px under the key floor). Split-flap, polaroid and comic painters are untouched; the comic's splash caption and the split-flap's venue row change only through the shared row model (no emoji, two-word venues).

## 7. Testing & verification constraints

- The **pure layout helpers** (`dayLabel`, `flyerDate`, `faceScale`, `flyerSpec`) are exported behind the CommonJS test seam (lines ~30–45) and covered by `bun test` (happy-dom). Any variant that adds pure helpers should export and test them the same way.
- `window.__iyfDrawFlyer` / `__iyfOpenFlyer` / `__iyfFlyerHandles` are exposed so a harness can render a flyer **headlessly** without walking the wizard — use this to screenshot-verify variants.
- The canvas carries `role="img"` + `aria-label` — keep that on any variant canvas.
- **Verify visually** before shipping: render each variant in both formats, at the real 1080-wide size, and check the safe bands are respected and text is legible over a *busy* show photo (the worst case).

---

## 8. One-paragraph summary

The IYF flyer generator is a dependency-free canvas PNG maker that turns an assembled lineup into an Instagram post or story, drawing a fixed seven-layer composition (background → overlays → logo → faces → title → meta) in the brand's logo-derived palette and three poster fonts. Its non-negotiables are mechanical and brand-level: native IG dimensions with safe insets, an untainted same-origin canvas so the download works, the brand palette and fonts, and the promise that *every booked act appears*, with priority driving size and centre-placement. Almost everything *visual* — background treatment, the polaroid face-card, layout geometry, headliner/host markers, tilt — is a style choice we're free to reinvent. The cleanest path to "more variety" is to factor the current composition into a swappable style module behind the existing data + canvas contract, promote the undocumented blue to a real token (or drop it), and optionally let variants read each show's `--show-*` palette so the flyer matches its show page.

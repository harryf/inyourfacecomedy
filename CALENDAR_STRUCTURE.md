# Calendar Page Structure & Regeneration Guide

**File governed:** `pages/2_calendar.md` (published at `/calendar/`)
**Audience:** any human or LLM regenerating the monthly show calendar.
**Read this before you touch the calendar.** The redesign added CSS and JS that are tightly coupled to the *exact* markup below. The page looks like plain markdown, but it is a **contract**: column order, wrapper elements, heading markup, and the date strings are all read by code. Break the structure and you silently break the desktop table, the mobile card layout, and the "Jump to Next Show" button — the build still passes, so nobody notices until it's live.

> **Golden rule:** the CSS and JS read **position** and **string format**, never meaning. They do not care what a show is called. They care that the Date is column 1, that the Tickets link is the last column, and that a date cell reads exactly `May 5`. Keep the structure; the content is yours to write.

---

## 1. Who reads this page (the three consumers)

When you regenerate the calendar, three independent pieces of code consume your markup. Every structural rule in this guide exists to keep one of them working.

| Consumer | File | What it reads | Breaks if… |
|----------|------|---------------|------------|
| **Desktop table styling** | `_sass/components/_calendar-table.scss` | column **position** via `td:nth-child(1..4)` and `td:last-child` | columns reordered, added, or removed |
| **Mobile card transform** (< 768px) | same SCSS, `@media (max-width: 767px)` | same column positions, restacked as a card | same as above |
| **"Jump to Next Show"** | `assets/js/jump-to-next-show.js` | the **text** of each `.iyf-month-heading` and the **first cell** of every `tbody tr` | heading or date strings don't match its regexes |

A fourth consumer, the **JSON-LD structured data**, does **not** read this table at all — see §8. That decoupling is a known risk, also in §8.

---

## 2. Front matter (do not drop these keys)

The page's YAML front matter wires up the layout, the hero button, the SEO schema, and the permalink. Keep all of these:

```yaml
---
layout: page                 # provides the hero header + the Jump button slot (_layouts/page.liquid)
title: "Comedy in Zürich Tonight & This Week"
nav_title: Calendar
title_override: IN YOUR FACE Comedy Calendar
subtitle: Upcoming English Stand Up Comedy Shows in Zurich
description: "…"             # SEO meta description
last_modified_at: 2026-05-25T12:00:00+00:00   # BUMP THIS every regeneration
permalink: /calendar/        # the canonical URL — never change
feature-img: "assets/img/pages/follow.png"
image: "/assets/img/pages/follow.png"
thumbnail: "assets/img/thumbs/inyourface_thumb.png"
schema_type: ItemList        # activates the JSON-LD ItemList include (_includes/jsonld-itemlist.html)
hero_jump_button: true       # renders the "Jump to Next Show ↓" button in the hero
---
```

**Required, with reasons:**

- `layout: page` — `_layouts/page.liquid` renders the hero and, only when `hero_jump_button: true`, the `<a id="jump-to-next-show">` button. Without this layout there is no button to wire.
- `hero_jump_button: true` — without it the button element is never emitted, and `jump-to-next-show.js` finds nothing to wire (`getElementById('jump-to-next-show')` returns null and the script no-ops).
- `schema_type: ItemList` — `_includes/default/head.liquid` only includes the ItemList JSON-LD when this equals `ItemList`. Drop it and the page loses its event structured data.
- `permalink: /calendar/` — the live URL. Changing it breaks every inbound link and the nav.
- `last_modified_at` — **bump this to the regeneration date every time.** It feeds sitemap freshness signals.

---

## 3. The shape of the page

Top to bottom, the body is:

1. An `# H1` and a few intro paragraphs (plain markdown — content is yours).
2. **One block per month**, in chronological order. Each block is exactly:
   - a month **heading** (`<h2 class="iyf-month-heading">`),
   - a month **flavor** line (`<p class="iyf-month-flavor">`),
   - a **calendar table** wrapped in `<div class="iyf-calendar" markdown="1">`.
3. A `---` rule and a closing call-to-action paragraph.
4. The `jump-to-next-show.js` `<script>` tag (see §7).

Repeat the month block for as many months as you list (typically the current month plus the next two).

---

## 4. The month heading and flavor line — use RAW HTML, not markdown

```html
<h2 class="iyf-month-heading">May 2026</h2>
<p class="iyf-month-flavor">May the laughs be with you! Warmer weather, longer days, and comedians who've finally figured out their material.</p>
```

**Rules:**

- **Write the heading as raw `<h2 class="iyf-month-heading">`, NOT as `## May 2026`.** Markdown `##` emits a bare `<h2>` with no class, so it loses the yellow underline styling *and* — critically — `jump-to-next-show.js` selects headings with `document.querySelectorAll('.iyf-month-heading')`. A classless `<h2>` is invisible to the script, so the next-show button stops finding that month entirely.
- **The heading text must contain a month name and a 4-digit year**, e.g. `May 2026`, `September 2026`. The JS parses it with:
  `/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i`
  So `May 2026` and `December 2026` both work. A heading without a 4-digit year (e.g. just `May`) is skipped by the script — no rows under it can ever be the "next show".
- **The year in the heading is applied to every row beneath it.** The JS does not read a year from the row cells; it uses the heading's year. Therefore: never put rows from a different year under a heading. January 2027 shows get a `January 2027` heading, not a row tacked onto `December 2026`.
- The flavor `<p class="iyf-month-flavor">` is one short, fun sentence. It is styled (accent font, brand red) but **not** read by any script — content is entirely yours. Keep it to one line.

---

## 5. The calendar table — the core contract

Each month's shows go in a table wrapped exactly like this:

```html
<div class="iyf-calendar" markdown="1">

| Date | Day | Show | Info | Tickets |
|------|-----|------|------|---------|
| May 5 | Tue | [Jokes, Jokes, Jokes](https://inyourfacecomedy.ch/jokesjokesjokes/) | Local comics + Woocash hosting the chaos 🎤 | [Get Tickets](https://eventfrog.ch/…) |

</div>
```

### 5.1 The wrapper div — `markdown="1"` is mandatory

- The table **must** be inside `<div class="iyf-calendar" markdown="1">`.
- **`markdown="1"` is not optional.** Kramdown does not process markdown inside a raw HTML block by default. Without `markdown="1"`, your pipe table is emitted as literal text (`| May 5 | Tue | …`) instead of an HTML `<table>`. With it, kramdown parses the table into real `<thead>`/`<tbody>` that the CSS and JS expect.
- **Keep the blank lines** immediately after the opening `<div …>` and before the closing `</div>`. Kramdown needs the blank line to recognise the start of a table block.
- The `.iyf-calendar` class is the styling hook (`_calendar-table.scss`) **and** the JS selector (`jump-to-next-show.js` uses `.iyf-calendar`). One class, two consumers — do not rename it.

### 5.2 Exactly five columns, in this exact order

| # | Header | Content | Why the position is load-bearing |
|---|--------|---------|----------------------------------|
| 1 | `Date` | `May 5` (see §5.3) | `td:nth-child(1)` → red display font; **JS reads `row.cells[0]` to find the next show** |
| 2 | `Day` | `Tue` | `td:nth-child(2)` → muted; on mobile gets a `· ` prefix via CSS `::before` |
| 3 | `Show` | `[Name](url)` link | `td:nth-child(3) a` → display font, uppercased by CSS, red on hover |
| 4 | `Info` | one-line flavor + emoji | `td:nth-child(4)` → muted secondary text |
| 5 | `Tickets` | `[Get Tickets](url)` | `td:last-child a` → the red CTA button; CSS appends a `→` arrow |

**This order and count are fixed.** The CSS targets columns by position (`nth-child`), not by header name. If you:
- **reorder** columns → the wrong cell gets the date styling / the CTA button;
- **add** a column → `td:last-child` is no longer Tickets, so the ticket link loses its button and some other cell becomes one;
- **remove** a column → every `nth-child` after it shifts and the whole row mis-styles.

The header row (`| Date | Day | Show | Info | Tickets |`) and the separator row (`|------|…|`) are both required — that is how kramdown knows it's a table. The header text is for humans; on mobile the entire `<thead>` is visually hidden by CSS, so don't rely on it being seen, but **do** keep it present and correct.

### 5.3 The Date cell — exact format the JS demands

The Date cell (column 1) is parsed by `jump-to-next-show.js` with:

`/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})$/i`

It must be **a month name (abbreviated or full) + a space + a 1–2 digit day, and nothing else.**

| ✅ Valid | ❌ Invalid | Why invalid |
|----------|-----------|-------------|
| `May 5` | `May 5th` | trailing `th` fails the regex |
| `May 05` | `5 May` | day must come after the month |
| `Jun 12` | `2026-05-05` | not a month-name format |
| `January 9` | `May 5 (sold out)` | extra text after the day |
| `Dec 31` | `Tue May 5` | day-of-week belongs in column 2, not here |

If a date cell fails the regex, that row is skipped by the next-show finder. If *every* row fails, the "Jump to Next Show" button hides itself (`button.hidden = true`). The day-of-week (`Tue`, `Wed`, …) goes in **column 2**, never in the date cell.

### 5.4 Sort rows ascending by date

- **Rows must be in ascending date order**, both within a table and across month blocks (earlier months first).
- The next-show finder walks headings in document order, then rows in document order, and returns the **first** row whose date `>= today`. If rows are out of order, the highlight and scroll land on the wrong show.
- **Two shows on the same day** = two rows with the same date; that's fine. List them in any sensible order; the earlier row in the document wins as "next".

### 5.5 The Show cell (column 3)

- Format: a markdown link `[Show Name](https://inyourfacecomedy.ch/<show-slug>/)`.
- Link to the **show's own page** on this site (not the ticket vendor) — the ticket vendor link goes in column 5.
- Write the name in normal case. CSS uppercases it (`text-transform: uppercase`); don't SHOUT it yourself.

### 5.6 The Info cell (column 4)

- One short, punchy line describing the night, usually ending in a single emoji (e.g. `Spin the wheel on tonight's lineup 🎰`).
- Purely cosmetic — no code reads it. This is where your voice lives. Keep it to one line so the card stays tidy.

### 5.7 The Tickets cell (column 5) — let CSS draw the arrow

- Format: `[Get Tickets](<vendor-url>)`.
- Use the plain text **`Get Tickets`**. **Do not** add an arrow, emoji, or `→` yourself — the CSS adds the `→` via `td:last-child a::after { content: "\2192"; }`. If you type your own arrow you'll get two.
- The vendor URL is usually an `eventfrog.ch` link; some shows use `eventbrite.com`. Either is fine — it's just an `href`.
- This must be the **last** column so `td:last-child` styles it as the red CTA button.

---

## 6. The "next show" highlight (informational)

You don't author this, but understanding it prevents mistakes:

- On load, `jump-to-next-show.js` finds the first row with date `>= today` and sets `data-next-show="true"` on it. CSS then gives that row a yellow accent. Clicking the hero button smooth-scrolls to it and flashes it.
- This is why §4 (heading has a year) and §5.3–5.4 (parseable, ascending dates) matter: they are the inputs that let the script find the right row.
- You never write `data-next-show` yourself; the script sets it at runtime.

---

## 7. The closing script tag

Keep the script include at the very bottom of the page:

```liquid
<script src="{{ '/assets/js/jump-to-next-show.js' | relative_url }}" defer></script>
```

Without it, the hero button renders but does nothing. The hero button markup itself comes from the layout (§2, `hero_jump_button: true`) — you don't write the `<a>` in the page body.

---

## 8. The JSON-LD ItemList is decoupled — a divergence risk

The page also emits `ItemList` structured data for SEO (`schema_type: ItemList` → `_includes/jsonld-itemlist.html`). **This structured data is built from `_posts` (each show's post, whose `next_event_date` is refreshed daily from Eventfrog) — it does NOT read the visible table.**

Consequences to keep in mind:

- The **visible table** (what you hand-write here) and the **structured data** (auto-generated from posts) can drift apart. If you list a show in the table that has no corresponding `_posts` file with a future `next_event_date`, it appears to visitors but **not** in the structured data — and vice versa.
- Source of truth for dates is **Eventfrog**, surfaced through the posts. When in doubt about a real show date, the post / Eventfrog wins; the table should match it.
- You cannot fix structured-data gaps by editing this page. Those come from the posts and the `refresh-next-event-dates.rb` sync (see root `CLAUDE.md`).

---

## 9. Copy-paste skeleton for one month

```html
<h2 class="iyf-month-heading">MONTH YYYY</h2>
<p class="iyf-month-flavor">One fun sentence about the month.</p>

<div class="iyf-calendar" markdown="1">

| Date | Day | Show | Info | Tickets |
|------|-----|------|------|---------|
| Mon D | Ddd | [Show Name](https://inyourfacecomedy.ch/show-slug/) | One-line description with an emoji 🎤 | [Get Tickets](https://eventfrog.ch/…) |
| Mon D | Ddd | [Show Name](https://inyourfacecomedy.ch/show-slug/) | One-line description with an emoji 🎲 | [Get Tickets](https://eventfrog.ch/…) |

</div>
```

Replace `MONTH YYYY` (e.g. `June 2026`), and each row's `Mon D` (e.g. `Jun 3`), `Ddd` (e.g. `Wed`), name, link, blurb, and ticket URL. Keep the blank lines and the five-column shape exactly.

---

## 10. Pre-regeneration checklist

Run through this every time before you commit:

**Front matter**
- [ ] `layout: page`, `permalink: /calendar/`, `schema_type: ItemList`, `hero_jump_button: true` all present.
- [ ] `last_modified_at` bumped to today.

**Per month block**
- [ ] Heading is raw `<h2 class="iyf-month-heading">`, not `##`.
- [ ] Heading text contains a month name **and** a 4-digit year.
- [ ] A `<p class="iyf-month-flavor">` line follows the heading.
- [ ] The table is wrapped in `<div class="iyf-calendar" markdown="1">` with blank lines inside the div.

**Per table**
- [ ] Header row is exactly `| Date | Day | Show | Info | Tickets |` plus the `|---|` separator.
- [ ] Every row has exactly 5 cells in that order.
- [ ] Column 1 dates match `Mon D` / `Month D` (no `th`, no day-of-week, no extra text).
- [ ] Day-of-week is in column 2, not column 1.
- [ ] Rows are sorted ascending by date; month blocks are in chronological order.
- [ ] Show cell (col 3) links to the on-site show page; name in normal case.
- [ ] Tickets cell (col 5) is plain `[Get Tickets](url)` with **no** hand-typed arrow.
- [ ] Every row's heading-year is the correct year for that row.

**Page tail**
- [ ] The `jump-to-next-show.js` `<script>` tag is present at the bottom.

**Build**
- [ ] `bundle exec jekyll build --future` succeeds (shows are future-dated, so `--future` is required).
- [ ] `ruby script/check-site.rb --no-build` exits 0.
- [ ] Spot-check the rendered `/calendar/` page: desktop table styled, mobile cards stacked, "Jump to Next Show" scrolls to the correct upcoming show.

---

## 11. Validation rules (for the future static validator)

These are the machine-checkable invariants a Ruby validator enforces against the raw page. **Implemented** in `script/validate-calendar.rb` (stdlib-only, same idiom as `check-site.rb`):

```
ruby script/validate-calendar.rb            # validate pages/2_calendar.md (exit 0 = ok, 1 = error)
ruby script/validate-calendar.rb --quiet    # only show failures + summary
ruby script/validate-calendar.rb FILE.md    # validate another file
```

Rules 1–11 below are **errors** (exit 1); rule 12 is an **advisory warning** (never changes the exit code).

1. **Frontmatter keys present:** `layout == page`, `permalink == /calendar/`, `schema_type == ItemList`, `hero_jump_button == true`, `last_modified_at` parseable as a date.
2. **Each month heading** matches `<h2 class="iyf-month-heading">…</h2>` and its text matches `/\b(jan|feb|…|dec)[a-z]*\s+\d{4}\b/i`.
3. **Each heading is followed** (before the next heading) by at least one `<div class="iyf-calendar" markdown="1">`.
4. **Each `iyf-calendar` div** contains a markdown pipe table whose header row is exactly `Date | Day | Show | Info | Tickets`.
5. **`markdown="1"`** is present on every `iyf-calendar` div.
6. **Every data row** has exactly 5 pipe-separated cells.
7. **Column 1 of every row** matches `/^(jan|feb|…|dec)[a-z]*\s+\d{1,2}$/i`.
8. **Within each table**, row dates are strictly non-decreasing (ascending); across tables, headings are in ascending month/year order.
9. **Column 3** contains a markdown link.
10. **Column 5** contains a markdown link whose visible text is `Get Tickets` and contains no `→`/`→`/arrow emoji.
11. **The page body** ends with the `jump-to-next-show.js` `<script>` include.
12. **Cross-check (warning, not error):** every show row's date/show ideally corresponds to a `_posts` entry with a matching future `next_event_date` (see §8) — divergence is allowed but worth flagging.

A failure of rules 1–11 means the page is structurally broken and will mis-render or disable the jump button. Rule 12 is advisory.

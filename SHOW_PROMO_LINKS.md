# Show Promo Links — the `/comedians/` URL scheme

Share `https://inyourfacecomedy.ch/comedians/` with query parameters to turn the comedians
page into a **show lineup**, a **show promo**, or an **after-show thank-you** — all client-side,
all from one static page. Nothing is server-rendered: `assets/js/comedian-lineup.js` reads the
query string in the browser and reshapes the page.

Use it to:

- **Promote an upcoming show** — one link shows the show's hero (image, date, tickets) plus its bill.
- **Recap a lineup** — email attendees / post a link that lists exactly who was on.
- **Thank people after a show** — same hero, but the buttons switch to "follow us / leave a review".

---

## TL;DR

```
# Just a lineup (no show chrome):
/comedians/?lineup=woocash,joana,nik

# Structured bill:
/comedians/?host=harryf.cks&first=joana,nik&second=omar,zeina

# Promote a show (hero with image + date + tickets) and feature a headliner:
/comedians/?show=brexiles&headliner=woocash&first=joana,nik&second=omar

# After the show — thank attendees, send them to follow/review + more shows:
/comedians/?show=brexiles&thankyou&headliner=woocash&first=joana,nik&second=omar
```

---

## How it works (and why it's spam-safe)

The page embeds a small JSON catalog of **existing IYF shows** at build time (every post that
has a `ticket_url`). The script can only ever resolve `?show=` against that catalog — title,
description, next date, ticket link, show page and feature image all come from our own curated
site data. **A crafted link can never point the hero at an arbitrary external site.** An unknown
`?show=` slug simply shows no hero change.

Slug matching is **case- and separator-insensitive**: `pulp-non-fiction`, `pulpnonfiction` and
`PulpNonFiction` all resolve to the same show; `harryf-cks` matches `harryf.cks`.

With **no parameters**, the page is left exactly as it is: the full roster in the usual random
priority order, normal "Comedians" hero, no banner.

---

## Parameters

| Param | Example | What it does |
|-------|---------|--------------|
| `show` | `show=brexiles` | Turns the page's top hero into that show's hero — feature image, dim scrim, `Wed · 17 Jun` date, split title, **Get Tickets** + **About this show**. Sourced only from the show catalog. |
| `headliner` | `headliner=woocash` (or `=woocash,joana`) | Features the comedian(s) first, in a larger centred grid. One or more (co-headliners). |
| `lineup` | `lineup=woocash,joana,nik` | A flat, ordered subset of comedians. No section label on its own. |
| `host` | `host=harryf.cks` | Labelled section "Host" (or "Hosts"). |
| `first` | `first=joana,nik` | Labelled section "First Half", in appearance order. |
| `second` | `second=omar,zeina` | Labelled section "Second Half", in appearance order. |
| `thankyou` | `thankyou` (or `thankyou=1`) | **After-show mode** (pair with `show=`). Same hero styling; swaps the lead-in copy and the two buttons (see below). On when present unless the value is `0`/`false`/`no`/`off`. |

You can combine `headliner` with either the flat `lineup` or the structured `host`/`first`/`second`.
A comedian listed in two places is placed once (first mention wins). Comedians whose slugs don't
match any card are skipped (logged to the console). When any lineup param is present, comedians
**not** named are dropped from the page; with `show=` alone (no lineup), the full roster stays.

---

## Finding slugs

**Show slugs** are the show's page path. Open the show on the site — the slug is the bit between
the slashes:

| Show | Slug |
|------|------|
| Brexiles | `brexiles` |
| Down Under Comedy | `downunder` |
| Pulp Non-Fiction | `pulpnonfiction` |
| Comedy Brew | `comedybrew` |
| Jackpot Comedy | `jackpotcomedy` |
| La Tarima | `latarima` |
| Jokes, Jokes, Jokes | `jokesjokesjokes` |
| Random Facts Exchange | `randomfactsexchange` |

**Comedian slugs** are the last path segment of a comedian's page (e.g.
`/comedians/woocash/` → `woocash`). They're also the `data-slug` attribute on each card in the
page source. Examples in the wild: `woocash`, `joana`, `nik`, `omar`, `harryf.cks`,
`martinadoescomedy`, `adonis`.

---

## The three modes

### 1. Lineup recap — `?lineup=` / `?host=&first=&second=`

No show chrome; the normal "Comedians" hero stays. The page narrows to just the named comedians,
in the order/sections you give. Good for "here's who was on tonight" without promoting a date.

```
/comedians/?host=harryf.cks&first=joana,nik&second=omar,zeina
```

### 2. Show promo — `?show=`

The top hero becomes the show's hero (identical to the show's own page): feature image behind a
dim scrim, a short `Wed · 17 Jun` date, the show title (split on `•` / ` - `), a one-line
subtitle, a big **Get Tickets** button (in the show's colour) and an **About this show** link.
Add lineup params to show the bill underneath, lead by a **"Who's on the show?"** heading.

```
/comedians/?show=brexiles&headliner=woocash&first=joana,nik&second=omar
```

> Tickets/date come from the show catalog and the cron-refreshed `next_event_date`. A past date
> is hidden automatically, so an old link never advertises a show that already happened.

### 3. After-show thank-you — `?show=…&thankyou`

For emailing attendees *after* the show. **The hero styling is unchanged** — same image, scrim,
date, title. Two things switch:

- **Lead-in copy** changes from "Who's on the show?" to **"Go give your favourites a follow"**.
- **The buttons** change:
  - Button 1 (`btn-ticket btn-ticket--xl`) becomes **"Follow us & drop a review"** and **scrolls
    the page down to the footer** (`#footer`), where the follow links and review info live —
    it does *not* leave the site.
  - Button 2 (`btn-ghost btn-ghost--on-dark`) becomes **"More Shows"** → the homepage (`/`).

```
/comedians/?show=brexiles&thankyou&headliner=woocash&first=joana,nik&second=omar
```

---

## Notes & gotchas

- **Email-safe:** these are ordinary query-string links (not `#` fragments), so they survive
  email link-rewriters and are visible to analytics.
- **Unknown show** → no hero change (and a console warning). **Unknown comedian** → that name is
  skipped (console warning).
- **`thankyou` needs a `show`** to do anything visible — the buttons live in the show hero.
- **Editing the copy:** the lead-in text and button labels are plain strings near the top of
  `assets/js/comedian-lineup.js` (search for `Go give your favourites a follow`,
  `Follow us & drop a review`, `More Shows`). Change them there and rebuild.
- **Where the data comes from:** the show catalog is generated in `pages/7_comedians.md` from
  every post with a `ticket_url`; the feature image is each post's `feature-img`.

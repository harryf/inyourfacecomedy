# Campaign links: the /go/ redirector and /linkbuilder/

Implementation plan for tracking where ticket traffic comes from, given that Eventfrog's free
plan has no conversion tracking. Internal dev doc, in the `_config.yml` exclude list like the
others. Status: plan for review, nothing built yet.

## The problem, honestly stated

We promote shows (Meta ads, Instagram, Mailchimp, Guidle, ...) with links that point straight
at Eventfrog. Our Google Analytics never sees those clicks, so we cannot tell which channel
drives ticket-page traffic. We cannot see purchases either (Eventfrog free plan), and that
stays true with this plan: what we gain is attributed click-throughs per campaign, source and
show, which is enough to compare channels and spend. Reconciling purchases against Eventfrog's
sales report by timing is a separate shelved idea, noted at the end under future work.

The fix is a link layer we own: campaign links point at `/go/` on our domain, GA records the
visit with its UTM tags, then the visitor is passed straight through to the right Eventfrog
page. One extra hop, ~300ms, full attribution.

## Part 1: the /go/ redirector

### URL contract

```
https://inyourfacecomedy.ch/go/?show=comedybrew&utm_source=meta&utm_medium=paid_social&utm_campaign=comedybrew-202609
https://inyourfacecomedy.ch/go/?show=jackpotcomedy&date=2026-09-16&utm_source=mailchimp&utm_medium=email&utm_campaign=jackpot-sep
```

- `show` (required): the show slug, the same slugs the promo-link scheme already uses
  (`comedybrew`, `jackpotcomedy`, ...). Resolves to the show's series-level `ticket_url` from
  its post front matter (for series shows on Eventfrog this is the group page listing all dates).
- `date` (optional, `YYYY-MM-DD`): picks the individual Eventfrog event page for that specific
  date, resolved from `_data/calendar.yml` (the cron-refreshed, Eventfrog-derived list of every
  upcoming instance, which already carries each date's own `ticket_url`). A past date skips the
  exact-match branch entirely and falls through to the series link, so an expired campaign link
  never dumps anyone on a dead Eventfrog event page.
- `utm_*`: passed by the campaign link, read by GA, not interpreted by our code.

Slug matching reuses the case- and separator-insensitive normalization from
`assets/js/comedian-lineup.js`, so `ComedyBrew` and `comedy-brew` both resolve.

### Where the data comes from

The page embeds two small JSON catalogs at build time, exactly the pattern
`pages/2_comedians.md` and `pages/lineup.md` already use (see `SHOW_PROMO_LINKS.md`):

1. **Shows**: every post with a `ticket_url` (slug, name, series `ticket_url`, on-site page URL,
   `event_type`).
2. **Dates**: `site.data.calendar.events` (show slug, date, that date's individual `ticket_url`).

No fetches at runtime, no server, nothing to deploy beyond the static build.

### Why it cannot be abused for malicious SEO redirection

The classic abuse is an open redirect: `?url=https://evil.example` on a trusted domain. This
design makes that impossible by construction, the same way the promo-link scheme already does:

- **The query string never contains a destination.** Only a slug and a date. The script looks
  those up in the embedded catalog; every reachable destination is a `ticket_url` we curated
  in our own repo, or a page on our own site. There is no code path from query input to an
  arbitrary URL.
- **Unknown slug**: redirect to our own 404 page, carrying the evidence (see "broken links
  surface in GA" below). Unknown or past `date` on a valid show: fall back to the show's series
  `ticket_url`, and if the show has none, to the show's own page. The distinction is deliberate:
  a stale date link is expected churn and degrades gracefully; an unknown show slug means a
  campaign link is genuinely broken and should make noise, not silently land on the calendar.
- **No crawl value to hijack**: `/go/` gets `noindex,nofollow` meta robots, `sitemap: false`,
  and a `robots.txt` disallow, the exact treatment `/lineup/` already has. Search engines never
  index it, so there is no ranking juice for anyone to launder through it.
- **Tests pin this.** The bun test suite (see below) asserts that every resolvable destination
  is either an `eventfrog.ch`/`eventbrite.com` URL from the catalog or a same-origin path, for
  arbitrary hostile query strings.

### Capturing the UTM tags in GA

GA4 needs no special code to read UTMs: the gtag snippet in `_includes/default/head.liquid`
fires a `page_view` for `/go/` and GA automatically attributes the session to the
`utm_source/medium/campaign` in the URL. On top of that the script sends one explicit event
before leaving, so reports can slice clicks by show:

```js
gtag('event', 'ticket_redirect', {
  show: slug, date: date || '(series)', destination: target,
  event_callback: go, event_timeout: 400
});
setTimeout(go, 450);            // ad blocker / gtag-missing fallback, whichever fires first
// go() = window.location.replace(target)
```

The redirect must never depend on GA succeeding: with gtag blocked or absent, the timeout
fires and the visitor still gets their tickets. The page body shows "Taking you to tickets
for {show}..." with the resolved link rendered as a normal anchor (so a slow or broken script
still leaves a clickable way through), and a `<noscript>` block linking to `/calendar/`.

**The speed budget, explicitly.** Two clocks are racing: GA needs the hit out before we
navigate away, and the visitor came for tickets, not for our interstitial. The plan:

- `/go/` is a near-empty page (no feature image, no fonts beyond system fallback, catalog JSON
  inline), so first paint is effectively instant; the cost is one HTML round trip.
- The gtag library is already async in `<head>` and typically cached; the redirect script runs
  immediately (inline or `defer` at end of body), it does not wait for `window.load`.
- The `page_view` and `ticket_redirect` hits are dispatched right away; gtag uses
  `navigator.sendBeacon` where available, which survives navigation, so the redirect does not
  actually need to wait for the network. In the normal (cached gtag) case `event_callback`
  fires within tens of milliseconds; 400ms is chosen to cover roughly the p90 of a gtag
  dispatch on a mediocre 4G connection, and even the worst case reads as an ordinary page
  transition, not a stall.
- Worth knowing: even if the custom event or its dimensions are never set up, the `page_view`
  on `/go/` already carries `?show=` in `page_location`, so show-level reporting survives on
  page data alone.
- If real-world GA data shows undercounting, the knob is that one timeout constant; if it
  shows annoyance, lower it. One number, documented in the script.

**Broken links surface in GA.** An unknown `show` slug redirects to
`/404.html?from=go&show=<slug>` with the original UTM parameters preserved. That makes a broken
campaign link visible and attributable in GA: a `page_view` on the 404 page, tagged with the
campaign and source that carried the bad link, plus the offending slug in the URL. The site's
404 page already exists (`404.md`) and carries the GA snippet like every page. Manual step
below: a GA4 custom insight that emails you when 404 views with `from=go` exceed zero, so a
typo'd link in a running ad gets caught in days, not at the post-campaign review.

In GA this yields: sessions on `/go/` sliced by campaign/source/medium, plus the
`ticket_redirect` event with a `show` parameter. Manual step for later: register `show` as a
custom dimension and optionally mark `ticket_redirect` as a key event in the GA4 admin UI.

### One real gotcha: Google Ads does not like this page

Google Ads policy ("destination mismatch") disapproves ads whose final URL lands on one domain
and redirects the visitor to another. `inyourfacecomedy.ch/go/` -> `eventfrog.ch` is exactly
that. Meta is tolerant of tracking redirects in practice, and organic/email/referral channels
have no such police. Recommendation:

- **Meta, Instagram, Facebook, Mailchimp, Guidle, Meetup, Reddit, TikTok, Telegram**: use `/go/` links.
- **Google Ads**: point ads at the show's own page on our site with **no manual UTMs at all**:
  the Ads/GA4 link auto-tags via gclid, and hand-written `utm_source=google&utm_medium=cpc`
  would override and degrade that auto-tagging. The visitor clicks Get Tickets there.
  The link builder should say this when someone picks Google Ads as the source.

**Related, for organic social**: pasting a `/go/` link into an Instagram, Facebook or Telegram
post gets its link preview scraped from `/go/` itself, so every show would get the same generic
card. Two mitigations: give `/go/` a decent static OG image (the IYF brand card), and when a
rich show-artwork preview matters, use the show page with UTMs instead and let the tracked
ticket button do the rest. Paid ads are unaffected (creative is uploaded separately).

## Part 2: the /linkbuilder/ tool

A phone-first static page in the Lineup Maker mould: no login, no saving, everything
client-side. Hidden from search and nav exactly like `/lineup/` (noindex, sitemap exclude,
robots.txt, no nav entry): it is an organizer tool, not a visitor page.

**The primary use case is one-handed on an iPhone**, mid-flow: you are posting a story on
Instagram, you flip to `/linkbuilder/`, tap the show, tap the source, copy, flip back. That
drives the layout:

- Big tap targets throughout (show cards, source chips), everything in one vertical column,
  no dropdowns that need precision.
- **The built link lives in a sticky bar at the bottom of the screen** with the copy button,
  always visible and always current: every tap above updates it instantly, so the flow is
  tap-tap-copy, not scroll-to-the-end.
- Sensible defaults everywhere (medium from source, campaign auto-suggested), so zero typing
  is needed for the common case; free-text fields are there when you want them.
- The same single-column layout centred with a max width works fine on a laptop; nothing is
  desktop-only or hover-dependent.

### The flow

1. **Pick the show.** All shows from the embedded catalog (every post with a `ticket_url`),
   shown as tappable cards with name and next date.
2. **Pick the target.** For `event_type: series` / `monthly` shows, a choice: **whole series**
   (evergreen link, right for always-on campaigns) or **a specific date** from the upcoming
   dates in `calendar.yml` (right for a single-show push; the builder warns that date links
   go stale after the show and fall back to the series page). One-off shows skip this step.
3. **Pick the source.** Tappable chips for the ten current channels: `meta`, `google-ads`,
   `instagram`, `facebook`, `guidle`, `meetup`, `reddit`, `mailchimp`, `tiktok`, `telegram`,
   plus a free-text field for anything new. Values are normalized to lowercase.
   Picking `google-ads` shows the note from Part 1 and builds a direct show-page link
   (with UTMs) instead of a `/go/` link.
4. **Medium and campaign.** `utm_medium` is pre-filled from the source (table below), editable.
   `utm_campaign` is pre-filled with `{show}-{yyyymm}` (or `{show}-{yyyymmdd}` for date links),
   editable. An optional `utm_content` field for ad-variant labelling.
5. **Copy.** The built link in a read-only box with a copy button, plus a one-line preview of
   where it will redirect ("-> Eventfrog: Jackpot Comedy, Sep 16"), resolved from the same
   catalog so what you see is what the visitor gets.

### Default utm_medium per source

| Source | Default medium |
|--------|----------------|
| meta | paid_social |
| google-ads | (none: direct show-page link, gclid auto-tagging) |
| instagram, facebook, tiktok, telegram, reddit | social |
| mailchimp | email |
| guidle, meetup | referral |
| free text | social (editable) |

The medium values are GA4's own recognized tokens (`paid_social`, `social`, `email`,
`referral`, `cpc`), so links land in the right default channel group instead of "Unassigned".
The builder lowercases and slugifies every utm value on output: GA4 never normalizes case, so
`Meta` and `meta` would be separate report rows forever. These defaults are the convention;
the builder is the enforcement: if links only ever come from the builder, the taxonomy stays
clean.

### Example output

Picking Jackpot Comedy, date Sep 16, source meta:

```
https://inyourfacecomedy.ch/go/?show=jackpotcomedy&date=2026-09-16&utm_source=meta&utm_medium=paid_social&utm_campaign=jackpotcomedy-20260916
```

## Implementation

New files, all following existing patterns:

| File | What |
|------|------|
| `pages/go.md` | `/go/` page: front matter (noindex, `sitemap: false`), embedded catalogs via Liquid, minimal visible body, loads the script |
| `pages/linkbuilder.md` | `/linkbuilder/` page: same catalogs plus the sources list, form markup |
| `assets/js/go-redirect.js` | Lookup, GA event, redirect with fallback chain |
| `assets/js/link-builder.js` | The builder UI and URL assembly |
| `assets/js/__tests__/go-redirect.test.js` | Pins: catalog-only resolution, hostile query strings, fallback chain, allowlisted destination hosts |
| `assets/js/__tests__/link-builder.test.js` | Pins: URL assembly, medium defaults, normalization, google-ads special case |

Plus three edits: `robots.txt` (disallow `/go/` and `/linkbuilder/`), and a `check-site.rb`
addition asserting both pages build with noindex and stay out of `sitemap.xml`.

Styling reuses the design system as vendored in `_sass/`: `.btn-ticket` for copy, `.btn-ghost`
for secondary actions, the chip pattern from `.iyf-follow-chips`, form styling as per
`/lineup/`. No new components, no design-system repo changes.

### Order of work

1. Branch. Build `/go/` + tests first (it is the part with security surface).
2. `bun test`, `bundle exec jekyll build --future`, `ruby script/check-site.rb --no-build`.
3. Build `/linkbuilder/` + tests.
4. Verify in a real browser: build a link in the builder, open it, watch GA Realtime show the
   session with the right source/medium/campaign, confirm arrival on the right Eventfrog page.
5. PR, Netlify draft check, merge.

## Manual steps for you

1. Review this plan: especially the UTM medium defaults, the campaign naming convention, and
   the Google Ads carve-out. These are conventions and taste, everything else is mechanics.
2. After it ships: build one real link per active channel and swap it into the running
   campaigns (Meta ad final URLs, Instagram bio/stories, Mailchimp templates, Guidle and
   Meetup listings, Telegram pins).
3. In GA4 admin: register `show` (and optionally `destination`) as event-scoped custom
   dimensions; optionally mark `ticket_redirect` as a key event. Do this early: registration
   is not retroactive, only data from that point forward gets the breakdown, and it takes a
   day or two to populate. Verify events with DebugView (needs `debug_mode`) rather than
   waiting on reports. Then create a custom insight (Reports > Insights) with the condition
   "page_view where page location contains `from=go`" and email alerting on, so a broken
   campaign link notifies you instead of waiting to be noticed.
4. After the first campaign cycle: check Reports > Acquisition > Traffic acquisition filtered
   to the `/go/` landing page, and the `ticket_redirect` event by `show`.

### Considered and rejected

- **Netlify `_redirects` rules** instead of a JS page: no GA capture at all (the visitor never
  loads a page of ours), the rules do not exist on the GitHub Pages build so the two hosts
  would diverge, and the catalog would need a second generation path. Rejected.
- **A third-party short-link service** (bit.ly etc.): another account, another tracker, no
  catalog safety, and the domain in the link stops being ours. Rejected.

### Accepted noise

Link unfurlers (WhatsApp, Slack, iMessage previews, corporate mail scanners) will hit `/go/`
with the UTMs attached and register as sessions. This inflates click counts slightly and
uniformly across channels; GA's bot filtering catches some of it. Known, accepted, not a bug.

## Future work (shelved)

- **Purchase reconciliation**: export Eventfrog's sales report and correlate purchase
  timestamps with `ticket_redirect` event times in GA to estimate per-campaign conversion.
  Parked by decision, revisit once click data exists.
- **QR codes** in the builder for at-venue posters (source `qr`).
- If Eventfrog ever offers tracking on our plan, append the UTMs to the outbound Eventfrog
  URL too; today that is deliberately not done to keep their URLs untouched. If it is ever
  done, merge with `URL`/`URLSearchParams`, never string concatenation: Eventfrog URLs can
  already carry a query string.

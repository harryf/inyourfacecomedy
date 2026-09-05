# Google Analytics: how the property is set up and why

The GA4 property for inyourfacecomedy.ch, what the site sends it, what is configured on it,
and the reports built on top. Internal dev doc, excluded from the build. Campaign links and
the click tracker have their own doc (`CAMPAIGN_LINKS.md`); this one is the property.

| Thing | Value |
|---|---|
| Account | IN YOUR FACE Comedy, `accounts/245191583` |
| Property | inyourfacecomedy.ch, `properties/336856557`, timezone Europe/Zurich, currency CHF |
| Web stream | `G-JZBDD4CQWV` (`_config.yml` `google_analytics`), loaded by gtag in `_includes/default/head.liquid` and inline on `/go/` |
| Login | inyourfacecomedych@gmail.com (`?authuser=2` in the GA URL when several Google accounts are signed in) |
| API access | Service account `ga-reports@inyourface-ga-mcp.iam.gserviceaccount.com`, key in `ga-reports-sa.json` (gitignored), path in `.env` `GA_REPORTS_CREDENTIALS`. Editor on the property since 2026-09-05 (it writes config and annotations; it cannot manage users) |
| Scripts | `script/ga-report.ts` (reads, daily cron), `script/ga-setup.ts` (property config as code), `script/ga-annotations.ts` (show dates as annotations) |

## What to expect in the first days (read before judging the reports)

- **Nothing here is retroactive.** The dimensions `venue`, `show_date`, `days_to_show` and
  the metric `price_chf` exist from 2026-09-05, and the `show` dimension on page views
  from the first deploy after that date. Earlier rows show (not set). Key-event status is
  not retroactive either, so the Channels report shows zero key events for periods before
  2026-09-05. The custom channel group is the one thing that is retroactive.
- **Reports fill in over 24 to 48 hours.** GA processes a day up to two days later; the
  Realtime views are the only immediate check.
- **Your own visits.** Open any page once with `?notrack=1` on each of your phones and
  browsers; that browser then stays out of GA (a `localStorage` flag read by the gate in
  `head.liquid` and `/go/`). `?notrack=0` switches it back on. On a site this size the
  promoter refreshing his own show pages is the single largest distortion.
- **Clicks are not sales.** The ticket-click curve is a proxy; the lag and conversion rate
  between a click and an Eventfrog purchase are unknown. A mismatch with the sales export
  is a finding about behaviour, not a tracking bug.
- **Small Swiss towns may be hidden.** With Google Signals on, low-volume rows get
  thresholded. Reporting identity is set to Device-based (Admin > Reporting identity) to
  avoid that; if it ever flips back to Blended, the Where from report will hide rows.

## The questions it is built to answer

1. **Where do visitors come from?** Country, then Swiss region and city.
2. **Which promo channel works?** Meta ads, Instagram, Facebook, Mailchimp, Guidle and the
   sites Guidle syndicates to (MySwitzerland, hellozurich), Meetup, Reddit, Google Business,
   search, AI assistants, each on its own line.
3. **How much attention is each upcoming show getting?** Show-page views, ticket clicks (site
   buttons and campaign links), and how far ahead of the show they happen.

The Eventfrog sales export shaped the design: 4361 tickets across 2039 buyers, 40% bought
on the day of the show and another 15% the day before, Thursday dominates because Comedy
Brew does, and 52% of buyers have a Zürich `80xx` postcode with Winterthur a distant second.
GA cannot see purchases (Eventfrog free plan), so the closest proxies are ticket clicks by
`days_to_show`, which uses the same buckets as the export's "Purchase Days Before" column,
and show-page views by city.

## What every page sends

`_includes/ga-page-context.liquid` runs inline in `<head>` before the theme's deferred
`main.min.js` calls `gtag('config')`, and queues a `gtag('set', {...})` on `dataLayer`, so the
`page_view` and every later event on the page carry:

| Field | Values | Registered as |
|---|---|---|
| `content_group` | `home`, `show` (a post with `ticket_url`), `post`, `comedian`, `tool` (report layout or `noindex` pages), `page`, and `go` on `/go/` | built-in Content group dimension |
| `show` | show slug (show pages and `/go/`) | custom dimension Show |
| `venue` | `venue_slug` from front matter (`_data/venues.yml` key) | custom dimension Venue |
| `show_date` | `next_event_date` as YYYY-MM-DD | custom dimension Show date |
| `days_to_show` | `00`, `01`, `02-03`, `04-07`, `08-14`, `15-30`, `31+`, `past`, `(unknown)`, computed in the browser at view or click time (zero-padded because GA sorts dimension values as strings; never rename, values are permanent history) | custom dimension Days to show |
| `price_chf` | `price_chf` from front matter | custom metric Ticket price CHF |

The show-context fields are only set on show pages. GA's own `value` and `currency` pair
is sent only by the two ticket events (a page-level set would stamp a value on every
scroll and engagement event as well); there it feeds Key event value. `ticket_click` (site buttons, from
`data-venue` / `data-date` / `data-price` on `.btn-ticket`) and `ticket_redirect` (`/go/`,
from the catalogs in `_includes/go-catalogs.liquid`) carry the same six fields, so "ticket
clicks by venue" and "clicks by days to show" work across both.

**GA only runs on the live host.** `head.liquid` and `_layouts/go.html` skip `gtag('config')`
unless `location.hostname` ends in `inyourfacecomedy.ch`, so `jekyll serve`, Netlify deploy
previews and the GitHub Pages shadow build no longer show up as `localhost:4000`,
`*.pages.dev` or `*.netlify.app` sessions. The GTM snippet still loads everywhere (see the
GTM note below).

## Property configuration (script/ga-setup.ts)

`bun script/ga-setup.ts --dry-run` prints the diff between the property and the desired
state declared in the script; without the flag it applies it. It creates and patches, never
deletes or archives, so it is safe to re-run. It needs the service account to hold the
Editor role on the property.

| Setting | Desired | Why |
|---|---|---|
| Event data retention | 14 months | GA's default is 2 months, which makes Explorations and any user-level analysis forget everything older than 60 days. Standard reports are not affected either way. Changed 2026-09-05 (was 2 months). |
| Key events | `ticket_click`, `ticket_redirect` | The two intent signals we have. Both count once per event, both carry `value` (the ticket price), so "key event value" by channel is potential revenue. Pre-existing: `purchase` (never fires, harmless) and `manual_event_PAGE_VIEW` (created 2026-08-24 by the Google Ads link; pollutes the key-events total with page views; delete it in the UI if you agree) |
| Custom dimensions (event scope) | `show`, `link`, `venue`, `show_date`, `days_to_show` | See the table above. `show` and `link` existed already (2026-08-27 and 2026-08-30). Custom dimensions are not retroactive: data before the day a dimension is created shows as (not set) |
| Custom metric (event scope) | `price_chf`, unit CURRENCY | Average and total ticket price of what people looked at and clicked |
| Custom channel group | "IN YOUR FACE channels" | GA's default channel group puts Guidle, hellozurich, MySwitzerland, Meetup and Eventfrog all under Referral and Instagram under two or three headings. The custom group has one rule per channel as we run it (Meta ads, Instagram, Facebook, Guidle syndication, Meetup, Eventfrog, Google Business, Reddit, Email, AI assistants, Search, Other social, Direct); everything else falls into Other. Pick it as the primary dimension in Acquisition reports or the Channels report in the collection below |

Sources are lower-cased by `/linkbuilder/`, so the rules match on `contains`. If a new
channel appears, add a rule to `CHANNEL_RULES` in the script and re-run it.

## Show dates on every chart (script/ga-annotations.ts)

`bun script/ga-annotations.ts` reads `_data/calendar.yml` and creates one annotation per
upcoming show date ("Comedy Brew @ ROBIN's"), so the timeline in every report marks show
nights and a traffic spike can be read against the show that caused it. Idempotent on
title + date, so a rescheduled show gets a new annotation and the old one stays (delete
it by hand in Admin > Annotations if it bothers you). The endpoint is Admin API v1alpha
and may move. Proposed cron line in `script/README.md` (not installed by default).

## The report collection

Report collections live in the GA Library (Reports > Library, admin or editor only) and have
no API, so they are built in the UI. The property has one custom collection, **IN YOUR
FACE**, published to the left nav and therefore also visible in the GA mobile app (the app
shows the property's report collections; Explorations are web only):

| Topic | Report | Built from |
|---|---|---|
| Shows | Shows | dimension Show, metrics Views, Event count for `ticket_click` and `ticket_redirect`, Key events, Key event value; filter `content_group` = show |
| Shows | Days to show | dimension Days to show, metric Event count, filter event name in (`ticket_click`, `ticket_redirect`) |
| Where from | Countries | dimension Country, metrics Sessions, Views, Key events |
| Where from | Swiss cities | dimension City, filter Country = Switzerland, metrics Sessions, Views, Key events |
| Channels | Channels | dimension IN YOUR FACE channels (session scope), metrics Sessions, Engaged sessions, Key events, Key event value |
| Channels | Landing pages | dimension Landing page, metrics Sessions, Key events |

**Assembling and publishing the collection (UI only, and the Publish step is the one
everyone misses):** Reports > Library > Collections > IN YOUR FACE (or Create new
collection > Blank), Create new topic, drag the four saved reports from the right-hand
list into the topic (Shows, Days to show, Where from, Channels), Save, then the three-dot
menu on the collection card > Publish. An unpublished collection is invisible in the left
nav and in the app, with no error anywhere. The Channels report is built on the default
channel group; once `ga-setup.ts` has created "IN YOUR FACE channels", edit the report and
swap the second dimension for it (custom channel groups apply retroactively).

Two things about the numbers in these reports: `Ticket price CHF` is summed by default,
so its total next to view counts is meaningless (use it per event, or as an average), and
`value` on ticket events feeds Key event value but never Total revenue, which stays zero.
If the Google Ads link ever imports `ticket_click` or `ticket_redirect` as conversions,
that CHF value becomes a conversion value for a click, not a sale; leave those key events
out of the Ads import.

Realtime already answers "who is looking right now" by page title and country; with the
`show` dimension on page views, Realtime > Event count > page_view can be broken down by
show, which is the show-night check.

## Data-quality caveats

- **`/go/` inflates sessions and sinks engagement rate.** Every campaign click is a one-page
  session that bounces by design. Read Meta's 678 sessions / 29 engaged (90 days to
  2026-09-05) as clicks delivered, not as disinterest. Filter on `content_group` = `go` to
  separate them, or use the Shows report which counts the redirect as a ticket event.
- **Bots and odd geography.** Singapore (248 sessions, 248 users, zero engagement in the same
  90 days) and a cluster of small Swiss towns with unusually high session counts (Bulle,
  Fiesch, Lyss, Langenthal) look like crawler or carrier-NAT traffic, not comedy fans. GA's
  own bot filtering is all there is; compare Swiss cities against the postcode distribution
  in the sales export before believing them.
- **Custom dimensions start on the day they are registered.** `venue`, `show_date`,
  `days_to_show` and `price_chf` exist from 2026-09-05; earlier events show (not set).
- **Two measurement IDs are loaded.** The theme loads gtag for `G-JZBDD4CQWV` (this
  property) and also the GTM container `GTM-M7Z9D4Z` (`_config.yml` `google_tagmanager`),
  which contains a Google tag for `G-11R98M8LKC`, a Meta pixel, a Google Ads conversion tag
  and a "Ticket Link" event on link clicks. `G-11R98M8LKC` belongs to no property the service
  account can see, so half of the tracking goes somewhere this doc cannot audit. The
  container does not configure `G-JZBDD4CQWV` (checked 2026-09-05), so this property gets
  exactly one `page_view` per load. Decide in Tag Manager whether that tag should point at
  this property or be removed; nothing here touches GTM.
- **The theme keeps the queue.** `main.min.js` does `window.dataLayer = window.dataLayer
  || []`, so the `set` pushed from `<head>` survives until gtag drains the queue in order.
  If the theme is ever updated, re-check that line: a bare `dataLayer = []` would silently
  drop every page-level field while the tests still pass.
- **`google_analytics_ga4` is unset** in `_config.yml`; the theme's second `gtag('config',
  '')` call is a no-op. Leave it empty.
- **Untagged ad clicks** show as `meta / untagged` in `/reports/` and as Direct in GA. Always
  build campaign links in `/linkbuilder/`.

## After every deploy that touches tracking

`dataLayer` containing the object proves the page pushed it, not that GA received it. In
Chrome DevTools > Network, filter `collect`, load a show page and check the `page_view`
request carries `ep.content_group`, `ep.show`, `ep.venue`, `ep.show_date`,
`ep.days_to_show` and `epn.price_chf`; then open `/go/?show=comedybrew&debug=1` and
check the `ticket_redirect` request carries the same plus `ep.link`, `epn.value` and
`ep.currency`. One `page_view` per load to `G-JZBDD4CQWV`, not two. DebugView (Admin >
DebugView, needs `debug_mode`) shows the same thing with names instead of `ep.` keys.

## Things not to do

- Do not archive `show` or `link`: `script/ga-report.ts` queries them by name.
- Do not rename event parameters without updating `ga-setup.ts`, the templates, the tests,
  and this doc together; GA keys everything on the parameter name.
- Do not create a second collection for the same questions; the property allows seven and
  each one is another thing to keep in sync.

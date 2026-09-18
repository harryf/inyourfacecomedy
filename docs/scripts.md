# Script reference

What each script in `script/` does in detail: behaviour, flags, files written, design notes. For the
overview (what needs installing, the full inventory, the daily schedule, cron and launchd lines,
Healthchecks) read `automation.md` first; this file is the depth behind it.

Conventions shared by all of them: one runnable file per script, `--dry-run` wherever a script
writes, secrets from `.env` at the repo root (each script loads it itself), logs under
`script/*.log` (gitignored). Ruby scripts are stdlib only; TypeScript scripts run under bun and may
share a helper in `script/lib/`.

## `add-event.rb`

The one command that turns an Eventfrog link into a live-ready show. Everything else in this directory *maintains* shows that already exist; this is the only script that *creates* one.

```bash
ruby script/add-event.rb https://eventfrog.ch/de/p/.../my-show-1234567890.html \
  --host martinadoescomedy --host harryf.cks \
  --feature-img ~/Desktop/flyer-wide.png \
  --image       ~/Desktop/flyer-1200x630.png \
  --thumbnail   ~/Desktop/flyer-square.png

ruby script/add-event.rb URL --dry-run --verbose    # preview the whole post, write nothing
ruby script/add-event.rb --help
```

### The three images are three different jobs

Same split as the Decap CMS fields in `admin/config.yml`. Pass any subset; each flag is optional.

| Flag | Front matter | Where it shows up | Size |
|---|---|---|---|
| `--feature-img` | `feature-img` | Hero banner across the top of the show page, and the Event JSON-LD `image[]` Google uses for rich results | ~1920x1005 |
| `--image` | `image` | `og:image` / `twitter:image`: the picture in the Twitter/X, Slack and Facebook link card | 1200x630 min |
| `--thumbnail` | `thumbnail` | Square share image (WhatsApp and friends) | ~1080x1080 |

Files are copied into `assets/img/uploads/` (thumbnails into `assets/img/thumbs/`) under lowercase, permalink-derived names, because the live Linux build is case-sensitive and macOS is not. Pass no `--feature-img` and the script downloads Eventfrog's own flyer instead, so a page is never bannerless; `--image` then falls back to the hero rather than silently inheriting the site-wide default card.

### What it changes

1. **`_posts/<date>-<slug>.md`**: the only non-derived artifact. A show *is* a post with a `ticket_url`; the homepage, sitemap, `/comedians/` chips and health check all build themselves from that fact.
2. **`assets/img/…`**: the images above.
3. **`_data/calendar.yml`, `_data/calendar_past.yml`, `_data/venues.yml`**: by running `refresh-calendar-data.rb`. The post already exists by then, so the extractor treats the new show like any other and appends an unseen venue on its own. That is why this script has no venue logic of its own.
4. **The new post again**: `next_event_date`, `next_event_end_date`, `venue_slug`, `venue` and `price_chf` are back-filled *from* `_data/calendar.yml`, using the same precedence as `refresh-next-event-dates.rb`. The new show is therefore correct for exactly the same reason every existing show is correct.
5. **`pages/1_calendar.md`**: by running `refresh-calendar-page.rb --no-refresh --no-push`. That page is materialized markdown, not a live query over `calendar.yml`, so it has to be regenerated.
6. **`index.html` `last_modified_at`**: so the sitemap `<lastmod>` for `/` advances. The homepage *listing* needs no edit: `_layouts/home.liquid` recomputes it from `site.posts` on every build.

### What it deliberately does not do

- **No git.** No add, no commit, no push. You rewrite the description in the house voice (`writing-guide.md`) and commit yourself. The script prints the exact `git add` line for the files it touched.
- **No IndexNow, no Healthchecks.io ping.** Those belong to cron. The child `refresh-calendar-page.rb` is spawned with `HEALTHCHECKS_URL` cleared so an interactive run can never report a fake green to the monitor.
- **No writes to `_comedians/*.md`.** That collection comes from Grist via `sync-comedians.rb`. A `--host` slug that doesn't match a `slug:` under `_comedians/` is reported with near-miss suggestions and left out of the post: an unresolvable slug renders nothing in the host grid and silently drops a `Person` from the Event JSON-LD, which is worse than a loud warning.
- **No Google Business Profile post.** `post-events-to-google.rb` owns that, and only for ROBIN's shows.

### After it runs

Two things are worth doing by hand:

- **Rewrite the body.** It is Eventfrog's copy dropped in verbatim, which is why nothing is pushed. Check `description:` too (that is the SEO meta description, ~160 characters).
- **Fill the calendar copy pool**, or the show gets the generic fallback teaser on `/calendar/`:
  ```bash
  ruby script/refresh-calendar-page.rb --init --only <permalink> --no-push
  ```

Optionally give the show its own palette with a `.show-banner[data-show="<permalink>"]` block in `_sass/components/_show-override.scss`.

### Notes

- Group/series URLs and single-event URLs both work. A group page carries no JSON-LD at all (it renders its instance table client-side), so the script walks it to the individual event pages the same way `refresh-calendar-data.rb` does. More than one upcoming instance sets `event_type: series` and lists the next six dates in the body.
- Existing permalink → refuses, so you can never clobber a live show. `--force` overrides, `--permalink` picks a different URL.
- Every input is validated before the first write, so a failed run leaves no half-made show behind.
- Helpers borrowed from the sibling scripts are copied with a comment naming the source, matching this directory's deliberate one-runnable-file-per-script convention rather than introducing a shared lib.

## `check-site.rb`

One command that asserts the invariants keeping the site working as it grows. Sources of truth are **derived** (shows = `_posts/*.md` with a `ticket_url`; comedians = `_comedians/*.md`), so adding a show or comedian needs no edit here.

```bash
ruby script/check-site.rb              # build the site, then run all checks
ruby script/check-site.rb --no-build   # check the existing _site/ as-is (fast)
ruby script/check-site.rb --no-proofer # skip the html-proofer link/image pass
```

Exit `0` = all checks passed; exit `1` = at least one failure (each is printed with a reason). It wires up `html-proofer` (already in the Gemfile) for internal-link + image integrity, ignoring third-party analytics/tracking endpoints. Wired into `.github/workflows/jekyll-build.yml` so every push/PR fails fast on a regression.

**Covers:** build is clean · every show + comedian + core page built · sitemap lists the right URLs and excludes `noindex` pages · GA/GTM/Clarity/Pixel tags present · Event JSON-LD valid with `startDate`/`offers`/`location` · `/comedians/` promo + Lineup Maker 2000 catalogs are valid JSON · scripts pass `ruby -c` · no past-dated active show · canonical/OG present · no money page accidentally `noindex` · no site-wide `Disallow: /`.

## `refresh-next-event-dates.rb`

The 09:00 job. It no longer scrapes Eventfrog itself: `refresh-calendar-data.rb` is the one
extractor, and this script derives each show's next date from what that wrote, so the home page,
the show pages and `/calendar/` can never disagree.

1. Spawns `refresh-calendar-data.rb` (with `RbConfig.ruby`, the same interpreter) to regenerate
   `_data/calendar.yml`, `calendar_past.yml` and `venues.yml`.
2. For each post with an Eventfrog `ticket_url`, takes the earliest upcoming event for that
   permalink from `calendar.yml` and writes `next_event_date`, `next_event_end_date`,
   `venue_slug` and `price_chf` into the front matter, leaving everything else byte for
   byte. The venue is per event, so a show that moves around (La Tarima, Random Facts) gets the
   right one. `last_modified_at` only moves when something else did.
3. Bumps `last_modified_at` on `index.html` when any show rolled, so the sitemap's `<lastmod>`
   for `/` advances.
4. Discards a `calendar.yml` or `calendar_past.yml` whose only change is the `generated_at` stamp
   (no daily no-op deploys), stages `_posts`, `index.html` and the three data files, commits,
   pushes (one `pull --rebase` retry on a rejected push), then pings IndexNow for the changed pages.

Skips, each logged with its reason: no front matter, no `ticket_url`, not an Eventfrog URL, no
upcoming event in `calendar.yml`, unchanged.

```
ruby script/refresh-next-event-dates.rb
ruby script/refresh-next-event-dates.rb --dry-run --verbose    # [would-write] lines, nothing written or pushed
```

Exit 0 with or without updates; exit 1 when the extractor or git failed. Because step 4 stages
`_posts` wholesale, a half-edited post left in the tree is committed and deployed by the next run:
never leave uncommitted edits there.

### Failure notification and schedule

Pings the shared `HEALTHCHECKS_URL` check: success at the end, `/fail` with the reason on a parse
error, a git failure or a crash. Runs daily at 09:00 from cron. Setup of the check, the alert
routing and the cron line: `automation.md`.

## `refresh-calendar-data.rb`

Builds `_data/calendar.yml` (every upcoming instance of every show), `_data/calendar_past.yml` and
appends unseen venues to `_data/venues.yml`. For each post with an Eventfrog `ticket_url` it
resolves the URL, collects the individual event pages behind a group page, and parses each page's
Event JSON-LD (start, end, status, location, first CHF price). Eventfrog's group page is a
client-rendered SPA; the individual event pages are still server-rendered, which is why the walk goes
through them. Cancelled and past events are dropped; ticket URLs that no longer resolve are listed
under `unresolved:` instead of vanishing. Non-Eventfrog ticket URLs are skipped on purpose.

```
ruby script/refresh-calendar-data.rb [--dry-run] [--verbose | --quiet]
```

No git, no ping of its own: the 09:00 job (`refresh-next-event-dates.rb`) spawns it and commits the
result.

## `refresh-calendar-page.rb`

Regenerates the month blocks of `pages/1_calendar.md` from `_data/calendar.yml`. The markup is a
contract (`calendar-structure.md`), and the run validates its own output with
`validate-calendar.rb` before it commits. The Info line per show date and the flavour sentence per
month come from pre-generated pools in `_data/calendar-copy.json`: each date gets a line assigned
once and keeps it, so a weekly show reads differently every week without an LLM call per run.

```
ruby script/refresh-calendar-page.rb --no-refresh            # the cron form: reuse today's calendar.yml
ruby script/refresh-calendar-page.rb --dry-run --verbose
ruby script/refresh-calendar-page.rb --no-push               # write, do not commit
ruby script/refresh-calendar-page.rb --init [--only <permalink>] --no-push   # grow the copy pools
```

`--init` calls the `claude` CLI (`CLAUDE_BIN`, `CALENDAR_CLAUDE_MODEL`, `CALENDAR_POOL_SIZE`,
`CALENDAR_MONTH_VARIANTS` override the defaults), so it cannot run inside a Claude Code session.
The weekend cron run never calls an LLM. Commits and pushes only when the page changed; pings
`HEALTHCHECKS_URL`.

## `validate-calendar.rb`

Structural validator for `pages/1_calendar.md` against the rules in `calendar-structure.md`
section 11: rules 1 to 11 are errors, rule 12 is a warning. Stdlib only.

```
ruby script/validate-calendar.rb [path/to/file.md] [--no-color] [--quiet]
```

Exit 0 means no errors. `check-site.rb` and `refresh-calendar-page.rb` both run it.

## `sync-comedians.rb`

Grist to `_comedians/`. A row that is Live, has a Slug and has a photo becomes
`_comedians/<slug>.md` plus a photo resized with `sips` until it is under 95 KB; only whitelisted
public fields are written (phone and email never are). A comedian who is no longer Live, is gone
from the table or lost their photo has the page and the photo deleted. Incremental: a fingerprint
per slug in `script/comedians-state.json` means a quiet run is one API call. Commits, pushes and
pings IndexNow for changed pages; pings `HEALTHCHECKS_URL`.

```
ruby script/sync-comedians.rb [--dry-run] [--no-commit] [--verbose]
```

Needs `GRIST_API_KEY` (environment or `.env`). Never hand-edit `_comedians/`: change Grist, run
the sync. The full SEO story is in `comedian-seo.md`.

## `post-events-to-google.rb` and `probe-gbp-v4.rb`

Keeps the Google Business Profile listing in step: one EVENT post per ROBIN's show in the next seven
days (`GBP_WINDOW_DAYS`), built from the post plus the description in `gbp/<slug>.txt`. Google
shows the newest-posted first, so the listing is managed as a stack: when anything is off, the whole
stack is created first (furthest show first, next show last), then the old posts are retired. A
listing that is already right is a no-op. Only EVENT posts with a call-to-action link on our domain
and a slug we manage are ever deleted. A post Google rejects is quarantined and alerted once;
editing its txt releases it on the next run. Rules for the descriptions: `CLAUDE.md`, "Google
Business Profile". API, OAuth and moderation background: `google-business-profile-api-setup.md`.

```
ruby script/post-events-to-google.rb [--dry-run] [--verbose]
ruby script/post-events-to-google.rb --authorize      # one-time OAuth consent, writes gbp-token.json
ruby script/probe-gbp-v4.rb                           # read-only: is the v4 API alive for this project?
```

Needs `client_secret_*.json` and `gbp-token.json` at the repo root (gitignored). A brand-new
ROBIN's show has no txt yet: the job drafts one through the local llama-server (`GBP_LLM_URL`,
default `http://127.0.0.1:8080`, the `com.pmai.llama-server` LaunchAgent) and does not commit it;
read it, then commit it yourself. State lives in gitignored `gbp/gbp-state.json`; never hand-edit
it. Pings `GBP_HEALTHCHECKS_URL` when set, else `HEALTHCHECKS_URL`. No git.

## `ga-report.ts`

Daily per-show ticket-click reports from Google Analytics 4 into `/reports/<slug>/` (design:
`campaign-links.md`, "Show reports"; property: `analytics.md`). Writes `_data/reports/<slug>.json`,
`assets/reports/<slug>.csv` and the stub `pages/reports/<slug>.md`, stages exactly those paths,
commits and pushes. Shared logic and its tests: `script/lib/ga-report-lib.ts`.

```
bun script/ga-report.ts [--dry-run] [--no-push] [--show comedybrew] [--quiet]
```

Reads GA with the service-account key named by `GA_REPORTS_CREDENTIALS` (the cron path, never
expires; Viewer role is enough) or, by hand, gcloud Application Default Credentials. Pings
`GA_REPORTS_HEALTHCHECKS_URL`; a new broken `/go/` link seen in GA is sent as `/fail` so it alerts.

## `gsc-report.ts`

The Search Console worksheet: which queries show one of our pages just off page one, and
what that page currently says. Pulls query and page together from the Search Console API for
the last 90 final days (Search Console finalises a day about three days later), keeps the pairs
at position 11 to 20 with ten or more impressions, groups them by page with the page's overall
numbers, looks up each page's source file, `title:` and `description:` in `_posts`, `_comedians`,
`pages` and `index.html`, and writes a Markdown worksheet plus the raw rows into gitignored
`script/gsc-out/` (`<date>-pos11-20.md`, `.json`, and `latest.md`). Prints the top pages with
their three biggest queries. Never touches git. Pure logic and its tests:
`script/lib/gsc-report-lib.ts`.

```
bun script/gsc-report.ts [--dry-run] [--days 90] [--band 11-20] [--min-impressions 10] [--page /comedybrew/] [--country che]
```

`--band 8-11 --min-impressions 30` is the second target: queries at the bottom of page one.
`--page` takes a site path and asks Google for that page only; `--country` an ISO 3166-1 alpha-3
code. Auth is the `ga-report.ts` service account (`GA_REPORTS_CREDENTIALS`), which must be a
user on the property (Restricted is enough; added 2026-09-18) with the Search Console API enabled
on its project (`inyourface-ga-mcp`). `GSC_SITE` overrides the property
(default `sc-domain:inyourfacecomedy.ch`); `GSC_HEALTHCHECKS_URL`, if set, gets the summary or
`/fail`. The worksheet is the input to the title and text rewrites; run it again a few weeks
after an edit to see whether the query moved.

## `build-gallery-data.rb` and `build-gallery-card.rb`

macOS-only authoring tools for the `/moments/` gallery; the Linux build only reads what they commit.

```
ruby script/build-gallery-data.rb build [--rebuild] [--no-ping]   # scan assets/img/gallery/, analyse NEW images, rewrite _data/gallery.yml
ruby script/build-gallery-data.rb tag                              # prompt for a comedian slug per untagged performer photo
ruby script/build-gallery-card.rb                                  # the 1080x1080 share card, assets/img/thumbs/gallery_card.png
```

`build` needs `auge` (Apple Vision on the command line, `/opt/homebrew/bin/auge`) and `sips`; it
types each photo as performer, audience or moment, picks the featured ones, dates them (EXIF or
filename date when it predates the git add, else the git add) and pings IndexNow. A slug set with
`tag` lives in `gallery.yml` and survives rebuilds; the comedian's page then shows the photo. The
card script renders through headless Google Chrome and downscales with `sips`. Neither commits.

## `ga-setup.ts` and `ga-annotations.ts`

Google Analytics configuration as code (full picture: `analytics.md`). Both read the
service-account key from `GA_REPORTS_CREDENTIALS` in `.env`, like `ga-report.ts`, but they
write, so the service account needs the **Editor** role on the GA property (Admin > Property
access management), where `ga-report.ts` only needs Viewer.

- `bun script/ga-setup.ts [--dry-run]` makes the property match the desired state declared
  in the file: 14-month event retention, `ticket_click` and `ticket_redirect` as key events,
  the custom dimensions `show`, `link`, `venue`, `show_date`, `days_to_show`, the custom
  metric `price_chf`, and the custom channel group "IN YOUR FACE channels". Idempotent;
  creates and patches, never deletes or archives. Run it after editing the desired state.
- `bun script/ga-annotations.ts [--dry-run]` turns every upcoming show date in
  `_data/calendar.yml` into a GA report annotation ("Comedy Brew @ ROBIN's" on that date),
  so every chart in GA marks show nights. Idempotent on title + date; past annotations are
  left alone. Not scheduled yet; the proposed cron line is in `automation.md`.

Neither script touches git.

## `email-monthly.ts`, `email-thankyou.ts`, `email-promo.ts`

The three Mailchimp emails, one script each (playbook, flags and the builder story: `emails.md`).
Each reads the site's own data, asks Claude for the words via the editable prompt in
`script/email-prompts/<type>.md`, renders table-based HTML plus plain text, checks it, creates a
draft campaign from harry@inyourfacecomedy.ch, reads it back and opens it in the browser. They never
send; Mailchimp's own confirm screen is the send gate.

```
bun script/email-monthly.ts [--month 2026-10 | --weeks 5] [--no-hero | --hero-title "…" | --no-hero-text]
bun script/email-thankyou.ts "<thank-you link from Lineup Maker 2000>" [--segment "<tag>"]
bun script/email-promo.ts --show <slug[,slug]> (--csv <file> | --segment <name> | --all) --brief "..." [--lang it]
   ... all: --dry-run | --copy <file> --update <web id> | --no-ai | --no-open | --yes
```

- `MC_API_KEY` comes from `.env` (or, as a fallback, the old exporter's `.env`); never tracked.
- Output lands in `script/email-out/` (gitignored): `.html`, `.txt`, `.copy.json`, `.preview.html` and an image cache.
- Shared code: `script/lib/email/` (renderer, Mailchimp client, copy, site data, images, campaign flow). Tests: `script/__tests__/email-lib.test.ts`.
- `claude` cannot be called from inside a Claude Code session; use `--copy` or `--no-ai` there.
- The monthly hero title is rendered onto the photo by a local headless Brave or Chrome (`sips` cannot draw text).
- The draft opens in Brave when installed (`EMAIL_BROWSER` overrides).
- No cron: these run by hand when there is something to say.

## `meta-lists.ts`

Builds the Meta customer-list upload files for meta-ads.md phase 0 step 4: the ticket sales
sheet, kept to people who are subscribed in Mailchimp, split into buyers whose last show was
within 12 months and older ones. Meta's own column headers (`email, fn, ln, ct, zip, country,
value`), so the upload wizard maps them without clicking.

```
bun script/meta-lists.ts [--dry-run] [--date YYYY-MM-DD] [--months 12] [--tickets <file>] [--mailchimp <file>] [--out <dir>]
```

- Inputs and outputs live in `meta-ads/lists/` (gitignored): newest `tickets-*.csv` and
  `mailchimp-*.csv` in, `buyers-recent-<date>.csv` and `buyers-lapsed-<date>.csv` out.
- Prints the counts (matched, recent, lapsed, subscribers who never bought, buyers not
  subscribed) and warns when a file is under Meta's floor of 100.
- Tests: `script/__tests__/meta-lists.test.ts`. No cron; run it before each audience refresh.

## `meta-lineup-ad.ts`

Parked since 2026-09-18: the Buyers ad set never delivered an impression (the matched buyer
lists are too small) and is paused, so nobody runs this script for now. It stays for the day
the lists are big enough. The rest of this section describes it as built.

The Buyers lineup ad (meta-ads.md phase 7). Reads the next Comedy Brew row from the Grist
`Lineups` table (Comedians Directory document: date, show, link, style), takes time, venue and
price from `_data/calendar.yml` and the names from `_comedians/`, opens the lineup link in
headless Brave and calls the page's own `window.__iyfDrawFlyer` for the post (1080x1350) and
story (1080x1920) images into `script/meta-out/` (gitignored), stamps "THIS THURSDAY" on them,
uploads the post image and creates the creative: five primary texts, five headlines and five
descriptions from `meta-ads/lineup-copy.yml` (Meta's multiple text options, one image, Book Now
to the tracked /go/ link with `utm_content=lineup-<yyyymmdd>`). The Buyers ad set holds one
`lineup-*` ad; the script gives it the new creative and this date's name each week (created
the first time). A re-run on the same date changes nothing unless `--replace`. Unless
`--skip-adset`, the Buyers ad set is checked and, if needed, set to the two buyer lists,
Advantage+ audience off, link clicks, the ramp budget from `meta-ads/config.yml` (printed
before writing).

```
bun script/meta-lineup-ad.ts --dry-run [--date YYYY-MM-DD]    # render, print the 15 texts with counts, no Meta writes
bun script/meta-lineup-ad.ts --activate [--date ...] [--skip-adset] [--replace]
```

The Buyers ad set is written by this script only (goal LINK_CLICKS, destination WEBSITE, the two buyer lists, Advantage+ off, the ramp budget). Destination WEBSITE matters: the set was created by hand as a profile-visit shell, and until 2026-09-14 the script left that in place, so Ads Manager reported "Instagram Profile Visit" as the result and optimised for it. Every run now checks it.

- Needs `META_ACCESS_TOKEN` and `GRIST_API_KEY` in `.env`; the Meta app must be Live (Development
  mode refuses creatives, error 1885183). `META_ADS_HEALTHCHECKS_URL` optional.
- Shared helper: `script/lib/meta-api.ts` (token, version, get and post, paging, errors).
- Copy: `meta-ads/lineup-copy.yml`, placeholders `{show} {weekday} {date} {time} {venue} {price}`
  filled from the calendar. Bodies over 125 characters stop the run; titles over 40 and
  descriptions over 30 get a `!` in the dry-run listing. Written for people who have been
  before: no name list, the flyer shows the faces. Edit the file, then `--replace --activate`.
- One ad per ad set is Meta's rule once a creative carries multiple texts (the ad set becomes
  "dynamic creative"; a second ad, even paused, is refused with error 1885553). Hence the
  update-in-place.
- The flyer carries a random case number, so each render is a new image and a new upload.
- Run window: the script sets the Buyers ad set's end time to show day at `lineup.ends_at`
  (config, default 18:00 Zürich), so the ad stops before doors and the ad set shows
  "Completed" until the next run moves the end time to the next show and re-activates it.
  The start of the window is simply when you run `--activate` (Monday, once the lineup is in
  Grist). No budget schedule needed on Buyers.
- Ads Manager and drafts: opening an ad's edit view saves a draft of what the view loaded; the
  view then shows that draft, not what the API changed later ("Unpublished edits" chip). Never
  publish those drafts over a script-managed ad; discard them. Read the truth with
  `bun script/meta-lineup-ad.ts --dry-run` or the API, not the edit view.
- Not scheduled yet: the first weeks run by hand on Monday. The proposed cron lines (Monday 13:00
  create paused, Tuesday 09:00 activate) are in `automation.md`.

## `meta-adsets.ts`

Writes the Cold, Warm and Intent ad sets from the `targeting:` block in `meta-ads/config.yml`
(plan: `meta-ads/creative-bank-plan.md`). Never touches Buyers (the lineup script owns it) or
the old ad set (`old_adset_id`).

```
bun script/meta-adsets.ts                 # diff per field, writes nothing
bun script/meta-adsets.ts --validate      # Meta checks the write (execution_options validate_only), nothing written
bun script/meta-adsets.ts --apply         # write the differing fields, asks per ad set
bun script/meta-adsets.ts --adset cold    # one ad set
```

Run the diff, then `--validate`, then `--apply`: the diff cannot tell you what Meta will refuse
on an edit, validate_only can. Known from 2026-09-13: changing `destination_type` from the
profile-visit value to WEBSITE and the goal to landing page views is accepted on an ad set
without ads; a `promoted_object` with the pixel is rejected on a traffic ad set (error
1885014), so the script does not send one.

Per ad set it sets: location (a city key with a radius in km, or countries), location types,
ages, locales (Meta ids), included and excluded custom audiences (by the keys in
`config.audiences`), Advantage+ audience off, the optimisation goal, billing on impressions,
destination WEBSITE, 1-day click attribution, and the base daily budget from `budgets`. An
included audience under 1,000 people is warned about before the write (Meta accepts it and
under-delivers rather than refusing). Targeting is written as one object when any of its fields moved;
the write is read back and any field that still differs is printed.

The cap: the script projects the month (every running ad set's daily budget times 30.4, plus
the ramps for the Comedy Brew dates in the next 30 days at three days each) before and after
the write. A write that would raise the projection above `monthly_cap_chf` is refused with
the arithmetic; a write that lowers it always goes through. The account spending limit in
Business settings is the hard stop; Meta does not read the config file.

If Meta rejects an include list because an audience is too small (Show clickers was under
1,000 on 2026-09-13), the script retries once without `show_clickers` and says so.

## `meta-insights.ts`

The Friday readout: Meta's numbers per ad beside the site's `/go/` counts for the same
`utm_content`, floors and verdicts (plan: `meta-ads/creative-bank-plan.md`, "The loop").

```
bun script/meta-insights.ts                  # last 14 days, every ad set plus the old one
bun script/meta-insights.ts --days 28
bun script/meta-insights.ts --adset cold
bun script/meta-insights.ts --apply          # pause the "retire" ads, asks per ad
```

Meta recommendations, two surfaces, printed as their own section after the flags (and in the JSON): the account edge `act_<id>/recommendations` returns what Ads Manager shows as "N recommendations" (type, the ad set or ad it points at, when it appeared, Meta's lift estimate, the text, a deep link into Ads Manager), and the `recommendations` field on each ad set and ad returns per-object checks (for example a language mismatch between copy and targeting). Not every pill is exposed: on 2026-09-14 Ads Manager showed two per ad set, the API one (the Reels video nudge) plus one per-ad item. The script reads them and never applies any: there is no API call that applies a recommendation, and each one is an Advantage+ toggle, a creative asset or a targeting change that the Saturday review decides on. If the edge fails the readout warns and still writes.

Writes `script/meta-out/insights-<date>.md` and `.json` (gitignored). Columns per ad: spend,
impressions, frequency, link clicks, landing page views, Meta ticket clicks (the custom
conversion `offsite_conversion.custom.<id>`, 1-day click), the site's `/go/` clicks for the
ad's `utm_content` (matched by ad name, then ad id; the report's own window is printed in the
header), cost per ticket click and per landing page view, verdict, note. Per ad set the header
carries status, budget, goal, 7-day frequency and the sizes of its audiences; the window is
tagged with the number of Comedy Brew dates inside it.

Verdict rules (`insights:` in config, defaults in `lib/meta-api.ts`): an ad set ranks on cost
per ticket click when at least two of its live ads have `ticket_floor` (10) ticket clicks,
else on cost per landing page view for ads with `lpv_floor` (30) views; an ad under both
floors is `untested`, or `starved` when it has been under for `starved_after_days` (28) while
a sibling passed; a ranked ad worse than `retire_factor` (1.5) times the ad set's median is
`retire`, at most `max_retire_per_adset` (2) per run, never below two live ads. Buyers and the
old ad set are `protected`: reported, never paused. Flags: 7-day frequency over
`frequency_flag` (3.5), or an ad set over CHF 3 per ticket click. Ranking is inside one ad set
only; never compare Cold with Intent, because Cold sends the visitors Intent later converts.

Tests: `script/__tests__/meta-insights.test.ts` covers both scripts' pure parts (verdicts,
floors, median, retire cap, starved rule, the site join, the calendar count, the desired
targeting, the diff, the post body, the month projection, the cap rule).

## `meta-bank.ts`

The creative bank for the Cold, Warm and Intent ad sets (plan: `meta-ads/creative-bank-plan.md`).
The concepts live in `meta-ads/bank/{cold,warm,intent}.yml` (tracked): one body, one headline,
one description, one image spec and a status per concept. Images are rendered through the
site's own pages in headless Brave (`script/lib/headless.ts`, shared with the lineup script):
`/adcard/` paints a headline over a photo or on a brand field in six looks (photo, swiss, type,
chalk, station, logo), `/week/` paints the week list for the calendar concepts, and a `clip`
concept is a phone video Harry supplies.

```
bundle exec jekyll build --future                       # the local render reads _site/
bun script/meta-bank.ts --render --local                # every group, post and story
bun script/meta-bank.ts --render --local --group cold --only C1,C3
bun script/meta-bank.ts --render --base https://inyourfacecomedy.ch   # from the live site
```

Output: `meta-ads/creative/bank/<group>/<id>-post.png` and `-story.png` (gitignored) and a
contact sheet at `meta-ads/creative/bank/index.html`. The loader refuses a body over 125
characters or a concept without an image style.

```
bun script/meta-bank.ts --push --dry-run          # what would be created for every status: live concept
bun script/meta-bank.ts --push --activate         # upload, creative, ad per concept, switched on
bun script/meta-bank.ts --push --only C5,C9       # named concepts whatever their status, left PAUSED
```

`--push` makes one ad per concept: the post and the story image uploaded to the account's
image library, one single-text creative with `url_tags` `utm_content={{ad.name}}` so the site
report lists clicks per ad, and one ad named `<group>-<id>` in the group's ad set, PAUSED
unless `--activate`. The creative is an `asset_feed_spec` with ONE body, ONE title and ONE
description (the concept's or the group's), Book Now, the `/go/` series link with the ad set
as the campaign, and two placement rules: the 9:16 story image on Facebook and Instagram
Stories and Reels (priority 1), the 4:5 post image on every other position of every platform
(priority 2, platforms only, so nothing is left uncovered). Every Advantage+ creative feature
is opted out explicitly (`CREATIVE_FEATURES_OFF`, the list Meta stored on the first push), so
Meta adds no text variations or image changes. A multi-text creative would turn the ad set
dynamic-creative (one ad allowed), so every bank ad is single-text; text variants are separate
concepts. It never creates a concept twice (the ad set is read by name, and
`meta-ads/creative/bank/state.json` remembers ids), refuses a concept missing either image,
refuses to add a seventh live ad to an ad set, skips clip concepts with a note, and waits out
Meta's per-account request limit (code 17, after about ten creations in a row). The bank
files' `status` is the human intent: `live` is pushed and on, `resting` is pushed and paused
for this round, `bench` waits for its first push, `retired` was paused by the readout. First push 2026-09-13: cold C1, C2, C3, C4, C7, C8; warm W1, W2, W6; intent I1,
I3, I5.

```
bun script/meta-bank.ts --sync                    # diff: pushed ads whose on/off state differs from their concept's status
bun script/meta-bank.ts --sync --apply            # pause the resting and retired ones, switch live ones back on (asks first)
```

`--sync` exists because Meta feeds one or two ads per ad set and starves the rest: in the
first week 75 percent of Cold's spend went to one ad of six, and four never came near the
readout's floor. So only two or three run per set at a time. To rotate, change `status` in the
bank files (`live` and `resting`) and run `--sync`; do it at a fortnight boundary together
with any budget change, since each batch of edits costs the ad set some learning.

```
bun script/meta-bank.ts --push-video --dry-run    # the video ads that would be made
bun script/meta-bank.ts --push-video --validate   # upload video and images, Meta checks the creative, nothing else is made
bun script/meta-bank.ts --push-video --activate   # creative and ad per concept, named <group>-<id>v, switched on
```

`--push-video` makes the video ads. A concept gets one by carrying a `video:` block, for
example `video: { composition: FifthLanguage }`: the composition is rendered beforehand in
`video/` (`bun scripts/Render.ts FifthLanguage`, see `video/README.md`) and read from
`video/out/<composition>.mp4`. The ad is named `<group>-<id>v` and carries the concept's own
words, the 4:5 image for feeds and the video for Stories and Reels, with the 9:16 still as the
video's thumbnail (so run `--render` for the concept first). By default the still ad
`<group>-<id>` runs beside it as its twin, for a like-for-like comparison; `twin: false` makes
the video ad only. The upload goes to `act_<id>/advideos` as a multipart form (`postForm` in
`lib/meta-api.ts`), is cached in state.json by the file's hash so a rerun never uploads the same
render twice, and the script waits until Meta reports the video ready before it makes the
creative. Image and video in one asset feed need `ad_formats: AUTOMATIC_FORMAT`; Meta accepted
that with a single text on 2026-09-18. `--sync` treats the video ad like the still: it follows
the concept's `status`.

```
bun script/meta-bank.ts --restory --dry-run       # ads in state.json still on the first push's one-image creative
bun script/meta-bank.ts --restory --validate      # Meta checks each new creative (validate_only), writes nothing
bun script/meta-bank.ts --restory                 # new creative per ad, the ad moved onto it, old id kept in state.json
```

`--restory` exists because the first push sent one 4:5 image in a plain `link_data` creative
and Ads Manager then recommended a 9:16 asset for Reels on all three ad sets. It uploads the
story image, creates the two-image creative, and changes the ad's creative in place (same ad
id, name and url_tags; Meta reviews the ad again, and an ad that has been delivering re-enters
learning, so do it early). The new creative id is written to state.json before the ad update
and picked up on a rerun, so a crash never makes a second creative; `previous_creative_id`
keeps the old one. Ads with a `story_hash` in state.json are skipped. `--validate` uploads the
story image (a library image, free) and sends the creative with `execution_options`
`validate_only`; Meta checks the creative alone, not the ad update, so the go for real is
the only full proof.

Story cards paint inside the Reels safe zone (`drawAdCard` raises the story key-content area
to 270 px top and 690 px bottom, about 14 and 35 percent, where Reels draws its own controls);
post cards keep the flyer spec. The Swiss look puts its logo under the words when they reach
the floor.

The `/adcard/` page also works by hand: `headline`, `sub`, `style`, `photo` (a gallery path)
and `format` in the URL, a Download PNG button. The station look splits `sub` on ` | ` into
board rows and sits on a subtle backdrop, the Comedy Brew feature photo darkened most of the
way to ink (`bg=` in the URL or `image.bg` in the bank file overrides it; empty for none). The
contact sheet is rebuilt from every image on disk after each render, so a `--only` run never
shrinks it. Contrast pairs for the six looks sit in `newStylePairs()` and `bun test` holds them
at the WCAG floors like every other style.

## `eventfrog-sales.ts`

Comedy Brew ticket sales from the Eventfrog Organizer API beside the Meta spend: snapshots, the
sales curve, the capacity guard, the profit line and the Saturday review. The design and every
threshold: `~/Documents/2026-09-13-comedy-brew-sales-tracking-strategy.md`. Config: the
`comedybrew:` block in `meta-ads/config.yml`. Key: `EVENTFROG_ORGANIZER` in `.env`.

```
bun script/eventfrog-sales.ts --poll --slot daily      # 09:00: next two shows, snapshot and order rows, readout; a past show within 7 days gets its final record
bun script/eventfrog-sales.ts --poll --slot midday     # Tue and Wed 13, 17, 20: the next show only
bun script/eventfrog-sales.ts --poll --slot showday    # Thu 10 to 20 hourly: the next show; no-op when today is not a show
bun script/eventfrog-sales.ts --backfill [--limit 6]   # past Comedy Brews: order rows, check-ins, payouts, spend, final records
bun script/eventfrog-sales.ts --final [--date D]       # the final record for a past show
bun script/eventfrog-sales.ts --guard [--apply]        # capacity guard for the next show; dry-run prints, --apply writes to Meta
bun script/eventfrog-sales.ts --review                 # Saturday: review-<date>.md and the ramp verdict for the coming week
bun script/eventfrog-sales.ts --curve 2026-09-10       # a past show's curve from the order rows
```

Read-only by construction: `lib/eventfrog-api.ts` has one method, `get`, a whitelist of the six
read paths, the key in the Authorization header only, `X-RateLimit-Remaining` read on every
call (waits for the minute under 5), one wait on a 429, a hard cap of 40 calls per run, and
401 or 403 raise `EventfrogAuthError` (the Healthchecks fail ping says "key rejected"). The
key Harry created has write and delete rights; nothing here can use them, and the plan is to
swap it for Eventfrog's read-only Organiser key type.

Files, all under `script/eventfrog-out/` (gitignored): `sales.jsonl` (append-only, one
snapshot per poll per show: tickets, students, cancelled, orders, gross, capacity, remaining,
last order), `orders.jsonl` (one row per order keyed by order id: dates, counts, money,
payment; no name, no email, no ticket ids), `shows/<date>.json` (the final record: check-ins,
payout, Meta spend per ad set in the Friday-to-Thursday window, site clicks from
`_data/reports/comedybrew.json`, blended net price, ads per ticket, whether the ramp ran,
profit), `guard.json` (every guard action with its reason, and the ramp state), `events.json`
(the day's Comedy Brew list from the API, so hourly slots make one call), `sales-<date>.md`
and `review-<date>.md`.

The capacity guard reads a projection inside 72 hours of the show (sold divided by the share
of a night usually sold by then, from the order rows, the export baseline under three shows):
at capacity minus `door_reserve` the ramp is put back to base on Warm, Intent and Buyers; at
`seats_left_ramp_stop` seats left the same; at sold out the dated `lineup-<date>` ad is
paused. No ad set is ever paused and Cold and the old ad set are never touched. The profit
guard is the review's ramp verdict: full, half or off from the four-show median of ramp francs
per extra ticket (ads per ticket over all tickets until base-only weeks exist) against
`ramp_warn_share`, `ramp_stop_share` and `ramp_restore_share` of the blended net price,
with a two-clean-week restore. It is advisory: Harry sets the ramp on Saturday.

Healthchecks: create a check "IYF Eventfrog sales" (grace 26 hours), put its URL in `.env` as
`EVENTFROG_HEALTHCHECKS_URL`. Every run pings success; readout lines go to `/log`; a guard
action, a sold-out show or a rejected key goes to `/fail` (Telegram).

Not scheduled yet. After a week of hand runs (`--guard` without `--apply` for the first two weeks)
the four cron lines in `automation.md` take over: a daily snapshot, three more on Tuesday and
Wednesday, hourly on show day, and the Saturday review.

Tests: `script/__tests__/eventfrog-sales.test.ts` (the client's refusals and headers, redaction,
capacity with the student sub-category, Zürich time across the October change, the window,
slots, the curve, the projection, the pace, the guard table, blended net, profit, the ramp
verdict with hysteresis, the site click join).

## `robins-calendar.ts`

Mirrors the website calendar (`_data/calendar.yml`, venue `robins` only) into the Apple calendar
shared with the ROBIN's bar staff. It writes to the local Calendar store through
`script/lib/ekcal.swift` (EventKit, compiled on first run into the gitignored `script/robins-out/`);
iCloud carries the events to the staff. Whatever runs it needs the Calendars permission
(System Settings, Privacy & Security, Calendars). The calendar is `ROBINS_CALENDAR` in `.env`, its
exact title in Calendar.app; there is no password or id to store.

```
bun script/robins-calendar.ts --dry-run                       # the plan, nothing written
bun script/robins-calendar.ts                                 # writes to the calendar named in .env
bun script/robins-calendar.ts --calendar "Test Calendar"      # a one-off run against another calendar
```

One event per show date: title `🎤 Comedy Brew [Back]` (microphone, show name, room tag; the room is
in the title only), notes with the host line (the post's `hosts:` and `hosts_label:`) and, in the
last three days before a show, a `Tickets: 12` line from the read-only Eventfrog client. The
organiser key sees our own events only (Comedy Brew today); every other show gets no Tickets line.
The url is the show page plus `#<date>`, which is also the key that finds the event again.

Room: `room: front` or `room: back` in a post's front matter wins; otherwise Front (the small room,
30) in July and August and Back (the bar room, 120) the rest of the year.

Humans win. `script/robins-out/state.json` remembers what the script last wrote, per field. A field
that no longer holds that value was edited by a person and is never written again; in edited notes
only the line that starts `Tickets:` is kept fresh. An event a person deleted is not recreated. A
hand-made event within two hours of a show's start (no `#<date>` key in its url) is left alone and
no twin is made. A show that leaves the website is reported, never deleted: the helper has no
delete at all. `--force` is the way back: every field of the script's own events counts as ours
again and is reset to the website's version (hand-made events stay untouched).

`--first-load` (with `--dry-run` first) is the one-time takeover of a calendar people filled by hand:
every repeating series is ended from its next occurrence on (history stays), a hand-made one-off in
the slot of a website show is replaced by ours, "front" in its title or notes carries over as
`[Front]` and is recorded as a human edit so it sticks, and hand-made events that match no website
show stay untouched. `--keep-dates 2026-12-31` keeps a plain copy of a series occurrence. It refuses
to run on a calendar the script has already written to. The helper's `remove` op exists only for
this: it needs the event id, exact start and exact title. "Comedy @ ROBINs" was taken over on
2026-09-18 (backups in `script/robins-out/`); the daily run for it is plain
`bun script/robins-calendar.ts` with `ROBINS_CALENDAR="Comedy @ ROBINs"` in `.env`.

Schedule: a launchd agent, daily 11:05 (after the 09:00 refresh, clear of the hourly Thursday sales
poll). Not cron: cron runs outside the login session, so macOS refuses it the Calendars permission
without ever showing a prompt. The agent starts the helper, which asks for access and then runs the
script: `script/robins-out/ekcal run /Users/harry/.bun/bin/bun script/robins-calendar.ts`. The
permission is pinned on the process launchd starts, and only `ekcal` carries the usage description
(an Info.plist the script links into it) that lets macOS prompt. Started as plain `bun ...` the
request is pinned on bun and refused silently (tried 2026-09-18).

```
cp script/launchd/ch.inyourfacecomedy.robins-calendar.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ch.inyourfacecomedy.robins-calendar.plist
launchctl kickstart gui/$(id -u)/ch.inyourfacecomedy.robins-calendar     # run now; click Allow on the first run
launchctl print gui/$(id -u)/ch.inyourfacecomedy.robins-calendar | grep -E "runs|last exit"
launchctl bootout gui/$(id -u)/ch.inyourfacecomedy.robins-calendar       # uninstall
```

Log: `script/robins-calendar.log` (each run appends). The helper is rebuilt
only when the text of `ekcal.swift` changes (a sha256 beside the binary); a rebuilt binary loses its
grant, so kickstart the agent once afterwards and answer the prompt. "calendar access denied" in
the log means exactly that. A Mac asleep at 11:05 runs the job when it wakes.

Tests: `script/__tests__/robins-calendar.test.ts` (room rule, title, key, notes, the human-edit rules, `--force`).

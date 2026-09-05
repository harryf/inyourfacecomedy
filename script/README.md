# `script/` — site maintenance scripts

Standalone Ruby scripts that run alongside the Jekyll site. Ruby matches Jekyll's runtime, so the same Bundler-managed gem set is available, and these scripts can later be promoted to GitHub Actions or `jekyll build` hooks without language churn.

| Script | Purpose | Cadence |
|---|---|---|
| `add-event.rb` | Create a brand-new show from its Eventfrog link: writes the `_posts` page, installs the images, then re-derives the calendar, venues and homepage lastmod. Never touches git. | By hand, once per new show |
| `refresh-next-event-dates.rb` | Scrape each show's Eventfrog page, write the next upcoming event's start/end into the post's front-matter. | Daily via cron |
| `check-site.rb` | Post-build health smoke test: asserts build, page presence, sitemap, SEO/analytics, Event JSON-LD, promo + Lineup catalogs, script/data health, and link integrity. | On every push/PR (CI) + before release |

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
| `--image` | `image` | `og:image` / `twitter:image` — the picture in the Twitter/X, Slack and Facebook link card | 1200x630 min |
| `--thumbnail` | `thumbnail` | Square share image (WhatsApp and friends) | ~1080x1080 |

Files are copied into `assets/img/uploads/` (thumbnails into `assets/img/thumbs/`) under lowercase, permalink-derived names, because the live Linux build is case-sensitive and macOS is not. Pass no `--feature-img` and the script downloads Eventfrog's own flyer instead, so a page is never bannerless; `--image` then falls back to the hero rather than silently inheriting the site-wide default card.

### What it changes

1. **`_posts/<date>-<slug>.md`** — the only non-derived artifact. A show *is* a post with a `ticket_url`; the homepage, sitemap, `/comedians/` chips and health check all build themselves from that fact.
2. **`assets/img/…`** — the images above.
3. **`_data/calendar.yml`, `_data/calendar_past.yml`, `_data/venues.yml`** — by running `refresh-calendar-data.rb`. The post already exists by then, so the extractor treats the new show like any other and appends an unseen venue on its own. That is why this script has no venue logic of its own.
4. **The new post again** — `next_event_date`, `next_event_end_date`, `venue_slug`, `venue` and `price_chf` are back-filled *from* `_data/calendar.yml`, using the same precedence as `refresh-next-event-dates.rb`. The new show is therefore correct for exactly the same reason every existing show is correct.
5. **`pages/1_calendar.md`** — by running `refresh-calendar-page.rb --no-refresh --no-push`. That page is materialized markdown, not a live query over `calendar.yml`, so it has to be regenerated.
6. **`index.html` `last_modified_at`** — so the sitemap `<lastmod>` for `/` advances. The homepage *listing* needs no edit: `_layouts/home.liquid` recomputes it from `site.posts` on every build.

### What it deliberately does not do

- **No git.** No add, no commit, no push. You rewrite the description in the house voice (`WRITING_GUIDE.md`) and commit yourself. The script prints the exact `git add` line for the files it touched.
- **No IndexNow, no Healthchecks.io ping.** Those belong to cron. The child `refresh-calendar-page.rb` is spawned with `HEALTHCHECKS_URL` cleared so an interactive run can never report a fake green to the monitor.
- **No writes to `_comedians/*.md`.** That collection comes from Grist via `sync-comedians.rb`. A `--host` slug that doesn't match a `slug:` under `_comedians/` is reported with near-miss suggestions and left out of the post — an unresolvable slug renders nothing in the host grid and silently drops a `Person` from the Event JSON-LD, which is worse than a loud warning.
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

### What it does

For each `_posts/*.md` whose front-matter contains a `ticket_url` pointing at Eventfrog:

1. If `next_event_date` is already in the future → **skip** (idempotent — re-running same day is safe).
2. Otherwise, `curl` the Eventfrog page (group/series page or single-event page).
3. Parse out the next future event start datetime, preferring the `<time itemprop="startDate" datetime="…">` markup; falls back to scanning `DD.MM.YYYY` patterns.
4. Compute end time = `start + default_duration_minutes` (default 150).
5. Rewrite `next_event_date`, `next_event_end_date`, and `last_modified_at` in front-matter.

**Eventfrog is the source of truth.** Recurrence-day / recurrence-time fields on posts are informational only; the script doesn't compute from them. This handles bi-weekly shows, three-of-four-weeks-a-month, postponed instances, and one-off events identically — whatever Eventfrog says is next, the post mirrors.

**Skip conditions** (all explicit, all logged with reason):

- No `ticket_url` in front-matter
- `ticket_url` doesn't point at Eventfrog (Eventbrite, custom URLs, etc.)
- `next_event_date` is already in the future
- **No `venue_slug` set** — without a venue the Event JSON-LD can't include `location` (which Google requires for Event rich results), so refreshing the date alone would only produce a half-baked block. This is the opt-out for variable-venue series like La Tarima (Basel + Monroe in different months). To re-enable rolling for such a post, either set a fixed `venue_slug` or wait for Sprint 2's per-instance data layer.

### Manual invocation

```bash
cd /Users/harry/Code/personal/inyourfacecomedy
ruby script/refresh-next-event-dates.rb

# Preview without writing:
ruby script/refresh-next-event-dates.rb --dry-run --verbose
```

Sample output:

```
[skip  ] 2024-01-18-comedybrew.md — already future (2026-05-28T19:30:00+02:00)
[ROLLED] 2025-09-24-brexiles_-_english_comedy_night_in_zurich_kreis_4.md — rolled to 2026-07-15T20:00:00+02:00
[skip  ] 2099-05-13-la_tarima_-_comedia_en_espanol.md — no ticket_url
...
1 post(s) updated. 0 error(s).
```

Exit code 0 on success (with or without updates); exit code 1 if any Eventfrog fetch failed.

### Parsing strategy in detail

Eventfrog renders server-side (no JS required), so `curl -L` returns the full DOM with all dates inline. The script walks the ticket page in two stages:

**Stage 1 — detect page shape.**

A ticket URL like `eventfrog.ch/comedybrew` redirects to one of two page shapes:

- **Group/series page** — `/de/p/gruppen/...html` — table of every upcoming instance, each row carrying its own per-instance ticket URL (`<a itemprop="offers" href="...">`).
- **Individual event page** — `/de/p/theater-buehne/.../{slug}-{id}.html` — one single event.

The script counts `<td class="datecol">` rows. More than one → group page. Otherwise individual.

**Stage 2 — extract per-instance details.**

If on a **group page**: walk `<tr>` rows top-to-bottom, parse `DD.MM.YYYY` + `HH:MM Uhr` from each `<td class="datecol">`, take the first row whose datetime is in the future, follow its `itemprop="offers"` link, and fetch that individual page (one extra HTTP request).

If already on an **individual page**: parse it directly. No extra fetch.

From the individual page, the script extracts:

| Field | Source on individual page | Notes |
|---|---|---|
| Start | `<time itemprop="startDate" datetime="2026-05-28T19:30TZD">` | `TZD` is a literal placeholder; we apply `+02:00` |
| End | Second `<time itemprop="doorTime" datetime="2026-05-28T22:00TZD">` | Door-close time. If only one doorTime exists, falls back to start + `default_duration_minutes` |
| Price | `"price": "10.0"` (inline JSON, paired with `"priceCurrency": "CHF"`) | Rounded to integer CHF; not written if absent |

What we don't extract (still post front-matter): performer lineup (no reliable markup), venue (we use `venue_slug` from post + `_data/venues.yml`).

### Failure notification

Three failure modes are covered, all via Healthchecks.io (which routes to Telegram/email/Slack/etc. per your HC integration settings):

| Failure | What happens | How you find out |
|---|---|---|
| **A.** Eventfrog page format changes, parsing fails | Script logs error, exit 1, pings `…/fail` | HC marks check down → integration alerts you |
| **B.** Script crashes (ruby exception) | Top-level rescue pings `…/fail` with stack frame, then re-raises | HC marks check down → integration alerts you |
| **C.** Cron itself stops running (laptop off, cron broken, etc.) | No ping arrives at HC | HC alerts after grace period elapses |

#### One-time setup

**1. Create the secrets file:**

```bash
cd /Users/harry/Code/personal/inyourfacecomedy
cp .env.example .env
# Edit .env — paste your Healthchecks.io ping URL
```

`.env` is gitignored. Never commit it.

**2. Create the Healthchecks.io check:**

- Sign up at https://healthchecks.io (free tier: 20 checks)
- New Check → name it "IYF refresh-next-event-dates" → set **Period: 1 day**, **Grace: 1 day**
- Copy the ping URL (looks like `https://hc-ping.com/abc-123-…`) into `HEALTHCHECKS_URL` in `.env`

**3. Wire HC → Telegram (fail-only):**

- In the check's **Integrations** tab, connect Telegram (Healthchecks.io has its own bot you authorise into a chat)
- In the integration's settings, ensure:
  - ✅ "Notify when check goes down" is **ON**
  - ❌ "Notify when check comes back up" is **OFF** — otherwise every healthy day produces a green-recovered message and you'll start ignoring them

Email, Slack, Discord work the same way — same toggle pair.

**4. Smoke test:**

```bash
# Verify HC receives a success ping:
cd /Users/harry/Code/personal/inyourfacecomedy
ruby script/refresh-next-event-dates.rb
# → Check HC dashboard, should show a green ping within seconds.

# Verify HC receives a fail ping (and your integration alerts you):
# Temporarily set a bogus ticket_url in any _posts/*.md, run the script,
# then revert. The HC dashboard should flip red and you should get the alert.
```

### Cron installation (macOS)

The script should run daily so `next_event_date` rolls forward the day after each show. Most days it's a no-op.

**1. Open your crontab:**

```bash
crontab -e
```

**2. Add this line:**

```cron
# IYF Comedy — refresh next_event_date from Eventfrog, daily at 04:00.
# Script handles file edits, git commit + push, and Healthchecks.io alerts.
0 4 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.rbenv/versions/3.2.4/bin/ruby script/refresh-next-event-dates.rb >> script/refresh.log 2>&1
```

Notes:
- Ruby path is the rbenv 3.2.4 install (cron's minimal `PATH` won't resolve rbenv shims, so we use the version-specific absolute path). If you upgrade Ruby via rbenv, update this path.
- The script owns everything: edits front-matter, stages `_posts/`, commits with a fixed message, pushes to `origin master`. If push is rejected (branch behind origin) it pulls `--rebase` and retries once.
- Any failure — parse error, git failure, push retry exhausted — pings Healthchecks.io `/fail` so you get a Telegram alert. Success-only paths produce no alerts because HC is configured fail-only.
- Log goes to `script/refresh.log` (gitignored).
- The script reads `.env` from the project root itself — no need to `source` it in the cron line.

**3. Add `script/refresh.log` to `.gitignore`:**

```
script/refresh.log
```

**4. Verify the cron is installed:**

```bash
crontab -l | grep refresh-next-event
```

**5. First-run sanity check** (do this once before relying on cron):

```bash
cd /Users/harry/Code/personal/inyourfacecomedy
ruby script/refresh-next-event-dates.rb --dry-run --verbose
# Inspect the [would-write] lines, then if happy:
ruby script/refresh-next-event-dates.rb
git diff _posts/   # eyeball before committing
```

### Why daily

Cron triggers are simpler than event-driven triggers. Most days the script is a no-op (front-matter already current). On the day after a show, it advances the next instance — whatever weekday Eventfrog reports as next. The cost of running daily-but-mostly-doing-nothing is zero. The cost of a missed event-trigger is a stale `startDate` in Google's index.

### Why Ruby

Matches the Jekyll runtime. No language switch when this graduates to a GitHub Action or a `jekyll build` hook. Bundler-managed gems are already available (`net/http`, `time`, `uri` are stdlib — no extra `Gemfile` entry needed).

## `ga-setup.ts` and `ga-annotations.ts`

Google Analytics configuration as code (full picture: `ANALYTICS.md`). Both read the
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
  left alone. Proposed cron line, after the 09:00 calendar refresh has landed:

      25 10 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/ga-annotations.ts >> script/ga-annotations.log 2>&1

Neither script touches git.

### Future: GitHub Action

When this matures, move from the laptop's cron to a scheduled workflow:

```yaml
# .github/workflows/refresh-event-dates.yml (sketch)
name: Refresh event dates
on:
  schedule:
    - cron: "0 3 * * *"    # 03:00 UTC = 04:00 CET / 05:00 CEST
jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ruby/setup-ruby@v1
        with: { ruby-version: "3.3.4" }
      - run: ruby script/refresh-next-event-dates.rb
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: refresh next_event_date from Eventfrog"
          file_pattern: "_posts/*.md"
```

Eliminates the "laptop must be on" failure mode and removes the per-machine cron-install friction.

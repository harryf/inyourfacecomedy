# Google Search Console: access, the learning loop and what to do with it

How the site reads its own Google search data, how that data turns into page changes, and
how we know whether a change worked. Internal dev doc, excluded from the build. The loop's
folder is `seo/` (its own `seo/README.md` is the reading guide for the weekly report); the
script is `script/gsc-report.ts` (`scripts.md`); the schedule and the check are in
`automation.md`. Comedian pages have extra rules here and in `comedian-seo.md`.

| Thing | Value |
|---|---|
| Property | Domain property `sc-domain:inyourfacecomedy.ch` (covers every host and protocol) |
| Console | https://search.google.com/search-console, signed in as inyourfacecomedych@gmail.com |
| API access | The Google Analytics service account `ga-reports@inyourface-ga-mcp.iam.gserviceaccount.com`, added as a **Restricted** user on the property on 2026-09-18 (Settings, Users and permissions). Key file `ga-reports-sa.json` (gitignored), path in `.env` `GA_REPORTS_CREDENTIALS`, scope `webmasters.readonly` |
| API enabled | Google Search Console API on Cloud project `inyourface-ga-mcp` (number 398668466536), enabled 2026-09-18 with `gcloud services enable searchconsole.googleapis.com --project inyourface-ga-mcp` |
| Script | `script/gsc-report.ts`, weekly, Monday 10:40 by cron; writes and commits `seo/` |
| Check | Healthchecks "IYF gsc-report", period 7 days, grace 1 day, URL in `.env` `GSC_HEALTHCHECKS_URL` (created 2026-09-18) |
| Data | Final about three days after the day; 16 months of history; a query with under about 20 impressions is noise |

## Why the API and not the export

The console's CSV export lists queries with totals and pages with totals in separate files.
It never says which page ranked for which query, and that pairing is the whole point: a
query at position 13 is worth nothing until you know which page to change. The API returns
query and page together (plus device and country), 16 months deep, 25,000 rows a call. The
service account already ran the analytics job from cron with no browser and no keychain, so
the same credential carries the Search Console reads; nothing in this path can hit a login
prompt.

## Access, if it ever has to be redone

1. Enable the API on the **same Cloud project the service account lives in**. The console's
   project selector defaults to whatever was last open; the first attempt landed on a
   different project and the API kept answering "disabled". The reliable way is the command
   in the table above, or check with:
   ```
   gcloud services list --enabled --project inyourface-ga-mcp --filter='config.name:searchconsole'
   ```
2. In Search Console, Settings, Users and permissions, Add user, paste the service account
   email, permission Restricted. Full is not needed to read performance data.
3. Prove it:
   ```
   bun script/gsc-report.ts --dry-run
   ```
   Two failure messages are spelled out by the script: "API is disabled on the service
   account's project" (step 1) and "no access to sc-domain:inyourfacecomedy.ch" (step 2).

## The loop

Every Monday the script does five things; `seo/README.md` has the detail and the verdict
rules.

1. **Snapshot**: the last 28 days of final data into `seo/snapshots/<date>.json` (query and
   page pairs with three or more impressions, page totals, device split). Sixty-four weekly
   snapshots back to June 2025 were backfilled on 2026-09-18, so the trend table was full
   from the first report.
2. **Score**: a 90-day discovery window against the site's own click curve by position.
   Every non-brand query with ten or more impressions gets a gain in extra clicks a quarter:
   page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing
   three places, well-ranked queries with under half the typical click rate at reaching that
   rate. Queries two pages share are listed for a decision.
3. **Propose**: page briefs in `seo/latest.md`, ordered by gain, each with the current title
   and description and the words its queries use that the page does not (umlauts folded).
   Queries that are mostly a comedian's or show's name are flagged; those compete with the
   person's own profiles and top five is the realistic ceiling.
4. **Log**: after a page change, in the same commit:
   ```
   bun script/gsc-report.ts --log-change /comedybrew/ "open mic zürich, open mic zurich" "Title now opens with Open Mic Zürich"
   ```
   Queries are spelled exactly as Search Console reports them; the umlaut and non-umlaut
   forms are separate queries there.
5. **Measure**: each open experiment is read against the 28 days before its change. "Too
   early" for 28 days, then improved, worse, flat or no data. Close it by hand in
   `seo/experiments.yml` when the reading is in; closed entries stay in the report.

Everything the loop writes is committed to `master` by the script, so the history lives in
the repo. `_config.yml` excludes `seo/` from the published site.

## What we change, and what we never change

- **Show pages, the home page, `/calendar/`, `/switzerland/` and the other pages**: title,
  description, headings and body text are all fair game, one change at a time per page so
  the ledger can attribute the result.
- **Comedian pages (`/comedians/<name>/`)**: the bio is the comedian's own words and is
  never edited for search. The files are regenerated from Grist by `sync-comedians.rb`, so
  a hand edit would not survive anyway. The one lever is the shared pattern: the title
  (layout plus jekyll-seo-tag) and the meta description builder in `sync-comedians.rb`.
  A pattern change that says what these pages are, such as "X, stand-up comedian in Zürich",
  is a metadata change about comedians in Zürich and is allowed. The report treats every
  comedian page as meta-only, checks its queries against title and description only, and
  aggregates them into one section showing the words a pattern change would add.
- **Brand queries** ("in your face comedy" and variants) are excluded from scoring; they
  are already ours.

## Re-indexing after a change

Two different questions hide in "get the search engines to see the new page".

**Bing, Yandex, Seznam, Naver: IndexNow.** One POST with the URLs and the key file at the repo
root, and they fetch within minutes. `sync-comedians.rb` and `build-gallery-data.rb` do this for
the pages they write; `script/reindex.ts` does it for everything else (`scripts.md`).

**Google: there is no request-indexing API for ordinary pages.** Three things people confuse:

- The **Indexing API** exists but Google restricts it to pages with `JobPosting` or
  `BroadcastEvent` structured data. Using it for a comedy show page is against the guidelines
  and, in practice, ignored. We do not call it.
- The **URL Inspection API** (part of the Search Console API) is read-only: it returns the
  verdict, coverage state and last crawl time for a URL, 2,000 calls a day. `reindex.ts` uses
  it to report what Google knows, not to trigger anything.
- The **sitemap ping** endpoint was retired in 2023. Google reads the sitemap on its own
  schedule and pays attention to `<lastmod>` when a site keeps it truthful.

So the honest levers for Google are: a truthful `<lastmod>` (jekyll-sitemap writes it from the
page's `last_modified_at`), internal links from pages Google crawls often (the home page and the
calendar), and the manual "Request Indexing" button in the Search Console UI for a page that
must be seen today. `reindex.ts` covers the first: it bumps `last_modified_at` on any page whose
stamp is older than its last commit, commits, waits for the deploy, then pings IndexNow and
reads the inspection. It runs daily at 10:50 (`automation.md`), so a hand edit is picked up
the next morning at the latest; run it by hand right after a push when it matters.

## Reading a verdict honestly

- Read it beside the trend table and the movers list in the same report. When every query
  moved the same way, Google moved, not the page.
- Show and comedian names peak around show dates; a verdict on a venue-intent query such as
  "open mic zürich" carries more weight than one on a name.
- Desktop averages several positions worse than mobile on this site (10.6 against 6.6 in
  September 2026). A page that "ranks 6" is on page two for many desktop searchers.
- Under about 20 impressions a position is noise; the verdict rules ignore queries below
  ten impressions and every table shows impressions beside the position.

## The first report (2026-09-18), as a worked example

The home page carried the biggest gain: "stand up comedy zürich" at position 4 with 522
impressions converted at 3 percent where the site's own curve says 8.6 percent, so the
listing text, not the ranking, is the lever. Its bottom-of-page-one queries ("stand up
comedy", "comedy zurich", "comedy shows zurich") and its missing words (club, schweiz,
standup) point at the title and description. Comedy Brew owned the ROBIN's bar cluster at
positions 7 to 8 and sat at 13 for "open mic zürich" while its title buried "Open Mic" in
the middle of a ninety-character sentence. Fourteen comedian pages held about 90 clicks a
quarter, all on name queries, with "comedian" the one word their titles lack.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Search Console API is disabled on the service account's project` | API off on `inyourface-ga-mcp` | the `gcloud services enable` line above |
| `no access to sc-domain:inyourfacecomedy.ch` | the service account is not a user on the property, or the property was re-verified and users reset | Settings, Users and permissions, add the account again |
| Report shows fewer pages than expected | the discovery window is 90 days and rows need three impressions | nothing; small pages appear as they earn impressions |
| Healthchecks alert "IYF gsc-report is down" with no `/fail` text | the Mac was asleep at 10:40 Monday | run `bun script/gsc-report.ts` by hand; the snapshot is dated the day it runs |
| Two commits race (a rejected push in the log) | another IYF cron job pushed at the same minute | the script pulls with rebase once and retries; if it still fails, run it by hand |
| `experiments.yml` entry never leaves "no data" | the query spelling differs from Search Console's, or under ten impressions | copy the query from the report table into the ledger |

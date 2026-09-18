# The Search Console learning loop

This folder is the memory of a weekly loop that reads Google Search Console, prices every
page's search opportunities, proposes what to change, and measures the changes we make.
Nothing here is published (`_config.yml` excludes `seo/`). The script is
`script/gsc-report.ts` (reference: `docs/scripts.md`); the schedule is in `docs/automation.md`.

## The loop, one week at a time

1. **Snapshot.** Monday the script stores the last 28 days of final data (Search Console
   finalises a day about three days later) as `snapshots/<date>.json`: every query and page
   pair with three or more impressions, every page's totals, the device split. Snapshots
   are the history; they are committed, so the trend survives any one machine.
2. **Score.** A 90-day discovery window (fetched, not stored) is scored against the site's
   own click curve: the share of impressions that became clicks at each position, from our
   non-brand queries. Every non-brand query with ten or more impressions gets a gain in
   extra clicks a quarter if its lever works:
   - **page two, aim for page one**: position 11 to 20, priced at reaching position 8.
   - **bottom of page one, aim higher**: position 5.5 to 11, priced at climbing three places.
   - **ranks well, few clicks**: position 8 or better with under half the typical click rate
     and 30 or more impressions; the lever is the listing text (title and description), not
     the ranking.
   - **two pages share one query**: listed, not priced; decide which page should own it.
3. **Propose.** `latest.md` orders pages by total gain. Each page brief shows the current
   title and description, the words its queries use that the page does not (title,
   description and body are checked; umlauts fold, so Zürich and Zurich are one word), and
   which queries are mostly a person's or show's name (those compete with the person's own
   profiles, and a top-five result is the realistic ceiling).
4. **Change.** Edit the page. Then log it in the same commit:
   ```
   bun script/gsc-report.ts --log-change /comedybrew/ "open mic zürich, open mic zurich" "Title now opens with Open Mic Zürich"
   ```
   That appends an entry to `experiments.yml` with today's date. List the queries the change
   aims at, spelled exactly as Search Console reports them (the umlaut and non-umlaut forms
   are separate queries there).
5. **Measure.** Every week the report reads each open experiment: the 28 days before the
   change (fetched once, cached in `experiments-baselines.json`) against the current
   snapshot, per target query. For 28 days after the change the verdict is "too early";
   after that: **improved** (position better by one place or more, or clicks up 30 percent
   with at least five clicks), **worse** (the reverse), **flat**, or **no data** (under ten
   impressions in one of the windows). Close an entry by hand when the reading is in:
   `status: closed`, `verdict: <your words>`. Closed entries stay in the report.

The report also lists **movers** (queries that shifted two or more places since last week)
and a **trend** table over the snapshots, so a change's effect can be told from the site's
general drift and from show seasonality.

## The comedian rule

Pages under `/comedians/` are **meta-only**. Their bios are the comedians' own words, and
the files are regenerated from Grist by `script/sync-comedians.rb`, so nothing in them is
ever proposed for change. The report checks their queries against the title and description
only, and aggregates all comedian pages into one section: the words their queries use that
the pages do not. That points at the one honest lever, the shared pattern for the title
(the layout and jekyll-seo-tag) and the meta description (built in `sync-comedians.rb`).
A pattern change like "X, stand-up comedian in Zürich" is a metadata change about comedians
in Zürich and is allowed; editing a bio is not.

## Reading the numbers honestly

- Gains are priced against the click curve; a page-two query at 400 impressions is worth
  more than its clicks suggest, because page one is a different audience size too.
- Under about 20 impressions a position is noise. The verdict rules ignore queries below
  ten impressions and the report shows impressions next to every position.
- Google's own changes move everything at once. Read a verdict beside the trend table and
  the movers list; if every query moved the same way, the change was not yours.
- Comedian names and show names peak around show dates. A verdict on those is weaker than
  one on a venue-intent query such as "open mic zürich".

## Files

| Path | What | Written by |
|---|---|---|
| `snapshots/<date>.json` | 28-day window ending three days before `<date>` | the weekly run and `--backfill` |
| `reports/<date>.md`, `latest.md` | the weekly report | the weekly run |
| `experiments.yml` | the ledger of page changes made for search | `--log-change`, closed by hand |
| `experiments-baselines.json` | the pre-change 28 days per experiment, fetched once | the weekly run |

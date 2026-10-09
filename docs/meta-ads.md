# Meta ads: the runbook

The step-by-step plan for turning one long-running Comedy Brew campaign into a five-stage
campaign with API tooling. The reasoning behind every choice is in the report at
`~/Documents/2026-09-12-iyf-meta-ads-strategy.md` (sections 3, 4, 10 and 11 in particular);
this file only says what to do, in order, and what you should see after each step. Written
13 September 2026 against the Ads Manager UI as documented in 2026 sources; Meta renames
controls without notice, so every step says what you are looking for in words and the
label to try first. If the label is not there, look for the thing, not the word.

Do every Ads Manager, Business settings, Events Manager and developer-portal step on a
laptop. The phone app hides most of these settings.

## Status

**9 October: the tomorrow and tonight ad sets are made fresh per show.** On 7 and 8 October the
cron-unpaused sets delivered from 17:00 and 12:00 and spent 42 to 52 percent of their budgets
(Meta's three-hour ramp plus daily pacing over the calendar day; the ads themselves cost CHF 0.24
to 0.30 per landing page view, next to the evergreen's 0.22). Now the Friday run creates
`cold-tomorrow <show>`, `cold-tonight <show>` and the warm pair as lifetime-budget ad sets with
start and end on Meta, ads reviewed days ahead; Meta starts them at midnight and paces the whole
budget to 23:59 or 18:00. The planner sets are unchanged. Reference: `docs/scripts.md`.

**4 October: the moment scheduler is live.** `script/meta-moments.ts` runs from cron at 07:30 and
12:30 (installed 4 October, Healthchecks `META_MOMENTS_HEALTHCHECKS_URL`). Six moment ad sets sit
beside the evergreen ones: `cold-planner`, `cold-tomorrow`, `cold-tonight` and the same for
Warm, with 18 ads (C18 to C26, W12 to W20). Planner runs Saturday to Monday before a Comedy Brew,
tomorrow on the Wednesday, tonight on show day until 18:00; each run picks the any, wet or long
weekend ad from the MeteoSwiss forecast and the Zürich holidays and sets the budgets: 70% Cold,
split planner 20, evergreen 20, tomorrow 20, tonight 40 of a CHF 91 week, boosts 1.5 for rain
or a long weekend. It owns the Cold and Warm daily budgets now (Cold CHF 1.80, Warm CHF 1.00 on
the evergreen ads), so `meta-adsets.ts` leaves them alone. The plan and its reasons:
`meta-ads/moments-plan.md`; the reference: `docs/scripts.md`. Running on 4 October: evergreen
C7, C13, W6, W9; planner C18, C19, W12, W13 until Monday 23:59; queued for this week's rain:
C22 and W16 on Wednesday, C25 and W19 on Thursday. Retired the same day (paused on Meta, kept
for their data): C16, C17, W2, W10, W11; the Intent ads are resting with their ad set.
The local board (`meta-ads/creative/bank/index.html`) lists only running and planned ads, each
with its ad set and its state on Meta; every scheduler run rebuilds it, or `meta-bank.ts --board`.

**4 October: W10 and W11 rested, the carousel cards go through /go/.** The ad-level review
(old carousel as the baseline: CTR 2.23, CHF 0.17 per link click over 39 days) left W10 (1.42 on
848 impressions) and W11 (1.18 on 423) under the carousel, so both are `status: resting` and
paused by `meta-bank.ts --sync --apply`. The 2024 carousel sent its five cards to
`https://bit.ly/iyfcb`, straight to Eventfrog, so about half its clicks never reached /go/ or GA.
At Harry's request the ad moved onto creative 1893804351591051 (previous 1419930283398312): the
same cards, texts, video and enhancements, every link now
`/go/?show=comedybrew&utm_source=meta&utm_medium=paid_social&utm_campaign=comedybrew&utm_content=120203748201470314`
(the ad id, the content value its main link already carried in GA, so the readout row continues).
Per-card clicks come from Meta's carousel card breakdown, not from GA. The ad set, budget and
schedules are untouched; the swap makes a new post, so the old post's likes and comments stay
behind, and Meta reviews the ad again.

**4 October, later: moment ads planned, three more ads retired.** On Harry's call cold-C16,
cold-C17 and warm-W6 are retired (paused on Meta, kept for their data), W10 and W11 moved from
resting to retired, and the Intent concepts to resting (their ad set has been paused since
28 September). The local board (`meta-ads/creative/bank/index.html`) now lists only running
(live) and planned (bench) concepts, in sections. Eighteen moment concepts were added, C18 to
C26 and W12 to W20: planner, tomorrow and tonight lines, each in an any, wet and long weekend
version, with a `moment:` block in the bank. `--push` refuses them; they run only through the
moment scheduler described in `meta-ads/moments-plan.md` (built the same morning, see above).
Later the same morning, on Harry's correction: W6 back on, W2 retired.

**29 September: cold-C17 reworded, and a creative floor in the readout.** Harry read the C17
headline "She got every word." as a possible dig at people who do not, and asked for no gender
pronouns in ad copy; the card now says "Every word landed." on the same photo. It was done with
the new `meta-bank.ts --refresh --only C17`: a new creative from the bank's text and the
re-rendered images, and the same ad moved onto it (id, name and `utm_content` unchanged, Meta
reviews it again). Rule for copy from now on: no he, she, her, his in headline or body; the line
is about the room or the show, never about a person's ability. The readout gained a creative
floor sized from the 2024 carousel (details under "Weekly readout"): once an ad has 500
impressions in the window, fewer than 1.0 link clicks per hundred means "change" the creative.
On the 14 days to 29 September nothing else was under it: C7 2.7, C13 2.1, W6 2.1, W2 2.1, W9
3.6 (223 impressions), the carousel 2.1; W10 1.4 and W11 1.3 sit under the carousel but above
the floor and stay on watch; C17's old creative ran 0.9 on 741 impressions, which is what the
rule is for, and its count restarts today.

**28 September: Intent folded into Warm, Cold to CHF 8.** The review of 28 September (read-only
API readout) found Intent saturated (207 people reached in 16 days, frequency 7, CPM 15, CHF 1.20
per landing page view; Meta sizes both its audiences under 1,000) and Warm starting to repeat
(3,303 of about 10,000 reached, frequency 3.5 over 16 days, cost per view flat at 0.26). It also
found that the funnel never fed Warm: every bank ad lands on `/go/`, which makes a cold clicker a
Site visitor and a Show clicker in the same second, and Warm excluded both, so clickers went Cold
to Intent, never to Warm; the only path into Warm was a like or save (20 in 16 days). Done the
same afternoon: Warm now includes IG engagers, FB engagers, Site visitors and Show clickers and
excludes only the buyer lists (a cold clicker lands in Warm); the Intent ad set is PAUSED (its
five ads untouched, `budgets.intent.base: 0`, which `meta-adsets.ts` skips); Cold CHF 8 (Intent's
2 moved over), Warm CHF 5, CHF 13 a day for the bank sets as before. The 2024 set is untouched, as
always; it carries one-time budget schedules of CHF 8 a day from Tuesday 06:00 to Thursday 18:00
for every show week through 17 December, which is what its show-week spend of CHF 9 to 13 a day
is. Open from the same review: the pixel logged 2,762 PageViews and 691 TicketRedirects since
13 September, yet the two website audiences stay under 1,000 people, so most ad traffic is not
matched into them; the pixel has automatic advanced matching off and the landing page is a
redirect. The Event Match Quality reading and what was done about it are under "Pixel matching"
below. Warm cut rule: CHF 4 when its 7-day frequency passes 3.5 or its cost per landing page view
passes CHF 0.35 for a week; raise Cold further only once the pools fill, and note that Cold's cost
per view rose from 0.22 to about 0.30 when it went from CHF 3 to 6.

**The experiment, 18 September to 31 October 2026.** After the first week's readout (below)
Harry decided: keep going and spend more so the ad sets learn. Cold CHF 6 a day (was 3), Warm
CHF 5 (was 3), Intent CHF 2 (its audience is the limit, not the money), the 2024 set as Harry
runs it. `monthly_cap_chf` is 600 for the period. The account spending limit stays at CHF 600 too
(Harry's choice): it is a running total, not a monthly one, and when it is reached Meta stops
every ad in the account, so Harry watches it and resets the counter on the billing page (at
about CHF 14 a day plus the show-week boosts, roughly once a month). Only two or three ads run per set at a time (`status: resting` in the
bank files, `meta-bank.ts --sync`): round one is cold C7, C4, C8 (C8 rested the same day for the video ads, below), warm W6, W2, intent I1, I3,
I5; C1, C2, C3 and W1 come back in round two, about 2 October. The sizing: Comedy Brew's online
ticket income is about CHF 650 in a typical month (median of the last twelve; 126 nights in the
sales export, typical night 22 tickets), so this spend is most of the income and is an
experiment, not a standing budget. On 31 October look at one number: has the typical night gone
from about 22 tickets to 28 or more? If not, drop to about CHF 200 a month.

Applied on Meta on 18 September 2026: the two budgets, the four resting ads paused (`meta-bank.ts
--sync` reads back in sync), Buyers paused.

**Round two is the laugh set (26 September 2026).** The 14-day readout of 26 September says
which ads work: `cold-C7` at CHF 0.20 per landing page view (125 views) and `warm-W6` at 0.25
(178 views). Both are the photo look with one laughing audience face large in the frame and a
headline that reads as the caption of that picture. Harry's rule from that day: every new ad is
made this way and no other. The bank files say so in their headers, and the photo look gained
`image.focus: [x, y]` (0 to 1 from the photo's top left) so the 4:5 and 9:16 crops keep the
face (`/adcard/` has the same Focus field). Nine concepts were written from the gallery's
audience photos, three per set, with the new-in-town and expat angles that C7 proved: cold C13,
C16, C17; warm W9, W10, W11; intent I10, I11, I12 (C14, C15 and I9 were dropped the same evening:
Harry wants the crowd visible behind every face, so a lone laugher on a plain background is out;
the same photo may serve two sets, since the audiences exclude each other). They are rendered (`meta-ads/creative/bank/index.html`)
and were CREATED ON META, switched on, the same evening (`bun script/meta-bank.ts --push --activate`,
ids in `meta-ads/creative/bank/state.json`; Meta reviews new ads, usually under a day). Two of
the lines were rewritten on Harry's note before the push: W9 "Warmer in here." (the warm room
against a dark, cold evening, seasonal, rest it in April) and the bench concept I7 "Strangers at
19:30. This by 21:00." (a row of strangers laughing together; set it live to push it). Photos with
the face below about half the photo's height put it under the headline, so the story card wants
a one-line headline or another photo; that is in the bank file comments. Intent keeps its three
new concepts because Harry asked for three per set, but the audience is about 120 people (second
readout); if Intent is paused as decided on 21 September, they simply wait.

**The bank was pruned the same evening (26 September 2026).** Harry removed sixteen concepts for
good, from the bank files, the contact sheet and Meta: cold C3, C4, C5, C8, C9, C10, C11, C12; warm
W1, W3, W5, W7; intent I3, I4, I6, I8. The five that had ads (`cold-C3`, `cold-C4`, `cold-C8`,
`warm-W1`, `intent-I3`) were set DELETED through the API and read back. What runs now: cold C7,
C13, C16, C17 (C1 and C2 resting, C6 bench; C5 went the same way a minute later); warm W2, W6, W9, W10, W11 (W4 and W8 bench);
intent I1, I5, I10, I11, I12 (I2 and I7 bench). Every live ad is the photo look. `state.json`
keeps the deleted ads' entries for the record; `--sync` ignores ads Meta no longer lists.

**Video ads stopped (26 September 2026).** `cold-C4v` cost CHF 0.62 per landing page view over 12
to 26 September against 0.41 for its still twin `cold-C4` (retire verdict in the readout), and
`cold-C12v` was never fed (CHF 0.18 in eight days). Both were paused and then DELETED on Meta on
26 September (Harry: "we just go with the still images"; status DELETED written through the API,
read back; their entries stay in `state.json` for the record and `--sync` ignores ads Meta no
longer lists). A `video:` block now takes its own `status`, so a future video can retire while
the still runs on. `video/` (Remotion) and `--push-video` stay as built for a later try;
the "IYF Video viewers 50%" audience is no longer needed. Judging rule that was set before launch:
`meta-ads/video-plan.md`, "How we will know". Harry kept the flap sound in Departures, to be
licensed later if needed (`meta-ads/creative/audio/SOURCES.md`, not in git).

**Buyers is parked (2026-09-18).** The ad set never delivered one impression in its life
(active, approved, no error on the API); the matched buyer lists are too small. It is paused,
`meta-lineup-ad.ts` is not run, `budgets.buyers` is 0 in config. Come back to it when the
lists have grown. Everything below about Buyers and the lineup ad describes what was built.

**First readout, 12 to 18 September.** Week of the 17 September show: ad spend CHF 75 against
about 31 before, site ticket clicks 460 against 139, tickets 23 against 24. Cost per landing
page view: Cold 0.18, Warm 0.24, old set 0.28, Intent 1.42 at a weekly frequency of 3.8. Meta
reports 0 ticket clicks on every ad because no ad carries the pixel as a tracking spec (the
pixel itself counts about 100 `TicketRedirect` a day); since the ads land on `/go/`, a landing
page view and a ticket click are the same event, so fixing that would add nothing. A later
test: land one Cold ad on the show page, so a ticket click becomes a real choice Meta can
optimise for. Unexplained: the site counts 4 to 11 `/go/` clicks on ads where Meta reports 0 to
3, so per-ad site counts are not yet safe for ranking small ads.

**Second readout, 12 to 21 September (written 21 September, read-only; raw files
`script/meta-out/insights-2026-09-21.md` for the four days since the budget change,
`insights-2026-09-21-10d.md`, `weekly-2026-09-21.md` and `audience-2026-09-21.md`).**

What the ten days say:

| Ad set | Spend CHF | Landing page views | CHF per view | People reached | Frequency |
|---|---|---|---|---|---|
| Cold (CHF 6 a day since 18 Sep) | 32 | 112 | 0.29 | 4,819 | 1.3 |
| Warm (CHF 5) | 30 | 114 | 0.26 | 2,386 | 2.2 |
| Intent (CHF 2) | 10 | 7 | 1.38 | 135 | 4.5 |
| Old 2024 set (CHF 1, hand boost 15 to 17 Sep) | 49 | 166 | 0.30 | 7,287 | 1.5 |

- A view costs the same from the bank ads as from the 2024 carousel (weekly 0.25 to 0.34 all
  year, 0.27 in September). Creative is not the lever. Meta runs one ad per set: `cold-C7`
  (0.18, 69 views) and `warm-W6` (0.27, 105 views); the rest are under the 30-view floor.
- Since the doubling, Cold's extra money went to the video `cold-C4v` (CHF 12.53 of 19.59 in four
  days, 0.74 per view on 17 views, its still twin `cold-C4` at 0.29 to 0.40). Cold's daily cost per
  view went 0.20, 0.45, 0.78, 0.81. Judge the video on cost per ThruPlay, not views, by 2 October.
- Intent is dead on audience size: 553 impressions at frequency 4.5 is about 120 people.
- The old set ran CHF 5 a day flat through August (about 110 views a week); at CHF 1 a day it now
  gives 0 to 4 views a day, so it is close to off.
- Tickets did not move: 17 September sold 23 of a 30-seat night (the three August 30-seat nights
  sold out on CHF 31 of ads), ads per ticket 3.24 against 1.0 to 1.5, profit CHF 125. Site
  ticket clicks tripled. 16 of the 23 came within 24 hours of the show. 24 September stood at 9 of
  60 three days out against a median pace of 7.

Reach (Harry's hypothesis, confirmed as "different people", not yet "buyers"): over 2026 the old
set reached 68,898 people; of Cold's 4,819, only 516 had ever seen it. Cold is 61 percent under 35
(old set 23 percent) and 85 percent Instagram Reels (old set 58 percent Facebook feed); people per
franc are the same, 150 against 148. The old set recycles mildly: 131k monthly reaches add up to
69k distinct people, frequency 4.9 a year, 1.5 to 1.7 a week. Part of the low overlap is targeting
(Cold 21 to 50 with exclusions, old 21 to 65 Advantage+). Warm and Intent are by construction
people who already engaged. GA's new-versus-returning is useless on `/go/` (it reads 100 percent
new for every source, WhatsApp shares included: in-app browsers keep no cookies), and the
Eventfrog order rows carry no buyer key, so first-time buyers per show cannot be counted yet.

Can the 31 October test be decided? Not on ticket counts. On 60-seat nights the last three sold
20, 24 and 26 (spread about 3 to 4); the 30-seat sellouts are censored and say nothing about
demand; telling 22 from 28 needs about seven shows per arm, and six Thursdays remain. So: judge by
sales curves (the daily poll prints pace against the median at that distance, and a curve is
readable on a 30-seat night until the ceiling bites), and by a decision rule on 60-seat nights:
if none beats 26 and the median stays under 25, drop to CHF 200 a month.

Not ours: 1,950 `/go/` clicks between 31 August and 17 September tagged meta with
`utm_content` 52672614093400 on Promessi Spassi come from an ad that is not in this ad account
(the only campaign with spend is Comedy Brew). Ignore it for Brew readings.

Decided for this week (nothing applied yet; Harry runs the writes):

1. Reset the account spending limit on the billing page. About CHF 414 was left on 21 September;
   at CHF 14 to 15 a day every ad in the account stops around 18 October.
2. Saturday: pause Intent and move its CHF 2 to Warm (`budgets.warm.base: 7`, `budgets.intent.base: 0`
   in config, then `meta-adsets.ts --apply`; pause the Intent ad set in Ads Manager or set its three
   ads to `resting` and `meta-bank.ts --sync --apply`).
3. By 2 October: read `cold-C4v` on cost per ThruPlay against `cold-C4`; if it loses on both, rest it.
4. Land `warm-W6` on `/comedybrew/` instead of `/go/` (creative link only, no targeting change). The
   page's ticket button already goes through `/go/` with the pixel event, so the pixel's ticket
   click becomes a choice made after reading, at hundreds a week, and Meta gets something closer
   to a sale to optimise on.
5. Keep running the daily poll and compare curves, not final counts.
6. No hand boosts on the old set (the 15 to 17 September boost bought clicks at the usual price
   and no tickets).
7. If real attribution is wanted: a no-discount ticket code shown only in ads, or a "how did you
   hear" purchase question (Eventfrog personalization fields), or purchase events to Meta's
   Conversions API from the order rows with hashed emails (a build and a privacy decision).


Tick as you go. A future session reads this table first.

| Phase | What | Done | Date | Notes |
|---|---|---|---|---|
| 0 | Consent line, Custom Audience Terms, exports and buyer files in `meta-ads/lists/` | steps 3 and 4 | 2026-09-13 | 476 recent, 894 lapsed; steps 1 and 2 still open |
| 1 | Ids collected into `meta-ads/config.yml`; old campaign objective and budget type written down | | | |
| 2 | TicketRedirect seen in Test events, custom conversion, 6 audiences, sizes noted | | | |
| 3 | Campaign renamed, Warm, Intent and Buyers ad sets created (paused) | | | |
| 4 | Bank ads from `meta-ads/bank/*.yml` via `meta-bank.ts`, plus the lineup ad | done | 2026-09-13 | 12 ads live: cold C1 C2 C3 C4 C7 C8, warm W1 W2 W6, intent I1 I3 I5 (in review); two clip concepts by hand; every bank creative carries the 4:5 post image for feeds and the 9:16 story image for Stories and Reels (`meta-bank.ts --restory` moved the first push onto it after Ads Manager asked for a Reels asset; a bench concept pushed later gets both from the start) |
| 5 | Budget schedules for the next four Thursdays, two automated rules | | | |
| 6 | Cold, Warm and Intent targeting written by `meta-adsets.ts` | script built | 2026-09-13 | diff verified; `--apply` to run by Harry; old ad set kept |
| 7 | App, system user, token in `.env`, curl test; scripts: helper, insights, audiences, schedule, lineup ad; cron | prelude, helper, lineup ad | 2026-09-13 | app 1741863547101457 (Live since 2026-09-13), system user iyfadsbot 61594074792364; `meta-lists.ts`, `lib/meta-api.ts`, `meta-lineup-ad.ts`, `meta-adsets.ts`, `meta-insights.ts`, `eventfrog-sales.ts` (Eventfrog read-only: sales, curve, capacity guard, Saturday review; cron lines in scripts.md, not yet installed) built; first lineup ad `lineup-2026-09-17` live in Buyers (ad 120249200016280314); audiences and schedule scripts and cron still open; creative bank per `meta-ads/creative-bank-plan.md` next |

Audience sizes after matching (fill in at phase 2): Buyers recent ____, Buyers lapsed ____,
Show clickers ____, Site visitors ____, IG engagers ____, FB engagers ____.

## Where we start and where we end

Today: one campaign, "Comedy Brew", link-click objective, one ad set at about CHF 1 a day,
boosted by hand to about CHF 15 a day for the last three days before each Thursday, targeting
everyone within 15 km of Zürich by language. It has run since 2023 and is the only trained
ad set in the account. It stays. Nothing in this plan pauses it.

End: the same campaign, renamed, with four ad sets that between them cover the five awareness
stages from the report:

| Ad set | Stages | Who | Message |
|---|---|---|---|
| Cold (the existing ad set, plus exclusions) | 1 and 2 | 15 km, languages, not in any warmer audience | English stand-up exists in Zürich; cheap, fun, low-key night out |
| Warm | 3 | engaged with us on Instagram or Facebook, or visited the site | every Thursday at ROBIN's, plan your week |
| Intent | 4 | clicked for tickets or viewed a show page, never bought | two minutes from Central, less than a cocktail, this is what it sounds like |
| Buyers | 5 | bought before (Mailchimp opt-ins) | this week's lineup, new jokes, the same but completely different |

Plus: a bank of six specific ads rotated fortnightly, the Monday lineup flyer landing in
Buyers by itself, and five small bun scripts that keep audiences, budgets and reports fresh.

That was the plan of 13 September. What runs now differs in three ways, all in Status above:
Buyers is parked, two or three ads run per set at a time with the others resting, and Cold
carries two video ads.

## Where things live

| Thing | Where | In git? |
|---|---|---|
| This plan | `meta-ads.md` | yes |
| Ids (ad account, pixel, page, audiences, ad sets) and budgets | `meta-ads/config.yml`, copied from `meta-ads/config.example.yml` | no (the example is) |
| The access token | `.env` as `META_ACCESS_TOKEN` | no |
| Ad creative you make by hand (bank images, clips) | `meta-ads/creative/` (see its README) | no |
| Email lists for customer audiences | `meta-ads/lists/` (see its README) | no, ever |
| Generated flyers and images from the lineup job | `script/meta-out/` | no |
| Scripts | `script/meta-*.ts` and `script/lib/meta-api.ts` | yes |
| Reports of spend next to clicks | `_data/reports/_meta.json`, shown on `/reports/` | yes (numbers only) |

## Ids to collect

Fill these into `meta-ads/config.yml` as you get them. The steps below say where each one comes from.

| Key | Value | Found in |
|---|---|---|
| ad_account_id | act_ | Ads Manager account dropdown, or Business settings > Ad accounts |
| pixel_id | 5349931195130820 | Events Manager > Data sources (already known, confirm) |
| page_id | | Business settings > Pages, or the Page's About > Page transparency |
| instagram_account_id | | Business settings > Instagram accounts |
| campaign_id | | Ads Manager, campaign row, the id column or the URL |
| adset_cold_id, adset_warm_id, adset_intent_id, adset_buyers_id | | Ads Manager, ad set rows |
| audience_* ids (six) | | Audiences tool, each audience's detail pane or URL |
| custom_conversion_id | | Events Manager > Custom conversions |
| app_id | | developers portal > your app > Settings > Basic |

Ids are not secrets; the token is.

## Phase 0: consent and the lists (one evening)

The customer-list audiences are built from people who opted in to Mailchimp, never from the
raw Eventfrog buyer sheet. Before any upload:

1. The site had no privacy page; `pages/privacy.md` (`/privacy/`, linked from the footer) was
   written 2026-09-13. It says that subscriber email addresses may be matched against Meta
   (Facebook and Instagram) to show them our ads, and that replying to any email or writing to
   the contact address removes them. Push it live. You should see it at
   `inyourfacecomedy.ch/privacy/`. The same URL is the app's privacy policy URL (phase 7 prelude).
2. In Ads Manager, open Audiences (menu at top left, "All tools", then "Audiences", or
   `facebook.com/adsmanager/audiences`). Click "Create audience", "Custom audience",
   "Customer list", "Next". The first time, Meta shows the Custom Audience Terms; accept them.
   Then cancel out of the wizard. You should see no more terms prompt when you come back.
3. Two exports into `meta-ads/lists/` (gitignored; `git status` must not show them):
   the ticket sales sheet ("Customer Analyser - Tickets Sold", one row per ticket with event
   date, name, email, postcode, city, price) as `tickets-YYYY-MM-DD.csv`, and the Mailchimp
   IN YOUR FACE audience filtered to Subscribed, exported as CSV, as `mailchimp-YYYY-MM-DD.csv`.
4. Run `bun script/meta-lists.ts` (add `--dry-run` first to see the counts). It keeps only
   buyers whose email is in the Mailchimp export (the opt-in is the consent), takes name, city
   and postcode from each person's newest ticket, sums what they paid into Meta's `value`
   column, and writes two files with the headers Meta maps automatically
   (`email, fn, ln, ct, zip, country, value`; country `CH` for four-digit postcodes, blank
   otherwise so Meta works it out): `buyers-recent-YYYY-MM-DD.csv` (last show within the past
   12 months, `--months` changes it), `buyers-lapsed-YYYY-MM-DD.csv` (older) and
   `buyers-all-YYYY-MM-DD.csv` (both together, the seed for the value-based lookalike in
   phase 2). The summary line "subscribed but never bought a ticket" is the rest of the
   Mailchimp list; it is not written because these audiences are buyers. First run on
   2026-09-13: 476 recent, 894 lapsed, both above Meta's floor of 100.
5. Do not upload anything yet; phase 2 does that once the ids are collected.

## Phase 1: ids, and a look at the old campaign (twenty minutes)

The developer app, system user and token are the fiddliest steps for a non-expert and nothing uses them until the scripts, so they sit at the start of phase 7. This phase only collects ids and facts.

1. Ad account id: open Ads Manager; the account name at the top left has the id under it, or
   in the URL as `act=`. Write it as `act_<number>` into config. The campaign export you
   already have is named after this account (817058156574069), so expect that number.
2. Pixel id: Events Manager (`business.facebook.com/events_manager2`), Data sources, the IN YOUR
   FACE pixel; the id is under the name. Confirm it is 5349931195130820.
3. Page id and Instagram account id: Business settings (`business.facebook.com/settings`,
   this is the settings site, not Business Suite), Accounts, Pages, click the page, the id is
   shown; same under Instagram accounts. Write both into config.
4. Open the Comedy Brew campaign and write into the status table: its objective (the export says its results are link clicks, so expect Traffic), whether the budget sits on the campaign (Advantage campaign budget) or the ad set, and the ad set's performance goal. Phase 3 depends on the objective being Traffic; if it is anything else (Engagement, Awareness), phase 3 creates a fresh campaign "IYF stages" instead and the old one runs on until phase 6 pauses it. At CHF 1 a day the old ad set has never had 50 events a week, so the history worth protecting is modest; a fresh campaign is an acceptable fallback, not a loss.

## Phase 2: events and audiences (one evening, then wait a day)

1. Confirm the pixel event from `/go/` arrives. Events Manager, the pixel, "Test events" tab,
   paste `https://inyourfacecomedy.ch/go/?show=comedybrew&debug=1`, open it from the button in
   a browser that does not have `?notrack=1` set (a private window is easiest). Within a minute
   the feed should show `PageView` and `TicketRedirect` with `content_name: comedybrew`,
   `value` and `currency`. If `TicketRedirect` shows as "unapproved" or "new", find it under the
   pixel's Overview or Custom events and approve it; until then it will not appear as a choice
   in the next steps. Close the private window.
2. Custom conversion: Events Manager, left menu "Custom conversions", "Create custom
   conversion". Name "Ticket click", data source the pixel, conversion event `TicketRedirect`.
   Meta then insists on at least one rule, even with a specific event chosen: leave the rule
   type on "URL", operator "contains", and type `/go/` (the page the event fires on; "contains"
   tolerates the `?show=...&date=...` query). An "Event parameters" rule is the alternative
   (`content_name` contains `comedy`), not needed. Category "Other" or "Lead". Value: leave it
   blank or pick "use the event's value"; the event already sends `value` and `currency` CHF,
   a typed number would overwrite that. Create. Write the id into config.
3. Audiences, in the Audiences tool, "Create audience", "Custom audience", each one:

| Name it | Source | Rule | Retention |
|---|---|---|---|
| IYF Show clickers | Website, the pixel | Event `TicketRedirect` (may sit under "Events" or "From your events"); optionally also "URL contains `/go/`" | 180 days |
| IYF Site visitors | Website, the pixel | All website visitors | 180 days |
| IYF IG engagers | Instagram account (may read "Instagram professional account") | Everyone who engaged | 365 days |
| IYF FB engagers | Facebook Page | Everyone who engaged with your Page | 365 days |
| IYF Buyers recent | Customer list | upload `buyers-recent-YYYY-MM-DD.csv`; on the mapping screen every column should show a green tick; "Upload and create" | until replaced |
| IYF Buyers lapsed | Customer list | upload `buyers-lapsed-YYYY-MM-DD.csv` | until replaced |

After each one, open it and write the audience id into config.

4. Come back the next day. Each audience shows "Ready" and a size. Write the sizes into the
   status table. Rules: a customer-list audience under 100 people will not deliver; if Buyers
   recent is under 100, delete both and upload one combined `buyers-all` file as "IYF Buyers"
   (the ad set in phase 3 then includes that one audience). Website and engagement audiences
   grow by themselves; small is fine.
5. Lookalike: "Create audience", "Lookalike audience", source IYF Buyers (or recent), location
   Switzerland, size 1%. Name "IYF Buyers lookalike 1%". Write the id into config. It is used in
   an experiment later, not in the base setup.

## Phase 3: the campaign and ad sets (one evening)

The existing campaign is kept and grows. Do not create a new one.

1. In Ads Manager, campaigns tab, find "Comedy Brew" (whatever it is called today). Check the
   objective you wrote down in phase 1 is Traffic; if not, create a new campaign "IYF stages",
   objective Traffic, manual setup, and treat the old one as read-only until phase 6. Otherwise
   rename it "IYF stages". Write the campaign id into config.
2. Check its budget setting: if "Advantage campaign budget" (campaign-level budget) is on,
   turn it off so each ad set has its own daily budget. If Meta says this cannot be changed on
   a running campaign, leave it on and set the ad set budgets as minimums instead; note it in
   the status table.
3. Rename the existing ad set "Cold". Change nothing else on it yet (phase 6 does the one
   edit). Write its id into config.
4. Create the three new ad sets, each with "Create" at the ad set level inside the campaign,
   "Manual setup" if asked:

| Ad set | Performance goal (under Optimisation and delivery) | Daily budget | Audience: include | Audience: exclude | Location, language, age |
|---|---|---|---|---|---|
| Warm | Maximise link clicks | CHF 3 | IYF IG engagers, IYF FB engagers, IYF Site visitors | IYF Show clickers, IYF Buyers recent, IYF Buyers lapsed | Zürich 15 km, English (add Italian and Spanish if the series ads run here), 18 plus |
| Intent | Maximise link clicks | CHF 2 | IYF Show clickers | IYF Buyers recent, IYF Buyers lapsed | same |
| Buyers | Maximise link clicks | CHF 2 | IYF Buyers recent, IYF Buyers lapsed | none | Switzerland (no radius; buyers travel), all languages, 18 plus |

For each: in the Audience section, if Meta shows "Advantage+ audience" as on, click "Switch to
original audience options" (may read "Switch to original audiences"). Only then do the include
and exclude lists work as hard boundaries. If the switch is not offered on this objective,
exclusions still hold but inclusions become suggestions: keep Buyers and Intent on their small
budgets and watch their reach in the weekly readout; if reach runs far past the audience size,
the ad set is spreading to strangers and the two-ad-set fallback (report section 11) applies. Custom audiences: "Include" for the first column,
the "Exclude" link under it for the second. Placements: leave "Advantage+ placements" on.
Attribution setting: 7-day click, 1-day view, if the field appears (with link-click and
landing-page-view goals it often does not; skip it). Save each ad set as paused (toggle off) and
write its id into config.

You should see four ad sets under one campaign: Cold (running, unchanged), Warm, Intent,
Buyers (paused, no ads yet).

## Phase 4: creative and the first ads (one weekend)

Superseded 2026-09-13 by the creative bank in `meta-ads/creative-bank-plan.md`: the concepts
per ad set live in `meta-ads/bank/{cold,warm,intent}.yml`, `bun script/meta-bank.ts --render
--local` paints them through the site's `/adcard/` and `/week/` pages into
`meta-ads/creative/bank/` (contact sheet `index.html` there), and the ad creation step of the
same script follows. The table below is the first draft of the bank and stays for the record.

The bank, from report section 11.3. Make six images (4:5 for feed, 9:16 for stories where the
tool offers it) and save them under `meta-ads/creative/bank/<hook>/`:

| Hook folder | Ad name | Primary text | Made with | Goes in |
|---|---|---|---|---|
| newcomer | newcomer-v1 | New in Zürich and know nobody yet? Thursday, Niederdorf, English, CHF 10, no one will make you talk. | Plain text over an audience photo | Cold |
| coffee | coffee-v1 | Costs less than the coffee you are holding. Every Thursday at ROBIN's, two minutes from Central. | Week Story, Ticket or Chalkboard style | Cold, Warm |
| plain | plain-v1 | Thursday, 19:30, ROBIN's, ten comedians. That is the whole ad. | Plain text, Swiss style | Warm |
| proof | proof-v1 | This is what it sounds like. (ten seconds of the room laughing, no text) | Phone clip, cut on the phone | Intent |
| central | central-v1 | Two minutes from Central, less than a cocktail, every Thursday. Tickets on the door too. | Flyer Maker, Bold Type | Intent |
| region | region-v1 | Winterthur, Baden, Zug: it is 25 minutes and the last train home is after the show. | Station board style | Cold |

Then:

1. Links: open `/linkbuilder/`, pick the show (Comedy Brew, series link, no date for bank ads),
   source `meta`. One link for all bank ads; the Buyers ad uses the date link for the coming
   Thursday. Do not type `utm_content`: in each ad, the "URL parameters" field (under the
   website URL, may sit behind "Show more options") takes `utm_content={{ad.name}}`, and Meta
   fills in the ad's own name at click time. That removes one copy-paste mismatch per ad;
   `/go/` passes the parameter through and `/reports/` lists clicks under it.
2. In Ads Manager, inside each ad set, "Create" an ad: name it as in the table, upload the
   image (or clip), paste the primary text, headline "Comedy Brew, Thursday at ROBIN's", website
   URL the link from step 1, URL parameters `utm_content={{ad.name}}`, call to action "Get
   tickets" (may read "Book now"). Publish.
3. The Buyers ad is the script's (`bun script/meta-lineup-ad.ts`, phase 7, running since
   2026-09-13): the Lineup-style flyer stamped "THIS THURSDAY", five primary texts, five
   headlines and five descriptions from `meta-ads/lineup-copy.yml` written for people who have
   been before (no name list; they remember the night, not the names), Book Now, the date link.
   Meta shows one text per person and learns the pairing. Edit the copy file and run
   `--replace --activate` to change the words; the ad set allows one ad, so the script updates
   it in place each week.
4. Turn the three new ad sets on, on a Monday. Cold keeps running as before.
5. Review: every new ad shows "In review" for an hour to a day. A rejection shows in the ad
   row with a reason; edit what it names and resubmit. Do not resubmit unchanged.

You should see: four ad sets active, seven ads (six bank plus the lineup), each with a tagged
link. In `/reports/comedybrew/` the next day, clicks appear under `utm_content` per ad.

## Phase 5: budget schedule and rules (half an hour, then monthly)

1. Budget schedule on Warm and Intent: open the ad set, "Budget and schedule", under the
   daily budget tick "Increase your budget during specific time periods" (may be behind "Show
   more options"), "Create budget schedule": start Tuesday 06:00, end Thursday 23:00, increase
   by a fixed amount: Warm to CHF 10 (plus 7), Intent to CHF 5 (plus 3). Add one entry per
   Thursday for the next four weeks. Meta allows up to 50 per ad set. Cold gets no schedule:
   its base already covers the week, and prospecting is not where the last three days pay.
   Buyers needs none: `meta-lineup-ad.ts` runs it at the ramp figure (CHF 8) from the Monday
   you activate the lineup ad until 18:00 on show day (`lineup.ends_at` in config; the script
   sets the ad set's end time, next week's run moves it on). Between shows the ad set reads
   "Completed" in Ads Manager; that is the schedule working.
2. Rule one: "All tools", "Automated rules", "Create rule". Apply to: all active ad sets in the
   campaign. Condition: cost per link click greater than CHF 1.00, over the last 7 days, with at
   least 30 link clicks (rules take fixed amounts, not averages; revisit the number monthly
   against the readout). Action: turn off the ad set. Schedule: daily. Notify by email.
3. The cap: a notify rule does not stop spend. Set the account spending limit instead: Business
   settings, Ad accounts, your account, "Set spending limit" (may sit under Payment settings in
   Ads Manager). It is set to CHF 600 and stays there. It is a running total, not a monthly
   figure: Meta pauses everything in the account when the count reaches it, and Harry resets
   the counter on the same page, about once a month at the experiment's spend.
3a. Frequency: there is no frequency cap on Traffic ad sets (it exists only for the Reach
   objective), so the Frequency column in the weekly readout is the check; over 5 on Buyers in
   a week means rotate its creative.
4. Monthly: add the next month's Thursdays to the three schedules. The schedule script in
   phase 7 replaces this chore.

## Phase 6: the three ad sets get their targeting (by script, 2026-09-13)

What happened instead of the original plan: phase 3 created Cold, Warm and Intent as fresh ad
sets, and the 2024 ad set kept running beside them (Harry's decision, 2026-09-13: it works,
review in a month). The three new sets were shells (all Switzerland, 18 to 65, profile visits,
Advantage+ on, CHF 20 a day each, no audiences), so their targeting is written by script from
the `targeting:` block in `meta-ads/config.yml`, per `meta-ads/creative-bank-plan.md`:

| | Cold | Warm | Intent |
|---|---|---|---|
| Location | Zürich 30 km, home and recent | Switzerland | Switzerland |
| Age | 21 to 50 | 18 to 65 | 18 to 65 |
| Languages | the old ad set's 31 | none | none |
| Include | nobody | IG and FB engagers | Site visitors, Show clickers |
| Exclude | every warm audience and both buyer lists | Site visitors, Show clickers, buyers | buyers |
| Goal | landing page views, website, pixel, 1-day click | same | same |
| Budget | CHF 3 | CHF 3 (ramp 10) | CHF 2 (ramp 5) |

```
bun script/meta-adsets.ts            # the diff, nothing written
bun script/meta-adsets.ts --apply    # write it (asks per ad set)
```

Run the diff first and read it; then apply. Expect "Learning" on each set once ads go in. The
old ad set and Buyers are never written by this script. On 18 September 2026 the
bases went to Cold 6 and Warm 5 with Buyers at 0 and `monthly_cap_chf` at 600; the script then
projected CHF 522 for the month with the old ad set at CHF 1 a day (Harry's show-week boosts of
the old set come on top and are not in that figure).

Result types in Ads Manager (checked on the API 2026-09-14): the Results column follows the ad set's conversion location (`destination_type`) and goal, not the ad's link. Cold, Warm and Intent report Landing Page Views because their goal is landing page views (a link click that loaded the page: the stricter count, chosen on purpose); Buyers reports Link Clicks (goal link clicks, destination website; the buyer lists are too small to learn on page views); the old 2024 set reports Link Clicks with the 2024 default destination. Until 2026-09-14 Buyers still carried the hand-made shell's "Instagram profile and Facebook page" destination, so Ads Manager counted Instagram Profile Visits and optimised for them; `meta-lineup-ad.ts` now writes and checks destination WEBSITE on every run. The weekly readout counts inline link clicks and landing page views for every ad set whatever the goal, so the rows stay comparable.

Meta's recommendations (the pills in Ads Manager): the Friday readout prints them in a "Meta recommendations" section from the account recommendations edge and the per-object field, with Meta's lift estimate and a deep link. Policy: read weekly, decide on Saturday, act by hand in Ads Manager or through our own scripts behind `--apply`; nothing is ever applied automatically, and the Advantage+ ones (audience, placements, creative features) stay off by the strategy's choice unless run as a named experiment on one ad set. Standing items as of 2026-09-14: "add a 9:16 video with audio to Reels" on Cold, Warm, Intent and the old set (answered by the two phone clips, W8 and I2; the 9:16 image half was met on 2026-09-13); "targeted languages don't match text" on cold-C3 (accepted: the ad is in German on purpose, the set targets German among its 31 languages, Meta's confidence is LOW). Not every pill reaches the API; the second one per ad set on 2026-09-14 did not.

## Phase 7 prelude: API access (one evening, do it when you start the scripts)

1. Create the app: `developers.facebook.com/apps`, "Create app". The 2026 flow asks for a use
   case; pick the business or ads one (label may read "Manage business integrations" or
   "Other" then "Business"). Name it "IYF ads tools". You should land on an app dashboard.
2. On the app dashboard, "Add product" (may read "Add use case" or "Products"), find
   "Marketing API", "Set up". Write the App id (Settings, Basic) into config. You do not need
   the app secret for what follows. Then switch the app from Development to Live (the "App
   Mode" toggle at the top of the dashboard or Settings, Basic; Meta wants a privacy policy
   URL, use `https://inyourfacecomedy.ch/privacy/`, and an app category first). Reading the
   account works in Development mode; creating an ad creative does not (error 1885183 "created
   by an app that is in development mode").
3. System user: not in the app dashboard. Open Meta Business Suite settings for the portfolio,
   `business.facebook.com/latest/settings/system_users?business_id=<business id>`, left menu
   Users, System users, "Add". Meta first asks you to accept its non-discrimination policy on
   behalf of system users. Name "iyfadsbot" (no hyphens allowed), role Admin. You should see
   it listed with an id; write it into config as `system_user_id`.
4. Give it assets: select the system user, "Add assets" (may read "Assign assets"). Ad accounts:
   pick yours, turn on "Manage ad account" (full control). Pages: pick the page, "Manage Page".
   Apps: pick "IYF ads tools", full control. Datasets or Pixels: pick the pixel if the list
   offers it.
5. Token: on the system user, "Generate new token" (may read "Generate token"). Pick the app.
   Expiry: choose "Never" if offered, else 60 days and note the date in the status table.
   Permissions: tick `ads_management`, `ads_read`, `business_management`,
   `pages_read_engagement`. Generate, copy the token once; Meta does not show it again.
6. Put it in `.env` as `META_ACCESS_TOKEN=...` and nowhere else. `.env` is gitignored.
7. Test it from the repo root (replace the id):

```
curl -s "https://graph.facebook.com/v23.0/act_817058156574069?fields=name,currency,account_status&access_token=$(grep META_ACCESS_TOKEN .env | cut -d= -f2)"
```

You should see a JSON object with the account name, `"currency":"CHF"` and
`"account_status":1`. An error naming permissions means step 7 or 8 missed the ad account;
an error naming the token means it was pasted wrong or has expired.

Notes. If Meta asks for business verification when you create the app or assign assets, do it (it is a one-time upload of a business document) or stop here and keep working in Ads Manager by hand; nothing in phases 2 to 6 needs the token. Managing your own ad account inside your own business needs no App Review; that is
Meta's standard (since May 2026 "Marketing API Access Tier", starting at "Limited") level,
which is enough for these scripts. App Review only applies to acting on other people's
accounts. The API version in the curl (`v23.0`) is in `config.yml` as `api_version`; bump it
when Meta retires the old one (they announce this in the app dashboard).

## Phase 7: the scripts (built one at a time, in this order)

All bun, TypeScript, one runnable file each, `--dry-run` on every one, secrets from `.env`,
ids and budgets from `meta-ads/config.yml`, a Healthchecks ping per job, log under
`script/*.log`. The Meta scripts share one small helper, `script/lib/meta-api.ts`, the same
exception the GA report already uses (`script/lib/ga-report-lib.ts`).

| Script | Job | Cron |
|---|---|---|
| `script/lib/meta-api.ts` | token from `.env`, `api_version` from config, `get` and `post` with error printing, paging | none |
| `script/meta-insights.ts` | built 2026-09-13: per ad, Meta's spend, impressions, frequency, link clicks, landing page views and ticket clicks beside the site's `/go/` count, floors and verdicts, flags for frequency and cost per ticket click; writes `script/meta-out/insights-<date>.{md,json}`; `--apply` pauses the retire verdicts (never Buyers or the old ad set) | Fridays 09:00 |
| `script/meta-adsets.ts` | built 2026-09-13: writes Cold, Warm and Intent targeting, goal, destination, attribution and base budgets from config `targeting:`; diff by default, `--apply` writes; refuses a write that would push the projected month over `monthly_cap_chf` | none (run by hand after a config change) |
| `script/meta-audiences.ts` | read the newest Mailchimp export in `meta-ads/lists/` (later: the Mailchimp API with the last-show tag), split recent and lapsed, normalise and SHA-256 the emails, replace the users of both customer-list audiences, print sizes | Fridays 09:00, after the week's ticket import |
| `script/meta-schedule.ts` | read `_data/calendar.yml`, write budget schedules for next month's shows on the ramped ad sets (Tuesday 06:00 to show day 23:00), never touching Cold | 1st of the month 09:00 |
| `script/meta-lineup-ad.ts` | read the Grist `Lineups` table (in the Comedians Directory document, the one `sync-comedians.rb` uses; columns `date` Date, `show` Text, `link` Text, `style` Choice of the eight Flyer Maker keys; created 2026-09-13 with the 2026-09-17 row) for the next Comedy Brew; render the flyer by opening the lineup link in headless Chrome and calling the page's own draw function, post and story sizes, into `script/meta-out/`; upload images, create the creative (names in running order, calendar Info line, date, time, price, the date link with `utm_content=lineup`), create the ad in Buyers, pause last week's; fallback to the week story with the host's name if no row by Tuesday 09:00; Friday run pauses the show's ad | Mon 13:00, Mon 18:00, Tue 09:00, Fri 09:00 |

Env names: `META_ACCESS_TOKEN`, `META_ADS_HEALTHCHECKS_URL` (one check for the four jobs is
acceptable to start; split later if a missed run gets masked).

Later, not now: `ViewContent` on show pages and `TicketClick` on the site's ticket buttons
(report 11.4) give a five-step readout per ad; the Eventfrog Organizer API read key, if it works
on the Free plan, replaces the Mailchimp export as the source for `meta-audiences.ts`; a
second-visit-rate script over the Eventfrog export is the quarterly number the report asks for.

## Weekly readout (ten minutes: Friday insights, Saturday review)

```
bun script/meta-insights.ts            # Friday: last 14 days, every ad set, verdict per ad
bun script/meta-insights.ts --apply    # every second Friday: pause the "retire" ads
bun script/eventfrog-sales.ts --review # Saturday: tickets and profit per show beside the spend, the ramp verdict for the coming week
```

The Saturday review (`script/eventfrog-out/review-<date>.md`, strategy at
`~/Documents/2026-09-13-comedy-brew-sales-tracking-strategy.md` section 9) is where the ramp for
the coming week is set: full, half or off from the verdict, with `meta-adsets.ts --apply` or in
Ads Manager. When the verdict is a cut, that is the week's one change. Write the confounders
(lineup, holidays, weather) on the review's first line before reading the numbers.

The readout (`script/meta-out/insights-<date>.md`) puts Meta's spend, link clicks, landing
page views and ticket clicks beside the site's `/go/` count for the same `utm_content`, and
gives each ad a verdict: untested (under the floors: 10 ticket clicks, else 30 landing page
views), keep, retire (worse than 1.5 times the ad set's median), starved (under the floor for
four weeks while siblings passed), change (the creative floor, next paragraph). The site count is the ground truth; ranking is inside one
ad set only. Never compare Cold with Intent. Never touch targeting or the performance goal on
a running ad set; retire and replace in one batch at the fortnight boundary. Ads Manager still
works for a glance: Amount spent, Link clicks, Landing page views, Frequency, last 7 days.

The creative floor (29 September): the question "after this many impressions, how many clicks
should an ad have made?" is answered from the 2024 carousel, the one creative with a year of
data in this account. Over 2026 it made 6,204 link clicks on 347,797 impressions, 1.8 per
hundred, and since June it runs 2.0 to 2.2 a month (its Reels placements 1.9, so the placement
mix does not excuse a bank ad). The bank's own ads that work sit at 2.1 to 2.7. The floor is
half the carousel: `insights.ctr_floor_impressions: 500` and `insights.ctr_floor: 1.0`, so an
ACTIVE ad with 500 or more impressions in the window and under 1.0 link clicks per hundred
(fewer than 5 clicks at 500, fewer than 10 at 1,000) gets the verdict "change": the picture or
the line is being scrolled past, and a pause fixes nothing, a new card does. Why 500 and 1.0:
at the carousel's 2.0 an ad expects 10 clicks per 500 impressions, and a healthy ad falls to 5
or fewer about one time in fifteen, so the verdict is rarely wrong and becomes safe by 1,000.
Retire outranks change, the change verdict never counts against the retire cap, and `--apply`
does not act on it: the answer is a new concept in the bank (or a new headline on the same
photo) and `meta-bank.ts --refresh --only <id>`, after which the readout counts that ad from the
refresh date. Between the floor and the carousel (1.0 to 1.8) an ad is on watch, not condemned:
read it again with 1,000 impressions.

Warm's cut rule (28 September): Warm is a pool of about 10,000 people and repeats within weeks,
so when the readout shows its 7-day frequency above 3.5 (`insights.frequency_flag`) or its cost
per landing page view above CHF 0.35 for a week, set `budgets.warm.base: 4` and run
`meta-adsets.ts --apply`; the freed franc goes to Cold. Intent is paused since 28 September and
its audiences sit in Warm; the readout still lists it with zeros.

After four Comedy Brews with all four ad sets live, compare cost per link click per ad set.
If Warm and Intent are not clearly cheaper than Cold, collapse them into Cold (report section
11: two ad sets, Everyone and Buyers) and keep the bank. Buyers stays in either case.

## When things go wrong

| Symptom | Do |
|---|---|
| Customer-list audience says too small, or an ad set will not deliver | Merge recent and lapsed into one Buyers audience; never target under 100 matched |
| An ad is rejected | Read the reason on the ad row; edit that thing; resubmit. Keep a note here of what tripped it, the first time it happens |
| Token error in a script or the curl test | Business settings, System users, generate a new token with the same permissions, replace in `.env`, rerun the curl in phase 1 |
| "Learning limited" on Buyers or Intent | Acceptable; they are small by design. Act only if Cold shows it |
| Your own visits in the audiences | Open `/?notrack=1` once on every browser and phone you use; it also keeps you out of GA |
| A week with no lineup by Tuesday | The lineup job posts the week story with the host's name; or do it by hand as in phase 4 step 3 |
| Meta moved a button | Look for the thing the step describes; update the label in this file |

Rules that bite: never edit targeting or the performance goal on a running ad set mid-week
(creative and links are free to change); never boost posts from Instagram (the export shows
them at two to five times the cost per click); never upload the raw Eventfrog sheet; never
commit `meta-ads/config.yml`, anything under `meta-ads/lists/`, `script/meta-out/` or `.env`.

## For the next session

Start with the Status section at the top: it says what is running, what is parked and what the
experiment is judged on. Things waiting, in order:

From 4 October, first:

- Wednesday 7 October: check that the 07:30 run opened `cold-tomorrow` and `warm-tomorrow` with the rain ads (C22, W16) in `script/meta-moments.log` or on the board; Thursday the same for `cold-tonight` and `warm-tonight` (C25, W19). An ad set whose window ended last week taking a new end date is the open question (`moments-plan.md`, section 3).
- The readout (`meta-insights.ts`) does not list the six moment ad sets yet; until it does, read them in Ads Manager or `/reports/` (`utm_campaign` is the ad set name, `utm_content` the ad name).
- Still to build: the weather backtest before the rain boost is trusted, and a sold-out check before tonight opens. Meta may spend up to 75% over a daily budget on one day, which matters for the one-day tonight ad sets.

The week of 21 September: the "Decided for this week" list in the second readout (Status) comes first.

1. The laugh set is live since the evening of 26 September (Status, "Round two is the laugh set"); adding nine ads put every set back into learning, and the Warm targeting change of 28 September did it again for Warm, so read nothing into the first few days. Intent was paused on 28 September (Status).
2. The Friday readout (`bun script/meta-insights.ts`): the new ads reach the 30-view floor after a week or two; read them against C7 and W6, and expect Meta to feed one or two per set. The CTR column and the "change" verdict (creative floor, Weekly readout) say which card to redo; W10 and W11 are the ones to watch, C17 restarted on 29 September.
3. About 2 October, also: narrow Warm from all of Switzerland to Zürich plus about 50 km (in the first week only 54 percent of Warm's and 36 percent of Intent's impressions fell in canton Zürich; Cold's 30 km gave 81 percent), so the ad sets re-learn once.
4. Thursday's show: an applause take for the closing logo, and a word with the venue about the room recording. More video concepts are in `meta-ads/video-plan.md`.
5. 31 October: the experiment's review.

Location targeting holds: 99 to 100 percent of every ad set's impressions were in Switzerland in the first week, the rest Germany. Followers abroad are in the Warm audience but never served, because every ad set is limited to people living in or recently in its area.

How people move between ad sets, with nothing done by hand (wiring of 28 September): a like, comment, save or follow puts someone among the Instagram or Facebook engagers, and a click lands on `/go/`, which puts them among Site visitors and Show clickers; Cold excludes all four audiences and Warm includes all four, so anyone who touched an ad or the site moves from Cold to Warm. Intent (Site visitors plus Show clickers on their own) is paused since 28 September: under 1,000 people, frequency 7. Until 28 September Warm excluded the two website audiences, so a cold clicker skipped Warm and landed in Intent. Known gap, left open on purpose: the buyer lists were uploaded once on 13 September, so someone who bought since still sees Warm ads.

### Pixel matching (read 28 September)

The two website audiences (Site visitors, Show clickers) stay under 1,000 people while the pixel
receives about 4,500 PageViews and 700 TicketRedirects a month, and Events Manager shows no
Event Match Quality score for either event. Read in Events Manager on 28 September: the pixel
sends no customer information parameters at all (automatic advanced matching off, every
parameter off, no Conversions API, dataset category none, first-party cookies on), so matching
rests on the browser cookie and the click id alone, and Meta only scores match quality when
customer parameters arrive. The likely main cause is not the pixel but Apple's App Tracking
Transparency: pixel events from iOS users who declined tracking (most of them) are not used to
build website audiences (secondary sources, not Meta's own text: thread-transfer.com and
peripherydigital.com iOS 14 guides). An Instagram Reels funnel in Zürich is mostly iOS, so the
website pools will stay small whatever the pixel does.

Not done, on purpose: automatic advanced matching was left off. It only ever reads customer
fields (email, phone, name) from forms on the page, the ad path (`/go/`) has no such form, and
turning it on would send hashed newsletter form data to Meta for no gain on this problem. What
does carry a cold clicker into Warm is the Instagram engagers audience: Meta counts a button tap
or link tap on an ad as engagement (secondary sources: jonloomer.com, keepersdigital.com), and
that audience is built on the platform, so App Tracking Transparency does not thin it. That is
why IG engagers sits at 5,300 to 6,300 people while Site visitors stays under 1,000. If a fuller
website pool is ever wanted, the route is the Conversions API from the `/go/` redirect or from the
Eventfrog order rows (a build and a privacy decision, see the 21 September next-step notes).


Ticket sales against the ads: the strategy is at `~/Documents/2026-09-13-comedy-brew-sales-tracking-strategy.md`. It is built as `script/eventfrog-sales.ts` (`scripts.md`), run by hand for now; the cron lines in `automation.md` are not installed.

Read the status table above first, then `meta-ads/config.example.yml` for the keys, then the
report sections the current phase names. The pixel and the `TicketRedirect` event on `/go/`
are already live (commit 4704fe7, documented in `campaign-links.md`); do not redo them.

# Creative bank plan: Cold, Warm, Intent (2026-09-13)

Status: DRAFT, waiting for Harry's approval. Nothing on Meta changes until the questions at
the end are answered. The readout this plan rests on is `script/meta-out/old-adset-readout.md`
(gitignored, regenerate with `bun script/meta-insights.ts --adset old` once that exists).

## What the old ad set taught us

1. One text took 31% of three years' spend and 60% of all landing page views: "Lost in
   Zürich? Find your funny." The newcomer angle is proven; the generic "laughter and good
   vibes" lines are not.
2. The carousel cards linked to bit.ly, so about half of all clicks bypassed /go/, the pixel
   and the site report. Every new ad carries one link, through /go/, with `utm_content`.
3. Link-click optimisation plus Advantage+ bought 55+ men on the Facebook feed at CHF 0.19 a
   click. Whether they buy tickets was never measured. From now on the loop ranks by ticket
   clicks (custom conversion 1344551088742033), and the ad sets optimise for landing page
   views until an ad set clears 50 ticket clicks a week.
4. The three new ad sets are shells at CHF 20 a day each. They are rewritten by script before
   any ad goes in.

## The shape

Four ad sets, as built. Each of Cold, Warm and Intent carries up to six single-text ads at a
time from a bank of concepts; Buyers keeps the lineup ad. Ads are evergreen (no dates, no
comedian names, no prices), so review lag and expiry do not matter. Every fortnight the
readout retires the worst one or two per ad set and the next concepts from the bank take
their slots. Images come from three sources: the site's gallery (363 photos scored by type,
faces and aesthetics), a new `/adcard/` page that paints a headline over a photo or on a
brand field in the flyer palette (rendered headless, like the lineup flyer), and the logo.

### Why single-text ads

A multi-text creative (asset_feed_spec) flips the ad set to dynamic creative, which allows one
ad per ad set. The bank needs six ads side by side, so each bank ad is one body, one headline,
one description, one image. Text variants are separate ads, which is also what makes the
readout per text possible.

## Targeting per ad set (written by `meta-adsets.ts`)

| | Cold | Warm | Intent |
|---|---|---|---|
| Location | Zürich, 30 km radius (question 1), home and recent | Switzerland | Switzerland |
| Age | 21 to 50 (question 2) | 18 to 65 | 18 to 65 |
| Languages | the old ad set's 31, copied by id | none (audience carries it) | none |
| Include | nobody in particular | IG engagers, FB engagers | Site visitors, Show clickers |
| Exclude | IG engagers, FB engagers, Site visitors, Show clickers, Buyers recent, Buyers lapsed | Site visitors, Show clickers, Buyers recent, Buyers lapsed | Buyers recent, Buyers lapsed |
| Advantage+ audience | off | off | off |
| Optimisation | landing page views | landing page views | landing page views |
| Placements | automatic | automatic | automatic |
| Daily budget | CHF 3 base | CHF 3 base, ramp 10 | CHF 2 base, ramp 5 |

Intent as defined in the runbook (show clickers only) cannot deliver: that audience is 20 to
1,000 people and Meta reports it too small. Site visitors (about 1,000, ready) plus show
clickers is the nearest thing to intent we own, and Warm becomes engagers only. When show
clickers passes 1,000 the include list narrows back.

Monthly arithmetic against the CHF 500 cap in `config.yml`: bases 3 + 3 + 2 + 2 = CHF 10 a day,
CHF 300 a month; ramps (Tuesday to Thursday, four shows) add about 3 × (7 + 3 + 6) × 4 = CHF 192;
total about CHF 490. The old ad set's CHF 5 a day (CHF 150) does not fit on top of that, which
is one reason it is paused when Cold goes live (question 3). `meta-adsets.ts` refuses to apply
budgets whose sum times 30.4 plus the ramps exceeds `monthly_cap_chf`, and Meta does not read
the config file, so the account spending limit in Business settings stays as the hard stop.

Facts checked on the API today: the campaign is OUTCOME_TRAFFIC with ad set budgets (no
campaign budget), so per-ad-set budgets are real and landing page views is a valid goal. The
three shells and Buyers have `destination_type` INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE (they were
created as profile-visit sets); the script sets WEBSITE with the pixel as the promoted object,
which the goal change needs. Attribution is already 1-day click on every ad set; the script
keeps it at click-only (no view-through), so Warm and Intent cannot collect credit for ads
nobody clicked.

## The bank: Cold (never heard of us)

Each ad names one person. Bodies at most 125 characters, headline under 40, one description.
The link for all Cold ads: `/go/?show=comedybrew&utm_source=meta&utm_medium=paid_social&utm_campaign=cold`
with `utm_content={{ad.name}}` set in the ad's URL parameters so the site report lists
clicks per ad.

| # | Person | Body | Headline | Image |
|---|---|---|---|---|
| C1 | The newcomer (the proven angle, kept as control) | Lost in Zürich? Find your funny. English stand-up every Thursday, two minutes from Central. | Lost in Zürich? Find your funny. | Gallery: packed audience laughing (canape_PXXX8236), logo top left |
| C2 | New in town, knows nobody | New in Zürich and know nobody yet? Thursday night, English stand-up near Central. Nobody will make you talk. | New in Zürich? Start here. | Adcard: photo style over an audience shot, headline on the image |
| C3 | The Swiss person (in German) | Live-Comedy auf Englisch, jeden Donnerstag in Zürich. Dein Englisch reicht, versprochen. | Comedy auf Englisch. Dein Englisch reicht. | Adcard: Swiss style (paper, red circle), headline in Inter 800 |
| C4 | Anyone who likes the joke | Switzerland has four official languages and one everyone actually speaks. Stand-up in it, every Thursday in Zürich. | Comedy in Switzerland's fifth language | Adcard: Swiss style, the four language names small, ENGLISH big |
| C5 | The student | Student in Zürich? Ten comedians, one Thursday, walking distance from ETH and Uni. Bring the flatmate. | Thursday, ten acts, near ETH | Adcard: chalkboard style |
| C6 | The visitor | In Zürich this week? There is English stand-up on Thursday, two minutes from the main station. The locals go. | In Zürich on a Thursday? | Gallery: room shot with the stage, logo; location type "recent" does the targeting |
| C7 | The relocated European | Moved to Zürich for work? Your colleagues laugh here on Thursdays. English stand-up, ten acts, near Central. | Where Zürich's expats laugh | Adcard: photo style, audience shot with many faces |
| C8 | The native English speaker | Missing a proper comedy night? Zürich has one every Thursday. Ten acts, all in English, near Central. | A proper comedy night. In Zürich. | Gallery: performer mid-bit (no name in the ad; the photo is anonymous at feed size) |
| C9 | The person who does not want to socialise | Want to be around people without talking to anyone? Sit in the dark and laugh. Thursdays, Zürich, in English. | A night out with no small talk | Adcard: Bold Type style, three lines |
| C10 | The doubter | Yes, there is English stand-up in Zürich. Every Thursday since 2021, ten comedians, one room near Central. | English stand-up in Zürich. Really. | Logo composition: logo large on the brand red, headline under it |
| C11 | The regional commuter | Winterthur, Baden, Zug: it is 25 minutes and the last train home is after the show. Thursdays, English stand-up. | 25 minutes and a late train home | Adcard: station board style |
| C12 | Italian and Spanish speakers | Stand-up in italiano a Zurigo (Promessi Spassi) and the Spanish twin (La Tarima): the series' own flyers | per series | Flyer Maker, the series flyer; only if the series has a date in the calendar |

Six live at a time: C1, C2, C3, C4, C7, C8 first (control, newcomer, Swiss, the joke, expat,
native). C5, C6, C9, C10, C11 wait for the first retirements. C12 runs when a series has a date.

## The bank: Warm (follow us or visited, never clicked for tickets)

Link: `utm_campaign=warm`, same show link, `utm_content={{ad.name}}`.

| # | Person | Body | Headline | Image |
|---|---|---|---|---|
| W1 | The planner | Every Thursday. Plan the week around it. Comedy Brew at ROBIN's, ten comedians, two minutes from Central. | Thursdays are sorted | Week Story, station board (this week's real list, refreshed weekly by the lineup script's fallback) |
| W2 | The follower who has not been | Following is nice. Sitting in the room is better. Thursday, 19:30, ROBIN's, ten acts. | Have you actually been? | Gallery: audience shot from the stage |
| W3 | The person who worries one act will be bad | Ten comedians, five minutes each. If one is not for you, the next one is on in five minutes. | Ten acts. Something will land. | Adcard: Bold Type, "10 x 5 min" |
| W4 | The friend | Know someone who needs a laugh? Thursday at ROBIN's. Two tickets, one good deed. | Bring the one who needs it | Gallery: two people laughing together |
| W5 | The habit | Same night, same room, a different show every week. Comedy Brew, Thursdays since 2021. | Same night. Different show. | Adcard: Swiss style |
| W6 | The visual doubter | This is what a Thursday looks like. Comedy Brew, ROBIN's, two minutes from Central. | This is what Thursday looks like | Gallery: the best room shot, no text on the image |
| W7 | The calendar reader | Comedy Brew is Thursday; the rest of the week is on the calendar. English stand-up in Zürich, most nights. | This week in Zürich | Week Story, departures board; link to /go/ for Comedy Brew |
| W8 | The person who saw a clip | You have seen the clips. Now hear the room. Thursday at ROBIN's, doors 19:00. | Now hear the room | Phone clip (Harry), ten seconds of laughter |

## The bank: Intent (clicked for tickets, never bought)

Link: `utm_campaign=intent`, `utm_content={{ad.name}}`.

| # | Person | Body | Headline | Image |
|---|---|---|---|---|
| I1 | The practical one | Two minutes from Central, less than a cocktail, ten comedians. Thursday. Tickets on the door too. | Two minutes from Central | Adcard: photo style over the stage shot |
| I2 | The one who needs proof | This is what it sounds like. | Thursday, ROBIN's | Phone clip, room laughing, no text |
| I3 | The one worried about getting home | Still deciding? The last train home is after the show and the door is two minutes from Central. | The last train is after the show | Adcard: station board |
| I4 | The one who wants a seat | Doors 19:00, show 19:30, seats go. Thursday at ROBIN's. Come early, the bar is open. | Doors 19:00. Seats go. | Adcard: chalkboard |
| I5 | The solo visitor | Solo is fine. Half the room came alone. Thursday, English stand-up, near Central. | Half the room came alone | Gallery: audience, mixed |
| I6 | The one waiting for a reason | Not sure about the lineup? Nobody is. That is the fun of ten acts in one night. | Ten acts. Nobody knows. | Adcard: Bold Type |
| I7 | The weather excuse | Rain or not, the show is inside and the bar is open. Thursday at ROBIN's. | It is indoors | Adcard: photo style |
| I8 | The one who nearly booked | Thursday is nearly here. Comedy Brew, ROBIN's, 19:30. Tickets take a minute. | Tickets take a minute | Logo composition |

Optionally the weekly lineup ad also runs in Intent as a single-text version (question 4).

## Images: the three tools

1. **Gallery pick.** `_data/gallery.yml` has type (audience, performer, moment), face count,
   aesthetic score and featured flag per photo. Rule for bank ads: type audience, aesthetic
   0.6 and up, faces 2 and up, centre-cropped to 4:5 and 9:16, logo at 8% width top left,
   the headline on the image in Anton on a dark scrim at the bottom. Performer photos only
   for C8 and only where the face is small at feed size. The manifest of chosen photos per
   concept lives in the bank YAML so a re-render is identical.
2. **`/adcard/`**, a new hidden page (noindex) with `window.__iyfDrawAdCard(canvas, params,
   format)`, params `headline`, `sub`, `style` (photo, swiss, type, chalk, station, logo) and
   `photo` (a gallery src). It reuses the flyer palette, fonts and contrast pairs
   (`newStylePairs()` gets one entry per new text-on-field pair, so `bun test` holds WCAG).
   Rendered by the same headless Brave CDP pipeline `meta-lineup-ad.ts` already uses.
3. **Week Story** styles for W1 and W7 via `__iyfDrawWeek` (already exists), refreshed weekly.

Video: two phone clips from Harry (room laughing; a ten-second act with the laugh). The
script accepts an mp4 per concept and uploads it as a video creative.

## The loop: `meta-insights.ts` and the retire rule

Every Friday (cron) and on demand:

1. Pull per-ad insights for the campaign for the last 7, 14 and 28 days: spend, impressions,
   link clicks, landing page views, ticket clicks (`offsite_conversion.custom.1344551088742033`),
   plus the same per ad set and for the old ad set.
2. Join the site report: `_data/reports/comedybrew.json` `by_campaign[].content[]` lists /go/
   clicks per `utm_content`, which is the ad name, so each row also shows what the site saw.
3. Two truths, printed side by side: Meta's ticket clicks (custom conversion, 1-day click) and
   the site's /go/ clicks for the same `utm_content`. The site count is the ground truth for
   ranking, because it does not depend on the pixel loading before the redirect or on Meta
   matching the visitor; Meta's number is there to show the gap. Ranking is only ever inside
   one ad set, never across ad sets, because Cold sends the visitors that Intent later converts.
4. Event floors, not impression floors, because Meta concentrates spend and a starved ad never
   reaches 2,000 impressions: rank by cost per ticket click once an ad (or its concept pool)
   has 10 ticket clicks in 14 days; else by cost per landing page view once it has 30; else
   the ad is "untested". At CHF 10 a day the whole account produces maybe 15 to 60 ticket
   clicks a month, so in month one the ranking pools ads by concept (newcomer, Swiss, expat,
   proof, practical, and so on) and retires concepts, not single texts.
5. Retire rule: past the floor, an ad or pool whose metric is worse than 1.5 times its ad
   set's median over 14 days is marked "retire"; at most two per ad set per fortnight; never
   the last two ads of an ad set. Starved rule: an ad still under the floor after two
   fortnights while its siblings passed it has been rejected by the auction and is rotated out
   (not "failed"). Replace rule: the next bench concept in the bank YAML for that ad set, in
   order. All retire and replace edits happen in one batch at the fortnight boundary, never
   mid-fortnight, because every significant edit restarts the ad set's learning.
6. Output: `script/meta-out/insights-<date>.md` (the table, one row per ad, verdicts) and
   `.json`; default is read-only. `--apply` pauses the "retire" ads and prints the concepts to
   add; `meta-bank.ts` creates them. The Friday readout in docs/meta-ads.md points at this file.
   Each fortnight's readout is tagged with the number of show dates inside it, so a fortnight
   with two Comedy Brews is not compared blindly with one that had a holiday.
7. Frequency guard: the readout pulls audience size and 7-day frequency per ad set and flags
   anything over 3.5. Warm (about 7,000 engagers) and Intent (about 1,000 site visitors) are
   small; the flag is what tells us an ad set has run out of people before Meta does.

Guards: the old ad set is reported but never touched by `--apply`. A cost per ticket click
over CHF 3 for a whole ad set over 14 days is printed in red as the signal to look at the
ad set, not the ads. Starting counts: Cold six ads, Warm three, Intent three, so each ad gets
enough of the spend to reach a floor.

## Scripts to build, in order

| Script | Reads | Writes | Flags |
|---|---|---|---|
| `meta-insights.ts` | config, API insights, site report | `script/meta-out/insights-<date>.{md,json}` | `--days 14`, `--adset`, `--apply`, `--dry-run` |
| `meta-adsets.ts` | `meta-ads/config.yml` targeting block (new), audience ids | the three ad sets' targeting, goal, budget, Advantage+ | `--dry-run` (prints a diff per field), `--adset` |
| `/adcard/` page + painter | `assets/js/lineup-maker-2000.js` (shared palette) | new `pages/adcard.md`, painter in the js, tests for pairs | none (site) |
| `meta-bank.ts` | `meta-ads/bank/{cold,warm,intent}.yml`, gallery.yml, clips | rendered images in `meta-ads/creative/bank/`, image hashes, creatives, ads PAUSED | `--group cold`, `--only C2,C3`, `--render-only`, `--activate`, `--dry-run` |
| cron | | Friday 09:00 insights; Monday lineup (drafted) | |

## Files

- `meta-ads/bank/cold.yml`, `warm.yml`, `intent.yml`: tracked (concepts, bodies, headlines,
  descriptions, image spec per concept, `status: live | bench | retired` with dates).
- `meta-ads/creative/bank/`: rendered PNGs and clips, gitignored.
- `script/meta-out/`: readouts and insights, gitignored.
- `meta-ads/config.yml`: a `targeting:` block per ad set (gitignored; example file updated).
- `docs/meta-ads.md`: phase 4 rewritten to point at the bank and the scripts; phase 6 becomes the
  ad set rewrite; the weekly readout section names `meta-insights.ts`.

## Sessions

1. This one: readout and plan. Stop.
2. `meta-adsets.ts` (dry-run diff, then apply after a look) and `meta-insights.ts` read-only
   over the old ad set and Buyers. Budgets drop from CHF 60 a day to CHF 8 the same session.
3. `/adcard/` painter with the six styles, contrast tests, the three bank YAMLs, a render-only
   run so Harry can look at thirty images before any ad exists.
4. `meta-bank.ts`: upload, creatives, six ads per ad set paused, then `--activate` on a Monday.
5. The first Friday readout, the retire rule tuned on real numbers, cron installed.

## Questions for Harry

1. **Radius.** You said 15 km; the old ad set ran 34 km and 12% of buyers come from
   Winterthur, Baden and Zug (20 to 30 km). Recommendation: 30 km, with C11 speaking to them.
   —> Agreed ✅
3. **Cold age range.** Old set bought 55+ men at the cheapest clicks. Recommendation: 21 to 50
   for Cold as the experiment; if the buyer list ever says otherwise, add a 50+ ad set.
   —> Agreed ✅
5. **The old ad set.** It cannot serve as a control: its cards bypass /go/ (undercounted by
   construction), it optimises for link clicks not landing page views, it has no warm
   exclusions so it collects retargeting credit, and it overlaps Cold in the auction.
   Recommendation: pause it the day Cold goes live, reclaim CHF 150 a month, and carry its
   winning text forward as C1. Alternative: keep it two more weeks and read it as "what CPC
   used to be", nothing more.
   —> No keep it for the foreseeable future - it works. We can review that in a month+
7. **Intent gets the lineup ad too?** Recommendation: yes, as a single-text version created by
   the lineup script beside the bank ads, so the people closest to buying also see this
   Thursday's bill.
   —> Agreed ✅
9. **German-language Cold ads.** Recommendation: yes, C3 first, a second one if it lands; the
   old ad set's language list includes German, French and Italian, so Swiss people are reached.
   —> Agreed ✅
11. **Warm and Intent as one ad set for month one?** Intent's audience is about 1,000 people;
   at CHF 2 a day with three ads everyone sees everything within days, and neither set will
   ever leave learning at 50 events a week. Recommendation: run Warm and Intent as two ad
   sets anyway for the first month, because the point is to learn which message each group
   answers, but accept that Intent is read on landing page views and frequency, not ticket
   clicks; merge them the moment the frequency flag fires twice. Alternative: one retargeting
   ad set (engagers plus site visitors, buyers excluded) carrying both banks from day one,
   which doubles the events per set.
   —> Agreed with recommendation ✅

## Applied from the advisor's review (2026-09-13)

Budget refusal in the ad set script and the account spending limit as the hard stop; event
floors instead of the impression floor; concept pools in month one; the starved rule; batched
fortnight edits; the old ad set demoted from control; two truths in the readout with the site
count as ground truth; ranking within an ad set only; click-only attribution kept; frequency
flag; show-count tag per fortnight; the language list checked (German, French and Italian are
in it). Crops: every image is rendered in 4:5 and 9:16 with the headline inside the safe zone
that the flyer engine already defines (`keyTop`, `keyBottom`), so stories and reels do not cut
it off.

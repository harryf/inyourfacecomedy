# Search Console loop: week of 2026-10-19

Snapshot window 2026-09-19 to 2026-10-16 (28 days of final data, 225 query and page pairs with 3 or more impressions over 67 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-07-19 to 2026-10-16 (90 days, 338 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-10-19T08:40:02.456Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-08-18 | 300 | 6405 | 4.7% | 9.0 | 52 |
| 2026-08-25 | 283 | 6641 | 4.3% | 8.9 | 51 |
| 2026-09-01 | 316 | 7141 | 4.4% | 8.8 | 57 |
| 2026-09-08 | 317 | 7479 | 4.2% | 8.5 | 57 |
| 2026-09-15 | 368 | 8233 | 4.5% | 7.7 | 57 |
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |

Devices this window: mobile 7942 impressions at position 6.8; desktop 2482 impressions at position 7.0; tablet 66 impressions at position 6.6.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 28 | improved | position -1.4, clicks 25 to 43 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 28 | improved | position -2.3, clicks 1 to 3 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 28 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 28 | worse | position -0.7, clicks 6 to 4 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 28 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 28 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 211 | 8 | 3.9 |
| stand up comedy zurich | 178 | 15 | 6.1 | 197 | 24 | 5.2 |
| comedy zurich | 110 | 1 | 7.1 | 80 | 4 | 7.0 |
| comedy zürich | 120 | 1 | 14.0 | 117 | 1 | 6.9 |
| comedy club zurich | 39 | 0 | 7.9 | 62 | 4 | 7.4 |
| comedy club zürich | 18 | 1 | 7.5 | 45 | 1 | 7.5 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 56 | 0 | 6.3 |
| stand up comedy | 108 | 0 | 6.3 | 138 | 1 | 6.1 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 53 | 3 | 11.3 |
| open mic zurich | 11 | 1 | 9.8 | 4 | 0 | 5.0 |
| open mic comedy zürich | 13 | 1 | 9.1 | 8 | 2 | 10.5 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 4 | 1 | 11.0 |
| swiss stand up comedians | 0 | 0 | n/a | 5 | 0 | 7.2 |
| swiss comedian | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 31 | 3 | 5.1 |
| teddy hall | 133 | 4 | 8.6 | 85 | 1 | 7.9 |
| teddy hall comedian | 0 | 0 | n/a | 12 | 0 | 5.5 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 9 | 0 | 8.9 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 50 | 1 | 6.0 |
| comedy shows 2026 | 4 | 0 | 6.5 | 4 | 1 | 3.0 |
| comedy 2026 | 3 | 0 | 12.7 | 17 | 0 | 6.8 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 4 | 0 | 8.0 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 4 | 0 | 6.5 |
| comedy auftritte 2026 | 0 | 0 | n/a | 3 | 0 | 4.3 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 20.1% | 7.0% | 9.8% | 4.4% | 3.1% | 1.9% | 1.5% | 0.7% | 0.8% | 1.4%* | 1.2%* | 1.7% | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.8% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 70.3 | bottom of page one, aim higher | stand up comedy | / | 360 | 2 | 5.9 |  |  |
| 57.6 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2083 | 7 | 10.0 |  | yes |
| 50.0 | bottom of page one, aim higher | stand up comedy zurich | / | 523 | 55 | 5.6 |  |  |
| 40.6 | bottom of page one, aim higher | comedy shows zurich | / | 207 | 1 | 6.5 |  |  |
| 24.5 | ranks well, few clicks: the listing text | stand up comedy zürich | / | 633 | 20 | 3.9 |  |  |
| 23.2 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 236 | 0 | 7.9 |  | yes |
| 15.1 | bottom of page one, aim higher | ruben garcia | /comedians/ruben-garcia/ | 75 | 0 | 6.5 |  | yes |
| 13.8 | bottom of page one, aim higher | stand up comedy schweiz | / | 151 | 1 | 7.6 | schweiz |  |
| 11.0 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 55 | 0 | 6.3 |  | yes |
| 10.9 | bottom of page one, aim higher | robins bar | /comedybrew/ | 121 | 1 | 7.8 |  |  |
| 10.8 | bottom of page one, aim higher | standup comedy | / | 59 | 1 | 6.2 | standup |  |
| 10.0 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 55 | 1 | 6.3 |  |  |
| 9.9 | bottom of page one, aim higher | teddy hall comedy | /comedians/teddy-hall/ | 74 | 5 | 5.6 |  | yes |
| 9.7 | bottom of page one, aim higher | standup comedy zurich | / | 73 | 5 | 6.0 | standup |  |
| 8.3 | bottom of page one, aim higher | comedy zurich | / | 288 | 12 | 6.9 |  |  |
| 7.8 | bottom of page one, aim higher | english comedy | / | 39 | 0 | 5.6 |  |  |
| 7.4 | bottom of page one, aim higher | comedy club zurich | / | 116 | 4 | 7.6 |  |  |
| 7.3 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 329 | 7 | 8.8 |  | yes |
| 6.3 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 5.2 | bottom of page one, aim higher | comedy show zürich | / | 117 | 3 | 7.2 |  |  |
| 5.1 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 87 | 1 | 4.4 |  | yes |
| 4.9 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 98 | 2 | 3.9 |  | yes |
| 4.7 | bottom of page one, aim higher | comedy show | / | 48 | 0 | 8.4 |  |  |
| 4.6 | bottom of page one, aim higher | standup | / | 23 | 0 | 6.0 | standup |  |
| 4.4 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 27 | 1 | 5.6 |  | yes |

### Two pages share one query

- open mic zürich: 2 pages share this query: /comedybrew/ (191 @ 14.0), / (54 @ 9.8)
- comedy show zürich: 2 pages share this query: / (117 @ 7.2), /calendar/ (34 @ 11.4)
- english stand up comedy: 2 pages share this query: / (75 @ 22.0), /calendar/ (14 @ 9.4)
- open mic comedy zürich: 2 pages share this query: / (49 @ 6.5), /comedybrew/ (30 @ 10.1)
- comedy show: 2 pages share this query: / (48 @ 8.4), /calendar/ (27 @ 10.2)
- comedy shows: 2 pages share this query: / (48 @ 18.9), /calendar/ (14 @ 9.5)
- stand-up comedy zürich english: 2 pages share this query: / (43 @ 2.9), /calendar/ (8 @ 10.6)
- open mic comedy: 2 pages share this query: / (32 @ 4.8), /comedybrew/ (8 @ 4.5)
- comedy shows zürich: 2 pages share this query: / (28 @ 7.4), /calendar/ (17 @ 10.6)
- comedy night zürich: 2 pages share this query: / (24 @ 6.7), /calendar/ (15 @ 13.5)
- english comedy night: 2 pages share this query: / (23 @ 8.1), /calendar/ (13 @ 37.7)
- comedy brew: 2 pages share this query: /comedybrew/ (22 @ 3.0), / (19 @ 3.9)
- zürich comedy: 2 pages share this query: / (19 @ 7.5), /calendar/ (4 @ 12.3)
- stand-up comedy zürich: 2 pages share this query: / (15 @ 1.7), /calendar/ (8 @ 8.4)
- mike casa: 2 pages share this query: /comedians/mike-casa/ (15 @ 10.9), /mike-casa/ (7 @ 8.6)
- comedy switzerland: 3 pages share this query: / (12 @ 21.8), /calendar/ (8 @ 52.9), /switzerland/ (6 @ 10.5)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 302.4)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 12355 impressions, 716 clicks, position 7.1
- Words the queries use that the page does not: schweiz (288), standup (167), comedian (89), night (81), emmvee (15), heute (15), matt (14), rife (14)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 360 | 2 | 5.9 | 70.3 |  |
| stand up comedy zurich | bottom of page one, aim higher | 523 | 55 | 5.6 | 50.0 |  |
| comedy shows zurich | bottom of page one, aim higher | 207 | 1 | 6.5 | 40.6 |  |
| stand up comedy zürich | ranks well, few clicks: the listing text | 633 | 20 | 3.9 | 24.5 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 151 | 1 | 7.6 | 13.8 | schweiz |
| standup comedy | bottom of page one, aim higher | 59 | 1 | 6.2 | 10.8 | standup |
| standup comedy zurich | bottom of page one, aim higher | 73 | 5 | 6.0 | 9.7 | standup |
| comedy zurich | bottom of page one, aim higher | 288 | 12 | 6.9 | 8.3 |  |
| english comedy | bottom of page one, aim higher | 39 | 0 | 5.6 | 7.8 |  |
| comedy club zurich | bottom of page one, aim higher | 116 | 4 | 7.6 | 7.4 |  |
| comedy show zürich | bottom of page one, aim higher | 117 | 3 | 7.2 | 5.2 |  |
| comedy show | bottom of page one, aim higher | 48 | 0 | 8.4 | 4.7 |  |

### /comedybrew/ (gain 28.5)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2619 impressions, 194 clicks, position 10.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 121 | 1 | 7.8 | 10.9 |  |
| robins coffee | bottom of page one, aim higher | 36 | 0 | 8.1 | 3.5 |  |
| robins bar and coffee | bottom of page one, aim higher | 34 | 0 | 7.8 | 3.3 |  |
| robins | bottom of page one, aim higher | 40 | 0 | 7.0 | 2.8 |  |
| robin's bar & coffee | bottom of page one, aim higher | 56 | 3 | 8.2 | 2.5 |  |
| robins zurich | bottom of page one, aim higher | 25 | 0 | 7.7 | 2.5 |  |
| robins bar zurich | bottom of page one, aim higher | 30 | 0 | 8.6 | 1.3 |  |
| robins zürich | bottom of page one, aim higher | 10 | 1 | 5.9 | 1.0 |  |
| robins coffee zurich | page two, aim for page one | 24 | 0 | 13.3 | 0.5 |  |
| open mic zurich | bottom of page one, aim higher | 23 | 2 | 8.4 | 0.3 |  |
| open mic zürich | page two, aim for page one | 191 | 4 | 14.0 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 30 | 3 | 10.1 | 0.0 |  |

### /calendar/ (gain 19.7)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 3490 impressions, 65 clicks, position 8.0
- Words the queries use that the page does not: standup (14)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | bottom of page one, aim higher | 55 | 1 | 6.3 | 10.0 |  |
| comedy 2026 | bottom of page one, aim higher | 22 | 0 | 7.6 | 2.2 |  |
| stand up comedy zürich | bottom of page one, aim higher | 60 | 1 | 9.1 | 1.6 |  |
| comedy zurich | bottom of page one, aim higher | 23 | 1 | 7.9 | 1.3 |  |
| comedy show | bottom of page one, aim higher | 27 | 0 | 10.2 | 0.8 |  |
| comedy zürich | page two, aim for page one | 39 | 0 | 12.0 | 0.7 |  |
| comedy show zürich | page two, aim for page one | 34 | 0 | 11.4 | 0.6 |  |
| english stand up comedy | bottom of page one, aim higher | 14 | 0 | 9.4 | 0.6 |  |
| comedy | bottom of page one, aim higher | 17 | 0 | 9.5 | 0.5 |  |
| comedy shows | bottom of page one, aim higher | 14 | 0 | 9.5 | 0.4 |  |
| comedy shows zürich | bottom of page one, aim higher | 17 | 0 | 10.6 | 0.3 |  |
| comedy night zürich | page two, aim for page one | 15 | 0 | 13.5 | 0.3 |  |

### /mike-casa/ (gain 4.4)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 169 impressions, 5 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa zurich | bottom of page one, aim higher | 27 | 1 | 5.6 | 4.4 |  (name) |

### /nerdycomedyshow/ (gain 1.6)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 312 impressions, 16 clicks, position 10.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 1.3 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.4 |  (name) |

### /comedians/ (gain 1.0)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 476 impressions, 6 clicks, position 6.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| valerie mirindi | bottom of page one, aim higher | 10 | 0 | 8.3 | 1.0 | valerie, mirindi (name) |

### /pulpnonfiction/ (gain 0.6)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 81 impressions, 8 clicks, position 11.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 2 | 6.3 | 0.6 |  (name) |

### /filippo-spreafico/ (gain 0.5)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 254 impressions, 24 clicks, position 6.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 26 | 0 | 14.9 | 0.5 | filippo, spreafico (name) |

### /switzerland/ (gain 0.0)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 443 impressions, 3 clicks, position 6.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 20 | 1 | 9.5 | 0.0 |  |

## Comedian pages (meta-only)

15 comedian pages carry opportunities worth 158.3 extra clicks a quarter over 3309 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: andrearamirez (20), comedian (14), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 58.0 | andrea ramirez | 2083 | 10.0 | yes |
| /comedians/woocash/ | 23.2 | woocash | 236 | 7.9 | yes |
| /comedians/teddy-hall/ | 20.0 | teddy hall comedy | 74 | 5.6 | yes |
| /comedians/ruben-garcia/ | 15.1 | ruben garcia | 75 | 6.5 | yes |
| /comedians/emir-tonbul/ | 11.0 | tonbul | 55 | 6.3 | yes |
| /comedians/miguel/ | 7.2 | miguel zürich | 25 | 8.4 | yes |
| /comedians/coopernik/ | 6.3 | nik | 64 | 7.6 | yes |
| /comedians/albert-louw/ | 5.1 | albert louw | 87 | 4.4 | yes |
| /comedians/richard-cunha/ | 4.9 | richard cunha | 98 | 3.9 | yes |
| /comedians/vasilis-theof/ | 3.0 | theof | 15 | 5.7 | yes |
| /comedians/martinadoescomedy/ | 1.8 | martina comedy | 10 | 8.4 | yes |
| /comedians/laugh-at-domenico/ | 1.3 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.7 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.5 | roza | 12 | 9.3 | yes |
| /comedians/mike-casa/ | 0.3 | mike casa | 15 | 10.9 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| woocash | /comedians/woocash/ | 67 | 7.6 | 10.5 |


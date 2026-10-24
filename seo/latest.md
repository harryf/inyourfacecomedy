# Search Console loop: week of 2026-10-24

Snapshot window 2026-09-24 to 2026-10-21 (28 days of final data, 237 query and page pairs with 3 or more impressions over 70 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-07-24 to 2026-10-21 (90 days, 354 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-10-24T07:31:45.610Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-08-25 | 283 | 6641 | 4.3% | 8.9 | 51 |
| 2026-09-01 | 316 | 7141 | 4.4% | 8.8 | 57 |
| 2026-09-08 | 317 | 7479 | 4.2% | 8.5 | 57 |
| 2026-09-15 | 368 | 8233 | 4.5% | 7.7 | 57 |
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |

Devices this window: mobile 7960 impressions at position 6.5; desktop 2611 impressions at position 7.3; tablet 69 impressions at position 6.6.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 33 | improved | position -1.7, clicks 25 to 46 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 33 | improved | position -2.2, clicks 1 to 3 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 33 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 33 | worse | position -0.4, clicks 6 to 2 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 33 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 33 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 196 | 7 | 3.5 |
| stand up comedy zurich | 178 | 15 | 6.1 | 195 | 22 | 5.1 |
| comedy zurich | 110 | 1 | 7.1 | 73 | 4 | 6.5 |
| comedy zürich | 120 | 1 | 14.0 | 118 | 3 | 6.5 |
| comedy club zurich | 39 | 0 | 7.9 | 61 | 5 | 6.9 |
| comedy club zürich | 18 | 1 | 7.5 | 53 | 3 | 7.0 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 53 | 0 | 5.2 |
| stand up comedy | 108 | 0 | 6.3 | 152 | 2 | 6.1 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 46 | 3 | 11.4 |
| open mic zurich | 11 | 1 | 9.8 | 4 | 0 | 5.0 |
| open mic comedy zürich | 13 | 1 | 9.1 | 8 | 2 | 10.5 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 5 | 1 | 10.2 |
| swiss stand up comedians | 0 | 0 | n/a | 6 | 0 | 7.0 |
| swiss comedian | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 30 | 2 | 5.3 |
| teddy hall | 133 | 4 | 8.6 | 61 | 0 | 8.2 |
| teddy hall comedian | 0 | 0 | n/a | 17 | 0 | 5.5 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 9 | 0 | 9.3 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 47 | 0 | 6.0 |
| comedy shows 2026 | 4 | 0 | 6.5 | 4 | 1 | 2.5 |
| comedy 2026 | 3 | 0 | 12.7 | 16 | 0 | 6.3 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 4 | 0 | 8.0 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 4 | 0 | 6.5 |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 19.9% | 6.7% | 7.4% | 4.3% | 2.9% | 1.9% | 1.5% | 0.6% | 1.5% | 1.4%* | 1.2%* | 2.0% | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 1.1% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 74.5 | bottom of page one, aim higher | stand up comedy | / | 389 | 3 | 5.8 |  |  |
| 53.2 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2101 | 7 | 9.9 |  | yes |
| 53.2 | bottom of page one, aim higher | stand up comedy zurich | / | 543 | 55 | 5.6 |  |  |
| 41.6 | bottom of page one, aim higher | comedy shows zurich | / | 214 | 1 | 6.4 |  |  |
| 24.5 | ranks well, few clicks: the listing text | stand up comedy zürich | / | 646 | 19 | 3.8 |  |  |
| 15.6 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 212 | 0 | 8.0 |  | yes |
| 12.7 | bottom of page one, aim higher | standup comedy | / | 69 | 1 | 5.8 | standup |  |
| 12.0 | bottom of page one, aim higher | stand up | / | 60 | 0 | 6.2 |  |  |
| 12.0 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 65 | 1 | 6.2 |  |  |
| 10.0 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 50 | 0 | 6.3 |  | yes |
| 9.0 | bottom of page one, aim higher | stand up comedy schweiz | / | 149 | 1 | 7.3 | schweiz |  |
| 8.0 | bottom of page one, aim higher | robins bar | /comedybrew/ | 122 | 1 | 7.8 |  |  |
| 7.3 | bottom of page one, aim higher | standup comedy zurich | / | 77 | 8 | 6.0 | standup |  |
| 7.0 | bottom of page one, aim higher | comedy zurich | / | 282 | 12 | 6.8 |  |  |
| 6.8 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 317 | 7 | 8.8 |  | yes |
| 6.4 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 37 | 1 | 5.8 |  | yes |
| 6.4 | bottom of page one, aim higher | open mic comedy zürich | / | 47 | 3 | 6.5 |  |  |
| 5.6 | bottom of page one, aim higher | comedy show zürich | / | 128 | 3 | 6.8 |  |  |
| 5.4 | bottom of page one, aim higher | comedy night zürich | / | 27 | 0 | 6.0 | night |  |
| 4.7 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 100 | 2 | 3.9 |  | yes |
| 4.7 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 4.5 | bottom of page one, aim higher | ruben garcia | /comedians/ruben-garcia/ | 67 | 0 | 6.6 |  | yes |
| 4.5 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 81 | 1 | 4.2 |  | yes |
| 4.4 | bottom of page one, aim higher | standup | / | 22 | 0 | 6.5 | standup |  |
| 3.7 | bottom of page one, aim higher | comedy show | / | 50 | 0 | 8.1 |  |  |

### Two pages share one query

- comedy zürich: 2 pages share this query: / (410 @ 10.9), /calendar/ (89 @ 10.9)
- open mic zürich: 2 pages share this query: /comedybrew/ (186 @ 14.2), / (54 @ 9.6)
- comedy show zurich: 2 pages share this query: / (136 @ 6.9), /calendar/ (29 @ 8.2)
- comedy show zürich: 2 pages share this query: / (128 @ 6.8), /calendar/ (78 @ 10.8)
- english comedy zurich: 2 pages share this query: / (121 @ 3.3), /calendar/ (24 @ 9.2)
- comedy: 2 pages share this query: / (114 @ 10.1), /calendar/ (31 @ 10.0)
- standup comedy zürich: 2 pages share this query: / (110 @ 4.2), /calendar/ (21 @ 11.2)
- english stand up comedy: 2 pages share this query: / (65 @ 20.4), /calendar/ (15 @ 9.4)
- comedy show: 2 pages share this query: /calendar/ (55 @ 10.0), / (50 @ 8.1)
- comedy shows: 2 pages share this query: / (50 @ 18.5), /calendar/ (20 @ 9.5)
- stand-up comedy zürich english: 2 pages share this query: / (47 @ 2.9), /calendar/ (11 @ 10.5)
- open mic comedy zürich: 2 pages share this query: / (47 @ 6.5), /comedybrew/ (30 @ 10.1)
- stand up zürich: 2 pages share this query: / (39 @ 3.4), /calendar/ (7 @ 10.3)
- comedy night zurich: 2 pages share this query: / (34 @ 7.3), /calendar/ (8 @ 7.8)
- open mic comedy: 2 pages share this query: / (32 @ 4.8), /comedybrew/ (8 @ 4.5)
- comedy shows zürich: 2 pages share this query: / (31 @ 7.3), /calendar/ (30 @ 10.0)
- comedy night zürich: 2 pages share this query: / (27 @ 6.0), /calendar/ (26 @ 12.0)
- comedy brew: 2 pages share this query: /comedybrew/ (24 @ 2.8), / (21 @ 4.0)
- english comedy night: 2 pages share this query: / (22 @ 8.3), /calendar/ (14 @ 35.2)
- open mic zurich: 2 pages share this query: /comedybrew/ (22 @ 8.3), / (4 @ 4.5)
- zürich comedy: 2 pages share this query: / (20 @ 6.8), /calendar/ (9 @ 10.6)
- comedy night: 2 pages share this query: / (18 @ 3.5), /calendar/ (4 @ 7.5)
- stand-up comedy zürich: 2 pages share this query: / (18 @ 1.8), /calendar/ (10 @ 8.2)
- comedy in english: 2 pages share this query: / (17 @ 26.5), /calendar/ (4 @ 11.3)
- mike casa: 2 pages share this query: /comedians/mike-casa/ (17 @ 10.7), /mike-casa/ (15 @ 8.1)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- comedy switzerland: 3 pages share this query: / (12 @ 22.3), /calendar/ (9 @ 51.7), /switzerland/ (6 @ 10.5)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 302.7)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 12906 impressions, 737 clicks, position 6.9
- Words the queries use that the page does not: schweiz (303), standup (181), comedian (94), night (83), nightwash (15), heute (15), matt (13), rife (13)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 389 | 3 | 5.8 | 74.5 |  |
| stand up comedy zurich | bottom of page one, aim higher | 543 | 55 | 5.6 | 53.2 |  |
| comedy shows zurich | bottom of page one, aim higher | 214 | 1 | 6.4 | 41.6 |  |
| stand up comedy zürich | ranks well, few clicks: the listing text | 646 | 19 | 3.8 | 24.5 |  |
| standup comedy | bottom of page one, aim higher | 69 | 1 | 5.8 | 12.7 | standup |
| stand up | bottom of page one, aim higher | 60 | 0 | 6.2 | 12.0 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 149 | 1 | 7.3 | 9.0 | schweiz |
| standup comedy zurich | bottom of page one, aim higher | 77 | 8 | 6.0 | 7.3 | standup |
| comedy zurich | bottom of page one, aim higher | 282 | 12 | 6.8 | 7.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 47 | 3 | 6.5 | 6.4 |  |
| comedy show zürich | bottom of page one, aim higher | 128 | 3 | 6.8 | 5.6 |  |
| comedy night zürich | bottom of page one, aim higher | 27 | 0 | 6.0 | 5.4 | night |

### /calendar/ (gain 26.2)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 4111 impressions, 78 clicks, position 8.1
- Words the queries use that the page does not: standup (21)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | bottom of page one, aim higher | 65 | 1 | 6.2 | 12.0 |  |
| stand up comedy zürich | bottom of page one, aim higher | 104 | 1 | 8.6 | 3.5 |  |
| comedy zurich | bottom of page one, aim higher | 37 | 1 | 7.8 | 1.7 |  |
| comedy 2026 | bottom of page one, aim higher | 25 | 0 | 7.4 | 1.7 |  |
| comedy show | bottom of page one, aim higher | 55 | 0 | 10.0 | 1.6 |  |
| comedy show zürich | bottom of page one, aim higher | 78 | 0 | 10.8 | 1.5 |  |
| comedy | bottom of page one, aim higher | 31 | 0 | 10.0 | 0.9 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 10 | 0 | 8.2 | 0.7 |  |
| comedy zürich | bottom of page one, aim higher | 89 | 1 | 10.9 | 0.7 |  |
| english stand up comedy | bottom of page one, aim higher | 15 | 0 | 9.4 | 0.7 |  |
| comedy shows | bottom of page one, aim higher | 20 | 0 | 9.5 | 0.6 |  |
| comedy night zürich | page two, aim for page one | 26 | 0 | 12.0 | 0.5 |  |

### /comedybrew/ (gain 21.5)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2656 impressions, 197 clicks, position 10.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 122 | 1 | 7.8 | 8.0 |  |
| robins | bottom of page one, aim higher | 39 | 0 | 6.9 | 2.6 |  |
| robins bar and coffee | bottom of page one, aim higher | 35 | 0 | 7.9 | 2.6 |  |
| robins coffee | bottom of page one, aim higher | 30 | 0 | 8.2 | 2.2 |  |
| robins zurich | bottom of page one, aim higher | 25 | 0 | 7.5 | 1.7 |  |
| robins bar zurich | bottom of page one, aim higher | 34 | 0 | 8.8 | 1.5 |  |
| robins zürich | bottom of page one, aim higher | 12 | 1 | 6.0 | 1.4 |  |
| robin's bar & coffee | bottom of page one, aim higher | 55 | 3 | 8.2 | 1.1 |  |
| robins coffee zurich | page two, aim for page one | 25 | 0 | 13.2 | 0.5 |  |
| open mic zürich | page two, aim for page one | 186 | 4 | 14.2 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 30 | 3 | 10.1 | 0.0 |  |
| open mic zurich | bottom of page one, aim higher | 22 | 2 | 8.3 | 0.0 |  |

### /mike-casa/ (gain 7.5)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 220 impressions, 5 clicks, position 6.5

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa zurich | bottom of page one, aim higher | 37 | 1 | 5.8 | 6.4 |  (name) |
| mike casa | bottom of page one, aim higher | 15 | 0 | 8.1 | 1.1 |  (name) |

### /nerdycomedyshow/ (gain 1.6)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 318 impressions, 16 clicks, position 11.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 1.3 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 265 impressions, 25 clicks, position 6.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 32 | 1 | 14.2 | 0.0 | filippo, spreafico (name) |

### /pulpnonfiction/ (gain 0.0)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 82 impressions, 8 clicks, position 11.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 12 | 1 | 6.7 | 0.0 |  (name) |

### /switzerland/ (gain 0.0)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 460 impressions, 3 clicks, position 6.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 21 | 1 | 9.4 | 0.0 |  |

## Comedian pages (meta-only)

15 comedian pages carry opportunities worth 120.7 extra clicks a quarter over 3201 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: andrearamirez (18), comedian (18), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 53.6 | andrea ramirez | 2101 | 9.9 | yes |
| /comedians/woocash/ | 15.6 | woocash | 212 | 8.0 | yes |
| /comedians/teddy-hall/ | 10.3 | teddy hall | 317 | 8.8 | yes |
| /comedians/emir-tonbul/ | 10.0 | tonbul | 50 | 6.3 | yes |
| /comedians/miguel/ | 6.5 | miguel zurich | 12 | 6.2 | yes |
| /comedians/richard-cunha/ | 4.7 | richard cunha | 100 | 3.9 | yes |
| /comedians/coopernik/ | 4.7 | nik | 64 | 7.6 | yes |
| /comedians/ruben-garcia/ | 4.5 | ruben garcia | 67 | 6.6 | yes |
| /comedians/albert-louw/ | 4.5 | albert louw | 81 | 4.2 | yes |
| /comedians/vasilis-theof/ | 3.0 | theof | 15 | 5.7 | yes |
| /comedians/laugh-at-domenico/ | 1.0 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/martinadoescomedy/ | 0.8 | martina comedian | 19 | 8.9 | yes |
| /comedians/dr-val/ | 0.7 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.5 | roza | 12 | 9.3 | yes |
| /comedians/mike-casa/ | 0.3 | mike casa | 17 | 10.7 | yes |


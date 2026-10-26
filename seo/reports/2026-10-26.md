# Search Console loop: week of 2026-10-26

Snapshot window 2026-09-26 to 2026-10-23 (28 days of final data, 237 query and page pairs with 3 or more impressions over 71 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-07-26 to 2026-10-23 (90 days, 353 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-10-26T09:26:03.169Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-09-01 | 316 | 7141 | 4.4% | 8.8 | 57 |
| 2026-09-08 | 317 | 7479 | 4.2% | 8.5 | 57 |
| 2026-09-15 | 368 | 8233 | 4.5% | 7.7 | 57 |
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |

Devices this window: mobile 8133 impressions at position 6.6; desktop 2738 impressions at position 7.7; tablet 71 impressions at position 6.6.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 35 | improved | position -1.8, clicks 25 to 47 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 35 | improved | position -2.2, clicks 1 to 3 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 35 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 35 | worse | position -0.0, clicks 6 to 2 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 35 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 35 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 202 | 9 | 3.1 |
| stand up comedy zurich | 178 | 15 | 6.1 | 190 | 22 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 69 | 3 | 6.7 |
| comedy zürich | 120 | 1 | 14.0 | 113 | 3 | 6.5 |
| comedy club zurich | 39 | 0 | 7.9 | 62 | 5 | 6.9 |
| comedy club zürich | 18 | 1 | 7.5 | 55 | 3 | 7.0 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 52 | 0 | 5.2 |
| stand up comedy | 108 | 0 | 6.3 | 155 | 2 | 6.1 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 47 | 3 | 11.4 |
| open mic zurich | 11 | 1 | 9.8 | 4 | 0 | 5.0 |
| open mic comedy zürich | 13 | 1 | 9.1 | 7 | 1 | 11.4 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 5 | 1 | 7.6 |
| swiss stand up comedians | 0 | 0 | n/a | 7 | 0 | 7.3 |
| swiss comedian | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 30 | 2 | 5.4 |
| teddy hall | 133 | 4 | 8.6 | 59 | 0 | 8.7 |
| teddy hall comedian | 0 | 0 | n/a | 18 | 0 | 5.5 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 10 | 0 | 9.4 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 48 | 0 | 5.9 |
| comedy shows 2026 | 4 | 0 | 6.5 | 4 | 1 | 2.5 |
| comedy 2026 | 3 | 0 | 12.7 | 15 | 0 | 6.5 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 4 | 0 | 8.0 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 4 | 0 | 6.5 |
| comedy auftritte 2026 | 0 | 0 | n/a | 3 | 0 | 5.0 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 20.3% | 6.8% | 7.2% | 4.4% | 2.8% | 1.7% | 1.6% | 0.6% | 1.3% | 1.4%* | 1.2%* | 2.0% | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 1.1% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 76.2 | bottom of page one, aim higher | stand up comedy | / | 390 | 3 | 5.7 |  |  |
| 55.0 | bottom of page one, aim higher | stand up comedy zurich | / | 547 | 56 | 5.6 |  |  |
| 53.5 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2125 | 7 | 9.9 |  | yes |
| 42.4 | bottom of page one, aim higher | comedy shows zurich | / | 219 | 2 | 6.5 |  |  |
| 22.6 | ranks well, few clicks: the listing text | stand up comedy zürich | / | 656 | 22 | 3.7 |  |  |
| 15.2 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 210 | 0 | 7.9 |  | yes |
| 13.0 | bottom of page one, aim higher | standup comedy | / | 69 | 1 | 5.9 | standup |  |
| 12.8 | bottom of page one, aim higher | stand up | / | 63 | 0 | 6.2 |  |  |
| 12.6 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 67 | 1 | 6.2 |  |  |
| 9.7 | bottom of page one, aim higher | stand up comedy schweiz | / | 143 | 0 | 7.4 | schweiz |  |
| 9.5 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 47 | 0 | 6.2 |  | yes |
| 8.3 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 129 | 1 | 8.1 |  |  |
| 8.0 | bottom of page one, aim higher | robins bar | /comedybrew/ | 124 | 1 | 7.8 |  |  |
| 7.6 | bottom of page one, aim higher | standup comedy zurich | / | 77 | 8 | 6.1 | standup |  |
| 7.5 | bottom of page one, aim higher | comedy zurich | / | 273 | 11 | 6.8 |  |  |
| 7.1 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 317 | 7 | 8.8 |  | yes |
| 6.7 | bottom of page one, aim higher | open mic comedy zürich | / | 48 | 3 | 6.5 |  |  |
| 6.1 | bottom of page one, aim higher | comedy night zürich | / | 30 | 0 | 5.6 | night |  |
| 6.0 | bottom of page one, aim higher | comedy show zürich | / | 133 | 3 | 6.6 |  |  |
| 5.9 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 39 | 2 | 5.7 |  | yes |
| 4.7 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 99 | 2 | 3.9 |  | yes |
| 4.6 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 83 | 1 | 4.2 |  | yes |
| 4.6 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 4.5 | bottom of page one, aim higher | standup | / | 22 | 0 | 6.5 | standup |  |
| 4.4 | bottom of page one, aim higher | ruben garcia | /comedians/ruben-garcia/ | 65 | 0 | 6.8 |  | yes |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (656 @ 3.7), /calendar/ (129 @ 8.1)
- comedy zürich: 2 pages share this query: / (403 @ 11.0), /calendar/ (107 @ 10.8)
- open mic zürich: 2 pages share this query: /comedybrew/ (184 @ 14.3), / (55 @ 9.7)
- comedy show zurich: 2 pages share this query: / (135 @ 6.9), /calendar/ (35 @ 8.0)
- comedy show zürich: 2 pages share this query: / (133 @ 6.6), /calendar/ (92 @ 10.7)
- english comedy zurich: 2 pages share this query: / (126 @ 3.2), /calendar/ (32 @ 8.8)
- comedy: 2 pages share this query: / (121 @ 9.9), /calendar/ (35 @ 10.0)
- standup comedy zürich: 2 pages share this query: / (114 @ 4.2), /calendar/ (26 @ 10.5)
- comedy show: 2 pages share this query: /calendar/ (73 @ 9.9), / (51 @ 8.0)
- english stand up comedy: 2 pages share this query: / (63 @ 19.6), /calendar/ (15 @ 9.4)
- comedy shows: 2 pages share this query: / (51 @ 18.4), /calendar/ (23 @ 9.6)
- open mic comedy zürich: 2 pages share this query: / (48 @ 6.5), /comedybrew/ (31 @ 10.2)
- stand-up comedy zürich english: 2 pages share this query: / (47 @ 2.9), /calendar/ (11 @ 10.5)
- stand up zürich: 2 pages share this query: / (38 @ 3.3), /calendar/ (9 @ 10.3)
- comedy shows zürich: 2 pages share this query: /calendar/ (34 @ 9.9), / (32 @ 7.2)
- open mic: 2 pages share this query: /comedybrew/ (34 @ 27.1), / (6 @ 4.3)
- comedy night zurich: 2 pages share this query: / (33 @ 7.3), /calendar/ (8 @ 7.8)
- open mic comedy: 2 pages share this query: / (33 @ 4.8), /comedybrew/ (8 @ 4.5)
- comedy night zürich: 2 pages share this query: /calendar/ (32 @ 11.8), / (30 @ 5.6)
- comedy brew: 2 pages share this query: /comedybrew/ (24 @ 2.8), / (21 @ 4.0)
- english comedy night: 2 pages share this query: / (22 @ 8.3), /calendar/ (14 @ 35.2)
- open mic zurich: 2 pages share this query: /comedybrew/ (22 @ 8.3), / (4 @ 4.5)
- stand-up comedy zürich: 2 pages share this query: / (20 @ 1.7), /calendar/ (12 @ 8.2)
- zürich comedy: 2 pages share this query: / (19 @ 7.0), /calendar/ (14 @ 10.9)
- mike casa: 2 pages share this query: /comedians/mike-casa/ (19 @ 10.7), /mike-casa/ (17 @ 7.8)
- comedy night: 2 pages share this query: / (18 @ 3.5), /calendar/ (12 @ 8.4)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- comedy switzerland: 3 pages share this query: / (12 @ 22.3), /calendar/ (9 @ 51.7), /switzerland/ (6 @ 10.5)
- zürich comedy show: 2 pages share this query: / (12 @ 7.6), /calendar/ (8 @ 9.8)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 308.7)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 13075 impressions, 746 clicks, position 6.9
- Words the queries use that the page does not: schweiz (301), standup (182), comedian (87), night (85), nightwash (15), heute (15), matt (13), rife (13)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 390 | 3 | 5.7 | 76.2 |  |
| stand up comedy zurich | bottom of page one, aim higher | 547 | 56 | 5.6 | 55.0 |  |
| comedy shows zurich | bottom of page one, aim higher | 219 | 2 | 6.5 | 42.4 |  |
| stand up comedy zürich | ranks well, few clicks: the listing text | 656 | 22 | 3.7 | 22.6 |  |
| standup comedy | bottom of page one, aim higher | 69 | 1 | 5.9 | 13.0 | standup |
| stand up | bottom of page one, aim higher | 63 | 0 | 6.2 | 12.8 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 143 | 0 | 7.4 | 9.7 | schweiz |
| standup comedy zurich | bottom of page one, aim higher | 77 | 8 | 6.1 | 7.6 | standup |
| comedy zurich | bottom of page one, aim higher | 273 | 11 | 6.8 | 7.5 |  |
| open mic comedy zürich | bottom of page one, aim higher | 48 | 3 | 6.5 | 6.7 |  |
| comedy night zürich | bottom of page one, aim higher | 30 | 0 | 5.6 | 6.1 | night |
| comedy show zürich | bottom of page one, aim higher | 133 | 3 | 6.6 | 6.0 |  |

### /calendar/ (gain 33.8)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 4386 impressions, 84 clicks, position 8.1
- Words the queries use that the page does not: standup (26)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | bottom of page one, aim higher | 67 | 1 | 6.2 | 12.6 |  |
| stand up comedy zürich | bottom of page one, aim higher | 129 | 1 | 8.1 | 8.3 |  |
| comedy zurich | bottom of page one, aim higher | 45 | 1 | 7.8 | 2.3 |  |
| comedy show | bottom of page one, aim higher | 73 | 0 | 9.9 | 2.1 |  |
| comedy 2026 | bottom of page one, aim higher | 25 | 0 | 7.4 | 1.7 |  |
| comedy show zürich | bottom of page one, aim higher | 92 | 0 | 10.7 | 1.5 |  |
| comedy | bottom of page one, aim higher | 35 | 0 | 10.0 | 1.0 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 12 | 0 | 8.2 | 0.9 |  |
| comedy zürich | bottom of page one, aim higher | 107 | 1 | 10.8 | 0.8 |  |
| english stand up comedy | bottom of page one, aim higher | 15 | 0 | 9.4 | 0.7 |  |
| comedy shows | bottom of page one, aim higher | 23 | 0 | 9.6 | 0.7 |  |
| comedy night zürich | page two, aim for page one | 32 | 0 | 11.8 | 0.5 |  |

### /comedybrew/ (gain 21.4)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2661 impressions, 200 clicks, position 10.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 124 | 1 | 7.8 | 8.0 |  |
| robins | bottom of page one, aim higher | 39 | 0 | 6.9 | 2.6 |  |
| robins bar and coffee | bottom of page one, aim higher | 36 | 0 | 7.9 | 2.6 |  |
| robins coffee | bottom of page one, aim higher | 28 | 0 | 8.1 | 2.0 |  |
| robins bar zurich | bottom of page one, aim higher | 37 | 0 | 9.0 | 1.6 |  |
| robins zurich | bottom of page one, aim higher | 24 | 0 | 7.4 | 1.6 |  |
| robins zürich | bottom of page one, aim higher | 12 | 1 | 6.0 | 1.4 |  |
| robin's bar & coffee | bottom of page one, aim higher | 56 | 3 | 8.2 | 1.1 |  |
| robins coffee zurich | page two, aim for page one | 25 | 0 | 13.2 | 0.4 |  |
| open mic zürich | page two, aim for page one | 184 | 4 | 14.3 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 31 | 3 | 10.2 | 0.0 |  |
| open mic zurich | bottom of page one, aim higher | 22 | 2 | 8.3 | 0.0 |  |

### /mike-casa/ (gain 7.3)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 245 impressions, 7 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa zurich | bottom of page one, aim higher | 39 | 2 | 5.7 | 5.9 |  (name) |
| mike casa | bottom of page one, aim higher | 17 | 0 | 7.8 | 1.2 |  (name) |
| mike casa comedy | page two, aim for page one | 10 | 0 | 12.3 | 0.2 |  (name) |

### /nerdycomedyshow/ (gain 1.6)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 325 impressions, 16 clicks, position 11.5

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 1.3 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /switzerland/ (gain 0.7)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 460 impressions, 3 clicks, position 6.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss stand up comedians | bottom of page one, aim higher | 10 | 0 | 7.8 | 0.7 |  |
| swiss comedians | bottom of page one, aim higher | 20 | 1 | 9.2 | 0.0 |  |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 274 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 37 | 1 | 14.3 | 0.0 | filippo, spreafico (name) |

### /pulpnonfiction/ (gain 0.0)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 81 impressions, 8 clicks, position 10.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 12 | 1 | 6.7 | 0.0 |  (name) |

## Comedian pages (meta-only)

15 comedian pages carry opportunities worth 116.9 extra clicks a quarter over 3204 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: andrearamirez (18), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 53.8 | andrea ramirez | 2125 | 9.9 | yes |
| /comedians/woocash/ | 15.2 | woocash | 210 | 7.9 | yes |
| /comedians/emir-tonbul/ | 9.5 | tonbul | 47 | 6.2 | yes |
| /comedians/teddy-hall/ | 7.1 | teddy hall | 317 | 8.8 | yes |
| /comedians/miguel/ | 6.5 | miguel zurich | 12 | 6.2 | yes |
| /comedians/richard-cunha/ | 4.7 | richard cunha | 99 | 3.9 | yes |
| /comedians/albert-louw/ | 4.6 | albert louw | 83 | 4.2 | yes |
| /comedians/coopernik/ | 4.6 | nik | 64 | 7.6 | yes |
| /comedians/ruben-garcia/ | 4.4 | ruben garcia | 65 | 6.8 | yes |
| /comedians/vasilis-theof/ | 3.0 | theof | 15 | 5.7 | yes |
| /comedians/laugh-at-domenico/ | 0.9 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/martinadoescomedy/ | 0.8 | martina comedian | 18 | 9.4 | yes |
| /comedians/dr-val/ | 0.7 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.5 | roza | 12 | 9.3 | yes |
| /comedians/mike-casa/ | 0.3 | mike casa | 19 | 10.7 | yes |


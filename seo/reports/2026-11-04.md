# Search Console loop: week of 2026-11-04

Snapshot window 2026-10-05 to 2026-11-01 (28 days of final data, 245 query and page pairs with 3 or more impressions over 72 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-04 to 2026-11-01 (90 days, 387 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-04T10:59:23.257Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-09-15 | 368 | 8233 | 4.5% | 7.7 | 57 |
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |

Devices this window: mobile 8186 impressions at position 6.3; desktop 2951 impressions at position 8.3; tablet 74 impressions at position 6.3.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 44 | improved | position -2.0, clicks 25 to 52 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 44 | improved | position -1.9, clicks 1 to 3 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 44 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 44 | worse | position -0.1, clicks 6 to 3 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 44 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 44 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 184 | 13 | 2.6 |
| stand up comedy zurich | 178 | 15 | 6.1 | 190 | 22 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 62 | 3 | 6.5 |
| comedy zürich | 120 | 1 | 14.0 | 107 | 4 | 6.6 |
| comedy club zurich | 39 | 0 | 7.9 | 68 | 5 | 6.4 |
| comedy club zürich | 18 | 1 | 7.5 | 63 | 3 | 6.7 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 49 | 0 | 5.9 |
| stand up comedy | 108 | 0 | 6.3 | 167 | 2 | 6.4 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 52 | 3 | 11.7 |
| open mic zurich | 11 | 1 | 9.8 | 3 | 0 | 6.7 |
| open mic comedy zürich | 13 | 1 | 9.1 | 9 | 1 | 10.9 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 10 | 1 | 7.7 |
| swiss stand up comedians | 0 | 0 | n/a | 9 | 0 | 5.9 |
| swiss comedian | 0 | 0 | n/a | 5 | 0 | 6.2 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 28 | 2 | 5.5 |
| teddy hall | 133 | 4 | 8.6 | 55 | 1 | 8.6 |
| teddy hall comedian | 0 | 0 | n/a | 19 | 0 | 5.9 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 11 | 0 | 8.9 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 45 | 0 | 5.9 |
| comedy shows 2026 | 4 | 0 | 6.5 | 3 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 10 | 0 | 4.4 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 9 | 0 | 8.9 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 3 | 0 | 5.0 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 17.2% | 5.7% | 7.1% | 4.9% | 2.5% | 1.6% | 1.8% | 0.6% | 1.6% | 1.4%* | 1.2%* | 1.8% | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.7% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 67.0 | bottom of page one, aim higher | stand up comedy | / | 412 | 4 | 5.8 |  |  |
| 43.5 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2103 | 8 | 9.9 |  | yes |
| 36.4 | bottom of page one, aim higher | stand up comedy zurich | / | 571 | 62 | 5.5 |  |  |
| 21.1 | bottom of page one, aim higher | comedy show zürich | / | 140 | 3 | 6.3 |  |  |
| 14.3 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 202 | 0 | 7.9 |  | yes |
| 12.4 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 78 | 1 | 6.1 |  |  |
| 11.3 | bottom of page one, aim higher | comedy shows zurich | / | 232 | 2 | 6.5 |  |  |
| 11.1 | bottom of page one, aim higher | standup comedy | / | 70 | 1 | 5.9 | standup |  |
| 10.3 | bottom of page one, aim higher | stand up | / | 60 | 0 | 6.2 |  |  |
| 10.0 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 183 | 3 | 7.9 |  |  |
| 8.5 | bottom of page one, aim higher | stand up comedy schweiz | / | 149 | 0 | 7.4 | schweiz |  |
| 8.1 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 47 | 0 | 6.1 |  | yes |
| 7.6 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 318 | 8 | 8.7 |  | yes |
| 7.0 | bottom of page one, aim higher | robins bar | /comedybrew/ | 113 | 1 | 7.8 |  |  |
| 6.6 | bottom of page one, aim higher | comedy shows zürich | / | 38 | 0 | 5.8 |  |  |
| 6.1 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 47 | 2 | 5.7 |  | yes |
| 5.6 | bottom of page one, aim higher | open mic comedy zürich | / | 50 | 3 | 6.4 |  |  |
| 5.6 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 115 | 1 | 3.9 |  | yes |
| 5.3 | bottom of page one, aim higher | comedy | / | 129 | 1 | 9.5 |  |  |
| 5.1 | bottom of page one, aim higher | standup comedy zurich | / | 82 | 9 | 6.1 | standup |  |
| 4.5 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 4.1 | bottom of page one, aim higher | teddy hall comedian | /comedians/teddy-hall/ | 24 | 0 | 6.1 | comedian | yes |
| 4.0 | bottom of page one, aim higher | comedy zurich | / | 262 | 11 | 6.9 |  |  |
| 3.9 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 85 | 1 | 4.1 |  | yes |
| 3.6 | bottom of page one, aim higher | miguel stand up | /comedians/miguel/ | 21 | 0 | 6.4 |  |  |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (665 @ 3.7), /calendar/ (183 @ 7.9)
- comedy zürich: 2 pages share this query: / (372 @ 10.7), /calendar/ (149 @ 10.8)
- comedy zurich: 2 pages share this query: / (262 @ 6.9), /calendar/ (57 @ 7.9)
- comedy shows zurich: 2 pages share this query: / (232 @ 6.5), /calendar/ (56 @ 8.7)
- open mic zürich: 2 pages share this query: /comedybrew/ (188 @ 14.4), / (56 @ 9.9)
- comedy show zürich: 2 pages share this query: / (140 @ 6.3), /calendar/ (135 @ 10.3)
- standup comedy zürich: 2 pages share this query: / (134 @ 4.1), /calendar/ (48 @ 8.9)
- comedy: 2 pages share this query: / (129 @ 9.5), /calendar/ (47 @ 10.1)
- comedy show zurich: 2 pages share this query: / (127 @ 7.0), /calendar/ (59 @ 6.7)
- english comedy zurich: 2 pages share this query: / (121 @ 3.0), /calendar/ (42 @ 8.4)
- comedy show: 2 pages share this query: /calendar/ (98 @ 10.2), / (60 @ 7.4)
- comedy night zürich: 2 pages share this query: /calendar/ (72 @ 10.6), / (39 @ 4.4)
- mike casa: 2 pages share this query: /mike-casa/ (60 @ 7.0), /comedians/mike-casa/ (27 @ 9.2)
- stand-up comedy zürich english: 2 pages share this query: / (52 @ 2.8), /calendar/ (15 @ 10.5)
- open mic comedy zürich: 2 pages share this query: / (50 @ 6.4), /comedybrew/ (32 @ 10.2)
- english stand up comedy: 2 pages share this query: / (49 @ 15.6), /calendar/ (16 @ 9.4)
- comedy shows zürich: 2 pages share this query: /calendar/ (49 @ 10.1), / (38 @ 5.8)
- stand up zürich: 2 pages share this query: / (47 @ 3.6), /calendar/ (23 @ 8.8)
- comedy shows: 2 pages share this query: / (47 @ 18.0), /calendar/ (30 @ 9.6)
- english comedy: 2 pages share this query: / (38 @ 7.7), /calendar/ (10 @ 10.5)
- open mic comedy: 2 pages share this query: / (37 @ 5.0), /comedybrew/ (8 @ 4.5)
- open mic: 2 pages share this query: /comedybrew/ (34 @ 24.9), / (8 @ 3.9)
- comedy night zurich: 2 pages share this query: / (30 @ 7.0), /calendar/ (9 @ 7.7)
- stand-up comedy zürich: 2 pages share this query: / (29 @ 1.9), /calendar/ (23 @ 7.9)
- comedy night: 2 pages share this query: /calendar/ (27 @ 8.4), / (18 @ 4.9)
- comedy brew: 2 pages share this query: /comedybrew/ (26 @ 1.2), / (24 @ 4.2)
- zürich comedy: 2 pages share this query: / (21 @ 6.6), /calendar/ (19 @ 11.1)
- english comedy night: 2 pages share this query: / (19 @ 6.8), /calendar/ (15 @ 28.5)
- mike casa comedy: 2 pages share this query: /mike-casa/ (19 @ 11.4), /comedians/mike-casa/ (10 @ 11.5)
- comedy in zürich: 2 pages share this query: / (14 @ 7.4), /calendar/ (8 @ 15.6)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- comedian zürich: 2 pages share this query: /calendar/ (13 @ 13.8), / (9 @ 10.7)
- zürich comedy show: 2 pages share this query: /calendar/ (13 @ 9.8), / (12 @ 7.6)
- comedians: 2 pages share this query: / (12 @ 10.4), /comedians/ (12 @ 6.6)
- comedy switzerland: 3 pages share this query: / (11 @ 22.2), /calendar/ (9 @ 49.3), /switzerland/ (6 @ 10.5)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 226.8)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 13725 impressions, 815 clicks, position 6.6
- Words the queries use that the page does not: schweiz (317), standup (188), comedian (113), night (88), heute (16), nightwash (15), matt (14), rife (14)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 412 | 4 | 5.8 | 67.0 |  |
| stand up comedy zurich | bottom of page one, aim higher | 571 | 62 | 5.5 | 36.4 |  |
| comedy show zürich | bottom of page one, aim higher | 140 | 3 | 6.3 | 21.1 |  |
| comedy shows zurich | bottom of page one, aim higher | 232 | 2 | 6.5 | 11.3 |  |
| standup comedy | bottom of page one, aim higher | 70 | 1 | 5.9 | 11.1 | standup |
| stand up | bottom of page one, aim higher | 60 | 0 | 6.2 | 10.3 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 149 | 0 | 7.4 | 8.5 | schweiz |
| comedy shows zürich | bottom of page one, aim higher | 38 | 0 | 5.8 | 6.6 |  |
| open mic comedy zürich | bottom of page one, aim higher | 50 | 3 | 6.4 | 5.6 |  |
| comedy | bottom of page one, aim higher | 129 | 1 | 9.5 | 5.3 |  |
| standup comedy zurich | bottom of page one, aim higher | 82 | 9 | 6.1 | 5.1 | standup |
| comedy zurich | bottom of page one, aim higher | 262 | 11 | 6.9 | 4.0 |  |

### /calendar/ (gain 43.7)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5342 impressions, 101 clicks, position 8.2
- Words the queries use that the page does not: standup (59)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | bottom of page one, aim higher | 78 | 1 | 6.1 | 12.4 |  |
| stand up comedy zürich | bottom of page one, aim higher | 183 | 3 | 7.9 | 10.0 |  |
| comedy show zürich | bottom of page one, aim higher | 135 | 0 | 10.3 | 3.3 |  |
| comedy zurich | bottom of page one, aim higher | 57 | 1 | 7.9 | 3.0 |  |
| comedy show | bottom of page one, aim higher | 98 | 0 | 10.2 | 2.4 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 23 | 0 | 7.9 | 1.6 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 6.8 | 1.5 |  |
| comedy show zurich | bottom of page one, aim higher | 59 | 2 | 6.7 | 1.4 |  |
| standup comedy zürich | bottom of page one, aim higher | 48 | 1 | 8.9 | 1.4 | standup |
| comedy night zürich | bottom of page one, aim higher | 72 | 0 | 10.6 | 1.2 |  |
| comedy | bottom of page one, aim higher | 47 | 0 | 10.1 | 1.2 |  |
| comedy night | bottom of page one, aim higher | 27 | 1 | 8.4 | 0.9 |  |

### /comedybrew/ (gain 20.7)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2656 impressions, 205 clicks, position 9.2

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 113 | 1 | 7.8 | 7.0 |  |
| robins bar and coffee | bottom of page one, aim higher | 38 | 0 | 7.9 | 2.7 |  |
| robins | bottom of page one, aim higher | 36 | 0 | 6.7 | 2.1 |  |
| robins zurich | bottom of page one, aim higher | 29 | 0 | 8.1 | 2.1 |  |
| robin's bar & coffee | bottom of page one, aim higher | 57 | 2 | 8.2 | 2.0 |  |
| robins coffee | bottom of page one, aim higher | 28 | 0 | 8.3 | 2.0 |  |
| robins bar zurich | bottom of page one, aim higher | 35 | 0 | 9.1 | 1.7 |  |
| robins zürich | bottom of page one, aim higher | 28 | 1 | 7.1 | 0.6 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.4 |  |
| stand up comedy | page two, aim for page one | 10 | 0 | 11.8 | 0.2 |  |
| open mic zürich | page two, aim for page one | 188 | 4 | 14.4 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 32 | 3 | 10.2 | 0.0 |  |

### /mike-casa/ (gain 10.6)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 389 impressions, 7 clicks, position 6.8
- Words the queries use that the page does not: mikecasa (10)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa zurich | bottom of page one, aim higher | 47 | 2 | 5.7 | 6.1 |  (name) |
| mike casa | bottom of page one, aim higher | 60 | 0 | 7.0 | 3.4 |  (name) |
| mikecasa | bottom of page one, aim higher | 10 | 0 | 8.2 | 0.7 | mikecasa |
| mike casa comedy | page two, aim for page one | 19 | 0 | 11.4 | 0.3 |  (name) |

### /nerdycomedyshow/ (gain 1.7)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 344 impressions, 25 clicks, position 11.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 1.4 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 1.2)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 93 impressions, 11 clicks, position 9.3

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 1 | 5.5 | 1.2 |  (name) |

### /comedians/ (gain 0.7)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 574 impressions, 8 clicks, position 5.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedians | bottom of page one, aim higher | 12 | 0 | 6.6 | 0.7 |  (name) |

### /gratis-zum-mitnehmen/ (gain 0.6)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 151 impressions, 4 clicks, position 5.3
- Words the queries use that the page does not: bring (11), funny (11)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 11 | 0 | 7.3 | 0.6 | bring, funny |

### /switzerland/ (gain 0.1)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 495 impressions, 3 clicks, position 6.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 22 | 1 | 8.9 | 0.1 |  |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

15 comedian pages carry opportunities worth 108.7 extra clicks a quarter over 3237 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (24), andrearamirez (15), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 43.8 | andrea ramirez | 2103 | 9.9 | yes |
| /comedians/woocash/ | 14.3 | woocash | 202 | 7.9 | yes |
| /comedians/teddy-hall/ | 11.8 | teddy hall | 318 | 8.7 | yes |
| /comedians/emir-tonbul/ | 8.1 | tonbul | 47 | 6.1 | yes |
| /comedians/miguel/ | 8.0 | miguel stand up | 21 | 6.4 |  |
| /comedians/richard-cunha/ | 5.6 | richard cunha | 115 | 3.9 | yes |
| /comedians/coopernik/ | 4.5 | nik | 64 | 7.6 | yes |
| /comedians/albert-louw/ | 3.9 | albert louw | 85 | 4.1 | yes |
| /comedians/ruben-garcia/ | 3.1 | ruben garcia | 54 | 6.9 | yes |
| /comedians/vasilis-theof/ | 2.2 | theof | 13 | 5.7 | yes |
| /comedians/martinadoescomedy/ | 0.9 | martina comedian | 19 | 8.7 | yes |
| /comedians/laugh-at-domenico/ | 0.9 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.6 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.5 | roza | 10 | 9.3 | yes |
| /comedians/mike-casa/ | 0.5 | mike casa | 27 | 9.2 | yes |


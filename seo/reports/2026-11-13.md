# Search Console loop: week of 2026-11-13

Snapshot window 2026-10-14 to 2026-11-10 (28 days of final data, 240 query and page pairs with 3 or more impressions over 75 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-13 to 2026-11-10 (90 days, 412 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-13T11:22:23.515Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |
| 2026-11-04 | 587 | 12969 | 4.5% | 6.8 | 73 |
| 2026-11-06 | 585 | 12933 | 4.5% | 6.9 | 73 |
| 2026-11-10 | 562 | 12720 | 4.4% | 6.9 | 75 |

Devices this window: mobile 7822 impressions at position 6.2; desktop 2993 impressions at position 9.0; tablet 78 impressions at position 6.4.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 53 | improved | position -2.0, clicks 25 to 54 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 53 | flat | position +0.8, clicks 1 to 0 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 53 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 53 | worse | position -0.5, clicks 6 to 4 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 53 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 53 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 221 | 13 | 3.7 |
| stand up comedy zurich | 178 | 15 | 6.1 | 175 | 20 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 70 | 5 | 7.1 |
| comedy zürich | 120 | 1 | 14.0 | 61 | 4 | 5.3 |
| comedy club zurich | 39 | 0 | 7.9 | 72 | 7 | 6.0 |
| comedy club zürich | 18 | 1 | 7.5 | 64 | 3 | 6.7 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 38 | 0 | 4.9 |
| stand up comedy | 108 | 0 | 6.3 | 146 | 2 | 5.5 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 56 | 0 | 14.4 |
| open mic zurich | 11 | 1 | 9.8 | 3 | 1 | 4.3 |
| open mic comedy zürich | 13 | 1 | 9.1 | 9 | 0 | 11.7 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 19 | 1 | 6.5 |
| swiss stand up comedians | 0 | 0 | n/a | 7 | 0 | 4.7 |
| swiss comedian | 0 | 0 | n/a | 5 | 0 | 6.2 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 33 | 2 | 5.4 |
| teddy hall | 133 | 4 | 8.6 | 73 | 2 | 8.2 |
| teddy hall comedian | 0 | 0 | n/a | 21 | 1 | 5.8 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 11 | 0 | 7.4 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 46 | 0 | 6.7 |
| comedy shows 2026 | 4 | 0 | 6.5 | 3 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 7 | 0 | 5.3 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 9 | 0 | 9.7 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 12.7% | 5.4% | 8.7% | 1.5% | 2.6% | 1.9% | 1.9% | 0.7% | 1.8% | 1.4%* | 0.0% | 1.1%* | 1.8% | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.8% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 50.0 | bottom of page one, aim higher | stand up comedy | / | 426 | 4 | 5.9 |  |  |
| 48.4 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2119 | 6 | 9.9 |  | yes |
| 19.6 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 318 | 8 | 8.4 |  | yes |
| 16.8 | bottom of page one, aim higher | comedy show zürich | / | 156 | 3 | 5.9 |  |  |
| 16.2 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 199 | 1 | 8.1 |  | yes |
| 13.3 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 188 | 3 | 7.8 |  |  |
| 11.5 | bottom of page one, aim higher | comedy shows zurich | / | 250 | 2 | 6.6 |  |  |
| 10.7 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 92 | 1 | 6.4 |  |  |
| 8.3 | bottom of page one, aim higher | mike casa | /mike-casa/ | 96 | 0 | 7.7 |  | yes |
| 8.0 | bottom of page one, aim higher | stand up comedy schweiz | / | 148 | 0 | 7.2 | schweiz |  |
| 7.9 | bottom of page one, aim higher | standup comedy | / | 70 | 1 | 6.0 | standup |  |
| 7.8 | bottom of page one, aim higher | robins bar | /comedybrew/ | 113 | 2 | 7.9 |  |  |
| 6.4 | bottom of page one, aim higher | comedy zurich | / | 285 | 9 | 7.1 |  |  |
| 6.1 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 131 | 1 | 4.3 |  | yes |
| 5.1 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 59 | 0 | 7.5 |  | yes |
| 5.1 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 40 | 0 | 5.8 |  | yes |
| 4.3 | ranks well, few clicks: the listing text | stand-up comedy zürich | / | 42 | 1 | 3.0 |  |  |
| 4.2 | bottom of page one, aim higher | open mic comedy zürich | / | 57 | 3 | 6.4 |  |  |
| 4.2 | bottom of page one, aim higher | comedy show zurich | / | 151 | 4 | 7.2 |  |  |
| 4.1 | bottom of page one, aim higher | robin's bar & coffee | /comedybrew/ | 59 | 1 | 8.1 |  |  |
| 3.9 | bottom of page one, aim higher | comedy zurich | /calendar/ | 56 | 1 | 8.2 |  |  |
| 3.7 | ranks well, few clicks: the listing text | comedy shows zürich | / | 43 | 0 | 5.1 |  |  |
| 3.7 | bottom of page one, aim higher | robins bar and coffee | /comedybrew/ | 43 | 0 | 7.8 |  |  |
| 3.7 | bottom of page one, aim higher | comedy show zürich | /calendar/ | 145 | 0 | 10.3 |  |  |
| 3.7 | bottom of page one, aim higher | robins | /comedybrew/ | 29 | 0 | 6.1 |  |  |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (717 @ 3.9), /calendar/ (188 @ 7.8)
- comedy zürich: 2 pages share this query: / (344 @ 10.2), /calendar/ (156 @ 10.8)
- comedy zurich: 2 pages share this query: / (285 @ 7.1), /calendar/ (56 @ 8.2)
- comedy shows zurich: 2 pages share this query: / (250 @ 6.6), /calendar/ (56 @ 8.7)
- open mic zürich: 2 pages share this query: /comedybrew/ (194 @ 15.2), / (64 @ 9.1)
- comedy show zürich: 2 pages share this query: / (156 @ 5.9), /calendar/ (145 @ 10.3)
- standup comedy zürich: 2 pages share this query: / (154 @ 4.4), /calendar/ (49 @ 9.3)
- comedy show zurich: 2 pages share this query: / (151 @ 7.2), /calendar/ (62 @ 6.7)
- comedy: 2 pages share this query: / (142 @ 9.6), /calendar/ (47 @ 10.1)
- english comedy zurich: 2 pages share this query: / (126 @ 2.9), /calendar/ (47 @ 8.2)
- comedy show: 2 pages share this query: /calendar/ (99 @ 10.1), / (62 @ 7.1)
- mike casa: 2 pages share this query: /mike-casa/ (96 @ 7.7), /comedians/mike-casa/ (31 @ 9.6)
- comedy night zürich: 2 pages share this query: /calendar/ (73 @ 10.6), / (47 @ 4.8)
- open mic comedy zürich: 2 pages share this query: / (57 @ 6.4), /comedybrew/ (33 @ 10.2)
- stand-up comedy zürich english: 2 pages share this query: / (56 @ 2.7), /calendar/ (17 @ 10.5)
- comedy shows zürich: 2 pages share this query: /calendar/ (52 @ 10.3), / (43 @ 5.1)
- stand up zürich: 2 pages share this query: / (48 @ 4.0), /calendar/ (24 @ 8.9)
- comedy shows: 2 pages share this query: / (44 @ 17.2), /calendar/ (34 @ 9.6)
- stand-up comedy zürich: 2 pages share this query: / (42 @ 3.0), /calendar/ (24 @ 8.0)
- english stand up comedy: 2 pages share this query: / (40 @ 10.0), /calendar/ (16 @ 9.4)
- english comedy: 2 pages share this query: / (37 @ 7.4), /calendar/ (11 @ 11.3)
- open mic: 2 pages share this query: /comedybrew/ (37 @ 24.9), / (12 @ 15.2)
- comedy night zurich: 2 pages share this query: / (36 @ 7.3), /calendar/ (9 @ 7.7)
- open mic comedy: 2 pages share this query: / (35 @ 5.1), /comedybrew/ (8 @ 4.9)
- mike casa comedy: 2 pages share this query: /mike-casa/ (32 @ 9.8), /comedians/mike-casa/ (12 @ 11.5)
- comedy night: 2 pages share this query: /calendar/ (30 @ 8.5), / (20 @ 5.3)
- comedy brew: 2 pages share this query: /comedybrew/ (28 @ 1.1), / (27 @ 4.1)
- open mic zurich: 2 pages share this query: /comedybrew/ (21 @ 7.4), / (4 @ 4.5)
- zürich comedy: 2 pages share this query: / (20 @ 4.7), /calendar/ (19 @ 11.1)
- english comedy night: 2 pages share this query: / (20 @ 7.3), /calendar/ (15 @ 21.1)
- comedy in zürich: 2 pages share this query: / (18 @ 6.4), /calendar/ (8 @ 15.6)
- comedians: 2 pages share this query: /comedians/ (18 @ 6.4), / (15 @ 9.9)
- comedian zürich: 2 pages share this query: /calendar/ (14 @ 14.1), / (13 @ 11.7)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- zürich comedy show: 2 pages share this query: / (13 @ 7.2), /calendar/ (13 @ 9.8)
- comedy switzerland: 3 pages share this query: / (11 @ 27.7), /calendar/ (10 @ 46.5), /switzerland/ (8 @ 10.6)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 156.5)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 14635 impressions, 847 clicks, position 6.5
- Words the queries use that the page does not: schweiz (329), comedian (134), standup (105), night (103), matt (16), rife (16), heute (16), nightwash (15)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 426 | 4 | 5.9 | 50.0 |  |
| comedy show zürich | bottom of page one, aim higher | 156 | 3 | 5.9 | 16.8 |  |
| comedy shows zurich | bottom of page one, aim higher | 250 | 2 | 6.6 | 11.5 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 148 | 0 | 7.2 | 8.0 | schweiz |
| standup comedy | bottom of page one, aim higher | 70 | 1 | 6.0 | 7.9 | standup |
| comedy zurich | bottom of page one, aim higher | 285 | 9 | 7.1 | 6.4 |  |
| stand-up comedy zürich | ranks well, few clicks: the listing text | 42 | 1 | 3.0 | 4.3 |  |
| open mic comedy zürich | bottom of page one, aim higher | 57 | 3 | 6.4 | 4.2 |  |
| comedy show zurich | bottom of page one, aim higher | 151 | 4 | 7.2 | 4.2 |  |
| comedy shows zürich | ranks well, few clicks: the listing text | 43 | 0 | 5.1 | 3.7 |  |
| comedy show | bottom of page one, aim higher | 62 | 0 | 7.1 | 3.3 |  |
| comedy night zürich | ranks well, few clicks: the listing text | 47 | 1 | 4.8 | 3.1 | night |

### /calendar/ (gain 43.7)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5651 impressions, 109 clicks, position 8.2
- Words the queries use that the page does not: standup (49), schweiz (12)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy zürich | bottom of page one, aim higher | 188 | 3 | 7.8 | 13.3 |  |
| comedy zürich 2026 | bottom of page one, aim higher | 92 | 1 | 6.4 | 10.7 |  |
| comedy zurich | bottom of page one, aim higher | 56 | 1 | 8.2 | 3.9 |  |
| comedy show zürich | bottom of page one, aim higher | 145 | 0 | 10.3 | 3.7 |  |
| comedy show | bottom of page one, aim higher | 99 | 0 | 10.1 | 2.5 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 24 | 0 | 8.0 | 2.1 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 7.0 | 1.5 |  |
| comedy night zürich | bottom of page one, aim higher | 73 | 0 | 10.6 | 1.4 |  |
| comedy | bottom of page one, aim higher | 47 | 0 | 10.1 | 1.2 |  |
| comedy shows | bottom of page one, aim higher | 34 | 0 | 9.6 | 0.9 |  |
| zürich comedy | page two, aim for page one | 19 | 0 | 11.1 | 0.4 |  |
| comedy show zurich | bottom of page one, aim higher | 62 | 3 | 6.7 | 0.3 |  |

### /comedybrew/ (gain 24.6)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2636 impressions, 206 clicks, position 9.2

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 113 | 2 | 7.9 | 7.8 |  |
| robin's bar & coffee | bottom of page one, aim higher | 59 | 1 | 8.1 | 4.1 |  |
| robins bar and coffee | bottom of page one, aim higher | 43 | 0 | 7.8 | 3.7 |  |
| robins | bottom of page one, aim higher | 29 | 0 | 6.1 | 3.7 |  |
| robins zurich | bottom of page one, aim higher | 32 | 0 | 7.8 | 2.8 |  |
| robins zürich | bottom of page one, aim higher | 34 | 2 | 7.5 | 0.9 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.5 |  |
| robins bar zurich | bottom of page one, aim higher | 27 | 0 | 9.0 | 0.4 |  |
| robins coffee | bottom of page one, aim higher | 27 | 0 | 8.6 | 0.4 |  |
| stand up comedy | page two, aim for page one | 12 | 0 | 11.9 | 0.2 |  |
| open mic zürich | page two, aim for page one | 194 | 4 | 15.2 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 33 | 3 | 10.2 | 0.0 |  |

### /mike-casa/ (gain 13.5)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 500 impressions, 9 clicks, position 7.0
- Words the queries use that the page does not: mikecasa (10)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa | bottom of page one, aim higher | 96 | 0 | 7.7 | 8.3 |  (name) |
| mike casa zurich | bottom of page one, aim higher | 51 | 3 | 5.6 | 3.5 |  (name) |
| mikecasa | bottom of page one, aim higher | 10 | 0 | 8.2 | 0.9 | mikecasa |
| mike casa comedy | bottom of page one, aim higher | 32 | 0 | 9.8 | 0.8 |  (name) |

### /switzerland/ (gain 3.2)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 540 impressions, 4 clicks, position 5.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 31 | 1 | 7.8 | 1.7 |  |
| swiss stand up comedians | bottom of page one, aim higher | 12 | 0 | 5.8 | 1.5 |  |

### /comedians/ (gain 2.3)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 659 impressions, 9 clicks, position 5.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedians | bottom of page one, aim higher | 18 | 0 | 6.4 | 2.3 |  (name) |

### /gratis-zum-mitnehmen/ (gain 1.7)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 173 impressions, 6 clicks, position 5.5
- Words the queries use that the page does not: bring (20), funny (20)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 20 | 0 | 7.5 | 1.7 | bring, funny |

### /nerdycomedyshow/ (gain 0.8)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 349 impressions, 27 clicks, position 9.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 0.4 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 0.5)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 94 impressions, 12 clicks, position 9.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 12 | 1 | 5.9 | 0.5 |  (name) |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

13 comedian pages carry opportunities worth 120.1 extra clicks a quarter over 3243 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (31), andrearamirez (16), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 49.9 | andrea ramirez | 2119 | 9.9 | yes |
| /comedians/teddy-hall/ | 22.5 | teddy hall | 318 | 8.4 | yes |
| /comedians/woocash/ | 16.2 | woocash | 199 | 8.1 | yes |
| /comedians/richard-cunha/ | 6.1 | richard cunha | 131 | 4.3 | yes |
| /comedians/miguel/ | 5.6 | miguel stand up | 20 | 6.3 |  |
| /comedians/coopernik/ | 5.1 | nik | 59 | 7.5 | yes |
| /comedians/emir-tonbul/ | 5.1 | tonbul | 40 | 5.8 | yes |
| /comedians/albert-louw/ | 3.6 | albert louw | 85 | 4.2 | yes |
| /comedians/ruben-garcia/ | 2.4 | ruben garcia | 44 | 7.2 | yes |
| /comedians/martinadoescomedy/ | 1.7 | martina comedian | 20 | 7.9 | yes |
| /comedians/laugh-at-domenico/ | 1.1 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.5 | dr val | 10 | 6.8 | yes |
| /comedians/mike-casa/ | 0.2 | mike casa comedy | 12 | 11.5 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| comedy show zürich | / | 58 | 5.5 | 3.0 |


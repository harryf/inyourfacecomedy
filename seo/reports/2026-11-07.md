# Search Console loop: week of 2026-11-07

Snapshot window 2026-10-08 to 2026-11-04 (28 days of final data, 238 query and page pairs with 3 or more impressions over 73 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-07 to 2026-11-04 (90 days, 396 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-07T15:21:37.393Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |
| 2026-11-04 | 587 | 12969 | 4.5% | 6.8 | 73 |

Devices this window: mobile 8110 impressions at position 6.2; desktop 2971 impressions at position 8.4; tablet 68 impressions at position 6.4.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 47 | improved | position -1.9, clicks 25 to 55 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 47 | flat | position +0.9, clicks 1 to 0 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 47 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 47 | worse | position -0.1, clicks 6 to 3 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 47 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 47 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 194 | 14 | 2.8 |
| stand up comedy zurich | 178 | 15 | 6.1 | 189 | 20 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 64 | 5 | 6.5 |
| comedy zürich | 120 | 1 | 14.0 | 102 | 4 | 6.6 |
| comedy club zurich | 39 | 0 | 7.9 | 74 | 7 | 6.2 |
| comedy club zürich | 18 | 1 | 7.5 | 66 | 3 | 6.8 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 46 | 0 | 5.7 |
| stand up comedy | 108 | 0 | 6.3 | 162 | 2 | 6.4 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 52 | 0 | 14.5 |
| open mic zurich | 11 | 1 | 9.8 | 4 | 1 | 5.5 |
| open mic comedy zürich | 13 | 1 | 9.1 | 7 | 1 | 10.6 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 12 | 1 | 6.6 |
| swiss stand up comedians | 0 | 0 | n/a | 5 | 0 | 3.6 |
| swiss comedian | 0 | 0 | n/a | 5 | 0 | 6.2 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 30 | 2 | 5.5 |
| teddy hall | 133 | 4 | 8.6 | 59 | 1 | 8.6 |
| teddy hall comedian | 0 | 0 | n/a | 21 | 0 | 6.0 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 12 | 0 | 8.3 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 44 | 0 | 6.1 |
| comedy shows 2026 | 4 | 0 | 6.5 | 3 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 9 | 0 | 4.4 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 11 | 0 | 8.9 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 15.2% | 5.8% | 9.3% | 2.5% | 2.5% | 1.8% | 1.8% | 0.5% | 1.8% | 1.4%* | 1.2%* | 1.5% | 1.6% | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.7% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 58.1 | bottom of page one, aim higher | stand up comedy | / | 409 | 4 | 5.9 |  |  |
| 46.6 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2102 | 6 | 9.9 |  | yes |
| 19.6 | bottom of page one, aim higher | comedy show zürich | / | 149 | 3 | 6.2 |  |  |
| 17.7 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 201 | 1 | 8.0 |  | yes |
| 14.2 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 185 | 3 | 7.8 |  |  |
| 11.6 | bottom of page one, aim higher | comedy shows zurich | / | 234 | 2 | 6.5 |  |  |
| 11.3 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 81 | 1 | 6.2 |  |  |
| 9.5 | bottom of page one, aim higher | standup comedy | / | 69 | 1 | 5.9 | standup |  |
| 9.2 | bottom of page one, aim higher | robins bar | /comedybrew/ | 109 | 1 | 7.8 |  |  |
| 8.7 | bottom of page one, aim higher | stand up | / | 57 | 0 | 6.2 |  |  |
| 8.5 | bottom of page one, aim higher | stand up comedy schweiz | / | 146 | 0 | 7.3 | schweiz |  |
| 6.9 | bottom of page one, aim higher | mike casa | /mike-casa/ | 74 | 0 | 7.7 |  | yes |
| 6.5 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 43 | 0 | 5.9 |  | yes |
| 6.4 | bottom of page one, aim higher | teddy hall comedy | /comedians/teddy-hall/ | 88 | 7 | 5.5 |  | yes |
| 6.2 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 123 | 1 | 3.9 |  | yes |
| 6.0 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 5.8 | bottom of page one, aim higher | comedy shows zürich | / | 38 | 0 | 5.5 |  |  |
| 5.3 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 48 | 2 | 5.7 |  | yes |
| 4.7 | bottom of page one, aim higher | comedy zurich | / | 269 | 11 | 7.0 |  |  |
| 4.6 | bottom of page one, aim higher | standup comedy zurich | / | 83 | 8 | 6.1 | standup |  |
| 4.4 | bottom of page one, aim higher | open mic comedy zürich | / | 49 | 3 | 6.4 |  |  |
| 4.1 | bottom of page one, aim higher | comedy zurich | /calendar/ | 55 | 1 | 8.1 |  |  |
| 4.1 | bottom of page one, aim higher | teddy hall comedian | /comedians/teddy-hall/ | 27 | 0 | 6.0 | comedian | yes |
| 3.9 | bottom of page one, aim higher | robins bar and coffee | /comedybrew/ | 42 | 0 | 7.8 |  |  |
| 3.9 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 84 | 1 | 4.2 |  | yes |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (676 @ 3.7), /calendar/ (185 @ 7.8)
- comedy zürich: 2 pages share this query: / (364 @ 10.6), /calendar/ (154 @ 10.8)
- comedy zurich: 2 pages share this query: / (269 @ 7.0), /calendar/ (55 @ 8.1)
- comedy shows zurich: 2 pages share this query: / (234 @ 6.5), /calendar/ (56 @ 8.7)
- open mic zürich: 2 pages share this query: /comedybrew/ (194 @ 15.0), / (59 @ 9.1)
- comedy show zürich: 2 pages share this query: / (149 @ 6.2), /calendar/ (139 @ 10.3)
- standup comedy zürich: 2 pages share this query: / (142 @ 4.2), /calendar/ (48 @ 8.9)
- comedy show zurich: 2 pages share this query: / (132 @ 7.2), /calendar/ (62 @ 6.7)
- comedy: 2 pages share this query: / (132 @ 9.3), /calendar/ (47 @ 10.1)
- english comedy zurich: 2 pages share this query: / (124 @ 3.0), /calendar/ (48 @ 8.4)
- comedy show: 2 pages share this query: /calendar/ (99 @ 10.1), / (60 @ 7.3)
- mike casa: 2 pages share this query: /mike-casa/ (74 @ 7.7), /comedians/mike-casa/ (30 @ 9.6)
- comedy night zürich: 2 pages share this query: /calendar/ (72 @ 10.6), / (42 @ 4.3)
- stand-up comedy zürich english: 2 pages share this query: / (52 @ 2.9), /calendar/ (15 @ 10.5)
- stand up zürich: 2 pages share this query: / (50 @ 3.6), /calendar/ (24 @ 8.9)
- comedy shows zürich: 2 pages share this query: /calendar/ (50 @ 10.2), / (38 @ 5.5)
- open mic comedy zürich: 2 pages share this query: / (49 @ 6.4), /comedybrew/ (30 @ 10.1)
- english stand up comedy: 2 pages share this query: / (45 @ 14.0), /calendar/ (16 @ 9.4)
- comedy shows: 2 pages share this query: / (45 @ 17.8), /calendar/ (32 @ 9.5)
- open mic comedy: 2 pages share this query: / (38 @ 5.1), /comedybrew/ (9 @ 5.1)
- english comedy: 2 pages share this query: / (37 @ 7.8), /calendar/ (11 @ 11.3)
- open mic: 2 pages share this query: /comedybrew/ (34 @ 24.9), / (8 @ 3.9)
- comedy night zurich: 2 pages share this query: / (33 @ 7.1), /calendar/ (9 @ 7.7)
- stand-up comedy zürich: 2 pages share this query: / (32 @ 2.2), /calendar/ (23 @ 7.9)
- comedy night: 2 pages share this query: /calendar/ (27 @ 8.4), / (19 @ 5.2)
- mike casa comedy: 2 pages share this query: /mike-casa/ (27 @ 9.9), /comedians/mike-casa/ (11 @ 11.3)
- comedy brew: 2 pages share this query: /comedybrew/ (25 @ 1.2), / (23 @ 4.2)
- english comedy night: 2 pages share this query: / (20 @ 7.1), /calendar/ (15 @ 24.7)
- zürich comedy: 2 pages share this query: /calendar/ (19 @ 11.1), / (18 @ 5.6)
- comedians: 2 pages share this query: /comedians/ (16 @ 6.8), / (12 @ 10.4)
- comedy in zürich: 2 pages share this query: / (15 @ 6.9), /calendar/ (8 @ 15.6)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- zürich comedy show: 2 pages share this query: / (13 @ 7.2), /calendar/ (13 @ 9.8)
- comedian zürich: 2 pages share this query: /calendar/ (13 @ 13.8), / (8 @ 11.0)
- comedy switzerland: 3 pages share this query: / (12 @ 27.3), /calendar/ (11 @ 47.3), /switzerland/ (7 @ 10.6)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 180.1)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 13965 impressions, 823 clicks, position 6.5
- Words the queries use that the page does not: schweiz (315), standup (188), comedian (116), night (95), heute (16), nightwash (15), matt (14), rife (14)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 409 | 4 | 5.9 | 58.1 |  |
| comedy show zürich | bottom of page one, aim higher | 149 | 3 | 6.2 | 19.6 |  |
| comedy shows zurich | bottom of page one, aim higher | 234 | 2 | 6.5 | 11.6 |  |
| standup comedy | bottom of page one, aim higher | 69 | 1 | 5.9 | 9.5 | standup |
| stand up | bottom of page one, aim higher | 57 | 0 | 6.2 | 8.7 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 146 | 0 | 7.3 | 8.5 | schweiz |
| comedy shows zürich | bottom of page one, aim higher | 38 | 0 | 5.5 | 5.8 |  |
| comedy zurich | bottom of page one, aim higher | 269 | 11 | 7.0 | 4.7 |  |
| standup comedy zurich | bottom of page one, aim higher | 83 | 8 | 6.1 | 4.6 | standup |
| open mic comedy zürich | bottom of page one, aim higher | 49 | 3 | 6.4 | 4.4 |  |
| stand-up comedy zürich | ranks well, few clicks: the listing text | 32 | 1 | 2.2 | 3.8 |  |
| comedy show zurich | bottom of page one, aim higher | 132 | 4 | 7.2 | 3.7 |  |

### /calendar/ (gain 47.9)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5461 impressions, 106 clicks, position 8.2
- Words the queries use that the page does not: standup (58), schweiz (11)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy zürich | bottom of page one, aim higher | 185 | 3 | 7.8 | 14.2 |  |
| comedy zürich 2026 | bottom of page one, aim higher | 81 | 1 | 6.2 | 11.3 |  |
| comedy zurich | bottom of page one, aim higher | 55 | 1 | 8.1 | 4.1 |  |
| comedy show zürich | bottom of page one, aim higher | 139 | 0 | 10.3 | 3.5 |  |
| comedy show | bottom of page one, aim higher | 99 | 0 | 10.1 | 2.5 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 23 | 0 | 7.9 | 2.1 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 6.8 | 1.6 |  |
| comedy night | bottom of page one, aim higher | 27 | 1 | 8.4 | 1.5 |  |
| comedy night zürich | bottom of page one, aim higher | 72 | 0 | 10.6 | 1.3 |  |
| comedy | bottom of page one, aim higher | 47 | 0 | 10.1 | 1.2 |  |
| comedy shows | bottom of page one, aim higher | 32 | 0 | 9.5 | 0.8 |  |
| comedy show zurich | bottom of page one, aim higher | 62 | 3 | 6.7 | 0.6 |  |

### /comedybrew/ (gain 25.5)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2619 impressions, 195 clicks, position 9.2

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 109 | 1 | 7.8 | 9.2 |  |
| robins bar and coffee | bottom of page one, aim higher | 42 | 0 | 7.8 | 3.9 |  |
| robin's bar & coffee | bottom of page one, aim higher | 55 | 2 | 8.3 | 3.1 |  |
| robins zurich | bottom of page one, aim higher | 28 | 0 | 7.9 | 2.6 |  |
| robins coffee | bottom of page one, aim higher | 27 | 0 | 8.3 | 2.5 |  |
| robins | bottom of page one, aim higher | 34 | 0 | 6.5 | 2.0 |  |
| robins bar zurich | bottom of page one, aim higher | 33 | 0 | 8.9 | 0.8 |  |
| robins zürich | bottom of page one, aim higher | 29 | 1 | 7.2 | 0.7 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.5 |  |
| stand up comedy | page two, aim for page one | 10 | 0 | 11.8 | 0.2 |  |
| open mic zürich | page two, aim for page one | 194 | 4 | 15.0 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 30 | 3 | 10.1 | 0.0 |  |

### /mike-casa/ (gain 13.8)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 434 impressions, 7 clicks, position 7.0
- Words the queries use that the page does not: mikecasa (10)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa | bottom of page one, aim higher | 74 | 0 | 7.7 | 6.9 |  (name) |
| mike casa zurich | bottom of page one, aim higher | 48 | 2 | 5.7 | 5.3 |  (name) |
| mikecasa | bottom of page one, aim higher | 10 | 0 | 8.2 | 0.9 | mikecasa |
| mike casa comedy | bottom of page one, aim higher | 27 | 0 | 9.9 | 0.7 |  (name) |

### /gratis-zum-mitnehmen/ (gain 1.4)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 158 impressions, 4 clicks, position 5.4
- Words the queries use that the page does not: bring (15), funny (15)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 15 | 0 | 7.7 | 1.4 | bring, funny |

### /switzerland/ (gain 1.2)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 505 impressions, 3 clicks, position 6.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 24 | 1 | 8.2 | 1.2 |  |

### /nerdycomedyshow/ (gain 1.0)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 350 impressions, 26 clicks, position 11.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 0.7 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 1.0)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 90 impressions, 11 clicks, position 9.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 1 | 6.3 | 1.0 |  (name) |

### /comedians/ (gain 0.9)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 601 impressions, 8 clicks, position 5.8

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedians | bottom of page one, aim higher | 16 | 0 | 6.8 | 0.9 |  (name) |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

15 comedian pages carry opportunities worth 115.0 extra clicks a quarter over 3342 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (27), andrearamirez (15), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 46.9 | andrea ramirez | 2102 | 9.9 | yes |
| /comedians/woocash/ | 17.7 | woocash | 201 | 8.0 | yes |
| /comedians/teddy-hall/ | 10.5 | teddy hall comedy | 88 | 5.5 | yes |
| /comedians/emir-tonbul/ | 8.4 | tonbul | 43 | 5.9 | yes |
| /comedians/miguel/ | 6.8 | miguel stand up | 23 | 6.5 |  |
| /comedians/richard-cunha/ | 6.2 | richard cunha | 123 | 3.9 | yes |
| /comedians/coopernik/ | 6.0 | nik | 64 | 7.6 | yes |
| /comedians/albert-louw/ | 3.9 | albert louw | 84 | 4.2 | yes |
| /comedians/ruben-garcia/ | 2.8 | ruben garcia | 48 | 7.0 | yes |
| /comedians/vasilis-theof/ | 1.8 | theof | 12 | 6.0 | yes |
| /comedians/martinadoescomedy/ | 1.8 | martina comedian | 19 | 8.4 | yes |
| /comedians/laugh-at-domenico/ | 1.2 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.6 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.3 | roza | 10 | 9.3 | yes |
| /comedians/mike-casa/ | 0.2 | mike casa comedy | 11 | 11.3 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| open mic zürich | /comedybrew/ | 52 | 11.7 | 14.5 |


# Search Console loop: week of 2026-11-09

Snapshot window 2026-10-10 to 2026-11-06 (28 days of final data, 241 query and page pairs with 3 or more impressions over 73 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-09 to 2026-11-06 (90 days, 402 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-09T09:40:03.179Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |
| 2026-11-04 | 587 | 12969 | 4.5% | 6.8 | 73 |
| 2026-11-06 | 585 | 12933 | 4.5% | 6.9 | 73 |

Devices this window: mobile 8096 impressions at position 6.3; desktop 2979 impressions at position 8.6; tablet 68 impressions at position 6.2.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 49 | improved | position -1.9, clicks 25 to 56 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 49 | flat | position +0.7, clicks 1 to 0 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 49 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 49 | worse | position -0.3, clicks 6 to 3 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 49 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 49 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 209 | 16 | 2.9 |
| stand up comedy zurich | 178 | 15 | 6.1 | 180 | 20 | 4.9 |
| comedy zurich | 110 | 1 | 7.1 | 68 | 5 | 6.6 |
| comedy zürich | 120 | 1 | 14.0 | 100 | 4 | 6.5 |
| comedy club zurich | 39 | 0 | 7.9 | 70 | 6 | 6.0 |
| comedy club zürich | 18 | 1 | 7.5 | 61 | 3 | 6.5 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 47 | 0 | 5.7 |
| stand up comedy | 108 | 0 | 6.3 | 163 | 2 | 6.3 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 58 | 0 | 14.3 |
| open mic zurich | 11 | 1 | 9.8 | 4 | 1 | 3.8 |
| open mic comedy zürich | 13 | 1 | 9.1 | 8 | 1 | 10.8 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 14 | 1 | 6.1 |
| swiss stand up comedians | 0 | 0 | n/a | 5 | 0 | 3.6 |
| swiss comedian | 0 | 0 | n/a | 5 | 0 | 6.2 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 31 | 2 | 5.5 |
| teddy hall | 133 | 4 | 8.6 | 64 | 1 | 8.4 |
| teddy hall comedian | 0 | 0 | n/a | 22 | 1 | 5.7 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 11 | 0 | 7.9 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 44 | 0 | 6.0 |
| comedy shows 2026 | 4 | 0 | 6.5 | 3 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 8 | 0 | 4.9 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 12 | 0 | 9.1 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 14.8% | 5.8% | 8.7% | 2.6% | 2.7% | 1.6% | 2.0% | 0.6% | 1.6% | 1.4%* | 0.0% | 0.5% | 1.8% | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.7% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 56.5 | bottom of page one, aim higher | stand up comedy | / | 409 | 4 | 5.8 |  |  |
| 51.4 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2112 | 6 | 9.9 |  | yes |
| 19.6 | bottom of page one, aim higher | comedy show zürich | / | 153 | 3 | 6.0 |  |  |
| 16.6 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 202 | 1 | 8.0 |  | yes |
| 13.2 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 185 | 3 | 7.8 |  |  |
| 11.6 | bottom of page one, aim higher | comedy shows zurich | / | 234 | 2 | 6.5 |  |  |
| 11.3 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 83 | 1 | 6.2 |  |  |
| 9.2 | bottom of page one, aim higher | standup comedy | / | 69 | 1 | 6.0 | standup |  |
| 8.7 | bottom of page one, aim higher | stand up comedy schweiz | / | 150 | 0 | 7.2 | schweiz |  |
| 8.0 | bottom of page one, aim higher | stand up | / | 54 | 0 | 6.5 |  |  |
| 7.7 | bottom of page one, aim higher | robins bar | /comedybrew/ | 111 | 2 | 7.9 |  |  |
| 7.5 | bottom of page one, aim higher | mike casa | /mike-casa/ | 86 | 0 | 7.8 |  | yes |
| 6.6 | bottom of page one, aim higher | teddy hall comedy | /comedians/teddy-hall/ | 92 | 7 | 5.5 |  | yes |
| 6.5 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 129 | 1 | 4.1 |  | yes |
| 6.2 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 42 | 0 | 5.9 |  | yes |
| 5.6 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 5.3 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 49 | 2 | 5.7 |  | yes |
| 5.1 | bottom of page one, aim higher | comedy zurich | / | 277 | 11 | 7.0 |  |  |
| 4.9 | bottom of page one, aim higher | robins | /comedybrew/ | 33 | 0 | 6.4 |  |  |
| 4.5 | bottom of page one, aim higher | open mic comedy zürich | / | 51 | 3 | 6.5 |  |  |
| 4.0 | bottom of page one, aim higher | robin's bar & coffee | /comedybrew/ | 57 | 1 | 8.2 |  |  |
| 4.0 | bottom of page one, aim higher | comedy show zurich | / | 137 | 4 | 7.2 |  |  |
| 4.0 | ranks well, few clicks: the listing text | stand-up comedy zürich | / | 33 | 1 | 2.4 |  |  |
| 3.9 | bottom of page one, aim higher | comedy zurich | /calendar/ | 56 | 1 | 8.2 |  |  |
| 3.9 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 84 | 1 | 4.2 |  | yes |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (686 @ 3.8), /calendar/ (185 @ 7.8)
- comedy zürich: 2 pages share this query: / (356 @ 10.4), /calendar/ (156 @ 10.8)
- comedy zurich: 2 pages share this query: / (277 @ 7.0), /calendar/ (56 @ 8.2)
- comedy shows zurich: 2 pages share this query: / (234 @ 6.5), /calendar/ (56 @ 8.7)
- open mic zürich: 2 pages share this query: /comedybrew/ (199 @ 15.0), / (62 @ 9.1)
- comedy show zürich: 2 pages share this query: / (153 @ 6.0), /calendar/ (143 @ 10.3)
- standup comedy zürich: 2 pages share this query: / (147 @ 4.3), /calendar/ (49 @ 9.3)
- comedy show zurich: 2 pages share this query: / (137 @ 7.2), /calendar/ (62 @ 6.7)
- comedy: 2 pages share this query: / (137 @ 9.4), /calendar/ (47 @ 10.1)
- english comedy zurich: 2 pages share this query: / (127 @ 3.0), /calendar/ (47 @ 8.2)
- comedy show: 2 pages share this query: /calendar/ (99 @ 10.1), / (61 @ 7.2)
- mike casa: 2 pages share this query: /mike-casa/ (86 @ 7.8), /comedians/mike-casa/ (30 @ 9.6)
- comedy night zürich: 2 pages share this query: /calendar/ (73 @ 10.6), / (43 @ 4.3)
- open mic comedy zürich: 2 pages share this query: / (51 @ 6.5), /comedybrew/ (31 @ 10.1)
- stand-up comedy zürich english: 2 pages share this query: / (50 @ 2.8), /calendar/ (15 @ 10.5)
- comedy shows zürich: 2 pages share this query: /calendar/ (50 @ 10.2), / (42 @ 5.3)
- stand up zürich: 2 pages share this query: / (49 @ 3.7), /calendar/ (24 @ 8.9)
- comedy shows: 2 pages share this query: / (45 @ 17.8), /calendar/ (33 @ 9.6)
- english stand up comedy: 2 pages share this query: / (43 @ 12.4), /calendar/ (16 @ 9.4)
- english comedy: 2 pages share this query: / (37 @ 7.5), /calendar/ (11 @ 11.3)
- open mic: 2 pages share this query: /comedybrew/ (37 @ 24.9), / (11 @ 16.2)
- open mic comedy: 2 pages share this query: / (36 @ 4.9), /comedybrew/ (9 @ 5.1)
- comedy night zurich: 2 pages share this query: / (33 @ 7.1), /calendar/ (9 @ 7.7)
- stand-up comedy zürich: 2 pages share this query: / (33 @ 2.4), /calendar/ (23 @ 7.9)
- mike casa comedy: 2 pages share this query: /mike-casa/ (28 @ 10.0), /comedians/mike-casa/ (11 @ 11.3)
- comedy night: 2 pages share this query: /calendar/ (27 @ 8.4), / (20 @ 5.3)
- comedy brew: 2 pages share this query: /comedybrew/ (26 @ 1.2), / (24 @ 4.1)
- english comedy night: 2 pages share this query: / (21 @ 7.3), /calendar/ (16 @ 23.3)
- zürich comedy: 2 pages share this query: /calendar/ (19 @ 11.1), / (17 @ 5.7)
- comedians: 2 pages share this query: /comedians/ (17 @ 6.7), / (14 @ 10.1)
- comedy in zürich: 2 pages share this query: / (16 @ 6.9), /calendar/ (8 @ 15.6)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- zürich comedy show: 2 pages share this query: / (13 @ 7.2), /calendar/ (13 @ 9.8)
- comedian zürich: 2 pages share this query: /calendar/ (13 @ 13.8), / (8 @ 11.0)
- comedy switzerland: 3 pages share this query: / (12 @ 27.3), /calendar/ (11 @ 47.3), /switzerland/ (7 @ 10.6)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 180.8)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 14202 impressions, 834 clicks, position 6.5
- Words the queries use that the page does not: schweiz (324), standup (190), comedian (118), night (97), heute (16), nightwash (15), matt (14), rife (14)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 409 | 4 | 5.8 | 56.5 |  |
| comedy show zürich | bottom of page one, aim higher | 153 | 3 | 6.0 | 19.6 |  |
| comedy shows zurich | bottom of page one, aim higher | 234 | 2 | 6.5 | 11.6 |  |
| standup comedy | bottom of page one, aim higher | 69 | 1 | 6.0 | 9.2 | standup |
| stand up comedy schweiz | bottom of page one, aim higher | 150 | 0 | 7.2 | 8.7 | schweiz |
| stand up | bottom of page one, aim higher | 54 | 0 | 6.5 | 8.0 |  |
| comedy zurich | bottom of page one, aim higher | 277 | 11 | 7.0 | 5.1 |  |
| open mic comedy zürich | bottom of page one, aim higher | 51 | 3 | 6.5 | 4.5 |  |
| comedy show zurich | bottom of page one, aim higher | 137 | 4 | 7.2 | 4.0 |  |
| stand-up comedy zürich | ranks well, few clicks: the listing text | 33 | 1 | 2.4 | 4.0 |  |
| comedy shows zürich | ranks well, few clicks: the listing text | 42 | 0 | 5.3 | 3.7 |  |
| comedy show | bottom of page one, aim higher | 61 | 0 | 7.2 | 3.5 |  |

### /calendar/ (gain 46.5)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5533 impressions, 102 clicks, position 8.2
- Words the queries use that the page does not: standup (59), schweiz (12)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy zürich | bottom of page one, aim higher | 185 | 3 | 7.8 | 13.2 |  |
| comedy zürich 2026 | bottom of page one, aim higher | 83 | 1 | 6.2 | 11.3 |  |
| comedy zurich | bottom of page one, aim higher | 56 | 1 | 8.2 | 3.9 |  |
| comedy show zürich | bottom of page one, aim higher | 143 | 0 | 10.3 | 3.9 |  |
| comedy show | bottom of page one, aim higher | 99 | 0 | 10.1 | 2.7 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 23 | 0 | 7.9 | 2.0 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 6.8 | 1.6 |  |
| comedy night | bottom of page one, aim higher | 27 | 1 | 8.4 | 1.4 |  |
| comedy | bottom of page one, aim higher | 47 | 0 | 10.1 | 1.3 |  |
| comedy night zürich | bottom of page one, aim higher | 73 | 0 | 10.6 | 1.2 |  |
| comedy shows | bottom of page one, aim higher | 33 | 0 | 9.6 | 0.9 |  |
| comedy show zurich | bottom of page one, aim higher | 62 | 3 | 6.7 | 0.6 |  |

### /comedybrew/ (gain 26.7)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2643 impressions, 201 clicks, position 9.3

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 111 | 2 | 7.9 | 7.7 |  |
| robins | bottom of page one, aim higher | 33 | 0 | 6.4 | 4.9 |  |
| robin's bar & coffee | bottom of page one, aim higher | 57 | 1 | 8.2 | 4.0 |  |
| robins bar and coffee | bottom of page one, aim higher | 42 | 0 | 7.8 | 3.7 |  |
| robins zurich | bottom of page one, aim higher | 31 | 0 | 7.7 | 2.7 |  |
| robins coffee | bottom of page one, aim higher | 26 | 0 | 8.3 | 2.3 |  |
| robins bar zurich | bottom of page one, aim higher | 32 | 0 | 8.9 | 0.8 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.4 |  |
| stand up comedy | page two, aim for page one | 12 | 0 | 11.9 | 0.2 |  |
| open mic zürich | page two, aim for page one | 199 | 4 | 15.0 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 31 | 3 | 10.1 | 0.0 |  |
| robins zürich | bottom of page one, aim higher | 30 | 2 | 7.3 | 0.0 |  |

### /mike-casa/ (gain 14.4)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 459 impressions, 8 clicks, position 7.0
- Words the queries use that the page does not: mikecasa (10)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa | bottom of page one, aim higher | 86 | 0 | 7.8 | 7.5 |  (name) |
| mike casa zurich | bottom of page one, aim higher | 49 | 2 | 5.7 | 5.3 |  (name) |
| mikecasa | bottom of page one, aim higher | 10 | 0 | 8.2 | 0.9 | mikecasa |
| mike casa comedy | bottom of page one, aim higher | 28 | 0 | 10.0 | 0.8 |  (name) |

### /gratis-zum-mitnehmen/ (gain 1.7)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 166 impressions, 4 clicks, position 5.6
- Words the queries use that the page does not: bring (19), funny (19)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 19 | 0 | 7.8 | 1.7 | bring, funny |

### /switzerland/ (gain 1.3)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 514 impressions, 4 clicks, position 5.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 26 | 1 | 7.8 | 1.3 |  |

### /nerdycomedyshow/ (gain 1.1)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 351 impressions, 26 clicks, position 10.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 0.8 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /comedians/ (gain 1.0)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 619 impressions, 9 clicks, position 5.8

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedians | bottom of page one, aim higher | 17 | 0 | 6.7 | 1.0 |  (name) |

### /pulpnonfiction/ (gain 0.8)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 91 impressions, 12 clicks, position 9.3

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 12 | 1 | 5.9 | 0.8 |  (name) |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

13 comedian pages carry opportunities worth 115.3 extra clicks a quarter over 3344 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (30), andrearamirez (16), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 51.6 | andrea ramirez | 2112 | 9.9 | yes |
| /comedians/woocash/ | 16.6 | woocash | 202 | 8.0 | yes |
| /comedians/teddy-hall/ | 10.3 | teddy hall comedy | 92 | 5.5 | yes |
| /comedians/emir-tonbul/ | 8.0 | tonbul | 42 | 5.9 | yes |
| /comedians/richard-cunha/ | 6.5 | richard cunha | 129 | 4.1 | yes |
| /comedians/miguel/ | 6.4 | miguel stand up | 22 | 6.3 |  |
| /comedians/coopernik/ | 5.6 | nik | 64 | 7.6 | yes |
| /comedians/albert-louw/ | 3.9 | albert louw | 84 | 4.2 | yes |
| /comedians/ruben-garcia/ | 2.7 | ruben garcia | 47 | 7.1 | yes |
| /comedians/martinadoescomedy/ | 1.7 | martina comedian | 19 | 8.2 | yes |
| /comedians/laugh-at-domenico/ | 1.1 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.6 | dr val | 10 | 6.8 | yes |
| /comedians/mike-casa/ | 0.2 | mike casa comedy | 11 | 11.3 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| comedy schweiz | / | 35 | 13.1 | 15.7 |
| stand up comedy in english | / | 30 | 35.0 | 37.1 |


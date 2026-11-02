# Search Console loop: week of 2026-11-02

Snapshot window 2026-10-03 to 2026-10-30 (28 days of final data, 242 query and page pairs with 3 or more impressions over 73 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-02 to 2026-10-30 (90 days, 379 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-02T09:40:02.688Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-09-08 | 317 | 7479 | 4.2% | 8.5 | 57 |
| 2026-09-15 | 368 | 8233 | 4.5% | 7.7 | 57 |
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |

Devices this window: mobile 8213 impressions at position 6.4; desktop 2904 impressions at position 8.2; tablet 73 impressions at position 5.6.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 42 | improved | position -2.0, clicks 25 to 52 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 42 | improved | position -2.0, clicks 1 to 3 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 42 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 42 | worse | position -0.2, clicks 6 to 1 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 42 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 42 | no data | fewer than 10 impressions on the target queries in one of the windows |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 187 | 10 | 2.6 |
| stand up comedy zurich | 178 | 15 | 6.1 | 196 | 24 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 65 | 3 | 6.6 |
| comedy zürich | 120 | 1 | 14.0 | 115 | 4 | 6.4 |
| comedy club zurich | 39 | 0 | 7.9 | 69 | 5 | 6.6 |
| comedy club zürich | 18 | 1 | 7.5 | 64 | 3 | 6.6 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 50 | 0 | 5.3 |
| stand up comedy | 108 | 0 | 6.3 | 171 | 3 | 6.2 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 48 | 3 | 11.6 |
| open mic zurich | 11 | 1 | 9.8 | 3 | 0 | 5.7 |
| open mic comedy zürich | 13 | 1 | 9.1 | 9 | 1 | 11.6 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 7 | 1 | 7.3 |
| swiss stand up comedians | 0 | 0 | n/a | 7 | 0 | 7.3 |
| swiss comedian | 0 | 0 | n/a | 5 | 0 | 6.2 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 25 | 1 | 5.5 |
| teddy hall | 133 | 4 | 8.6 | 48 | 0 | 8.4 |
| teddy hall comedian | 0 | 0 | n/a | 18 | 0 | 5.7 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 10 | 0 | 9.3 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 42 | 0 | 5.9 |
| comedy shows 2026 | 4 | 0 | 6.5 | 5 | 0 | 2.2 |
| comedy 2026 | 3 | 0 | 12.7 | 11 | 0 | 5.5 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 6 | 0 | 8.5 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 4 | 0 | 6.5 |
| comedy auftritte 2026 | 0 | 0 | n/a | 3 | 0 | 5.0 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 15.4% | 6.2% | 6.5% | 5.0% | 2.6% | 1.4% | 2.2% | 0.7% | 1.3% | 1.4%* | 1.2%* | 1.6% | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.8% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 58.8 | bottom of page one, aim higher | stand up comedy | / | 409 | 4 | 5.8 |  |  |
| 46.9 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2107 | 8 | 9.9 |  | yes |
| 25.6 | bottom of page one, aim higher | stand up comedy zurich | / | 564 | 61 | 5.5 |  |  |
| 18.5 | bottom of page one, aim higher | comedy show zürich | / | 140 | 3 | 6.4 |  |  |
| 13.4 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 205 | 0 | 8.0 |  | yes |
| 12.0 | bottom of page one, aim higher | comedy shows zurich | / | 225 | 2 | 6.5 |  |  |
| 10.5 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 75 | 1 | 6.2 |  |  |
| 9.7 | bottom of page one, aim higher | standup comedy | / | 70 | 1 | 5.9 | standup |  |
| 9.2 | bottom of page one, aim higher | stand up comedy schweiz | / | 147 | 0 | 7.3 | schweiz |  |
| 9.1 | bottom of page one, aim higher | stand up | / | 59 | 0 | 6.2 |  |  |
| 8.7 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 312 | 7 | 8.7 |  | yes |
| 8.4 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 175 | 3 | 7.9 |  |  |
| 7.1 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 46 | 0 | 6.1 |  | yes |
| 6.6 | bottom of page one, aim higher | robins bar | /comedybrew/ | 116 | 1 | 7.8 |  |  |
| 6.0 | bottom of page one, aim higher | comedy shows zürich | / | 39 | 0 | 6.0 |  |  |
| 6.0 | bottom of page one, aim higher | teddy hall comedy | /comedians/teddy-hall/ | 78 | 6 | 5.5 |  | yes |
| 4.9 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 111 | 2 | 3.9 |  | yes |
| 4.9 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 45 | 2 | 5.8 |  | yes |
| 4.7 | bottom of page one, aim higher | comedy zurich | / | 267 | 12 | 6.9 |  |  |
| 4.4 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 87 | 1 | 4.0 |  | yes |
| 4.4 | bottom of page one, aim higher | open mic comedy zürich | / | 48 | 3 | 6.4 |  |  |
| 4.2 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 4.1 | bottom of page one, aim higher | standup comedy zurich | / | 79 | 8 | 6.1 | standup |  |
| 3.7 | bottom of page one, aim higher | comedy show | / | 60 | 0 | 7.4 |  |  |
| 3.6 | bottom of page one, aim higher | ruben garcia | /comedians/ruben-garcia/ | 57 | 0 | 7.0 |  | yes |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (661 @ 3.7), /calendar/ (175 @ 7.9)
- comedy zürich: 2 pages share this query: / (381 @ 10.6), /calendar/ (148 @ 10.7)
- comedy zurich: 2 pages share this query: / (267 @ 6.9), /calendar/ (57 @ 7.8)
- comedy shows zurich: 2 pages share this query: / (225 @ 6.5), /calendar/ (53 @ 8.8)
- open mic zürich: 2 pages share this query: /comedybrew/ (189 @ 14.3), / (59 @ 9.7)
- comedy show zürich: 2 pages share this query: / (140 @ 6.4), /calendar/ (127 @ 10.6)
- comedy show zurich: 2 pages share this query: / (129 @ 7.0), /calendar/ (45 @ 7.0)
- standup comedy zürich: 2 pages share this query: / (128 @ 4.1), /calendar/ (45 @ 8.9)
- comedy: 2 pages share this query: / (127 @ 9.9), /calendar/ (45 @ 10.0)
- english comedy zurich: 2 pages share this query: / (123 @ 3.1), /calendar/ (40 @ 8.6)
- comedy show: 2 pages share this query: /calendar/ (97 @ 10.2), / (60 @ 7.4)
- comedy night zürich: 2 pages share this query: /calendar/ (71 @ 10.6), / (38 @ 4.4)
- stand-up comedy zürich english: 2 pages share this query: / (53 @ 2.8), /calendar/ (15 @ 10.5)
- mike casa: 2 pages share this query: /mike-casa/ (53 @ 7.0), /comedians/mike-casa/ (26 @ 9.3)
- english stand up comedy: 2 pages share this query: / (52 @ 16.7), /calendar/ (16 @ 9.4)
- open mic comedy zürich: 2 pages share this query: / (48 @ 6.4), /comedybrew/ (31 @ 10.1)
- comedy shows zürich: 2 pages share this query: /calendar/ (48 @ 10.1), / (39 @ 6.0)
- stand up zürich: 2 pages share this query: / (47 @ 3.6), /calendar/ (21 @ 8.9)
- comedy shows: 2 pages share this query: / (47 @ 18.0), /calendar/ (27 @ 9.8)
- english comedy: 2 pages share this query: / (37 @ 7.8), /calendar/ (9 @ 10.4)
- open mic comedy: 2 pages share this query: / (36 @ 4.9), /comedybrew/ (8 @ 4.5)
- open mic: 2 pages share this query: /comedybrew/ (34 @ 24.9), / (7 @ 4.0)
- comedy night zurich: 2 pages share this query: / (30 @ 7.0), /calendar/ (9 @ 7.7)
- comedy night: 2 pages share this query: /calendar/ (27 @ 8.4), / (19 @ 4.8)
- comedy brew: 2 pages share this query: /comedybrew/ (26 @ 1.2), / (24 @ 4.2)
- stand-up comedy zürich: 2 pages share this query: / (25 @ 1.7), /calendar/ (20 @ 8.0)
- open mic zurich: 2 pages share this query: /comedybrew/ (22 @ 8.3), / (4 @ 4.5)
- english comedy night: 2 pages share this query: / (19 @ 6.8), /calendar/ (15 @ 28.5)
- zürich comedy: 2 pages share this query: / (19 @ 7.0), /calendar/ (16 @ 11.0)
- mike casa comedy: 2 pages share this query: /mike-casa/ (16 @ 11.3), /comedians/mike-casa/ (9 @ 11.7)
- comedy in zürich: 2 pages share this query: / (14 @ 7.4), /calendar/ (8 @ 15.6)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- zürich comedy show: 2 pages share this query: /calendar/ (13 @ 9.8), / (12 @ 7.6)
- comedy switzerland: 3 pages share this query: / (11 @ 22.2), /calendar/ (9 @ 49.3), /switzerland/ (6 @ 10.5)
- comedian zürich: 2 pages share this query: /calendar/ (11 @ 14.4), / (9 @ 10.7)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 198.6)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 13501 impressions, 800 clicks, position 6.6
- Words the queries use that the page does not: schweiz (307), standup (184), comedian (105), night (87), nightwash (15), heute (15), matt (14), rife (14)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 409 | 4 | 5.8 | 58.8 |  |
| stand up comedy zurich | bottom of page one, aim higher | 564 | 61 | 5.5 | 25.6 |  |
| comedy show zürich | bottom of page one, aim higher | 140 | 3 | 6.4 | 18.5 |  |
| comedy shows zurich | bottom of page one, aim higher | 225 | 2 | 6.5 | 12.0 |  |
| standup comedy | bottom of page one, aim higher | 70 | 1 | 5.9 | 9.7 | standup |
| stand up comedy schweiz | bottom of page one, aim higher | 147 | 0 | 7.3 | 9.2 | schweiz |
| stand up | bottom of page one, aim higher | 59 | 0 | 6.2 | 9.1 |  |
| comedy shows zürich | bottom of page one, aim higher | 39 | 0 | 6.0 | 6.0 |  |
| comedy zurich | bottom of page one, aim higher | 267 | 12 | 6.9 | 4.7 |  |
| open mic comedy zürich | bottom of page one, aim higher | 48 | 3 | 6.4 | 4.4 |  |
| standup comedy zurich | bottom of page one, aim higher | 79 | 8 | 6.1 | 4.1 | standup |
| comedy show | bottom of page one, aim higher | 60 | 0 | 7.4 | 3.7 |  |

### /calendar/ (gain 36.9)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5189 impressions, 98 clicks, position 8.2
- Words the queries use that the page does not: standup (56)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | bottom of page one, aim higher | 75 | 1 | 6.2 | 10.5 |  |
| stand up comedy zürich | bottom of page one, aim higher | 175 | 3 | 7.9 | 8.4 |  |
| comedy zurich | bottom of page one, aim higher | 57 | 1 | 7.8 | 2.7 |  |
| comedy show | bottom of page one, aim higher | 97 | 0 | 10.2 | 2.5 |  |
| comedy show zürich | bottom of page one, aim higher | 127 | 0 | 10.6 | 1.8 |  |
| comedy 2026 | bottom of page one, aim higher | 25 | 0 | 7.1 | 1.6 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 20 | 0 | 8.0 | 1.3 |  |
| standup comedy zürich | bottom of page one, aim higher | 45 | 1 | 8.9 | 1.3 | standup |
| comedy | bottom of page one, aim higher | 45 | 0 | 10.0 | 1.2 |  |
| comedy night zürich | bottom of page one, aim higher | 71 | 0 | 10.6 | 1.0 |  |
| comedy show zurich | bottom of page one, aim higher | 45 | 2 | 7.0 | 0.8 |  |
| english stand up comedy | bottom of page one, aim higher | 16 | 0 | 9.4 | 0.8 |  |

### /comedybrew/ (gain 19.3)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2662 impressions, 207 clicks, position 9.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 116 | 1 | 7.8 | 6.6 |  |
| robins bar and coffee | bottom of page one, aim higher | 38 | 0 | 7.9 | 2.5 |  |
| robins | bottom of page one, aim higher | 36 | 0 | 6.7 | 2.2 |  |
| robins zurich | bottom of page one, aim higher | 30 | 0 | 7.9 | 2.0 |  |
| robins bar zurich | bottom of page one, aim higher | 34 | 0 | 9.1 | 1.7 |  |
| robins coffee | bottom of page one, aim higher | 26 | 0 | 8.1 | 1.7 |  |
| robin's bar & coffee | bottom of page one, aim higher | 56 | 2 | 8.3 | 1.6 |  |
| robins zürich | bottom of page one, aim higher | 24 | 1 | 7.0 | 0.5 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.4 |  |
| stand up comedy | page two, aim for page one | 10 | 0 | 11.8 | 0.1 |  |
| open mic zürich | page two, aim for page one | 189 | 4 | 14.3 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 31 | 3 | 10.1 | 0.0 |  |

### /mike-casa/ (gain 8.4)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 361 impressions, 7 clicks, position 6.8

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa zurich | bottom of page one, aim higher | 45 | 2 | 5.8 | 4.9 |  (name) |
| mike casa | bottom of page one, aim higher | 53 | 0 | 7.0 | 3.3 |  (name) |
| mike casa comedy | page two, aim for page one | 16 | 0 | 11.3 | 0.2 |  (name) |

### /nerdycomedyshow/ (gain 1.8)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 331 impressions, 19 clicks, position 11.4

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 1.5 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 0.8)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 85 impressions, 8 clicks, position 9.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 12 | 1 | 5.8 | 0.8 |  (name) |

### /gratis-zum-mitnehmen/ (gain 0.7)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 150 impressions, 4 clicks, position 5.3
- Words the queries use that the page does not: bring (11), funny (11)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 11 | 0 | 7.3 | 0.7 | bring, funny |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

### /switzerland/ (gain 0.0)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 492 impressions, 3 clicks, position 6.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 19 | 1 | 8.9 | 0.0 |  |

## Comedian pages (meta-only)

15 comedian pages carry opportunities worth 115.1 extra clicks a quarter over 3319 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (23), andrearamirez (16), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 47.1 | andrea ramirez | 2107 | 9.9 | yes |
| /comedians/teddy-hall/ | 18.2 | teddy hall | 312 | 8.7 | yes |
| /comedians/woocash/ | 13.4 | woocash | 205 | 8.0 | yes |
| /comedians/emir-tonbul/ | 8.7 | tonbul | 46 | 6.1 | yes |
| /comedians/miguel/ | 5.5 | miguel zurich | 11 | 6.3 | yes |
| /comedians/richard-cunha/ | 4.9 | richard cunha | 111 | 3.9 | yes |
| /comedians/albert-louw/ | 4.4 | albert louw | 87 | 4.0 | yes |
| /comedians/coopernik/ | 4.2 | nik | 64 | 7.6 | yes |
| /comedians/ruben-garcia/ | 3.6 | ruben garcia | 57 | 7.0 | yes |
| /comedians/vasilis-theof/ | 2.0 | theof | 13 | 5.7 | yes |
| /comedians/martinadoescomedy/ | 0.9 | martina comedian | 18 | 8.9 | yes |
| /comedians/laugh-at-domenico/ | 0.8 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.6 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.6 | roza | 11 | 9.3 | yes |
| /comedians/mike-casa/ | 0.3 | mike casa | 26 | 9.3 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| woocash | /comedians/woocash/ | 26 | 10.8 | 13.0 |


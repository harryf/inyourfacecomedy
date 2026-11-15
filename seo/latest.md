# Search Console loop: week of 2026-11-15

Snapshot window 2026-10-16 to 2026-11-12 (28 days of final data, 243 query and page pairs with 3 or more impressions over 74 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-15 to 2026-11-12 (90 days, 412 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-15T18:14:26.784Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |
| 2026-11-04 | 587 | 12969 | 4.5% | 6.8 | 73 |
| 2026-11-06 | 585 | 12933 | 4.5% | 6.9 | 73 |
| 2026-11-10 | 562 | 12720 | 4.4% | 6.9 | 75 |
| 2026-11-12 | 566 | 12809 | 4.4% | 7.0 | 74 |

Devices this window: mobile 7821 impressions at position 6.1; desktop 3055 impressions at position 9.1; tablet 86 impressions at position 6.4.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 55 | improved | position -1.8, clicks 25 to 54 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 55 | flat | position +0.8, clicks 1 to 0 on 1 judged query |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 55 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 55 | worse | position -0.6, clicks 6 to 4 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 55 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 55 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-11-14-1 | /comedybrew/ | 2026-11-14 | -2 | too early | -2 of 28 days of final data since the change |
| exp-2026-11-14-2 | /comedybrew/ | 2026-11-14 | -2 | too early | -2 of 28 days of final data since the change |
| exp-2026-11-14-3 | /calendar/ | 2026-11-14 | -2 | too early | -2 of 28 days of final data since the change |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 241 | 15 | 3.9 |
| stand up comedy zurich | 178 | 15 | 6.1 | 177 | 19 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 76 | 5 | 7.2 |
| comedy zürich | 120 | 1 | 14.0 | 61 | 4 | 6.1 |
| comedy club zurich | 39 | 0 | 7.9 | 77 | 6 | 5.9 |
| comedy club zürich | 18 | 1 | 7.5 | 75 | 3 | 6.8 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 37 | 0 | 4.9 |
| stand up comedy | 108 | 0 | 6.3 | 151 | 2 | 5.6 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 56 | 0 | 14.4 |
| open mic zurich | 11 | 1 | 9.8 | 3 | 1 | 4.3 |
| open mic comedy zürich | 13 | 1 | 9.1 | 8 | 0 | 11.6 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 20 | 0 | 6.3 |
| swiss stand up comedians | 0 | 0 | n/a | 7 | 0 | 4.7 |
| swiss comedian | 0 | 0 | n/a | 4 | 0 | 5.8 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 33 | 2 | 5.4 |
| teddy hall | 133 | 4 | 8.6 | 75 | 2 | 8.0 |
| teddy hall comedian | 0 | 0 | n/a | 23 | 1 | 5.4 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 9 | 0 | 7.0 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 45 | 0 | 6.8 |
| comedy shows 2026 | 4 | 0 | 6.5 | 4 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 7 | 0 | 5.3 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 9 | 0 | 9.7 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-11-14-1: Title now 'Comedy Brew: Open Mic Zürich, English Stand-Up Every Thursday' (Open Mic Zürich in the first 30 characters; Comedy Brew stays first because the show name is the text before the first separator; on 15 November the colon joined that rule everywhere, flyers, h1, /go/ and the Google post included, see _includes/title-parts.liquid)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 56 | 0 | 14.5 | 56 | 0 | 14.4 |
| open mic zurich | 3 | 1 | 4.3 | 3 | 1 | 4.3 |
| open mic comedy zürich | 10 | 0 | 11.7 | 8 | 0 | 11.6 |
| open mic comedy zurich | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy open mic zürich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-11-14-2: The page names the venue in full: 'ROBIN's Bar & Coffee' in the meta description, the essentials line and the 'What about' heading (was ROBIN's)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| robins bar | 32 | 1 | 8.7 | 29 | 1 | 8.9 |
| robin's bar & coffee | 10 | 0 | 7.6 | 10 | 0 | 7.6 |
| robins bar and coffee | 9 | 0 | 7.8 | 9 | 0 | 7.8 |
| robins | 0 | 0 | n/a | 0 | 0 | n/a |
| robins zurich | 17 | 0 | 7.8 | 17 | 0 | 7.8 |
| robins zürich | 26 | 1 | 8.1 | 26 | 1 | 8.1 |
| robins coffee | 8 | 0 | 11.0 | 8 | 0 | 11.0 |
| robins coffee zurich | 2 | 0 | 9.5 | 0 | 0 | n/a |
| robins bar zurich | 11 | 0 | 9.5 | 10 | 0 | 10.4 |

### exp-2026-11-14-3: Calendar title now 'Comedy Shows Zürich 2026: English Comedy Nights and Tickets' and the description leads with 'Every comedy show in Zürich', naming comedy nights, open mics and one-off shows; the home page keeps 'stand-up comedy Zürich' and 'comedy club' so the two pages stop sharing the shows and nights queries

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy shows zürich | 38 | 1 | 10.2 | 37 | 1 | 10.1 |
| comedy shows zurich | 37 | 2 | 6.5 | 38 | 2 | 6.6 |
| comedy show zürich | 124 | 0 | 10.3 | 126 | 0 | 10.3 |
| comedy show zurich | 47 | 2 | 6.5 | 47 | 2 | 6.4 |
| comedy night zürich | 62 | 0 | 10.0 | 63 | 0 | 10.0 |
| comedy night zurich | 7 | 0 | 7.4 | 8 | 0 | 7.6 |
| comedy zürich 2026 | 43 | 0 | 6.8 | 45 | 0 | 6.8 |
| comedy shows | 24 | 0 | 10.9 | 27 | 0 | 10.5 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 11.9% | 5.2% | 8.5% | 1.6% | 2.5% | 2.0% | 2.0% | 0.7% | 1.9% | 1.4%* | 0.0% | 1.1%* | 1.9% | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.7% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 47.3 | bottom of page one, aim higher | stand up comedy | / | 430 | 4 | 5.9 |  |  |
| 46.2 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2125 | 6 | 9.9 |  | yes |
| 19.1 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 320 | 8 | 8.3 |  | yes |
| 15.9 | bottom of page one, aim higher | comedy show zürich | / | 158 | 3 | 5.8 |  |  |
| 15.6 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 196 | 1 | 8.1 |  | yes |
| 12.9 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 188 | 3 | 7.8 |  |  |
| 11.0 | bottom of page one, aim higher | comedy shows zurich | / | 249 | 2 | 6.6 |  |  |
| 10.5 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 96 | 1 | 6.5 |  |  |
| 8.8 | bottom of page one, aim higher | mike casa | /mike-casa/ | 104 | 0 | 7.7 |  | yes |
| 7.8 | bottom of page one, aim higher | robins bar | /comedybrew/ | 116 | 2 | 8.0 |  |  |
| 7.6 | bottom of page one, aim higher | stand up comedy schweiz | / | 146 | 0 | 6.8 | schweiz |  |
| 7.4 | bottom of page one, aim higher | standup comedy | / | 70 | 1 | 5.9 | standup |  |
| 5.7 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 129 | 1 | 4.3 |  | yes |
| 5.2 | bottom of page one, aim higher | comedy zurich | / | 291 | 10 | 7.0 |  |  |
| 4.8 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 40 | 0 | 5.8 |  | yes |
| 4.6 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 54 | 0 | 7.6 |  | yes |
| 4.3 | ranks well, few clicks: the listing text | stand-up comedy zürich | / | 44 | 1 | 3.1 |  |  |
| 3.9 | bottom of page one, aim higher | robin's bar & coffee | /comedybrew/ | 58 | 1 | 8.1 |  |  |
| 3.8 | bottom of page one, aim higher | comedy show zurich | / | 150 | 4 | 7.2 |  |  |
| 3.7 | bottom of page one, aim higher | comedy zurich | /calendar/ | 56 | 1 | 8.2 |  |  |
| 3.7 | ranks well, few clicks: the listing text | comedy shows zürich | / | 44 | 0 | 5.0 |  |  |
| 3.7 | bottom of page one, aim higher | comedy show zürich | /calendar/ | 152 | 0 | 10.4 |  |  |
| 3.7 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 89 | 1 | 4.2 |  | yes |
| 3.6 | bottom of page one, aim higher | robins bar and coffee | /comedybrew/ | 43 | 0 | 7.8 |  |  |
| 3.5 | bottom of page one, aim higher | open mic comedy zürich | / | 63 | 4 | 6.5 |  |  |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (733 @ 4.0), /calendar/ (188 @ 7.8)
- comedy zürich: 2 pages share this query: / (343 @ 10.0), /calendar/ (159 @ 10.8)
- comedy zurich: 2 pages share this query: / (291 @ 7.0), /calendar/ (56 @ 8.2)
- comedy shows zurich: 2 pages share this query: / (249 @ 6.6), /calendar/ (56 @ 8.7)
- open mic zürich: 2 pages share this query: /comedybrew/ (191 @ 15.2), / (63 @ 8.9)
- standup comedy zürich: 2 pages share this query: / (161 @ 4.4), /calendar/ (49 @ 9.3)
- comedy show zürich: 2 pages share this query: / (158 @ 5.8), /calendar/ (152 @ 10.4)
- comedy show zurich: 2 pages share this query: / (150 @ 7.2), /calendar/ (62 @ 6.7)
- comedy: 2 pages share this query: / (148 @ 9.6), /calendar/ (48 @ 10.1)
- english comedy zurich: 2 pages share this query: / (130 @ 2.9), /calendar/ (51 @ 8.5)
- mike casa: 2 pages share this query: /mike-casa/ (104 @ 7.7), /comedians/mike-casa/ (34 @ 9.4)
- comedy show: 2 pages share this query: /calendar/ (100 @ 10.1), / (63 @ 7.1)
- comedy night zürich: 2 pages share this query: /calendar/ (75 @ 10.1), / (48 @ 4.8)
- open mic comedy zürich: 2 pages share this query: / (63 @ 6.5), /comedybrew/ (33 @ 10.2)
- stand-up comedy zürich english: 2 pages share this query: / (59 @ 2.7), /calendar/ (20 @ 10.3)
- comedy shows zürich: 2 pages share this query: /calendar/ (53 @ 10.3), / (44 @ 5.0)
- stand up zürich: 2 pages share this query: / (47 @ 3.9), /calendar/ (24 @ 8.9)
- stand-up comedy zürich: 2 pages share this query: / (44 @ 3.1), /calendar/ (24 @ 8.0)
- comedy shows: 2 pages share this query: / (43 @ 16.5), /calendar/ (37 @ 10.4)
- english stand up comedy: 2 pages share this query: / (41 @ 9.8), /calendar/ (16 @ 9.4)
- english comedy: 2 pages share this query: / (39 @ 7.2), /calendar/ (11 @ 11.3)
- comedy night zurich: 2 pages share this query: / (38 @ 7.3), /calendar/ (9 @ 7.7)
- open mic comedy: 2 pages share this query: / (37 @ 5.2), /comedybrew/ (8 @ 4.9)
- open mic: 2 pages share this query: /comedybrew/ (36 @ 24.3), / (13 @ 14.2)
- comedy brew: 2 pages share this query: /comedybrew/ (33 @ 1.1), / (32 @ 4.2)
- mike casa comedy: 2 pages share this query: /mike-casa/ (33 @ 9.8), /comedians/mike-casa/ (17 @ 10.7)
- comedy night: 2 pages share this query: /calendar/ (30 @ 8.5), / (21 @ 5.2)
- english comedy night: 2 pages share this query: / (21 @ 7.1), /calendar/ (15 @ 21.1)
- zürich comedy: 2 pages share this query: / (20 @ 4.7), /calendar/ (19 @ 11.1)
- comedians: 2 pages share this query: /comedians/ (20 @ 6.1), / (15 @ 9.9)
- open mic zurich: 2 pages share this query: /comedybrew/ (18 @ 7.8), / (4 @ 4.5)
- comedy in zürich: 2 pages share this query: / (17 @ 6.5), /calendar/ (8 @ 15.6)
- zürich comedy show: 2 pages share this query: / (15 @ 6.6), /calendar/ (13 @ 9.8)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- comedian zürich: 2 pages share this query: / (13 @ 11.7), /calendar/ (13 @ 10.8)
- comedy switzerland: 3 pages share this query: / (12 @ 32.8), /calendar/ (12 @ 44.5), /switzerland/ (8 @ 10.6)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 149.5)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 14894 impressions, 858 clicks, position 6.4
- Words the queries use that the page does not: schweiz (328), comedian (136), night (107), standup (106), matt (16), rife (16), heute (16), nightwash (15)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 430 | 4 | 5.9 | 47.3 |  |
| comedy show zürich | bottom of page one, aim higher | 158 | 3 | 5.8 | 15.9 |  |
| comedy shows zurich | bottom of page one, aim higher | 249 | 2 | 6.6 | 11.0 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 146 | 0 | 6.8 | 7.6 | schweiz |
| standup comedy | bottom of page one, aim higher | 70 | 1 | 5.9 | 7.4 | standup |
| comedy zurich | bottom of page one, aim higher | 291 | 10 | 7.0 | 5.2 |  |
| stand-up comedy zürich | ranks well, few clicks: the listing text | 44 | 1 | 3.1 | 4.3 |  |
| comedy show zurich | bottom of page one, aim higher | 150 | 4 | 7.2 | 3.8 |  |
| comedy shows zürich | ranks well, few clicks: the listing text | 44 | 0 | 5.0 | 3.7 |  |
| open mic comedy zürich | bottom of page one, aim higher | 63 | 4 | 6.5 | 3.5 |  |
| comedy show | bottom of page one, aim higher | 63 | 0 | 7.1 | 3.3 |  |
| comedy night zürich | ranks well, few clicks: the listing text | 48 | 1 | 4.8 | 3.1 | night |

### /calendar/ (gain 43.5)

Source `pages/1_calendar.md`

- Title: Comedy Shows Zürich 2026: English Comedy Nights and Tickets
- Description: Every comedy show in Zürich from IN YOUR FACE, month by month through 2026: English comedy nights, open mics and one-off shows with dates, venues and ticket links. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5762 impressions, 113 clicks, position 8.2
- Words the queries use that the page does not: standup (49), schweiz (12)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy zürich | bottom of page one, aim higher | 188 | 3 | 7.8 | 12.9 |  |
| comedy zürich 2026 | bottom of page one, aim higher | 96 | 1 | 6.5 | 10.5 |  |
| comedy zurich | bottom of page one, aim higher | 56 | 1 | 8.2 | 3.7 |  |
| comedy show zürich | bottom of page one, aim higher | 152 | 0 | 10.4 | 3.7 |  |
| comedy show | bottom of page one, aim higher | 100 | 0 | 10.1 | 2.5 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 24 | 0 | 8.0 | 2.0 |  |
| comedy night zürich | bottom of page one, aim higher | 75 | 0 | 10.1 | 1.8 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 7.0 | 1.4 |  |
| comedy | bottom of page one, aim higher | 48 | 0 | 10.1 | 1.2 |  |
| comedy shows | bottom of page one, aim higher | 37 | 0 | 10.4 | 0.9 |  |
| zürich comedy | page two, aim for page one | 19 | 0 | 11.1 | 0.4 |  |
| english comedy zurich | bottom of page one, aim higher | 51 | 4 | 8.5 | 0.3 |  |

### /comedybrew/ (gain 24.3)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew: Open Mic Zürich, English Stand-Up Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's Bar & Coffee near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, in English.
- Overall: 2637 impressions, 209 clicks, position 9.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 116 | 2 | 8.0 | 7.8 |  |
| robin's bar & coffee | bottom of page one, aim higher | 58 | 1 | 8.1 | 3.9 |  |
| robins bar and coffee | bottom of page one, aim higher | 43 | 0 | 7.8 | 3.6 |  |
| robins | bottom of page one, aim higher | 29 | 0 | 6.1 | 3.5 |  |
| robins zurich | bottom of page one, aim higher | 32 | 0 | 7.8 | 2.7 |  |
| robins zürich | bottom of page one, aim higher | 36 | 2 | 7.5 | 1.1 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.5 |  |
| robins coffee | bottom of page one, aim higher | 28 | 0 | 8.7 | 0.4 |  |
| robins bar zurich | bottom of page one, aim higher | 27 | 0 | 9.0 | 0.4 |  |
| stand up comedy | page two, aim for page one | 15 | 0 | 12.1 | 0.3 |  |
| open mic zürich | page two, aim for page one | 191 | 4 | 15.2 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 33 | 3 | 10.2 | 0.0 |  |

### /mike-casa/ (gain 13.7)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 529 impressions, 9 clicks, position 7.0
- Words the queries use that the page does not: mikecasa (10)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa | bottom of page one, aim higher | 104 | 0 | 7.7 | 8.8 |  (name) |
| mike casa zurich | bottom of page one, aim higher | 52 | 3 | 5.7 | 3.2 |  (name) |
| mikecasa | bottom of page one, aim higher | 10 | 0 | 8.2 | 0.8 | mikecasa |
| mike casa comedy | bottom of page one, aim higher | 33 | 0 | 9.8 | 0.8 |  (name) |

### /switzerland/ (gain 3.2)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 558 impressions, 4 clicks, position 5.9

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 33 | 1 | 7.7 | 1.8 |  |
| swiss stand up comedians | bottom of page one, aim higher | 12 | 0 | 5.8 | 1.4 |  |

### /comedians/ (gain 2.6)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 690 impressions, 9 clicks, position 5.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedians | bottom of page one, aim higher | 20 | 0 | 6.1 | 2.4 |  (name) |
| fabian volkart | bottom of page one, aim higher | 11 | 0 | 9.2 | 0.2 | fabian, volkart (name) |

### /gratis-zum-mitnehmen/ (gain 1.7)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 174 impressions, 6 clicks, position 5.5
- Words the queries use that the page does not: bring (20), funny (20)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 20 | 0 | 7.5 | 1.7 | bring, funny |

### /nerdycomedyshow/ (gain 0.8)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 339 impressions, 28 clicks, position 9.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 0.5 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 0.6)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 95 impressions, 12 clicks, position 9.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 1 | 6.1 | 0.6 |  (name) |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

13 comedian pages carry opportunities worth 114.3 extra clicks a quarter over 3255 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (33), andrearamirez (16), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 46.5 | andrea ramirez | 2125 | 9.9 | yes |
| /comedians/teddy-hall/ | 22.1 | teddy hall | 320 | 8.3 | yes |
| /comedians/woocash/ | 15.6 | woocash | 196 | 8.1 | yes |
| /comedians/richard-cunha/ | 5.7 | richard cunha | 129 | 4.3 | yes |
| /comedians/miguel/ | 5.3 | miguel stand up | 20 | 6.3 |  |
| /comedians/emir-tonbul/ | 4.8 | tonbul | 40 | 5.8 | yes |
| /comedians/coopernik/ | 4.6 | nik | 54 | 7.6 | yes |
| /comedians/albert-louw/ | 3.7 | albert louw | 89 | 4.2 | yes |
| /comedians/ruben-garcia/ | 2.5 | ruben garcia | 47 | 7.2 | yes |
| /comedians/martinadoescomedy/ | 1.7 | martina comedian | 20 | 7.9 | yes |
| /comedians/laugh-at-domenico/ | 1.1 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.5 | dr val | 10 | 6.8 | yes |
| /comedians/mike-casa/ | 0.3 | mike casa comedy | 17 | 10.7 | yes |


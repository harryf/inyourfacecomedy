# Search Console loop: week of 2026-11-23

Snapshot window 2026-10-24 to 2026-11-20 (28 days of final data, 255 query and page pairs with 3 or more impressions over 73 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-23 to 2026-11-20 (90 days, 434 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-23T09:40:02.476Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |
| 2026-11-04 | 587 | 12969 | 4.5% | 6.8 | 73 |
| 2026-11-06 | 585 | 12933 | 4.5% | 6.9 | 73 |
| 2026-11-10 | 562 | 12720 | 4.4% | 6.9 | 75 |
| 2026-11-12 | 566 | 12809 | 4.4% | 7.0 | 74 |
| 2026-11-13 | 567 | 12784 | 4.4% | 6.9 | 74 |
| 2026-11-20 | 570 | 12276 | 4.6% | 6.8 | 73 |

Devices this window: mobile 7522 impressions at position 6.0; desktop 2967 impressions at position 8.7; tablet 90 impressions at position 6.4.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 63 | improved | position -1.6, clicks 25 to 51 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 63 | worse | position +1.3, clicks 2 to 0 on 2 judged queries |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 63 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 63 | flat | position -0.7, clicks 6 to 6 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 63 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 63 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-11-14-1 | /comedybrew/ | 2026-11-14 | 6 | too early | 6 of 28 days of final data since the change |
| exp-2026-11-14-2 | /comedybrew/ | 2026-11-14 | 6 | too early | 6 of 28 days of final data since the change |
| exp-2026-11-14-3 | /calendar/ | 2026-11-14 | 6 | too early | 6 of 28 days of final data since the change |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 244 | 12 | 4.6 |
| stand up comedy zurich | 178 | 15 | 6.1 | 189 | 21 | 5.1 |
| comedy zurich | 110 | 1 | 7.1 | 85 | 7 | 7.5 |
| comedy zürich | 120 | 1 | 14.0 | 62 | 2 | 5.4 |
| comedy club zurich | 39 | 0 | 7.9 | 80 | 6 | 5.7 |
| comedy club zürich | 18 | 1 | 7.5 | 78 | 2 | 7.0 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 36 | 0 | 5.8 |
| stand up comedy | 108 | 0 | 6.3 | 140 | 1 | 5.6 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 61 | 0 | 14.6 |
| open mic zurich | 11 | 1 | 9.8 | 4 | 1 | 5.0 |
| open mic comedy zürich | 13 | 1 | 9.1 | 12 | 0 | 11.7 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 26 | 0 | 5.5 |
| swiss stand up comedians | 0 | 0 | n/a | 9 | 0 | 4.4 |
| swiss comedian | 0 | 0 | n/a | 5 | 0 | 6.4 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 49 | 2 | 5.9 |
| teddy hall | 133 | 4 | 8.6 | 101 | 4 | 7.8 |
| teddy hall comedian | 0 | 0 | n/a | 27 | 1 | 5.6 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 7 | 0 | 5.4 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 42 | 0 | 7.5 |
| comedy shows 2026 | 4 | 0 | 6.5 | 3 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 4 | 0 | 5.0 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 9 | 0 | 10.6 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-11-14-1: Title now 'Comedy Brew: Open Mic Zürich, English Stand-Up Every Thursday' (Open Mic Zürich in the first 30 characters; Comedy Brew stays first because the show name is the text before the first separator; on 15 November the colon joined that rule everywhere, flyers, h1, /go/ and the Google post included, see _includes/title-parts.liquid)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 56 | 0 | 14.5 | 61 | 0 | 14.6 |
| open mic zurich | 3 | 1 | 4.3 | 4 | 1 | 5.0 |
| open mic comedy zürich | 10 | 0 | 11.7 | 12 | 0 | 11.7 |
| open mic comedy zurich | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy open mic zürich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-11-14-2: The page names the venue in full: 'ROBIN's Bar & Coffee' in the meta description, the essentials line and the 'What about' heading (was ROBIN's)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| robins bar | 32 | 1 | 8.7 | 45 | 1 | 8.1 |
| robin's bar & coffee | 10 | 0 | 7.6 | 13 | 0 | 8.2 |
| robins bar and coffee | 9 | 0 | 7.8 | 8 | 0 | 7.8 |
| robins | 0 | 0 | n/a | 0 | 0 | n/a |
| robins zurich | 17 | 0 | 7.8 | 21 | 0 | 11.1 |
| robins zürich | 26 | 1 | 8.1 | 28 | 1 | 8.0 |
| robins coffee | 8 | 0 | 11.0 | 10 | 0 | 10.8 |
| robins coffee zurich | 2 | 0 | 9.5 | 4 | 0 | 9.3 |
| robins bar zurich | 11 | 0 | 9.5 | 6 | 0 | 8.0 |

### exp-2026-11-14-3: Calendar title now 'Comedy Shows Zürich 2026: English Comedy Nights and Tickets' and the description leads with 'Every comedy show in Zürich', naming comedy nights, open mics and one-off shows; the home page keeps 'stand-up comedy Zürich' and 'comedy club' so the two pages stop sharing the shows and nights queries

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy shows zürich | 38 | 1 | 10.2 | 29 | 0 | 11.1 |
| comedy shows zurich | 37 | 2 | 6.5 | 26 | 2 | 6.5 |
| comedy show zürich | 124 | 0 | 10.3 | 78 | 0 | 10.5 |
| comedy show zurich | 47 | 2 | 6.5 | 33 | 1 | 6.4 |
| comedy night zürich | 62 | 0 | 10.0 | 48 | 0 | 10.0 |
| comedy night zurich | 7 | 0 | 7.4 | 0 | 0 | n/a |
| comedy zürich 2026 | 43 | 0 | 6.8 | 42 | 0 | 7.5 |
| comedy shows | 24 | 0 | 10.9 | 20 | 0 | 11.4 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 9.7% | 5.1% | 8.3% | 1.8% | 2.7% | 1.9% | 2.0% | 0.6% | 1.3% | 1.4%* | 1.2% | 1.1%* | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.7% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 49.7 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2062 | 7 | 9.9 |  | yes |
| 38.3 | bottom of page one, aim higher | stand up comedy | / | 438 | 4 | 5.8 |  |  |
| 18.4 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 320 | 8 | 8.1 |  | yes |
| 14.6 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 189 | 1 | 8.0 |  | yes |
| 13.7 | bottom of page one, aim higher | comedy show zürich | / | 173 | 3 | 5.7 |  |  |
| 13.2 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 196 | 3 | 8.1 |  |  |
| 11.3 | bottom of page one, aim higher | mike casa | /mike-casa/ | 137 | 0 | 7.9 |  | yes |
| 10.5 | bottom of page one, aim higher | comedy shows zurich | / | 246 | 2 | 6.6 |  |  |
| 9.2 | bottom of page one, aim higher | robins bar | /comedybrew/ | 136 | 2 | 7.9 |  |  |
| 7.4 | bottom of page one, aim higher | stand up comedy schweiz | / | 146 | 0 | 6.9 | schweiz |  |
| 5.5 | bottom of page one, aim higher | standup comedy | / | 67 | 1 | 5.9 | standup |  |
| 5.3 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 125 | 1 | 4.2 |  | yes |
| 4.7 | bottom of page one, aim higher | stand up | / | 49 | 0 | 6.5 |  |  |
| 4.6 | bottom of page one, aim higher | comedy show zürich | /calendar/ | 169 | 0 | 10.4 |  |  |
| 4.5 | ranks well, few clicks: the listing text | stand-up comedy zürich | / | 57 | 1 | 3.3 |  |  |
| 4.4 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 107 | 1 | 6.7 |  |  |
| 4.0 | ranks well, few clicks: the listing text | comedy shows zürich | / | 48 | 0 | 4.9 |  |  |
| 3.9 | bottom of page one, aim higher | robin's bar & coffee | /comedybrew/ | 59 | 1 | 8.2 |  |  |
| 3.9 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 96 | 1 | 4.0 |  | yes |
| 3.9 | bottom of page one, aim higher | comedy show zurich | / | 155 | 4 | 7.2 |  |  |
| 3.6 | bottom of page one, aim higher | comedy zurich | /calendar/ | 56 | 1 | 8.2 |  |  |
| 3.6 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 43 | 0 | 7.6 |  | yes |
| 3.5 | bottom of page one, aim higher | comedy show | / | 69 | 0 | 7.0 |  |  |
| 3.5 | bottom of page one, aim higher | comedy | / | 163 | 1 | 9.5 |  |  |
| 3.5 | bottom of page one, aim higher | mike casa zurich | /mike-casa/ | 67 | 3 | 5.6 |  | yes |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (736 @ 4.0), /calendar/ (196 @ 8.1)
- comedy zürich: 2 pages share this query: / (325 @ 9.3), /calendar/ (175 @ 10.8)
- comedy zurich: 2 pages share this query: / (286 @ 7.1), /calendar/ (56 @ 8.2)
- comedy shows zurich: 2 pages share this query: / (246 @ 6.6), /calendar/ (56 @ 8.0)
- open mic zürich: 2 pages share this query: /comedybrew/ (188 @ 13.2), / (75 @ 8.8)
- standup comedy zürich: 2 pages share this query: / (178 @ 4.4), /calendar/ (52 @ 9.5)
- comedy show zürich: 2 pages share this query: / (173 @ 5.7), /calendar/ (169 @ 10.4)
- comedy: 2 pages share this query: / (163 @ 9.5), /calendar/ (48 @ 10.1)
- comedy show zurich: 2 pages share this query: / (155 @ 7.2), /calendar/ (67 @ 6.9)
- mike casa: 2 pages share this query: /mike-casa/ (137 @ 7.9), /comedians/mike-casa/ (38 @ 9.2)
- english comedy zurich: 2 pages share this query: / (132 @ 2.9), /calendar/ (59 @ 8.5)
- comedy show: 2 pages share this query: /calendar/ (105 @ 10.0), / (69 @ 7.0)
- comedy night zürich: 2 pages share this query: /calendar/ (79 @ 10.1), / (49 @ 4.5)
- open mic comedy zürich: 2 pages share this query: / (69 @ 6.6), /comedybrew/ (33 @ 10.4)
- stand-up comedy zürich english: 2 pages share this query: / (66 @ 2.7), /calendar/ (23 @ 10.3)
- comedy shows zürich: 2 pages share this query: /calendar/ (63 @ 10.5), / (48 @ 4.9)
- stand-up comedy zürich: 2 pages share this query: / (57 @ 3.3), /calendar/ (25 @ 8.1)
- mike casa comedy: 2 pages share this query: /mike-casa/ (51 @ 9.5), /comedians/mike-casa/ (21 @ 10.0)
- stand up zürich: 2 pages share this query: / (47 @ 3.9), /calendar/ (25 @ 9.0)
- english comedy: 2 pages share this query: / (46 @ 12.2), /calendar/ (15 @ 12.9)
- comedy shows: 2 pages share this query: /calendar/ (43 @ 10.4), / (40 @ 16.3)
- comedy night zurich: 2 pages share this query: / (42 @ 7.2), /calendar/ (9 @ 7.7)
- english stand up comedy: 2 pages share this query: / (41 @ 8.8), /calendar/ (16 @ 9.4)
- open mic comedy: 2 pages share this query: / (35 @ 4.9), /comedybrew/ (8 @ 4.9)
- comedy brew: 2 pages share this query: /comedybrew/ (35 @ 1.1), / (33 @ 4.2)
- open mic: 2 pages share this query: /comedybrew/ (33 @ 27.4), / (17 @ 11.7)
- comedy night: 2 pages share this query: /calendar/ (30 @ 8.5), / (25 @ 6.2)
- comedians: 2 pages share this query: /comedians/ (27 @ 5.5), / (22 @ 9.0)
- english comedy night: 2 pages share this query: / (25 @ 6.2), /calendar/ (14 @ 18.1)
- zürich comedy: 2 pages share this query: / (24 @ 4.2), /calendar/ (20 @ 11.1)
- open mic zurich: 2 pages share this query: /comedybrew/ (19 @ 7.8), / (4 @ 4.5)
- comedy in zürich: 2 pages share this query: / (17 @ 6.0), /calendar/ (7 @ 10.3)
- zürich comedy show: 2 pages share this query: / (17 @ 6.5), /calendar/ (14 @ 9.9)
- swiss stand up comedians: 2 pages share this query: /switzerland/ (16 @ 5.7), / (4 @ 7.0)
- comedian zürich: 2 pages share this query: / (15 @ 12.5), /calendar/ (14 @ 11.1)
- stand up comedy zurich english: 2 pages share this query: / (14 @ 2.1), /calendar/ (6 @ 9.5)
- comedy switzerland: 3 pages share this query: /calendar/ (12 @ 43.7), / (11 @ 33.5), /switzerland/ (10 @ 11.1)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 134.6)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 1 impressions, 0 clicks, position 4.0
- Words the queries use that the page does not: schweiz (349), comedian (155), night (141), standup (101), matt (17), rife (17), today (16), jimmy (16)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 438 | 4 | 5.8 | 38.3 |  |
| comedy show zürich | bottom of page one, aim higher | 173 | 3 | 5.7 | 13.7 |  |
| comedy shows zurich | bottom of page one, aim higher | 246 | 2 | 6.6 | 10.5 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 146 | 0 | 6.9 | 7.4 | schweiz |
| standup comedy | bottom of page one, aim higher | 67 | 1 | 5.9 | 5.5 | standup |
| stand up | bottom of page one, aim higher | 49 | 0 | 6.5 | 4.7 |  |
| stand-up comedy zürich | ranks well, few clicks: the listing text | 57 | 1 | 3.3 | 4.5 |  |
| comedy shows zürich | ranks well, few clicks: the listing text | 48 | 0 | 4.9 | 4.0 |  |
| comedy show zurich | bottom of page one, aim higher | 155 | 4 | 7.2 | 3.9 |  |
| comedy show | bottom of page one, aim higher | 69 | 0 | 7.0 | 3.5 |  |
| comedy | bottom of page one, aim higher | 163 | 1 | 9.5 | 3.5 |  |
| english comedy night | bottom of page one, aim higher | 25 | 0 | 6.2 | 2.4 | night |

### /calendar/ (gain 42.5)

Source `pages/1_calendar.md`

- Title: Comedy Shows Zürich 2026: English Comedy Nights and Tickets
- Description: Every comedy show in Zürich from IN YOUR FACE, month by month through 2026: English comedy nights, open mics and one-off shows with dates, venues and ticket links. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 6021 impressions, 121 clicks, position 8.1
- Words the queries use that the page does not: standup (52), schweiz (13), comedyshow (11)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy zürich | bottom of page one, aim higher | 196 | 3 | 8.1 | 13.2 |  |
| comedy show zürich | bottom of page one, aim higher | 169 | 0 | 10.4 | 4.6 |  |
| comedy zürich 2026 | bottom of page one, aim higher | 107 | 1 | 6.7 | 4.4 |  |
| comedy zurich | bottom of page one, aim higher | 56 | 1 | 8.2 | 3.6 |  |
| comedy show | bottom of page one, aim higher | 105 | 0 | 10.0 | 2.9 |  |
| comedy night zürich | bottom of page one, aim higher | 79 | 0 | 10.1 | 2.2 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 25 | 0 | 8.1 | 2.1 |  |
| comedy shows zurich | bottom of page one, aim higher | 56 | 3 | 8.0 | 1.6 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 7.0 | 1.4 |  |
| comedy | bottom of page one, aim higher | 48 | 0 | 10.1 | 1.3 |  |
| comedy shows | bottom of page one, aim higher | 43 | 0 | 10.4 | 1.2 |  |
| comedy shows zürich | bottom of page one, aim higher | 63 | 1 | 10.5 | 0.7 |  |

### /comedybrew/ (gain 19.8)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew: Open Mic Zürich, English Stand-Up Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's Bar & Coffee near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, in English.
- Overall: 2649 impressions, 218 clicks, position 8.8

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 136 | 2 | 7.9 | 9.2 |  |
| robin's bar & coffee | bottom of page one, aim higher | 59 | 1 | 8.2 | 3.9 |  |
| robins | bottom of page one, aim higher | 21 | 0 | 6.4 | 2.0 |  |
| robins bar and coffee | bottom of page one, aim higher | 36 | 0 | 6.8 | 1.8 |  |
| robins zurich | bottom of page one, aim higher | 35 | 0 | 9.6 | 1.0 |  |
| robins coffee zurich | page two, aim for page one | 29 | 0 | 12.7 | 0.6 |  |
| robins bar zurich | bottom of page one, aim higher | 26 | 0 | 9.2 | 0.5 |  |
| robins coffee | bottom of page one, aim higher | 26 | 0 | 9.2 | 0.5 |  |
| stand up comedy | page two, aim for page one | 17 | 0 | 12.2 | 0.3 |  |
| robins zürich | bottom of page one, aim higher | 40 | 2 | 7.4 | 0.0 |  |
| open mic zürich | page two, aim for page one | 188 | 4 | 13.2 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 33 | 3 | 10.4 | 0.0 |  |

### /mike-casa/ (gain 18.6)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 703 impressions, 10 clicks, position 7.1
- Words the queries use that the page does not: mikecasa (13)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa | bottom of page one, aim higher | 137 | 0 | 7.9 | 11.3 |  (name) |
| mike casa zurich | bottom of page one, aim higher | 67 | 3 | 5.6 | 3.5 |  (name) |
| mike casa comedy | bottom of page one, aim higher | 51 | 0 | 9.5 | 1.4 |  (name) |
| mike casa show | bottom of page one, aim higher | 16 | 0 | 8.0 | 1.3 |  (name) |
| mikecasa | bottom of page one, aim higher | 13 | 0 | 8.0 | 1.1 | mikecasa |

### /switzerland/ (gain 2.8)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 600 impressions, 5 clicks, position 5.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss stand up comedians | bottom of page one, aim higher | 16 | 0 | 5.7 | 1.5 |  |
| swiss comedians | bottom of page one, aim higher | 40 | 1 | 6.8 | 1.0 |  |
| comedy switzerland | page two, aim for page one | 10 | 0 | 11.1 | 0.2 |  |

### /gratis-zum-mitnehmen/ (gain 1.3)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 195 impressions, 8 clicks, position 5.8
- Words the queries use that the page does not: bring (25), funny (25)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 25 | 0 | 7.3 | 1.3 | bring, funny |

### /nerdycomedyshow/ (gain 0.9)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 333 impressions, 29 clicks, position 8.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 0.5 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 0.3)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 99 impressions, 13 clicks, position 8.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 1 | 6.1 | 0.3 |  (name) |

### /comedians/ (gain 0.2)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 750 impressions, 11 clicks, position 5.5

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| fabian volkart | bottom of page one, aim higher | 13 | 0 | 9.2 | 0.2 | fabian, volkart (name) |

### /digital-daddy-auf-deutsch/ (gain 0.2)

Source `_posts/2027-04-03-digital-daddy-auf-deutsch.md`

- Title: Digital Daddy (auf Deutsch)
- Description: Digital Daddy: das Stand-up-Soloprogramm von Benjamin Delahaye über unsere digitale Abhängigkeit, auf Deutsch. Samstag, 3. April 2027, im ROBIN's Zürich.
- Overall: 37 impressions, 1 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedian digital | bottom of page one, aim higher | 10 | 0 | 10.9 | 0.2 |  |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 279 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

12 comedian pages carry opportunities worth 117.2 extra clicks a quarter over 3309 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (45), andrearamirez (16), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 50.9 | andrea ramirez | 2062 | 9.9 | yes |
| /comedians/teddy-hall/ | 25.2 | teddy hall | 320 | 8.1 | yes |
| /comedians/woocash/ | 14.6 | woocash | 189 | 8.0 | yes |
| /comedians/richard-cunha/ | 5.3 | richard cunha | 125 | 4.2 | yes |
| /comedians/miguel/ | 4.5 | miguel stand up | 19 | 6.2 |  |
| /comedians/albert-louw/ | 3.9 | albert louw | 96 | 4.0 | yes |
| /comedians/coopernik/ | 3.6 | nik | 43 | 7.6 | yes |
| /comedians/emir-tonbul/ | 3.3 | tonbul | 34 | 6.0 | yes |
| /comedians/ruben-garcia/ | 2.5 | ruben garcia | 49 | 7.2 | yes |
| /comedians/martinadoescomedy/ | 1.7 | martina comedian | 21 | 7.9 | yes |
| /comedians/laugh-at-domenico/ | 1.1 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/mike-casa/ | 0.6 | mike casa comedy | 21 | 10.0 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| comedy show schweiz | / | 22 | 7.4 | 11.2 |
| comedy schweiz | / | 21 | 21.7 | 24.9 |


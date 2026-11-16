# Search Console loop: week of 2026-11-16

Snapshot window 2026-10-17 to 2026-11-13 (28 days of final data, 245 query and page pairs with 3 or more impressions over 74 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-08-16 to 2026-11-13 (90 days, 417 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-11-16T09:40:02.081Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-10-16 | 512 | 12096 | 4.2% | 6.7 | 67 |
| 2026-10-21 | 527 | 12406 | 4.2% | 6.7 | 70 |
| 2026-10-23 | 534 | 12763 | 4.2% | 6.8 | 71 |
| 2026-10-30 | 580 | 12942 | 4.5% | 6.9 | 73 |
| 2026-11-01 | 588 | 13002 | 4.5% | 6.9 | 72 |
| 2026-11-04 | 587 | 12969 | 4.5% | 6.8 | 73 |
| 2026-11-06 | 585 | 12933 | 4.5% | 6.9 | 73 |
| 2026-11-10 | 562 | 12720 | 4.4% | 6.9 | 75 |
| 2026-11-12 | 566 | 12809 | 4.4% | 7.0 | 74 |
| 2026-11-13 | 567 | 12784 | 4.4% | 6.9 | 74 |

Devices this window: mobile 7816 impressions at position 6.1; desktop 3053 impressions at position 9.1; tablet 86 impressions at position 6.3.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 56 | improved | position -1.8, clicks 25 to 55 on 8 judged queries |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 56 | worse | position +1.2, clicks 2 to 0 on 2 judged queries |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 56 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 56 | worse | position -0.6, clicks 6 to 4 on 2 judged queries |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 56 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 56 | no data | fewer than 10 impressions on the target queries in one of the windows |
| exp-2026-11-14-1 | /comedybrew/ | 2026-11-14 | -1 | too early | -1 of 28 days of final data since the change |
| exp-2026-11-14-2 | /comedybrew/ | 2026-11-14 | -1 | too early | -1 of 28 days of final data since the change |
| exp-2026-11-14-3 | /calendar/ | 2026-11-14 | -1 | too early | -1 of 28 days of final data since the change |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 238 | 15 | 4.0 |
| stand up comedy zurich | 178 | 15 | 6.1 | 176 | 19 | 5.0 |
| comedy zurich | 110 | 1 | 7.1 | 76 | 6 | 7.3 |
| comedy zürich | 120 | 1 | 14.0 | 60 | 4 | 5.9 |
| comedy club zurich | 39 | 0 | 7.9 | 78 | 6 | 5.8 |
| comedy club zürich | 18 | 1 | 7.5 | 77 | 3 | 6.9 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 37 | 0 | 4.9 |
| stand up comedy | 108 | 0 | 6.3 | 154 | 2 | 5.6 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 56 | 0 | 14.5 |
| open mic zurich | 11 | 1 | 9.8 | 3 | 1 | 4.3 |
| open mic comedy zürich | 13 | 1 | 9.1 | 10 | 0 | 11.7 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 23 | 0 | 5.8 |
| swiss stand up comedians | 0 | 0 | n/a | 7 | 0 | 4.7 |
| swiss comedian | 0 | 0 | n/a | 3 | 0 | 4.3 |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 35 | 2 | 5.6 |
| teddy hall | 133 | 4 | 8.6 | 80 | 2 | 7.9 |
| teddy hall comedian | 0 | 0 | n/a | 21 | 1 | 5.6 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 9 | 0 | 7.0 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 43 | 0 | 6.8 |
| comedy shows 2026 | 4 | 0 | 6.5 | 4 | 0 | 1.0 |
| comedy 2026 | 3 | 0 | 12.7 | 7 | 0 | 5.3 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 8 | 0 | 9.6 |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy auftritte 2026 | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-11-14-1: Title now 'Comedy Brew: Open Mic Zürich, English Stand-Up Every Thursday' (Open Mic Zürich in the first 30 characters; Comedy Brew stays first because the show name is the text before the first separator; on 15 November the colon joined that rule everywhere, flyers, h1, /go/ and the Google post included, see _includes/title-parts.liquid)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 56 | 0 | 14.5 | 56 | 0 | 14.5 |
| open mic zurich | 3 | 1 | 4.3 | 3 | 1 | 4.3 |
| open mic comedy zürich | 10 | 0 | 11.7 | 10 | 0 | 11.7 |
| open mic comedy zurich | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy open mic zürich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-11-14-2: The page names the venue in full: 'ROBIN's Bar & Coffee' in the meta description, the essentials line and the 'What about' heading (was ROBIN's)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| robins bar | 32 | 1 | 8.7 | 32 | 1 | 8.7 |
| robin's bar & coffee | 10 | 0 | 7.6 | 10 | 0 | 7.6 |
| robins bar and coffee | 9 | 0 | 7.8 | 9 | 0 | 7.8 |
| robins | 0 | 0 | n/a | 0 | 0 | n/a |
| robins zurich | 17 | 0 | 7.8 | 17 | 0 | 7.8 |
| robins zürich | 26 | 1 | 8.1 | 26 | 1 | 8.1 |
| robins coffee | 8 | 0 | 11.0 | 8 | 0 | 11.0 |
| robins coffee zurich | 2 | 0 | 9.5 | 0 | 0 | n/a |
| robins bar zurich | 11 | 0 | 9.5 | 11 | 0 | 9.5 |

### exp-2026-11-14-3: Calendar title now 'Comedy Shows Zürich 2026: English Comedy Nights and Tickets' and the description leads with 'Every comedy show in Zürich', naming comedy nights, open mics and one-off shows; the home page keeps 'stand-up comedy Zürich' and 'comedy club' so the two pages stop sharing the shows and nights queries

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy shows zürich | 38 | 1 | 10.2 | 38 | 1 | 10.2 |
| comedy shows zurich | 37 | 2 | 6.5 | 37 | 2 | 6.5 |
| comedy show zürich | 124 | 0 | 10.3 | 124 | 0 | 10.3 |
| comedy show zurich | 47 | 2 | 6.5 | 47 | 2 | 6.5 |
| comedy night zürich | 62 | 0 | 10.0 | 62 | 0 | 10.0 |
| comedy night zurich | 7 | 0 | 7.4 | 7 | 0 | 7.4 |
| comedy zürich 2026 | 43 | 0 | 6.8 | 43 | 0 | 6.8 |
| comedy shows | 24 | 0 | 10.9 | 24 | 0 | 10.9 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 11.5% | 5.3% | 8.5% | 1.8% | 2.6% | 1.9% | 2.3% | 0.7% | 1.8% | 1.4%* | 0.0% | 1.1%* | 1.8% | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.7% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 48.6 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 2129 | 6 | 9.9 |  | yes |
| 45.5 | bottom of page one, aim higher | stand up comedy | / | 431 | 4 | 6.0 |  |  |
| 19.7 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 326 | 8 | 8.3 |  | yes |
| 15.6 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 196 | 1 | 8.1 |  | yes |
| 15.4 | bottom of page one, aim higher | comedy show zürich | / | 160 | 3 | 5.9 |  |  |
| 13.0 | bottom of page one, aim higher | stand up comedy zürich | /calendar/ | 188 | 3 | 7.8 |  |  |
| 11.2 | bottom of page one, aim higher | comedy shows zurich | / | 250 | 2 | 6.6 |  |  |
| 10.0 | bottom of page one, aim higher | comedy zürich 2026 | /calendar/ | 96 | 1 | 6.5 |  |  |
| 9.3 | bottom of page one, aim higher | mike casa | /mike-casa/ | 109 | 0 | 7.7 |  | yes |
| 8.0 | bottom of page one, aim higher | robins bar | /comedybrew/ | 118 | 2 | 7.9 |  |  |
| 7.7 | bottom of page one, aim higher | stand up comedy schweiz | / | 146 | 0 | 6.8 | schweiz |  |
| 6.9 | bottom of page one, aim higher | standup comedy | / | 69 | 1 | 5.9 | standup |  |
| 5.8 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 128 | 1 | 4.3 |  | yes |
| 4.6 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 40 | 0 | 5.8 |  | yes |
| 4.4 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 52 | 0 | 7.6 |  | yes |
| 4.4 | ranks well, few clicks: the listing text | stand-up comedy zürich | / | 47 | 1 | 3.0 |  |  |
| 4.3 | bottom of page one, aim higher | comedy zurich | / | 289 | 11 | 7.1 |  |  |
| 4.3 | bottom of page one, aim higher | teddy hall comedy | /comedians/teddy-hall/ | 98 | 7 | 5.5 |  | yes |
| 4.0 | bottom of page one, aim higher | comedy show zurich | / | 152 | 4 | 7.2 |  |  |
| 4.0 | bottom of page one, aim higher | comedy show zürich | /calendar/ | 157 | 0 | 10.4 |  |  |
| 3.9 | bottom of page one, aim higher | robin's bar & coffee | /comedybrew/ | 58 | 1 | 8.1 |  |  |
| 3.9 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 93 | 1 | 4.2 |  | yes |
| 3.8 | bottom of page one, aim higher | comedy zurich | /calendar/ | 56 | 1 | 8.2 |  |  |
| 3.7 | ranks well, few clicks: the listing text | comedy shows zürich | / | 44 | 0 | 5.0 |  |  |
| 3.7 | bottom of page one, aim higher | robins bar and coffee | /comedybrew/ | 43 | 0 | 7.8 |  |  |

### Two pages share one query

- stand up comedy zürich: 2 pages share this query: / (736 @ 4.0), /calendar/ (188 @ 7.8)
- comedy zürich: 2 pages share this query: / (342 @ 9.9), /calendar/ (159 @ 10.8)
- comedy zurich: 2 pages share this query: / (289 @ 7.1), /calendar/ (56 @ 8.2)
- comedy shows zurich: 2 pages share this query: / (250 @ 6.6), /calendar/ (56 @ 8.7)
- open mic zürich: 2 pages share this query: /comedybrew/ (192 @ 15.3), / (64 @ 9.0)
- standup comedy zürich: 2 pages share this query: / (162 @ 4.5), /calendar/ (50 @ 9.3)
- comedy show zürich: 2 pages share this query: / (160 @ 5.9), /calendar/ (157 @ 10.4)
- comedy show zurich: 2 pages share this query: / (152 @ 7.2), /calendar/ (64 @ 6.8)
- comedy: 2 pages share this query: / (148 @ 9.6), /calendar/ (48 @ 10.1)
- english comedy zurich: 2 pages share this query: / (131 @ 2.9), /calendar/ (52 @ 8.5)
- mike casa: 2 pages share this query: /mike-casa/ (109 @ 7.7), /comedians/mike-casa/ (34 @ 9.4)
- comedy show: 2 pages share this query: /calendar/ (101 @ 10.1), / (63 @ 7.1)
- comedy night zürich: 2 pages share this query: /calendar/ (76 @ 10.1), / (47 @ 4.5)
- open mic comedy zürich: 2 pages share this query: / (65 @ 6.5), /comedybrew/ (35 @ 10.3)
- stand-up comedy zürich english: 2 pages share this query: / (61 @ 2.7), /calendar/ (21 @ 10.3)
- comedy shows zürich: 2 pages share this query: /calendar/ (55 @ 10.3), / (44 @ 5.0)
- stand up zürich: 2 pages share this query: / (47 @ 3.9), /calendar/ (25 @ 9.0)
- stand-up comedy zürich: 2 pages share this query: / (47 @ 3.0), /calendar/ (24 @ 8.0)
- comedy shows: 2 pages share this query: / (44 @ 16.5), /calendar/ (38 @ 10.4)
- english stand up comedy: 2 pages share this query: / (41 @ 9.8), /calendar/ (16 @ 9.4)
- english comedy: 2 pages share this query: / (39 @ 7.2), /calendar/ (11 @ 11.3)
- comedy night zurich: 2 pages share this query: / (38 @ 7.3), /calendar/ (9 @ 7.7)
- open mic comedy: 2 pages share this query: / (37 @ 5.2), /comedybrew/ (8 @ 4.9)
- open mic: 2 pages share this query: /comedybrew/ (36 @ 24.3), / (13 @ 14.2)
- mike casa comedy: 2 pages share this query: /mike-casa/ (34 @ 9.8), /comedians/mike-casa/ (17 @ 10.7)
- comedy brew: 2 pages share this query: /comedybrew/ (33 @ 1.1), / (32 @ 4.2)
- comedy night: 2 pages share this query: /calendar/ (30 @ 8.5), / (22 @ 5.1)
- english comedy night: 2 pages share this query: / (22 @ 6.9), /calendar/ (15 @ 21.1)
- comedians: 2 pages share this query: /comedians/ (21 @ 5.9), / (15 @ 9.9)
- zürich comedy: 2 pages share this query: / (20 @ 4.7), /calendar/ (19 @ 11.1)
- open mic zurich: 2 pages share this query: /comedybrew/ (18 @ 7.8), / (4 @ 4.5)
- comedy in zürich: 2 pages share this query: / (17 @ 6.5), /calendar/ (8 @ 15.6)
- zürich comedy show: 2 pages share this query: / (15 @ 6.6), /calendar/ (13 @ 9.8)
- comedian zürich: 2 pages share this query: / (14 @ 11.1), /calendar/ (13 @ 10.8)
- open mic stand up comedy: 2 pages share this query: / (13 @ 5.4), /comedybrew/ (7 @ 2.6)
- comedy switzerland: 3 pages share this query: / (12 @ 32.8), /calendar/ (12 @ 44.5), /switzerland/ (8 @ 10.6)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 145.8)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 15032 impressions, 865 clicks, position 6.4
- Words the queries use that the page does not: schweiz (328), comedian (139), night (107), standup (105), matt (17), rife (17), heute (16), jimmy (15)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 431 | 4 | 6.0 | 45.5 |  |
| comedy show zürich | bottom of page one, aim higher | 160 | 3 | 5.9 | 15.4 |  |
| comedy shows zurich | bottom of page one, aim higher | 250 | 2 | 6.6 | 11.2 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 146 | 0 | 6.8 | 7.7 | schweiz |
| standup comedy | bottom of page one, aim higher | 69 | 1 | 5.9 | 6.9 | standup |
| stand-up comedy zürich | ranks well, few clicks: the listing text | 47 | 1 | 3.0 | 4.4 |  |
| comedy zurich | bottom of page one, aim higher | 289 | 11 | 7.1 | 4.3 |  |
| comedy show zurich | bottom of page one, aim higher | 152 | 4 | 7.2 | 4.0 |  |
| comedy shows zürich | ranks well, few clicks: the listing text | 44 | 0 | 5.0 | 3.7 |  |
| comedy show | bottom of page one, aim higher | 63 | 0 | 7.1 | 3.3 |  |
| comedy night zürich | ranks well, few clicks: the listing text | 47 | 1 | 4.5 | 3.0 | night |
| comedy | bottom of page one, aim higher | 148 | 1 | 9.6 | 2.8 |  |

### /calendar/ (gain 43.7)

Source `pages/1_calendar.md`

- Title: Comedy Shows Zürich 2026: English Comedy Nights and Tickets
- Description: Every comedy show in Zürich from IN YOUR FACE, month by month through 2026: English comedy nights, open mics and one-off shows with dates, venues and ticket links. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 5810 impressions, 117 clicks, position 8.2
- Words the queries use that the page does not: standup (50), schweiz (12)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy zürich | bottom of page one, aim higher | 188 | 3 | 7.8 | 13.0 |  |
| comedy zürich 2026 | bottom of page one, aim higher | 96 | 1 | 6.5 | 10.0 |  |
| comedy show zürich | bottom of page one, aim higher | 157 | 0 | 10.4 | 4.0 |  |
| comedy zurich | bottom of page one, aim higher | 56 | 1 | 8.2 | 3.8 |  |
| comedy show | bottom of page one, aim higher | 101 | 0 | 10.1 | 2.6 |  |
| stand-up comedy zürich | bottom of page one, aim higher | 24 | 0 | 8.0 | 2.0 |  |
| comedy night zürich | bottom of page one, aim higher | 76 | 0 | 10.1 | 1.9 |  |
| comedy 2026 | bottom of page one, aim higher | 27 | 0 | 7.0 | 1.4 |  |
| comedy | bottom of page one, aim higher | 48 | 0 | 10.1 | 1.2 |  |
| comedy shows | bottom of page one, aim higher | 38 | 0 | 10.4 | 1.0 |  |
| comedy shows zürich | bottom of page one, aim higher | 55 | 1 | 10.3 | 0.4 |  |
| comedy show zurich | bottom of page one, aim higher | 64 | 3 | 6.8 | 0.4 |  |

### /comedybrew/ (gain 22.5)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew: Open Mic Zürich, English Stand-Up Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's Bar & Coffee near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, in English.
- Overall: 2635 impressions, 210 clicks, position 9.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 118 | 2 | 7.9 | 8.0 |  |
| robin's bar & coffee | bottom of page one, aim higher | 58 | 1 | 8.1 | 3.9 |  |
| robins bar and coffee | bottom of page one, aim higher | 43 | 0 | 7.8 | 3.7 |  |
| robins zurich | bottom of page one, aim higher | 31 | 0 | 7.8 | 2.6 |  |
| robins | bottom of page one, aim higher | 27 | 0 | 6.5 | 1.4 |  |
| robins zürich | bottom of page one, aim higher | 36 | 2 | 7.5 | 1.1 |  |
| robins bar zurich | bottom of page one, aim higher | 28 | 0 | 8.8 | 0.5 |  |
| robins coffee zurich | page two, aim for page one | 26 | 0 | 13.0 | 0.5 |  |
| robins coffee | bottom of page one, aim higher | 26 | 0 | 8.9 | 0.5 |  |
| stand up comedy | page two, aim for page one | 15 | 0 | 12.1 | 0.3 |  |
| open mic zürich | page two, aim for page one | 192 | 4 | 15.3 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 35 | 3 | 10.3 | 0.0 |  |

### /mike-casa/ (gain 14.2)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 544 impressions, 9 clicks, position 7.0
- Words the queries use that the page does not: mikecasa (11)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa | bottom of page one, aim higher | 109 | 0 | 7.7 | 9.3 |  (name) |
| mike casa zurich | bottom of page one, aim higher | 53 | 3 | 5.6 | 3.1 |  (name) |
| mikecasa | bottom of page one, aim higher | 11 | 0 | 8.2 | 0.9 | mikecasa |
| mike casa comedy | bottom of page one, aim higher | 34 | 0 | 9.8 | 0.9 |  (name) |

### /comedians/ (gain 2.6)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 704 impressions, 9 clicks, position 5.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedians | bottom of page one, aim higher | 21 | 0 | 5.9 | 2.4 |  (name) |
| fabian volkart | bottom of page one, aim higher | 13 | 0 | 9.2 | 0.2 | fabian, volkart (name) |

### /switzerland/ (gain 2.3)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 566 impressions, 4 clicks, position 5.8

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss stand up comedians | bottom of page one, aim higher | 12 | 0 | 5.8 | 1.4 |  |
| swiss comedians | bottom of page one, aim higher | 37 | 1 | 7.2 | 1.0 |  |

### /gratis-zum-mitnehmen/ (gain 1.1)

Source `_posts/2026-09-27-gratis-zum-mitnehmen.md`

- Title: Gratis Comedy Zum Mitnehmen - Free Entry Stand Up Comedy
- Description: It costs money to breathe in Zürich, but it shouldn't cost any to laugh. A free new material night at ROBIN's where Teddy Hall and his funniest friends try out their newest jokes.
- Overall: 176 impressions, 6 clicks, position 5.5
- Words the queries use that the page does not: bring (21), funny (21)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| bring the funny free | bottom of page one, aim higher | 21 | 0 | 7.3 | 1.1 | bring, funny |

### /nerdycomedyshow/ (gain 0.8)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 341 impressions, 29 clicks, position 9.3

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 0.5 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.3 |  (name) |

### /pulpnonfiction/ (gain 0.5)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 95 impressions, 12 clicks, position 9.1

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 1 | 6.1 | 0.5 |  (name) |

### /filippo-spreafico/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 285 impressions, 25 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 40 | 1 | 13.7 | 0.0 | filippo, spreafico (name) |

## Comedian pages (meta-only)

12 comedian pages carry opportunities worth 122.0 extra clicks a quarter over 3364 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: comedian (33), andrearamirez (16), stand (13), up (13), comedy (13), zurich (13)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 50.1 | andrea ramirez | 2129 | 9.9 | yes |
| /comedians/teddy-hall/ | 26.7 | teddy hall | 326 | 8.3 | yes |
| /comedians/woocash/ | 15.6 | woocash | 196 | 8.1 | yes |
| /comedians/richard-cunha/ | 5.8 | richard cunha | 128 | 4.3 | yes |
| /comedians/miguel/ | 5.2 | miguel stand up | 20 | 6.3 |  |
| /comedians/emir-tonbul/ | 4.6 | tonbul | 40 | 5.8 | yes |
| /comedians/coopernik/ | 4.4 | nik | 52 | 7.6 | yes |
| /comedians/albert-louw/ | 3.9 | albert louw | 93 | 4.2 | yes |
| /comedians/ruben-garcia/ | 2.5 | ruben garcia | 47 | 7.2 | yes |
| /comedians/martinadoescomedy/ | 1.7 | martina comedian | 20 | 7.9 | yes |
| /comedians/laugh-at-domenico/ | 1.1 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/mike-casa/ | 0.3 | mike casa comedy | 17 | 10.7 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| comedy schweiz | / | 26 | 19.5 | 21.7 |


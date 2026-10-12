# Search Console loop: week of 2026-10-12

Snapshot window 2026-09-12 to 2026-10-09 (28 days of final data, 196 query and page pairs with 3 or more impressions over 65 pages) drives the trend, the movers and the experiment verdicts. Discovery window 2026-07-12 to 2026-10-09 (90 days, 310 pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated 2026-10-12T08:40:02.003Z. How to read this and how to log a change: `seo/README.md`.

## Trend

| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |
|---|---|---|---|---|---|
| 2026-08-11 | 290 | 6189 | 4.7% | 9.0 | 51 |
| 2026-08-18 | 300 | 6405 | 4.7% | 9.0 | 52 |
| 2026-08-25 | 283 | 6641 | 4.3% | 8.9 | 51 |
| 2026-09-01 | 316 | 7141 | 4.4% | 8.8 | 57 |
| 2026-09-08 | 317 | 7479 | 4.2% | 8.5 | 57 |
| 2026-09-15 | 368 | 8233 | 4.5% | 7.7 | 57 |
| 2026-09-18 | 406 | 8690 | 4.7% | 7.5 | 58 |
| 2026-09-25 | 424 | 9623 | 4.4% | 7.2 | 58 |
| 2026-10-02 | 458 | 10610 | 4.3% | 6.6 | 61 |
| 2026-10-09 | 499 | 11354 | 4.4% | 6.7 | 65 |

Devices this window: mobile 7256 impressions at position 6.7; desktop 2546 impressions at position 7.0; tablet 66 impressions at position 6.7.

## Experiments

| Id | Page | Changed | Days | Verdict | Reading |
|---|---|---|---|---|---|
| exp-2026-09-18-1 | / | 2026-09-18 | 21 | too early | 21 of 28 days of final data since the change |
| exp-2026-09-18-2 | /comedybrew/ | 2026-09-18 | 21 | too early | 21 of 28 days of final data since the change |
| exp-2026-09-18-3 | /switzerland/ | 2026-09-18 | 21 | too early | 21 of 28 days of final data since the change |
| exp-2026-09-18-4 | /comedians/teddy-hall/ | 2026-09-18 | 21 | too early | 21 of 28 days of final data since the change |
| exp-2026-09-18-5 | /comedians/martinadoescomedy/ | 2026-09-18 | 21 | too early | 21 of 28 days of final data since the change |
| exp-2026-09-18-6 | /calendar/ | 2026-09-18 | 21 | too early | 21 of 28 days of final data since the change |

### exp-2026-09-18-1: Home title now 'Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic', description names the club, Switzerland, the Thursday open mic; an intro paragraph under the hero heading links 'Thursday open mic' to /comedybrew/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| stand up comedy zürich | 233 | 7 | 3.9 | 221 | 6 | 3.9 |
| stand up comedy zurich | 178 | 15 | 6.1 | 202 | 22 | 5.4 |
| comedy zurich | 110 | 1 | 7.1 | 90 | 3 | 7.0 |
| comedy zürich | 120 | 1 | 14.0 | 105 | 1 | 8.6 |
| comedy club zurich | 39 | 0 | 7.9 | 54 | 3 | 7.8 |
| comedy club zürich | 18 | 1 | 7.5 | 44 | 0 | 7.8 |
| stand up comedy schweiz | 47 | 0 | 8.8 | 50 | 0 | 6.3 |
| stand up comedy | 108 | 0 | 6.3 | 126 | 2 | 4.9 |

### exp-2026-09-18-2: Title now 'Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday'; description states Thursday and doors 19:30; 'The essentials' facts list and 'What's a comedy open mic?' moved to the top of the body; later the same day: hook paragraph first, then the flyer, then the essentials with the ticket line pointing at the Get Tickets button above (Harry)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| open mic zürich | 63 | 1 | 13.6 | 51 | 4 | 11.2 |
| open mic zurich | 11 | 1 | 9.8 | 3 | 0 | 6.0 |
| open mic comedy zürich | 13 | 1 | 9.1 | 7 | 1 | 11.7 |
| open mic comedy | 7 | 0 | 4.1 | 0 | 0 | n/a |
| comedy open mic zurich | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-3: New section 'Swiss comedians on our stages' listing the comedians from Switzerland with a profile (front matter swiss_comedians), linking to their pages and to /comedians/

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| swiss comedians | 7 | 0 | 8.6 | 4 | 0 | 11.5 |
| swiss stand up comedians | 0 | 0 | n/a | 4 | 0 | 8.8 |
| swiss comedian | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-4: Comedian title pattern '<Name>, Stand-up Comedian \| IN YOUR FACE Comedy Zürich' (head.liquid) and meta description prefix 'Comedian on IN YOUR FACE Comedy stages in Zürich.' (sync-comedians.rb); applies to all 64 profiles, bios untouched

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| teddy hall comedy | 29 | 2 | 5.8 | 31 | 3 | 5.5 |
| teddy hall | 133 | 4 | 8.6 | 108 | 2 | 7.8 |
| teddy hall comedian | 0 | 0 | n/a | 8 | 0 | 6.0 |

### exp-2026-09-18-5: Same comedian title pattern and description prefix as exp-2026-09-18-4 (second representative page)

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| martina comedian | 2 | 0 | 7.5 | 7 | 0 | 8.9 |
| martina in switzerland | 0 | 0 | n/a | 0 | 0 | n/a |
| martina komikerin | 0 | 0 | n/a | 0 | 0 | n/a |

### exp-2026-09-18-6: Calendar title now 'Comedy Zürich 2026: Calendar of English Stand-up Shows' (was 'Comedy in Zürich Tonight & This Week', a niche the home page already wins), description rewritten for dated searches with a German phrase, one German intro line added; month headings unchanged

| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | 3 | 0 | 9.0 | 38 | 1 | 6.4 |
| comedy shows 2026 | 4 | 0 | 6.5 | 4 | 1 | 3.0 |
| comedy 2026 | 3 | 0 | 12.7 | 15 | 0 | 6.9 |
| comedy september 2026 | 2 | 0 | 8.5 | 0 | 0 | n/a |
| comedy schweiz 2026 | 0 | 0 | n/a | 0 | 0 | n/a |
| comedy veranstaltungen 2026 | 0 | 0 | n/a | 3 | 0 | 7.3 |
| comedy auftritte 2026 | 0 | 0 | n/a | 3 | 0 | 4.3 |

## Your click curve

Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.

| Position | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CTR | 28.0%* | 15.0%* | 20.8% | 7.1% | 6.6% | 4.1% | 3.3% | 1.8% | 1.7% | 0.6% | 1.6%* | 0.8% | 1.2%* | 1.8% | 1.0%* | 0.9%* | 0.8%* | 0.7%* | 0.6%* | 0.9% |

\* default, fewer than 150 impressions at that position.

## Opportunities, priced in extra clicks per 90 days

Every non-brand query with 10 or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.

| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |
|---|---|---|---|---|---|---|---|---|
| 64.8 | bottom of page one, aim higher | stand up comedy | / | 322 | 2 | 5.5 |  |  |
| 57.0 | bottom of page one, aim higher | andrea ramirez | /comedians/andrea-ramirez/ | 1912 | 6 | 10.0 |  | yes |
| 54.8 | bottom of page one, aim higher | stand up comedy zurich | / | 510 | 51 | 5.7 |  |  |
| 41.4 | bottom of page one, aim higher | comedy shows zurich | / | 209 | 2 | 6.5 |  |  |
| 27.6 | ranks well, few clicks: the listing text | stand up comedy zürich | / | 611 | 16 | 3.9 |  |  |
| 18.2 | bottom of page one, aim higher | woocash | /comedians/woocash/ | 274 | 0 | 7.8 |  | yes |
| 16.6 | bottom of page one, aim higher | ruben garcia | /comedians/ruben-garcia/ | 80 | 0 | 6.4 |  | yes |
| 15.4 | bottom of page one, aim higher | stand up | / | 74 | 0 | 6.4 |  |  |
| 11.4 | bottom of page one, aim higher | tonbul | /comedians/emir-tonbul/ | 55 | 0 | 6.2 |  | yes |
| 10.2 | bottom of page one, aim higher | standup comedy | / | 49 | 0 | 6.2 | standup |  |
| 9.9 | bottom of page one, aim higher | standup comedy zurich | / | 62 | 3 | 6.5 | standup |  |
| 9.1 | bottom of page one, aim higher | teddy hall comedy | /comedians/teddy-hall/ | 68 | 5 | 5.7 |  | yes |
| 8.8 | bottom of page one, aim higher | comedy zurich | / | 278 | 11 | 7.1 |  |  |
| 8.5 | bottom of page one, aim higher | stand up comedy schweiz | / | 143 | 1 | 7.7 | schweiz |  |
| 7.5 | bottom of page one, aim higher | english comedy | / | 36 | 0 | 5.6 |  |  |
| 7.0 | bottom of page one, aim higher | robins bar | /comedybrew/ | 120 | 1 | 7.7 |  |  |
| 6.6 | bottom of page one, aim higher | teddy hall | /comedians/teddy-hall/ | 332 | 7 | 8.9 |  | yes |
| 5.4 | bottom of page one, aim higher | standup | / | 26 | 0 | 6.2 | standup |  |
| 5.4 | ranks well, few clicks: the listing text | albert louw | /comedians/albert-louw/ | 89 | 1 | 4.2 |  | yes |
| 4.9 | ranks well, few clicks: the listing text | richard cunha | /comedians/richard-cunha/ | 96 | 2 | 4.0 |  | yes |
| 4.2 | bottom of page one, aim higher | nik | /comedians/coopernik/ | 64 | 0 | 7.6 |  | yes |
| 3.9 | bottom of page one, aim higher | comedy show zürich | / | 83 | 2 | 6.7 |  |  |
| 3.6 | bottom of page one, aim higher | comedy show zurich | / | 135 | 6 | 6.9 |  |  |
| 3.5 | bottom of page one, aim higher | comedy night zürich | / | 17 | 0 | 5.5 | night |  |
| 3.1 | bottom of page one, aim higher | stand up schweiz | / | 15 | 0 | 5.7 | schweiz |  |

### Two pages share one query

- open mic zürich: 2 pages share this query: /comedybrew/ (189 @ 14.0), / (47 @ 10.0)
- chris darwa: 2 pages share this query: /comedians/chris-darwa/ (51 @ 4.8), /downunder/ (11 @ 5.4)
- open mic comedy zürich: 2 pages share this query: / (44 @ 6.8), /comedybrew/ (29 @ 10.4)
- comedy shows: 2 pages share this query: / (43 @ 19.7), /calendar/ (8 @ 14.8)
- comedy show: 2 pages share this query: / (37 @ 8.9), /calendar/ (7 @ 10.1)
- open mic comedy: 2 pages share this query: / (32 @ 4.7), /comedybrew/ (8 @ 4.5)
- comedy shows zürich: 2 pages share this query: / (24 @ 7.4), /calendar/ (14 @ 10.8)
- english comedy night: 2 pages share this query: / (23 @ 8.1), /calendar/ (12 @ 40.6)
- comedy brew: 2 pages share this query: /comedybrew/ (19 @ 3.3), / (16 @ 4.1)
- comedy night zürich: 2 pages share this query: / (17 @ 5.5), /calendar/ (5 @ 28.0)
- comedy switzerland: 3 pages share this query: / (10 @ 22.4), /calendar/ (8 @ 52.9), /switzerland/ (6 @ 10.5)

## Page briefs

Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.

### / (gain 291.3)

Source `index.html`

- Title: Stand-up Comedy Zürich: English Comedy Club, Shows & Open Mic
- Description: IN YOUR FACE Comedy: the English comedy club in Zürich, Switzerland. Weekly stand-up shows and a Thursday open mic at ROBIN's near Central. No Swiss German needed.
- Overall: 11424 impressions, 651 clicks, position 7.4
- Words the queries use that the page does not: schweiz (191), standup (137), night (72), comedian (37), emmvee (16), matt (13), rife (13), link (12)

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| stand up comedy | bottom of page one, aim higher | 322 | 2 | 5.5 | 64.8 |  |
| stand up comedy zurich | bottom of page one, aim higher | 510 | 51 | 5.7 | 54.8 |  |
| comedy shows zurich | bottom of page one, aim higher | 209 | 2 | 6.5 | 41.4 |  |
| stand up comedy zürich | ranks well, few clicks: the listing text | 611 | 16 | 3.9 | 27.6 |  |
| stand up | bottom of page one, aim higher | 74 | 0 | 6.4 | 15.4 |  |
| standup comedy | bottom of page one, aim higher | 49 | 0 | 6.2 | 10.2 | standup |
| standup comedy zurich | bottom of page one, aim higher | 62 | 3 | 6.5 | 9.9 | standup |
| comedy zurich | bottom of page one, aim higher | 278 | 11 | 7.1 | 8.8 |  |
| stand up comedy schweiz | bottom of page one, aim higher | 143 | 1 | 7.7 | 8.5 | schweiz |
| english comedy | bottom of page one, aim higher | 36 | 0 | 5.6 | 7.5 |  |
| standup | bottom of page one, aim higher | 26 | 0 | 6.2 | 5.4 | standup |
| comedy show zürich | bottom of page one, aim higher | 83 | 2 | 6.7 | 3.9 |  |

### /comedybrew/ (gain 18.2)

Source `_posts/2024-01-18-comedybrew.md`

- Title: Comedy Brew • English Stand-Up Open Mic in Zürich • Every Thursday
- Description: Zürich's weekly English comedy open mic at ROBIN's near Central. Every Thursday, doors 19:30. Ten comedians, new jokes, first-timers, all in English.
- Overall: 2634 impressions, 185 clicks, position 10.2

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| robins bar | bottom of page one, aim higher | 120 | 1 | 7.7 | 7.0 |  |
| robins | bottom of page one, aim higher | 42 | 0 | 7.1 | 3.0 |  |
| robins coffee | bottom of page one, aim higher | 35 | 0 | 8.1 | 2.3 |  |
| robins bar and coffee | bottom of page one, aim higher | 31 | 0 | 7.9 | 2.1 |  |
| robins zurich | bottom of page one, aim higher | 28 | 0 | 7.6 | 1.9 |  |
| robins bar zurich | bottom of page one, aim higher | 30 | 0 | 8.6 | 1.2 |  |
| robins coffee zurich | page two, aim for page one | 23 | 0 | 13.3 | 0.4 |  |
| robin's bar & coffee | bottom of page one, aim higher | 50 | 3 | 8.0 | 0.3 |  |
| open mic zürich | page two, aim for page one | 189 | 4 | 14.0 | 0.0 |  |
| open mic comedy zürich | bottom of page one, aim higher | 29 | 2 | 10.4 | 0.0 |  |
| open mic zurich | bottom of page one, aim higher | 22 | 2 | 8.7 | 0.0 |  |
| robins cafe | bottom of page one, aim higher | 17 | 2 | 7.6 | 0.0 |  |

### /calendar/ (gain 6.5)

Source `pages/1_calendar.md`

- Title: Comedy Zürich 2026: Calendar of English Stand-up Shows
- Description: Every IN YOUR FACE comedy show in Zürich, month by month through 2026: dates, venues and ticket links for English stand-up nights and open mics. Comedy Veranstaltungen in Zürich auf Englisch. Updated weekly.
- Overall: 3055 impressions, 55 clicks, position 8.0

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| comedy zürich 2026 | bottom of page one, aim higher | 41 | 1 | 6.6 | 1.9 |  |
| comedy 2026 | bottom of page one, aim higher | 21 | 0 | 7.7 | 1.4 |  |
| stand up comedy zürich | bottom of page one, aim higher | 36 | 0 | 9.9 | 1.2 |  |
| comedy | bottom of page one, aim higher | 10 | 0 | 8.4 | 0.7 |  |
| english stand up comedy | bottom of page one, aim higher | 11 | 0 | 9.9 | 0.4 |  |
| comedy zürich | page two, aim for page one | 15 | 0 | 12.5 | 0.3 |  |
| comedy shows zürich | bottom of page one, aim higher | 14 | 0 | 10.8 | 0.2 |  |
| comedy shows zurich | page two, aim for page one | 13 | 0 | 18.2 | 0.2 |  |
| comedy show zürich | page two, aim for page one | 10 | 0 | 13.5 | 0.2 |  |
| comedy zurich | page two, aim for page one | 12 | 1 | 12.5 | 0.0 |  |

### /mike-casa/ (gain 2.9)

Source `_posts/2026-12-02-mike-casa.md`

- Title: Mike Casa • Stand-up Comedy Show at ROBIN's Zürich • 2 December 2026
- Description: For the first time ever, Mike Casa is bringing his hit ENGLISH stand-up comedy show to Robin's Coffee in the heart of Zurich!
- Overall: 100 impressions, 1 clicks, position 6.8

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| mike casa zurich | bottom of page one, aim higher | 19 | 1 | 5.8 | 2.9 |  (name) |

### /nerdycomedyshow/ (gain 1.6)

Source `_posts/2026-09-26-the_nerdy_comedy_show_-_english_standup_comedy_in_zurich.md`

- Title: The NERDY COMEDY Show - English Standup Comedy in ZURICH
- Description: The NERDY COMEDY Show is an English standup comedy show about video
- Overall: 311 impressions, 17 clicks, position 11.2

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| nerdy comedy show the | bottom of page one, aim higher | 29 | 0 | 9.4 | 1.2 |  (name) |
| nerdy comedy show | bottom of page one, aim higher | 12 | 0 | 9.8 | 0.4 |  (name) |

### /switzerland/ (gain 1.0)

Source `pages/6_switzerland.md`

- Title: Stand-up Comedy in Switzerland: A Guide
- Description: A practical guide for English comedians performing in Switzerland: audiences, promoters, and cultural tips from the IN YOUR FACE Comedy team in Zürich.
- Overall: 442 impressions, 2 clicks, position 6.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| swiss comedians | bottom of page one, aim higher | 17 | 0 | 9.8 | 0.6 |  |
| swiss stand up comedians | bottom of page one, aim higher | 10 | 0 | 9.2 | 0.4 |  |

### /comedians/ (gain 0.9)

Source `pages/2_comedians.md`

- Title: IN YOUR FACE Comedians - Stand-Up Performers in Zürich
- Description: Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials.
- Overall: 465 impressions, 5 clicks, position 6.6

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| valerie mirindi | bottom of page one, aim higher | 14 | 0 | 8.3 | 0.9 | valerie, mirindi (name) |

### /pulpnonfiction/ (gain 0.7)

Source `_posts/2026-04-11-pulp_non-fiction_storytelling_open_mic_zurich.md`

- Title: Pulp Non-Fiction - Storytelling Open Mic Zürich
- Description: Got a story to tell? Pulp Non-Fiction is a story telling and comedy
- Overall: 80 impressions, 8 clicks, position 10.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| pulp non fiction | bottom of page one, aim higher | 13 | 2 | 6.3 | 0.7 |  (name) |

### /filippo-spreafico/ (gain 0.4)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 245 impressions, 24 clicks, position 6.3

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|
| filippo spreafico | page two, aim for page one | 25 | 0 | 14.8 | 0.4 | filippo, spreafico (name) |

### /downunder/ (gain 0.0)

Source: _not found_ (redirect, old URL or generated page)
- Overall: 51 impressions, 3 clicks, position 6.7

| Query | Kind | Imp | Clicks | Pos | Gain | Missing |
|---|---|---|---|---|---|---|

## Comedian pages (meta-only)

14 comedian pages carry opportunities worth 145.0 extra clicks a quarter over 3174 impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.

- Words the queries use that the pages do not: andrearamirez (16), stand (13), up (13), comedy (13), zurich (13), comedian (12)

| Page | Gain | Top query | Imp | Pos | Name |
|---|---|---|---|---|---|
| /comedians/andrea-ramirez/ | 57.3 | andrea ramirez | 1912 | 10.0 | yes |
| /comedians/woocash/ | 18.2 | woocash | 274 | 7.8 | yes |
| /comedians/ruben-garcia/ | 16.6 | ruben garcia | 80 | 6.4 | yes |
| /comedians/teddy-hall/ | 16.5 | teddy hall comedy | 68 | 5.7 | yes |
| /comedians/emir-tonbul/ | 13.5 | tonbul | 55 | 6.2 | yes |
| /comedians/albert-louw/ | 5.4 | albert louw | 89 | 4.2 | yes |
| /comedians/miguel/ | 5.1 | miguel zurich | 12 | 6.2 | yes |
| /comedians/richard-cunha/ | 4.9 | richard cunha | 96 | 4.0 | yes |
| /comedians/coopernik/ | 4.2 | nik | 64 | 7.6 | yes |
| /comedians/martinadoescomedy/ | 1.3 | martina comedy | 10 | 8.4 | yes |
| /comedians/laugh-at-domenico/ | 0.9 | stand up comedy zürich | 13 | 7.8 |  |
| /comedians/dr-val/ | 0.7 | dr val | 10 | 6.8 | yes |
| /comedians/roza-nazar/ | 0.5 | roza | 12 | 9.3 | yes |
| /comedians/chris-darwa/ | 0.0 | chris darwa | 51 | 4.8 | yes |

## Movers since last week

| Query | Page | Imp | Was | Now |
|---|---|---|---|---|
| comedy zürich | / | 105 | 11.3 | 8.6 |


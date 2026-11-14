# Winter plan: Comedy Brew ads from the Christmas markets to the second week of January

Written 14 November 2026 as a proposal; Harry's go the same afternoon. The twelve lines are in
`meta-ads/bank/cold.yml` and `warm.yml` (C32 to C39, W26 to W33) with `image.season: winter`,
and the moment scheduler runs them on its own (`moments-plan.md`). Harry's answers to the open
questions at the end: both holiday shows are on; the Glühwein comparison stays in the headline
(very Zürich); the winter tint is built, with a plain twin of every card on
`meta-ads/creative/bank/season-compare.html`, and Harry picked the tint; the budget stays level, so
`long_weekend_boost` is 1.0 in `config.yml` until after 14 January (Christmas is a weaker month
for comedy, no extra money into it). Status: approved and built, 14 November 2026.

## What we know

- **The experience sells, not the facts.** Every ad that works is one laughing audience face,
  large, with the crowd behind it, and a headline that captions the picture (the rule in
  `creative-bank-plan.md` since 26 September). C7, C13, W6, the dark-by-five pair C31 and W25
  (CHF 0.14 to 0.20 per landing page view, click rate 1.9 to 2.5 percent). Nothing in this plan
  changes that composition. The season is in the words and a light tint on the card, never a
  Santa hat, never a stock Glühwein photo.
- **Last winter the ads were off from 18 December to 12 January** and the Brew page went quiet
  with them: weekly page views 59 in the week of 15 December, 16 in Christmas week, 29 in New Year
  week, 59 again by 12 January (GA, `pagePath` contains comedybrew). This year the calendar has a
  Brew on every Thursday, 24 and 31 December included, so the holidays are a first: there is no
  prior year to compare against, only the November baseline.
- **The markets open on 19 November and close on 23 December** (Bellevue Noël at
  Sechseläutenplatz, the Dörfli in the Niederdorf, the Weihnachtsallee; Polarzauber in the station
  hall and Münsterhof stay open on Christmas Eve). Blick reported a regular red Glühwein at
  Bellevue at CHF 11.90 plus a CHF 5 deposit on the glass; other reports put a cup at CHF 7 to
  10. A Comedy Brew ticket is CHF 10 (CHF 5 student). So "a Glühwein plus its deposit costs more
  than a ticket" holds everywhere; "the deposit alone costs more than a ticket" does not (CHF 5
  deposit, CHF 10 ticket), and the lines below never say it. No ad names a number: prices at
  the stalls change, the comparison does not.
- **The mechanism exists.** A bank line with `moment: { phase: tomorrow|tonight, when: season,
  season: { from, until } }` runs for every show whose date is inside the window, in place of
  the any, wet and long-weekend lines (Halloween and dark-by-five did it this way). The budget
  boost for a long weekend (25 December and 1 January are Zürich holidays) applies on top,
  because `budgetPlan` reads the holiday, not the line. Season lines exist only for the tomorrow
  and tonight sets; the planner keeps its any and long-weekend lines (C18, W12, C20, W14).
- **Dark by five runs until 26 November.** The first window below starts the day after, so
  nothing overlaps.

## The windows

| Window | Season `from` to `until` | Shows | Mood |
|---|---|---|---|
| 1 Glühwein | 2026-11-27 to 2026-12-23 | 3, 10, 17 Dec | The markets are on, the Glühwein is dear, this is the better buy and the warmer room |
| 2a Christmas Eve | 2026-12-24 to 2026-12-24 | 24 Dec | In Zürich without a family table: expats, singles, anyone whose Christmas is the 25th |
| 2b New Year's Eve | 2026-12-31 to 2026-12-31 | 31 Dec | The early shift of the night: laugh at 19:30, then wherever next |
| 3 January | 2027-01-01 to 2027-01-14 | 7, 14 Jan | Back at work, dark again, the resolution to get out more (the Eventfrog hooks for these dates already say "New year, same Thursday" and "Dark outside, bright in here") |

After 14 January the season lines expire on their own and the any, wet and long-weekend lines
return. Harry's brief ends the series there: the second week of January is when people are
back at work and recovering.

## The lines

Rules from the bank files: body 125 characters or fewer, headline under 40, one person per line,
no comedian names, no he, she, her or his, no em dashes, "Doors 19:30" for the time, the headline
on the card is the caption of the laugh, the facts sit in the sub and the body. Each line names
its photo and the face focus (from `auge --faces`, converted to top-left coordinates); every
photo is an audience frame from the gallery that no ad uses yet, with the crowd behind the face.

### Window 1: Glühwein (3, 10, 17 December)

| Id | Set, phase | Person | Body | Headline (Meta) | Card headline and sub | Photo, focus |
|---|---|---|---|---|---|---|
| C32 | Cold, tomorrow | Just paid for a Glühwein at the market | Paid more for a Glühwein than a comedy ticket? Tomorrow: English stand-up at ROBIN's, near Central. Doors 19:30. | Cheaper than a Glühwein | "Cheaper than a Glühwein. Funnier too." / "English stand-up tomorrow, doors 19:30" | IMG_5489_20261021, [0.19, 0.28] |
| C33 | Cold, tonight | Same person, show day | A Glühwein and its deposit cost more than a seat here. English stand-up tonight at ROBIN's, near Central. Doors 19:30. | Cheaper than a Glühwein | "Cheaper than a Glühwein. Warmer too." / "English stand-up tonight, doors 19:30" | IMG_5489_20261021, [0.19, 0.28] |
| W26 | Warm, tomorrow | Knows the name, has done the markets | Skip one Glühwein and that is a Comedy Brew ticket. Tomorrow at ROBIN's: ten acts, doors 19:30, tickets on the door. | Skip one Glühwein | "Skip one Glühwein. Come to this." / "Comedy Brew tomorrow, 19:30 at ROBIN's" | IMG_5488_20261021, [0.17, 0.29] |
| W27 | Warm, tonight | Same person, show day | Glühwein money, better spent. Comedy Brew is on tonight at ROBIN's: ten acts, doors 19:30, tickets on the door. | Better than a Glühwein | "Glühwein money. Better spent." / "Comedy Brew tonight, 19:30 at ROBIN's" | IMG_5488_20261021, [0.17, 0.29] |

IMG_5488 and IMG_5489 are the same row seconds apart (21 October): the woman in the grey blazer
laughing open-mouthed, the whole room behind. The strongest unused frames in the gallery. Cold
and Warm exclude each other, so the near-twin photos never meet one person.

### Window 2a: Christmas Eve (24 December)

| Id | Set, phase | Person | Body | Headline (Meta) | Card headline and sub | Photo, focus |
|---|---|---|---|---|---|---|
| C34 | Cold, tomorrow | In Zürich for Christmas, no family table | In Zürich for Christmas and not at a family table? Tomorrow, Christmas Eve: English stand-up at ROBIN's. Doors 19:30. | Christmas Eve, in English | "Not flying home? Come to this." / "English stand-up on Christmas Eve, doors 19:30" | IMG_5490_20261021, [0.39, 0.44], story headline one line |
| C35 | Cold, tonight | Same person, the day itself | Christmas Eve in Zürich with no plans? English stand-up tonight at ROBIN's, near Central. Doors 19:30. | Christmas Eve, no plans? | "Christmas Eve, with strangers who laugh." / "English stand-up tonight, doors 19:30" | IMG_5490_20261021, [0.39, 0.44], story headline one line |
| W28 | Warm, tomorrow | Follower still in town | Christmas Eve plans? Comedy Brew is on. Tomorrow at ROBIN's, ten acts, doors 19:30, tickets on the door. | Comedy Brew on Christmas Eve | "Yes, there's a Brew on Christmas Eve." / "Tomorrow, 19:30 at ROBIN's" | IMG_5608_20261105, [0.66, 0.37] |
| W29 | Warm, tonight | Same person, the day itself | Christmas Eve and still in town? Comedy Brew tonight at ROBIN's: ten acts, doors 19:30, tickets on the door. | Brew tonight. Christmas Eve. | "Still in town? So is the Brew." / "Comedy Brew tonight, 19:30 at ROBIN's" | IMG_5608_20261105, [0.66, 0.37] |

### Window 2b: New Year's Eve (31 December)

| Id | Set, phase | Person | Body | Headline (Meta) | Card headline and sub | Photo, focus |
|---|---|---|---|---|---|---|
| C36 | Cold, tomorrow | New Year's Eve plans still open | New Year's Eve plans still open? Start with English stand-up at ROBIN's, near Central. Doors 19:30, then the night is yours. | Start New Year's Eve laughing | "Start the last night of the year laughing." / "English stand-up tomorrow, doors 19:30" | IMG_5279_20260924, [0.34, 0.33] |
| C37 | Cold, tonight | Same person, the day itself | Nothing fixed for tonight yet? English stand-up at ROBIN's first, near Central. Doors 19:30, then wherever next. | New Year's Eve starts here | "Start New Year's Eve here." / "English stand-up tonight, doors 19:30" | IMG_5279_20260924, [0.34, 0.33] |
| W30 | Warm, tomorrow | Follower with a late party | New Year's Eve, early shift: Comedy Brew at ROBIN's, doors 19:30, ten acts, then the night is yours. | Comedy Brew, New Year's Eve | "The early shift of New Year's Eve." / "Comedy Brew tomorrow, 19:30 at ROBIN's" | "IMG_5151 Large", [0.38, 0.35] |
| W31 | Warm, tonight | Same person, the day itself | Before the fireworks: Comedy Brew tonight at ROBIN's, ten acts, doors 19:30, tickets on the door. | Before the fireworks | "Laugh first. Fireworks later." / "Comedy Brew tonight, 19:30 at ROBIN's" | "IMG_5151 Large", [0.38, 0.35] |

The two photos carry drinks in hand (the Brooklyn neon frame from 24 September, the spritz
glass on 16 September), which is the right note for the last night of the year. IMG_5151's
foreground face is large and only smiling; the focus sits on the woman in green laughing behind
it. If the render reads flat, IMG_5603_20261105 (the bar row laughing, 5 November, focus
[0.86, 0.33]) is the swap.

### Window 3: January (7 and 14 January)

| Id | Set, phase | Person | Body | Headline (Meta) | Card headline and sub | Photo, focus |
|---|---|---|---|---|---|---|
| C38 | Cold, tomorrow | Back at work, evenings dark again | Back at work and the evenings are dark again? Tomorrow: English stand-up at ROBIN's, near Central. Doors 19:30. | New year, same Thursday | "New year. Same Thursday. Same laugh." / "English stand-up tomorrow, doors 19:30" | from the 19 November or 26 November photos |
| C39 | Cold, tonight | Same person, show day | First weeks back and nothing to look forward to? English stand-up tonight at ROBIN's, near Central. Doors 19:30. | Dark outside. Bright in here. | "Dark outside. Bright in here." / "English stand-up tonight, doors 19:30" | same |
| W32 | Warm, tomorrow | Made a resolution to get out more | Resolution: get out more. Tomorrow counts. Comedy Brew at ROBIN's, ten acts, doors 19:30, tickets on the door. | Get out more. Start tomorrow. | "Get out more. Tomorrow counts." / "Comedy Brew tomorrow, 19:30 at ROBIN's" | IMG_5603_20261105, [0.86, 0.33] |
| W33 | Warm, tonight | Same person, show day | January needs a laugh. Comedy Brew tonight at ROBIN's: ten acts, doors 19:30, tickets on the door. | January needs this | "January needs a laugh. Tonight." / "Comedy Brew tonight, 19:30 at ROBIN's" | IMG_5603_20261105, [0.86, 0.33] |

The January Cold photos are left open on purpose: the gallery's unused laughing frames are
spent by window 2, and two more Brews (19 and 26 November) come before the lines are needed.
Shoot the room from the front, faces in the upper half, one person mid-laugh, and import with
`build-gallery-data.rb import`. Until then the bank can carry the dark-by-five photo
(IMG_5484_20261021, focus [0.5, 0.3]) as the placeholder: its lines end on 26 November, so by
January that frame has rested six weeks in the Cold set.

## The seasonal look

A light touch on the photo card, nothing on the photo itself: a `season: winter` option on the
photo style of `/adcard/` that warms the scrim behind the headline (deep red into amber instead
of the flat dark scrim) and adds a thin gold rule above the headline. No snow, no stars, no
hats, no red-and-green. The face and the crowd stay exactly as they are; the warmth says
December without saying Christmas, so the same look serves the Glühwein, the holiday and the
January windows. `newStylePairs()` gets the one new text-on-field pair so `bun test` keeps the
contrast check. Optional: the plan works on the plain photo look too, and the readout will say
whether the tint earned its place (the dark-by-five pair on the plain card is the control).

## Budget and calendar

- **No new money.** The scheduler's CHF 91 show-week envelope and the 70 percent Cold share
  stay. The long-weekend boost (1.5 on all three moments) fires for 24 and 31 December on its
  own, so those two weeks cost about CHF 125 each instead of 91.
- **December has five Thursdays.** Five show weeks at 91 to 125 plus the old carousel's CHF 130
  lands at about CHF 650 to 680 for the month, over the account's running CHF 600 limit. Either
  raise the limit for December in Business settings or let the two holiday boosts go: the
  config has `long_weekend_boost: 1.5` and `max_boost: 1.75`; a `1.0` for those two weeks is a
  config edit, not code.
- **The planner sets stay as they are.** Saturday to Monday before each show the any and
  long-weekend lines run; before 24 December that is "Long weekend? It starts Thursday." which
  reads right for Christmas week.
- **Christmas Eve and New Year's Eve run or they do not.** Both dates are in the calendar and
  on Eventfrog. If Harry pulls either show, the season lines for it never fire: the scheduler
  keys on `_data/calendar.yml`, and a removed date removes the window. Decide before 18 December
  (the Friday run that makes the 24 December ad sets).

## What the readout will tell us

- Window 1 against the November dark-by-five pair: cost per landing page view and click rate on
  the same tonight and tomorrow sets, same budgets, two weeks each. The Glühwein comparison is
  a "fact in the headline", which the bank rule discourages; this is the test of whether a
  comparison can carry a laugh photo.
- Window 2 has no control; the measure is sales on the night from `eventfrog-sales.ts` and
  whether the room fills at all on 24 and 31 December.
- Window 3 against the November baseline: do the January lines bring the page back to 60 views
  a week faster than last year's 12 January restart.
- From 19 November the "Ticket click" column should fill (the direct pixel hit), so by window 1
  the ranking can move from landing page views to ticket clicks per ad.

## Steps on a go

1. Add the twelve season lines (C32 to C39, W26 to W33) to the bank files with their windows,
   photos and focus, `status: live`.
2. Optional: the `season: winter` card look in `/adcard/` and the bank's `image.season` key;
   `bun test` for the contrast pair.
3. `bun script/meta-bank.ts --board` to render the cards; Harry reads the board.
4. The Friday scheduler run before 3 December creates the first season ad sets; check the
   07:30 log that morning, then the first weekly readout with the lines in it on 11 December.
5. Shoot the room on 19 and 26 November for the January Cold photos; import; fill C38 and C39.
6. Decide the December spending limit and the 24 and 31 December shows before 18 December.

## Open questions for Harry

1. Are the 24 and 31 December Brews definitely on? (Both are on Eventfrog today.)
2. The Glühwein comparison in the headline: fine with "Cheaper than a Glühwein", or keep the
   comparison in the body and leave the card headline to the laugh ("Warmer than the market")?
3. The seasonal tint on the card: build it, or run the plain photo look and keep the control
   clean?
4. Raise the December spending limit, or drop the two holiday boosts?

# Moment ads: the plan (2026-10-04)

Harry's brief, 4 October: speak to the planners early in the week and to the spontaneous buyers
in the last 48 hours; a "tomorrow" message on the Wednesday and a "tonight" message on show day;
switch to weather lines when the forecast turns; make more of Thursdays before a Friday holiday;
weight the money towards Cold; and let a Saturday job set the boosts and switch the ads. Every ad
keeps a laughing audience photo.

Status, 4 October: BUILT. `script/meta-moments.ts` (reference: `docs/scripts.md`) runs from cron at
07:30 and 12:30 every day; the six moment ad sets and their 18 ads exist on Meta. Harry's answers:
the 70/30 and curve split are agreed ("let's try it"); this week's rain runs from cron, not by hand;
there is a Comedy Brew on 24 December, with no special creative for now. Harry's rule: the long
weekend "tomorrow" line (C23, W17) runs on the Wednesday only, which its ad set's window enforces.

## 1. What the numbers say

When Comedy Brew tickets are bought (Eventfrog export 2022 to May 2026, 4,034 tickets; the four
nights with a full curve in September agree):

| When | Share of tickets | Who | Moment |
|---|---|---|---|
| 8 or more days before | 14.8% | planners | planner |
| 4 to 7 days before | 12.9% | planners | planner |
| 2 to 3 days before (Mon, Tue) | 17.9% | mixed | evergreen |
| The day before (Wednesday) | 15.0% | spontaneous | tomorrow |
| Show day | 39.5% | spontaneous | tonight |

Show day sales run from 10:00 to the 19:00 hour (about 7 tickets in that last hour), then the door.
86% of buyers came once, and Cold costs CHF 0.18 a click against Warm's 0.24 (28 days to 4 Oct).
Both support Harry's call to weight the money to Cold: most tickets come from people we have not
reached before.

## 2. The windows

| Moment | Window (Zürich time) | Line |
|---|---|---|
| planner | Saturday (first run) to Monday 23:59 before the show | plan it, book for the group, friends visiting |
| (evergreen) | always, at a low base | the live laugh ads, C7, C13, W2, W9 |
| tomorrow | Wednesday 00:00 to 23:59 | need a boost to make it to the weekend |
| tonight | Thursday, first run to 19:30 | tonight, doors 19:00, tickets on the door too |

Each moment has a condition: `any`, `wet` (a wet or cold turn) or `long_weekend` (the Friday
after the show is a holiday in Zürich). Weather lines exist only for tomorrow and tonight, because a
forecast five days out is not worth a promise.

## 3. How it runs on Meta

The rule that shapes everything: an ad that says "tonight" must be impossible to show on Friday,
even if the Mac is asleep when a job should have switched it off. So the time limits live on Meta,
not in cron:

- **Two evergreen ad sets stay as they are**, Cold and Warm, with the laugh ads at a low base.
- **Six moment ad sets** are added to the Comedy Brew campaign: `cold-planner`, `cold-tomorrow`,
  `cold-tonight` and the same three for Warm. Same targeting as their evergreen parent,
  optimised for landing page views like them. The run that opens a window writes its `end_time`
  and switches the ad set on, so Meta stops it on time by itself; a run that never happens leaves
  it off. Meta wants 24 hours or more between an ad set's start and end; the ad sets started on
  4 October, so every later window qualifies (a fresh ad set could not be opened for one evening).
- **Inside each moment ad set** sit its three ads (any, wet, long weekend). The job switches on the
  one the conditions pick and pauses the other two.
- **Tracking:** `utm_campaign` is the ad set name (`cold-tonight`), `utm_content` the ad name, so
  `/reports/` and the readout show clicks per moment and per ad.
- **To prove on the first weeks:** an ad set whose window has ended taking a new `end_time` the
  next week. The run's read-back shows it; if Meta refuses, the fallback is a fresh ad set per
  window with the three ads copied in.

## 4. The conditions

**Weather.** Source: MeteoSwiss open data, "Localised forecasting data, point data"
(`data.geo.admin.ch`, collection `ch.meteoschweiz.ogd-local-forecasting`): the forecast the
MeteoSwiss app shows, per postcode, eight days ahead, updated hourly, free to use. Postcode 8001.
Open-Meteo answers the same question in one call and served this week's check; its free tier is
for non-commercial use, so it is the fallback and the backtest source, not the daily one.
The rule as built (`moments.wet_rule` in config; the backtest may move it): show day is **wet**
when the day's rain at postcode 8001 is 3 mm or more, or the 3-hour rain chance between 17:00 and
21:00 reaches 60%, or the high at Zürich Fluntern is 5 °C or more below either of the two days
before. MeteoSwiss on 4 October for Thursday 8 October: 16.2 mm, evening chance up to 63%, high
14.1 °C after 20.8 °C. All three hold.

**Holidays.** Source: OpenHolidays API (`openholidaysapi.org`, CH, subdivision CH-ZH, public and
school holidays), with a computed fallback (the fixed dates plus the Easter dates) so a dead API
never blocks a run. **long_weekend** = the Friday after the show is a public holiday in Zürich.
Next ones: Christmas (Fri 25 Dec 2026; is there a Brew on 24 Dec?), New Year (Fri 1 Jan 2027, and
31 Dec already has a Brew), Good Friday (26 Mar 2027). Ascension (Thu 6 May 2027) is a holiday on
show day itself and gets its own look later. School holidays (Zürich autumn break 5 to 17 Oct)
are a note on the review, not a condition: they move the room's mix more than its mood.

## 5. Money

Budget stays where it is until Harry says otherwise ("hold the budget for now"). When the job
takes over, it works from one weekly envelope (today about CHF 90 a show week across Cold and Warm,
the old carousel apart) and splits it:

- **Cold 70%, Warm 30%** (today about 60/40).
- **By moment, following the sales curve:** planner 20%, evergreen 20%, tomorrow 20%,
  tonight 40%. Tonight is a short window, so its daily rate is the highest of the week.
- **Boosts:** `wet` raises tomorrow and tonight by half; `long_weekend` raises all three moments by
  half. Never both stacked past 1.75 times.
- **Guards:** the monthly cap in `config.yml` wins over every boost; the capacity guard in
  `eventfrog-sales.ts --guard` cancels boosts when the room is on track to sell out; the old
  carousel and its budget schedules are never touched.

## 6. The job

`bun script/meta-moments.ts`, with `--dry-run` printing the plan and writing nothing:

One cron line, `30 7,12 * * *`: every run does the same thing, reads the next Comedy Brew from
`_data/calendar.yml`, the holidays and a fresh forecast, then makes Meta match the moment. The
runs that matter are Saturday (planner opens, budgets set), Wednesday (tomorrow opens with the
weather pick) and Thursday (tonight opens, weather checked again on the morning of the show). Daily
rather than three named days, so a Mac asleep on Saturday is caught on Sunday, and the 12:30 run
catches a sleeping 07:30 and re-reads the forecast. A run with nothing to change changes nothing.
Each run appends to `script/meta-out/moments-<date>.md` and rebuilds the local board.
Healthchecks: `META_MOMENTS_HEALTHCHECKS_URL`. Not built yet: the sold-out check (the sales
tracker's guard is not on cron); until then a sold-out night still gets its tonight ads.

## 7. Knowing whether it works

- **Clicks per moment and ad:** `/go/` counts by `utm_campaign` and `utm_content`, in the readout.
- **Tickets:** every order has a timestamp, so each window's tickets can be counted against the
  same window on past shows, the curves method from the sales tracker.
- **Weather, before trusting the boost:** one backtest of every Comedy Brew night since 2022
  against Open-Meteo's archive (tickets on the night versus rain and the temperature turn). If wet
  nights do not sell more, the rain lines can stay but the money boost goes.

## 8. Order of work

1. Done 4 Oct: creatives C18 to C26, W12 to W20 (C24 carries Harry's "No idea what to do tonight?
   Do this."); `script/lib/moments-lib.ts` with tests; `script/meta-moments.ts`; the six ad sets and
   18 ads on Meta; the board labels each ad's ad set and reads its state from Meta.
2. Next: the readout (`meta-insights.ts`) gains the six moment ad sets and a per-moment table.
3. Weather backtest (read-only) before the wet boost is trusted.
4. The sold-out check before tonight opens.

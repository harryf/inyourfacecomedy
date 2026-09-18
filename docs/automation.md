# Automation: the scripts, the schedule and the monitoring

Everything under `script/` that keeps inyourfacecomedy.ch current without anyone editing it by
hand: what each script does, what it needs, how to run it from a terminal, and how the scheduled
ones run from cron and launchd on Harry's Mac. The depth behind each script (parsing rules, design
decisions, every flag) is in `scripts.md`; this file is the map and the operations manual.

The site itself is static. None of this runs on a server: a job changes files in the repo, commits,
pushes to `master`, and Netlify rebuilds the site (about a minute). A job that writes nothing to
the repo (the Google listing, the staff calendar, Meta, Mailchimp) talks to that service's API
directly.

## What needs to be installed

All of it runs on macOS. Several scripts use tools only a Mac has, so this is not portable to a
Linux box without work (the Jekyll build and `check-site.rb` are; CI proves it on every push).

| Need | For | Notes |
|---|---|---|
| Ruby 3.2.4 via rbenv, Bundler | every `.rb` script, the Jekyll build | `.ruby-version` pins it. The scripts are stdlib only; Bundler is for Jekyll and html-proofer (`bundle install`) |
| bun (1.3 or newer) | every `.ts` script, `bun test` | `bun install` once for the test dependency. Never npm |
| git with push access to `origin` over SSH, no passphrase prompt | every job that commits | cron cannot answer a prompt. The key must be usable without one (agent or keychain) |
| `.env` at the repo root | almost everything | `cp .env.example .env`, then fill in. Gitignored. Each script loads it itself, so a cron line never sources it |
| `sips` (ships with macOS) | `sync-comedians.rb`, the gallery scripts, the email images | |
| Xcode command line tools (`swiftc`) | `robins-calendar.ts` | compiles `script/lib/ekcal.swift` on first run. `xcode-select --install` |
| Calendar.app signed in to the iCloud account that owns the staff calendar | `robins-calendar.ts` | plus the Calendars permission, see "launchd" below |
| Brave or Google Chrome | `meta-lineup-ad.ts`, `meta-bank.ts`, `email-monthly.ts`, `build-gallery-card.rb` | run headless to render images through the site's own pages |
| `auge` (`/opt/homebrew/bin/auge`) | `build-gallery-data.rb build` | Apple Vision on the command line |
| `claude` CLI | `refresh-calendar-page.rb --init`, the three email scripts | cannot run inside a Claude Code session; the email scripts take `--copy` or `--no-ai` there |
| local llama-server on `127.0.0.1:8080` (LaunchAgent `com.pmai.llama-server`) | `post-events-to-google.rb`, only when it drafts the description for a brand-new ROBIN's show | the daily run does not need it otherwise |

### Secrets and credential files

All gitignored, all at the repo root, none ever committed. Names only here; values live in `.env`.

| Name | Used by |
|---|---|
| `HEALTHCHECKS_URL` | the four Ruby jobs (see "Healthchecks") |
| `GA_REPORTS_CREDENTIALS` (path to `ga-reports-sa.json`), `GA_REPORTS_HEALTHCHECKS_URL` | `ga-report.ts`; `ga-setup.ts` and `ga-annotations.ts` use the same key but need the Editor role on the property |
| `GSC_SITE`, `GSC_HEALTHCHECKS_URL` (both optional) | `gsc-report.ts`, which reads Search Console with the `GA_REPORTS_CREDENTIALS` account (a Restricted user on the property) |
| `GRIST_API_KEY` | `sync-comedians.rb`, `meta-lineup-ad.ts` |
| `EVENTFROG_ORGANIZER`, `EVENTFROG_HEALTHCHECKS_URL` | `eventfrog-sales.ts`, the ticket count in `robins-calendar.ts`. The key can write; the code cannot: `script/lib/eventfrog-api.ts` has one verb, GET, over a whitelist of paths |
| `META_ACCESS_TOKEN`, `META_ADS_HEALTHCHECKS_URL` | the `meta-*.ts` scripts, plus ids and budgets in gitignored `meta-ads/config.yml` (from `config.example.yml`) |
| `MC_API_KEY` | the three email scripts |
| `ROBINS_CALENDAR` | `robins-calendar.ts`: the exact title of the calendar in Calendar.app |
| `client_secret_*.json`, `gbp-token.json` | `post-events-to-google.rb`, `probe-gbp-v4.rb`. The token acts as the listing owner |

## The scripts at a glance

Scheduled jobs first. "Git" says whether the script commits and pushes by itself.

| Script | What it does | Runs | Git |
|---|---|---|---|
| `refresh-next-event-dates.rb` | Spawns `refresh-calendar-data.rb`, then writes each show's next date, venue and price into its post, bumps the home page's lastmod, pings IndexNow | cron, 09:00 daily | yes |
| `refresh-calendar-data.rb` | The one Eventfrog extractor: every upcoming instance of every show into `_data/calendar.yml`, past ones into `calendar_past.yml`, new venues into `venues.yml` | spawned by the 09:00 job | no |
| `post-events-to-google.rb` | Google Business Profile event posts for ROBIN's shows in the next 7 days, managed as a stack | cron, 09:30 daily | no |
| `sync-comedians.rb` | Grist to `_comedians/` with resized photos; unpublishes who is no longer Live | cron, 10:05 daily | yes |
| `ga-report.ts` | Google Analytics to the per-show `/reports/` pages | cron, 10:20 daily | yes |
| `refresh-calendar-page.rb` | Regenerates `pages/1_calendar.md` from `calendar.yml` and the copy pools, validates it | cron, 11:00 Saturday and Sunday | yes |
| `robins-calendar.ts` | ROBIN's shows into the Apple calendar shared with the bar staff, with a ticket count in the last three days | launchd, 11:05 daily | no |
| `eventfrog-sales.ts` | Comedy Brew sales snapshots, the capacity guard, the Saturday review | by hand for now; cron lines below | no |
| `meta-lineup-ad.ts` | The weekly lineup ad in the Buyers ad set | parked since 2026-09-18 (the ad set is paused; see `meta-ads.md`), not run | no |
| `ga-annotations.ts` | Show dates as annotations on GA charts | by hand; cron line below | no |

Run by hand when needed:

| Script | What it does |
|---|---|
| `add-event.rb` | Creates a new show from its Eventfrog link: the post, the images, then the calendar data and page. Never touches git |
| `check-site.rb` | The health check after a build: 100+ assertions plus html-proofer. Also runs in CI |
| `validate-calendar.rb` | Checks `pages/1_calendar.md` against its markup contract (`calendar-structure.md`) |
| `probe-gbp-v4.rb` | Read-only "is the Google Business Profile API alive" check |
| `build-gallery-data.rb`, `build-gallery-card.rb` | The `/moments/` gallery data (Apple Vision) and its share card |
| `ga-setup.ts` | The GA property's configuration as code (`analytics.md`) |
| `gsc-report.ts` | Search Console worksheet: queries at position 11 to 20 and the page that ranks for each, with its current title and description (`scripts.md`) |
| `email-monthly.ts`, `email-thankyou.ts`, `email-promo.ts` | Build a Mailchimp draft and open it; they never send (`emails.md`) |
| `meta-lists.ts`, `meta-adsets.ts`, `meta-bank.ts`, `meta-insights.ts` | Meta ads: customer lists, ad set targeting, the creative bank, the Friday readout (`meta-ads.md`) |

Shared code lives in `script/lib/` (TypeScript helpers, the Swift calendar bridge), tests in
`script/__tests__/` (`bun test`), the launchd plist in `script/launchd/`, the email prompts in
`script/email-prompts/`. Output folders `script/*-out/` and `script/*.log` are gitignored.

## Running a script from the terminal

Always from the repo root, always `--dry-run` first on anything that writes:

```
cd ~/Code/personal/inyourfacecomedy
ruby script/refresh-next-event-dates.rb --dry-run --verbose
bun script/robins-calendar.ts --dry-run
bun script/ga-report.ts --dry-run
ruby script/post-events-to-google.rb --dry-run --verbose
ruby script/sync-comedians.rb --dry-run
```

A dry run writes nothing, commits nothing and pushes nothing. Drop the flag to do it for real; the
jobs marked "Git: yes" above then commit and push by themselves, staging only their own paths.
Flags that stop short of git: `--no-push` (`ga-report.ts`, `refresh-calendar-page.rb`),
`--no-commit` (`sync-comedians.rb`). Most scripts answer `--help` or print usage on a bad flag; the
full flag lists are in `scripts.md`.

Two things to know before running the git jobs by hand:

- They assume `master` is checked out and the tree is clean. On a branch they push nothing and
  still report success. The 09:00 job stages `_posts` wholesale, so a half-edited post in the tree
  goes live with it.
- A real hand run pings Healthchecks like a scheduled one. That is fine (a success is a success),
  but a hand run that fails raises the alarm too.

## cron

Six of the seven scheduled jobs run from Harry's user crontab (`crontab -e`, `crontab -l`). The
job lines as installed (comments shortened here):

```cron
# IYF: Eventfrog to calendar data and next dates, commit, push
0 9 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.rbenv/versions/3.2.4/bin/ruby script/refresh-next-event-dates.rb >> script/refresh.log 2>&1
# IYF: Google Business Profile event posts, after the 09:00 refresh
30 9 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.rbenv/versions/3.2.4/bin/ruby script/post-events-to-google.rb >> script/gbp.log 2>&1
# IYF: Grist to _comedians/, clear of the other git jobs so two pushes never race
5 10 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.rbenv/versions/3.2.4/bin/ruby script/sync-comedians.rb >> script/sync-comedians.log 2>&1
# IYF: GA reports
20 10 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/ga-report.ts >> script/ga-report.log 2>&1
# IYF: regenerate /calendar/ on Saturday and Sunday (a missed day is covered by the next)
0 11 * * 6,0 cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.rbenv/versions/3.2.4/bin/ruby script/refresh-calendar-page.rb --no-refresh >> script/refresh.log 2>&1
```

The shape of every line is the same, and each part is there because cron's environment is nearly
empty:

- `cd` into the repo first: the scripts resolve their own paths, but the log path is relative.
- The interpreter by absolute path. cron's `PATH` has no rbenv shims and no bun, and a bare `ruby`
  there is macOS Ruby 2.6, which cannot parse these scripts. After a Ruby upgrade, update the path
  in every line. For the same reason a script that spawns another uses `RbConfig.ruby`.
- cron starts Ruby as US-ASCII, and the repo is full of Zürich, Español and emoji. Every Ruby
  script sets `Encoding.default_external = Encoding::UTF_8` at the top; without it a script that
  works in a terminal dies at 09:00.
- `>> script/<name>.log 2>&1`: each run appends; nothing rotates the logs, trim them by hand.
- Times are spaced so that two jobs never push at the same moment, and so that everything
  downstream of the 09:00 refresh (the Google posts, the staff calendar, the weekend calendar page
  with `--no-refresh`) reads data that is already fresh.
- cron only fires while the Mac is awake; a job whose minute passes during sleep is skipped, not
  caught up. The times sit in hours the laptop is normally open, and Healthchecks (below) reports
  a day that was missed.

Proposed lines, not installed yet. Each waits on a stretch of hand runs first (`scripts.md` says
what for):

```cron
# GA annotations for show dates, after the 09:00 refresh has landed
25 10 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/ga-annotations.ts >> script/ga-annotations.log 2>&1
# (The Meta lineup ad lines, Monday 13:00 and Tuesday 09:00, are gone: Buyers is parked, see meta-ads.md.)
# Comedy Brew sales (Eventfrog, read-only): daily snapshot; Tuesday and Wednesday three more; show day hourly; Saturday review
0 9 * * * cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/eventfrog-sales.ts --poll --slot daily --guard >> script/eventfrog-sales.log 2>&1
0 13,17,20 * * 2,3 cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/eventfrog-sales.ts --poll --slot midday --guard >> script/eventfrog-sales.log 2>&1
0 10-20 * * 4 cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/eventfrog-sales.ts --poll --slot showday --guard >> script/eventfrog-sales.log 2>&1
30 9 * * 6 cd /Users/harry/Code/personal/inyourfacecomedy && /Users/harry/.bun/bin/bun script/eventfrog-sales.ts --review >> script/eventfrog-sales.log 2>&1
```

Install a line with `crontab -e`, check with `crontab -l | grep inyourfacecomedy`, and keep a copy
before editing (`crontab -l > ~/crontab-backup-$(date +%F).txt`).

## launchd

One job cannot run from cron: `robins-calendar.ts` writes to the local Calendar store, which macOS
guards with the Calendars privacy permission.

- cron runs outside the login session, so macOS refuses it the permission without ever showing a
  prompt. There is nothing to click and nothing to grant.
- A launchd agent runs inside the login session, but macOS pins the permission request on the
  program launchd starts, and only shows the prompt when that program carries a usage description.
  Started as `bun script/robins-calendar.ts` the request is pinned on bun, which has none, and is
  refused just as silently (tried 2026-09-18).
- So the agent starts the small Swift helper instead: `script/robins-out/ekcal run
  /Users/harry/.bun/bin/bun script/robins-calendar.ts`. The script links an Info.plist with the
  usage description into `ekcal` when it compiles it. `ekcal run` asks for access (macOS prompts
  once, Harry clicks Allow), then runs the script, and the script's own `ekcal list` and
  `ekcal apply` calls inherit the grant.

The agent is `ch.inyourfacecomedy.robins-calendar`, daily at 11:05, log in
`script/robins-calendar.log`. The tracked copy of its plist is in `script/launchd/`.

```
# first time: build the helper (any dry run does it), then install and start the agent
bun script/robins-calendar.ts --dry-run
cp script/launchd/ch.inyourfacecomedy.robins-calendar.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/ch.inyourfacecomedy.robins-calendar.plist

launchctl kickstart gui/$(id -u)/ch.inyourfacecomedy.robins-calendar      # run now; click Allow the first time
launchctl print gui/$(id -u)/ch.inyourfacecomedy.robins-calendar | grep -E "runs|last exit"
launchctl bootout gui/$(id -u)/ch.inyourfacecomedy.robins-calendar        # uninstall
```

Things to know:

- The plist holds absolute paths (the repo, bun). On another machine or after moving the repo,
  edit them before installing. After editing an installed plist: `bootout`, copy, `bootstrap`.
- The helper binary is ad-hoc signed, so a rebuilt binary is a new program to macOS and the grant
  is gone. The script rebuilds only when the text of `script/lib/ekcal.swift` changes (a sha256
  beside the binary). After such a change, `kickstart` the agent while someone is at the screen and
  answer the prompt. "calendar access denied" in the log means exactly this.
- Unlike cron, launchd runs a job whose time passed during sleep when the Mac wakes.
- Running the script from a terminal uses the terminal's own Calendars permission, which is a
  separate grant (System Settings, Privacy & Security, Calendars).
- Any future job that needs a macOS privacy permission (Calendars, Contacts, Photos, Reminders)
  belongs here for the same reason. Everything else is simpler in cron.

## Healthchecks

[Healthchecks.io](https://healthchecks.io) is a dead man's switch: a check expects a ping every
so often and raises an alarm when one does not arrive, or when a `/fail` ping does. It is how a
broken job on a laptop reaches Harry's phone. It covers three different failures with one
mechanism:

| Failure | What happens | How it surfaces |
|---|---|---|
| The job ran and something went wrong (Eventfrog changed its markup, a push was rejected twice, Google rejected a post, a key expired) | the script pings `<url>/fail` with the reason in the body | the check goes down at once, the reason is in the alert |
| The script crashed | a top-level rescue pings `/fail` with the exception, then re-raises | same |
| The job never ran (Mac off or asleep, cron broken, permission lost) | no ping arrives | the check goes down once period plus grace has passed |

The ping URL is a secret of sorts (anyone with it can fake a success), so it lives in `.env`. A
script whose variable is unset skips the ping silently; nothing else changes.

| Variable in `.env` | Check covers | Pings from |
|---|---|---|
| `HEALTHCHECKS_URL` | the four Ruby cron jobs, sharing one check | `refresh-next-event-dates.rb`, `refresh-calendar-page.rb`, `sync-comedians.rb`, `post-events-to-google.rb` (which prefers `GBP_HEALTHCHECKS_URL` if that is ever set) |
| `GA_REPORTS_HEALTHCHECKS_URL` | the reports job | `ga-report.ts`. Also `/fail` when GA shows a new broken `/go/` link, so a typo in a campaign link alerts |
| `EVENTFROG_HEALTHCHECKS_URL` | Comedy Brew sales | `eventfrog-sales.ts`: success per run, readout lines to `/log` (recorded, no alarm), `/fail` on a guard action, a sold-out show or a rejected key |
| `META_ADS_HEALTHCHECKS_URL` | the Meta jobs, one check to start | `meta-lineup-ad.ts`, `meta-adsets.ts`, `meta-insights.ts` |
| none yet | the staff calendar | `robins-calendar.ts` does not ping. Its failures are only in `script/robins-calendar.log` |

The signals in use: the bare URL is success, `/start` marks the beginning of a run (so a job that
hangs shows as "started, never finished"), `/fail` is an alarm, `/log` attaches a line without
changing the check's state. Request bodies carry the detail, cut to a couple of thousand
characters.

One known weakness: four jobs share `HEALTHCHECKS_URL`, so a missed run of one is masked by the
next job's success ping half an hour later. A `/fail` still gets through at once; only "never ran"
is hidden, and only for a single job while the others keep running. Splitting it means one check
and one variable per job, the way `GBP_HEALTHCHECKS_URL` already allows for the Google job.

`add-event.rb` spawns `refresh-calendar-page.rb` with `HEALTHCHECKS_URL` cleared, so creating a
show by hand can never report a fake green for the weekend job.

### Setting up a check

1. In Healthchecks.io: New Check, name it after the job ("IYF refresh-next-event-dates"), period
   1 day, grace 1 day for a daily job (grace 26 hours for the sales check; a weekly job gets a
   period of 1 week).
2. Copy the ping URL (`https://hc-ping.com/<uuid>`) into `.env` under the variable above.
3. Integrations tab: connect Telegram (or email, Slack). Turn "notify when the check goes down"
   on and "notify when it comes back up" off, or every recovery produces a message and the
   messages stop being read.
4. Test both directions: run the job by hand and watch a green ping arrive within seconds; then
   `curl -fsS -m 10 "$URL/fail" -d "test"` and confirm the alert reaches the phone.

## When something looks wrong

| Symptom | Look at |
|---|---|
| A Healthchecks alert | the body of the alert names the reason; then the job's log |
| Show dates stale on the site | `script/refresh.log`; is the repo on `master` with a clean tree; did the push succeed |
| A job works in the terminal and fails at its scheduled time | cron's environment: interpreter path, encoding, a tool that is on your `PATH` but not cron's |
| "calendar access denied" in `robins-calendar.log` | the helper was rebuilt or the grant was reset: `launchctl kickstart ...` at the screen, click Allow |
| The staff calendar did not update but the log is clean | a person edited that field, so it is theirs now (`scripts.md`, "Humans win"); `--force` hands it back |
| Google listing not updating | `script/gbp.log`; a quarantined post waits for an edit to its `gbp/<slug>.txt`; `ruby script/probe-gbp-v4.rb` for the API itself |
| A job has not run for days, no alert | was the Mac awake at that time; is the shared check masking it (above) |

Logs: `script/refresh.log` (the 09:00 job and the weekend calendar page), `gbp.log`,
`sync-comedians.log`, `ga-report.log`, `robins-calendar.log`.

## Rules for writing a new script

- One runnable file per script. Ruby: stdlib only, helpers copied from a sibling with a comment
  naming the source, `Encoding.default_external = Encoding::UTF_8` at the top, child Ruby through
  `RbConfig.ruby`. TypeScript under bun may share a helper in `script/lib/`.
- `--dry-run` that writes, commits and pushes nothing.
- A script that commits stages its own paths by name, pulls with rebase once on a rejected push,
  and commits only when something changed.
- Load `.env` itself; never print a secret; ping a Healthchecks variable when one is set.
- Decide the scheduler by what the job touches: a macOS privacy permission means launchd with a
  helper that carries a usage description; anything else is a cron line.

A move off the laptop (a scheduled GitHub Action for the date refresh, for one) would remove the
"Mac must be awake" failure. It has not been done: several jobs need macOS tools or local
credentials, and the pure ones are cheap where they are.

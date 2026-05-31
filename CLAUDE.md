# Notes for Claude working on this codebase

This is the IN YOUR FACE Comedy website: a Jekyll site at inyourfacecomedy.ch for our English stand-up nights in Zürich. Read `README.md` first for the full lay of the land. This file is the short list of things that will bite you if you do not know them.

## Build and check

```
bundle exec jekyll build --future          # always pass --future (some shows are dated ahead)
ruby script/check-site.rb --no-build        # health smoke test, 78+ checks, exit 0 = good
```

Always run the health check after a change and before you say you are done. The same check runs in GitHub Actions on every push and pull request (`.github/workflows/jekyll-build.yml`).

## Rules that bite

- **Push to `master` goes live.** Both GitHub Pages and Netlify build from `master`. For anything that could break the build, work on a branch and open a pull request. Netlify makes a draft of the PR so you can see it is sound, then merge.
- **The theme is vendored.** `_layouts/` and `_includes/` are the theme itself, edited in place. There is no theme gem and no `theme:` in `_config.yml`, so a missing include really does break the build (a clean build is meaningful).
- **Do not hand-edit `_comedians/*.md`.** Those pages are built from a Grist table by `script/sync-comedians.rb` and will be overwritten. Change the data in Grist, then run the sync.
- **Do not hand-set `next_event_date` as if it sticks.** `script/refresh-next-event-dates.rb` writes it from Eventfrog every day. Eventfrog is the truth for show dates.
- **Show → comedian links run off `hosts:` front matter, not lineups.** Each show post carries `hosts: [<comedian-slug>…]` (+ optional `hosts_label:`) naming the regular host(s)/resident cast — stable, hand-maintained, NOT the per-night lineup. It drives the host card grid on the show page, the "Catch X at" chips on the comedian profile, and the Event JSON-LD `performer[]` Persons. An unknown slug renders nothing (no broken link). Comedian profiles also emit `ProfilePage`/`Person` JSON-LD with `sameAs` socials (`_includes/jsonld-comedian.html`). See `COMEDIAN_SEO.md` for the full picture + the IndexNow ping in `sync-comedians.rb`.
- **Sources of truth are derived from files.** A show is any `_posts` file with a `ticket_url`; a comedian is any file under `_comedians/`. The home page, calendar, sitemap, and health check all build themselves from this, so you rarely hardcode lists.
- **Case matters on the live build.** macOS hides case, but Linux (CI and the live build) does not. An image path must match the file's case exactly, or it works on your Mac and 404s once live. html-proofer in the health check catches this.
- **Markdown inside an `.html` include still gets processed,** because the page that pulls it in is a `.md` file and kramdown runs on the whole thing. So you can inline an include's body into a post and the output stays the same.
- **Scripts in `script/` run under cron, which defaults to US-ASCII.** cron starts Ruby with `Encoding.default_external = US-ASCII` (no `LANG`/`LC_ALL`), so any `File.read`/`File.foreach` of a repo file that contains non-ASCII bytes — and most do: `Zürich`, `Español`, `—`, `•`, emoji in `_posts/`, `pages/1_calendar.md`, `_data/*.yml` — raises `Encoding::CompatibilityError` (or mangles the text) the moment you regex-match or YAML-parse it. Force UTF-8: put `Encoding.default_external = Encoding::UTF_8` near the top of the script (one line, covers every read), and/or pass `encoding: "UTF-8"` to each read. `script/sync-comedians.rb` is the reference. This bites silently — it works in your UTF-8 terminal and only fails at 3am under cron.

## Never commit

- `.env` (holds the Healthchecks ping URL)
- `ga-mcp-oauth-client.json` (Google credentials)
- the `GRIST_API_KEY` (give it at run time, never write it in a file)
- the campaigns `.xlsx` at the repo root (it holds people's data, PII)

All but the spreadsheet are already in `.gitignore`. Stage files by name when you commit, so the spreadsheet never slips in.

## Two browser tools

Both keep their whole state in the link and run in the browser, no server. The `/comedians/` show-promo links and the `/lineup/` Lineup Maker share one query-string scheme (see `SHOW_PROMO_LINKS.md`; the scripts are `assets/js/comedian-lineup.js` and `assets/js/lineup-maker-2000.js`). Both are
covered by `bun test` (happy-dom, in `assets/js/__tests__/`) — run `bun test` after touching them;
the suite pins the anti-spam/security invariants and the URL-scheme reshape behavior. `/lineup/` is held out of search and the nav on purpose (`noindex`, `sitemap: false`).

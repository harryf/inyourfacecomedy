# IN YOUR FACE Comedy

The website for our English stand-up comedy nights in Zürich, Switzerland, live at
[inyourfacecomedy.ch](https://inyourfacecomedy.ch). It is a static Jekyll site. The theme (once
Type-on-Strap) is baked into the project, so there is no theme gem and nothing outside to fetch.

## What is in here

- `_posts/` the shows. A show is any post with a `ticket_url`; its front matter holds the ticket link, venue, next date, price and hosts. The home page, the calendar and the sitemap build themselves from these.
- `_comedians/` one page per comedian, generated from Grist. Do not hand-edit.
- `pages/` the standing pages (calendar, comedians, perform, gallery, follow, host, switzerland, 404) and a few unlisted tools (Lineup Maker 2000, the link builder, the click tracker, the show reports).
- `_layouts/`, `_includes/`, `_sass/`, `assets/` page shells, shared parts (show card, navbar, the JSON-LD blocks for Google's rich results), styles, scripts, fonts, images.
- `_data/` data files, most of them generated: `calendar.yml` (every upcoming show date, from Eventfrog), `venues.yml`, `gallery.yml`, the report data.
- `script/` the automation that keeps all of the above current, and the health check.
- `admin/` Decap CMS, for editing show text in a browser at `/admin/`.
- `docs/` the internal documentation. Not published.
- `gbp/`, `meta-ads/` working files for the Google Business Profile posts and the Meta ads. Not published.
- `video/` a small Remotion project that renders the video ads for Instagram and Facebook Stories and Reels. Its own `package.json` and README. Not published.

## Run it locally

You need Ruby 3.2.4 (see `.ruby-version`; rbenv works well) and Bundler.

```
bundle install
bundle exec jekyll serve --future    # http://localhost:4000, rebuilds on change
bundle exec jekyll build --future    # one build into _site/
```

Always pass `--future`: some shows are dated ahead of today. Analytics switch themselves off on any
host but the live one, so local visits are not counted.

To check a build before you push:

```
ruby script/check-site.rb --no-build      # 100+ health checks on _site/, including every inner link and image
ruby script/check-site.rb --no-proofer    # skip the link and image pass, faster
bun install && bun test                   # the client-side JavaScript and script helpers (needs bun)
```

Exit 0 means all is well. The health check works out shows and comedians from the files themselves,
so it grows with the site and needs no upkeep.

## How the site gets updated

**Push to `master` and it is live within about a minute.** Netlify builds the site from `master`
and serves it; the domain points there (`CNAME` names it, the build settings are in the Netlify UI).
GitHub Pages also builds every push, but nothing resolves to it. GitHub Actions
(`.github/workflows/jekyll-build.yml`) runs the build and the health check on every push and pull
request.

For anything that could break the build, work on a branch and open a pull request: Netlify makes a
draft of it, and the health check runs, before you merge.

Most updates are not made by a person. Scheduled jobs on Harry's Mac pull show dates from
Eventfrog (the truth for ticketing), comedians from Grist and click reports from Google Analytics,
then commit and push, and the site rebuilds. Other jobs keep the Google Business Profile listing
and the bar staff's shared calendar in step. `docs/automation.md` explains all of it.

You can also edit show text in a browser through the CMS at `/admin/`, or work straight in the
markdown.

Keep secrets out of the repo, which is public: `.env`, the Google credential files and anything with
people's data (email lists, the campaigns spreadsheet) are never committed.

## Documentation

Everything else is in [`docs/`](docs/README.md): the automation and script reference, the calendar
markup contract, comedian SEO, campaign links and analytics, the sharing tools, emails, ads and the
writing guide. `CLAUDE.md` holds the working rules for Claude Code sessions.

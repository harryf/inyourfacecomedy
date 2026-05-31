# IN YOUR FACE Comedy

This is the website for our English stand-up comedy nights in Zürich, Switzerland. It is a Jekyll site and lives at inyourfacecomedy.ch. We once leaned on the Type-on-Strap theme, but it is now baked fully into this project, so there is nothing outside to fetch. Everything the site needs is here.

## Build and run

You need Ruby and Bundler.

```
bundle install
bundle exec jekyll serve --future   # run it on your machine, watches for changes
bundle exec jekyll build --future   # one build into _site/
```

We always pass `--future` because some shows are dated ahead of today.

## How it goes live

Push to `master` and the site builds and goes live by itself. Both GitHub Pages and Netlify build from `master`. Netlify also makes a draft of every pull request, so you can see your work before it is live. The site name (inyourfacecomedy.ch) is set in the `CNAME` file.

For anything that could break the build, work on a branch and open a pull request first. The Netlify draft and the health check (below) will show you it is sound before you merge.

## How it is tested

`script/check-site.rb` is a health smoke test. It runs after a build and makes sure the site still holds together: every show, comedian, and page got built; the sitemap is right (and leaves out hidden pages like `/lineup/`); the search and tracking tags are there; the Event JSON-LD is sound; the show-promo and Lineup lists are good; the helper scripts still read as good Ruby; no live show is stuck in the past; and, through html-proofer, every inner link and image really points at something real.

```
bundle exec jekyll build --future
ruby script/check-site.rb --no-build      # check the build we just made
ruby script/check-site.rb --no-proofer    # skip the link and image pass, faster
```

It works out shows and comedians from the files themselves: a show is any `_posts` entry with a `ticket_url`, and a comedian is any file under `_comedians/`. So it grows with the site and needs no upkeep. Exit 0 means all is well, exit 1 means something broke.

The same check runs on every push and pull request through GitHub Actions (`.github/workflows/jekyll-build.yml`).

## Keeping it running

Two helper jobs keep the live site fresh. Both are meant to run from a daily cron on Harry's Mac.

- `script/refresh-next-event-dates.rb` reads each show's Eventfrog page (Eventfrog is the truth for ticketing) and writes the next upcoming date into the post, then commits and pushes. It is safe to run again and again. It pings Healthchecks.io, so a broken run reaches you over Telegram or email. Without it, show dates and the Event JSON-LD go stale.
- `script/sync-comedians.rb` pulls the comedian list from Grist into `_comedians/`, shrinks each photo with the Mac's `sips` tool, and only touches comedians whose data changed. A comedian who is set Live and has a photo gets a page; the rest are left out or taken down. It needs `GRIST_API_KEY` set when it runs.

Keep secrets out of the project. `.env`, `ga-mcp-oauth-client.json`, and the `GRIST_API_KEY` are all held back by git. Never commit the campaigns spreadsheet either, since it holds people's data.

You can also edit text in a browser through the CMS at `/admin/` (Decap CMS over git-gateway), or work straight in the markdown.

## The lay of the land

- `_posts/` the shows. Each one is data-led: the front-matter holds the ticket link, where it is held, the weekday, the next date, what it costs, and who is on. The home page and the calendar build themselves from these.
- `_comedians/` one page for each comedian (built from Grist, see above, so do not hand-edit these).
- `pages/` the standing pages: follow, calendar, gallery, perform, switzerland, host, the comedians overview, the 404, and the hidden Lineup Maker.
- `_layouts/` the page shells: default, home, post, comedian, page.
- `_includes/` the shared bits: the show card, the head, the navbar and footer, and the JSON-LD blocks that feed Google's rich results.
- `_data/` small data files. `venues.yml` holds each spot's address, so the Event JSON-LD knows where a show is held.
- `assets/` styles, scripts, fonts, and images.
- `script/` the helper scripts above, with their own notes in `script/README.md`.

## Two sharing tools

Both run wholly in the browser and keep their whole state in the link, so the link is the tool.

- Show promo links: add bits to the end of `https://inyourfacecomedy.ch/comedians/` to turn that page into a show promo, a show bill, or an after-show thank-you. See `SHOW_PROMO_LINKS.md`.
- Lineup Maker 2000 at `/lineup/`: an organizer-only tool to build and share a show bill. We hold it out of search and the nav on purpose.

# Docs

Internal documentation for the inyourfacecomedy.ch repo. Read it here on GitHub or locally; the
folder is in the `exclude:` list in `_config.yml`, so none of it is published on the site.

Start with the repo [`README.md`](../README.md) (what this is, how to run it, how it deploys) and, when working with
Claude Code, [`CLAUDE.md`](../CLAUDE.md) (the rules that bite). Then:

| Doc | Read it when |
|---|---|
| [`automation.md`](automation.md) | You want to know what runs by itself: every script at a glance, requirements, running from the terminal, the cron and launchd schedules, Healthchecks monitoring, troubleshooting |
| [`scripts.md`](scripts.md) | You are about to change or debug one script: behaviour, flags, files written, design notes per script |
| [`calendar-structure.md`](calendar-structure.md) | You touch `/calendar/`: the markup of `pages/1_calendar.md` is a contract with its CSS and JS |
| [`comedian-seo.md`](comedian-seo.md) | You touch comedian pages: JSON-LD, the `hosts:` mapping, the related-shows row, IndexNow, the search consoles |
| [`campaign-links.md`](campaign-links.md) | You touch `/go/`, `/linkbuilder/` or `/reports/`: tracked ticket links, UTM rules, the show reports |
| [`analytics.md`](analytics.md) | You touch Google Analytics: what the GA4 property has configured and why, page context, caveats |
| [`search-console.md`](search-console.md) | You touch search performance: Search Console access, the weekly learning loop in `seo/`, what may be changed on which page, reading a verdict |
| [`show-promo-links.md`](show-promo-links.md) | You touch the `/comedians/` promo links, Lineup Maker 2000 or the Week Story |
| [`flyer-design.md`](flyer-design.md) | You touch the flyer generator: which design decisions are fixed and which are free |
| [`emails.md`](emails.md) | You send a Mailchimp campaign: the three email scripts and the review-and-send flow |
| [`meta-ads.md`](meta-ads.md) | You work on the Meta ads: the runbook, status table first. Working plans sit beside the data in `meta-ads/` |
| [`google-business-profile-api-setup.md`](google-business-profile-api-setup.md) | The Google listing job misbehaves: API access, OAuth, moderation history |
| [`google-preferred-source.md`](google-preferred-source.md) | You wonder about the "preferred source" link on `/follow/` and the footer |
| [`writing-guide.md`](writing-guide.md) | You write any visitor-facing copy, doc or commit message: house style |

Conventions: lowercase kebab-case file names; docs refer to each other by bare file name and to the
rest of the repo by path from the root; no em dashes (`writing-guide.md`).

# Special pages: one night, several events, one link

A special page promotes a themed night that bundles two or more existing Eventfrog events, so Instagram, Meetup and the home page can point at one URL. It is not a show page: no `_posts` entry, no `next_event_date`, nothing the daily jobs touch. The first one is `pages/halloween.md` (`/halloween/`, Saturday 31 October 2026: The NERDY COMEDY Show Halloween Sidequest at 20:00, then the Halloween Party at ROBIN's with DJ Igor from 22:00).

## The pieces

| File | Role |
|---|---|
| `_layouts/special.liquid` | The page: hero with the hook, one card per event with its flyer and ticket button, a timeline, the markdown body, closing buttons and the venue link |
| `_includes/promo-strip.liquid` | The strip on the home page, under the hero and above Upcoming Shows, for every page with `promo_home: true` whose `promo_until` is still ahead |
| `_sass/components/_special-event.scss` | Base styles (the site's type and buttons) plus one block per `theme`. `halloween` adds fog, three gliding bats, a cobweb in the hero corner, a blood drip under the hook and a flicker on it; all of it off under `prefers-reduced-motion` |
| `pages/halloween.md` | The worked example and next year's starting point |

## Front matter

```yaml
layout: special
theme: halloween            # a block in _special-event.scss; a missing theme renders plain
title: "..."                # the <title> and og:title; the H1 is the hook
hook: "Are you spending Halloween alone?"   # the first line, a question that names the pain
subtitle: "Don't. ..."      # the answer
permalink: /halloween/
hide: true                  # off the menu
sitemap: false              # a one-night page; indexable, just not in the sitemap
feature-img: /assets/img/uploads/...   # the hero backdrop
image: /assets/img/uploads/...         # the share image (og:image)
promo_home: true
promo_until: 2026-11-01T03:00:00+01:00 # strip gone and page marked "over" after this
strip_cta: "Plan your Halloween"
date_label: "Sat 31 Oct 2026"
venue: "ROBIN's, Zürich"
venue_slug: robins          # GA data-venue on the ticket buttons
venue_address: "..."        # the closing map line
venue_url: https://maps.app.goo.gl/...
closing_title: "Pick one. Or stay for both."
events:                     # in running order
  - name: The NERDY COMEDY Show
    label: Halloween Sidequest
    show: nerdycomedyshow   # GA data-show; a real show slug lands in that show's report
    date: 2026-10-31
    time: "20:00 to 22:00, doors 19:30"
    price_chf: 8            # data for GA, never shown
    image: /assets/img/uploads/...
    ticket_url: https://eventfrog.ch/...
    cta: "Get show tickets"
    blurb: |
      Markdown.
timeline:
  - time: "19:30"
    what: "Doors."
```

The markdown body renders between the timeline and the closing buttons.

## Rules

- Flyers go through `assets/img/uploads/` as stripped JPEGs (`magick <src> -auto-orient -strip -quality 84 <dst>`), named by year so next year's do not collide.
- Every ticket button carries `data-show`, `data-venue`, `data-date` and `data-price`, so `assets/js/ticket-click.js` reports the clicks like a show page (`docs/campaign-links.md`). Use the show's own slug for an existing show; a one-off (`halloween-party`) shows up under its own name in GA.
- No prices in the copy (`docs/writing-guide.md`); "free" for a free event is fine.
- The page tells visitors the night is over once `promo_until` has passed and the daily build has run. Remove the page a week or two later and add its permalink under `redirect_from:` in `pages/1_calendar.md` (CLAUDE.md, Removing a show) so the Instagram and Meetup links land on the calendar.

## Next year

Copy `pages/halloween.md` to the new year's page, swap the two flyers, the two Eventfrog URLs, the dates, `promo_until` and the copy. Keep `theme: halloween`. A different kind of night (a New Year's bundle, say) needs a new `[data-theme="..."]` block in the SCSS with its own `--sp-*` palette and nothing else.

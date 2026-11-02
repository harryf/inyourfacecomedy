# The producer page: `/produce/`

`pages/produce.md` is the page Harry shares by hand with comedians and promoters who ask about putting on a show at ROBIN's. It is unlisted the same way the tools are (`hide: true`, `sitemap: false`, `noindex: true`, `Disallow: /produce/` in `robots.txt`, no nav link; `check-site.rb` asserts all four) but it is a public URL on a public site in a public repo, so it is written for the person across the table. The repo is not the place for the negotiating position: that lives in Harry's documents, outside git.

## What the page is for

It sets the frame before the first conversation: the room is curated, there is a process, there is a fee, the ask is an email. It describes one model only, the one offered to people we do not know yet: the producer sells the tickets and keeps the ticket income, IN YOUR FACE provides the night (room, setup, sound, light, a person on site, the listing) for a fee, and promotion on our channels is a second, optional fee. The other way of working (IN YOUR FACE produces, takes the risk and pays the acts) is not on the site at all. It is offered in person to comedians we know, and a page would turn it into a menu item every stranger asks for.

## Rules for editing it

- No prices, fee ranges, percentages or deposits, and nothing that lets a reader work one out. `check-site.rb` fails on `CHF`, `Fr.` and `francs` in the body. The same rule as the rest of the site (`writing-guide.md`), for a different reason: the number is agreed per show.
- Nothing about how it has been done for anyone before (free or paid), nothing about the arrangement between IN YOUR FACE and ROBIN's, and nothing about why the fee exists or what it covers beyond "the room, the setup and the person on site".
- The 60 and 120 layouts stay as two setups "agreed case by case". The reason the large layout costs more (two hours of heavy lifting instead of one hour of setup) is not for the page.
- Reach figures (mailing list, Instagram, Meetup) are rounded and dated. Refresh them when they move by more than a few hundred: the list count comes from the Mailchimp API, the others from the public pages.
- The timeline (six weeks to book, four weeks for materials) and the materials list are the requirements. Tighten them if producers keep missing them; do not loosen them on the page for one producer, agree the exception by email.
- Keep the "not been on our stage yet" section. It is the filter from the ROBIN's plan (one named owner with an audience, seen on stage here first) written as an invitation.
- The logo link points at `assets/img/inyourface.png`. There is no wordmark; `lineart.png` is not one. If a proper logo pack is added, link that instead.

## Related

- `special-pages.md`: one-night promo pages for bundles of existing events, a different thing.
- `pages/7_host.md`: the public guide to running a room anywhere, which this page does not replace.

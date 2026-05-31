# Comedian-page SEO — how it works & what to maintain

Goal: when a comedian Googles their own name, their IYF profile page (`/comedians/<slug>/`)
shows up, and the page acts as a hub that routes to all their online presences.

This is the operator guide. The code that implements it is in the templates and the
sync script — this file explains the moving parts and the few one-time / occasional
manual steps.

## What ships automatically (no maintenance)

Every `/comedians/<slug>/` page now emits:

- **`ProfilePage` + `Person` JSON-LD** (`_includes/jsonld-comedian.html`). The `Person.sameAs`
  array is built from the comedian's social fields (Instagram, TikTok, Facebook, X,
  YouTube, Website) — this is the machine-readable "router" Google uses to tie the page
  to the person across platforms. `Person.memberOf` links them to the IYF Organization
  node; `@id`s are distinct (`…/` for the page, `…/#person` for the person) so nothing
  collides with jekyll-seo-tag's output.
- A visible **"Stand-Up Comedian · IN YOUR FACE Comedy, Zürich"** sub-line under the name
  (crawlable on-page relevance for "<name> comedian" — we deliberately do NOT use a
  `<meta name="keywords">` tag; that signal has been dead at Google since 2009).
- A **"Catch <name> at …"** block linking to the shows they host/are a resident of
  (see below). This gives otherwise-thin profiles unique content — the single biggest
  lever against Google's "Crawled – currently not indexed".

All of this is derived at build time from the Grist-synced front-matter. **Do not hand-edit
`_comedians/*.md`** — change the data in Grist and re-run `script/sync-comedians.rb`.

## The one thing to maintain: show → hosts mapping

Each show post (`_posts/*.md`) carries a `hosts:` list of comedian **slugs** — the people who
reliably appear (host or resident cast), NOT the per-night lineup (which we only know last
minute). This drives both directions of internal linking: show page → host cards, and
comedian profile → "Catch them at" show chips.

```yaml
# in a show post's front-matter
hosts_label: "Featuring"        # optional; default is "Hosted by"
hosts:
  - "harryf.cks"
  - "jack-roberts"
```

Current mapping:

| Show | hosts | label |
|------|-------|-------|
| Comedy Brew | harryf.cks, martinadoescomedy | Usually hosted by |
| Random Facts Exchange | vasilis-theof | Hosted by |
| Jokes Jokes Jokes | woocash | Hosted by |
| Jackpot Comedy | jack-roberts | Hosted by |
| Down Under | chris-darwa | Hosted by |
| Brexiles | harryf.cks, jack-roberts, shawn-jay | Featuring |
| Pulp Non-Fiction | albert-louw | Hosted by |
| La Tarima | andrea-ramirez | Hosted by |

A slug must match a comedian's `slug:` exactly. An unknown slug renders **nothing** (never a
broken link), so it's safe to add a host before their profile exists — the link appears once
they're live in Grist. To add a new show's hosts, just add the `hosts:` block to that post.

## IndexNow (Bing / Yandex / Seznam — NOT Google)

- Key file: `4b04fa2d03884c6794d4ece40fb41a29.txt` at the repo root → served at
  `https://inyourfacecomedy.ch/4b04fa2d03884c6794d4ece40fb41a29.txt`. Its content is the key.
  **Don't delete or rename it** — IndexNow uses it to prove we own the domain. (The older
  `4428d17d…` key was removed; only this one is valid.)
- `script/sync-comedians.rb` automatically pings IndexNow with the changed comedian URLs
  (+ the `/comedians/` index) after a sync that actually changed pages. It's best-effort:
  a failure warns and is ignored, never aborting the sync or deploy. Removed pages are NOT
  submitted (we never push 404s).
- **Google does not use IndexNow.** For Google the levers are the sitemap, the schema, the
  internal links, freshness, and — for a brand-new page you want crawled now — a manual
  "Request Indexing" in Search Console (below). Expect Bing to react faster than Google.

## One-time manual setup (search consoles)

1. **Google Search Console** (https://search.google.com/search-console) — confirm the
   property is verified, and that `https://inyourfacecomedy.ch/sitemap.xml` is submitted under
   Sitemaps. For a new comedian you want indexed quickly: URL Inspection → paste the profile
   URL → Request Indexing (manual, rate-limited — there is no API for this on Person pages).
2. **Bing Webmaster Tools** (https://www.bing.com/webmasters) — confirm the site is verified
   (the `msvalidate.01` meta tag is already in `head.liquid`) and the sitemap is submitted.
   IndexNow submissions show up under the IndexNow section.
3. **Validate the schema** once after deploy: run a profile URL through
   https://search.google.com/test/rich-results — confirm a `ProfilePage`/`Person` is detected
   with the `sameAs` links and no errors.

## Realistic expectations

You will rarely outrank a comedian's *own* verified Instagram / official site for their exact
name — Google treats their own properties as the primary identity. The realistic, good outcome
is the **IYF page on page 1, often top 3–5**, corroborating who they are. Our `sameAs` is a
one-way claim that supports the entity; it doesn't replace their own profiles.

## Optional, no pressure: the reciprocal link

The strongest single boost to "this IYF page is really them" is a link *back* from the
comedian's own properties (link-in-bio, website) to their IYF profile. We are **not** going to
pressure anyone for this. The intent is that as comedians see their IYF page working in search
over time, some will choose to use it — a ready-made hub that routes to all their socials, a
nice alternative to Linktree for those without a website. If/when someone asks, point them at
their `/comedians/<slug>/` URL.

---
layout: default
title: "Lineup Maker 2000"
permalink: /lineup/
# Organizer-only tool — keep it out of search and the nav.
noindex: true
sitemap: false
hide: true
description: "Power Tool for IN YOUR FACE show organizers to build and share a show lineup."
---

{% comment %}
  Lineup Maker 2000 — a URL-state power tool for show organizers. No auth, no storage: the entire
  state of a lineup lives in the query string, using the SAME scheme as the /comedians/
  show-promo links (show / headliner / host / first / second / lineup / thankyou) plus two
  helper params (type, stage). assets/js/lineup-maker-2000.js does everything in the browser.

  Two build-time catalogs feed it — shows (every post with a ticket_url) and the full
  comedian roster. Both come ONLY from curated site data, so a crafted link can never
  invent a show or a comedian (same anti-spam invariant as the promo page).
{% endcomment %}

<div id="lineup-lab" class="lineup-lab" data-origin="{{ site.url }}">
  <noscript>
    <p class="lineup-lab__noscript">Lineup Maker 2000 needs JavaScript — it builds your lineup entirely in the browser.</p>
  </noscript>
</div>

{% assign iyf_shows = site.posts | where_exp: "p", "p.ticket_url" %}
<script type="application/json" id="iyf-shows">
[{% for s in iyf_shows %}{% assign _v = site.data.venues[s.venue_slug] %}{"slug":{{ s.url | remove: "/" | jsonify }},"title":{{ s.title | jsonify }},"desc":{{ s.description | jsonify }},"url":{{ s.url | jsonify }},"tickets":{{ s.ticket_url | jsonify }},"img":{{ s['feature-img'] | jsonify }},"venue":{% if s.venue %}{{ s.venue | jsonify }}{% elsif _v %}{{ _v.name | jsonify }}{% else %}""{% endif %},"next":{% if s.next_event_date %}{{ s.next_event_date | date_to_xmlschema | jsonify }}{% else %}""{% endif %}}{% unless forloop.last %},{% endunless %}{% endfor %}]
</script>

<script type="application/json" id="iyf-comedians">
[{% for c in site.comedians %}{"slug":{{ c.slug | jsonify }},"name":{{ c.title | jsonify }},"url":{{ c.url | jsonify }},"photo":{{ c.photo | jsonify }},"priority":{{ c.priority | jsonify }},"instagram":{{ c.instagram | jsonify }}}{% unless forloop.last %},{% endunless %}{% endfor %}]
</script>

<script src="{{ '/assets/js/lineup-maker-2000.js' | relative_url }}" defer></script>

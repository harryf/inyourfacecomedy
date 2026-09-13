---
layout: default
title: "Ad Card"
permalink: /adcard/
# Organizer-only tool (the Meta ads bank): keep it out of search and the nav.
noindex: true
sitemap: false
hide: true
image: /assets/img/lineup-manual/og-lineup-maker-2000.png
description: "Power Tool for IN YOUR FACE show organizers: a headline over a photo or on a brand field, sized for a feed post or a story."
---

{% comment %}
  Ad Card: one headline, one line under it, one style, one photo, drawn in the flyer palette
  (Anton, Inter, Permanent Marker; ink, cream, yellow, red) at post (4:5) or story (9:16)
  size with the text inside the Instagram key-content area. State lives in the URL
  (headline, sub, style, photo, format). script/meta-bank.ts renders the Meta ads bank
  through this page headlessly (meta-ads/creative-bank-plan.md); by hand it is a quick way
  to make one image. assets/js/lineup-maker-2000.js draws everything (root #iyf-adcard).
{% endcomment %}

<div id="iyf-adcard" class="lineup-lab" data-origin="{{ site.url }}">
  <noscript>
    <p class="lineup-lab__noscript">Ad Card needs JavaScript: it draws the image entirely in the browser.</p>
  </noscript>
</div>

{% include iyf-catalogs.liquid %}

<script src="{{ '/assets/js/lineup-maker-2000.js' | relative_url }}" defer></script>

---
layout: default
title: "Campaign Link Builder"
permalink: /linkbuilder/
# Organizer-only tool — keep it out of search and the nav (the /lineup/ treatment).
noindex: true
sitemap: false
hide: true
description: "Build UTM-tagged campaign links that route ticket clicks through /go/ so GA sees them."
---

{% comment %}
  Campaign Link Builder — builds UTM-tagged links that point through /go/ so Google
  Analytics sees which channel drove each ticket click. Phone-first on purpose: the
  primary flow is one-handed on an iPhone mid-Instagram-post (tap show, tap source,
  copy from the sticky bar, flip back). assets/js/link-builder.js does everything
  client-side from the same curated catalogs as /go/. Design: CAMPAIGN_LINKS.md.
{% endcomment %}

<div id="link-builder" class="link-builder">
  <noscript>
    <p class="link-builder__noscript">The link builder needs JavaScript — it assembles your campaign link entirely in the browser.</p>
  </noscript>
</div>

{% include go-catalogs.liquid %}
<script src="{{ '/assets/js/link-builder.js' | relative_url }}" defer></script>

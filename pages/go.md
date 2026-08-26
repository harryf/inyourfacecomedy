---
layout: default
title: "Tickets"
permalink: /go/
# Campaign-link redirector — a tracking hop, never a destination. Out of search + nav.
noindex: true
sitemap: false
hide: true
description: "Passing you to the ticket page for an IN YOUR FACE Comedy show."
---

{% comment %}
  /go/?show=<slug>[&date=YYYY-MM-DD]&utm_… — the campaign-link redirector.
  GA records the visit (UTMs and all), then assets/js/go-redirect.js passes the
  visitor to the show's Eventfrog page, resolved ONLY against the embedded
  catalogs below. Unknown show slugs land on our own 404 with the evidence in
  the query string so GA can alert on broken campaign links. Full design +
  the speed budget: CAMPAIGN_LINKS.md.
{% endcomment %}

<div id="go-redirect" class="go-redirect">
  <p class="go-redirect__status" id="go-status">Finding your tickets...</p>
  <p class="go-redirect__manual"><a id="go-link" class="btn-ticket" href="/calendar/">Not redirecting? Tap here</a></p>
  <noscript>
    <p class="go-redirect__noscript">This page needs JavaScript to pass you straight to the ticket site.
    No problem: every show and its ticket link is on <a href="/calendar/">the show calendar</a>.</p>
  </noscript>
</div>

{% include go-catalogs.liquid %}
<script src="{{ '/assets/js/go-redirect.js' | relative_url }}" defer></script>

---
layout: default
title: "Week Story"
permalink: /week/
# Organizer-only tool — keep it out of search and the nav.
noindex: true
sitemap: false
hide: true
image: /assets/img/lineup-manual/og-lineup-maker-2000.png
description: "Power Tool for IN YOUR FACE show organizers: the Instagram story of this week's shows."
---

{% comment %}
  Week Story — draws the Sunday "shows this week" Instagram story (and post) from the
  calendar data: every event from a chosen day through the following seven days, in
  styles borrowed from the Flyer Maker, with a seeded headline and call to action that
  point at the link sticker. State lives in the URL (from, style, format, v); nothing is
  stored. assets/js/lineup-maker-2000.js does everything in the browser (root #iyf-week).

  Events come ONLY from _data/calendar.yml (EventFrog-derived, cron-refreshed) and resolve
  against the shows catalog, so a link can name a date or a style, never a show or a
  destination that the site does not know.
{% endcomment %}

<div id="iyf-week" class="lineup-lab" data-origin="{{ site.url }}">
  <noscript>
    <p class="lineup-lab__noscript">Week Story needs JavaScript — it draws the image entirely in the browser.</p>
  </noscript>
</div>

{% include iyf-catalogs.liquid %}

<script type="application/json" id="iyf-week-info">
[{% assign _si = site.data["calendar-copy"].show_info %}{% for pair in _si %}{% for a in pair[1].assigned %}{"show":{{ pair[0] | jsonify }},"date":{{ a[0] | jsonify }},"info":{{ a[1] | jsonify }}},{% endfor %}{% endfor %}{"show":"","date":"","info":""}]
</script>
<script type="application/json" id="iyf-week-events">
[{% for e in site.data.calendar.events %}{"show":{{ e.show | jsonify }},"date":{{ e.date | jsonify }},"start":{{ e.start | jsonify }},"venue":{{ e.venue_name | default: "" | jsonify }},"price":{{ e.price_chf | default: 0 | jsonify }}}{% unless forloop.last %},{% endunless %}{% endfor %}]
</script>

<script src="{{ '/assets/js/lineup-maker-2000.js' | relative_url }}" defer></script>

---
layout: default
title: "Show traffic reports"
permalink: /reports/
# Unlisted organiser page (the /linkbuilder/ treatment): out of search, sitemap and nav.
noindex: true
sitemap: false
hide: true
description: "Daily Google Analytics traffic reports per show, for show runners."
---

{% comment %}
  Index of per-show traffic reports. Each entry is a _data/reports/<slug>.json file
  written daily by script/ga-report.ts; the page for it is pages/reports/<slug>.md
  (layout: report). Design: CAMPAIGN_LINKS.md, "Show reports".
{% endcomment %}

<article class="report report--index">
  <header class="report__head">
    <p class="report__kicker">For show runners</p>
    <h1 class="report__title">Show traffic reports</h1>
    <p class="report__meta">How many people inyourfacecomedy.ch and your campaigns sent to the ticket page, updated once a day from Google Analytics. Build tracked links with the <a href="/linkbuilder/">link builder</a>.</p>
  </header>

  {% assign reports = site.data.reports | sort %}
  {% if reports.size > 0 %}
  <table class="report__table">
    <thead><tr><th>Show</th><th class="report__num">Clicks, 30 days</th><th class="report__num">All time</th><th>Updated</th></tr></thead>
    <tbody>
    {% for pair in reports %}{% assign r = pair[1] %}
      <tr>
        <td><a href="/reports/{{ r.slug }}/">{{ r.title }}</a></td>
        <td class="report__num">{{ r.totals.clicks_30d }}</td>
        <td class="report__num">{{ r.totals.clicks }}</td>
        <td>{{ r.generated_at | date: "%-d %b" }}</td>
      </tr>
    {% endfor %}
    </tbody>
  </table>
  {% else %}
  <p class="report__note">No reports yet. They appear after the first run of <code>script/ga-report.ts</code>.</p>
  {% endif %}
</article>

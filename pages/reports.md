---
layout: page
title: "Show traffic reports"
subtitle: "Ticket clicks per show, updated daily"
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

<div class="iyf-report iyf-report--index">
  {% assign reports = site.data.reports | sort %}
  {% assign newest = "" %}
  {% for pair in reports %}{% if pair[1].slug and pair[1].generated_at > newest %}{% assign newest = pair[1].generated_at %}{% endif %}{% endfor %}
  <p class="iyf-report__lede">How many people inyourfacecomedy.ch and your campaigns sent to the ticket page, per show. Build tracked links with the <a href="/linkbuilder/">link builder</a>.</p>
  <p class="iyf-report__updated">
    <span class="iyf-badge iyf-badge--muted">Updated daily</span>
    <span>Reports refresh every morning from Google Analytics.{% if newest != "" %} Last update {{ newest | date: "%-d %b %Y, %H:%M" }} UTC.{% endif %}</span>
  </p>

  {% if reports.size > 0 %}
  <div class="iyf-report__table-wrap">
  <table class="iyf-report__table">
    <thead><tr><th>Show</th><th class="iyf-report__num">Clicks, 30 days</th><th class="iyf-report__num">All time</th></tr></thead>
    <tbody>
    {% for pair in reports %}{% assign r = pair[1] %}{% if r.slug %}
      <tr>
        <td><a href="/reports/{{ r.slug }}/">{{ r.title }}</a></td>
        <td class="iyf-report__num">{{ r.totals.clicks_30d }}</td>
        <td class="iyf-report__num">{{ r.totals.clicks }}</td>
      </tr>
    {% endif %}{% endfor %}
    </tbody>
  </table>
  </div>
  {% else %}
  <p class="iyf-report__note">No reports yet. They appear after the first run of <code>script/ga-report.ts</code>.</p>
  {% endif %}
</div>

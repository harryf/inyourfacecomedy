---
layout: page
title: "IN YOUR FACE Comedians — Stand-Up Performers in Zürich"
nav_title: Comedians
title_override: "Comedians"
subtitle: "The performers you'll see at IN YOUR FACE shows."
description: "Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials."
last_modified_at: 2026-05-29T21:21:18+00:00
permalink: /comedians/
image: "/assets/img/thumbs/inyourface_thumb.png"
thumbnail: "assets/img/thumbs/inyourface_thumb.png"
---

{% comment %}
  Order: Priority High → Medium → Low → (unset/unknown), alphabetical within each
  tier. `sort_natural` gives a case-insensitive A→Z base; `where` preserves that
  order inside each tier; `concat` stitches the tiers in priority order. Comedians
  with no/unknown `priority` fall through to `rest` so nobody is ever dropped.
{% endcomment %}
{% assign by_name = site.comedians | sort_natural: "title" %}
{% assign high = by_name | where: "priority", "High" %}
{% assign medium = by_name | where: "priority", "Medium" %}
{% assign low = by_name | where: "priority", "Low" %}
{% assign rest = by_name | where_exp: "c", "c.priority != 'High' and c.priority != 'Medium' and c.priority != 'Low'" %}
{% assign comedians_sorted = high | concat: medium | concat: low | concat: rest %}

{% if comedians_sorted.size > 0 %}
  <ul class="iyf-comedian-grid" role="list">
    {% for comedian in comedians_sorted %}
      <li class="iyf-comedian-grid__item">
        <a class="iyf-comedian-card" href="{{ comedian.url | relative_url }}">
          {% if comedian.photo %}
            <div class="iyf-comedian-card__media">
              <img src="{{ comedian.photo | relative_url }}"
                   alt="{{ comedian.title }}"
                   loading="lazy" />
            </div>
          {% else %}
            <div class="iyf-comedian-card__media iyf-comedian-card__media--placeholder" aria-hidden="true"></div>
          {% endif %}
          <span class="iyf-comedian-card__name">{{ comedian.title }}</span>
        </a>
      </li>
    {% endfor %}
  </ul>
{% else %}
  <p class="iyf-comedian-grid__empty">No comedians published yet — check back soon.</p>
{% endif %}

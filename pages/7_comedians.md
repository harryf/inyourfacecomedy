---
layout: page
title: "IN YOUR FACE Comedians — Stand-Up Performers in Zürich"
nav_title: Comedians
title_override: "Comedians"
subtitle: "The performers you'll see at IN YOUR FACE shows."
description: "Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials."
last_modified_at: 2026-05-30T09:42:44+00:00
permalink: /comedians/
image: "/assets/img/thumbs/comedians_card.png"
thumbnail: "assets/img/thumbs/comedians_card.png"
---

{% comment %}
  Order: Priority High → Medium → Low → (unset/unknown), RANDOM within each tier,
  re-shuffled on every build. `where` splits the tiers; `sample: <size>` shuffles
  each one; `concat` stitches them in priority order. Comedians with no/unknown
  `priority` fall through to `rest` so nobody is ever dropped.

  The `size > 1` guard is load-bearing: Jekyll's `sample` filter returns a single
  element (not an array) when asked for exactly 1, which would break the `concat`.
  A 0- or 1-comedian tier has no order to randomize, so we leave it as-is.
{% endcomment %}
{% assign high = site.comedians | where: "priority", "High" %}
{% assign medium = site.comedians | where: "priority", "Medium" %}
{% assign low = site.comedians | where: "priority", "Low" %}
{% assign rest = site.comedians | where_exp: "c", "c.priority != 'High' and c.priority != 'Medium' and c.priority != 'Low'" %}
{% if high.size > 1 %}{% assign high = high | sample: high.size %}{% endif %}
{% if medium.size > 1 %}{% assign medium = medium | sample: medium.size %}{% endif %}
{% if low.size > 1 %}{% assign low = low | sample: low.size %}{% endif %}
{% if rest.size > 1 %}{% assign rest = rest | sample: rest.size %}{% endif %}
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

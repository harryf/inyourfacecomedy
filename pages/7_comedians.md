---
layout: page
title: "IN YOUR FACE Comedians — Stand-Up Performers in Zürich"
nav_title: Comedians
title_override: "Comedians"
subtitle: "The performers you'll see at IN YOUR FACE shows."
description: "Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials."
last_modified_at: 2026-05-26T07:30:00+00:00
permalink: /comedians/
image: "/assets/img/thumbs/inyourface_thumb.png"
thumbnail: "assets/img/thumbs/inyourface_thumb.png"
---

{% assign comedians_sorted = site.comedians | sort: "title" %}

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

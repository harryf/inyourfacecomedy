---
layout: page
title: "IN YOUR FACE Comedians - Stand-Up Performers in Zürich"
nav_title: Comedians
title_override: "Comedians"
subtitle: "The performers you'll see at IN YOUR FACE shows."
description: "Meet the stand-up comedians who perform at IN YOUR FACE Comedy in Zürich. Bios, photos, and links to their socials."
last_modified_at: 2026-06-07T08:05:04+00:00
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
      <li class="iyf-comedian-grid__item" data-slug="{{ comedian.slug }}">
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
  <p class="iyf-comedian-grid__empty">No comedians published yet - check back soon.</p>
{% endif %}

<p class="iyf-perform-link"><a href="/perform/">Perform yourself &rarr;</a></p>

{% comment %}
  Client-side lineup / show-promo filtering. Share /comedians/ with query params to
  show only a show's bill and promote an EXISTING IYF show:
    ?lineup=harryf.cks,martinadoescomedy,joana             (flat, ordered)
    ?host=harryf.cks&first=joana,nik&second=omar,zeina     (labelled sections)
    ?headliner=woocash&lineup=joana,nik,omar               (featured headliner + rest)
    ?show=brexiles&headliner=woocash&first=joana,nik       (+ show-promo banner)
  The promo banner (name, description, next date, ticket link, show page) is sourced
  ONLY from the build-time catalog below — never from a user-supplied URL — so a
  crafted link can only ever point at one of our own shows. Jekyll ignores the query
  string; assets/js/comedian-lineup.js does all the work in the browser.

  Catalog: every post with a ticket_url, projected to the fields the banner needs.
{% endcomment %}
{% assign iyf_shows = site.posts | where_exp: "p", "p.ticket_url" %}
<script type="application/json" id="iyf-shows">
[{% for s in iyf_shows %}{"slug":{{ s.url | remove: "/" | jsonify }},"title":{{ s.title | jsonify }},"desc":{{ s.description | jsonify }},"url":{{ s.url | jsonify }},"tickets":{{ s.ticket_url | jsonify }},"img":{{ s['feature-img'] | jsonify }},"next":{% if s.next_event_date %}{{ s.next_event_date | date_to_xmlschema | jsonify }}{% else %}""{% endif %}}{% unless forloop.last %},{% endunless %}{% endfor %}]
</script>
<script src="{{ '/assets/js/comedian-lineup.js' | relative_url }}" defer></script>

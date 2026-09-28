---
layout: page
title: "What people are saying about IN YOUR FACE Comedy"
nav_title: Reviews
title_override: "What people are saying"
subtitle: "Five-star reviews of our English stand-up nights in Zürich, from Google"
description: "What audiences say about IN YOUR FACE Comedy, the English stand-up and open mic nights in Zürich: five-star reviews from our Google listing, in their own words."
last_modified_at: 2026-09-28T19:00:00+00:00
permalink: /reviews/
hide: true                                                # off the nav; linked from every review quote, in the sitemap
feature-img: "assets/img/pages/follow.png"
image: "/assets/img/pages/follow.png"
thumbnail: "assets/img/thumbs/inyourface_thumb.png"
---

{%- comment -%}
  Every review here comes from _data/reviews.yml (script/reviews-from-google.rb):
  five stars with text, performers left out. The score line is the true average and
  count over ALL Google reviews. No Review or AggregateRating structured data: Google
  treats a business's own reviews as self-serving. Styles: _review-quote.scss.
{%- endcomment -%}
{%- assign rv = site.data.reviews -%}
<div class="iyf-reviews" markdown="0">
<div class="iyf-reviews__score">
<span class="iyf-reviews__number">{{ rv.average }}</span>
<p class="iyf-reviews__summary">{{ rv.average }} out of 5 from {{ rv.total }} reviews on Google. Below are the five-star reviews people wrote a few words for.</p>
<p class="iyf-reviews__actions"><a href="{{ rv.google_url }}" rel="noopener" target="_blank">Read them all on Google</a><a href="{{ rv.write_url }}" rel="noopener" target="_blank">Been to a show? Write one</a></p>
</div>
<ul class="iyf-reviews__grid" role="list">
{%- for r in rv.reviews -%}
{%- assign anchor = r.id | slice: 0, 12 %}
<li class="iyf-reviews__item">
<figure class="iyf-review iyf-review--full" id="review-{{ anchor }}">
<blockquote class="iyf-review__quote" cite="{{ rv.google_url }}">{% for para in r.paragraphs %}<p>{{ para | escape }}</p>{% endfor %}</blockquote>
<figcaption class="iyf-review__meta">
<span class="iyf-review__stars" role="img" aria-label="5 out of 5 stars">★★★★★</span>
<span class="iyf-review__who">{{ r.author | escape }}, {{ r.month }}</span>
</figcaption>
</figure>
</li>
{%- endfor %}
</ul>
<p class="iyf-reviews__note">Reviews are copied from our Google listing once a day, with the reviewer's first name and initial. We leave out reviews written by comedians who perform with us.</p>
<p class="iyf-reviews__cta"><a class="btn-ticket" href="{{ '/calendar/' | relative_url }}">See the next show</a></p>
</div>

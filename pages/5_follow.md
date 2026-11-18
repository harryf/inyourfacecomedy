---
layout: page
title: "Follow IN YOUR FACE Comedy: Instagram, Meetup, Facebook, Email"
nav_title: Follow
title_override: "IN YOUR FACE Comedy"
hero_eyebrow: "You found us"
subtitle: "English stand-up in Zürich since 2018. Shows every week at ROBIN's near Central."
hero_logo: true
description: "Follow IN YOUR FACE Comedy, the English stand-up club in Zürich: Instagram, Meetup and Facebook for show alerts, the email list, the next three shows and where to leave a review."
last_modified_at: 2026-11-18T14:30:00+00:00
permalink: /follow/
feature-img: "assets/img/pages/follow-hero.jpg"
image: "/assets/img/pages/follow-hero.jpg"
thumbnail: "assets/img/thumbs/inyourface_thumb.png"
---

{%- comment -%}
  /follow/ is the landing page behind every IN YOUR FACE QR code (beermats, flyers, the
  at-show slides), so most visitors arrive on a phone, in the bar, mid-show. Order of the
  page, top to bottom: the three channels we want followed (Instagram first, then Meetup,
  then Facebook), the proof strip, the next three shows (same cards and same rule as the
  home page), the email list, the Google asks, then the rest. One wrapper with
  markdown="0" so kramdown leaves the included card markup alone.
  Styles: _sass/includes/_follow.scss. Footer links to #mc_embed_signup, keep that id.
{%- endcomment -%}

<div class="iyf-follow" markdown="0">

<section class="iyf-follow-top" aria-labelledby="follow-top-heading">
  <h2 id="follow-top-heading" class="iyf-follow-top__title">Follow us, never miss a show</h2>
  <p class="iyf-follow-top__lead">Every lineup, every date, the clips from the night. Pick the one you already check.</p>
  <ul class="iyf-follow-trio" role="list">
    <li>
      <a class="iyf-follow-trio__card iyf-follow-trio__card--first" href="{{ site.social.instagram }}" rel="noopener" target="_blank">
        <span class="iyf-follow-trio__badge">Most active</span>
        <i class="fab fa-instagram" aria-hidden="true"></i>
        <span class="iyf-follow-trio__name">Instagram</span>
        <span class="iyf-follow-trio__note">Lineups, clips and stories from the room</span>
      </a>
    </li>
    <li>
      <a class="iyf-follow-trio__card" href="{{ site.social.meetup }}" rel="noopener" target="_blank">
        <i class="fab fa-meetup" aria-hidden="true"></i>
        <span class="iyf-follow-trio__name">Meetup</span>
        <span class="iyf-follow-trio__note">RSVP to a show and get a reminder the day before</span>
      </a>
    </li>
    <li>
      <a class="iyf-follow-trio__card" href="{{ site.social.facebook }}" rel="noopener" target="_blank">
        <i class="fab fa-facebook" aria-hidden="true"></i>
        <span class="iyf-follow-trio__name">Facebook</span>
        <span class="iyf-follow-trio__note">Every show as an event you can save and share</span>
      </a>
    </li>
  </ul>
</section>

{%- comment -%} The proof strip. Review numbers come from _data/reviews.yml (Google, refreshed by
script/reviews-from-google.rb); the comedian count from the Grist-synced roster. Plain text, never
Review or AggregateRating structured data (see _includes/review-quote.liquid). {%- endcomment -%}
{%- assign follow_reviews = site.data.reviews -%}
{%- assign follow_comedians = site.comedians | size -%}
<ul class="iyf-follow-proof" role="list" aria-label="About IN YOUR FACE Comedy">
  <li><strong>Since 2018</strong><span>English stand-up in Zürich</span></li>
  <li><strong>Every week</strong><span>Comedy Brew, Thursdays at ROBIN's</span></li>
  {%- if follow_reviews and follow_reviews.average -%}
  <li><strong>{{ follow_reviews.average }} <span class="iyf-follow-proof__star" aria-hidden="true">★</span></strong><span>on Google, {{ follow_reviews.total }} reviews</span></li>
  {%- endif -%}
  {%- if follow_comedians > 0 -%}
  <li><strong>{{ follow_comedians }}</strong><span>comedians on our stages</span></li>
  {%- endif -%}
</ul>

{%- comment -%} The next three shows: the home page rule (_layouts/home.liquid), posts with a
next_event_date that is still ahead of the build time, soonest first. {%- endcomment -%}
{%- assign follow_upcoming = site.posts | where_exp: "p", "p.next_event_date" | sort: "next_event_date" -%}
<section class="iyf-follow-shows" aria-labelledby="follow-shows-heading">
  <div class="iyf-section-head">
    <h2 id="follow-shows-heading" class="iyf-section-head__title">Next three shows</h2>
    <p class="iyf-section-head__subtitle">Grab a ticket while you think of it.</p>
  </div>
  {%- if follow_upcoming and follow_upcoming.size > 0 -%}
  <div class="iyf-event-grid">
    {%- assign follow_shown = 0 -%}
    {%- for post in follow_upcoming -%}
      {%- if follow_shown >= 3 -%}{%- break -%}{%- endif -%}
      {%- if post.next_event_date >= site.time -%}
        {% include event-card.liquid post=post %}
        {%- assign follow_shown = follow_shown | plus: 1 -%}
      {%- endif -%}
    {%- endfor -%}
  </div>
  {%- endif -%}
  <p class="iyf-follow-shows__more"><a class="btn-ticket" href="/calendar/">Full calendar</a></p>
</section>

<section class="iyf-follow-email" aria-labelledby="follow-email-heading">
  <h2 id="follow-email-heading">Get show alerts by email</h2>
  <p>One short email when the next show drops. Dates and tickets, nothing else, about once a week.</p>

  <div id="mc_embed_shell">
    <link href="https://cdn-images.mailchimp.com/embedcode/classic-061523.css" rel="stylesheet" type="text/css">
    <style type="text/css">
      #mc_embed_signup { clear: left; font: Source Sans Pro, sans-serif; width: 100%; max-width: 480px; }
    </style>
    <div id="mc_embed_signup">
      <form action="https://facebook.us9.list-manage.com/subscribe/post?u=1f8722669657924e883f3ea8a&amp;id=b3e1ac9105&amp;f_id=001c31e1f0" method="post" id="mc-embedded-subscribe-form" name="mc-embedded-subscribe-form" class="validate" target="_blank">
        <div id="mc_embed_signup_scroll">
          <div class="mc-field-group">
            <label for="mce-EMAIL">Email address</label>
            <input type="email" name="EMAIL" class="required email" id="mce-EMAIL" required="" value="">
            <span id="mce-EMAIL-HELPERTEXT" class="helper_text"></span>
          </div>
          <div hidden="">
            <input type="hidden" name="tags" value="13082575">
          </div>
          <div id="mce-responses" class="clear">
            <div class="response" id="mce-error-response" style="display: none;"></div>
            <div class="response" id="mce-success-response" style="display: none;"></div>
          </div>
          <div aria-hidden="true" style="position: absolute; left: -5000px;">
            <input type="text" name="b_1f8722669657924e883f3ea8a_b3e1ac9105" tabindex="-1" value="">
          </div>
          <div class="clear">
            <input type="submit" name="subscribe" id="mc-embedded-subscribe" class="button" value="Subscribe">
          </div>
        </div>
      </form>
    </div>
    <script type="text/javascript" src="https://s3.amazonaws.com/downloads.mailchimp.com/js/mc-validate.js"></script>
    <script type="text/javascript">(function($) {window.fnames = new Array(); window.ftypes = new Array();fnames[0]='EMAIL';ftypes[0]='email';fnames[1]='FNAME';ftypes[1]='text';fnames[2]='LNAME';ftypes[2]='text';fnames[3]='ADDRESS';ftypes[3]='address';fnames[4]='PHONE';ftypes[4]='phone';fnames[5]='BIRTHDAY';ftypes[5]='birthday';}(jQuery));var $mcj = jQuery.noConflict(true);</script>
  </div>
</section>

<section class="iyf-follow-google" aria-labelledby="follow-google-heading">
  <h2 id="follow-google-heading">Been to a show?</h2>
  <p>A Google review is the single best way to help the next person find us. Thirty seconds, and the comedians read every one.</p>
  <div class="iyf-follow-google__actions">
    <a class="btn-ticket" href="{{ site.gbp_review_url }}" rel="noopener" target="_blank">Leave a Google review</a>
    <a class="btn-ghost" href="{{ site.google_preferred_source_url }}" rel="noopener" target="_blank">Get our shows on Google &rarr;</a>
  </div>
  <p class="iyf-follow-google__note">The second button adds us as a preferred source, so Google shows you our new dates first. One tap, needs a Google sign-in.</p>
</section>

<section class="iyf-follow-more" aria-labelledby="follow-more-heading">
  <h2 id="follow-more-heading">Also on</h2>
  <ul class="iyf-follow-chips" role="list">
    <li><a href="{{ site.social.tiktok }}" rel="noopener" target="_blank"><i class="fab fa-tiktok" aria-hidden="true"></i> TikTok</a></li>
    <li><a href="{{ site.social.youtube }}" rel="noopener" target="_blank"><i class="fab fa-youtube" aria-hidden="true"></i> YouTube</a></li>
    <li><a href="{{ site.tripadvisor_review_url }}" rel="noopener" target="_blank"><i class="fas fa-star" aria-hidden="true"></i> Tripadvisor</a></li>
  </ul>
  <p class="iyf-perform-link"><a href="/perform/">Want to perform? &rarr;</a></p>
</section>

<!-- Mailchimp Connected Sites (popup builder + visitor tracking). Loaded on /follow/ only since this is the only page with a Mailchimp signup form. -->
<script id="mcjs">!function(c,h,i,m,p){m=c.createElement(h),p=c.getElementsByTagName(h)[0],m.async=1,m.src=i,p.parentNode.insertBefore(m,p)}(document,"script","https://chimpstatic.com/mcjs-connected/js/users/1f8722669657924e883f3ea8a/f8e0e816e91b6022f22041286.js");</script>

</div>

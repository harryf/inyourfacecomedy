# Google preferred source

Whether Google's "preferred sources" feature makes sense for inyourfacecomedy.ch, and how to set it up.
This file is an internal dev doc and sits in the `exclude:` list in `_config.yml` like the others.
Reference: https://developers.google.com/search/docs/appearance/preferred-sources

## Verdict: yes, as a fan-loyalty play

The feature: a signed-in Google user can mark a site as a preferred source. Content from that site then
appears more prominently in Top Stories (with a "preferred" label) and also feeds AI Mode and AI Overviews.
Eligibility is domain-level or subdomain-level, so inyourfacecomedy.ch qualifies as-is: no registration,
no markup, and no Search Console setup is required. Google lists the feature as available globally for
Top Stories in every language where Search is available; opting in requires a Google sign-in.

Why it fits us:

- Show announcements are already news-shaped. Every show post is typed `BlogPosting` by jekyll-seo-tag,
  which is exactly the kind of dated content Top Stories surfaces.
- The cost is one link. Google's own docs say the publisher-side methods are optional; the deeplink below
  is all we need.
- It compounds the loyal-fan channel: a fan who opts in keeps seeing our new show dates in their Google
  results, like a follow that never needs another visit.

Honest expectations: this is not an SEO or traffic tactic. The boost only reorders results where we would
already be a candidate, and only for fans who opt in. Value scales with opt-ins, so promoting the link to
fans matters more than the markup. If nobody opts in, it costs nothing to keep.

## Approach: deeplink, not Google's button

Use the plain deeplink:

    https://www.google.com/preferences/source?q=inyourfacecomedy.ch

Skip Google's hosted button. It loads third-party JavaScript (`publisher.js` from news.google.com) on every
page, cannot be styled with our design system, and does nothing the deeplink does not. A plain anchor works
without JavaScript and styles like any other button.

### Implementation (design system, no new components)

The site consumes the design system at `~/Code/personal/inyourface_design_system` as hand-copied SCSS
partials in `_sass/` (tokens in `_sass/base/_variables.scss`, buttons in `_sass/components/_button.scss`).
This change reuses `.btn-ghost`, the standard secondary CTA, so the design system repo is untouched.

1. `_config.yml`: add a top-level key following the `gbp_review_url` pattern:

       google_preferred_source_url: https://www.google.com/preferences/source?q=inyourfacecomedy.ch

2. `pages/5_follow.md`: add a sibling section right after the existing `.hub-google` review block:

       <section class="hub-google-follow" markdown="0">
         <h2>See our shows in your Google</h2>
         <p>Add us as a preferred source and Google puts our new show dates in front of you first.</p>
         <a class="btn-ghost" href="{{ site.google_preferred_source_url }}" rel="noopener" target="_blank">Add us on Google &rarr;</a>
       </section>

3. `_sass/includes/_follow.scss`: add `.hub-google-follow` to the section spacing selector list at the top
   of the file. That is the only CSS change.

4. `_includes/default/footer.liquid`: a third `.btn-ghost` in the `.footer-review` block, between the
   Google review and Tripadvisor buttons. The stacking rule in `_sass/includes/_footer.scss`
   (`.footer-review .btn-ghost`) applies to any number of buttons, so no CSS change:

       <a class="btn-ghost" href="{{ site.google_preferred_source_url }}" rel="noopener" target="_blank">Get our shows on Google &rarr;</a>

   A one-line explainer note under the button shipped initially and was removed the same day as
   clutter; the full pitch lives on /follow/ and Google's landing page explains the rest.

### Button wording

Most visitors have never heard of preferred sources, so the button sells the outcome and skips the
jargon: "Get our shows on Google &rarr;". Button labels stay within the length of the two existing
review buttons (24 characters before the arrow; this one is 23), so the stacked ghosts read as a set.
The /follow/ section names the mechanism ("preferred source") once, so the term
is learnable, and Google's landing page does the rest (it shows our site with an add button). Do not
label the button "Add us as a preferred source": to someone who does not know the feature that reads as
us asking a favour, where the benefit-first label offers them something. The "Like the show? 🫶🥰"
heading still works as the umbrella for all three buttons.

Copy rules: WRITING_GUIDE applies. Ghost buttons carry a literal `&rarr;` in the label (unlike
`.btn-ticket`, which bakes the arrow in), external links get `rel="noopener" target="_blank"`, and never
place a ghost button next to a ticket CTA.

### Rollout

Work on a branch and open a PR: push to master goes live, and Netlify builds a draft of the PR.

1. Branch; make the four changes above.
2. `bundle exec jekyll build --future`, then `ruby script/check-site.rb --no-build` (must exit 0).
3. Visual check with a real browser: the footer at 320/768/1440px on any page, and the /follow/ block.
4. Merge; on the live site, click both new links once and confirm the Google page offers the site.

## Manual steps

1. Test the deeplink while signed in to Google: open
   https://www.google.com/preferences/source?q=inyourfacecomedy.ch and confirm inyourfacecomedy.ch is
   offered. Add it on your own account. Preferences are managed (or removed) at
   https://www.google.com/preferences/source
2. Sanity-check the effect after a new show post: search something we already rank for (for example the
   show name plus Zürich) and look for the "preferred" label in Top Stories.
3. Approve and merge the implementation above (branch and PR as usual; push to master goes live).
4. Promote the link, since the feature does nothing until fans opt in: a newsletter mention, an Instagram
   story, and optionally a QR code on the at-show slides pointing at /follow/. Say it needs a Google
   sign-in, so nobody lands there logged out and thinks the link is broken.
5. After a month or two, check Search Console (Performance, Search appearance) for Top Stories impressions.
   No movement means no harm; the link can stay.

/** /go/ — campaign-link ticket redirector (see docs/campaign-links.md).
 *
 *  Campaign links point here (/go/?show=slug[&date=YYYY-MM-DD]&utm_…) so our GA
 *  sees the click before the visitor is passed to Eventfrog. Resolution happens
 *  ONLY against the build-time #iyf-go-shows / #iyf-go-events catalogs, so the
 *  query string can never name a destination (no open redirect, by construction —
 *  same invariant as comedian-lineup.js).
 *
 *  Resolution:
 *    …&date=YYYY-MM-DD      → that date's own Eventfrog event page (calendar.yml)
 *    show=slug              → the show's NEXT upcoming date's own event page: the
 *                             earliest calendar date after today, or today's until
 *                             its `end` time has passed. Resolved at click time, so
 *                             an evergreen ad link lands on tonight's page until the
 *                             show ends and on next week's page a minute later, with
 *                             nothing to edit on Meta. The per-date page opens on the
 *                             price and the View tickets button; the group page has
 *                             neither (2026-10-14: 694 clicks, 13 orders).
 *    nothing upcoming       → the series-level ticket_url (the Eventfrog group page),
 *                             then the show's page on this site. A past or unknown
 *                             date takes the same chain from the top, so stale links
 *                             degrade gracefully and never 404 on Eventfrog
 *    unknown show slug      → /404.html?from=go&show=<slug>&utm_… — deliberately
 *                             loud, so GA can alert on broken campaign links
 *    …&variant=<id>         → the same chain against the show's ticket VARIANT of
 *                             that id (an alternative Eventfrog listing of the same
 *                             show, declared under `ticket_variants:` on the post;
 *                             its dates come from _data/ticket_variants.yml, its
 *                             group page is the series fallback). A plain link never
 *                             lands on a variant date and a variant link never on a
 *                             main one. An id the post does not declare (experiment
 *                             over, ad still running) falls back to the show's own
 *                             chain, quietly: the visitor still gets tickets, and the
 *                             report still sees `variant=` in the query.
 *
 *  Meta: when _layouts/go.html allows tracking (live host, not notrack) it sets
 *  window.iyfMetaPixel and this script sends the pixel's PageView and a TicketRedirect
 *  custom event straight to Meta's collection endpoint (www.facebook.com/tr/) with
 *  keepalive, the request fbevents.js would make, without loading fbevents.js (432 KB,
 *  slower than the redirect budget: on the ad-click path its queued events were lost,
 *  14 November 2026). The click id Meta appends to ad links (fbclid) becomes the fbc
 *  value the attribution rests on; a first-party _fbp cookie is set the way the
 *  script sets it, so the theme pages and this one share one browser id. Never
 *  delays the redirect.
 *
 *  GA: this file is INLINED into the page by pages/go.md (it lives in _includes/,
 *  not assets/, so there is no separate fetch on the redirect hot path), and
 *  _layouts/go.html carries its own inline gtag config, so the GA pipeline starts
 *  at HTML parse instead of after the theme's deferred main.min.js. We still push
 *  onto window.dataLayer with an arguments helper so the script has no load-order
 *  dependency. The redirect races the event's event_callback against
 *  REDIRECT_DELAY_MS so a blocked/absent GA never strands the visitor. That
 *  constant is the one tuning knob (speed budget: docs/campaign-links.md).
 */
(function () {
  'use strict';

  // The one tuning knob: how long we give GA before redirecting anyway.
  // ~p90 of a gtag dispatch on mediocre 4G; raise if GA undercounts, lower if it annoys.
  var REDIRECT_DELAY_MS = 450;
  var EVENT_TIMEOUT_MS = 400;

  // --- test seam (same pattern as comedian-lineup.js) -------------------------
  // Under bun test `module` exists: export the pure helpers and stop before
  // touching location/DOM. In a browser this block is skipped entirely.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      norm: norm,
      isValidDate: isValidDate,
      localISODate: localISODate,
      primaryTitle: primaryTitle,
      isUpcoming: isUpcoming,
      nextEvent: nextEvent,
      findVariant: findVariant,
      resolveTarget: resolveTarget,
      build404: build404,
      linkTag: linkTag,
      daysToShow: daysToShow,
      showParams: showParams,
      pixelParams: pixelParams,
      newEventId: newEventId,
      metaIds: metaIds,
      metaHitUrl: metaHitUrl
    };
    return;
  }

  // The clicked link's own UTM tags as ONE event parameter, "source|medium|campaign|content",
  // registered in GA as the event-scoped custom dimension `link` (2026-08-30). GA's
  // session-scoped source/campaign stamp whatever opened the session onto every later event,
  // and GA strips utm_* from its page-URL dimensions, so this is the only way a report can say
  // which link was actually clicked. Empty string when the link carries no tags. GA caps
  // event parameter values at 100 characters; longer tags are cut, never dropped.
  function linkTag(p) {
    var parts = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map(function (k) {
      return (p.get(k) || '').trim().replace(/\|/g, '/');
    });
    if (!parts.some(Boolean)) return '';
    return parts.join('|').slice(0, 100);
  }

  function norm(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function isValidDate(s) {
    return /^\d{4}-\d{2}-\d{2}$/.test(s || '');
  }

  // Local date as YYYY-MM-DD — show dates are Zürich-local, and so is the audience.
  function localISODate(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  // First segment of a show title ("Comedy Brew • …" → "Comedy Brew").
  function primaryTitle(t) {
    return (t || '').split(/\s+[•·]\s+|\s+-\s+/)[0].trim();
  }

  /** Is this calendar event still worth sending someone to? Dates after today
   *  always are; today's is until its `end` (ISO with offset, from calendar.yml)
   *  has passed. No parseable `end` on today's event: treat it as still on, the
   *  Eventfrog page itself says "sale ended" if not. Pure. */
  function isUpcoming(e, today, nowMs) {
    if (!isValidDate(e.date)) return false;
    if (e.date > today) return true;
    if (e.date < today) return false;
    var endMs = Date.parse(e.end || '');
    if (isNaN(endMs) || typeof nowMs !== 'number') return true;
    return nowMs < endMs;
  }

  /** Does this calendar event belong to the show, and to the SAME ticket listing
   *  (main when variantId is empty, else that variant)? Pure. */
  function eventMatches(e, show, variantId) {
    return norm(e.show) === norm(show.slug) && norm(e.variant || '') === norm(variantId || '');
  }

  /** The show's earliest upcoming calendar event with a ticket link, or null. Pure.
   *  `variantId` (optional) restricts the search to that ticket variant's dates. */
  function nextEvent(events, show, today, nowMs, variantId) {
    var best = null;
    for (var j = 0; j < events.length; j++) {
      var e = events[j];
      if (!eventMatches(e, show, variantId) || !e.tickets) continue;
      if (!isUpcoming(e, today, nowMs)) continue;
      if (!best || e.date < best.date) best = e;
    }
    return best;
  }

  /** The show's ticket variant with this id, or null (no id, no variants, unknown id). Pure. */
  function findVariant(show, variantParam) {
    var want = norm(variantParam);
    if (!want || !show || !show.variants) return null;
    for (var i = 0; i < show.variants.length; i++) {
      var v = show.variants[i];
      if (v && norm(v.id) === want && v.tickets) return v;
    }
    return null;
  }

  /** Resolve a show/date pair against the catalogs. Pure; `today` (YYYY-MM-DD) and
   *  `nowMs` (epoch ms, for the show-day cut-off) injected for tests. `variantParam`
   *  (optional) picks one of the show's ticket variants; when it names one, every
   *  step below runs against that variant's dates and its group page, and `variant`
   *  is set on the result. An unknown id is ignored (the show's own chain).
   *  Returns {kind: 'event'|'next'|'series'|'showpage', url, show[, event][, variant]} or {kind: 'notfound'}.
   *  Every returned url is catalog data or a same-site path — never query-string input. */
  function resolveTarget(shows, events, showParam, dateParam, today, nowMs, variantParam) {
    var want = norm(showParam);
    if (!want) return { kind: 'notfound' };
    var show = null;
    for (var i = 0; i < shows.length; i++) {
      if (norm(shows[i].slug) === want) { show = shows[i]; break; }
    }
    if (!show) return { kind: 'notfound' };
    var variant = findVariant(show, variantParam);
    var vid = variant ? variant.id : '';
    function out(res) { if (variant) res.variant = variant; return res; }

    // A valid, non-past date → that date's own event page, if the calendar has it.
    if (isValidDate(dateParam) && dateParam >= today) {
      for (var j = 0; j < events.length; j++) {
        var e = events[j];
        if (eventMatches(e, show, vid) && e.date === dateParam && e.tickets) {
          return out({ kind: 'event', url: e.tickets, show: show, event: e });
        }
      }
    }
    // No date, or a stale one → the next upcoming date's own page.
    var next = nextEvent(events, show, today, nowMs, vid);
    if (next) return out({ kind: 'next', url: next.tickets, show: show, event: next });
    if (variant) return out({ kind: 'series', url: variant.tickets, show: show });
    if (show.tickets) return { kind: 'series', url: show.tickets, show: show };
    return { kind: 'showpage', url: show.url || '/calendar/', show: show };
  }

  // Days until the show, bucketed like the Eventfrog sales export ("Purchase Days
  // Before") so GA's click curve can be laid over the purchase curve. Pure: both
  // arguments are YYYY-MM-DD strings. Same buckets in _includes/ga-page-context.liquid
  // and assets/js/ticket-click.js. Labels are zero-padded so GA's alphabetical sort
  // keeps them in order; dimension values are permanent history, never rename them.
  function daysToShow(showDate, today) {
    if (!isValidDate(showDate) || !isValidDate(today)) return '(unknown)';
    var d = Math.round((Date.parse(showDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
    if (d < 0) return 'past';
    if (d <= 1) return '0' + d;
    if (d <= 3) return '02-03';
    if (d <= 7) return '04-07';
    if (d <= 14) return '08-14';
    if (d <= 30) return '15-30';
    return '31+';
  }

  /** Show context for the ticket_redirect event (docs/analytics.md): venue, the date the
   *  click is for (the picked or resolved calendar date, else the show's next date from
   *  its post), days to that date, and the ticket price as both a custom metric and GA's
   *  own value/currency pair. Pure; {} when the show is unknown. */
  function showParams(res, today) {
    if (!res || !res.show) return {};
    var ev = (res.kind === 'event' || res.kind === 'next') ? res.event : null;
    var date = ev ? ev.date : (res.show.next || '').slice(0, 10);
    var price = Number(ev && ev.price != null ? ev.price : res.show.price) || 0;
    return {
      venue: (ev && ev.venue) || res.show.venue || '(unknown)',
      show_date: isValidDate(date) ? date : '(unknown)',
      days_to_show: daysToShow(date, today),
      price_chf: price,
      value: price,
      currency: 'CHF'
    };
  }

  /** Meta pixel payload for the TicketRedirect custom event (docs/campaign-links.md,
   *  "Capturing the UTM tags in GA"). Same facts as the GA event, in the names Meta
   *  reads: content_name/content_ids carry the slug so an audience or a conversion can
   *  be built per show; value/currency let an ad set optimise on ticket price. Pure;
   *  {} when the show is unknown (a broken link is not a ticket intent). */
  function pixelParams(res, params, today) {
    if (!res || !res.show) return {};
    var ctx = showParams(res, today);
    return {
      content_name: res.show.slug,
      content_ids: [res.show.slug],
      content_type: 'product',
      show_date: ctx.show_date,
      days_to_show: ctx.days_to_show,
      price_chf: ctx.price_chf,
      value: ctx.value,
      currency: ctx.currency,
      link: linkTag(params),
      resolution: res.kind,
      variant: res.variant ? res.variant.id : '(none)'
    };
  }

  /** The two browser ids the pixel script would send, read or minted the way
   *  fbevents.js does it. fbp: the _fbp cookie, "fb.1.<ms>.<10 digits>", minted when
   *  absent. fbc: "fb.1.<ms>.<fbclid>" from the click id Meta appends to every ad link,
   *  else the _fbc cookie a previous landing left, else "". Returns the cookie strings
   *  to write (90 days, the registrable domain when the host is ours) so the next page
   *  finds the same ids. Pure: cookie, query and host strings in, nothing touched. */
  function metaIds(cookie, search, nowMs, random, hostname) {
    var jar = {};
    (cookie || '').split(';').forEach(function (part) {
      var eq = part.indexOf('=');
      if (eq > 0) jar[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
    });
    var out = { fbp: jar._fbp || '', fbc: jar._fbc || '', cookies: [] };
    var clickId = '';
    try { clickId = new URLSearchParams(search || '').get('fbclid') || ''; } catch (e) {}
    if (clickId) out.fbc = 'fb.1.' + nowMs + '.' + clickId;
    if (!out.fbp) out.fbp = 'fb.1.' + nowMs + '.' + String(Math.floor((random || Math.random)() * 1e10)).padStart(10, '0');
    var attrs = '; path=/; max-age=7776000; SameSite=Lax' + (/(^|\.)inyourfacecomedy\.ch$/.test(hostname || '') ? '; domain=.inyourfacecomedy.ch' : '');
    if (out.fbp !== jar._fbp) out.cookies.push('_fbp=' + out.fbp + attrs);
    if (out.fbc && out.fbc !== jar._fbc) out.cookies.push('_fbc=' + out.fbc + attrs);
    return out;
  }

  /** The pixel hit as fbevents.js would send it: GET www.facebook.com/tr/ with the pixel
   *  id, the event name, page URL and referrer, the browser ids, the event id for
   *  Conversions API deduplication, and every custom parameter as cd[name] (arrays and
   *  objects as JSON, the shape the script uses). Pure. */
  function metaHitUrl(pixelId, event, cd, ctx) {
    var q = new URLSearchParams();
    q.set('id', String(pixelId));
    q.set('ev', event);
    q.set('dl', ctx.dl || '');
    if (ctx.rl) q.set('rl', ctx.rl);
    q.set('if', 'false');
    q.set('ts', String(ctx.ts || 0));
    if (ctx.fbp) q.set('fbp', ctx.fbp);
    if (ctx.fbc) q.set('fbc', ctx.fbc);
    if (ctx.eid) q.set('eid', ctx.eid);
    Object.keys(cd || {}).forEach(function (k) {
      var v = cd[k];
      if (v === undefined || v === null) return;
      q.set('cd[' + k + ']', typeof v === 'object' ? JSON.stringify(v) : String(v));
    });
    q.set('rqm', 'GET');
    return 'https://www.facebook.com/tr/?' + q.toString();
  }

  /** Fire a hit without waiting for it: keepalive keeps the request alive across the
   *  navigation that follows; an image is the fallback for browsers without it. */
  function sendMetaHit(url) {
    try {
      if (typeof fetch === 'function') { fetch(url, { method: 'GET', mode: 'no-cors', credentials: 'include', keepalive: true }).catch(function () {}); return; }
    } catch (e) {}
    try { new Image().src = url; } catch (e) {}
  }

  /** One id per click, sent as the pixel eventID so a server-side Conversions API
   *  event for the same click (if one is ever added) deduplicates against it. */
  function newEventId() {
    var c = (typeof crypto !== 'undefined') ? crypto : null;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return 'go-' + s;
  }

  /** Broken-link landing: our own 404 with the evidence, UTMs preserved so GA
   *  attributes the breakage to the campaign that carried it. Pure. */
  function build404(search, showParam) {
    var out = new URLSearchParams();
    out.set('from', 'go');
    out.set('show', (showParam || '').slice(0, 64));
    new URLSearchParams(search || '').forEach(function (v, k) {
      if (/^utm_/i.test(k)) out.set(k.toLowerCase(), v);
    });
    return '/404.html?' + out.toString();
  }

  // --- browser flow -----------------------------------------------------------

  function readCatalog(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (err) { return []; }
  }

  var params = new URLSearchParams(window.location.search);
  var showParam = (params.get('show') || '').trim();
  var dateParam = (params.get('date') || '').trim();
  var variantParam = (params.get('variant') || '').trim();
  var now = new Date();
  var today = localISODate(now);

  var res = resolveTarget(
    readCatalog('iyf-go-shows'),
    readCatalog('iyf-go-events'),
    showParam, dateParam, today, now.getTime(), variantParam
  );

  var target = res.kind === 'notfound' ? build404(window.location.search, showParam) : res.url;

  // Visible fallback: a slow or broken script must still leave a tappable way through.
  var link = document.getElementById('go-link');
  var status = document.getElementById('go-status');
  if (link) link.href = target;
  if (status) {
    status.textContent = res.kind === 'notfound'
      ? 'That link does not match a show. One moment...'
      : 'Taking you to tickets for ' + primaryTitle(res.show.title) + '...';
  }

  // gtag()-equivalent: push an Arguments object onto the shared dataLayer.
  function gaPush() { (window.dataLayer = window.dataLayer || []).push(arguments); }

  // debug=1: measure, don't navigate. The GA event still sends; the redirect is
  // replaced by an on-page timing readout (#go-debug), so real-world delay can be
  // sampled in a browser. Never used in campaign links; harmless if a human finds it.
  var debug = params.get('debug') === '1';
  var trigger = null;

  var gone = false;
  function go() {
    if (gone) return;
    gone = true;
    if (debug) { debugReport(); return; }
    window.location.replace(target);
  }

  function debugReport() {
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
    var lines = [
      'debug=1 (no redirect)',
      'target:   ' + target,
      'trigger:  ' + trigger,
      'redirect would fire at ' + Math.round(performance.now()) + 'ms after navigation start',
      nav ? 'ttfb ' + Math.round(nav.responseStart) + 'ms, response end ' + Math.round(nav.responseEnd) + 'ms' : ''
    ];
    if (status) status.textContent = 'Debug mode: staying put.';
    var pre = document.createElement('pre');
    pre.id = 'go-debug';
    pre.textContent = lines.join('\n');
    (document.getElementById('go-redirect') || document.body).appendChild(pre);
  }

  // Ad-blocked GA never sends anything, so waiting for it is pure loss: if the
  // gtag.js script tag errors out (blocked or unreachable), leave immediately
  // instead of sitting out the full REDIRECT_DELAY_MS.
  var gtagScript = document.querySelector('script[src*="googletagmanager.com/gtag/js"]');
  if (gtagScript) {
    gtagScript.addEventListener('error', function () { trigger = trigger || 'gtag_blocked'; go(); });
  }

  var payload = {
    show: res.show ? res.show.slug : '(unknown)',
    link: linkTag(params),
    date: isValidDate(dateParam) ? dateParam : '(series)',
    destination: target,
    resolution: res.kind,
    // Which ticket listing the click went to: the variant id, '(unknown)' when the link
    // named one the post no longer declares, '(none)' for the show's own listing.
    variant: res.variant ? res.variant.id : (variantParam ? '(unknown)' : '(none)'),
    event_callback: function () { trigger = trigger || 'event_callback'; go(); },
    event_timeout: EVENT_TIMEOUT_MS
  };
  var extra = showParams(res, today);
  for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k]; }

  // Meta pixel first, sent directly: _layouts/go.html sets window.iyfMetaPixel when the
  // pixel is on (live host, not notrack). Two keepalive requests of a few hundred bytes,
  // the PageView and the TicketRedirect, go out now and survive the navigation; nothing
  // here waits on them, so a blocked endpoint costs the redirect nothing.
  var pixelId = window.iyfMetaPixel;
  if (pixelId) {
    try {
      var ids = metaIds(document.cookie, window.location.search, now.getTime(), Math.random, window.location.hostname);
      ids.cookies.forEach(function (c) { try { document.cookie = c; } catch (e) {} });
      var ctx = { dl: window.location.href, rl: document.referrer, ts: now.getTime(), fbp: ids.fbp, fbc: ids.fbc };
      sendMetaHit(metaHitUrl(pixelId, 'PageView', {}, ctx));
      var pixel = pixelParams(res, params, today);
      if (pixel.content_name) {
        ctx.eid = newEventId();
        sendMetaHit(metaHitUrl(pixelId, 'TicketRedirect', pixel, ctx));
      }
    } catch (err) {}
  }

  gaPush('event', 'ticket_redirect', payload);
  setTimeout(function () { trigger = trigger || 'timeout(' + REDIRECT_DELAY_MS + 'ms)'; go(); }, REDIRECT_DELAY_MS);
})();

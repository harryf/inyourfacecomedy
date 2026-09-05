/** /go/ — campaign-link ticket redirector (see CAMPAIGN_LINKS.md).
 *
 *  Campaign links point here (/go/?show=slug[&date=YYYY-MM-DD]&utm_…) so our GA
 *  sees the click before the visitor is passed to Eventfrog. Resolution happens
 *  ONLY against the build-time #iyf-go-shows / #iyf-go-events catalogs, so the
 *  query string can never name a destination (no open redirect, by construction —
 *  same invariant as comedian-lineup.js).
 *
 *  Resolution:
 *    show=slug              → the show's series-level ticket_url
 *    …&date=YYYY-MM-DD      → that date's own Eventfrog event page (calendar.yml);
 *                             a past or unknown date falls back to the series link,
 *                             then to the show's page on this site (stale links
 *                             degrade gracefully, they never 404 on Eventfrog)
 *    unknown show slug      → /404.html?from=go&show=<slug>&utm_… — deliberately
 *                             loud, so GA can alert on broken campaign links
 *
 *  GA: this file is INLINED into the page by pages/go.md (it lives in _includes/,
 *  not assets/, so there is no separate fetch on the redirect hot path), and
 *  _layouts/go.html carries its own inline gtag config, so the GA pipeline starts
 *  at HTML parse instead of after the theme's deferred main.min.js. We still push
 *  onto window.dataLayer with an arguments helper so the script has no load-order
 *  dependency. The redirect races the event's event_callback against
 *  REDIRECT_DELAY_MS so a blocked/absent GA never strands the visitor. That
 *  constant is the one tuning knob (speed budget: CAMPAIGN_LINKS.md).
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
      resolveTarget: resolveTarget,
      build404: build404,
      linkTag: linkTag,
      daysToShow: daysToShow,
      showParams: showParams
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

  /** Resolve a show/date pair against the catalogs. Pure; `today` injected for tests.
   *  Returns {kind: 'event'|'series'|'showpage', url, show} or {kind: 'notfound'}.
   *  Every returned url is catalog data or a same-site path — never query-string input. */
  function resolveTarget(shows, events, showParam, dateParam, today) {
    var want = norm(showParam);
    if (!want) return { kind: 'notfound' };
    var show = null;
    for (var i = 0; i < shows.length; i++) {
      if (norm(shows[i].slug) === want) { show = shows[i]; break; }
    }
    if (!show) return { kind: 'notfound' };

    // A valid, non-past date → that date's own event page, if the calendar has it.
    if (isValidDate(dateParam) && dateParam >= today) {
      for (var j = 0; j < events.length; j++) {
        var e = events[j];
        if (norm(e.show) === norm(show.slug) && e.date === dateParam && e.tickets) {
          return { kind: 'event', url: e.tickets, show: show, event: e };
        }
      }
    }
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

  /** Show context for the ticket_redirect event (ANALYTICS.md): venue, the date the
   *  click is for (the picked date, else the show's next date), days to that date,
   *  and the ticket price as both a custom metric and GA's own value/currency pair.
   *  Pure; {} when the show is unknown. */
  function showParams(res, today) {
    if (!res || !res.show) return {};
    var ev = res.kind === 'event' ? res.event : null;
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
  var today = localISODate(new Date());

  var res = resolveTarget(
    readCatalog('iyf-go-shows'),
    readCatalog('iyf-go-events'),
    showParam, dateParam, today
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
    event_callback: function () { trigger = trigger || 'event_callback'; go(); },
    event_timeout: EVENT_TIMEOUT_MS
  };
  var extra = showParams(res, today);
  for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k]; }
  gaPush('event', 'ticket_redirect', payload);
  setTimeout(function () { trigger = trigger || 'timeout(' + REDIRECT_DELAY_MS + 'ms)'; go(); }, REDIRECT_DELAY_MS);
})();

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
 *  GA: window.gtag is NOT global on this site (the config call lives inside the
 *  compiled main.min.js), so we push onto window.dataLayer with an arguments
 *  helper, exactly like gtag() itself does. The redirect races the event's
 *  event_callback against REDIRECT_DELAY_MS so a blocked/absent GA never strands
 *  the visitor. That constant is the one tuning knob (speed budget: CAMPAIGN_LINKS.md).
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
      build404: build404
    };
    return;
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
          return { kind: 'event', url: e.tickets, show: show };
        }
      }
    }
    if (show.tickets) return { kind: 'series', url: show.tickets, show: show };
    return { kind: 'showpage', url: show.url || '/calendar/', show: show };
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

  var res = resolveTarget(
    readCatalog('iyf-go-shows'),
    readCatalog('iyf-go-events'),
    showParam, dateParam, localISODate(new Date())
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

  var gone = false;
  function go() {
    if (gone) return;
    gone = true;
    window.location.replace(target);
  }

  gaPush('event', 'ticket_redirect', {
    show: res.show ? res.show.slug : '(unknown)',
    date: isValidDate(dateParam) ? dateParam : '(series)',
    destination: target,
    resolution: res.kind,
    event_callback: go,
    event_timeout: EVENT_TIMEOUT_MS
  });
  setTimeout(go, REDIRECT_DELAY_MS);
})();

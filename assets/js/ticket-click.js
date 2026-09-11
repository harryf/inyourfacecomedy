/** On-site "Get Tickets" click tracking (see CAMPAIGN_LINKS.md).
 *
 *  Campaign links already reach GA via /go/ (ticket_redirect). Clicks on the site's
 *  own ticket buttons (show pages, home cards, calendar rows, promo hero) go straight
 *  to Eventfrog and would otherwise be invisible. Rather than route them through /go/
 *  (an extra page load on the highest-intent click), this fires one GA event at click
 *  time and lets the navigation proceed untouched:
 *
 *    ticket_click { show, page, destination, transport_type: 'beacon' }
 *
 *  `show` comes from the button's data-show attribute (set in the Liquid templates),
 *  else from the page path. Beacon transport survives the navigation, so no delay,
 *  no callback, no timeout. Only ticket-vendor links count (eventfrog / eventbrite).
 *  gtag() is not global on theme pages (config lives in main.min.js), so we push onto
 *  window.dataLayer with an arguments helper exactly like gtag itself does.
 */
(function () {
  'use strict';

  var VENDOR_RE = /(^|\.)(eventfrog\.ch|eventbrite\.com)$/i;

  function isVendor(href) {
    try { return VENDOR_RE.test(new URL(href, window.location.href).hostname); }
    catch (err) { return false; }
  }

  // Slug of the show a ticket link belongs to, in order of confidence:
  //   1. data-show on the button (the Liquid templates set it);
  //   2. a calendar row: the show-page link in the same <tr> (/calendar/ rows are
  //      plain markdown links, no class and no data attribute);
  //   3. a single-segment page path, i.e. the show page itself.
  function showFor(link) {
    var ds = link.getAttribute('data-show');
    if (ds) return ds;
    var row = link.closest && link.closest('tr');
    if (row) {
      var links = row.querySelectorAll('a[href]');
      for (var i = 0; i < links.length; i++) {
        var m = links[i].getAttribute('href').match(/^(?:https?:\/\/(?:www\.)?inyourfacecomedy\.ch)?\/([a-z0-9-]+)\/?$/i);
        if (m) return m[1];
      }
    }
    var seg = window.location.pathname.split('/').filter(Boolean);
    return seg.length === 1 ? seg[0] : '(unknown)';
  }

  // Days until the show, bucketed like the Eventfrog sales export ("Purchase Days
  // Before"). Same function and buckets as _includes/go-redirect.js. Both arguments
  // are YYYY-MM-DD strings.
  function daysToShow(showDate, today) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(showDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return '(unknown)';
    var d = Math.round((Date.parse(showDate + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
    if (d < 0) return 'past';
    if (d <= 1) return '0' + d;   // zero-padded: GA sorts dimension values alphabetically
    if (d <= 3) return '02-03';
    if (d <= 7) return '04-07';
    if (d <= 14) return '08-14';
    if (d <= 30) return '15-30';
    return '31+';
  }

  // Show context from the button's data attributes (set by the Liquid templates next to
  // data-show): venue slug, the show's next date, ticket price. The three dimension
  // fields are ALWAYS sent, with "(unknown)" when a link carries no attribute (calendar
  // rows): gtag('set') values are sticky for the page, so omitting a field would let a
  // ticket event inherit another show's venue or date. Price is only sent when known.
  // Pure; `today` is YYYY-MM-DD.
  function showParams(link, today) {
    var out = {};
    var venue = link.getAttribute('data-venue');
    var date = link.getAttribute('data-date');
    var price = link.getAttribute('data-price');
    out.venue = venue || '(unknown)';
    out.show_date = date || '(unknown)';
    out.days_to_show = date ? daysToShow(date, today) : '(unknown)';
    if (price !== null && price !== '' && !isNaN(Number(price))) {
      out.price_chf = Number(price);
      out.value = Number(price);
      out.currency = 'CHF';
    }
    return out;
  }

  // Test seam (comedian-lineup.js pattern): expose the pure helpers under bun test.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isVendor: isVendor, showFor: showFor, daysToShow: daysToShow, showParams: showParams };
    return;
  }

  function gaPush() { (window.dataLayer = window.dataLayer || []).push(arguments); }

  function localISODate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  document.addEventListener('click', function (ev) {
    // Styled ticket buttons anywhere, plus the plain "Get Tickets" links in calendar rows.
    var link = ev.target && ev.target.closest && ev.target.closest('a.btn-ticket[href], .iyf-calendar a[href]');
    if (!link || !isVendor(link.href)) return;
    var payload = {
      show: showFor(link),
      page: window.location.pathname,
      destination: link.href,
      transport_type: 'beacon'
    };
    var extra = showParams(link, localISODate(new Date()));
    for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k]; }
    gaPush('event', 'ticket_click', payload);
  }, true);
})();

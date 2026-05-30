/** Comedian lineup / show-promo — client-side filtering of /comedians/ via URL query params.
 *
 *  Jekyll serves the same static page regardless of the query string; this script reads
 *  it and (a) injects a show-promo banner and (b) filters/reorders the comedian cards.
 *
 *  Supported params (all optional):
 *    lineup=slug,slug           flat ordered subset — no section labels
 *    host=slug[,slug]           } structured bill, rendered as labelled sections in
 *    first=slug,slug            } show order: "Host" / "First Half" / "Second Half".
 *    second=slug,slug           } Order within each is appearance order.
 *    title=Show Name            promo-banner heading
 *    date=2026-06-14            promo-banner date (ISO dates are prettified; else shown as-is)
 *    tickets=https://...        "Get tickets" CTA (http/https only — anything else is dropped)
 *
 *  Slug matching is lenient: case-insensitive and separator-insensitive, so `harryf-cks`,
 *  `harryf.cks` and `HARRYF_CKS` all resolve to the same card. Unknown slugs are ignored.
 *  With no lineup params the page is left exactly as rendered (everyone, normal order).
 */
(function () {
  'use strict';

  var COMEDIANS_URL = '/comedians/';
  var params = new URLSearchParams(window.location.search);

  // Comma-split a param into a trimmed, empty-free list.
  function list(name) {
    return (params.get(name) || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  // Normalise a slug for forgiving comparison: lower-case, strip non-alphanumerics.
  function norm(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  var lineup = list('lineup');
  var host = list('host');
  var first = list('first');
  var second = list('second');
  var title = (params.get('title') || '').trim();
  var dateRaw = (params.get('date') || '').trim();
  var tickets = (params.get('tickets') || '').trim();

  var structured = host.length || first.length || second.length;
  var hasLineup = !!(structured || lineup.length);
  var hasBannerInfo = !!(title || dateRaw || tickets);

  // Nothing requested — leave the full, normally-ordered page untouched.
  if (!hasLineup && !hasBannerInfo) return;

  var grid = document.querySelector('.iyf-comedian-grid');
  if (!grid) return;
  var container = grid.parentNode;

  // Index every rendered card by its normalised slug.
  var cardBySlug = {};
  Array.prototype.forEach.call(grid.querySelectorAll('[data-slug]'), function (li) {
    cardBySlug[norm(li.getAttribute('data-slug'))] = li;
  });

  // --- promo banner --------------------------------------------------------
  // tickets is attacker-controllable (anyone can craft a share link), so only
  // accept an explicit http(s) URL — never javascript:/data:/scheme-relative.
  function safeTicketUrl(u) {
    if (!/^https?:\/\//i.test(u)) return null;
    try { return new URL(u).href; } catch (e) { return null; }
  }

  function prettyDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  if (hasBannerInfo) {
    var banner = document.createElement('aside');
    banner.className = 'iyf-lineup-banner show-banner';
    if (title) banner.setAttribute('data-show', norm(title)); // opt into any per-show palette

    var eyebrow = document.createElement('p');
    eyebrow.className = 'iyf-lineup-banner__eyebrow';
    eyebrow.textContent = 'IN YOUR FACE Comedy';
    banner.appendChild(eyebrow);

    if (title) {
      var h1 = document.createElement('h1');
      h1.className = 'iyf-lineup-banner__title';
      h1.textContent = title;                 // textContent — never innerHTML with URL data
      banner.appendChild(h1);
    }
    if (dateRaw) {
      var dateEl = document.createElement('p');
      dateEl.className = 'iyf-lineup-banner__date';
      dateEl.textContent = prettyDate(dateRaw);
      banner.appendChild(dateEl);
    }

    var actions = document.createElement('div');
    actions.className = 'iyf-lineup-banner__actions';
    var ticketHref = tickets ? safeTicketUrl(tickets) : null;
    if (ticketHref) {
      var buy = document.createElement('a');
      buy.className = 'btn-ticket';
      buy.href = ticketHref;
      buy.target = '_blank';
      buy.rel = 'noopener noreferrer';
      buy.textContent = 'Get tickets';
      actions.appendChild(buy);
    }
    var seeAll = document.createElement('a');
    seeAll.className = 'btn-link';
    seeAll.href = COMEDIANS_URL;
    seeAll.textContent = 'See all comedians';
    actions.appendChild(seeAll);
    banner.appendChild(actions);

    container.insertBefore(banner, grid);
  }

  // --- filter / section ----------------------------------------------------
  if (!hasLineup) return; // banner-only promo: keep the full grid below it

  var groups = [];
  if (structured) {
    if (host.length)   groups.push({ label: host.length > 1 ? 'Hosts' : 'Host', slugs: host });
    if (first.length)  groups.push({ label: 'First Half', slugs: first });
    if (second.length) groups.push({ label: 'Second Half', slugs: second });
  } else {
    groups.push({ label: null, slugs: lineup });
  }

  var used = {};
  var missing = [];
  var fragment = document.createDocumentFragment();

  groups.forEach(function (group) {
    var section = document.createElement('section');
    section.className = 'iyf-lineup-section';
    if (group.label) {
      var heading = document.createElement('h2');
      heading.className = 'iyf-lineup-section__title';
      heading.textContent = group.label;
      section.appendChild(heading);
    }
    var ul = document.createElement('ul');
    ul.className = 'iyf-comedian-grid';
    ul.setAttribute('role', 'list');

    var placed = 0;
    group.slugs.forEach(function (slug) {
      var key = norm(slug);
      var card = cardBySlug[key];
      if (!card) { missing.push(slug); return; }
      if (used[key]) return;            // a slug listed twice lands once, first wins
      used[key] = true;
      ul.appendChild(card);             // moves the <li> out of the original grid
      placed++;
    });

    if (placed) {
      section.appendChild(ul);
      fragment.appendChild(section);
    }
  });

  container.insertBefore(fragment, grid);
  grid.remove();                         // drop the now-unwanted (unmatched) cards

  if (missing.length && window.console && console.warn) {
    console.warn('[comedian-lineup] no card found for slug(s): ' + missing.join(', '));
  }
})();

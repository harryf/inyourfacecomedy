/** Comedian lineup / show-promo — client-side filtering of /comedians/ via URL query params.
 *
 *  Jekyll serves the same static page regardless of the query string; this script reads it,
 *  (a) injects a show-promo banner sourced ONLY from the build-time show catalog, and
 *  (b) filters/reorders the comedian cards.
 *
 *  Params (all optional):
 *    show=slug                  promo banner for an EXISTING IYF show (looked up in the
 *                               embedded #iyf-shows catalog). Anti-spam by construction:
 *                               name, description, next date, ticket link and show-page
 *                               link all come from curated site data — never user input.
 *    headliner=slug[,slug]      featured comedian(s), shown first and larger
 *    lineup=slug,slug           flat ordered subset (no section label on its own)
 *    host=slug[,slug]           } structured bill: "Host" / "First Half" / "Second Half",
 *    first=slug,slug            } order within each is appearance order
 *    second=slug,slug           }
 *
 *  Slug matching is case- and separator-insensitive (harryf-cks == harryf.cks). Unknown
 *  comedian slugs are ignored; an unknown show slug shows no banner. With no params the
 *  page is left exactly as rendered (everyone, normal order).
 */
(function () {
  'use strict';

  var COMEDIANS_URL = '/comedians/';
  var params = new URLSearchParams(window.location.search);

  function list(name) {
    return (params.get(name) || '')
      .split(',')
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }
  function norm(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  var showSlug = (params.get('show') || '').trim();
  var headliner = list('headliner');
  var lineup = list('lineup');
  var host = list('host');
  var first = list('first');
  var second = list('second');

  var structured = host.length || first.length || second.length;
  var hasLineup = !!(headliner.length || lineup.length || structured);

  // --- resolve the show from the build-time catalog (the ONLY promo source) ---
  var shows = [];
  var dataEl = document.getElementById('iyf-shows');
  if (dataEl) {
    try { shows = JSON.parse(dataEl.textContent) || []; } catch (e) { shows = []; }
  }
  function findShow(slug) {
    var key = norm(slug);
    for (var i = 0; i < shows.length; i++) {
      if (norm(shows[i].slug) === key) return shows[i];
    }
    return null;
  }
  var show = showSlug ? findShow(showSlug) : null;
  if (showSlug && !show && window.console && console.warn) {
    console.warn('[comedian-lineup] unknown show slug: ' + showSlug);
  }

  // Nothing actionable — leave the full, normally-ordered page untouched.
  if (!hasLineup && !show) return;

  var grid = document.querySelector('.iyf-comedian-grid');
  if (!grid) return;
  var container = grid.parentNode;

  var cardBySlug = {};
  Array.prototype.forEach.call(grid.querySelectorAll('[data-slug]'), function (li) {
    cardBySlug[norm(li.getAttribute('data-slug'))] = li;
  });

  // --- promo banner (only ever from curated show data) --------------------
  // Defence in depth: even though the URL is curated, never emit a non-http(s) href.
  function safeUrl(u) {
    if (!u || !/^https?:\/\//i.test(u)) return null;
    try { return new URL(u).href; } catch (e) { return null; }
  }
  function prettyFutureDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    // Drop a stale (past) next-date rather than advertising a show that already happened.
    if (d.getTime() < Date.now() - 12 * 3600 * 1000) return null;
    return d.toLocaleDateString(undefined, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  if (show) {
    // Replace the generic hero ("Comedians" / "the performers you'll see…") with the show.
    var heroTitle = document.querySelector('.iyf-hero__title');
    var heroSub = document.querySelector('.iyf-hero__subtitle');
    if (heroTitle) heroTitle.style.display = 'none';
    if (heroSub) heroSub.style.display = 'none';

    var banner = document.createElement('aside');
    banner.className = 'iyf-lineup-banner show-banner';
    banner.setAttribute('data-show', norm(show.slug)); // opt into the per-show palette

    var eyebrow = document.createElement('p');
    eyebrow.className = 'iyf-lineup-banner__eyebrow';
    eyebrow.textContent = 'IN YOUR FACE Comedy';
    banner.appendChild(eyebrow);

    var h1 = document.createElement('h1');
    h1.className = 'iyf-lineup-banner__title';
    h1.textContent = show.title || 'IN YOUR FACE';
    banner.appendChild(h1);

    if (show.desc) {
      var desc = document.createElement('p');
      desc.className = 'iyf-lineup-banner__desc';
      desc.textContent = show.desc;
      banner.appendChild(desc);
    }

    var when = prettyFutureDate(show.next);
    if (when) {
      var dateEl = document.createElement('p');
      dateEl.className = 'iyf-lineup-banner__date';
      dateEl.textContent = 'Next: ' + when;
      banner.appendChild(dateEl);
    }

    var actions = document.createElement('div');
    actions.className = 'iyf-lineup-banner__actions';
    var ticketHref = safeUrl(show.tickets);
    if (ticketHref) {
      var buy = document.createElement('a');
      buy.className = 'btn-ticket';
      buy.href = ticketHref;
      buy.target = '_blank';
      buy.rel = 'noopener noreferrer';
      buy.textContent = 'Get tickets';
      actions.appendChild(buy);
    }
    if (show.url) {
      var more = document.createElement('a');
      more.className = 'btn-link';
      more.href = show.url;                 // internal show page — same origin
      more.textContent = 'About this show';
      actions.appendChild(more);
    }
    var seeAll = document.createElement('a');
    seeAll.className = 'btn-link';
    seeAll.href = COMEDIANS_URL;
    seeAll.textContent = 'See all comedians';
    actions.appendChild(seeAll);
    banner.appendChild(actions);

    container.insertBefore(banner, grid);
  }

  // --- filter / section ---------------------------------------------------
  if (!hasLineup) return; // show banner over the full roster

  var groups = [];
  if (headliner.length) {
    groups.push({
      label: headliner.length > 1 ? 'Headliners' : 'Headliner',
      slugs: headliner, headliner: true
    });
  }
  if (structured) {
    if (host.length)   groups.push({ label: host.length > 1 ? 'Hosts' : 'Host', slugs: host });
    if (first.length)  groups.push({ label: 'First Half', slugs: first });
    if (second.length) groups.push({ label: 'Second Half', slugs: second });
  } else if (lineup.length) {
    groups.push({ label: headliner.length ? 'Line-up' : null, slugs: lineup });
  }

  var used = {};
  var missing = [];
  var fragment = document.createDocumentFragment();

  groups.forEach(function (group) {
    var section = document.createElement('section');
    section.className = 'iyf-lineup-section' + (group.headliner ? ' iyf-lineup-section--headliner' : '');
    if (group.label) {
      var heading = document.createElement('h2');
      heading.className = 'iyf-lineup-section__title';
      heading.textContent = group.label;
      section.appendChild(heading);
    }
    var ul = document.createElement('ul');
    ul.className = 'iyf-comedian-grid' + (group.headliner ? ' iyf-comedian-grid--headliner' : '');
    ul.setAttribute('role', 'list');

    var placed = 0;
    group.slugs.forEach(function (slug) {
      var key = norm(slug);
      var card = cardBySlug[key];
      if (!card) { missing.push(slug); return; }
      if (used[key]) return;          // listed twice → placed once, first wins
      used[key] = true;
      ul.appendChild(card);           // moves the <li> out of the original grid
      placed++;
    });

    if (placed) {
      section.appendChild(ul);
      fragment.appendChild(section);
    }
  });

  container.insertBefore(fragment, grid);
  grid.remove();                       // drop the now-unwanted (unmatched) cards

  if (missing.length && window.console && console.warn) {
    console.warn('[comedian-lineup] no card found for slug(s): ' + missing.join(', '));
  }
})();

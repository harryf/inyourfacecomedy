/** Comedian lineup / show-promo — client-side filtering of /comedians/ via URL query params.
 *
 *  Jekyll serves the same static page regardless of the query string; this script reads it,
 *  (a) transforms the page's own #main hero into a show hero (so a shared ?show= link reads
 *      like the show's own page — background image, dim scrim, short date, split title,
 *      ticket button), sourced ONLY from the build-time #iyf-shows catalog, and
 *  (b) filters/reorders the comedian cards into the show's bill.
 *
 *  Params (all optional):
 *    show=slug                  promo hero for an EXISTING IYF show (looked up in the
 *                               embedded #iyf-shows catalog). Anti-spam by construction:
 *                               title, next date, ticket link, show page and feature image
 *                               all come from curated site data — never user input.
 *    thankyou                   after-show mode (pair with show=). The hero styling is
 *                               unchanged; only the lead-in copy and the two buttons swap:
 *                               button 1 (btn-ticket--xl) becomes a follow/review CTA that
 *                               scrolls to the site footer, button 2 (btn-ghost--on-dark)
 *                               becomes "More Shows" → homepage. Treated as on when present
 *                               unless its value is 0/false/no/off.
 *    headliner=slug[,slug]      featured comedian(s), shown first and larger
 *    lineup=slug,slug           flat ordered subset (no section label on its own)
 *    host=slug[,slug]           } structured bill: "Host" / "First Half" / "Second Half",
 *    first=slug,slug            } order within each is appearance order
 *    second=slug,slug           }
 *
 *  Slug matching is case- and separator-insensitive (harryf-cks == harryf.cks). Unknown
 *  comedian slugs are ignored; an unknown show slug shows no hero change. With no params the
 *  page is left exactly as rendered (everyone, normal order, normal "Comedians" hero).
 */
(function () {
  'use strict';

  // Weekday/month abbreviations to mirror Jekyll's `%a · %e %b` date filter on the show
  // pages exactly (English, e.g. "Wed · 17 Jun") rather than a locale-dependent string.
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
  // After-show mode: on when the param is present, unless explicitly disabled.
  var thankyou = params.has('thankyou') &&
    !/^(0|false|no|off)$/i.test((params.get('thankyou') || '').trim());
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

  // --- validators (defence in depth, even though show data is curated) --------
  function safeUrl(u) {
    if (!u || !/^https?:\/\//i.test(u)) return null;
    try { return new URL(u).href; } catch (e) { return null; }
  }
  // Only same-origin asset paths — no scheme, no protocol-relative, known image suffix.
  function safeImg(u) {
    if (!u || typeof u !== 'string') return null;
    if (/^(https?:)?\/\//i.test(u)) return null;     // reject absolute / //host
    if (u.indexOf(':') !== -1) return null;          // reject any scheme (javascript:, data:)
    var path = u.charAt(0) === '/' ? u : '/' + u;    // feature-img may omit the leading slash
    if (!/^\/assets\/[\w\-./]+\.(png|jpe?g|webp|gif|avif)$/i.test(path)) return null;
    return path;
  }
  function showDate(iso) {
    if (!iso) return null;
    var d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    // Drop a stale (past) next-date rather than advertising a show that already happened.
    if (d.getTime() < Date.now() - 12 * 3600 * 1000) return null;
    return WD[d.getDay()] + ' · ' + d.getDate() + ' ' + MO[d.getMonth()];
  }
  // Mirror post.liquid's title-split contract: normalize ' - ' to ' • ', split on '•';
  // first segment is the title, the rest collapse into a ' · '-joined subtitle.
  function splitTitle(title) {
    var normalized = (title || '').replace(/ - /g, ' • ');
    var parts = normalized.split('•').map(function (s) { return s.trim(); }).filter(Boolean);
    return {
      primary: parts[0] || 'IN YOUR FACE',
      secondary: parts.length > 1 ? parts.slice(1).join(' · ') : ''
    };
  }
  // Smoothly scroll to the site footer (where follow links + reviews live).
  function scrollToFooter(e) {
    var footer = document.getElementById('footer');
    if (!footer) return;                  // no footer → let the #footer anchor do its thing
    if (e && e.preventDefault) e.preventDefault();
    try { footer.scrollIntoView({ behavior: 'smooth' }); }
    catch (err) { footer.scrollIntoView(); }
  }

  // --- transform the page's own #main hero into the show hero -----------------
  if (show) {
    var hero = document.getElementById('main');
    if (hero) {
      hero.classList.remove('iyf-hero--compact');
      hero.classList.add('iyf-hero--dim', 'show-banner');
      hero.setAttribute('data-show', norm(show.slug)); // opt into the per-show CTA palette
      // Dark base so cream hero text stays readable even if the image 404s or is absent.
      hero.style.backgroundColor = 'var(--show-bg)';
      var img = safeImg(show.img);
      if (img) hero.style.backgroundImage = "url('" + img + "')";

      hero.textContent = ''; // drop the generic "Comedians" / subtitle

      var when = showDate(show.next);
      if (when) {
        var eyebrow = document.createElement('p');
        eyebrow.className = 'iyf-hero__eyebrow';
        eyebrow.textContent = when;
        hero.appendChild(eyebrow);
      }

      var t = splitTitle(show.title);
      var h1 = document.createElement('h1');
      h1.className = 'iyf-hero__title';
      h1.textContent = t.primary;
      hero.appendChild(h1);

      var subText = t.secondary || show.desc || '';
      if (subText) {
        var sub = document.createElement('p');
        sub.className = 'iyf-hero__subtitle';
        sub.textContent = subText;
        hero.appendChild(sub);
      }

      var actions = document.createElement('div');
      actions.className = 'iyf-hero__actions';
      if (thankyou) {
        // After-show: same hero styling, but the CTAs point at "stay connected".
        var follow = document.createElement('a');
        follow.className = 'btn-ticket btn-ticket--xl';
        follow.href = '#footer';
        follow.textContent = 'Follow us & drop a review';
        follow.addEventListener('click', scrollToFooter);
        actions.appendChild(follow);

        var moreShows = document.createElement('a');
        moreShows.className = 'btn-ghost btn-ghost--on-dark';
        moreShows.href = '/';                  // homepage — same origin
        moreShows.textContent = 'More Shows';
        actions.appendChild(moreShows);
      } else {
        var ticketHref = safeUrl(show.tickets);
        if (ticketHref) {
          var buy = document.createElement('a');
          buy.className = 'btn-ticket btn-ticket--xl';
          buy.href = ticketHref;
          buy.target = '_blank';
          buy.rel = 'noopener noreferrer';
          buy.textContent = 'Get Tickets';
          actions.appendChild(buy);
        }
        if (show.url) {
          var more = document.createElement('a');
          more.className = 'btn-ghost btn-ghost--on-dark';
          more.href = show.url;                 // internal show page — same origin
          more.textContent = 'About this show';
          actions.appendChild(more);
        }
      }
      if (actions.childNodes.length) hero.appendChild(actions);
    }
  }

  // --- filter / section ---------------------------------------------------
  if (!hasLineup) return; // show hero over the full roster

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

  // Lead-in heading that teases the bill below the show hero.
  if (show) {
    var leadin = document.createElement('h2');
    leadin.className = 'iyf-lineup-leadin';
    leadin.textContent = thankyou ? 'Go give your favourites a follow' : "Who's on the show?";
    fragment.appendChild(leadin);
  }

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

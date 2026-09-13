/** Lineup Maker 2000 - a URL-state power tool for IN YOUR FACE show organizers.
 *
 *  Everything lives in the query string (no auth, no storage). The state vocabulary is the
 *  SAME one the /comedians/ show-promo links use, so a Lineup Maker 2000 URL and a promo URL are the
 *  same data at two paths:
 *
 *    show=slug        the show (resolved against the build-time #iyf-shows catalog)
 *    type=flat|split  one set, or two halves with an interval        (Lab-only helper)
 *    stage=show|format|pick|order   which wizard step to render      (Lab-only helper)
 *    host=slug        the MC (its own slot - not numbered in the running order)
 *    headliner=slug   the closer (kept IN the running order, just flagged)
 *    lineup=slug,…    running order for a one-set show
 *    first=slug,…     } running order for a two-half show
 *    second=slug,…    }
 *
 *  Comedians and shows come ONLY from the two embedded JSON catalogs, so a crafted link can
 *  never invent a comedian or a show (same anti-spam invariant as the promo page). Every
 *  stage transition reloads the page and rehydrates from the URL - the rendered state can
 *  never disagree with the link you'd share.
 */
(function () {
  'use strict';

  var INTERVAL = '::interval::';
  var GUEST_PREFIX = 'guest:';   // off-catalog "guest" acts ride in the URL as guest:Their Name
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Where the week story sends people: the calendar, tagged so the reports see the story traffic
  // (CAMPAIGN_LINKS.md vocabulary). Defined above the test seam because exported helpers read it.
  var WEEK_CAL_LINK = 'https://inyourfacecomedy.ch/calendar/?utm_source=instagram&utm_medium=social&utm_campaign=week';
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // --- test seam --------------------------------------------------------------
  // In a CommonJS/test context (bun test) `module` exists: export the stateless
  // pure helpers for fast unit assertions and stop before reading the DOM. In a
  // browser there is no `module`, so this block is skipped and the wizard runs
  // exactly as before (the function declarations below are hoisted, so they are
  // already callable here). Catalog/stage/render behavior is covered by
  // integration tests that run the whole IIFE against a fixture via new Function(src).
  if (typeof module !== 'undefined' && module.exports) {
    // These MUST stay `function name(){}` declarations (they are hoisted across this early
    // return). Converting any to `var x = function(){}` makes the export undefined and
    // silently breaks the unit tests. dayLabel/faceScale/flyerSpec/ticketSerial are defined far below.
    module.exports = {
      norm: norm, splitTitle: splitTitle, showDate: showDate,
      dayLabel: dayLabel, flyerDate: flyerDate, faceScale: faceScale, flyerSpec: flyerSpec,
      ticketSerial: ticketSerial, ticketPalettes: ticketPalettes, ticketPalette: ticketPalette,
      lavaSeeds: lavaSeeds, caseNumber: caseNumber, contrastRatio: contrastRatio, newStylePairs: newStylePairs,
      showCode: showCode, chargeLines: chargeLines, chargeLine: chargeLine, firstName: firstName, adcardStyles: adcardStyles,
      stubLines: stubLines, stubLine: stubLine,
      weekWindow: weekWindow, weekEvents: weekEvents, weekHeadlines: weekHeadlines, weekCopy: weekCopy,
      weekHandles: weekHandles, weekHandlesText: weekHandlesText, weekCaption: weekCaption, weekCalLink: function () { return WEEK_CAL_LINK; },
      weekIsoWeek: weekIsoWeek, weekComicLayout: weekComicLayout, flapLines: flapLines, weekComicWeight: weekComicWeight, weekMenuPrice: weekMenuPrice, showTagline: showTagline, weekDateBoard: weekDateBoard, weekInfoFor: weekInfoFor, stripEmoji: stripEmoji, weekInfoLines: weekInfoLines, weekVenueShort: weekVenueShort,
      isGuest: isGuest, guestName: guestName, guestToken: guestToken, instaHandle: instaHandle
    };
    return;
  }

  var root = document.getElementById('lineup-lab');
  var weekRoot = document.getElementById('iyf-week');   // the /week/ page shares this script
  var adRoot = document.getElementById('iyf-adcard');   // the /adcard/ page too (the Meta ads bank)
  if (!root && !weekRoot && !adRoot) return;

  // --- catalogs (the only source of shows + comedians) ----------------------
  function parseCatalog(id) {
    var elx = document.getElementById(id);
    if (!elx) return [];
    try { return JSON.parse(elx.textContent) || []; } catch (e) { return []; }
  }
  var SHOWS = parseCatalog('iyf-shows');
  var COMEDIANS = parseCatalog('iyf-comedians');
  // Audience photos for the ticket style's field, built in Liquid from _data/gallery.yml
  // (type audience, 4+ faces, aesthetic >= 0.45). Empty on pages without the list.
  var BACKDROPS = parseCatalog('iyf-backdrops');
  // A different crowd every render (deliberately random, unlike the paper, which is
  // per show): re-opening the flyer or switching format gives a fresh backdrop.
  function pickBackdrop() {
    if (!BACKDROPS.length) return '';
    var b = BACKDROPS[Math.floor(Math.random() * BACKDROPS.length)];
    return (b && b.src) || '';
  }

  function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  var enc = encodeURIComponent;

  // --- guest (off-catalog) acts ---------------------------------------------
  // Organizers can add names that aren't in the comedian catalog. They ride in the URL
  // as `guest:Their Name`, show up in the running order + the copied text, but are
  // deliberately kept OFF the generated flyer (no photo, informal). The `guest:` prefix
  // can't collide with a catalog slug (slugs are [a-z0-9.-], never a colon). Detection is
  // on the literal prefix, NOT on norm() (which would strip the colon).
  function isGuest(token) { return /^guest:/i.test(token || ''); }
  function guestName(token) { return isGuest(token) ? String(token).slice(GUEST_PREFIX.length).trim() : ''; }
  function guestToken(name) {
    // commas are the URL list separator and whitespace runs break layout - collapse both.
    var clean = String(name == null ? '' : name).replace(/[\s,]+/g, ' ').trim();
    return clean ? GUEST_PREFIX + clean : '';
  }

  // Instagram @handle from a comedian's `instagram` value. The handle comes from the URL
  // (e.g. .../elrudysanchez), NOT the website slug, which is often different. Keys on the
  // instagram.com host so other socials (tiktok/x) never misparse; tolerates a trailing
  // slash, query/hash tail, www., or a value that's already a bare "@handle"/"handle".
  function instaHandle(url) {
    if (!url) return '';
    var s = String(url).trim();
    var m = s.match(/instagram\.com\/+([^\/?#\s]+)/i);
    if (m) return m[1].replace(/^@/, '');
    if (/^https?:/i.test(s)) return '';            // some other URL - not an instagram handle
    return s.replace(/^@/, '').replace(/[\/?#\s].*$/, '');  // bare handle fallback
  }

  var byShow = {};
  SHOWS.forEach(function (s) { byShow[norm(s.slug)] = s; });
  function findShow(slug) { return byShow[norm(slug)] || null; }

  var byComedian = {};
  COMEDIANS.forEach(function (c) { byComedian[norm(c.slug)] = c; });
  function findComedian(slug) { return byComedian[norm(slug)] || null; }
  function nameOf(slug) { if (isGuest(slug)) return guestName(slug); var c = findComedian(slug); return c ? c.name : slug; }
  function urlOf(slug) { var c = findComedian(slug); return c ? c.url : null; }   // guests have no profile (findComedian null)
  function canonical(slug) { if (isGuest(slug)) return guestToken(guestName(slug)); var c = findComedian(slug); return c ? c.slug : null; }
  // resolve a slug list to CANONICAL catalog slugs, dropping anything not in the catalog
  function resolveSlugs(arr) {
    var out = [], seen = {};
    arr.forEach(function (s) { var c = findComedian(s); if (c && !seen[norm(c.slug)]) { seen[norm(c.slug)] = 1; out.push(c.slug); } });
    return out;
  }
  // Like resolveSlugs, but PRESERVES guest tokens (off-catalog acts). Used everywhere the
  // bill IS the running order; the flyer path stays on resolveSlugs so guests never render.
  function resolveBill(arr) {
    var out = [], seen = {};
    arr.forEach(function (s) {
      if (isGuest(s)) {
        var g = guestName(s), gk = 'guest:' + norm(g);
        if (g && !seen[gk]) { seen[gk] = 1; out.push(guestToken(g)); }
        return;
      }
      var c = findComedian(s);
      if (c && !seen[norm(c.slug)]) { seen[norm(c.slug)] = 1; out.push(c.slug); }
    });
    return out;
  }
  // Slug-membership test that's tolerant of separator differences (harryf.cks == harryf-cks).
  function hasNorm(arr, slug) {
    var k = norm(slug);
    for (var i = 0; i < arr.length; i++) { if (norm(arr[i]) === k) return true; }
    return false;
  }
  function dropNorm(arr, slug) {
    var k = norm(slug);
    return arr.filter(function (s) { return norm(s) !== k; });
  }

  function showDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return WD[d.getDay()] + ' · ' + d.getDate() + ' ' + MO[d.getMonth()];
  }
  function splitTitle(t) {
    var parts = (t || '').replace(/ - /g, ' • ').split('•')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    return parts[0] || t || '';
  }

  // --- read state from the URL ----------------------------------------------
  var params = new URLSearchParams(window.location.search);
  function listParam(name) {
    return (params.get(name) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  var state = {
    show: (params.get('show') || '').trim(),
    type: (params.get('type') || '').trim().toLowerCase(),
    host: (params.get('host') || '').trim(),
    headliner: listParam('headliner'),
    lineup: listParam('lineup'),
    first: listParam('first'),
    second: listParam('second'),
    stage: (params.get('stage') || '').trim().toLowerCase()
  };
  var show = state.show ? findShow(state.show) : null;
  if (state.type !== 'flat' && state.type !== 'split') {
    state.type = (state.first.length || state.second.length) ? 'split' : 'flat';
  }

  function inferStage() {
    if (!show) return 'show';
    var hasBill = state.lineup.length || state.first.length || state.second.length;
    if (hasBill) return 'order';
    if (params.get('type')) return 'pick';
    return 'format';
  }

  // --- URL builders ----------------------------------------------------------
  function origin() { return (root || weekRoot || adRoot).getAttribute('data-origin') || window.location.origin; }
  function billParts(st) {
    var parts = [];
    if (st.type === 'split') {
      if (st.first.length) parts.push('first=' + st.first.map(enc).join(','));
      if (st.second.length) parts.push('second=' + st.second.map(enc).join(','));
    } else if (st.lineup.length) {
      parts.push('lineup=' + st.lineup.map(enc).join(','));
    }
    return parts;
  }
  function labQuery(st, stage) {
    var parts = [];
    if (st.show) parts.push('show=' + enc(st.show));
    if (st.type) parts.push('type=' + enc(st.type));
    if (st.host) parts.push('host=' + enc(st.host));
    if (st.headliner.length) parts.push('headliner=' + st.headliner.map(enc).join(','));
    parts = parts.concat(billParts(st));
    if (stage) parts.push('stage=' + enc(stage));
    return parts.join('&');
  }
  function promoQuery(st) {
    var parts = [];
    if (st.show) parts.push('show=' + enc(st.show));
    if (st.headliner.length) parts.push('headliner=' + st.headliner.map(enc).join(','));
    if (st.host) parts.push('host=' + enc(st.host));
    parts = parts.concat(billParts(st));
    return parts.join('&');
  }
  function absLab(st) { return origin() + '/lineup/?' + labQuery(st, 'order'); }
  function absPromo(st, thankyou) { return origin() + '/comedians/?' + promoQuery(st) + (thankyou ? '&thankyou' : ''); }

  // Reload-driven stage transition. Exposes the target on window for tests.
  function go(st, stage) {
    var url = window.location.pathname + '?' + labQuery(st, stage);
    try { window.__lineupMakerLastURL = url; } catch (e) { /* read-only env */ }
    try { window.location.href = url; } catch (e) { /* jsdom: navigation not implemented */ }
  }

  function plainText(st) {
    var s = findShow(st.show);
    var lines = [];
    var title = s ? splitTitle(s.title) : (st.show || 'Lineup');
    var when = s ? showDate(s.next) : '';
    lines.push('🎤 ' + title + (when ? (' - ' + when) : ''));
    if (st.host) lines.push('Host: ' + nameOf(st.host));
    lines.push('');
    var n = 0;
    function actLine(slug) {
      n++;
      var extra = hasNorm(st.headliner, slug) ? ' ⭐ (headliner)' : '';
      return n + '. ' + nameOf(slug) + extra;
    }
    if (st.type === 'split') {
      lines.push('First half:');
      st.first.forEach(function (sl) { lines.push(actLine(sl)); });
      lines.push('');
      lines.push('BREAK');
      lines.push('');
      lines.push('Second half:');
      st.second.forEach(function (sl) { lines.push(actLine(sl)); });
    } else {
      st.lineup.forEach(function (sl) { lines.push(actLine(sl)); });
    }
    return lines.join('\n');
  }

  // --- clipboard (with mobile/legacy fallback) -------------------------------
  function fallbackCopy(text, done) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'absolute';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      done(!!ok);
    } catch (e) { done(false); }
  }
  function copy(text, statusEl) {
    function done(ok) { if (statusEl) statusEl.textContent = ok ? 'Copied!' : 'Press ⌘/Ctrl+C'; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { fallbackCopy(text, done); });
    } else {
      fallbackCopy(text, done);
    }
  }

  // --- tiny DOM helpers ------------------------------------------------------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(cls, text) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function showLabel() { return show ? splitTitle(show.title) : (state.show || ''); }

  function header(sub) {
    var h = el('header', 'lineup-lab__head');
    var row = el('div', 'lineup-lab__titlerow');
    row.appendChild(el('h1', 'lineup-lab__title', '🎤 Lineup Maker 2000'));
    var manual = el('a', 'lineup-lab__manual', '📖 Manual');
    manual.href = '/lineup-maker-2000-manual/';
    manual.target = '_blank';
    manual.rel = 'noopener';
    manual.setAttribute('aria-label', 'Open the Lineup Maker 2000 manual in a new tab');
    row.appendChild(manual);
    h.appendChild(row);
    if (sub) h.appendChild(el('p', 'lineup-lab__sub', sub));
    return h;
  }
  function stepper(active) {
    var steps = [['show', 'Show'], ['format', 'Format'], ['pick', 'Comedians'], ['order', 'Order']];
    var ol = el('ol', 'lineup-lab__steps');
    ol.setAttribute('role', 'list');
    steps.forEach(function (p) {
      ol.appendChild(el('li', 'lineup-lab__step' + (p[0] === active ? ' is-active' : ''), p[1]));
    });
    return ol;
  }
  function backLink(stage) {
    var b = button('lineup-lab__back', '← Back');
    b.addEventListener('click', function () { go(state, stage); });
    return b;
  }

  // =========================================================================
  // Stage 1 - pick the show
  // =========================================================================
  function renderShowPicker() {
    root.appendChild(header('Pick the show you’re building a lineup for.'));
    root.appendChild(stepper('show'));
    if (!SHOWS.length) { root.appendChild(el('p', 'lineup-lab__empty', 'No shows found.')); return; }
    var ul = el('ul', 'lineup-lab__shows');
    ul.setAttribute('role', 'list');
    // Soonest upcoming show first; shows with no next date sink to the bottom.
    var ordered = SHOWS.slice().sort(function (a, b) {
      var ta = Date.parse(a.next), tb = Date.parse(b.next);
      if (isNaN(ta)) ta = Infinity;
      if (isNaN(tb)) tb = Infinity;
      return ta - tb;
    });
    ordered.forEach(function (s) {
      var li = el('li', 'lineup-lab__show-item');
      var b = button('lineup-lab__show-btn');
      b.appendChild(el('span', 'lineup-lab__show-name', splitTitle(s.title)));
      var when = showDate(s.next);
      if (when) b.appendChild(el('span', 'lineup-lab__show-date', when));
      b.addEventListener('click', function () {
        go({ show: s.slug, type: '', host: '', headliner: '', lineup: [], first: [], second: [] }, 'format');
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  // =========================================================================
  // Stage 2 - pick the format
  // =========================================================================
  function renderFormat() {
    root.appendChild(header(showLabel() + ' - what kind of show is it? You can add a host to either.'));
    root.appendChild(stepper('format'));
    var opts = [
      { t: 'Straight Through (no break)', d: 'e.g. a headline show or showcase. Acts run straight through, no break.', type: 'flat' },
      { t: 'Two Halves', d: 'e.g. Comedy Brew. A first half, a break, then a second half.', type: 'split' }
    ];
    var wrap = el('div', 'lineup-lab__formats');
    opts.forEach(function (o) {
      var b = button('lineup-lab__format-card');
      b.appendChild(el('span', 'lineup-lab__format-name', o.t));
      b.appendChild(el('span', 'lineup-lab__format-desc', o.d));
      b.addEventListener('click', function () {
        go({ show: state.show, type: o.type, host: '', headliner: '', lineup: [], first: [], second: [] }, 'pick');
      });
      wrap.appendChild(b);
    });
    root.appendChild(wrap);
    var actions = el('div', 'lineup-lab__actions');
    actions.appendChild(backLink('show'));
    root.appendChild(actions);
  }

  // =========================================================================
  // Stage 3 - search + select comedians (local; commits on Continue)
  // =========================================================================
  function renderPick() {
    root.appendChild(header(showLabel() + ' - add the comedians on the bill.'));
    root.appendChild(stepper('pick'));

    var initial = state.type === 'split' ? state.first.concat(state.second) : state.lineup.slice();
    if (state.host && initial.indexOf(state.host) < 0) initial.unshift(state.host);
    state.headliner.forEach(function (h) { if (initial.indexOf(h) < 0) initial.unshift(h); });
    var selected = resolveBill(initial);   // keeps guest:Name tokens alongside catalog slugs

    // Search field + a "+" that appears (≥3 chars, no exact catalog match) to add an
    // off-catalog GUEST act - for performers not yet in the comedian roster.
    var searchRow = el('div', 'lineup-lab__searchrow');
    var search = el('input', 'lineup-lab__search');
    search.type = 'search';
    search.placeholder = 'Search comedians by name…';
    search.setAttribute('aria-label', 'Search comedians by name');
    var addGuest = button('lineup-lab__addguest', '+');
    addGuest.hidden = true;
    addGuest.title = 'Add a name that isn’t in the list as a guest';
    addGuest.setAttribute('aria-label', 'Add as guest');
    searchRow.appendChild(search);
    searchRow.appendChild(addGuest);
    root.appendChild(searchRow);

    var tray = el('div', 'lineup-lab__tray');
    root.appendChild(tray);
    var results = el('ul', 'lineup-lab__results');
    results.setAttribute('role', 'list');
    root.appendChild(results);

    function renderTray() {
      tray.textContent = '';
      tray.appendChild(el('span', 'lineup-lab__tray-label',
        selected.length ? ('On the bill (' + selected.length + '):') : 'No one added yet.'));
      selected.forEach(function (slug) {
        var guest = isGuest(slug);
        var chip = el('span', 'lineup-lab__chip' + (guest ? ' lineup-lab__chip--guest' : ''), nameOf(slug));
        if (guest) chip.appendChild(el('span', 'lineup-lab__chip-tag', 'guest'));
        var x = button('lineup-lab__chip-x', '✕');
        x.setAttribute('aria-label', 'Remove ' + nameOf(slug));
        x.addEventListener('click', function () {
          selected = selected.filter(function (s) { return s !== slug; });
          renderTray(); renderResults();
        });
        chip.appendChild(x);
        tray.appendChild(chip);
      });
    }
    function renderResults() {
      var q = norm(search.value);
      results.textContent = '';
      var matches = COMEDIANS.filter(function (c) {
        return !q || norm(c.name).indexOf(q) >= 0 || norm(c.slug).indexOf(q) >= 0;
      });
      matches.slice(0, 80).forEach(function (c) {
        var li = el('li', 'lineup-lab__result');
        var on = selected.indexOf(c.slug) >= 0;
        var b = button('lineup-lab__result-btn' + (on ? ' is-on' : ''), c.name);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.addEventListener('click', function () {
          if (selected.indexOf(c.slug) >= 0) selected = selected.filter(function (s) { return s !== c.slug; });
          else selected.push(c.slug);
          renderTray(); renderResults();
        });
        li.appendChild(b);
        // The slug, in brackets, as a link to the comedian's page (new tab) - a SIBLING of the
        // toggle button (a link nested in a button is invalid and would hijack the select tap).
        if (c.url) {
          var slugLink = el('a', 'lineup-lab__result-slug', '(' + c.slug + ')');
          slugLink.href = c.url;
          slugLink.target = '_blank';
          slugLink.rel = 'noopener';
          slugLink.setAttribute('aria-label', 'Open ' + c.name + ' profile (' + c.slug + ')');
          li.appendChild(slugLink);
        }
        results.appendChild(li);
      });
      if (!matches.length) {
        var cand = guestCandidate();
        results.appendChild(el('li', 'lineup-lab__empty',
          cand ? ('No comedians match — tap + to add “' + cand + '” as a guest.') : 'No comedians match that search.'));
      }
    }
    // The typed text, if it's a valid NEW guest name: ≥3 chars, not an existing comedian,
    // and not already on the bill. Empty string means "don't offer the + button".
    function guestCandidate() {
      var raw = (search.value || '').replace(/[\s,]+/g, ' ').trim();
      if (raw.length < 3) return '';
      var q = norm(raw);
      for (var i = 0; i < COMEDIANS.length; i++) { if (norm(COMEDIANS[i].name) === q) return ''; }   // a real comedian - use the list
      for (var j = 0; j < selected.length; j++) { if (norm(nameOf(selected[j])) === q) return ''; }   // already added
      return raw;
    }
    function refreshAddGuest() {
      var cand = guestCandidate();
      addGuest.hidden = !cand;
      addGuest.setAttribute('aria-label', cand ? ('Add “' + cand + '” as a guest') : 'Add as guest');
    }
    function addGuestNow() {
      var cand = guestCandidate();
      if (!cand) return;
      selected.push(guestToken(cand));
      search.value = '';
      renderTray(); renderResults(); refreshAddGuest();
      try { search.focus(); } catch (e) { /* jsdom */ }
    }
    addGuest.addEventListener('click', addGuestNow);
    search.addEventListener('input', function () { renderResults(); refreshAddGuest(); });
    search.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && guestCandidate()) { e.preventDefault(); addGuestNow(); }
    });
    renderTray();
    renderResults();
    refreshAddGuest();

    var actions = el('div', 'lineup-lab__actions lineup-lab__actions--sticky');
    actions.appendChild(backLink('format'));
    var cont = el('button', 'btn-ticket', 'Continue to order');
    cont.type = 'button';
    cont.addEventListener('click', function () {
      if (!selected.length) return;
      // Resolve to CANONICAL slugs before comparing - a hand-built link may carry a host/
      // headliner in a different separator form (harryf.cks vs harryf-cks); compare like-for-like.
      var ch = canonical(state.host);
      var st = {
        show: state.show,
        type: state.type === 'split' ? 'split' : 'flat',
        host: (ch && selected.indexOf(ch) >= 0) ? ch : '',
        headliner: resolveBill(state.headliner).filter(function (s) { return selected.indexOf(s) >= 0; }),
        lineup: [], first: [], second: []
      };
      if (st.type === 'split') st.first = selected.slice();
      else st.lineup = selected.slice();
      go(st, 'order');
    });
    actions.appendChild(cont);
    root.appendChild(actions);
  }

  // =========================================================================
  // Stage 4 - arrange the running order, assign host/headliner, share
  // =========================================================================
  function renderOrder() {
    root.appendChild(header(showLabel() + ' - set the running order.'));
    root.appendChild(stepper('order'));

    // Loud-not-silent: if a shared link references a comedian who's since been unpublished or
    // re-slugged, they're dropped (anti-spam) - but say so rather than quietly shrinking the bill.
    var requested = (state.type === 'split' ? state.first.concat(state.second) : state.lineup.slice());
    if (state.host) requested.push(state.host);
    state.headliner.forEach(function (h) { if (requested.indexOf(h) < 0) requested.push(h); });
    var dropped = requested.filter(function (s) { return !isGuest(s) && !findComedian(s); }).length;  // guests aren't "dropped"
    if (dropped > 0) {
      root.appendChild(el('p', 'lineup-lab__notice',
        '⚠️ ' + dropped + (dropped === 1 ? ' act in this link is' : ' acts in this link are') +
        ' no longer available and ' + (dropped === 1 ? 'was' : 'were') + ' left off.'));
    }

    // Build the working model from the URL.
    var order = [];
    if (state.type === 'split') {
      resolveBill(state.first).forEach(function (s) { order.push(s); });
      order.push(INTERVAL);
      resolveBill(state.second).forEach(function (s) { order.push(s); });
    } else {
      resolveBill(state.lineup).forEach(function (s) { order.push(s); });
    }
    var work = {
      type: state.type,
      host: canonical(state.host) || '',
      headliner: resolveBill(state.headliner),   // 0+ headliners (co-headliners allowed)
      order: order
    };
    // The host lives in its own slot, never in the numbered order.
    if (work.host) work.order = work.order.filter(function (t) { return t === INTERVAL || norm(t) !== norm(work.host); });

    var performers = work.order.filter(function (t) { return t !== INTERVAL; });
    if (!performers.length && !work.host) {
      root.appendChild(el('p', 'lineup-lab__empty', 'No acts yet - go back and add some comedians.'));
      var a0 = el('div', 'lineup-lab__actions');
      a0.appendChild(backLink('pick'));
      root.appendChild(a0);
      return;
    }

    function workToState() {
      var st = { show: state.show, type: work.type, host: work.host, headliner: [], lineup: [], first: [], second: [] };
      if (work.type === 'split') {
        var afterInterval = false;
        work.order.forEach(function (t) {
          if (t === INTERVAL) { afterInterval = true; return; }
          (afterInterval ? st.second : st.first).push(t);
        });
      } else {
        work.order.forEach(function (t) { if (t !== INTERVAL) st.lineup.push(t); });
      }
      // Only keep headliners who are actually on the running order (drop any since removed).
      var bill = st.lineup.concat(st.first, st.second);
      st.headliner = work.headliner.filter(function (s) { return hasNorm(bill, s); });
      return st;
    }

    var dynamic = el('div', 'lineup-lab__dynamic');
    root.appendChild(dynamic);
    // Flyer panel lives below the wizard; (re)filled on demand from the current lineup.
    var flyerWrap = el('div', 'lineup-lab__flyer-wrap');
    root.appendChild(flyerWrap);

    function runningNumber(idx) { var n = 0; for (var i = 0; i <= idx; i++) { if (work.order[i] !== INTERVAL) n++; } return n; }
    function move(idx, dir) {
      var j = idx + dir;
      if (j < 0 || j >= work.order.length) return;
      var tmp = work.order[idx]; work.order[idx] = work.order[j]; work.order[j] = tmp;
      rerender();
    }

    var dragFrom = null;
    function wireDrag(node, idx) {
      node.setAttribute('draggable', 'true');
      node.addEventListener('dragstart', function (e) {
        dragFrom = idx;
        if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {} }
        node.classList.add('is-dragging');
      });
      node.addEventListener('dragend', function () { dragFrom = null; node.classList.remove('is-dragging'); });
      node.addEventListener('dragover', function (e) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; });
      node.addEventListener('drop', function (e) {
        e.preventDefault();
        if (dragFrom === null || dragFrom === idx) return;
        var item = work.order.splice(dragFrom, 1)[0];
        work.order.splice(idx, 0, item);
        dragFrom = null;
        rerender();
      });
    }

    function setHost(token) {
      if (norm(work.host) === norm(token)) { work.order.unshift(work.host); work.host = ''; rerender(); return; }
      work.order = work.order.filter(function (t) { return t === INTERVAL || norm(t) !== norm(token); });
      if (work.host) work.order.unshift(work.host);
      work.host = token;
      work.headliner = dropNorm(work.headliner, token); // the MC isn't a headliner in the order
      rerender();
    }

    function buildRow(token, idx) {
      if (token === INTERVAL) {
        var iv = el('li', 'lineup-lab__row lineup-lab__interval');
        var ivMain = el('div', 'lineup-lab__row-main');
        ivMain.appendChild(el('span', 'lineup-lab__handle', '⠇'));
        ivMain.appendChild(el('span', 'lineup-lab__interval-label', 'BREAK'));
        iv.appendChild(ivMain);
        var ic = el('div', 'lineup-lab__row-ctrls');
        var iu = button('lineup-lab__move', '↑'); iu.setAttribute('aria-label', 'Move break up'); iu.addEventListener('click', function () { move(idx, -1); });
        var idn = button('lineup-lab__move', '↓'); idn.setAttribute('aria-label', 'Move break down'); idn.addEventListener('click', function () { move(idx, 1); });
        ic.appendChild(iu); ic.appendChild(idn);
        iv.appendChild(ic);
        wireDrag(iv, idx);
        return iv;
      }
      var row = el('li', 'lineup-lab__row');
      row.setAttribute('data-slug', token);

      // Main line: drag handle + running number + the name (the name IS the profile link).
      var main = el('div', 'lineup-lab__row-main');
      main.appendChild(el('span', 'lineup-lab__handle', '⠇'));
      main.appendChild(el('span', 'lineup-lab__pos', String(runningNumber(idx))));
      var u = urlOf(token);
      var nm = el(u ? 'a' : 'span', 'lineup-lab__name', nameOf(token));
      if (u) { nm.href = u; nm.target = '_blank'; nm.rel = 'noopener'; nm.setAttribute('aria-label', 'Open ' + nameOf(token) + ' profile'); }
      if (hasNorm(work.headliner, token)) nm.appendChild(el('span', 'lineup-lab__star', ' ⭐'));
      main.appendChild(nm);
      row.appendChild(main);

      // Controls line: move up/down, host (🎤), headliner (⭐), remove (✕) - all compact icons.
      var ctr = el('div', 'lineup-lab__row-ctrls');
      var up = button('lineup-lab__move', '↑'); up.setAttribute('aria-label', 'Move up'); up.addEventListener('click', function () { move(idx, -1); });
      var dn = button('lineup-lab__move', '↓'); dn.setAttribute('aria-label', 'Move down'); dn.addEventListener('click', function () { move(idx, 1); });
      ctr.appendChild(up); ctr.appendChild(dn);
      var isHost = norm(token) === norm(work.host);
      var hb = button('lineup-lab__tag lineup-lab__tag--icon' + (isHost ? ' is-on' : ''), '🎤');
      hb.setAttribute('aria-pressed', isHost ? 'true' : 'false');
      hb.setAttribute('aria-label', isHost ? 'Unset host' : 'Set as host');
      hb.title = 'Host (MC)';
      hb.addEventListener('click', function () { setHost(token); });
      ctr.appendChild(hb);
      var isHl = hasNorm(work.headliner, token);
      var hl = button('lineup-lab__tag lineup-lab__tag--icon' + (isHl ? ' is-on' : ''), '⭐');
      hl.setAttribute('aria-pressed', isHl ? 'true' : 'false');
      hl.setAttribute('aria-label', isHl ? 'Unset headliner' : 'Set as headliner');
      hl.title = 'Headliner';
      hl.addEventListener('click', function () {
        work.headliner = hasNorm(work.headliner, token) ? dropNorm(work.headliner, token) : work.headliner.concat(token);
        rerender();
      });
      ctr.appendChild(hl);
      var rm = button('lineup-lab__tag lineup-lab__tag--icon lineup-lab__tag--rm', '✕');
      rm.setAttribute('aria-label', 'Remove ' + nameOf(token));
      rm.title = 'Remove';
      rm.addEventListener('click', function () {
        work.headliner = dropNorm(work.headliner, token);
        work.order.splice(idx, 1);
        rerender();
      });
      ctr.appendChild(rm);
      row.appendChild(ctr);
      wireDrag(row, idx);
      return row;
    }

    function buildFormatToggle() {
      var wrap = el('div', 'lineup-lab__fmt-toggle');
      [['flat', 'Straight through'], ['split', 'Two halves']].forEach(function (p) {
        var b = button('lineup-lab__fmt-btn' + (work.type === p[0] ? ' is-on' : ''), p[1]);
        b.setAttribute('aria-pressed', work.type === p[0] ? 'true' : 'false');
        b.addEventListener('click', function () {
          if (work.type === p[0]) return;
          if (p[0] === 'split') {
            // Need at least two acts to make two halves worth having.
            if (work.order.filter(function (x) { return x !== INTERVAL; }).length < 2) return;
            if (work.order.indexOf(INTERVAL) < 0) {
              var mid = Math.ceil(work.order.length / 2);
              work.order.splice(mid, 0, INTERVAL);
            }
            work.type = 'split';
          } else {
            work.order = work.order.filter(function (x) { return x !== INTERVAL; });
            work.type = 'flat';
          }
          rerender();
        });
        wrap.appendChild(b);
      });
      return wrap;
    }

    function buildHostSlot() {
      var slot = el('div', 'lineup-lab__hostslot');
      slot.appendChild(el('span', 'lineup-lab__hostslot-label', 'Host'));
      if (work.host) {
        var pill = el('span', 'lineup-lab__hostpill', nameOf(work.host));
        var rm = button('lineup-lab__chip-x', '✕');
        rm.setAttribute('aria-label', 'Remove host');
        rm.addEventListener('click', function () { work.order.unshift(work.host); work.host = ''; rerender(); });
        pill.appendChild(rm);
        slot.appendChild(pill);
      } else {
        slot.appendChild(el('span', 'lineup-lab__hostslot-empty', 'No host - tap “Host” on an act to set one.'));
      }
      return slot;
    }

    function buildList() {
      var ul = el('ul', 'lineup-lab__rows');
      ul.setAttribute('role', 'list');
      var hasActs = work.order.filter(function (t) { return t !== INTERVAL; }).length;
      if (!hasActs) { ul.appendChild(el('li', 'lineup-lab__empty', 'No acts in the order yet.')); return ul; }
      work.order.forEach(function (token, idx) { ul.appendChild(buildRow(token, idx)); });
      return ul;
    }

    // The share section is rebuilt on every edit so the link previews stay current.
    var outputs = el('div', 'lineup-lab__outputs');
    function buildOutputs() {
      outputs.textContent = '';
      outputs.appendChild(el('h2', 'lineup-lab__outputs-title', 'Share the lineup'));
      function addCopy(label, hint, getter, opts) {
        opts = opts || {};
        var rowEl = el('div', 'lineup-lab__copy-row' + (opts.primary ? ' lineup-lab__copy-row--primary' : '') + (opts.quiet ? ' lineup-lab__copy-row--quiet' : ''));
        var b = el('button', 'lineup-lab__copy' + (opts.primary ? ' lineup-lab__copy--primary' : '') + (opts.quiet ? ' lineup-lab__copy--quiet' : ''), label);
        b.type = 'button';
        var status = el('span', 'lineup-lab__copy-status', '');
        b.addEventListener('click', function () {
          var text = getter();
          if (!text) { status.textContent = opts.empty || 'Nothing to copy.'; return; }
          status.textContent = '…'; copy(text, status);
        });
        var headRow = el('div', 'lineup-lab__copy-head');
        headRow.appendChild(b);
        headRow.appendChild(status);
        rowEl.appendChild(headRow);
        if (hint) rowEl.appendChild(el('span', 'lineup-lab__copy-hint', hint));
        if (opts.preview) {
          var url = getter();
          var a = el('a', 'lineup-lab__preview', url);
          a.href = url; a.target = '_blank'; a.rel = 'noopener';
          rowEl.appendChild(a);
        }
        outputs.appendChild(rowEl);
      }
      // Running order is what organizers reach for most - make it the loud, full-width one.
      addCopy('💬 Copy running order', 'Plain text - paste straight into WhatsApp.', function () { return plainText(workToState()); }, { primary: true });
      // Instagram handles of everyone on the bill, always available here (and again under the flyer).
      addCopy('＠ Copy Insta handles', 'One @handle per line - paste into your story or post to tag everyone on the bill.', function () { return flyerHandlesText(workToState()); }, { quiet: true, empty: 'No Instagram handles on this lineup.' });
      addCopy('📣 Copy promo link', 'For posting the show - features the headliner.', function () { return absPromo(workToState(), false); }, { preview: true });
      addCopy('🙏 Copy thank-you link', 'For after the show.', function () { return absPromo(workToState(), true); }, { preview: true });
      addCopy('🔖 Save lineup for later', 'Re-open this tool with everything as it is now - keep tweaking, or hand to a co-organizer.', function () { return absLab(workToState()); }, { quiet: true, preview: true });

      // Flyer launcher - builds a downloadable share image from the current lineup.
      var flyerRow = el('div', 'lineup-lab__copy-row lineup-lab__copy-row--primary');
      var fb = el('button', 'lineup-lab__copy lineup-lab__copy--primary', '🎨 Make a share image');
      fb.type = 'button';
      fb.addEventListener('click', function () {
        openFlyer(flyerWrap, workToState());
        try { flyerWrap.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* jsdom */ }
      });
      var fhead = el('div', 'lineup-lab__copy-head');
      fhead.appendChild(fb);
      flyerRow.appendChild(fhead);
      flyerRow.appendChild(el('span', 'lineup-lab__copy-hint', 'An Instagram-ready flyer with the comedians’ faces — post or story.'));
      outputs.appendChild(flyerRow);
    }

    function rerender() {
      dynamic.textContent = '';
      flyerWrap.textContent = ''; // dismiss any open flyer so a stale image can't be downloaded after an edit
      dynamic.appendChild(buildFormatToggle());
      dynamic.appendChild(buildHostSlot());
      var legend = el('p', 'lineup-lab__legend');
      legend.appendChild(el('span', 'lineup-lab__legend-item', '🎤 = Host (the MC)'));
      legend.appendChild(el('span', 'lineup-lab__legend-item', '⭐ = Headliner (you can star more than one)'));
      dynamic.appendChild(legend);
      dynamic.appendChild(buildList());
      var updateRow = el('div', 'lineup-lab__actions');
      // Back must preserve in-progress edits (host/headliner/removals) just like Update does.
      var back = button('lineup-lab__back', '← Back');
      back.addEventListener('click', function () { go(workToState(), 'pick'); });
      updateRow.appendChild(back);
      var update = el('button', 'btn-ticket', 'Update lineup');
      update.type = 'button';
      update.addEventListener('click', function () { go(workToState(), 'order'); });
      updateRow.appendChild(update);
      dynamic.appendChild(updateRow);
      buildOutputs();
      dynamic.appendChild(outputs);
    }
    rerender();
  }

  // =========================================================================
  // Flyer Maker - client-side share-image generator (Instagram post + story)
  //
  // Draws an on-brand show flyer onto a <canvas> from the assembled lineup and
  // downloads it as a PNG. Everything is same-origin (show feature image, the IYF
  // logo, comedian photos) so the canvas never taints and toBlob() succeeds. Pure
  // layout helpers (dayLabel / faceScale / flyerSpec) are hoisted above and unit
  // tested; the drawing/DOM code below only runs in the browser (after the test seam).
  // =========================================================================

  // Day-of-week code (THU) when the show is within the coming 7 days, else the date
  // (2 OCT). nowMs is injected for testability. '' for an unparseable/missing date.
  // Reuses the WD/MO arrays declared before the test-export seam (so it works under
  // `bun test`, where the IIFE returns before any var below the seam is assigned).
  function dayLabel(iso, nowMs) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var nd = new Date((typeof nowMs === 'number') ? nowMs : Date.now());
    // Difference in *calendar days* (local) - a raw ms delta would misclassify a show
    // happening tonight as past (midnight already gone) and drop its weekday badge.
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var b = new Date(nd.getFullYear(), nd.getMonth(), nd.getDate()).getTime();
    var days = Math.round((a - b) / 86400000);
    if (days >= 0 && days <= 7) return WD[d.getDay()].toUpperCase();
    return d.getDate() + ' ' + MO[d.getMonth()].toUpperCase();
  }

  // Date label shown on the flyer, by format:
  //   post  -> permanent (archived), so the full date as history: "THU 4 JUN"
  //   story -> ephemeral (vanishes in 24h), so just the upcoming day of week: "THU"
  function flyerDate(iso, format, nowMs) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    if (format === 'post') {
      return WD[d.getDay()].toUpperCase() + ' ' + d.getDate() + ' ' + MO[d.getMonth()].toUpperCase();
    }
    return WD[d.getDay()].toUpperCase();
  }

  // Polaroid size multiplier by comedian priority - all stay clearly visible.
  function faceScale(priority) {
    switch (norm(priority)) {
      case 'high': return 1.0;
      case 'low': return 0.70;
      case 'medium': return 0.82;
      default: return 0.82;
    }
  }

  // Canvas spec per Instagram format. Post = 1080x1350 (4:5). Story = 1080x1920 (9:16).
  //
  // REQUIREMENT - Instagram key-content area (keyTop / keyBottom / keySide). Essential
  // content (title, faces, date, venue, logo) must sit inside it; new styles position
  // against these fields:
  //   story: y 250..1580 (1080 x 1330). Top ~250px = progress bar, profile name, close
  //          button. Bottom ~340px = reply bar, "Send message", sticker and link tap
  //          areas. Sides ~60px: some devices crop slightly and stickers or link
  //          buttons sit near the edges.
  //   post:  the central 1080 x 1080 (y 135..1215) is fully safe; the outer ~135px top
  //          and bottom are fine in the feed but may be trimmed elsewhere (grid, shares,
  //          other placements). Keep ~50px side margins so nothing sits on the frame edge.
  //
  // safeTop / safeBottom are the LEGACY insets the classic (polaroid) and the older
  // alternate painters were tuned against (story 250 / 320, post 70 / 70). They stay as
  // they are so those layouts do not move; they are not the requirement above.
  function flyerSpec(format) {
    if (format === 'story') return { w: 1080, h: 1920, safeTop: 250, safeBottom: 320, keyTop: 250, keyBottom: 340, keySide: 60, format: 'story' };
    return { w: 1080, h: 1350, safeTop: 70, safeBottom: 70, keyTop: 135, keyBottom: 135, keySide: 50, format: 'post' };
  }

  // --- canvas primitives -----------------------------------------------------
  function assetURL(p) {
    if (!p) return '';
    if (/^https?:/i.test(p) || /^data:/i.test(p)) return p;
    return p.charAt(0) === '/' ? p : '/' + p;
  }
  function loadImg(src) {
    return new Promise(function (res) {
      if (!src) { res(null); return; }
      var im = new Image();
      var done = false;
      function settle(v) { if (!done) { done = true; clearTimeout(timer); res(v); } }
      var timer = setTimeout(function () { settle(null); }, 6000); // never hang the render on a stuck image
      im.onload = function () { settle(im); };
      im.onerror = function () { settle(null); };
      // Same-origin assets keep the canvas untainted (the catalog paths are all root-relative,
      // so this is the normal path). If a path is ever an absolute off-origin URL, request CORS:
      // with CORS headers it stays exportable; without them it errors out to a placeholder -
      // either way it can never silently taint the canvas and break the PNG download.
      try { if (/^https?:/i.test(src) && src.indexOf(location.origin) !== 0) im.crossOrigin = 'anonymous'; } catch (e) { /* no location */ }
      im.src = src;
    });
  }
  function drawCover(ctx, img, x, y, w, h) {
    var ir = img.width / img.height, rr = w / h, sw, sh, sx, sy;
    if (ir > rr) { sh = img.height; sw = sh * rr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / rr; sx = 0; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  // Caption name under a face: the whole name when it is short enough to always fit (8
  // characters or fewer, so "Dr Val" stays "Dr Val"), otherwise the first word. Pure; exported.
  function firstName(name) {
    var full = String(name || '').trim();
    if (full.length <= 8) return full;
    return full.split(/\s+/)[0] || full;
  }
  function fitFont(ctx, text, maxW, startPx, minPx, weight, family) {
    var px = startPx;
    while (px > minPx) {
      ctx.font = (weight ? weight + ' ' : '') + px + 'px ' + family;
      if (ctx.measureText(text).width <= maxW) return px;
      px -= 2;
    }
    ctx.font = (weight ? weight + ' ' : '') + minPx + 'px ' + family;
    return minPx;
  }
  function wrapWords(ctx, text, maxW) {
    var words = (text || '').split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width <= maxW || !cur) cur = t;
      else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    return lines;
  }
  function fitTitle(ctx, text, maxW, startPx, minPx, maxLines, family) {
    var px = startPx;
    while (px >= minPx) {
      ctx.font = '400 ' + px + 'px ' + family;
      var lines = wrapWords(ctx, text, maxW);
      if (lines.length <= maxLines) return { px: px, lines: lines };
      px -= 4;
    }
    ctx.font = '400 ' + minPx + 'px ' + family;
    return { px: minPx, lines: wrapWords(ctx, text, maxW).slice(0, maxLines) };
  }

  var FONT_DISPLAY = '"Anton", Impact, sans-serif';
  var FONT_ACCENT = '"Permanent Marker", cursive';
  var FONT_BODY = '"Inter", system-ui, sans-serif';
  var TILTS = [-4, 3, -3, 4, -2, 2];

  // Reorder a priority-sorted array so arr[0] (highest) lands dead-centre and later
  // (lower-priority) items fan out alternately to the edges: [E.. M.. C ..M ..E].
  function centerOut(arr) {
    var n = arr.length, res = new Array(n), center = Math.floor((n - 1) / 2);
    var idx = center, sign = 1, dist = 1;
    for (var i = 0; i < n; i++) {
      res[idx] = arr[i];
      idx = center + sign * dist;
      if (sign > 0) sign = -1; else { sign = 1; dist++; }
    }
    return res;
  }

  var _fontsP = null;
  function loadBrandFonts() {
    if (_fontsP) return _fontsP;
    _fontsP = new Promise(function (resolve) {
      try {
        if (!document.getElementById('iyf-flyer-fonts')) {
          var l = document.createElement('link');
          l.id = 'iyf-flyer-fonts';
          l.rel = 'stylesheet';
          l.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Permanent+Marker&display=swap';
          document.head.appendChild(l);
        }
        var faces = ['400 64px "Anton"', '64px "Permanent Marker"', '700 48px "Inter"', '500 40px "Inter"', '400 40px "Inter"'];   // 400 too: the station board measures regular text before it draws
        if (document.fonts && document.fonts.load) {
          Promise.all(faces.map(function (f) { return document.fonts.load(f).catch(function () {}); }))
            .then(function () { return document.fonts.ready; }).then(resolve, resolve);
        } else resolve();
      } catch (e) { resolve(); }
    });
    return _fontsP;
  }

  // --- flyer pieces ----------------------------------------------------------
  function drawPolaroid(ctx, img, cx, topY, w, tilt, name, star) {
    var frame = Math.round(w * 0.06);
    var photo = w - frame * 2;
    var capH = Math.round(w * 0.22);
    var h = frame + photo + capH;
    ctx.save();
    ctx.translate(cx, topY + h / 2);
    ctx.rotate(tilt * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#FFF8EE';
    roundRect(ctx, -w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    var px = -w / 2 + frame, py = -h / 2 + frame;
    if (img) {
      ctx.save();
      roundRect(ctx, px, py, photo, photo, 4);
      ctx.clip();
      drawCover(ctx, img, px, py, photo, photo);
      ctx.restore();
    } else {
      ctx.fillStyle = '#0F0F10';
      ctx.fillRect(px, py, photo, photo);
      ctx.fillStyle = '#FFD54F';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((name || '?').charAt(0).toUpperCase(), px + photo / 2, py + photo / 2 + 4);
    }
    if (star) {
      ctx.fillStyle = '#E53935';
      ctx.beginPath();
      ctx.arc(px + photo - 6, py + 6, Math.max(20, photo * 0.13), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFD54F';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.16) + 'px ' + FONT_DISPLAY;
      ctx.fillText('★', px + photo - 6, py + 6 + 2);
    }
    var cap = firstName(name).toUpperCase();
    ctx.fillStyle = '#0F0F10';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(ctx, cap, photo, Math.round(capH * 0.62), 18, '', FONT_ACCENT);
    ctx.fillText(cap, 0, -h / 2 + frame + photo + capH / 2);
    ctx.restore();
    return h;
  }

  function drawHost(ctx, img, cx, cy, r, name) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
    ctx.fillStyle = '#E53935';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    if (img) drawCover(ctx, img, cx - r, cy - r, 2 * r, 2 * r);
    else {
      ctx.fillStyle = '#0F0F10';
      ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.fillStyle = '#FFD54F';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(r) + 'px ' + FONT_DISPLAY;
      ctx.fillText((name || '?').charAt(0).toUpperCase(), cx, cy + 4);
    }
    ctx.restore();
    // HOST pill straddling the bottom of the ring
    var pillH = Math.max(46, r * 0.42), pillW = r * 1.5, pillY = cy + r - pillH * 0.35;
    roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = '#0F0F10';
    ctx.fill();
    ctx.fillStyle = '#FFD54F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(pillH * 0.5) + 'px ' + FONT_BODY;
    ctx.fillText('H O S T', cx, pillY + pillH / 2 + 1);
    // name under the pill - smaller + snug so the lineup grid can sit right below it.
    var hostCap = firstName(name).toUpperCase();
    ctx.fillStyle = '#FFF8EE';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var nameY = pillY + pillH + 28;
    var nameSize = fitFont(ctx, hostCap, pillW * 1.7, 40, 20, '', FONT_ACCENT);
    ctx.fillText(hostCap, cx, nameY);
    ctx.restore();
    return nameY + nameSize * 0.5; // bottom edge of the whole host block (ring + pill + name)
  }

  // --- compositor ------------------------------------------------------------
  function paintFlyer(ctx, spec, m) {
    var W = spec.w, H = spec.h, top = spec.safeTop, bottom = spec.safeBottom, pad = 64;
    var cx = W / 2;

    // 1. background, cover-fit (fallback to brand blue)
    if (m.bg) drawCover(ctx, m.bg, 0, 0, W, H);
    else { ctx.fillStyle = '#10204a'; ctx.fillRect(0, 0, W, H); }

    // 2. brand overlays: blue wash for cohesion + bottom ink scrim for legibility
    var blue = ctx.createLinearGradient(0, 0, 0, H);
    blue.addColorStop(0, 'rgba(12,28,72,0.34)');
    blue.addColorStop(0.45, 'rgba(12,24,60,0.12)');
    blue.addColorStop(1, 'rgba(8,12,28,0.30)');
    ctx.fillStyle = blue;
    ctx.fillRect(0, 0, W, H);

    // title baseline anchored above the safe bottom
    var metaBaseY = H - bottom - 30;
    var nameMaxW = W - pad * 2;
    var ttl = fitTitle(ctx, (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase(),
      nameMaxW, spec.format === 'story' ? 150 : 138, 64, 3, FONT_DISPLAY);
    var lineH = ttl.px * 1.02;
    var nameBlockH = ttl.lines.length * lineH;
    var nameBottomY = metaBaseY - 92;
    var nameTopY = nameBottomY - nameBlockH;

    // scrim behind name + meta
    var scrimTop = nameTopY - 70;
    var scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
    scrim.addColorStop(0, 'rgba(15,15,16,0)');
    scrim.addColorStop(0.4, 'rgba(15,15,16,0.55)');
    scrim.addColorStop(1, 'rgba(15,15,16,0.9)');
    ctx.fillStyle = scrim;
    ctx.fillRect(0, scrimTop, W, H - scrimTop);

    // 3. logo (top, centered, inside safe top)
    var logoH = spec.format === 'story' ? 150 : 132;
    var logoY = top + (spec.format === 'story' ? 14 : 30);
    if (m.logo) {
      var lw = logoH * (m.logo.width / m.logo.height);
      ctx.drawImage(m.logo, cx - lw / 2, logoY, lw, logoH);
    }
    ctx.fillStyle = '#FFD54F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '34px ' + FONT_ACCENT;
    ctx.fillText('English stand-up comedy', cx, logoY + logoH + 42);
    var headerBottom = logoY + logoH + 70;

    // 4. faces zone (between header and the title block)
    var facesTop = headerBottom + 20;
    var facesBottom = nameTopY - 40;
    var bill = m.bill;            // EVERY performer on the bill - no cap
    var crowded = bill.length > 6;
    // When guests are on the bill, reserve a strip at the bottom of the faces band for the
    // "… and friends" line so the grid lays out ABOVE it and the text can never overlap a photo.
    var friendsH = m.hasGuests ? 78 : 0;
    // Smaller host ring (frees vertical room for bigger polaroids + the friends line); shrink
    // further when crowded. Its TOP stays put so the grid still starts below the host name.
    var hostR = Math.round((spec.format === 'story' ? 138 : 124) * (crowded ? 0.82 : 1));
    var rowTop;
    if (m.host && m.host.slug) {
      var hostCy = facesTop + hostR + 10;                 // ring top stays at facesTop + 10
      var hostBottom = drawHost(ctx, m.host.img, cx, hostCy, hostR, m.host.name);
      rowTop = hostBottom + (crowded ? 22 : 40);          // grid starts clear of the host name
    } else {
      rowTop = facesTop + 20;
    }
    // Priority-centred grid: highest priority sits central (upper rows, nearest the host),
    // lower priority fans out to the edges. The grid scales to fit so ALL acts are shown.
    var facesUsedBottom = rowTop;   // bottom edge of the drawn faces (for the "… and friends" line)
    if (bill.length) {
      var RANK = { high: 0, medium: 1, low: 2 };
      var sorted = bill.slice().sort(function (a, b) {
        var ra = RANK[norm(a.priority)]; if (ra == null) ra = 1;
        var rb = RANK[norm(b.priority)]; if (rb == null) rb = 1;
        return ra - rb;
      });
      var n = sorted.length;
      var bandW = W - pad * 2;
      var bandH = facesBottom - rowTop - friendsH;   // leave the reserved friends strip clear
      var gap = 16;
      var hardCap = Math.round((spec.format === 'story' ? 230 : 205) * 1.2);  // ~1.2x bigger faces
      // Pick the column count that makes the polaroids as LARGE as possible while the whole
      // grid still fits the band both ways - so every act shows at the biggest readable size.
      var cols = 1, rows = n, baseW = 0;
      for (var c = 1; c <= n; c++) {
        var rws = Math.ceil(n / c);
        var bw = (bandW - gap * (c - 1)) / c;                // width-limited size
        var bh = (bandH - gap * (rws - 1)) / (rws * 1.30);   // height-limited size
        var cand = Math.min(bw, bh, hardCap);
        if (cand > baseW) { baseW = cand; cols = c; rows = rws; }
      }
      var rowH = baseW * 1.30;
      var gridH = rows * rowH + (rows - 1) * gap;
      var startY = rowTop + Math.max(0, (bandH - gridH) / 2);
      facesUsedBottom = startY + gridH;
      for (var r = 0; r < rows; r++) {
        var rowItems = centerOut(sorted.slice(r * cols, (r + 1) * cols));
        var ws = rowItems.map(function (it) { return baseW * faceScale(it.priority); });
        var rowW = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (rowItems.length - 1);
        var hfit = Math.min(1, bandW / rowW); // safety: never overflow the band width
        var x = cx - (rowW * hfit) / 2;
        var ry = startY + r * (rowH + gap);
        for (var i = 0; i < rowItems.length; i++) {
          var w = ws[i] * hfit;
          drawPolaroid(ctx, rowItems[i].img, x + w / 2, ry, w, TILTS[(r * cols + i) % TILTS.length], rowItems[i].name, rowItems[i].headliner);
          x += w + gap * hfit;
        }
      }
    }

    // 4b. "… and friends" — when guests (off-catalog acts) are on the bill they aren't pictured,
    // so this small handwritten line under the photos signals there's more to the lineup.
    if (m.hasGuests) {
      // Sits in the reserved strip just below the grid - guaranteed clear of the photos.
      var fy = Math.min(facesUsedBottom + 42, facesBottom - 22);
      ctx.fillStyle = '#FFF8EE';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '48px ' + FONT_ACCENT;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fillText('… and friends', cx, fy);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    // 5. show name (display, uppercase, largest), drawn from nameTop down
    ctx.fillStyle = '#FFF8EE';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ttl.lines.forEach(function (ln, i) {
      ctx.fillText(ln, cx, nameTopY + (i + 1) * lineH - lineH * 0.22);
    });
    ctx.shadowColor = 'transparent';

    // 6. meta line: date pill + venue
    var dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? m.show.venue.toUpperCase() : '';
    ctx.textBaseline = 'middle';
    var pillFont = '700 40px ' + FONT_BODY;
    ctx.font = pillFont;
    var pillTxtW = dl ? ctx.measureText(dl).width : 0;
    var pillPad = 26, pillH = 64;
    var pillW = pillTxtW + pillPad * 2;
    ctx.font = '600 38px ' + FONT_BODY;
    var venTxtW = venue ? ctx.measureText('  ' + venue).width : 0;
    var gap2 = dl && venue ? 22 : 0;
    var metaW = (dl ? pillW : 0) + gap2 + venTxtW;
    var mx = cx - metaW / 2;
    var pillCy = metaBaseY - pillH / 2;
    if (dl) {
      roundRect(ctx, mx, pillCy - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = '#E53935';
      ctx.fill();
      ctx.fillStyle = '#FFF3E0';
      ctx.font = pillFont;
      ctx.textAlign = 'center';
      ctx.fillText(dl, mx + pillW / 2, pillCy + 1);
      mx += pillW + gap2;
    }
    if (venue) {
      ctx.fillStyle = '#FFD54F';
      ctx.font = '600 38px ' + FONT_BODY;
      ctx.textAlign = 'left';
      ctx.fillText(venue, mx, pillCy + 1);
    }

    // 7. story-only: the bottom safe band (below H - safeBottom) is intentionally left
    // EMPTY — it's clear space for the user to drop their own Instagram link sticker.
  }

  // ===========================================================================
  // Alternate flyer styles - each is a paintFlyer(ctx, spec, m) drop-in that
  // honours the same contract as the classic painter (FLYER_DESIGN.md §6):
  // native IG dims + safe insets, untainted canvas, brand palette + 3 fonts,
  // EVERY booked act shown, priority drives prominence. They share the helpers
  // below so the look changes but the rules never do.
  // ===========================================================================

  // Shared: logo + tagline header. Returns the Y just below the header block.
  // opts.top overrides the inset the logo hangs from (default: legacy safeTop);
  // opts.taglineLabel draws a rounded label of that colour behind the tagline, for
  // styles whose background is too busy for bare handwriting.
  function flyerHeader(ctx, spec, m, opts) {
    opts = opts || {};
    var cx = spec.w / 2;
    var logoH = spec.format === 'story' ? 150 : 132;
    var logoY = (opts.top != null ? opts.top : spec.safeTop) + (spec.format === 'story' ? 14 : 30);
    if (m.logo) {
      var lw = logoH * (m.logo.width / m.logo.height);
      ctx.drawImage(m.logo, cx - lw / 2, logoY, lw, logoH);
    }
    var tagline = 'English stand-up comedy', ty = logoY + logoH + 42;
    ctx.font = '34px ' + FONT_ACCENT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (opts.taglineLabel) {
      var tw = ctx.measureText(tagline).width;
      roundRect(ctx, cx - tw / 2 - 22, ty - 36, tw + 44, 52, 26);
      ctx.fillStyle = opts.taglineLabel; ctx.fill();
    }
    ctx.fillStyle = opts.taglineColor || '#FFD54F';
    ctx.fillText(tagline, cx, ty);
    return logoY + logoH + 70;
  }

  // Shared: date pill + venue, centred on metaBaseY. Colours are per-style.
  function drawMeta(ctx, spec, m, metaBaseY, pillBg, pillText, venueColor) {
    var cx = spec.w / 2;
    var dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? String(m.show.venue).toUpperCase() : '';
    ctx.textBaseline = 'middle';
    var pillFont = '700 40px ' + FONT_BODY;
    ctx.font = pillFont;
    var pillTxtW = dl ? ctx.measureText(dl).width : 0;
    var pillPad = 26, pillH = 64;
    var pillW = pillTxtW + pillPad * 2;
    ctx.font = '600 38px ' + FONT_BODY;
    var venTxtW = venue ? ctx.measureText('  ' + venue).width : 0;
    var gap2 = dl && venue ? 22 : 0;
    var metaW = (dl ? pillW : 0) + gap2 + venTxtW;
    var mx = cx - metaW / 2;
    var pillCy = metaBaseY - pillH / 2;
    if (dl) {
      roundRect(ctx, mx, pillCy - pillH / 2, pillW, pillH, pillH / 2);
      ctx.fillStyle = pillBg; ctx.fill();
      ctx.fillStyle = pillText; ctx.font = pillFont; ctx.textAlign = 'center';
      ctx.fillText(dl, mx + pillW / 2, pillCy + 1);
      mx += pillW + gap2;
    }
    if (venue) {
      ctx.fillStyle = venueColor; ctx.font = '600 38px ' + FONT_BODY; ctx.textAlign = 'left';
      ctx.fillText(venue, mx, pillCy + 1);
    }
  }

  // Shared: show title (Anton, uppercase) ending at baselineY. Returns block top Y.
  function drawShowTitle(ctx, spec, m, baselineY, color, startPx, maxLines, shadow) {
    var cx = spec.w / 2, pad = 64, nameMaxW = spec.w - pad * 2;
    var text = (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase();
    var ttl = fitTitle(ctx, text, nameMaxW, startPx, 56, maxLines, FONT_DISPLAY);
    var lineH = ttl.px * 1.02;
    var topY = baselineY - ttl.lines.length * lineH;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4; }
    ttl.lines.forEach(function (ln, i) {
      ctx.fillText(ln, cx, topY + (i + 1) * lineH - lineH * 0.22);
    });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    return topY;
  }

  // Shared: priority-centred grid that scales so ALL acts fit. cellRatio = card
  // height / width. Calls cell(ctx, item, cx, topY, cellW, idx) per act. Mirrors
  // the classic painter's fitting loop so no act is ever dropped.
  function faceGrid(ctx, spec, bill, x0, rowTop, bandW, bandH, cellRatio, hardCap, cell) {
    if (!bill.length || bandH <= 0) return;
    var RANK = { high: 0, medium: 1, low: 2 };
    var sorted = bill.slice().sort(function (a, b) {
      var ra = RANK[norm(a.priority)]; if (ra == null) ra = 1;
      var rb = RANK[norm(b.priority)]; if (rb == null) rb = 1;
      return ra - rb;
    });
    var n = sorted.length, gap = 16, cols = 1, rows = n, baseW = 0;
    for (var c = 1; c <= n; c++) {
      var rws = Math.ceil(n / c);
      var bw = (bandW - gap * (c - 1)) / c;
      var bh = (bandH - gap * (rws - 1)) / (rws * cellRatio);
      var cand = Math.min(bw, bh, hardCap);
      if (cand > baseW) { baseW = cand; cols = c; rows = rws; }
    }
    if (baseW <= 0) return;
    var rowH = baseW * cellRatio;
    var gridH = rows * rowH + (rows - 1) * gap;
    var cx = x0 + bandW / 2;
    var startY = rowTop + Math.max(0, (bandH - gridH) / 2);
    for (var r = 0; r < rows; r++) {
      var rowItems = centerOut(sorted.slice(r * cols, (r + 1) * cols));
      var ws = rowItems.map(function (it) { return baseW * faceScale(it.priority); });
      var rowW = ws.reduce(function (a, b) { return a + b; }, 0) + gap * (rowItems.length - 1);
      var hfit = Math.min(1, bandW / rowW);
      var xx = cx - (rowW * hfit) / 2;
      var ry = startY + r * (rowH + gap);
      for (var i = 0; i < rowItems.length; i++) {
        var w = ws[i] * hfit;
        cell(ctx, rowItems[i], xx + w / 2, ry, w, r * cols + i);
        xx += w + gap * hfit;
      }
    }
  }

  function dashedLine(ctx, x1, y1, x2, y2, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    if (ctx.setLineDash) ctx.setLineDash([12, 10]);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  // Red-on-cream duotone: grayscale image multiplied onto a cream base, then a
  // translucent red wash. Fills its own cream base so it works inside a clip too.
  function drawDuotone(ctx, img, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#FFF3E0'; ctx.fillRect(x, y, w, h);
    if ('filter' in ctx) ctx.filter = 'grayscale(1) contrast(1.2)';
    ctx.globalCompositeOperation = 'multiply';
    if (img) drawCover(ctx, img, x, y, w, h);
    if ('filter' in ctx) ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#E53935'; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  function halftoneOverlay(ctx, x, y, w, h, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    var step = 14, r = 2.2;
    for (var yy = y + step / 2; yy < y + h; yy += step) {
      for (var xx = x + step / 2; xx < x + w; xx += step) {
        ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  // --- STYLE 1: Ticket (vintage admission stub) -------------------------------
  // A cream admission ticket standing on an ink field, drawn entirely inside the
  // key-content area (spec.keyTop/keyBottom/keySide): serial strip, black-and-white
  // show photo with the colour logo and a red ADMIT ONE stamp, the show title, every
  // act as an ink-framed monochrome print, then a perforation with punched notches
  // and a tear-off stub carrying the day, date, time, venue, barcode and serial.

  // Grayscale, cover-fit copy of an image on an offscreen canvas, via a pixel loop
  // rather than ctx.filter (older Safari has no canvas filter). Images arrive through
  // loadImg (same-origin) so getImageData is safe; if the canvas ever is tainted the
  // catch keeps the colour original so the render never fails.
  function monoImage(img, w, h) {
    var off = document.createElement('canvas');
    off.width = Math.max(1, Math.round(w));
    off.height = Math.max(1, Math.round(h));
    var c = off.getContext('2d');
    drawCover(c, img, 0, 0, off.width, off.height);
    try {
      var id = c.getImageData(0, 0, off.width, off.height), d = id.data;
      for (var i = 0; i < d.length; i += 4) {
        var l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        l = 128 + (l - 128) * 1.16;               // a little contrast so it prints like ink
        d[i] = d[i + 1] = d[i + 2] = l < 0 ? 0 : l > 255 ? 255 : l;
      }
      c.putImageData(id, 0, 0);
    } catch (e) { /* tainted canvas: keep the colour original */ }
    return off;
  }
  function drawMono(ctx, img, x, y, w, h) {
    if (!img) { ctx.fillStyle = '#0F0F10'; ctx.fillRect(x, y, w, h); return; }
    ctx.drawImage(monoImage(img, w, h), x, y, w, h);
  }

  // Small deterministic hash so the serial and barcode are stable per show + date.
  function ticketHash(s) {
    var h = 2166136261;
    s = String(s || '');
    // Math.imul keeps the multiply in 32 bits; a plain * overflows 2^53 and collapses the
    // low bits, which made neighbouring slugs land on the same palette.
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  // Six digits from the show date (YYMMDD) jumbled by a hash of show + date, so the number
  // is really the date but does not read as one, and re-rendering gives the same number.
  // A show with no date falls back to a hash of the slug. Pure; exported for tests.
  function showCode(slug, iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d.getTime())) return ('000000' + (ticketHash((slug || 'iyf') + '|code') % 1000000)).slice(-6);
    var digits = ('0' + (d.getFullYear() % 100)).slice(-2) + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2);
    var n = ticketHash((slug || 'iyf') + '|' + digits + '|code'), arr = digits.split('');
    for (var i = arr.length - 1; i > 0; i--) {   // Fisher-Yates driven by the hash
      n = (n * 1103515245 + 12345) >>> 0;
      var j = (n >>> 8) % (i + 1), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    var out = arr.join('');
    if (out === digits) out = out.slice(2) + out.slice(0, 2);   // never the plain date
    return out;
  }
  // "Nº 260210" style serial: the jumbled show date. Pure; exported for tests.
  function ticketSerial(slug, iso) { return 'Nº ' + showCode(slug, iso); }

  // The small print on the stub. One line per show + date (same night, same line), all
  // of them a joke rather than a warning. Pure; exported for tests.
  function stubLines() {
    return [
      'No refunds · none needed',
      'Admit one · leave happier',
      'Tear here · laugh there',
      'Valid for one night of nonsense',
      'May cause sore cheeks',
      'Keep this stub · tell your friends',
      'Heckling costs extra',
      'Laughter guaranteed · seats not',
      'Warning: may cause snorting',
      'Good for one evening of bad decisions'
    ];
  }
  function stubLine(slug, iso) {
    var all = stubLines();
    return all[ticketHash((slug || 'iyf') + '|' + (iso || '') + '|stub') % all.length];
  }

  // Ticket paper palettes: dark papers only (red, blue, charcoal, brown families; no
  // cream, no yellow) with off-white print, like a raffle roll or a railway stub. Each
  // is the full set of roles the ticket paints with:
  //   paper     the card itself
  //   ink       everything printed in the main colour (title, strip, stub, barcode, rails)
  //   accent    the stamp, the big weekday, the tagline
  //   chip / chipText   name chips under the faces
  //   host / hostText   the host's chip
  // Readability is pinned by bun test: WCAG contrast ink on paper >= 4.5, accent on paper,
  // chipText on chip and hostText on host >= 3.0, and every paper's relative luminance
  // under 0.25 (which is what keeps cream and yellow out). Roll red is #C43E33 rather than
  // the swatch's #D9463B so off-white print clears 4.5. A function rather than a var so the
  // test seam (which returns before any var below it is assigned) can still call it.
  function ticketPalettes() {
    return [
      { name: 'roll-red', paper: '#C43E33', ink: '#FBF7EE', accent: '#FBF7EE', chip: '#FBF7EE', chipText: '#C43E33', host: '#2B2B2B', hostText: '#FBF7EE' },
      { name: 'brick', paper: '#9E3B33', ink: '#FBF7EE', accent: '#F3E9D2', chip: '#FBF7EE', chipText: '#9E3B33', host: '#2B2B2B', hostText: '#FBF7EE' },
      { name: 'roll-blue', paper: '#2F5D9E', ink: '#FBF7EE', accent: '#FBF7EE', chip: '#FBF7EE', chipText: '#2F5D9E', host: '#C43E33', hostText: '#FBF7EE' },
      { name: 'ink-blue', paper: '#1F3A5F', ink: '#FBF7EE', accent: '#E8D8B0', chip: '#FBF7EE', chipText: '#1F3A5F', host: '#C43E33', hostText: '#FBF7EE' },
      { name: 'charcoal', paper: '#2B2B2B', ink: '#FBF7EE', accent: '#D9463B', chip: '#FBF7EE', chipText: '#2B2B2B', host: '#D9463B', hostText: '#FBF7EE' },
      { name: 'brown', paper: '#4A3728', ink: '#FBF7EE', accent: '#E8D8B0', chip: '#FBF7EE', chipText: '#4A3728', host: '#C43E33', hostText: '#FBF7EE' },
      { name: 'wine', paper: '#6B2B32', ink: '#FBF7EE', accent: '#F3E9D2', chip: '#FBF7EE', chipText: '#6B2B32', host: '#2B2B2B', hostText: '#FBF7EE' }
    ];
  }
  // Same show -> same paper, by hashing the slug. No show names live here: a new show
  // gets a palette the moment it exists. Pure; exported for tests.
  function ticketPalette(slug) {
    var all = ticketPalettes();
    return all[ticketHash((slug || 'iyf') + '|palette') % all.length];
  }

  // Ink barcode with varied bar widths (even stripes read as wallpaper).
  function ticketBarcode(ctx, x, y, w, h, seed, ink) {
    var widths = [2, 3, 5, 7], n = ticketHash(seed), xx = x, bar = true;
    ctx.fillStyle = ink || '#0F0F10';
    while (xx < x + w) {
      n = (n * 1103515245 + 12345) >>> 0;
      var bw = widths[(n >>> 16) % widths.length] * 1.6;
      if (xx + bw > x + w) bw = x + w - xx;
      if (bar) ctx.fillRect(xx, y, bw, h);
      xx += bw; bar = !bar;
    }
    // guard bars, taller, at both ends
    ctx.fillRect(x, y, 3, h + 10); ctx.fillRect(x + w - 3, y, 3, h + 10);
  }

  // Rotated rubber stamp: outlined capsule + text, slightly transparent like real ink.
  function drawStamp(ctx, text, cx, cy, deg, px, color) {
    color = color || '#E53935';
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(deg * Math.PI / 180);
    ctx.globalAlpha = 0.9;
    ctx.font = '400 ' + px + 'px ' + FONT_DISPLAY;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(text).width, padX = px * 0.42, h = px * 1.28;
    ctx.lineWidth = Math.max(4, px * 0.09); ctx.strokeStyle = color;
    roundRect(ctx, -tw / 2 - padX, -h / 2, tw + padX * 2, h, 10); ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillText(text, 0, px * 0.06);
    ctx.restore();
  }

  // Edge print running up the left rail and down the right rail (decorative only).
  function drawRailText(ctx, text, x, y1, y2, flip, ink) {
    ctx.save();
    ctx.translate(x, (y1 + y2) / 2);
    ctx.rotate((flip ? 90 : -90) * Math.PI / 180);
    ctx.fillStyle = ink || '#0F0F10'; ctx.globalAlpha = 0.55;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, text, (y2 - y1) - 40, 20, 12, '700', FONT_BODY);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // Letter-spaced small caps (canvas letterSpacing is not universal, so space by hand).
  function spaced(s) { return String(s || '').toUpperCase().split('').join(' '); }

  // One act on the ticket: square monochrome print in an ink frame, a solid name chip
  // beneath (red chip reading "HOST · NAME" for the host), red star for the headliner.
  function drawTicketFace(ctx, it, cx, topY, w, P) {
    var frame = 4, photo = w - frame * 2;
    var chipH = Math.round(w * 0.24), chipGap = 8;
    var x = cx - w / 2, y = topY;
    ctx.fillStyle = P.ink; ctx.fillRect(x, y, w, w);
    if (it.img) drawMono(ctx, it.img, x + frame, y + frame, photo, photo);
    else {
      ctx.fillStyle = P.paper; ctx.fillRect(x + frame, y + frame, photo, photo);
      ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.55) + 'px ' + FONT_DISPLAY;
      ctx.fillText((it.name || '?').charAt(0).toUpperCase(), cx, y + w / 2 + 4);
    }
    if (it.headliner) {
      var r = Math.max(15, Math.round(w * 0.12));
      ctx.fillStyle = P.host; ctx.beginPath(); ctx.arc(x + w - 2, y + 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.hostText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(r * 1.25) + 'px ' + FONT_DISPLAY;
      ctx.fillText('★', x + w - 2, y + 3);
    }
    var cap = firstName(it.name).toUpperCase();
    if (it.isHost) cap = 'HOST · ' + cap;
    var cy = y + w + chipGap;
    ctx.fillStyle = it.isHost ? P.host : P.chip;
    ctx.fillRect(x, cy, w, chipH);
    ctx.fillStyle = it.isHost ? P.hostText : P.chipText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, cap, w - 10, Math.round(chipH * 0.6), 12, '700', FONT_BODY);
    ctx.fillText(cap, cx, cy + chipH / 2 + 1);
  }

  function paintTicketStub(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    var show = m.show || null;
    var iso = show ? show.next : '';
    var serial = ticketSerial(show ? show.slug : '', iso);
    var d = iso ? new Date(iso) : null;
    if (d && isNaN(d.getTime())) d = null;
    var P = ticketPalette(show ? show.slug : '');

    // 1. the field: a monochrome audience photo under a heavy ink layer (quiet, so the
    //    ticket stays the subject); plain ink when the page has no backdrop pool.
    var field = m.backdrop ? monoImage(m.backdrop, W, H) : null;
    function paintField() {
      ctx.fillStyle = '#0F0F10'; ctx.fillRect(0, 0, W, H);
      if (!field) return;
      ctx.drawImage(field, 0, 0, W, H);
      ctx.fillStyle = 'rgba(15,15,16,0.64)'; ctx.fillRect(0, 0, W, H);
      var vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
      vig.addColorStop(0, 'rgba(15,15,16,0)'); vig.addColorStop(1, 'rgba(15,15,16,0.55)');
      ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    }
    paintField();

    // the ticket inside the key-content area, on the show's paper
    var tx = spec.keySide + 10, tw = W - tx * 2;
    var ty = spec.keyTop + 10, tb = H - spec.keyBottom - 10, th = tb - ty;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = P.paper; roundRect(ctx, tx, ty, tw, th, 22); ctx.fill();
    ctx.restore();
    // faint paper grain (dots at low alpha keep it printed, not flat)
    halftoneOverlay(ctx, tx, ty, tw, th, P.ink, 0.035);
    // printed border: a thin ink rule just inside the edge, the way ticket stock is printed;
    // also what separates a dark paper from the dark field behind it
    ctx.save(); ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.strokeStyle = P.ink;
    roundRect(ctx, tx + 12, ty + 12, tw - 24, th - 24, 14); ctx.stroke();
    ctx.restore();

    // rails: edge print each side, content lives between them
    var rail = 46, ix = tx + rail, iw = tw - rail * 2, cx = W / 2;
    var railText = spaced('IN YOUR FACE COMEDY') + '   ·   ' + spaced('ENGLISH STAND-UP') + '   ·   ' + spaced('ZÜRICH');
    drawRailText(ctx, railText, tx + rail / 2, ty + 30, tb - 30, false, P.ink);
    drawRailText(ctx, railText, tx + tw - rail / 2, ty + 30, tb - 30, true, P.ink);

    // 2. top strip: ticket type left, serial right (serial repeats on the stub so the halves match)
    var y = ty + 28;
    ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
    ctx.font = '700 22px ' + FONT_BODY; ctx.textAlign = 'left';
    ctx.fillText(spaced('Admission ticket'), ix, y + 12);
    ctx.font = '700 24px ' + FONT_BODY; ctx.textAlign = 'right';
    ctx.fillText(serial, ix + iw, y + 12);
    y += 46;

    // 3. photo block: monochrome show image, knocked back, colour logo on top, red stamp
    var ph = story ? 310 : 240;
    ctx.fillStyle = P.ink; ctx.fillRect(ix, y, iw, ph);
    drawMono(ctx, m.bg, ix + 4, y + 4, iw - 8, ph - 8);
    ctx.fillStyle = 'rgba(15,15,16,0.28)'; ctx.fillRect(ix + 4, y + 4, iw - 8, ph - 8);
    if (m.logo) {
      var lh = story ? 150 : 120, lw = lh * (m.logo.width / m.logo.height);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24;
      ctx.drawImage(m.logo, cx - lw / 2, y + (ph - lh) / 2, lw, lh);
      ctx.restore();
    }
    drawStamp(ctx, 'ADMIT ONE', ix + iw - (story ? 190 : 165), y + (story ? 62 : 52), -9, story ? 46 : 38, P.accent);
    y += ph + 26;

    // 4. show title (Anton, ink) + handwritten tagline
    var text = (show ? splitTitle(show.title) : 'IN YOUR FACE').toUpperCase();
    var ttl = fitTitle(ctx, text, iw - 16, story ? 104 : 88, 52, 2, FONT_DISPLAY);
    var lineH = ttl.px * 1.0;
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    ttl.lines.forEach(function (ln, i) { ctx.fillText(ln, cx, y + (i + 1) * lineH - lineH * 0.14); });
    y += ttl.lines.length * lineH + 6;
    ctx.font = (story ? 34 : 30) + 'px ' + FONT_ACCENT; ctx.fillStyle = P.accent;
    ctx.fillText('English stand-up comedy', cx, y + (story ? 30 : 26));
    y += story ? 52 : 46;

    // 5. stub geometry (bottom), then the faces band is whatever is left above the perforation
    var stubH = story ? 226 : 200;
    var perfY = tb - stubH;
    var friendsH = m.hasGuests ? 56 : 0;
    var bandTop = y + 8, bandH = perfY - 26 - bandTop - friendsH;

    // 6. faces: host rides in the grid as its own print (centred, tagged), every act shown
    var bill = m.bill.slice();
    if (m.host && m.host.slug) bill.unshift({ slug: m.host.slug, name: m.host.name, img: m.host.img, priority: 'high', isHost: true });
    faceGrid(ctx, spec, bill, ix, bandTop, iw, bandH, 1.32, story ? 240 : 210, function (ctx, it, ccx, ty2, w) {
      drawTicketFace(ctx, it, ccx, ty2, w, P);
    });
    if (m.hasGuests) {
      ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '40px ' + FONT_ACCENT;
      ctx.fillText('… and friends', cx, perfY - 26 - friendsH / 2);
    }

    // 7. perforation: dashed tear line, notches punched through to the field behind
    ctx.save(); ctx.globalAlpha = 0.55;
    dashedLine(ctx, tx + 18, perfY, tx + tw - 18, perfY, P.ink);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.arc(tx, perfY, 18, 0, Math.PI * 2); ctx.arc(tx + tw, perfY, 18, 0, Math.PI * 2); ctx.clip();
    paintField();
    ctx.restore();

    // 8. stub: day / date / time / venue on the left, barcode + serial on the right
    var sy = perfY + 30, sx = ix;
    var dayPx = story ? 150 : 124;
    var dl = d ? flyerDate(iso, 'story', m.nowMs) : 'IYF';
    ctx.fillStyle = P.accent; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + dayPx + 'px ' + FONT_DISPLAY;
    ctx.fillText(dl, sx - 4, sy + dayPx * 0.86);
    var dayW = ctx.measureText(dl).width;
    var colX = sx + dayW + 26;
    var barW = story ? 300 : 260, barX = ix + iw - barW;
    var colMax = barX - 30 - colX;
    ctx.fillStyle = P.ink;
    var line1 = d ? (d.getDate() + ' ' + MO[d.getMonth()].toUpperCase() + ' ' + d.getFullYear()) : '';
    var hh = d ? ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) : '';
    if (line1) { fitFont(ctx, line1, colMax, story ? 40 : 34, 18, '700', FONT_BODY); ctx.fillText(line1, colX, sy + (story ? 52 : 44)); }
    var line2 = (hh ? 'DOORS ' + hh : '') + ((hh && show && show.venue) ? '  ·  ' : '') + ((show && show.venue) ? String(show.venue).toUpperCase() : '');
    if (line2) { fitFont(ctx, line2, colMax, story ? 30 : 26, 14, '600', FONT_BODY); ctx.fillText(line2, colX, sy + (story ? 98 : 84)); }
    ctx.globalAlpha = 0.7;
    var small = spaced(stubLine(show ? show.slug : '', iso));
    fitFont(ctx, small, colMax, 18, 11, '600', FONT_BODY);
    ctx.fillText(small, colX, sy + (story ? 136 : 118));
    ctx.globalAlpha = 1;
    // barcode + matching serial
    ticketBarcode(ctx, barX, sy + 4, barW, story ? 96 : 80, serial + iso, P.ink);
    ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 24px ' + FONT_BODY;
    ctx.fillText(spaced(serial), barX + barW / 2, sy + (story ? 140 : 122));
  }

  // --- STYLE 2: Risograph Halftone -------------------------------------------
  function drawRisoFace(ctx, img, cx, topY, w, name, star) {
    var photo = w, capH = Math.round(w * 0.20);
    var x = cx - w / 2, y = topY;
    ctx.save();
    if (img) {
      ctx.save(); roundRect(ctx, x, y, photo, photo, 6); ctx.clip();
      drawDuotone(ctx, img, x, y, photo, photo);
      halftoneOverlay(ctx, x, y, photo, photo, '#B71C1C', 0.12);
      ctx.restore();
    } else {
      ctx.fillStyle = '#E53935'; roundRect(ctx, x, y, photo, photo, 6); ctx.fill();
      ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((name || '?').charAt(0).toUpperCase(), x + photo / 2, y + photo / 2 + 4);
    }
    ctx.lineWidth = 4; ctx.strokeStyle = '#0F0F10';
    roundRect(ctx, x, y, photo, photo, 6); ctx.stroke();
    if (star) {
      ctx.fillStyle = '#E53935'; ctx.beginPath();
      ctx.arc(x + photo - 4, y + 4, Math.max(16, photo * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.14) + 'px ' + FONT_DISPLAY;
      ctx.fillText('★', x + photo - 4, y + 4 + 1);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cap = firstName(name).toUpperCase();
    fitFont(ctx, cap, photo, Math.round(capH * 0.8), 16, '700', FONT_BODY);
    ctx.fillStyle = '#0F0F10'; ctx.fillText(cap, cx + 2, y + photo + capH * 0.55 + 2);   // ink offset, like a misregistered second pass
    ctx.fillStyle = '#FFF3E0'; ctx.fillText(cap, cx, y + photo + capH * 0.55);
    ctx.restore();
  }

  function drawRisoHost(ctx, cx, topY, host) {
    var r = 118, cy = topY + r;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (host.img) {
      drawDuotone(ctx, host.img, cx - r, cy - r, 2 * r, 2 * r);
      halftoneOverlay(ctx, cx - r, cy - r, 2 * r, 2 * r, '#B71C1C', 0.12);
    } else {
      ctx.fillStyle = '#E53935'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(r) + 'px ' + FONT_DISPLAY;
      ctx.fillText((host.name || '?').charAt(0).toUpperCase(), cx, cy + 4);
    }
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = '#0F0F10';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    var pillH = 46, pillW = 150, pillY = cy + r - pillH * 0.4;
    roundRect(ctx, cx - pillW / 2, pillY, pillW, pillH, pillH / 2);
    ctx.fillStyle = '#E53935'; ctx.fill();
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 26px ' + FONT_BODY; ctx.fillText('H O S T', cx, pillY + pillH / 2 + 1);
    var nameY = pillY + pillH + 30, hostCap = firstName(host.name).toUpperCase();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, hostCap, 320, 40, 20, '', FONT_ACCENT);
    ctx.fillStyle = '#0F0F10'; ctx.fillText(hostCap, cx + 2, nameY + 2);   // ink offset, like a misregistered second pass
    ctx.fillStyle = '#FFF3E0'; ctx.fillText(hostCap, cx, nameY);
    return nameY + 26;
  }

  function drawRisoTitle(ctx, spec, m, baselineY) {
    var cx = spec.w / 2, pad = 64, nameMaxW = spec.w - pad * 2;
    var text = (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase();
    var ttl = fitTitle(ctx, text, nameMaxW, spec.format === 'story' ? 140 : 128, 56, 3, FONT_DISPLAY);
    var lineH = ttl.px * 1.04;
    var blockH = ttl.lines.length * lineH;
    var topY = baselineY - blockH;
    ctx.fillStyle = '#E53935'; ctx.fillRect(0, topY - 18, spec.w, blockH + 30);
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    ttl.lines.forEach(function (ln, i) { ctx.fillText(ln, cx, topY + (i + 1) * lineH - lineH * 0.24); });
    return topY - 18;
  }

  function paintRiso(ctx, spec, m) {
    var W = spec.w, H = spec.h, top = spec.safeTop, bottom = spec.safeBottom, pad = 64, cx = W / 2;
    ctx.fillStyle = '#FFF3E0'; ctx.fillRect(0, 0, W, H);
    if (m.bg) drawDuotone(ctx, m.bg, 0, 0, W, H);
    halftoneOverlay(ctx, 0, 0, W, H, '#B71C1C', 0.10);
    // tagline on a cream label and venue in cream: bare ink on the red duotone was unreadable
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#0F0F10', taglineLabel: '#FFF3E0' });
    var facesTop = headerBottom + 28;
    var metaBaseY = H - bottom - 40;
    var titleTop = drawRisoTitle(ctx, spec, m, metaBaseY - 86);
    drawMeta(ctx, spec, m, metaBaseY, '#0F0F10', '#FFF3E0', '#FFF3E0');
    var rowTop = facesTop;
    if (m.host && m.host.slug) { rowTop = drawRisoHost(ctx, cx, facesTop, m.host) + 22; }
    faceGrid(ctx, spec, m.bill, pad, rowTop, W - pad * 2, (titleTop - 36) - rowTop, 1.20,
      spec.format === 'story' ? 220 : 200, function (ctx, it, ccx, ty, w) {
        drawRisoFace(ctx, it.img, ccx, ty, w, it.name, it.headliner);
      });
  }

  // --- STYLE 3: Neon Marquee -------------------------------------------------
  function marqueeBulbs(ctx, cx, y, totalW) {
    var n = 9, gap = totalW / (n - 1), x0 = cx - totalW / 2;
    ctx.save();
    ctx.shadowColor = '#FFD54F'; ctx.shadowBlur = 18; ctx.fillStyle = '#FFD54F';
    for (var i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(x0 + i * gap, y, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawNeonFace(ctx, img, cx, topY, w, name, star) {
    var r = w / 2, cy = topY + r;
    var ring = star ? '#FFD54F' : '#FF5252';
    ctx.save();
    ctx.shadowColor = ring; ctx.shadowBlur = 26;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 6; ctx.strokeStyle = ring; ctx.stroke();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 4, 0, Math.PI * 2); ctx.clip();
    if (img) drawCover(ctx, img, cx - r, cy - r, 2 * r, 2 * r);
    else {
      ctx.fillStyle = '#1A1A1D'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.fillStyle = ring; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(r) + 'px ' + FONT_DISPLAY;
      ctx.fillText((name || '?').charAt(0).toUpperCase(), cx, cy + 4);
    }
    ctx.restore();
    if (star) {
      ctx.fillStyle = '#E53935'; ctx.shadowColor = '#FF5252'; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(cx + r * 0.7, cy - r * 0.7, Math.max(15, r * 0.22), 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(r * 0.28) + 'px ' + FONT_DISPLAY;
      ctx.fillText('★', cx + r * 0.7, cy - r * 0.7 + 1);
    }
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cap = firstName(name).toUpperCase();
    fitFont(ctx, cap, w * 1.2, Math.round(w * 0.2), 16, '', FONT_ACCENT);
    ctx.fillText(cap, cx, cy + r + Math.round(w * 0.14));
    ctx.restore();
  }

  function drawNeonTitle(ctx, spec, m, baselineY) {
    var cx = spec.w / 2, pad = 64, nameMaxW = spec.w - pad * 2;
    var text = (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase();
    var ttl = fitTitle(ctx, text, nameMaxW, spec.format === 'story' ? 140 : 128, 56, 3, FONT_DISPLAY);
    var lineH = ttl.px * 1.02, topY = baselineY - ttl.lines.length * lineH;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    ttl.lines.forEach(function (ln, i) {
      var yy = topY + (i + 1) * lineH - lineH * 0.22;
      ctx.shadowColor = '#FF5252'; ctx.shadowBlur = 30; ctx.fillStyle = '#FFF3E0'; ctx.fillText(ln, cx, yy);
      ctx.shadowBlur = 16; ctx.fillText(ln, cx, yy);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.fillStyle = '#FFF3E0'; ctx.fillText(ln, cx, yy);
    });
    ctx.restore();
    return topY;
  }

  function paintNeon(ctx, spec, m) {
    var W = spec.w, H = spec.h, top = spec.safeTop, bottom = spec.safeBottom, pad = 64, cx = W / 2;
    ctx.fillStyle = '#0F0F10'; ctx.fillRect(0, 0, W, H);
    if (m.bg) { ctx.save(); ctx.globalAlpha = 0.45; drawCover(ctx, m.bg, 0, 0, W, H); ctx.restore(); }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(15,15,16,0.78)');
    g.addColorStop(0.5, 'rgba(15,15,16,0.55)');
    g.addColorStop(1, 'rgba(15,15,16,0.92)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#FFD54F' });
    marqueeBulbs(ctx, cx, headerBottom + 4, Math.min(W - pad * 2, 560));
    var facesTop = headerBottom + 44;
    var metaBaseY = H - bottom - 40;
    var titleTop = drawNeonTitle(ctx, spec, m, metaBaseY - 84);
    drawMeta(ctx, spec, m, metaBaseY, '#E53935', '#FFF3E0', '#FFD54F');
    var rowTop = facesTop;
    if (m.host && m.host.slug) {
      var hr = 140;
      rowTop = drawHost(ctx, m.host.img, cx, facesTop + hr + 10, hr, m.host.name) + 22;
    }
    faceGrid(ctx, spec, m.bill, pad, rowTop, W - pad * 2, (titleTop - 36) - rowTop, 1.26,
      spec.format === 'story' ? 210 : 195, function (ctx, it, ccx, ty, w) {
        drawNeonFace(ctx, it.img, ccx, ty, w, it.name, it.headliner);
      });
  }

  // --- STYLE 4: Bold Type Stack ----------------------------------------------
  // Ink field, giant cream Anton, one red bar. Positioned against the key-content area
  // (keyTop / keyBottom / keySide). Faces are round prints in the shared priority-centred
  // faceGrid so they scale to the room available instead of shrinking onto one line.

  // One act: ringed circle (yellow ring + HOST pill for the host, red ring + star for the
  // headliner, cream ring otherwise) with the first name beneath.
  function drawTypeFace(ctx, it, cx, topY, w) {
    var r = w / 2, cy = topY + r, ri = r - 5;
    var ring = it.isHost ? '#FFD54F' : (it.headliner ? '#E53935' : '#FFF3E0');
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2); ctx.clip();
    if (it.img) drawCover(ctx, it.img, cx - ri, cy - ri, 2 * ri, 2 * ri);
    else {
      ctx.fillStyle = '#2A2A2D'; ctx.fillRect(cx - ri, cy - ri, 2 * ri, 2 * ri);
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(ri) + 'px ' + FONT_DISPLAY;
      ctx.fillText((it.name || '?').charAt(0).toUpperCase(), cx, cy + 3);
    }
    ctx.restore();
    if (it.isHost) {
      var pw = Math.max(72, Math.round(w * 0.46)), ph = Math.max(24, Math.round(w * 0.15));
      roundRect(ctx, cx - pw / 2, cy + r - ph * 0.55, pw, ph, ph / 2);
      ctx.fillStyle = '#FFD54F'; ctx.fill();
      ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.round(ph * 0.62) + 'px ' + FONT_BODY;
      ctx.fillText('HOST', cx, cy + r - ph * 0.55 + ph / 2 + 1);
    } else if (it.headliner) {
      var br = Math.max(14, Math.round(w * 0.11)), bx = cx + r * 0.7, by = cy - r * 0.7;
      ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(br * 1.3) + 'px ' + FONT_DISPLAY;
      ctx.fillText('★', bx, by + 1);
    }
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cap = firstName(it.name).toUpperCase();
    fitFont(ctx, cap, w * 1.15, Math.round(Math.min(30, w * 0.16)), 13, '600', FONT_BODY);
    ctx.fillText(cap, cx, topY + w + Math.round(w * 0.14));
  }

  function drawGiantTitle(ctx, spec, m, topAvail, baseline) {
    var cx = spec.w / 2, pad = spec.keySide + 14, maxW = spec.w - pad * 2;
    var text = (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase();
    var avail = baseline - topAvail;
    var ttl = fitTitle(ctx, text, maxW, spec.format === 'story' ? 220 : 190, 60, 5, FONT_DISPLAY);
    var lineH = ttl.px * 1.0, blockH = ttl.lines.length * lineH;
    while (blockH > avail && ttl.px > 60) {
      ttl.px -= 4; lineH = ttl.px * 1.0; blockH = ttl.lines.length * lineH;
    }
    var startY = topAvail + Math.max(0, (avail - blockH) / 2);
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    ttl.lines.forEach(function (ln, i) { ctx.fillText(ln, cx, startY + (i + 1) * lineH - lineH * 0.2); });
  }

  // Full-width red bar with the day/date left and the venue right, top edge at barY.
  function drawTypeMetaBar(ctx, spec, m, barY, barH) {
    var W = spec.w, pad = spec.keySide + 14;
    var dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? String(m.show.venue).toUpperCase() : '';
    ctx.fillStyle = '#E53935'; ctx.fillRect(0, barY, W, barH);
    ctx.fillStyle = '#FFF3E0'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.font = '700 40px ' + FONT_BODY;
    if (dl) ctx.fillText(dl, pad, barY + barH / 2 + 1);
    ctx.textAlign = 'right'; ctx.font = '600 36px ' + FONT_BODY;
    if (venue) ctx.fillText(venue, W - pad, barY + barH / 2 + 1);
  }

  function paintTypeStack(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    var top = spec.keyTop, bottomY = H - spec.keyBottom, pad = spec.keySide + 14, cx = W / 2;
    ctx.fillStyle = '#0F0F10'; ctx.fillRect(0, 0, W, H);

    // 1. logo + tagline hang from the key-content top
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#FFD54F', top: top });

    // 2. slim show-photo band (identifies the show; kept short so the faces get the room)
    var bandH = story ? 200 : 150, bandY = headerBottom + 6;
    if (m.bg) {
      ctx.save(); roundRect(ctx, pad, bandY, W - pad * 2, bandH, 12); ctx.clip();
      drawCover(ctx, m.bg, pad, bandY, W - pad * 2, bandH);
      var gg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gg.addColorStop(0, 'rgba(15,15,16,0.1)'); gg.addColorStop(1, 'rgba(15,15,16,0.55)');
      ctx.fillStyle = gg; ctx.fillRect(pad, bandY, W - pad * 2, bandH);
      ctx.restore();
    }

    // 3. the bar sits on the key-content bottom; the title gets a fixed block above it
    var barH = 80, barY = bottomY - barH - 8;
    var titleBottom = barY - 28, titleTop = titleBottom - (story ? 290 : 220);
    var ruleY = titleTop - 48;   // the red rule sits well clear of the title's cap height

    // 4. faces: everything between the photo band and the title, host in the grid
    var friendsH = m.hasGuests ? 60 : 0;
    var facesTop = bandY + bandH + 28, facesBottom = ruleY - 28 - friendsH;
    var bill = m.bill.slice();
    if (m.host && m.host.slug) bill.unshift({ slug: m.host.slug, name: m.host.name, img: m.host.img, priority: 'high', isHost: true });
    faceGrid(ctx, spec, bill, pad, facesTop, W - pad * 2, facesBottom - facesTop, 1.24, story ? 240 : 200,
      function (ctx, it, ccx, ty, w) { drawTypeFace(ctx, it, ccx, ty, w); });
    if (m.hasGuests) {
      ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '40px ' + FONT_ACCENT;
      ctx.fillText('… and friends', cx, facesBottom + friendsH / 2);
    }

    // 5. red rule, giant title, meta bar
    ctx.fillStyle = '#E53935'; ctx.fillRect(pad, ruleY, W - pad * 2, 6);
    drawGiantTitle(ctx, spec, m, titleTop, titleBottom);
    drawTypeMetaBar(ctx, spec, m, barY, barH);
  }


  // --- shared: WCAG relative luminance + contrast (pure, exported for tests) ----------
  function relLum(hex) {
    var h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrastRatio(a, b) {
    var la = relLum(a), lb = relLum(b), hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  // Every text / field pair the three newest painters put on the canvas, so bun test can
  // hold the legibility floor without a screenshot: 'small' text needs WCAG 4.5, 'large'
  // (bold at 19px or more, or 24px regular) needs 3.0.
  function newStylePairs() {
    return [
      { style: 'lava', text: '#FFD54F', field: '#0F0F10', kind: 'large' },     // title on the scrim
      { style: 'lava', text: '#FFF3E0', field: '#0F0F10', kind: 'small' },     // billing block
      { style: 'lava', text: '#FFF3E0', field: '#B71C1C', kind: 'small' },     // names low on the field
      { style: 'swiss', text: '#0F0F10', field: '#F2F2EE', kind: 'small' },    // ink type on the paper
      { style: 'swiss', text: '#E53935', field: '#F2F2EE', kind: 'large' },    // red labels, roles, tagline
      { style: 'swiss', text: '#0F0F10', field: '#E53935', kind: 'large' },    // title over the red circle
      { style: 'lineup', text: '#0F0F10', field: '#C8C8CB', kind: 'small' },   // ink title on the darkest corner of the lit wall
      { style: 'lineup', text: '#E53935', field: '#FAFAFA', kind: 'large' },   // case name label, charge line
      { style: 'lineup', text: '#0F0F10', field: '#FFF8EE', kind: 'small' },   // placards
      { style: 'lineup', text: '#0F0F10', field: '#FFD54F', kind: 'small' },   // host placard
      { style: 'lineup', text: '#FFF3E0', field: '#E53935', kind: 'large' },   // case strip
      { style: 'lineup', text: '#FFF3E0', field: '#0F0F10', kind: 'small' },   // date bar
      { style: 'week-type', text: '#B9B2A6', field: '#0F0F10', kind: 'small' }, // venue and time on the ink field
      { style: 'week-swiss', text: '#5A5A5E', field: '#F2F2EE', kind: 'small' }, // venue line on the paper
      { style: 'week-ticket', text: '#2B2B2B', field: '#FBF7EE', kind: 'small' }, // stub text
      { style: 'week-ticket', text: '#C43E33', field: '#FBF7EE', kind: 'small' }, // stub sub line on roll-red paper
      { style: 'week-polaroid', text: '#5A5A5E', field: '#FFF8EE', kind: 'small' }, // polaroid sub caption
      { style: 'week-polaroid', text: '#FFD54F', field: '#1A1A1D', kind: 'large' }, // headline on the wall
      { style: 'week-lava', text: '#FFF3E0', field: '#3B3B1E', kind: 'small' },     // name on the pill over the hottest blob (0.78 ink over #FFD54F)
      { style: 'week-lava', text: '#FFD54F', field: '#3B3B1E', kind: 'small' },     // time and venue, same worst case
      { style: 'week-lava', text: '#0F0F10', field: '#FFB300', kind: 'small' },     // day on the blob
      { style: 'week-comic', text: '#0F0F10', field: '#FFD54F', kind: 'small' },    // caption box, masthead
      { style: 'week-comic', text: '#0F0F10', field: '#FFFFFF', kind: 'small' },    // balloon
      { style: 'week-comic', text: '#0F0F10', field: '#EFE7CF', kind: 'small' },    // empty-page note on the newsprint
      { style: 'week-flap', text: '#FFF3E0', field: '#1E1E22', kind: 'small' },     // show name tiles
      { style: 'week-flap', text: '#C9C2B6', field: '#1E1E22', kind: 'small' },     // dim sub row tiles
      { style: 'week-flap', text: '#FFD54F', field: '#151518', kind: 'small' },     // headline tiles, board header on the casing
      { style: 'week-station', text: '#FFFFFF', field: '#2D3184', kind: 'small' },  // white rows on the indigo board
      { style: 'week-station', text: '#2D3184', field: '#D6D6D6', kind: 'small' },  // column labels on the grey strip, weekday in the type box
      { style: 'week-station', text: '#FFFFFF', field: '#E53935', kind: 'large' },  // notice banner and the Gratis box (bold, 33 px and up)
      { style: 'week-chalk', text: '#F2EFE6', field: '#1C201D', kind: 'small' },    // chalk white
      { style: 'week-chalk', text: '#F5E6A3', field: '#1C201D', kind: 'small' },    // chalk yellow
      { style: 'week-menu', text: '#0F0F10', field: '#FBF4E4', kind: 'small' },     // items on the card
      { style: 'week-menu', text: '#B71C1C', field: '#FBF4E4', kind: 'small' },     // course headings
      { style: 'week-menu', text: '#5A5A5E', field: '#FBF4E4', kind: 'small' },     // item descriptions
      { style: 'adcard-photo', text: '#FFF3E0', field: '#1A1A1D', kind: 'large' },   // headline on the scrim
      { style: 'adcard-photo', text: '#FFD54F', field: '#1A1A1D', kind: 'small' },   // sub line on the scrim
      { style: 'adcard-swiss', text: '#0F0F10', field: '#F2F2EE', kind: 'small' },   // headline on the paper
      { style: 'adcard-swiss', text: '#E53935', field: '#F2F2EE', kind: 'large' },   // sub and label in red
      { style: 'adcard-type', text: '#FFF3E0', field: '#0F0F10', kind: 'small' },    // capitals on ink
      { style: 'adcard-type', text: '#FFF3E0', field: '#E53935', kind: 'large' },    // sub on the red bar
      { style: 'adcard-logo', text: '#FFF3E0', field: '#E53935', kind: 'large' },    // headline on brand red
      { style: 'adcard-logo', text: '#0F0F10', field: '#E53935', kind: 'small' }     // sub on brand red
    ];
  }

  // --- STYLE 5: Lava Lamp (Barbarella, 1968) ----------------------------------
  // A warm ink-to-red field with slow glowing blobs, space-helmet faces with a highlight,
  // a dimensional yellow title and a movie billing block. Blob placement is seeded from
  // the show slug (same show, same lava) and never enters the text bands: the title and
  // billing block sit on an ink scrim with the blobs kept out from underneath.

  // Deterministic blob list. bands = [{top, bottom}] the blobs must not touch (pure, exported).
  function lavaSeeds(slug, w, h, bands) {
    var n = ticketHash((slug || 'iyf') + '|lava'), out = [], tries = 0;
    bands = bands || [];
    function rnd() { n = (n * 1103515245 + 12345) >>> 0; return (n >>> 8) / 16777216; }
    while (out.length < 8 && tries++ < 400) {
      var r = h * (0.06 + rnd() * 0.10), x = w * (0.06 + rnd() * 0.88), y = h * (0.02 + rnd() * 0.96);
      var ok = true;
      for (var i = 0; i < bands.length; i++) {
        if (y + r > bands[i].top && y - r < bands[i].bottom) { ok = false; break; }
      }
      if (!ok) continue;
      out.push({ x: x, y: y, r: r, wobble: 0.10 + rnd() * 0.12, phase: rnd() * Math.PI * 2, hot: rnd() < 0.45 });
    }
    return out;
  }

  function blobPath(ctx, b) {
    var steps = 48;
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2;
      var rr = b.r * (1 + b.wobble * Math.sin(3 * t + b.phase) + b.wobble * 0.5 * Math.sin(5 * t + b.phase * 1.7));
      var px = b.x + Math.cos(t) * rr, py = b.y + Math.sin(t) * rr * 1.15;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function lavaBlobs(ctx, seeds) {
    ctx.save();
    seeds.forEach(function (b) {
      var g = ctx.createRadialGradient(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r * 1.15);
      if (b.hot) { g.addColorStop(0, '#FFD54F'); g.addColorStop(0.55, '#FFB300'); g.addColorStop(1, '#E53935'); }
      else { g.addColorStop(0, '#FF5252'); g.addColorStop(0.6, '#E53935'); g.addColorStop(1, '#B71C1C'); }
      ctx.shadowColor = b.hot ? 'rgba(255,179,0,0.55)' : 'rgba(229,57,53,0.5)';
      ctx.shadowBlur = b.r * 0.6;
      ctx.fillStyle = g;
      blobPath(ctx, b); ctx.fill();
    });
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    // glossy highlight on each blob, the way a lit lava lamp catches the glass
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#FFF3E0';
    seeds.forEach(function (b) {
      ctx.beginPath(); ctx.ellipse(b.x - b.r * 0.35, b.y - b.r * 0.45, b.r * 0.22, b.r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  function lavaStars(ctx, slug, w, h) {
    var n = ticketHash((slug || 'iyf') + '|stars');
    ctx.save(); ctx.fillStyle = '#FFF3E0';
    for (var i = 0; i < 90; i++) {
      n = (n * 1103515245 + 12345) >>> 0; var x = (n >>> 8) % w;
      n = (n * 1103515245 + 12345) >>> 0; var y = (n >>> 8) % h;
      n = (n * 1103515245 + 12345) >>> 0; var r = 1 + ((n >>> 8) % 3) * 0.6;
      ctx.globalAlpha = 0.25 + ((n >>> 4) % 50) / 100;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // One act: a space-helmet circle (cream glass rim, highlight arc), ring by role, name in
  // Anton below. Host ring yellow, headliner ring red plus a star.
  function drawLavaFace(ctx, it, cx, topY, w) {
    var r = w / 2, cy = topY + r, ri = r - 7;
    var ring = it.isHost ? '#FFD54F' : (it.headliner ? '#E53935' : '#FFF3E0');
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2); ctx.clip();
    if (it.img) drawCover(ctx, it.img, cx - ri, cy - ri, 2 * ri, 2 * ri);
    else {
      ctx.fillStyle = '#2A2A2D'; ctx.fillRect(cx - ri, cy - ri, 2 * ri, 2 * ri);
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(ri) + 'px ' + FONT_DISPLAY;
      ctx.fillText((it.name || '?').charAt(0).toUpperCase(), cx, cy + 3);
    }
    // helmet glass: a warm tint low, a highlight arc high left
    var tint = ctx.createLinearGradient(0, cy - ri, 0, cy + ri);
    tint.addColorStop(0, 'rgba(255,243,224,0)'); tint.addColorStop(1, 'rgba(183,28,28,0.35)');
    ctx.fillStyle = tint; ctx.fillRect(cx - ri, cy - ri, 2 * ri, 2 * ri);
    ctx.strokeStyle = 'rgba(255,248,238,0.85)'; ctx.lineWidth = Math.max(4, ri * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, ri * 0.78, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
    ctx.restore();
    if (it.isHost) {
      var pw = Math.max(74, Math.round(w * 0.46)), ph = Math.max(24, Math.round(w * 0.15));
      roundRect(ctx, cx - pw / 2, cy + r - ph * 0.55, pw, ph, ph / 2);
      ctx.fillStyle = '#FFD54F'; ctx.fill();
      ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.round(ph * 0.62) + 'px ' + FONT_BODY;
      ctx.fillText('HOST', cx, cy + r - ph * 0.55 + ph / 2 + 1);
    } else if (it.headliner) {
      var br = Math.max(14, Math.round(w * 0.11)), bx = cx + r * 0.7, by = cy - r * 0.7;
      ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(br * 1.3) + 'px ' + FONT_DISPLAY;
      ctx.fillText('\u2605', bx, by + 1);
    }
    var cap = firstName(it.name).toUpperCase();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, cap, w * 1.15, Math.round(Math.min(34, w * 0.19)), 14, '400', FONT_DISPLAY);
    ctx.fillStyle = '#0F0F10'; ctx.fillText(cap, cx + 2, topY + w + Math.round(w * 0.15) + 2);
    ctx.fillStyle = '#FFF3E0'; ctx.fillText(cap, cx, topY + w + Math.round(w * 0.15));
  }

  // Dimensional 1968 title: red-deep offset, ink contact shadow, yellow face; on an ink scrim.
  function drawLavaTitle(ctx, spec, m, topY, bottomY) {
    var W = spec.w, cx = W / 2, pad = spec.keySide + 14, maxW = W - pad * 2;
    var text = (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase();
    var avail = bottomY - topY;
    var ttl = fitTitle(ctx, text, maxW - 24, spec.format === 'story' ? 190 : 160, 60, 3, FONT_DISPLAY);
    var lineH = ttl.px * 1.0, blockH = ttl.lines.length * lineH;
    while (blockH > avail && ttl.px > 60) { ttl.px -= 4; lineH = ttl.px * 1.0; blockH = ttl.lines.length * lineH; }
    var startY = topY + Math.max(0, (avail - blockH) / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '400 ' + ttl.px + 'px ' + FONT_DISPLAY;
    var off = Math.max(6, Math.round(ttl.px * 0.06));
    ttl.lines.forEach(function (ln, i) {
      var y = startY + (i + 1) * lineH - lineH * 0.2;
      ctx.fillStyle = '#B71C1C'; ctx.fillText(ln, cx + off * 2, y + off * 2);
      ctx.fillStyle = '#0F0F10'; ctx.fillText(ln, cx + off, y + off);
      ctx.fillStyle = '#FFD54F'; ctx.fillText(ln, cx, y);
    });
  }

  // Movie-poster billing block: date and venue in tall yellow caps.
  function drawLavaBilling(ctx, spec, m, topY, h) {
    var cx = spec.w / 2, dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? String(m.show.venue).toUpperCase() : '';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var line = [dl, venue].filter(Boolean).join('   \u00B7   ');
    ctx.fillStyle = '#FFD54F';
    fitFont(ctx, line, spec.w - (spec.keySide + 14) * 2, 58, 30, '400', FONT_DISPLAY);
    ctx.fillText(line, cx, topY + h * 0.5);
  }

  function paintLavaLamp(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    var top = spec.keyTop, bottomY = H - spec.keyBottom, pad = spec.keySide + 14, cx = W / 2;
    var slug = m.show ? m.show.slug : '';
    // 1. field: ink up top warming to red-deep low, stars, then the lava
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0F0F10'); g.addColorStop(0.55, '#2A2A2D'); g.addColorStop(1, '#B71C1C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    lavaStars(ctx, slug, W, H);
    // layout first, so the blobs know where the text bands are
    var billH = story ? 120 : 100, billY = bottomY - billH;
    var titleBottom = billY - 16, titleTop = titleBottom - (story ? 270 : 210);
    var headerBottom = top + (story ? 14 : 30) + (story ? 150 : 132) + 70;   // what flyerHeader returns
    var seeds = lavaSeeds(slug, W, H, [{ top: top - 20, bottom: headerBottom }, { top: titleTop - 30, bottom: bottomY + 20 }]);
    lavaBlobs(ctx, seeds);
    // 2. logo + tagline from the key-content top
    flyerHeader(ctx, spec, m, { taglineColor: '#FFD54F', top: top });
    // 3. faces in helmets between header and title
    var friendsH = m.hasGuests ? 60 : 0;
    var facesTop = headerBottom + 16, facesBottom = titleTop - 30 - friendsH;
    var bill = m.bill.slice();
    if (m.host && m.host.slug) bill.unshift({ slug: m.host.slug, name: m.host.name, img: m.host.img, priority: 'high', isHost: true });
    faceGrid(ctx, spec, bill, pad, facesTop, W - pad * 2, facesBottom - facesTop, 1.28, story ? 240 : 200,
      function (ctx, it, ccx, ty, w) { drawLavaFace(ctx, it, ccx, ty, w); });
    if (m.hasGuests) {
      ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '40px ' + FONT_ACCENT;
      ctx.fillText('\u2026 and friends', cx, facesBottom + friendsH / 2);
    }
    // 4. ink scrim under the title and billing, feathered at the top, then the type
    var sc = ctx.createLinearGradient(0, titleTop - 60, 0, titleTop + 40);
    sc.addColorStop(0, 'rgba(15,15,16,0)'); sc.addColorStop(1, 'rgba(15,15,16,0.72)');
    ctx.fillStyle = sc; ctx.fillRect(0, titleTop - 60, W, 100);
    ctx.fillStyle = 'rgba(15,15,16,0.72)'; ctx.fillRect(0, titleTop + 40, W, bottomY - titleTop - 40);
    var sc2 = ctx.createLinearGradient(0, bottomY, 0, bottomY + 90);
    sc2.addColorStop(0, 'rgba(15,15,16,0.72)'); sc2.addColorStop(1, 'rgba(15,15,16,0.15)');
    ctx.fillStyle = sc2; ctx.fillRect(0, bottomY, W, H - bottomY);
    drawLavaTitle(ctx, spec, m, titleTop, titleBottom);
    drawLavaBilling(ctx, spec, m, billY, billH);
  }

  // --- STYLE 6: Swiss International ------------------------------------------
  // Near-white paper (a cool Pantone-style off-white, deliberately not the brand cream),
  // Inter as the grotesk, flush-left ragged-right ink type on a strict column grid, one red
  // circle, black-and-white square photographs with ink keylines, red role labels, and a
  // flush-left information block on thick rules. No flag, no cross. Scale floor so it
  // reads at thumbnail: rules 4px, circle at least 20% of the short edge, title big. Every
  // run of type is large (bold at 19px or more) so red on the paper clears WCAG 3.0.
  var SWISS_PAPER = '#F2F2EE';
  var SWISS_RULE = 4, SWISS_CIRCLE_MIN = 216, SWISS_TITLE_MIN = 120;
  // Two-line floor per format: the post is shorter, so it gives up more title size to keep
  // the faces at a readable size.
  function swissTightFloor(spec) { return spec.format === 'story' ? 96 : 76; }

  // Fit the Swiss title: up to three lines at SWISS_TITLE_MIN or more, unless two lines at
  // a smaller size (down to the format's tight floor) fit, which gives the faces the difference.
  // Measured in Inter 700 (the shared fitTitle measures at 400, and bold wraps sooner).
  function swissFit(ctx, text, maxW, startPx, minPx, maxLines) {
    var px = startPx;
    while (px >= minPx) {
      ctx.font = '700 ' + px + 'px ' + FONT_BODY;
      var lines = wrapWords(ctx, text, maxW);
      if (lines.length <= maxLines) return { px: px, lines: lines, fits: true };
      px -= 4;
    }
    ctx.font = '700 ' + minPx + 'px ' + FONT_BODY;
    return { px: minPx, lines: wrapWords(ctx, text, maxW).slice(0, maxLines), fits: false };
  }
  function swissFitTitle(ctx, spec, text, maxW, startPx) {
    var loose = swissFit(ctx, text, maxW, startPx, SWISS_TITLE_MIN, 3);
    if (loose.lines.length <= 2) return loose;
    var tight = swissFit(ctx, text, maxW, startPx, swissTightFloor(spec), 2);
    return tight.fits ? tight : loose;
  }

  function swissTrack(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

  function drawSwissFace(ctx, it, cx, topY, w) {
    var x = cx - w / 2, k = SWISS_RULE;
    ctx.fillStyle = it.isHost ? '#E53935' : '#0F0F10'; ctx.fillRect(x, topY, w, w);
    if (it.img) drawMono(ctx, it.img, x + k, topY + k, w - 2 * k, w - 2 * k);
    else {
      ctx.fillStyle = '#FFF3E0'; ctx.fillRect(x + k, topY + k, w - 2 * k, w - 2 * k);
      ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.round(w * 0.5) + 'px ' + FONT_BODY;
      ctx.fillText((it.name || '?').charAt(0).toUpperCase(), cx, topY + w / 2 + 2);
    }
    if (it.headliner) { ctx.fillStyle = '#E53935'; ctx.fillRect(x, topY, w, k * 3); }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    var nameY = topY + w + Math.round(w * 0.17);
    var px = fitFont(ctx, firstName(it.name), w, Math.round(Math.min(34, w * 0.2)), 19, '700', FONT_BODY);
    ctx.fillStyle = '#0F0F10'; ctx.fillText(firstName(it.name), x, nameY);
    var role = it.isHost ? 'Host' : (it.headliner ? 'Headliner' : '');
    if (role) {
      ctx.fillStyle = '#E53935'; ctx.font = '700 ' + Math.max(19, Math.round(px * 0.8)) + 'px ' + FONT_BODY;
      ctx.fillText(role, x, nameY + Math.round(px * 0.95));
    }
  }

  function drawSwissTitle(ctx, spec, m, x, topY, maxW, avail) {
    var text = m.show ? splitTitle(m.show.title) : 'In Your Face';
    var ttl = swissFitTitle(ctx, spec, text, maxW, spec.format === 'story' ? 176 : 150);
    ctx.font = '700 ' + ttl.px + 'px ' + FONT_BODY;
    var lineH = ttl.px * 0.94, blockH = ttl.lines.length * lineH;
    while (blockH > avail && ttl.px > swissTightFloor(spec)) { ttl.px -= 4; lineH = ttl.px * 0.94; blockH = ttl.lines.length * lineH; ctx.font = '700 ' + ttl.px + 'px ' + FONT_BODY; }
    ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    swissTrack(ctx, -Math.round(ttl.px * 0.035));
    ttl.lines.forEach(function (ln, i) { ctx.fillText(ln, x - 4, topY + (i + 1) * lineH - lineH * 0.16); });
    swissTrack(ctx, 0);
    return topY + blockH;
  }

  function paintSwiss(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    var top = spec.keyTop, bottomY = H - spec.keyBottom, pad = spec.keySide + 24, x = pad, colW = W - pad * 2;
    ctx.fillStyle = SWISS_PAPER; ctx.fillRect(0, 0, W, H);
    // 1. header: three lines of small caps left, the logo right, a thick rule beneath
    var logoH = story ? 120 : 104, hy = top;
    ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 26px ' + FONT_BODY; swissTrack(ctx, 2);
    ['IN YOUR FACE COMEDY', 'ENGLISH STAND-UP', 'Z\u00DCRICH'].forEach(function (t, i) { ctx.fillText(t, x, hy + 30 + i * 34); });
    swissTrack(ctx, 0);
    if (m.logo) { var lw = logoH * (m.logo.width / m.logo.height); ctx.drawImage(m.logo, W - pad - lw, hy, lw, logoH); }
    var ruleY = hy + logoH + 16;
    ctx.fillStyle = '#0F0F10'; ctx.fillRect(x, ruleY, colW, SWISS_RULE);
    // 2. information block on the key-content bottom: date left, venue right, rule above
    var infoH = story ? 150 : 130, infoY = bottomY - infoH;
    ctx.fillRect(x, infoY, colW, SWISS_RULE);
    var dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? String(m.show.venue) : '';
    ctx.fillStyle = '#E53935'; ctx.font = '700 24px ' + FONT_BODY; swissTrack(ctx, 2);
    ctx.fillText('DATE', x, infoY + 44); ctx.fillText('VENUE', x + colW / 2, infoY + 44);
    swissTrack(ctx, 0);
    ctx.fillStyle = '#0F0F10'; ctx.font = '700 60px ' + FONT_BODY; swissTrack(ctx, -1);
    if (dl) ctx.fillText(dl, x, infoY + 112);
    swissTrack(ctx, 0);
    if (venue) { fitFont(ctx, venue, colW / 2 - 10, 44, 24, '700', FONT_BODY); ctx.fillText(venue, x + colW / 2, infoY + 108); }
    // 3. title block above the info block, sized to the title it holds (measured first so
    //    a one-line title gives its spare room to the faces), red circle behind its right end
    var tpx = story ? 176 : 150;
    var measured = swissFitTitle(ctx, spec, m.show ? splitTitle(m.show.title) : 'In Your Face', colW - 10, tpx);
    var titleH = Math.round(measured.lines.length * measured.px * 0.94) + 76, titleBottom = infoY - 36, titleTop = titleBottom - titleH;
    var cr = Math.max(SWISS_CIRCLE_MIN / 2, Math.round(Math.min(W, H) * 0.16));
    ctx.fillStyle = '#E53935'; ctx.beginPath(); ctx.arc(W - pad - cr * 0.55, titleTop + cr * 0.75, cr, 0, Math.PI * 2); ctx.fill();
    // tagline in red, flush left, above the title
    ctx.fillStyle = '#E53935'; ctx.font = '700 30px ' + FONT_BODY; ctx.textAlign = 'left';
    ctx.fillText('English stand-up comedy', x, titleTop + 30);
    drawSwissTitle(ctx, spec, m, x, titleTop + 56, colW - 10, titleH - 60);
    // 4. faces on the grid between the header rule and the title
    var friendsH = m.hasGuests ? 56 : 0;
    var facesTop = ruleY + 36, facesBottom = titleTop - 20 - friendsH;
    var bill = m.bill.slice();
    if (m.host && m.host.slug) bill.unshift({ slug: m.host.slug, name: m.host.name, img: m.host.img, priority: 'high', isHost: true });
    faceGrid(ctx, spec, bill, x, facesTop, colW, facesBottom - facesTop, 1.36, story ? 300 : 240,
      function (ctx, it, ccx, ty, w) { drawSwissFace(ctx, it, ccx, ty, w); });
    if (m.hasGuests) {
      ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '700 30px ' + FONT_BODY;
      ctx.fillText('\u2026 and friends', x, facesBottom + friendsH / 2);
    }
  }

  // --- STYLE 7: Lineup (mugshot wall) ------------------------------------------------
  // The Lineup Maker's own joke: a height-chart wall, every act in a mugshot frame holding
  // a placard with a case number, the headliner stamped PRIME SUSPECT, the host on a yellow
  // placard, the show title as the case name and "wanted for crimes against seriousness".

  // "IYF 260210": the jumbled show date, same as the ticket serial (pure, exported for tests).
  function caseNumber(slug, iso) { return 'IYF ' + showCode(slug, iso); }

  // The charge under the case name. One is picked per show + date + bill (the act slugs,
  // sorted, so order does not matter), so a given night's flyer always carries the same
  // line and the next date or a changed bill gets a fresh one. Pure; exported.
  function chargeLines() {
    return [
      'wanted for crimes against seriousness',
      'armed with punchlines and considered hilarious',
      'last seen leaving an audience in stitches',
      'charged with aggravated wordplay',
      'suspected of premeditated punchlines',
      'wanted for grievous bodily humour',
      'accused of disturbing the peace with laughter',
      'known to operate without a filter',
      'do not approach: may improvise',
      'guilty of excessive callbacks'
    ];
  }
  function chargeLine(slug, iso, acts) {
    var all = chargeLines();
    var bill = (acts || []).map(function (a) { return norm(a); }).sort().join(',');
    return all[ticketHash((slug || 'iyf') + '|' + (iso || '') + '|' + bill + '|charge') % all.length];
  }

  // Height-chart wall: an almost-white booking-room wall under a bright overhead light,
  // falling off to a soft grey at the borders so the edges read as shadow, with ink bands
  // every 60px, a heavier mark and a number every third.
  var WALL_WHITE = '#FAFAFA';
  function drawHeightWall(ctx, w, h) {
    ctx.save();
    ctx.fillStyle = WALL_WHITE; ctx.fillRect(0, 0, w, h);
    var light = ctx.createRadialGradient(w / 2, h * 0.28, h * 0.12, w / 2, h * 0.5, h * 0.78);
    light.addColorStop(0, 'rgba(15,15,16,0)'); light.addColorStop(0.55, 'rgba(15,15,16,0.05)'); light.addColorStop(1, 'rgba(15,15,16,0.22)');
    ctx.fillStyle = light; ctx.fillRect(0, 0, w, h);
    halftoneOverlay(ctx, 0, 0, w, h, '#0F0F10', 0.02);
    var step = 60, k = 0, cm = 200;
    for (var y = 30; y < h; y += step, k++) {
      var major = k % 3 === 0;
      ctx.fillStyle = major ? 'rgba(15,15,16,0.30)' : 'rgba(15,15,16,0.14)';
      ctx.fillRect(0, y, w, major ? 6 : 4);
      if (major) {
        ctx.fillStyle = 'rgba(15,15,16,0.45)'; ctx.font = '700 26px ' + FONT_BODY; ctx.textBaseline = 'bottom';
        ctx.textAlign = 'left'; ctx.fillText(String(cm), 10, y - 4);
        ctx.textAlign = 'right'; ctx.fillText(String(cm), w - 10, y - 4);
        cm -= 10;
      }
    }
    ctx.restore();
  }

  // One suspect: ink mugshot frame, placard with name (and a case number when there is room),
  // yellow placard for the host, PRIME SUSPECT stamp for the headliner.
  function drawLineupFace(ctx, it, cx, topY, w, code, idx) {
    var x = cx - w / 2, frame = Math.max(5, Math.round(w * 0.035));
    var placH = Math.round(w * 0.30), placY = topY + w + 6;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#0F0F10'; ctx.fillRect(x, topY, w, w);
    ctx.restore();
    if (it.img) drawCover(ctx, it.img, x + frame, topY + frame, w - 2 * frame, w - 2 * frame);
    else {
      ctx.fillStyle = '#2A2A2D'; ctx.fillRect(x + frame, topY + frame, w - 2 * frame, w - 2 * frame);
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(w * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((it.name || '?').charAt(0).toUpperCase(), cx, topY + w / 2 + 3);
    }
    // placard
    ctx.fillStyle = it.isHost ? '#FFD54F' : '#FFF8EE'; ctx.fillRect(x, placY, w, placH);
    ctx.strokeStyle = '#0F0F10'; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, placY + 1.5, w - 3, placH - 3);
    ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cap = (it.isHost ? 'HOST \u00B7 ' : '') + firstName(it.name).toUpperCase();
    var big = w >= 150;
    fitFont(ctx, cap, w - 14, Math.round(placH * (big ? 0.42 : 0.5)), 13, '700', FONT_BODY);
    ctx.fillText(cap, cx, placY + placH * (big ? 0.36 : 0.5) + 1);
    if (big) {
      ctx.font = '500 ' + Math.round(placH * 0.26) + 'px ' + FONT_BODY;
      ctx.fillText(code + '-' + ('0' + (idx + 1)).slice(-2), cx, placY + placH * 0.73);
    }
    if (it.headliner) drawStamp(ctx, 'PRIME SUSPECT', cx, topY + w - Math.round(w * 0.14), -8, Math.max(16, Math.round(w * 0.11)), '#E53935');
  }

  function paintLineup(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    var top = spec.keyTop, bottomY = H - spec.keyBottom, pad = spec.keySide + 14, cx = W / 2;
    var slug = m.show ? m.show.slug : '', iso = m.show ? m.show.next : '';
    var code = caseNumber(slug, iso);
    drawHeightWall(ctx, W, H);
    // 1. logo + tagline in ink from the key-content top, then the red case strip
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#0F0F10', top: top });
    var stripH = 44, stripY = headerBottom - 10;
    ctx.fillStyle = '#E53935'; ctx.fillRect(pad, stripY, W - pad * 2, stripH);
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 22px ' + FONT_BODY;
    ctx.fillText(spaced('LINEUP') + '   ·   ' + spaced('CASE ' + code.slice(4)) + '   ·   ' + spaced('ZÜRICH'), cx, stripY + stripH / 2 + 1);
    // 2. bottom block, measured before the faces are laid out so a two-line case name
    //    never lands on the suspects: meta bar, charge line, then the title block sized
    //    to the lines it actually needs (same fit as drawShowTitle: pad 64, floor 56, 2 lines)
    var metaH = 96, chargeH = 56;
    var metaY = bottomY - metaH, chargeY = metaY - chargeH;
    var titleBottom = chargeY - 6;
    var ttl = fitTitle(ctx, (m.show ? splitTitle(m.show.title) : 'IN YOUR FACE').toUpperCase(), W - 128, story ? 150 : 130, 56, 2, FONT_DISPLAY);
    var titleTop = titleBottom - Math.round(ttl.lines.length * ttl.px * 1.02);
    var labelY = titleTop - 26;
    // 3. suspects on the wall between the strip and the case name label
    var friendsH = m.hasGuests ? 56 : 0;
    var facesTop = stripY + stripH + 30, facesBottom = labelY - 40 - friendsH;
    var bill = m.bill.slice();
    if (m.host && m.host.slug) bill.unshift({ slug: m.host.slug, name: m.host.name, img: m.host.img, priority: 'high', isHost: true });
    faceGrid(ctx, spec, bill, pad, facesTop, W - pad * 2, facesBottom - facesTop, 1.34, story ? 250 : 210,
      function (ctx, it, ccx, ty, w, idx) { drawLineupFace(ctx, it, ccx, ty, w, code, idx); });
    if (m.hasGuests) {
      ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '38px ' + FONT_ACCENT;
      ctx.fillText('… and other known associates', cx, facesBottom + friendsH / 2);
    }
    // title as the case name, in ink on the lit wall; the charge in red marker
    ctx.fillStyle = '#E53935'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 24px ' + FONT_BODY; ctx.fillText(spaced('CASE NAME'), cx, labelY);
    drawShowTitle(ctx, spec, m, titleBottom, '#0F0F10', story ? 150 : 130, 2, false);
    ctx.fillStyle = '#E53935'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '36px ' + FONT_ACCENT;
    ctx.fillText(chargeLine(slug, iso, bill.map(function (b) { return b.slug; })), cx, chargeY + chargeH / 2);
    // date and scene on one ink bar, yellow labels, cream values
    var dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? String(m.show.venue).toUpperCase() : '';
    ctx.fillStyle = '#0F0F10'; ctx.fillRect(pad, metaY + 16, W - pad * 2, metaH - 24);
    ctx.textBaseline = 'middle'; var my = metaY + 16 + (metaH - 24) / 2 + 1;
    ctx.textAlign = 'left'; ctx.fillStyle = '#FFD54F'; ctx.font = '700 22px ' + FONT_BODY; ctx.fillText('DATE', pad + 22, my);
    ctx.fillStyle = '#FFF3E0'; ctx.font = '700 40px ' + FONT_BODY; if (dl) ctx.fillText(dl, pad + 100, my);
    ctx.textAlign = 'right'; ctx.font = '700 34px ' + FONT_BODY;
    if (venue) {
      fitFont(ctx, venue, (W - pad * 2) / 2 - 40, 34, 22, '700', FONT_BODY);
      ctx.fillText(venue, W - pad - 22, my);
      var vwid = ctx.measureText(venue).width;
      ctx.fillStyle = '#FFD54F'; ctx.font = '700 22px ' + FONT_BODY; ctx.fillText('SCENE', W - pad - 22 - vwid - 18, my);
    }
  }

  // Style registry - keys map to painters; unknown/empty falls back to classic.
  var FLYER_STYLES = {
    classic: paintFlyer,
    ticket: paintTicketStub,
    riso: paintRiso,
    neon: paintNeon,
    type: paintTypeStack,
    lava: paintLavaLamp,
    swiss: paintSwiss,
    lineup: paintLineup
  };

  // Resolve lineup state -> draw the flyer -> callback. done(err|null).
  function drawFlyer(canvas, st, format, style, done) {
    if (typeof style === 'function') { done = style; style = null; }
    var paint = FLYER_STYLES[style] || paintFlyer;
    var spec = flyerSpec(format);
    canvas.width = spec.w;
    canvas.height = spec.h;
    var ctx = canvas.getContext('2d');
    var s = findShow(st.show);
    var hostSlug = (st.host && findComedian(st.host)) ? canonical(st.host) : '';
    var raw = (st.type === 'split') ? st.first.concat(st.second) : st.lineup.slice();
    var billSlugs = resolveSlugs(raw).filter(function (x) { return norm(x) !== norm(hostSlug); });
    var hostC = hostSlug ? findComedian(hostSlug) : null;
    // Guests ride in the URL as guest:Name and are deliberately NOT pictured on the flyer.
    // If any are on the bill, the flyer shows fewer faces than the real lineup - flag it so
    // paintFlyer can add an "… and friends" line under the photos.
    var hasGuests = raw.some(function (t) { return isGuest(t); });

    var srcs = [assetURL(s && s.img), '/assets/img/inyourface.png', hostC ? assetURL(hostC.photo) : ''];
    billSlugs.forEach(function (sl) { var c = findComedian(sl); srcs.push(c ? assetURL(c.photo) : ''); });
    // Last: the audience backdrop for the ticket style (other painters ignore m.backdrop).
    srcs.push(assetURL(pickBackdrop()));

    loadBrandFonts()
      .then(function () { return Promise.all(srcs.map(loadImg)); })
      .then(function (imgs) {
        var bill = billSlugs.map(function (sl, i) {
          var c = findComedian(sl) || {};
          return { slug: sl, name: c.name || sl, priority: c.priority, img: imgs[3 + i], headliner: hasNorm(st.headliner, sl) };
        });
        paint(ctx, spec, {
          show: s, st: st, bg: imgs[0], logo: imgs[1],
          host: hostSlug ? { slug: hostSlug, name: (hostC && hostC.name) || hostSlug, img: imgs[2] } : null,
          bill: bill, hasGuests: hasGuests, nowMs: Date.now(),
          backdrop: imgs[imgs.length - 1]
        });
        if (done) done(null);
      })
      .catch(function (e) { if (done) done(e); });
  }

  function downloadCanvas(canvas, st, format, onFail) {
    var s = findShow(st.show);
    var base = (s ? splitTitle(s.title) : 'flyer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    // Filename carries the show name + its date (YYYY-MM-DD) - these get downloaded a lot.
    var d = (s && s.next) ? new Date(s.next) : null;
    var dateSlug = (d && !isNaN(d.getTime()))
      ? d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2)
      : '';
    downloadPng(canvas, [(base || 'flyer'), dateSlug, format].filter(Boolean).join('-') + '.png', onFail);
  }
  // Save a canvas as a PNG named fname (shared by the flyer and the week story).
  function downloadPng(canvas, fname, onFail) {
    function fail(e) { if (onFail) onFail(e); }
    function trigger(url, revoke) {
      try {
        var a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        if (revoke) setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      } catch (e) { fail(e); }
    }
    // Both export paths assume an untainted (same-origin) canvas; guard anyway so a
    // tainted canvas surfaces a message instead of an uncaught exception.
    try {
      if (canvas.toBlob) {
        canvas.toBlob(function (b) {
          if (b) { trigger(URL.createObjectURL(b), true); return; } // normal path
          try { trigger(canvas.toDataURL('image/png'), false); }    // null -> data-URL fallback
          catch (e) { fail(e); }
        }, 'image/png');
      } else {
        trigger(canvas.toDataURL('image/png'), false);
      }
    } catch (e) { fail(e); }
  }

  // Instagram handles for everyone ON the flyer (host + catalog bill), resolved with the SAME
  // resolveSlugs the flyer draws with - so the list always matches the faces shown and guests
  // (off-catalog, no instagram) are excluded for free. De-dupes case-insensitively, drops blanks.
  function flyerHandles(st) {
    var out = [], seen = {};
    function add(slug) {
      var c = findComedian(slug); if (!c) return;
      var h = instaHandle(c.instagram); if (!h) return;
      var k = h.toLowerCase(); if (seen[k]) return;
      seen[k] = 1; out.push(h);
    }
    var hostSlug = (st.host && findComedian(st.host)) ? canonical(st.host) : '';
    if (hostSlug) add(hostSlug);
    var raw = (st.type === 'split') ? st.first.concat(st.second) : st.lineup.slice();
    resolveSlugs(raw).filter(function (x) { return norm(x) !== norm(hostSlug); }).forEach(add);
    return out;
  }
  // Clipboard payload: one "@handle " per comedian, each on its own line (space + newline),
  // ready to paste into an Instagram story/post to tag everyone.
  function flyerHandlesText(st) {
    return flyerHandles(st).map(function (h) { return '@' + h + ' \n'; }).join('');
  }

  function ensureFlyerCss() {
    if (document.getElementById('iyf-flyer-css')) return;
    var st = document.createElement('style');
    st.id = 'iyf-flyer-css';
    st.textContent =
      '.lineup-lab__flyer{margin-top:1.5rem;padding:1.25rem;border-radius:14px;background:#1A1A1D;color:#FFF3E0}' +
      '.lineup-lab__flyer .lineup-lab__outputs-title{margin-top:0}' +
      '.lineup-lab__canvas{display:block;width:100%;max-width:420px;height:auto;margin:1rem auto;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.4)}' +
      '.lineup-lab__flyer .btn-ticket{display:block;width:100%;max-width:420px;margin:0 auto}' +
      '.lineup-lab__flyer-ig{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.6rem;max-width:420px;margin:.85rem auto 0}' +
      '.lineup-lab__flyer-ig .lineup-lab__copy--quiet{flex:1 1 auto}' +
      '.lineup-lab__flyer .lineup-lab__copy-hint{max-width:420px;margin:.35rem auto 0;text-align:center}' +
      '.lineup-lab__flyer .lineup-lab__fmt-toggle{display:flex;justify-content:center;width:max-content;max-width:100%;margin:0 auto .75rem}' +
      '.lineup-lab__flyer p.lineup-lab__copy-status{display:block;text-align:center;max-width:420px;margin:.5rem auto}' +
      '.lineup-lab__style-toggle{display:flex;flex-wrap:wrap;justify-content:center;gap:.4rem;border:0;overflow:visible;max-width:440px;margin:0 auto .6rem}' +
      '.lineup-lab__style-toggle .lineup-lab__fmt-btn{border:2px solid var(--border-strong,rgba(255,243,224,.4));border-radius:8px;font-size:.82rem;padding:.4rem .6rem}';
    document.head.appendChild(st);
  }

  // Build/refresh the flyer panel for a lineup snapshot. Format persists on the host.
  function openFlyer(container, st) {
    ensureFlyerCss();
    var fmt = container.__iyfFmt || 'story';
    var sty = container.__iyfStyle || 'classic';
    container.textContent = '';
    var panel = el('div', 'lineup-lab__flyer');
    panel.appendChild(el('h2', 'lineup-lab__outputs-title', '🎨 Share image'));
    panel.appendChild(el('p', 'lineup-lab__copy-hint',
      'A ready-to-post flyer built from this lineup. Pick a style + format and download.'));

    // Style toggle - eight looks, same lineup. Persists on the host like the format does.
    var styleToggle = el('div', 'lineup-lab__fmt-toggle lineup-lab__style-toggle');
    [['classic', '🎞️ Polaroid'], ['ticket', '🎟️ Ticket'], ['riso', '🖨️ Risograph'], ['neon', '🌃 Neon'], ['type', '🔠 Bold Type'],
     ['lava', '🫧 Lava'], ['swiss', '🔴 Swiss'], ['lineup', '📏 Lineup']].forEach(function (p) {
      var b = button('lineup-lab__fmt-btn' + (sty === p[0] ? ' is-on' : ''), p[1]);
      b.setAttribute('aria-pressed', sty === p[0] ? 'true' : 'false');
      b.addEventListener('click', function () { container.__iyfStyle = p[0]; openFlyer(container, st); });
      styleToggle.appendChild(b);
    });
    panel.appendChild(styleToggle);

    var toggle = el('div', 'lineup-lab__fmt-toggle');
    [['story', '📱 Story 9:16'], ['post', '🖼️ Post 4:5']].forEach(function (p) {
      var b = button('lineup-lab__fmt-btn' + (fmt === p[0] ? ' is-on' : ''), p[1]);
      b.setAttribute('aria-pressed', fmt === p[0] ? 'true' : 'false');
      b.addEventListener('click', function () { container.__iyfFmt = p[0]; openFlyer(container, st); });
      toggle.appendChild(b);
    });
    panel.appendChild(toggle);

    var canvas = el('canvas', 'lineup-lab__canvas');
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Generated show flyer preview');
    panel.appendChild(canvas);

    var status = el('p', 'lineup-lab__copy-status', 'Rendering…');
    panel.appendChild(status);
    var dl = el('button', 'btn-ticket', '⬇️ Download PNG');
    dl.type = 'button';
    dl.disabled = true;
    panel.appendChild(dl);

    // Copy every on-flyer comedian's Instagram @handle (one per line) for tagging in a story/post.
    var igRow = el('div', 'lineup-lab__flyer-ig');
    var ig = el('button', 'lineup-lab__copy lineup-lab__copy--quiet', '＠ Copy Insta handles');
    ig.type = 'button';
    var igStatus = el('span', 'lineup-lab__copy-status', '');
    ig.addEventListener('click', function () {
      var text = flyerHandlesText(st);
      if (!text) { igStatus.textContent = 'No Instagram handles on this lineup.'; return; }
      igStatus.textContent = '…';
      copy(text, igStatus);
    });
    igRow.appendChild(ig);
    igRow.appendChild(igStatus);
    panel.appendChild(igRow);
    panel.appendChild(el('p', 'lineup-lab__copy-hint', 'Paste into your story to tag everyone on the bill.'));

    container.appendChild(panel);

    drawFlyer(canvas, st, fmt, sty, function (err) {
      if (err) { status.textContent = 'Could not render the image — try again.'; return; }
      status.textContent = 'Looks good? Download and post it. 🎤';
      dl.disabled = false;
      dl.addEventListener('click', function () {
        downloadCanvas(canvas, st, fmt, function () { status.textContent = 'Download failed — long-press / right-click the image to save it.'; });
      });
    });
  }

  // ===========================================================================
  // WEEK STORY (/week/): the Sunday "shows this week" story and post, drawn from the
  // calendar data (every occurrence, not the one next date a post carries). Root is
  // #iyf-week; events come from #iyf-week-events and resolve against the shows catalog.
  // State lives in the URL: from=YYYY-MM-DD, style, format, v (copy variant).
  // ===========================================================================

  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function parseYmd(s) {
    var mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
    if (!mm) return null;
    var d = new Date(+mm[1], +mm[2] - 1, +mm[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  // The from-day plus the following seven: eight calendar days inclusive, so a show this
  // Sunday and one next Sunday are both in. Pure; exported.
  function weekWindow(fromIso) {
    var d = parseYmd(fromIso) || new Date();
    var from = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7);
    return { from: ymd(from), to: ymd(to) };
  }
  // Calendar events inside the window, earliest first. Pure; exported.
  function weekEvents(events, fromIso) {
    var w = weekWindow(fromIso);
    return (events || []).filter(function (e) {
      var d = String(e.date || '').slice(0, 10);
      return d >= w.from && d <= w.to;
    }).sort(function (a, b) {
      var ka = String(a.start || a.date || ''), kb = String(b.start || b.date || '');
      return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });
  }
  // Headline pool. {n} is the number of shows in the window (lines with it are skipped when
  // there are fewer than two). The image carries no call to action: the link sticker Harry
  // adds in Instagram is the call to action. Pure; exported for review and tests.
  function weekHeadlines() {
    // Harry's rules (2026-09-12 review): nothing bossy, no "you" or "your".
    return ['THIS WEEK', 'COMEDY THIS WEEK', '{n} SHOWS, 7 NIGHTS', 'THE WEEK AHEAD', 'PLANS?',
      'PICK A NIGHT', 'THIS WEEK IN ZÜRICH', 'COMING UP', 'A WEEK OF LAUGHS', '{n} REASONS TO GO OUT',
      "WHAT'S ON", 'LAUGHTER, SCHEDULED'];
  }
  // Same week + same variant = same words. The page rolls a random variant on each fresh load
  // and writes it into the URL; "other words" bumps it. Pure; exported.
  function weekCopy(fromIso, variant, n) {
    var w = weekWindow(fromIso), v = (variant | 0), hs = weekHeadlines();
    var h = hs[ticketHash(w.from + '|week|head|' + v) % hs.length];
    n = (n == null) ? 0 : (n | 0);
    if (h.indexOf('{n}') >= 0) h = n >= 2 ? h.replace('{n}', String(n)) : hs[0];
    return { headline: h };
  }
  function weekShowFor(e, shows) {
    var k = norm(e && e.show);
    for (var i = 0; i < (shows || []).length; i++) if (norm(shows[i].slug) === k) return shows[i];
    return null;
  }
  function weekDayLabel(dateStr) { var d = parseYmd(dateStr); return d ? WD[d.getDay()].toUpperCase() : ''; }
  function weekDateLabel(dateStr) { var d = parseYmd(dateStr); return d ? d.getDate() + ' ' + MO[d.getMonth()].toUpperCase() : ''; }
  // The show page's second title: "Comedy Brew • English Stand-Up Comedy Open Mic • ..." gives
  // "English Stand-Up Comedy Open Mic"; a title without one gives ''. Pure; exported.
  function showTagline(t) {
    var parts = (t || '').replace(/ - /g, ' • ').split('•').map(function (s) { return s.trim(); }).filter(Boolean);
    return parts[1] || '';
  }
  // "15 Sept": the date the way the station board prints it. Pure; exported.
  function weekDateBoard(dateStr) {
    var d = parseYmd(dateStr), MB = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
    return d ? d.getDate() + ' ' + MB[d.getMonth()] : '';
  }
  // The calendar page's Info line for an event: the line assigned to that show on that date
  // by refresh-calendar-page.rb (so the story says what /calendar/ says). '' when none. Pure; exported.
  function weekInfoFor(infos, e) {
    var k = norm(e && e.show), d = String(e && e.date || '');
    for (var i = 0; i < (infos || []).length; i++) if (infos[i] && norm(infos[i].show) === k && String(infos[i].date) === d) return String(infos[i].info || '').trim();
    return '';
  }
  // Drop pictographs, variation selectors and joiners: for the objects that never show an emoji. Pure; exported.
  function stripEmoji(s) { return String(s || '').replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F100}-\u{1F1E5}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/\s+/g, ' ').trim(); }
  // The venue as the image prints it: the first two words (Harry: the museum's full name was
  // throwing the flyers off). The caption keeps the full name. Pure; exported.
  function weekVenueShort(venue) { return String(venue || '').trim().split(/\s+/).slice(0, 2).join(' '); }
  function weekDateNice(dateStr) { var d = parseYmd(dateStr); return d ? d.getDate() + ' ' + MO[d.getMonth()] : ''; }   // "13 Sep", for running text
  function weekTime(e) { var mm = /T(\d{2}:\d{2})/.exec(String(e && e.start || '')); return mm ? mm[1] : ''; }
  function weekShowName(e, shows) { var s = weekShowFor(e, shows); return s ? splitTitle(s.title) : String(e.name || e.show || ''); }
  // Instagram handles of the regular hosts of every show in the window, in show order,
  // de-duplicated. Shows without hosts (a one-off with a touring act) add nothing. Pure; exported.
  function weekHandles(events, shows, comedians) {
    var out = [], seen = {};
    (events || []).forEach(function (e) {
      var s = weekShowFor(e, shows);
      ((s && s.hosts) || []).forEach(function (slug) {
        var k = norm(slug), c = null;
        for (var i = 0; i < (comedians || []).length; i++) if (norm(comedians[i].slug) === k) { c = comedians[i]; break; }
        var h = c ? instaHandle(c.instagram) : '';
        if (!h) return;
        var hk = h.toLowerCase(); if (seen[hk]) return;
        seen[hk] = 1; out.push(h);
      });
    });
    return out;
  }
  function weekHandlesText(events, shows, comedians) {
    return weekHandles(events, shows, comedians).map(function (h) { return '@' + h + ' \n'; }).join('');
  }
  // Plain-text caption for a post: one line per show, then the tagged calendar link. Pure; exported.
  function weekCaption(events, shows, fromIso, infos) {
    var lines = ['This week at IN YOUR FACE Comedy 🎤', ''];
    (events || []).forEach(function (e) {
      var d = parseYmd(e.date);
      var when = d ? WD[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()] : String(e.date || '');
      lines.push([when, weekTime(e), weekShowName(e, shows), e.venue].filter(Boolean).join(' · '));
      var info = weekInfoFor(infos, e);
      if (info) lines.push('   ' + info);
    });
    if (!(events || []).length) lines.push('No shows in this window. The calendar has the next ones.');
    lines.push('');
    lines.push('Full calendar + tickets: ' + WEEK_CAL_LINK);
    return lines.join('\n');
  }

  // --- week painters ----------------------------------------------------------
  // Model m: { rows: [{ e, name, day, date, time, venue, serial, thumb }], from, copy: {headline},
  //            logo, backdrop, n }.
  var WEEK_INK = '#0F0F10', WEEK_CREAM = '#FFF3E0', WEEK_YELLOW = '#FFD54F', WEEK_RED = '#E53935';

  function weekLogo(ctx, spec, m, top, h) {
    if (!m.logo) return top + h;
    var lw = h * (m.logo.width / m.logo.height);
    ctx.drawImage(m.logo, spec.w / 2 - lw / 2, top, lw, h);
    return top + h;
  }
  // Headline in the display face, at most two lines, centred. Returns the bottom Y.
  function weekHeadline(ctx, spec, text, topY, color, startPx, family, weight) {
    var maxW = spec.w - (spec.keySide + 20) * 2;
    var fam = family || FONT_DISPLAY, wt = weight || '400';
    var px = startPx, lines;
    while (px >= 48) {
      ctx.font = wt + ' ' + px + 'px ' + fam;
      lines = wrapWords(ctx, text, maxW);
      if (lines.length <= 2) break;
      px -= 4;
    }
    var lineH = px * 1.04;
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach(function (ln, i) { ctx.fillText(ln, spec.w / 2, topY + (i + 1) * lineH - lineH * 0.16); });
    return topY + lines.length * lineH;
  }
  // The rows stop this far above the key-area floor (the link sticker zone is below it).
  function weekFloor(spec) { return spec.h - spec.keyBottom - 24; }
    // Split a rows band: as many rows as events, capped, evenly spaced.
    function weekRowH(bandH, n, gap, cap) { return n ? Math.min(cap, (bandH - gap * (n - 1)) / n) : 0; }
  // The calendar's Info line for a row: at most maxLines lines (two by default), shrinking by
  // 2 px only when that many lines will not hold it. One fitted line of 64 characters in a
  // 600 px column lands at 18 px; two lines at 24 px read on a phone (1 canvas px is about
  // 0.36 pt on a story). Leaves ctx.font set to the chosen size. Exported.
  function weekInfoLines(ctx, text, maxW, startPx, minPx, weight, family, maxLines) {
    var str = String(text || '').trim(), cap = maxLines || 2;
    if (!str) return { px: startPx, lines: [] };
    var px = startPx, lines;
    for (;;) {
      ctx.font = (weight ? weight + ' ' : '') + px + 'px ' + family;
      lines = wrapWords(ctx, str, maxW);
      var fits = lines.length <= cap && lines.every(function (ln) { return ctx.measureText(ln).width <= maxW; });
      if (fits || px <= minPx) break;
      px -= 2;
    }
    return { px: px, lines: lines.slice(0, cap) };
  }
  // The show's own artwork (thumbnail, else card image) in a rounded square with a keyline,
  // centre-cropped: every thumbnail on the site is square or 4:5, so the crop keeps the subject.
  function weekThumb(ctx, img, x, y, s, ring, mono, fallbackText) {
    ctx.save();
    roundRect(ctx, x, y, s, s, Math.round(s * 0.12)); ctx.fillStyle = ring; ctx.fill();
    var k = 4;
    roundRect(ctx, x + k, y + k, s - 2 * k, s - 2 * k, Math.round(s * 0.09)); ctx.clip();
    if (img && mono) drawMono(ctx, img, x + k, y + k, s - 2 * k, s - 2 * k);
    else if (img) drawCover(ctx, img, x + k, y + k, s - 2 * k, s - 2 * k);
    else {
      ctx.fillStyle = '#2A2A2D'; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = WEEK_YELLOW; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(s * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((fallbackText || '?').charAt(0).toUpperCase(), x + s / 2, y + s / 2 + 3);
    }
    ctx.restore();
  }
  function weekEmpty(ctx, spec, m, color, font) {
    ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 ' + (spec.format === 'story' ? 64 : 56) + 'px ' + font;
    ctx.fillText('NO SHOWS THIS WEEK', spec.w / 2, spec.h / 2 - 30);
    ctx.font = '600 34px ' + FONT_BODY;
    ctx.fillText('The calendar has the next ones', spec.w / 2, spec.h / 2 + 40);
  }

  // STYLE: Bold Type. Ink field, giant weekday words, red CTA bar.
  function paintWeekType(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 14;
    ctx.fillStyle = WEEK_INK; ctx.fillRect(0, 0, W, H);
    var y = weekLogo(ctx, spec, m, spec.keyTop + 10, story ? 108 : 88) + (story ? 30 : 20);
    y = weekHeadline(ctx, spec, m.copy.headline, y, WEEK_CREAM, story ? 124 : 104) + (story ? 26 : 18);
    if (!m.rows.length) { weekEmpty(ctx, spec, m, WEEK_YELLOW, FONT_DISPLAY); return; }
    var bandTop = y, bandBot = weekFloor(spec), gap = 8;
    var rowH = weekRowH(bandBot - bandTop, m.rows.length, gap, story ? 200 : 156);
    var startY = bandTop + Math.max(0, (bandBot - bandTop - (rowH * m.rows.length + gap * (m.rows.length - 1))) / 2);
    m.rows.forEach(function (row, i) {
      var top = startY + i * (rowH + gap), cy = top + rowH / 2;
      if (i) { ctx.fillStyle = '#2A2A2D'; ctx.fillRect(pad, top - gap / 2, W - pad * 2, 2); }
      // show artwork on the right
      var ts = Math.round(rowH * 0.8);
      weekThumb(ctx, row.thumb, W - pad - ts, cy - ts / 2, ts, WEEK_CREAM, false, row.name);
      var leftEdge = W - pad - ts - 24;
      // day word (rowH 0.62: the name column needs the width more than the day needs the size)
      var dayPx = Math.round(rowH * 0.62);
      ctx.fillStyle = WEEK_YELLOW; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + dayPx + 'px ' + FONT_DISPLAY;
      ctx.fillText(row.day, pad, cy + 2);
      var dayW = ctx.measureText(row.day).width;
      ctx.fillStyle = WEEK_CREAM; ctx.font = '700 ' + Math.round(rowH * 0.2) + 'px ' + FONT_BODY;
      ctx.fillText(row.date, pad + dayW + 14, cy - rowH * 0.14);
      ctx.fillStyle = '#B9B2A6';
      if (row.time) ctx.fillText(row.time, pad + dayW + 14, cy + rowH * 0.14);
      // name, venue, then the calendar's Info line in up to two lines; the stack is centred on the row
      var nx = pad + dayW + 14 + Math.max(ctx.measureText(row.date).width, ctx.measureText(row.time || '').width) + 30;
      var nameW = Math.max(120, leftEdge - nx);
      var info = row.info ? weekInfoLines(ctx, row.info, nameW, Math.round(rowH * 0.2), 16, '500', FONT_BODY) : { lines: [] };
      var k = info.lines.length, nameH = k ? 0.3 : 0.42, subH = k ? 0.15 : 0.17, pitch = 0.21, top = cy - rowH * (nameH + subH + pitch * k) / 2;
      ctx.fillStyle = WEEK_CREAM;
      fitFont(ctx, row.name.toUpperCase(), nameW, Math.round(rowH * nameH), 24, '400', FONT_DISPLAY);
      ctx.fillText(row.name.toUpperCase(), nx, top + rowH * nameH / 2 + 2);
      ctx.fillStyle = '#B9B2A6';
      var venue = String(row.venue || '').toUpperCase();
      fitFont(ctx, venue, nameW, Math.round(rowH * subH), 16, '600', FONT_BODY);
      ctx.fillText(venue, nx, top + rowH * (nameH + subH / 2));
      if (k) {
        ctx.fillStyle = WEEK_CREAM; ctx.globalAlpha = 0.92; ctx.font = '500 ' + info.px + 'px ' + FONT_BODY;
        info.lines.forEach(function (ln, li) { ctx.fillText(ln, nx, top + rowH * (nameH + subH + pitch * (li + 0.5))); });
        ctx.globalAlpha = 1;
      }
    });
  }

  // STYLE: Swiss timetable. Near-white paper, small caps header, red rules, mono faces.
  function paintWeekSwiss(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 16, k = SWISS_RULE;
    ctx.fillStyle = SWISS_PAPER; ctx.fillRect(0, 0, W, H);
    var top = spec.keyTop + 10;
    // header: small caps left, logo right, 4px rule
    ctx.fillStyle = WEEK_INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 26px ' + FONT_BODY; swissTrack(ctx, 4);
    ctx.fillText(spaced('IN YOUR FACE COMEDY'), pad, top + 40); swissTrack(ctx, 0);
    ctx.font = '500 26px ' + FONT_BODY; ctx.fillText('Zürich · ' + weekDateLabel(m.from) + ' to ' + weekDateLabel(weekWindow(m.from).to), pad, top + 78);
    if (m.logo) { var lh = 80, lw = lh * (m.logo.width / m.logo.height); ctx.drawImage(m.logo, W - pad - lw, top + 4, lw, lh); }
    ctx.fillStyle = WEEK_INK; ctx.fillRect(pad, top + 104, W - pad * 2, k);
    var y = top + 104 + (story ? 60 : 40);
    // headline with the red circle behind its end
    var hx = m.copy.headline.charAt(0) + m.copy.headline.slice(1).toLowerCase();
    var px = story ? 108 : 88; ctx.font = '700 ' + px + 'px ' + FONT_BODY;
    var lines = wrapWords(ctx, hx, W - pad * 2);
    while (lines.length > 2 && px > 56) { px -= 4; ctx.font = '700 ' + px + 'px ' + FONT_BODY; lines = wrapWords(ctx, hx, W - pad * 2); }
    var lastW = ctx.measureText(lines[lines.length - 1]).width;
    ctx.fillStyle = WEEK_RED; ctx.beginPath();
    ctx.arc(Math.min(pad + lastW + 10, W - spec.keySide - px * 0.42), y + (lines.length - 1) * px * 1.06 + px * 0.28, px * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = WEEK_INK; ctx.textAlign = 'left';
    lines.forEach(function (ln, i) { ctx.fillText(ln, pad, y + (i + 1) * px * 1.06 - px * 0.14); });
    y += lines.length * px * 1.06 + (story ? 40 : 26);
    if (!m.rows.length) { weekEmpty(ctx, spec, m, WEEK_INK, FONT_BODY); return; }
    ctx.fillStyle = WEEK_RED; ctx.fillRect(pad, y, W - pad * 2, k); y += k + 6;
    var gap = 6, bandBot = weekFloor(spec);
    var rowH = weekRowH(bandBot - y, m.rows.length, gap, story ? 180 : 146);
    m.rows.forEach(function (row, i) {
      var t = y + i * (rowH + gap), cy = t + rowH / 2;
      // show artwork right, black and white with an ink keyline like the Swiss flyer's photos
      var s = Math.round(rowH * 0.8), x = W - pad - s;
      weekThumb(ctx, row.thumb, x, cy - s / 2, s, WEEK_INK, true, row.name);
      x -= s + 8;
      var rightLimit = x + s + 8 - 24;
      // day column
      ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillStyle = WEEK_RED; ctx.font = '700 ' + Math.round(rowH * 0.2) + 'px ' + FONT_BODY;
      ctx.fillText(row.day.charAt(0) + row.day.slice(1).toLowerCase(), pad, cy - rowH * 0.24);
      ctx.fillStyle = WEEK_INK; ctx.font = '700 ' + Math.round(rowH * 0.44) + 'px ' + FONT_BODY;
      var dnum = String(parseInt(row.date, 10) || '');
      ctx.fillText(dnum, pad, cy + rowH * 0.14);
      var dayColW = Math.max(ctx.measureText('30').width, 70) + 26;
      // name, then the time (bold) and venue (grey) on one line, then the calendar's Info line
      // in regular ink, up to two lines, emoji stripped: the timetable stays quiet
      var tx = pad + dayColW, nameW = Math.max(120, rightLimit - tx);
      var info = row.info ? weekInfoLines(ctx, stripEmoji(row.info), nameW, Math.round(rowH * 0.19), 15, '400', FONT_BODY) : { lines: [] };
      var k = info.lines.length, nameH = k ? 0.28 : 0.3, subH = k ? 0.16 : 0.19, pitch = 0.2, top = cy - rowH * (nameH + subH + pitch * k) / 2;
      ctx.fillStyle = WEEK_INK;
      fitFont(ctx, row.name, nameW, Math.round(rowH * nameH), 22, '700', FONT_BODY);
      ctx.fillText(row.name, tx, top + rowH * nameH / 2);
      var subPx = Math.round(rowH * subH), sy = top + rowH * (nameH + subH / 2), tw = 0;
      ctx.font = '700 ' + subPx + 'px ' + FONT_BODY;
      if (row.time) { ctx.fillText(row.time, tx, sy); tw = ctx.measureText(row.time + '   ').width; }
      ctx.fillStyle = '#5A5A5E';
      fitFont(ctx, String(row.venue || ''), nameW - tw, subPx, 14, '500', FONT_BODY);
      ctx.fillText(String(row.venue || ''), tx + tw, sy);
      if (k) {
        ctx.fillStyle = WEEK_INK; ctx.font = '400 ' + info.px + 'px ' + FONT_BODY;
        info.lines.forEach(function (ln, li) { ctx.fillText(ln, tx, top + rowH * (nameH + subH + pitch * (li + 0.5))); });
      }
      if (i < m.rows.length - 1) { ctx.fillStyle = WEEK_INK; ctx.fillRect(pad, t + rowH + gap / 2 - 1, W - pad * 2, 2); }   // rules between rows only: the last one fell 2 px under the key floor
    });
  }

  // STYLE: Ticket strip. One admission stub per show on the show's dark paper, the crowd behind.
  function paintWeekTicket(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 10;
    var P = ticketPalette('week|' + m.from);
    ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, H);
    if (m.backdrop) { ctx.save(); ctx.globalAlpha = 0.16; drawMono(ctx, m.backdrop, 0, 0, W, H); ctx.restore(); }
    var y = weekLogo(ctx, spec, m, spec.keyTop + 10, story ? 116 : 92) + (story ? 30 : 20);
    y = weekHeadline(ctx, spec, m.copy.headline, y, P.ink, story ? 120 : 100) + (story ? 26 : 16);
    if (!m.rows.length) { weekEmpty(ctx, spec, m, P.ink, FONT_DISPLAY); return; }
    var gap = 10, bandBot = weekFloor(spec);
    var rowH = weekRowH(bandBot - y, m.rows.length, gap, story ? 190 : 148);
    var startY = y + Math.max(0, (bandBot - y - (rowH * m.rows.length + gap * (m.rows.length - 1))) / 2);
    var stubCream = '#FBF7EE', stubInk = '#2B2B2B';
    m.rows.forEach(function (row, i) {
      var t = startY + i * (rowH + gap), x = pad, w = W - pad * 2, cy = t + rowH / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
      ctx.fillStyle = stubCream; roundRect(ctx, x, t, w, rowH, 10); ctx.fill();
      ctx.restore();
      // day block on the left, in the paper colour
      var dayW = Math.round(rowH * 1.05);
      ctx.save(); roundRect(ctx, x, t, w, rowH, 10); ctx.clip();
      ctx.fillStyle = P.paper; ctx.fillRect(x, t, dayW, rowH);
      ctx.restore();
      // perforation between the day block and the stub
      ctx.fillStyle = stubCream;
      for (var py = t + 10; py < t + rowH - 4; py += 18) { ctx.beginPath(); ctx.arc(x + dayW, py, 5, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(rowH * 0.42) + 'px ' + FONT_DISPLAY;
      ctx.fillText(row.day, x + dayW / 2, cy - rowH * 0.12);
      ctx.font = '700 ' + Math.round(rowH * 0.18) + 'px ' + FONT_BODY;
      ctx.fillText(row.date, x + dayW / 2, cy + rowH * 0.24);
      // show artwork on the right, ink frame, mono like the ticket flyer's prints
      var s = Math.round(rowH * 0.76), fx = x + w - 16 - s;
      weekThumb(ctx, row.thumb, fx, cy - s / 2, s, stubInk, true, row.name);
      fx -= s + 8;
      var rightLimit = fx + s + 8 - 20;
      // name at the top of the stub, the time and venue under it, then the calendar's Info line
      // as the stub's small print in up to two lines (no serial: it read as noise)
      var nx = x + dayW + 22, nameW = Math.max(120, rightLimit - nx);
      ctx.textAlign = 'left';
      var info = row.info ? weekInfoLines(ctx, row.info, nameW, Math.round(rowH * 0.2), 16, '500', FONT_BODY) : { lines: [] };
      var three = info.lines.length > 0;
      ctx.fillStyle = stubInk;
      fitFont(ctx, row.name.toUpperCase(), nameW, Math.round(rowH * (three ? 0.3 : 0.38)), 22, '400', FONT_DISPLAY);
      ctx.fillText(row.name.toUpperCase(), nx, t + rowH * (three ? 0.22 : 0.38));
      var sub = [row.time, row.venue].filter(Boolean).join(' · ').toUpperCase();
      ctx.fillStyle = P.paper === '#2B2B2B' ? '#C43E33' : P.paper;
      fitFont(ctx, sub, nameW, Math.round(rowH * (three ? 0.15 : 0.16)), 14, '700', FONT_BODY);
      ctx.fillText(sub, nx, t + rowH * (three ? 0.45 : 0.7));
      if (three) {
        ctx.fillStyle = stubInk; ctx.globalAlpha = 0.85; ctx.font = '500 ' + info.px + 'px ' + FONT_BODY;
        var ly = t + rowH * (info.lines.length > 1 ? 0.64 : 0.74);
        info.lines.forEach(function (ln, li) { ctx.fillText(ln, nx, ly + li * rowH * 0.21); });
        ctx.globalAlpha = 1;
      }
    });
  }

  // Polaroid for a show: the show's own artwork, the show name as caption, a yellow day tag
  // pinned to the corner. Own caption logic: firstName() would cut "Comedy Brew".
  function drawWeekPolaroid(ctx, row, cx, topY, w, tilt) {
    // Taller top border than a real polaroid: the day tag sits on the frame, never on the artwork.
    var frame = Math.round(w * 0.06), topF = Math.round(w * 0.17), photo = w - frame * 2, capH = Math.round(w * 0.24), h = topF + photo + capH;
    ctx.save();
    ctx.translate(cx, topY + h / 2); ctx.rotate(tilt * Math.PI / 180);
    ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 12;
    ctx.fillStyle = '#FFF8EE'; roundRect(ctx, -w / 2, -h / 2, w, h, 8); ctx.fill();
    ctx.shadowColor = 'transparent';
    var px = -w / 2 + frame, py = -h / 2 + topF;
    ctx.save(); roundRect(ctx, px, py, photo, photo, 4); ctx.clip();
    ctx.fillStyle = WEEK_INK; ctx.fillRect(px, py, photo, photo);
    if (row.thumb) drawCover(ctx, row.thumb, px, py, photo, photo);
    else {
      ctx.fillStyle = WEEK_YELLOW; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((row.name || '?').charAt(0).toUpperCase(), px + photo / 2, py + photo / 2 + 4);
    }
    ctx.restore();
    // caption: the show name, fitted whole
    var cap = row.name.toUpperCase();
    ctx.fillStyle = WEEK_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, cap, photo, Math.round(capH * 0.5), 16, '', FONT_ACCENT);
    var capY = -h / 2 + topF + photo;
    if (ctx.measureText(cap).width > photo) {
      // Long show name on a small card: two lines take the whole caption band, no sub line.
      ctx.font = Math.round(capH * 0.36) + 'px ' + FONT_ACCENT;
      var cl = wrapWords(ctx, cap, photo).slice(0, 2);
      cl.forEach(function (ln, li) { ctx.fillText(ln, 0, capY + capH * (cl.length === 1 ? 0.5 : 0.3 + li * 0.42)); });
    } else {
      ctx.fillText(cap, 0, capY + capH * 0.42);
      var sub = [row.time, row.venue].filter(Boolean).join(' · ');
      ctx.fillStyle = '#5A5A5E';
      fitFont(ctx, sub, photo, Math.round(capH * 0.2), 11, '600', FONT_BODY);
      ctx.fillText(sub, 0, capY + capH * 0.8);
    }
    // day tag, yellow, on the top border, a touch askew
    var tag = row.day + ' ' + parseInt(row.date, 10);
    ctx.font = '700 ' + Math.round(w * 0.09) + 'px ' + FONT_BODY;
    var tw = ctx.measureText(tag).width + 28, th = Math.round(w * 0.12);
    ctx.save(); ctx.translate(-w / 2 + frame + 2, -h / 2 + (topF - th) / 2 + 2); ctx.rotate(-3 * Math.PI / 180);
    ctx.fillStyle = WEEK_YELLOW; roundRect(ctx, 0, 0, tw, th, 6); ctx.fill();
    ctx.fillStyle = WEEK_INK; ctx.fillText(tag, tw / 2, th / 2 + 1);
    ctx.restore();
    ctx.restore();
    return h;
  }

  // STYLE: Polaroid wall. Dark field, one polaroid per show in a grid, yellow marker headline.
  function paintWeekPolaroid(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1A1A1D'); g.addColorStop(1, '#2A2A2D');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    var rg = ctx.createRadialGradient(W / 2, H * 0.45, 50, W / 2, H * 0.45, H * 0.7);
    rg.addColorStop(0, 'rgba(183,28,28,0.28)'); rg.addColorStop(1, 'rgba(183,28,28,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    var y = weekLogo(ctx, spec, m, spec.keyTop + 10, story ? 130 : 100) + (story ? 30 : 18);
    y = weekHeadline(ctx, spec, m.copy.headline, y, WEEK_YELLOW, story ? 124 : 100) + (story ? 26 : 16);
    if (!m.rows.length) { weekEmpty(ctx, spec, m, WEEK_CREAM, FONT_DISPLAY); return; }
    var n = m.rows.length, bandTop = y, bandBot = weekFloor(spec), bandH = bandBot - bandTop, bandW = W - (spec.keySide + 18) * 2;   // tilted corners stay inside the sides
    var ratio = 1.47, gap = 24, best = 0, cols = 1, rows = n;
    for (var c = 1; c <= Math.min(n, 4); c++) {
      var rws = Math.ceil(n / c), bw = (bandW - gap * (c - 1)) / c, bh = (bandH - gap * (rws - 1)) / (rws * ratio);
      var cand = Math.min(bw, bh, story ? 520 : 420);
      if (cand > best) { best = cand; cols = c; rows = rws; }
    }
    var w = best, h = w * ratio, gridH = rows * h + (rows - 1) * gap;
    var startY = bandTop + Math.max(0, (bandH - gridH) / 2);
    for (var r = 0; r < rows; r++) {
      var items = m.rows.slice(r * cols, (r + 1) * cols);
      var rowW = items.length * w + (items.length - 1) * gap, x0 = W / 2 - rowW / 2;
      for (var i = 0; i < items.length; i++) {
        var idx = r * cols + i;
        drawWeekPolaroid(ctx, items[i], x0 + i * (w + gap) + w / 2, startY + r * (h + gap), w, TILTS[idx % TILTS.length]);
      }
    }
  }

  // STYLE: Lava list. The Lava Lamp flyer's field (ink warming to red-deep, stars, glowing
  // blobs seeded from the window) carrying a list: each event is a wobbly hot blob with the
  // weekday and date, the show name in cream on a smoked-glass pill, the artwork in a space
  // helmet. Blobs stay out of the headline band; the pills dim whatever swims behind a row.
  function weekLavaTitle(ctx, spec, text, topY, startPx) {
    var maxW = spec.w - (spec.keySide + 20) * 2, px = startPx, lines;
    while (px >= 48) {
      ctx.font = '400 ' + px + 'px ' + FONT_DISPLAY;
      lines = wrapWords(ctx, text, maxW);
      if (lines.length <= 2) break;
      px -= 4;
    }
    var lineH = px * 1.04, off = Math.max(6, Math.round(px * 0.06)), cx = spec.w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach(function (ln, i) {
      var y = topY + (i + 1) * lineH - lineH * 0.16;
      ctx.fillStyle = '#B71C1C'; ctx.fillText(ln, cx + off * 2, y + off * 2);
      ctx.fillStyle = WEEK_INK; ctx.fillText(ln, cx + off, y + off);
      ctx.fillStyle = WEEK_YELLOW; ctx.fillText(ln, cx, y);
    });
    return topY + lines.length * lineH;
  }
  // Artwork in a space helmet: cream rim, the print, a warm tint low, a highlight arc high left.
  function weekHelmet(ctx, img, cx, cy, r, fallbackText) {
    var ri = r - 6;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = WEEK_CREAM; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2); ctx.clip();
    if (img) drawCover(ctx, img, cx - ri, cy - ri, 2 * ri, 2 * ri);
    else {
      ctx.fillStyle = '#2A2A2D'; ctx.fillRect(cx - ri, cy - ri, 2 * ri, 2 * ri);
      ctx.fillStyle = WEEK_YELLOW; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(ri) + 'px ' + FONT_DISPLAY;
      ctx.fillText((fallbackText || '?').charAt(0).toUpperCase(), cx, cy + 3);
    }
    var tint = ctx.createLinearGradient(0, cy - ri, 0, cy + ri);
    tint.addColorStop(0, 'rgba(255,243,224,0)'); tint.addColorStop(1, 'rgba(183,28,28,0.35)');
    ctx.fillStyle = tint; ctx.fillRect(cx - ri, cy - ri, 2 * ri, 2 * ri);
    ctx.strokeStyle = 'rgba(255,248,238,0.85)'; ctx.lineWidth = Math.max(4, ri * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, cy, ri * 0.78, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
    ctx.restore();
  }
  function paintWeekLava(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 14, key = 'week|' + m.from;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0F0F10'); g.addColorStop(0.55, '#2A2A2D'); g.addColorStop(1, '#B71C1C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    lavaStars(ctx, key, W, H);
    // measure the headline band first so the blobs stay out of it (the fitter only shrinks)
    var logoH = story ? 120 : 96, headPx = story ? 132 : 108;
    var headTop = spec.keyTop + 10 + logoH + (story ? 30 : 20);
    ctx.font = '400 ' + headPx + 'px ' + FONT_DISPLAY;
    var headLines = Math.min(2, wrapWords(ctx, m.copy.headline, W - (spec.keySide + 20) * 2).length);
    var headBottom = headTop + headLines * headPx * 1.04;
    lavaBlobs(ctx, lavaSeeds(key, W, H, [{ top: spec.keyTop - 20, bottom: headBottom + 10 }]));
    var y = weekLogo(ctx, spec, m, spec.keyTop + 10, logoH) + (story ? 30 : 20);
    y = weekLavaTitle(ctx, spec, m.copy.headline, y, headPx) + (story ? 34 : 22);
    if (!m.rows.length) { weekEmpty(ctx, spec, m, WEEK_YELLOW, FONT_DISPLAY); return; }
    var gap = 10, bandBot = weekFloor(spec);
    var rowH = weekRowH(bandBot - y, m.rows.length, gap, story ? 190 : 148);
    var startY = y + Math.max(0, (bandBot - y - (rowH * m.rows.length + gap * (m.rows.length - 1))) / 2);
    var n = ticketHash(key + '|dayblobs');
    function rnd() { n = (n * 1103515245 + 12345) >>> 0; return (n >>> 8) / 16777216; }
    m.rows.forEach(function (row, i) {
      var t = startY + i * (rowH + gap), cy = t + rowH / 2;
      var br = rowH * 0.5, bx = pad + br;
      // smoked-glass pill from the blob's middle to the right margin
      var pillH = rowH * 0.92;
      ctx.fillStyle = 'rgba(15,15,16,0.78)'; roundRect(ctx, bx, cy - pillH / 2, W - pad - bx, pillH, pillH / 2); ctx.fill();
      // the day: a hot blob, its wobble seeded per window and row
      var b = { x: bx, y: cy, r: br * 0.9, wobble: 0.07 + rnd() * 0.07, phase: rnd() * Math.PI * 2, hot: true };
      ctx.save();
      ctx.shadowColor = 'rgba(255,179,0,0.55)'; ctx.shadowBlur = br * 0.5;
      var bg = ctx.createRadialGradient(b.x - b.r * 0.25, b.y - b.r * 0.3, b.r * 0.1, b.x, b.y, b.r * 1.15);
      bg.addColorStop(0, '#FFD54F'); bg.addColorStop(0.55, '#FFB300'); bg.addColorStop(1, '#E53935');
      ctx.fillStyle = bg; blobPath(ctx, b); ctx.fill();
      ctx.restore();
      ctx.fillStyle = WEEK_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(br * 0.62) + 'px ' + FONT_DISPLAY;
      ctx.fillText(row.day, bx, cy - br * 0.16);
      ctx.font = '700 ' + Math.round(br * 0.28) + 'px ' + FONT_BODY;
      ctx.fillText(row.date, bx, cy + br * 0.36);
      // artwork in a helmet on the right
      var hr = pillH * 0.44, hx = W - pad - 10 - hr;
      weekHelmet(ctx, row.thumb, hx, cy, hr, row.name);
      // name, the time and venue, then the calendar's Info line in up to two lines, centred on the pill
      var nx = bx + br + 22, nameW = Math.max(120, hx - hr - 18 - nx);
      var info = row.info ? weekInfoLines(ctx, row.info, nameW, Math.round(pillH * 0.2), 16, '500', FONT_BODY) : { lines: [] };
      var k = info.lines.length, nameH = k ? 0.32 : 0.42, subH = k ? 0.16 : 0.18, pitch = 0.22, top = cy - pillH * (nameH + subH + pitch * k) / 2;
      ctx.textAlign = 'left'; ctx.fillStyle = WEEK_CREAM;
      fitFont(ctx, row.name.toUpperCase(), nameW, Math.round(pillH * nameH), 22, '400', FONT_DISPLAY);
      ctx.fillText(row.name.toUpperCase(), nx, top + pillH * nameH / 2 + 2);
      var sub = [row.time, row.venue].filter(Boolean).join(' · ').toUpperCase();
      ctx.fillStyle = WEEK_YELLOW;
      fitFont(ctx, sub, nameW, Math.round(pillH * subH), 14, '700', FONT_BODY);
      ctx.fillText(sub, nx, top + pillH * (nameH + subH / 2));
      if (k) {
        ctx.fillStyle = WEEK_CREAM; ctx.globalAlpha = 0.92; ctx.font = '500 ' + info.px + 'px ' + FONT_BODY;
        info.lines.forEach(function (ln, li) { ctx.fillText(ln, nx, top + pillH * (nameH + subH + pitch * (li + 0.5))); });
        ctx.globalAlpha = 1;
      }
    });
  }

  // STYLE: Comic page. Newsprint with a faint red dot screen, a yellow masthead with the
  // headline as the issue title (ink face, red offset) and the ISO week as the issue number,
  // then one bordered panel per event: the artwork as the drawing, a yellow caption box with
  // the when and where, a speech balloon with the show name lettered in the marker face.
  // ISO 8601 week number of a YYYY-MM-DD date (the comic's issue number). Pure; exported.
  function weekIsoWeek(dateStr) {
    var d = parseYmd(dateStr);
    if (!d) return 0;
    var u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    u.setUTCDate(u.getUTCDate() - ((u.getUTCDay() + 6) % 7) + 3);   // the Thursday of this week
    var thu = new Date(Date.UTC(u.getUTCFullYear(), 0, 4));
    thu.setUTCDate(thu.getUTCDate() - ((thu.getUTCDay() + 6) % 7) + 3);   // the Thursday of week 1
    return 1 + Math.round((u - thu) / 604800000);
  }
  // Panel rows for n events: a splash panel over the grid when the count is odd, three
  // across at most. Returns the panel count per row, summing to n. Pure; exported.
  function weekComicLayout(n) {
    n = Math.max(0, n | 0);
    var table = { 0: [], 1: [1], 2: [1, 1], 3: [1, 2], 4: [2, 2], 5: [1, 2, 2], 6: [2, 2, 2], 7: [1, 3, 3], 8: [2, 3, 3], 9: [3, 3, 3] };
    if (table[n]) return table[n];
    var out = [n % 3 || 3], sum = out[0];
    while (sum < n) { out.push(3); sum += 3; }
    return out;
  }
  var COMIC_PAPER = '#EFE7CF';
  function comicDots(ctx, W, H, color, alpha, pitch, r) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color;
    for (var y = 0, ri = 0; y < H; y += pitch, ri++) {
      for (var x = (ri % 2) * pitch / 2; x < W; x += pitch) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
  // Speech balloon anchored by its bottom-right corner; the tail points down-left into the
  // drawing. Text in the marker face, up to two lines.
  function comicBalloon(ctx, text, right, bottom, maxTextW, startPx, minPx) {
    var px = fitFont(ctx, text, maxTextW, startPx, minPx, '', FONT_ACCENT), lines = [text];
    if (ctx.measureText(text).width > maxTextW) { ctx.font = px + 'px ' + FONT_ACCENT; lines = wrapWords(ctx, text, maxTextW).slice(0, 2); }
    var tw = 0; lines.forEach(function (ln) { tw = Math.max(tw, ctx.measureText(ln).width); });
    // a rounder balloon than the text box: comic lettering sits inside an oval with air around it
    var bw = tw + px * 1.6, bh = lines.length * px * 1.15 + px * 1.1;
    var rx = bw / 2, ry = bh / 2, cx = right - rx, cy = bottom - px * 0.7 - ry;
    // tail: leaves the rim between two angles low left, tip below and to the left
    var a1 = Math.PI * 0.60, a2 = Math.PI * 0.72, tx = cx - rx * 0.6, ty = cy + ry + px * 0.6;
    ctx.save();
    ctx.lineWidth = 4; ctx.strokeStyle = WEEK_INK; ctx.fillStyle = '#FFFFFF'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, a2, a1 + Math.PI * 2);   // the rim, leaving a gap for the tail
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = WEEK_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = px + 'px ' + FONT_ACCENT;
    lines.forEach(function (ln, i) { ctx.fillText(ln, cx, cy + (i - (lines.length - 1) / 2) * px * 1.15 + 2); });
    ctx.restore();
    return { top: cy - ry, left: cx - rx };
  }
  function drawWeekPanel(ctx, row, x, y, w, h) {
    var k = 8, small = w < 420;
    ctx.fillStyle = WEEK_INK; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x + k, y + k, w - 2 * k, h - 2 * k); ctx.clip();
    ctx.fillStyle = '#2A2A2D'; ctx.fillRect(x, y, w, h);
    if (row.thumb) drawCover(ctx, row.thumb, x + k, y + k, w - 2 * k, h - 2 * k);
    else {
      ctx.fillStyle = WEEK_YELLOW; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(Math.min(w, h) * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((row.name || '?').charAt(0).toUpperCase(), x + w / 2, y + h / 2 + 4);
    }
    // caption box, top left, flush to the border
    var l1 = row.day + ' ' + row.date, l2 = [row.time, row.venue].filter(Boolean).join(' · ').toUpperCase();
    var p1 = small ? 24 : 30, p2 = small ? 17 : 21, padc = small ? 10 : 14, maxBw = w - 2 * k - 16;
    ctx.font = '800 ' + p1 + 'px ' + FONT_BODY; var w1 = ctx.measureText(l1).width;
    p2 = fitFont(ctx, l2, maxBw - padc * 2, p2, 12, '700', FONT_BODY); var w2 = ctx.measureText(l2).width;
    var bw = Math.min(maxBw, Math.max(w1, w2) + padc * 2), bh = p1 + (l2 ? p2 + 6 : 0) + padc * 2 - 4;
    ctx.fillStyle = WEEK_INK; ctx.fillRect(x + k, y + k, bw + 4, bh + 4);
    ctx.fillStyle = WEEK_YELLOW; ctx.fillRect(x + k, y + k, bw, bh);
    ctx.fillStyle = WEEK_INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = '800 ' + p1 + 'px ' + FONT_BODY; ctx.fillText(l1, x + k + padc, y + k + padc - 2 + p1 * 0.82);
    if (l2) { ctx.font = '700 ' + p2 + 'px ' + FONT_BODY; ctx.fillText(l2, x + k + padc, y + k + padc + p1 + 2 + p2 * 0.82); }
    // the balloon, bottom right, kept clear of the caption box
    comicBalloon(ctx, row.name, x + w - k - 10, y + h - k - 10, Math.min(w * 0.62, 520), small ? 32 : 46, 18);
    if (row.info && w >= 800) {   // a splash panel has room for a second caption box with the calendar's Info line
      var cp = 22, cpad = 12; ctx.font = '700 ' + cp + 'px ' + FONT_BODY; cp = fitFont(ctx, row.info, w * 0.45 - cpad * 2, cp, 14, '700', FONT_BODY);
      var cw = ctx.measureText(row.info).width + cpad * 2, chh = cp + cpad * 2 - 4;
      ctx.fillStyle = WEEK_INK; ctx.fillRect(x + k, y + h - k - chh - 4, cw + 4, chh + 4);
      ctx.fillStyle = WEEK_YELLOW; ctx.fillRect(x + k, y + h - k - chh, cw, chh);
      ctx.fillStyle = WEEK_INK; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(row.info, x + k + cpad, y + h - k - chh + cpad - 2 + cp * 0.82);
    }
    ctx.restore();
  }
  function paintWeekComic(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 12, k = 6;
    ctx.fillStyle = COMIC_PAPER; ctx.fillRect(0, 0, W, H);
    comicDots(ctx, W, H, WEEK_RED, 0.09, 20, 3);
    // masthead: yellow banner in an ink frame; a strip with the logo and the issue line, a rule, the title
    var top = spec.keyTop + 8, mhH = story ? 224 : 176, stripH = story ? 68 : 56, win = weekWindow(m.from);
    ctx.fillStyle = WEEK_INK; ctx.fillRect(pad - k, top - k, W - pad * 2 + k * 2, mhH + k * 2);
    ctx.fillStyle = WEEK_YELLOW; ctx.fillRect(pad, top, W - pad * 2, mhH);
    if (m.logo) { var lh = stripH - 20, lw = lh * (m.logo.width / m.logo.height); ctx.drawImage(m.logo, pad + 16, top + 10, lw, lh); }
    ctx.fillStyle = WEEK_INK; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + (story ? 24 : 21) + 'px ' + FONT_BODY;
    ctx.fillText('Nº ' + weekIsoWeek(m.from) + '  ·  ZÜRICH  ·  ' + weekDateLabel(m.from) + ' TO ' + weekDateLabel(win.to), W - pad - 16, top + stripH / 2);
    ctx.fillRect(pad, top + stripH, W - pad * 2, 4);
    // the title: Anton, ink face over a red offset, at most two lines in the banner
    var titleTop = top + stripH + 8, avail = mhH - stripH - 16, maxW = W - pad * 2 - 40;
    var px = story ? 128 : 100, lines;
    for (;;) {
      ctx.font = '400 ' + px + 'px ' + FONT_DISPLAY;
      lines = wrapWords(ctx, m.copy.headline, maxW);
      if ((lines.length <= 2 && lines.length * px * 1.0 <= avail) || px <= 48) break;
      px -= 4;
    }
    var lineH = px * 1.0, blockTop = titleTop + (avail - lines.length * lineH) / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    lines.forEach(function (ln, i) {
      var y = blockTop + (i + 1) * lineH - lineH * 0.16;
      ctx.fillStyle = WEEK_RED; ctx.fillText(ln, W / 2 + 7, y + 7);
      ctx.fillStyle = WEEK_INK; ctx.fillText(ln, W / 2, y);
    });
    var y0 = top + mhH + k + (story ? 28 : 20), gutter = 18, bandBot = weekFloor(spec);
    if (!m.rows.length) {
      // one empty panel with the news in a balloon
      var eh = Math.min(bandBot - y0, story ? 520 : 400);
      ctx.fillStyle = WEEK_INK; ctx.fillRect(pad, y0, W - pad * 2, eh);
      ctx.fillStyle = COMIC_PAPER; ctx.fillRect(pad + 8, y0 + 8, W - pad * 2 - 16, eh - 16);
      comicBalloon(ctx, 'NO SHOWS THIS WEEK', W / 2 + 300, y0 + eh / 2 + 60, 600, 56, 24);
      ctx.fillStyle = WEEK_INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 28px ' + FONT_BODY; ctx.fillText('The calendar has the next ones', W / 2, y0 + eh - 40);
      return;
    }
    // panel sizes follow the weights: within a row the widths, across rows the heights
    var layout = weekComicLayout(m.rows.length), rows = layout.length, idx = 0;
    var rowItems = layout.map(function (cols) { var it = m.rows.slice(idx, idx + cols); idx += cols; return it; });
    var rowW = rowItems.map(function (it) { return it.reduce(function (a, row) { return a + weekComicWeight(row); }, 0) / it.length; });
    var sumW = rowW.reduce(function (a, b) { return a + b; }, 0);
    var bandH = Math.min(bandBot - y0, rows * (story ? 560 : 430) + gutter * (rows - 1)) - gutter * (rows - 1);
    var yy = y0;
    rowItems.forEach(function (it, r) {
      var ph = bandH * rowW[r] / sumW, tot = it.reduce(function (a, row) { return a + weekComicWeight(row); }, 0), xx = pad;
      it.forEach(function (row) {
        var pw = (W - pad * 2 - gutter * (it.length - 1)) * weekComicWeight(row) / tot;
        drawWeekPanel(ctx, row, xx, yy, pw, ph);
        xx += pw + gutter;
      });
      yy += ph + gutter;
    });
  }

  // STYLE: Departures board. A split-flap board (the kind Zürich HB used to have): a dark
  // casing, one tall tile per character (Anton, condensed) with the split line across its middle, cream glyphs,
  // the headline in yellow tiles, a few tiles caught mid-flip so it reads as a machine. Per
  // event a large tile row with the show name, a smaller dim row with the when and where,
  // and the artwork on a split tile at the right.
  var FLAP_FACE = '#1E1E22';
  function flapTile(ctx, ch, x, y, w, h, color, prev) {
    var r = Math.max(3, w * 0.09);
    ctx.fillStyle = '#0A0A0B'; roundRect(ctx, x, y, w, h, r); ctx.fill();
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#2C2C31'); g.addColorStop(0.5, '#222226'); g.addColorStop(0.5, '#161619'); g.addColorStop(1, FLAP_FACE);
    ctx.fillStyle = g; roundRect(ctx, x + 1, y + 1, w - 2, h - 2, r); ctx.fill();
    if (ch && ch !== ' ') {
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(h * 0.8) + 'px ' + FONT_DISPLAY;   // condensed glyphs: tall tiles stay legible at 21 tiles across
      if (prev) {
        // mid-flip: the top half already shows the new glyph, the lower flap still carries
        // the old one, squashed as it swings
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h / 2); ctx.clip(); ctx.fillText(ch, x + w / 2, y + h / 2 + 1); ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(x, y + h / 2, w, h / 2); ctx.clip();
        ctx.translate(x + w / 2, y + h / 2); ctx.scale(1, 0.5); ctx.globalAlpha = 0.75;
        ctx.fillText(prev, 0, 2); ctx.restore();
        ctx.fillStyle = 'rgba(255,243,224,0.3)'; ctx.fillRect(x + 2, y + h / 2, w - 4, 2);
      } else ctx.fillText(ch, x + w / 2, y + h / 2 + 1);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(x, y + h / 2 - 1, w, 2);
  }
  // A row of tiles for text, left-aligned at x. rnd drives the mid-flip tiles. Returns the end x.
  function flapRow(ctx, text, x, y, w, h, gap, color, rnd) {
    var chars = String(text).toUpperCase().split(''), AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    chars.forEach(function (ch, i) {
      var prev = (rnd && /[A-Z0-9]/.test(ch) && rnd() < 0.06) ? AZ.charAt(Math.floor(rnd() * 26)) : '';
      flapTile(ctx, ch, x + i * (w + gap), y, w, h, color, prev);
    });
    return x + chars.length * (w + gap) - gap;
  }
  // A show name on the board: one line up to 20 tiles (the width is the literal: exported helpers cannot read vars below the test seam), else two lines split at a word
  // boundary (a long name must not shrink every other row). Pure; exported.
  function flapLines(name) {
    var s = String(name || '').toUpperCase();
    if (s.length <= 20) return [s];
    var words = s.split(' '), a = '', b = '';
    words.forEach(function (w) { if (!b && (a + ' ' + w).trim().length <= 20) a = (a + ' ' + w).trim(); else b = (b + ' ' + w).trim(); });
    if (!a) { a = b.slice(0, 20); b = b.slice(20); }
    return b ? [a, b] : [a];
  }
  // Tile width that lets `len` tiles fit in availW at the given gap, never above base.
  function flapFit(len, availW, base, gap, min) { return Math.max(min, Math.min(base, (availW + gap) / Math.max(1, len) - gap)); }
  // The artwork as a flap: a square tile, the print inset, the split across its middle.
  function flapArt(ctx, img, x, y, s, fallbackText) {
    ctx.fillStyle = '#0A0A0B'; roundRect(ctx, x, y, s, s, Math.max(3, s * 0.06)); ctx.fill();
    ctx.save(); roundRect(ctx, x + 3, y + 3, s - 6, s - 6, Math.max(2, s * 0.05)); ctx.clip();
    if (img) drawCover(ctx, img, x + 3, y + 3, s - 6, s - 6);
    else {
      ctx.fillStyle = FLAP_FACE; ctx.fillRect(x, y, s, s);
      ctx.fillStyle = WEEK_YELLOW; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + Math.round(s * 0.5) + 'px ' + FONT_BODY;
      ctx.fillText((fallbackText || '?').charAt(0).toUpperCase(), x + s / 2, y + s / 2 + 2);
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(x, y + s / 2 - 1, s, 2);
    ctx.fillStyle = 'rgba(255,243,224,0.18)'; ctx.fillRect(x + 3, y + s / 2 + 1, s - 6, 1);
  }
  function paintWeekFlap(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 14, win = weekWindow(m.from);
    ctx.fillStyle = WEEK_INK; ctx.fillRect(0, 0, W, H);
    var n = ticketHash('week|' + m.from + '|flaps');
    function rnd() { n = (n * 1103515245 + 12345) >>> 0; return (n >>> 8) / 16777216; }
    var y = weekLogo(ctx, spec, m, spec.keyTop + 10, story ? 110 : 88) + (story ? 26 : 18);
    // the casing: a slightly lighter panel with a bevelled edge, from here to the key floor
    var caseTop = y, caseBot = weekFloor(spec) + 12;
    ctx.fillStyle = '#2A2A2D'; roundRect(ctx, pad - 14, caseTop, W - (pad - 14) * 2, caseBot - caseTop, 14); ctx.fill();
    ctx.fillStyle = '#151518'; roundRect(ctx, pad - 10, caseTop + 4, W - (pad - 10) * 2, caseBot - caseTop - 8, 12); ctx.fill();
    y += story ? 22 : 16;
    // board header line: small yellow caps, the week number at the right
    ctx.fillStyle = WEEK_YELLOW; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (story ? 22 : 19) + 'px ' + FONT_BODY; swissTrack(ctx, 3);
    ctx.textAlign = 'left'; ctx.fillText('ABFAHRT · DEPARTURES', pad, y + 12);
    ctx.textAlign = 'right'; ctx.fillText('WOCHE ' + weekIsoWeek(m.from) + ' · ' + weekDateLabel(m.from) + ' TO ' + weekDateLabel(win.to), W - pad, y + 12);
    swissTrack(ctx, 0);
    y += story ? 44 : 36;
    // the headline in yellow tiles, wrapped by tile count
    var availW = W - pad * 2, hGap = 4, hBase = story ? 56 : 46;
    var words = m.copy.headline.toUpperCase().split(' '), hLines = [], cur = '';
    var perLine = Math.floor((availW + hGap) / ((story ? 36 : 32) + hGap));   // shrink the tiles before wrapping; wrap only past ~23 tiles
    words.forEach(function (wd) { var t = cur ? cur + ' ' + wd : wd; if (t.length <= perLine || !cur) cur = t; else { hLines.push(cur); cur = wd; } });
    if (cur) hLines.push(cur);
    hLines.forEach(function (ln) {
      var tw = flapFit(ln.length, availW, hBase, hGap, 16), th = Math.round(tw * 1.75);
      flapRow(ctx, ln, pad, y, tw, th, hGap, WEEK_YELLOW, rnd);
      y += th + 6;
    });
    y += story ? 22 : 14;
    ctx.fillStyle = '#2A2A2D'; ctx.fillRect(pad, y, availW, 2); y += story ? 20 : 14;
    var bandBot = weekFloor(spec);
    if (!m.rows.length) {
      var ew = flapFit(18, availW, 44, 4, 16), eh = Math.round(ew * 1.75);
      flapRow(ctx, 'NO SHOWS THIS WEEK', pad, y + 20, ew, eh, 4, WEEK_CREAM, null);
      var sw = flapFit(30, availW, 26, 3, 12);
      flapRow(ctx, 'THE CALENDAR HAS THE NEXT ONES', pad, y + 20 + eh + 12, sw, Math.round(sw * 1.75), 3, '#C9C2B6', null);
      return;
    }
    // row geometry: base tile sizes scaled to fill the band, capped by the longest lines
    var big = story ? 38 : 32, bGap = 3, small = story ? 27 : 23, sGap = 2, artPad = 18;
    var longest = 0, longestSub = 0;
    // The sub row keeps its tiles legible: when day, time and venue would need more tiles
    // than fit at the small size, the venue is left off (the board abbreviates, it never shrinks).
    var maxSub = Math.floor((availW - Math.round(big * 1.75) - 6 - Math.round(small * 1.75) - artPad + sGap) / (small + sGap));
    var names = m.rows.map(function (row) { return flapLines(row.name); }), extra = 0;
    var subs = m.rows.map(function (row, i) {
      var s = [row.day + ' ' + parseInt(row.date, 10), row.time, row.venue].filter(Boolean).join(' · ').toUpperCase();
      if (s.length > maxSub) s = [row.day + ' ' + row.date, row.time].filter(Boolean).join(' · ').toUpperCase();
      names[i].forEach(function (ln) { longest = Math.max(longest, ln.length); });
      if (names[i].length > 1) extra++;
      longestSub = Math.max(longestSub, s.length);
      return s;
    });
    var rowGap = story ? 18 : 14, baseRow = Math.round(big * 1.75) + 6 + Math.round(small * 1.75);
    var kH = (bandBot - y - rowGap * (m.rows.length - 1)) / (m.rows.length * (baseRow + 4) + extra * (Math.round(big * 1.75) + 4));
    var artS0 = baseRow, textW = availW - artS0 - artPad;
    var kW = Math.min((textW + bGap) / (longest * (big + bGap)), (textW + sGap) / (longestSub * (small + sGap)));
    var kk = Math.max(0.55, Math.min(1.5, kH, kW));
    var bw = Math.round(big * kk), bh = Math.round(bw * 1.75), sw2 = Math.round(small * kk), sh = Math.round(sw2 * 1.75);
    var artS = bh + 6 + sh, nR = m.rows.length;
    var heights = names.map(function (ls) { return ls.length * bh + (ls.length - 1) * 4 + 6 + sh; });
    var total = heights.reduce(function (a, b) { return a + b; }, 0);
    // when the width, not the height, capped the tiles, spread the rows over the board instead of leaving slack
    if (nR > 1) rowGap = Math.min(rowGap * 2.6, Math.max(rowGap, (bandBot - y - total) / (nR - 1)));
    var t = y + Math.max(0, (bandBot - y - (total + rowGap * (nR - 1))) / 2);
    m.rows.forEach(function (row, i) {
      names[i].forEach(function (ln, li) { flapRow(ctx, ln, pad, t + li * (bh + 4), bw, bh, bGap, WEEK_CREAM, null); });   // never mid-flip inside a name, date or time
      flapRow(ctx, subs[i], pad, t + heights[i] - sh, sw2, sh, sGap, '#C9C2B6', null);
      flapArt(ctx, row.thumb, W - pad - artS, t, artS, row.name);
      t += heights[i] + rowGap;
    });
  }

  // STYLE: Station board. The look of the Swiss station general display boards, drawn from
  // the reference graphic: an indigo board on a black surround, a red notice banner with a
  // pictogram box and a bold lead-in, a light grey column strip, white rows with the type in
  // a white box, thin white separators, a Hinweis column with red boxes. Here the weekday is
  // the type, the show the destination, the venue the via, the date the Gleis, "15 Sept" the
  // Hinweis with a red Heute / Morgen box for the story day and the day after, and the show's
  // tagline the yellow info line under the row. No prices, no artwork: the reference has none.
  var STATION_BLUE = '#2D3184', STATION_GREY = '#D6D6D6';
  function paintWeekStation(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', win = weekWindow(m.from);
    ctx.fillStyle = WEEK_INK; ctx.fillRect(0, 0, W, H);
    var y = weekLogo(ctx, spec, m, spec.keyTop + 6, story ? 100 : 80) + (story ? 22 : 16);
    // the board rectangle, inside the key sides, down to just past the key floor
    var bx = spec.keySide + 4, bw = W - bx * 2, bTop = y, bBot = weekFloor(spec) + 10;
    ctx.fillStyle = STATION_BLUE; ctx.fillRect(bx, bTop, bw, bBot - bTop);
    var pad = bx + 14, innerW = W - pad * 2;
    // red notice banner: pictogram box left, bold lead-in then the rest in regular
    var banH = story ? 168 : 140;
    ctx.fillStyle = WEEK_RED; ctx.fillRect(bx, y, bw, banH);
    var pb = Math.round(banH * 0.42), px0 = pad, py0 = y + (banH - pb) / 2;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.strokeRect(px0, py0, pb, pb);
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 ' + Math.round(pb * 0.7) + 'px ' + FONT_DISPLAY; ctx.fillText('★', px0 + pb / 2, py0 + pb / 2 + 2);
    var tx = px0 + pb + 22, tw = W - pad - tx;
    var lead = m.copy.headline.charAt(0) + m.copy.headline.slice(1).toLowerCase() + ':';
    var rest = (/\d/.test(m.copy.headline) ? '' : m.n + ' show' + (m.n === 1 ? '' : 's') + ' in ') + 'Zürich, ' + weekDateNice(m.from) + ' to ' + weekDateNice(win.to) + '.';   // headlines that carry the count do not repeat it
    var bpx = story ? 40 : 33; ctx.textAlign = 'left';
    ctx.font = '700 ' + bpx + 'px ' + FONT_BODY;
    var lines = [], leadW = ctx.measureText(lead + ' ').width;
    ctx.font = '400 ' + bpx + 'px ' + FONT_BODY;
    var words = rest.split(' '), cur = '', firstW = tw - leadW;
    words.forEach(function (w) { var t = cur ? cur + ' ' + w : w; var lim = lines.length ? tw : firstW; if (ctx.measureText(t).width <= lim || !cur) cur = t; else { lines.push(cur); cur = w; } });
    if (cur) lines.push(cur);
    var lh = bpx * 1.2, blockTop = y + (banH - lh * lines.length) / 2;
    ctx.fillStyle = '#FFFFFF';
    lines.forEach(function (ln, i) {
      var ly = blockTop + lh * (i + 0.5);
      if (i === 0) { ctx.font = '700 ' + bpx + 'px ' + FONT_BODY; ctx.fillText(lead, tx, ly); ctx.font = '400 ' + bpx + 'px ' + FONT_BODY; ctx.fillText(ln, tx + leadW, ly); }
      else ctx.fillText(ln, tx, ly);
    });
    y += banH;
    // grey column strip: the week at the left like the clock, then Nach, Gleis, Hinweis
    var stripH = story ? 46 : 38, typeW = story ? 118 : 96, timeW = story ? 136 : 118, gleisW = story ? 72 : 62, hintW = story ? 146 : 122;
    ctx.fillStyle = STATION_GREY; ctx.fillRect(bx, y, bw, stripH);
    ctx.fillStyle = STATION_BLUE; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.font = '700 ' + (story ? 24 : 20) + 'px ' + FONT_BODY;
    ctx.fillText('Woche ' + weekIsoWeek(m.from), pad, y + stripH / 2);
    ctx.fillText('Nach', pad + typeW + timeW, y + stripH / 2);
    ctx.textAlign = 'right';
    ctx.fillText('Gleis', W - pad - hintW - 10, y + stripH / 2);
    ctx.textAlign = 'left'; ctx.fillText('Hinweis', W - pad - hintW + 16, y + stripH / 2);
    y += stripH;
    if (!m.rows.length) {
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + (story ? 56 : 48) + 'px ' + FONT_BODY; ctx.fillText('Keine Abfahrten', W / 2, y + 140);
      ctx.font = '400 30px ' + FONT_BODY; ctx.fillText('No shows this week · the calendar has the next ones', W / 2, y + 200);
      return;
    }
    var bandBot = weekFloor(spec), n = m.rows.length, today = m.from, tmr = parseYmd(m.from); if (tmr) tmr.setDate(tmr.getDate() + 1); var tomorrow = tmr ? ymd(tmr) : '';
    var rowH = weekRowH(bandBot - y, n, 0, story ? 160 : 126);
    var fs = Math.round(Math.min(rowH * 0.27, story ? 38 : 32)), small = Math.round(fs * 0.74);
    var nx = pad + typeW + timeW, right = W - pad - hintW - gleisW - 16, nameW = right - nx, lineW = W - pad - nx;
    // pre-pass: the name and via share a line when they fit together at fs down to 0.8 fs;
    // otherwise the via takes its own white line. One line grid for the whole board.
    var plan = m.rows.map(function (row) {
      var via = row.venue ? '  via  ' + row.venue : '', px = fs, fits = false;
      while (px >= fs * 0.8) {
        ctx.font = '700 ' + px + 'px ' + FONT_BODY; var nw = ctx.measureText(row.name).width;
        ctx.font = '400 ' + px + 'px ' + FONT_BODY; var vw = via ? ctx.measureText(via).width : 0;
        if (nw + vw <= nameW) { fits = true; break; }
        px -= 1;
      }
      var sell = stripEmoji(row.info) || row.tagline;   // the calendar's Info line first (no emoji on a board), else the tagline
      return { via: via, px: fits ? px : fs, viaBelow: !!via && !fits, sell: sell };
    });
    var anyThree = plan.some(function (q) { return q.viaBelow && q.sell; }), anyTwo = plan.some(function (q) { return q.viaBelow || q.sell; });
    var lineA0 = anyThree ? 0.26 : (anyTwo ? 0.36 : 0.5);
    m.rows.forEach(function (row, i) {
      var t = y + i * rowH, q = plan[i], lineA = t + rowH * lineA0;
      // type box: the weekday, bold blue on white
      var tb = Math.round(fs * 1.25);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(pad, lineA - tb / 2, typeW - 18, tb);
      ctx.fillStyle = STATION_BLUE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + Math.round(fs * 0.9) + 'px ' + FONT_BODY; ctx.fillText(row.day, pad + (typeW - 18) / 2, lineA + 1);
      // time, then the destination in bold with the via in regular on the same line when they fit
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left';
      ctx.font = '700 ' + fs + 'px ' + FONT_BODY; ctx.fillText(row.time || '', pad + typeW, lineA + 1);
      var lineB = t + rowH * (anyThree ? 0.54 : 0.7);
      if (!q.viaBelow) {
        ctx.font = '700 ' + q.px + 'px ' + FONT_BODY; ctx.fillText(row.name, nx, lineA + 1);
        var nw = ctx.measureText(row.name).width;
        if (q.via) { ctx.font = '400 ' + q.px + 'px ' + FONT_BODY; ctx.fillText(q.via, nx + nw, lineA + 1); }
      } else {
        fitFont(ctx, row.name, nameW, fs, 18, '700', FONT_BODY); ctx.fillText(row.name, nx, lineA + 1);
        // the via on its own white line under the name
        var viaLine = 'via  ' + row.venue;
        fitFont(ctx, viaLine, lineW, small, 14, '400', FONT_BODY); ctx.fillText(viaLine, nx, lineB);
        lineB = t + rowH * 0.8;
      }
      // the Info line in yellow, directly under the name (under the via when that wrapped), like the board's remark line
      if (q.sell) {
        ctx.fillStyle = WEEK_YELLOW;
        fitFont(ctx, q.sell, lineW, small, 16, '400', FONT_BODY);
        ctx.fillText(q.sell, nx, lineB);
      }
      // Gleis: the date number
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'right'; ctx.font = '700 ' + fs + 'px ' + FONT_BODY;
      ctx.fillText(String(parseInt(row.date, 10) || ''), W - pad - hintW - 10, lineA + 1);
      // Hinweis: the date as the board prints it, or a red remark box for today and tomorrow
      var remark = row.e.date === today ? 'Heute' : (row.e.date === tomorrow ? 'Morgen' : '');
      if (remark) {
        var hh = Math.round(fs * 1.2), hw = hintW - 16;
        ctx.fillStyle = WEEK_RED; ctx.fillRect(W - pad - hw, lineA - hh / 2, hw, hh);
        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; fitFont(ctx, remark, hw - 22, Math.round(fs * 0.9), 14, '400', FONT_BODY);   // Morgen must sit inside its box
        ctx.fillText(remark, W - pad - hw + 11, lineA + 1);
      } else {
        ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.font = '400 ' + Math.round(fs * 0.9) + 'px ' + FONT_BODY;
        ctx.fillText(weekDateBoard(row.e.date), W - pad - hintW + 16, lineA + 1);
      }
      if (i < n - 1) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(bx, t + rowH - 1, bw, 1); }
    });
  }
  function measureBold(ctx, text, fs) { var f = ctx.font; ctx.font = '700 ' + fs + 'px ' + FONT_BODY; var w = ctx.measureText(text).width; ctx.font = f; return w; }

  // Comic panel weight: a bigger frame for Comedy Brew (Harry: always a bit bigger) and for
  // Friday and Saturday shows (people go out). Pure; exported.
  function weekComicWeight(row) {
    var w = 1, slug = norm(row && row.e && row.e.show), day = String(row && row.day || '').toUpperCase();
    if (slug === 'comedybrew') w += 0.35;
    if (day === 'FRI' || day === 'SAT') w += 0.25;
    return w;
  }

  // STYLE: Chalkboard. A black board wall to wall, chalk dust, a hand-drawn chalk frame,
  // the headline and rows lettered in the marker face with soft chalky edges, white and
  // chalk yellow only. No artwork: a chalkboard is lettering.
  var CHALK_BOARD = '#1C201D', CHALK_WHITE = '#F2EFE6', CHALK_YELLOW = '#F5E6A3';
  function chalkRnd(seed) { var n = ticketHash(seed); return function () { n = (n * 1103515245 + 12345) >>> 0; return (n >>> 8) / 16777216; }; }
  // Text with chalky edges: three faint offset passes under one solid pass, then a sprinkle of
  // board-coloured specks over it so the strokes look dragged rather than printed.
  function chalkText(ctx, text, x, y, font, color, align, rnd) {
    ctx.font = font; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.fillStyle = color; ctx.globalAlpha = 0.3;
    ctx.fillText(text, x - 1.2, y + 0.8); ctx.fillText(text, x + 1.1, y - 0.7); ctx.fillText(text, x + 0.4, y + 1.4);
    ctx.globalAlpha = 0.92; ctx.fillText(text, x, y);
    var w = ctx.measureText(text).width, px = parseInt(font, 10) || 30, x0 = align === 'center' ? x - w / 2 : (align === 'right' ? x - w : x);
    ctx.globalAlpha = 0.55; ctx.fillStyle = CHALK_BOARD;
    var n = Math.round(w * px / 260);
    for (var i = 0; i < n; i++) { var sx = x0 + rnd() * w, sy = y - px * 0.85 + rnd() * px; ctx.fillRect(sx, sy, 1 + rnd() * 1.5, 1); }
    ctx.restore();
    return w;
  }
  function chalkLine(ctx, x1, y1, x2, y2, color, width, rnd) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.moveTo(x1, y1);
    var steps = 8;
    for (var i = 1; i <= steps; i++) { var t = i / steps; ctx.lineTo(x1 + (x2 - x1) * t + (rnd() - 0.5) * 2, y1 + (y2 - y1) * t + (rnd() - 0.5) * 3); }
    ctx.stroke(); ctx.restore();
  }
  function paintWeekChalk(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 26;
    var rnd = chalkRnd('week|' + m.from + '|chalk'), bg = chalkRnd('chalk|board');   // the board itself is the same every week; only the writing changes
    ctx.fillStyle = CHALK_BOARD; ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.1, W / 2, H * 0.5, H * 0.8);
    vg.addColorStop(0, 'rgba(255,255,255,0.05)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    // chalk dust and a couple of wiped smudges
    ctx.save(); ctx.fillStyle = CHALK_WHITE;
    for (var i = 0; i < 900; i++) { ctx.globalAlpha = 0.03 + bg() * 0.09; ctx.fillRect(bg() * W, bg() * H, 1 + bg() * 2, 1 + bg() * 2); }
    for (var s = 0; s < 4; s++) { ctx.globalAlpha = 0.035; ctx.beginPath(); ctx.ellipse(bg() * W, bg() * H, 120 + bg() * 220, 40 + bg() * 60, bg() * Math.PI, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    // hand-drawn chalk frame inside the key area
    var fx = spec.keySide + 8, fy = spec.keyTop - 6, fw = W - fx * 2, fh = H - spec.keyBottom - fy + 4;
    chalkLine(ctx, fx, fy, fx + fw, fy, CHALK_WHITE, 3, bg); chalkLine(ctx, fx + fw, fy, fx + fw, fy + fh, CHALK_WHITE, 3, bg);
    chalkLine(ctx, fx + fw, fy + fh, fx, fy + fh, CHALK_WHITE, 3, bg); chalkLine(ctx, fx, fy + fh, fx, fy, CHALK_WHITE, 3, bg);
    // the logo in chalk (mono, a touch faded)
    var y = spec.keyTop + 16, lh = story ? 110 : 88;
    if (m.logo) { var lw = lh * (m.logo.width / m.logo.height); ctx.save(); ctx.globalAlpha = 0.9; drawMono(ctx, m.logo, W / 2 - lw / 2, y, lw, lh); ctx.restore(); }
    y += lh + (story ? 34 : 24);
    // headline in chalk yellow, wrapped to two lines, underlined by hand
    var maxW = W - pad * 2, px = story ? 104 : 84, lines;
    for (;;) { ctx.font = px + 'px ' + FONT_ACCENT; lines = wrapWords(ctx, m.copy.headline, maxW); if (lines.length <= 2 || px <= 48) break; px -= 4; }
    lines.forEach(function (ln, i) { chalkText(ctx, ln, W / 2, y + (i + 1) * px * 1.1 - px * 0.2, px + 'px ' + FONT_ACCENT, CHALK_YELLOW, 'center', rnd); });
    y += lines.length * px * 1.1;
    var lastW = ctx.measureText(lines[lines.length - 1]).width;
    chalkLine(ctx, W / 2 - lastW / 2, y + 4, W / 2 + lastW / 2, y + 8, CHALK_YELLOW, 4, rnd);
    y += story ? 44 : 30;
    if (!m.rows.length) {
      chalkText(ctx, 'no shows this week', W / 2, H / 2, (story ? 64 : 56) + 'px ' + FONT_ACCENT, CHALK_WHITE, 'center', rnd);
      chalkText(ctx, 'the calendar has the next ones', W / 2, H / 2 + 60, '600 30px ' + FONT_BODY, CHALK_WHITE, 'center', rnd);
      return;
    }
    var gap = 10, bandBot = weekFloor(spec);
    var rowH = weekRowH(bandBot - y, m.rows.length, gap, story ? 190 : 148);
    var startY = y + Math.max(0, (bandBot - y - (rowH * m.rows.length + gap * (m.rows.length - 1))) / 2);
    m.rows.forEach(function (row, i) {
      var t = startY + i * (rowH + gap), cy = t + rowH / 2;
      // day and date in yellow chalk on the left
      var dpx = Math.round(rowH * 0.34);
      chalkText(ctx, row.day, pad, cy - rowH * 0.02, dpx + 'px ' + FONT_ACCENT, CHALK_YELLOW, 'left', rnd);
      chalkText(ctx, String(parseInt(row.date, 10) || ''), pad, cy + rowH * 0.3, Math.round(rowH * 0.26) + 'px ' + FONT_ACCENT, CHALK_YELLOW, 'left', rnd);
      ctx.font = dpx + 'px ' + FONT_ACCENT; var dayW = Math.max(ctx.measureText(row.day).width, ctx.measureText('WED').width) + 28;
      // show name in white chalk, time and venue below in a plainer hand
      var nx = pad + dayW, nameW = W - pad - nx;
      var sell = stripEmoji(row.info);
      var info = sell ? weekInfoLines(ctx, sell, nameW, Math.round(rowH * 0.19), 15, '500', FONT_BODY) : { lines: [] };
      var k = info.lines.length, nameH = k ? 0.32 : 0.36, subH = k ? 0.15 : 0.18, pitch = 0.2, top = cy - rowH * (nameH + subH + pitch * k) / 2;
      var npx = fitFont(ctx, row.name, nameW, Math.round(rowH * nameH), 22, '', FONT_ACCENT);
      chalkText(ctx, row.name, nx, top + rowH * nameH / 2 + npx * 0.35, npx + 'px ' + FONT_ACCENT, CHALK_WHITE, 'left', rnd);
      var sub = [row.time, row.venue].filter(Boolean).join('  ·  ');
      var spx = fitFont(ctx, sub, nameW, Math.round(rowH * subH), 14, '600', FONT_BODY);
      ctx.save(); ctx.globalAlpha = 0.85; chalkText(ctx, sub, nx, top + rowH * (nameH + subH / 2) + spx * 0.35, '600 ' + spx + 'px ' + FONT_BODY, CHALK_WHITE, 'left', rnd); ctx.restore();
      if (k) {   // the calendar's Info line, a smaller hand, up to two lines
        ctx.save(); ctx.globalAlpha = 0.85;
        info.lines.forEach(function (ln, li) { chalkText(ctx, ln, nx, top + rowH * (nameH + subH + pitch * (li + 0.5)) + info.px * 0.35, '500 ' + info.px + 'px ' + FONT_BODY, CHALK_WHITE, 'left', rnd); });
        ctx.restore();
      }
      if (i < m.rows.length - 1) chalkLine(ctx, pad, t + rowH + gap / 2, W - pad, t + rowH + gap / 2, CHALK_WHITE, 1.5, rnd);
    });
  }

  // STYLE: Restaurant menu. A paper card with double rules on a deep red cover, the headline
  // as the menu title, one course heading per day, items with dotted leaders to the price
  // (the calendar's price: FREE when it is 0), the time and venue as the item's description.
  // Price label for the menu leader. Pure; exported.
  function weekMenuPrice(price) {
    if (price === null || price === undefined || price === '') return '';
    var n = Number(price);
    if (isNaN(n)) return '';
    return n <= 0 ? 'FREE' : 'CHF ' + n;
  }
  var MENU_PAPER = '#FBF4E4', MENU_GREY = '#5A5A5E', MENU_RED = '#B71C1C';
  var DAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function menuLeader(ctx, x1, x2, y, color) {
    ctx.save(); ctx.fillStyle = color;
    for (var x = x1 + 8; x < x2 - 4; x += 9) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  function paintWeekMenu(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', win = weekWindow(m.from);
    var g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#7A1010'); g.addColorStop(1, '#B71C1C');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // the crowd behind the cover, like the Ticket style, multiplied into the red so it stays red
    if (m.backdrop) { ctx.save(); ctx.globalAlpha = 0.45; ctx.globalCompositeOperation = 'multiply'; drawMono(ctx, m.backdrop, 0, 0, W, H); ctx.restore(); }
    // the card, inside the key sides, with double rules
    var cx0 = spec.keySide + 6, cw = W - cx0 * 2, cy0 = spec.keyTop - 10, ch = H - spec.keyBottom - cy0 + 70;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
    ctx.fillStyle = MENU_PAPER; ctx.fillRect(cx0, cy0, cw, ch); ctx.restore();
    ctx.strokeStyle = WEEK_INK; ctx.lineWidth = 3; ctx.strokeRect(cx0 + 16, cy0 + 16, cw - 32, ch - 32);
    ctx.lineWidth = 1; ctx.strokeRect(cx0 + 24, cy0 + 24, cw - 48, ch - 48);
    var pad = cx0 + 48, innerW = W - pad * 2;
    var y = cy0 + 40 + weekLogo(ctx, spec, m, cy0 + 40, story ? 84 : 68) - (cy0 + 40) + (story ? 22 : 16);
    // title block
    ctx.fillStyle = MENU_RED; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 ' + (story ? 22 : 19) + 'px ' + FONT_BODY; swissTrack(ctx, 5);
    ctx.fillText('ZÜRICH  ·  ' + weekDateLabel(m.from).toUpperCase() + ' TO ' + weekDateLabel(win.to).toUpperCase(), W / 2, y + 18); swissTrack(ctx, 0);
    y += story ? 44 : 36;
    var hpx = story ? 108 : 86, lines;
    for (;;) { ctx.font = '400 ' + hpx + 'px ' + FONT_DISPLAY; lines = wrapWords(ctx, m.copy.headline, innerW); if (lines.length <= 2 || hpx <= 48) break; hpx -= 4; }
    ctx.fillStyle = WEEK_INK;
    lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, y + (i + 1) * hpx * 1.02 - hpx * 0.14); });
    y += lines.length * hpx * 1.02 + (story ? 14 : 8);
    // ornament: rule, diamond, rule
    ctx.fillStyle = MENU_RED; ctx.fillRect(W / 2 - 140, y + 6, 120, 2); ctx.fillRect(W / 2 + 20, y + 6, 120, 2);
    ctx.save(); ctx.translate(W / 2, y + 7); ctx.rotate(Math.PI / 4); ctx.fillRect(-6, -6, 12, 12); ctx.restore();
    y += story ? 44 : 32;
    if (!m.rows.length) {
      ctx.fillStyle = WEEK_INK; ctx.textAlign = 'center';
      ctx.font = '400 ' + (story ? 60 : 52) + 'px ' + FONT_DISPLAY; ctx.fillText('KITCHEN CLOSED THIS WEEK', W / 2, y + 120);
      ctx.fillStyle = MENU_GREY; ctx.font = '600 28px ' + FONT_BODY; ctx.fillText('The calendar has the next ones', W / 2, y + 170);
      return;
    }
    // sections per day; sizes scaled so the whole card fits above the key floor
    var groups = [], last = null;
    m.rows.forEach(function (row) { if (!last || last.date !== row.e.date) { last = { date: row.e.date, day: row.day, label: row.date, items: [] }; groups.push(last); } last.items.push(row); });
    var bandBot = weekFloor(spec) - 8;
    // sizes at scale 1: the name line carries the time and venue in grey after the name, the
    // calendar's Info line sits under it in regular ink (emoji stripped); a second Info line
    // only when the week is quiet enough. Three passes settle the scale k against the real
    // line counts: assume two lines, measure at that k, measure again at the resulting k.
    var base = story ? 1 : 0.85, headH0 = 56 * base, gapG0 = 12 * base, nameH0 = 46 * base, infoH0 = 32 * base, itemGap0 = 10 * base;
    var infos = m.rows.map(function (r) { return stripEmoji(r.info); });
    var kCap = story ? 1.3 : 1.15;
    function needFor(counts) { var n = groups.length * (headH0 + gapG0); m.rows.forEach(function (r, i) { n += nameH0 + infoH0 * counts[i] + itemGap0; }); return n; }
    function countsAt(k, cap) { return infos.map(function (t) { return t ? weekInfoLines(ctx, t, innerW, Math.round(28 * k), Math.round(20 * k), '400', FONT_BODY, cap).lines.length : 0; }); }
    var k = Math.min(kCap, (bandBot - y) / needFor(infos.map(function (t) { return t ? 2 : 0; })));
    var maxLines = k >= 0.9 ? 2 : 1;
    if (maxLines === 1) k = Math.min(kCap, (bandBot - y) / needFor(infos.map(function (t) { return t ? 1 : 0; })));
    var counts = countsAt(k, maxLines); k = Math.min(kCap, (bandBot - y) / needFor(counts));
    counts = countsAt(k, maxLines); k = Math.min(k, (bandBot - y) / needFor(counts));
    var headH = headH0 * k, gapG = gapG0 * k;
    groups.forEach(function (gr) {
      var d = parseYmd(gr.date), full = d ? DAY_FULL[d.getDay()] : gr.day;
      ctx.fillStyle = MENU_RED; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var hp = Math.round(22 * k);
      ctx.font = '700 ' + hp + 'px ' + FONT_BODY; swissTrack(ctx, 4);
      var label = (full + '  ' + gr.label).toUpperCase(), lw = ctx.measureText(label).width + 40;
      ctx.fillText(label, W / 2, y + headH / 2); swissTrack(ctx, 0);
      ctx.fillRect(pad, y + headH / 2, (innerW - lw) / 2 - 12, 1.5); ctx.fillRect(W - pad - ((innerW - lw) / 2 - 12), y + headH / 2, (innerW - lw) / 2 - 12, 1.5);
      y += headH;
      gr.items.forEach(function (row) {
        var i = m.rows.indexOf(row), sell = infos[i], nameH = nameH0 * k, py = y + nameH * 0.5;
        var price = weekMenuPrice(row.price);
        ctx.textBaseline = 'middle'; ctx.textAlign = 'right'; ctx.fillStyle = WEEK_INK;
        ctx.font = '800 ' + Math.round(32 * k) + 'px ' + FONT_BODY;
        var pw = price ? ctx.measureText(price).width : 0;
        if (price) ctx.fillText(price, W - pad, py);
        ctx.textAlign = 'left';
        // the time and venue after the name in grey; a long venue shrinks to at most 55 percent
        // of the line before the name shrinks, so neither can run into the price
        var sub = [row.time, row.venue].filter(Boolean).join(' · '), subPx = Math.round(22 * k);
        if (sub) subPx = fitFont(ctx, sub, (innerW - pw - 70) * 0.55, subPx, Math.round(14 * k), '500', FONT_BODY);
        var sw = sub ? ctx.measureText(sub).width + 16 : 0;
        var nameW = innerW - pw - sw - 70;
        fitFont(ctx, row.name, nameW, Math.round(36 * k), 20, '800', FONT_BODY);
        ctx.fillText(row.name, pad, py);
        var nw = ctx.measureText(row.name).width;
        ctx.fillStyle = MENU_GREY; ctx.font = '500 ' + subPx + 'px ' + FONT_BODY;
        if (sub) ctx.fillText(sub, pad + nw + 16, py + 2);
        if (price) menuLeader(ctx, pad + nw + sw + 6, W - pad - pw - 8, py + 6, MENU_GREY);
        y += nameH;
        if (sell) {   // the calendar's Info line as the dish description
          var info = weekInfoLines(ctx, sell, innerW, Math.round(28 * k), Math.round(20 * k), '400', FONT_BODY, maxLines);
          ctx.fillStyle = WEEK_INK; ctx.font = '400 ' + info.px + 'px ' + FONT_BODY;
          info.lines.forEach(function (ln, li) { ctx.fillText(ln, pad, y + infoH0 * k * (li + 0.5)); });
          y += infoH0 * k * info.lines.length;
        }
        y += itemGap0 * k;
      });
      y += gapG;
    });
  }

  var WEEK_STYLES = { classic: paintWeekPolaroid, ticket: paintWeekTicket, swiss: paintWeekSwiss, type: paintWeekType, lava: paintWeekLava, comic: paintWeekComic, flap: paintWeekFlap, station: paintWeekStation, chalk: paintWeekChalk, menu: paintWeekMenu };
  var WEEK_EVENTS = parseCatalog('iyf-week-events');
  var WEEK_INFO = parseCatalog('iyf-week-info');   // the calendar's Info line per show and date

  // Build the model for a window and paint it. wk = { from, v }. Exposed on window for previews.
  function drawWeek(canvas, wk, format, style, done) {
    var paint = WEEK_STYLES[style] || paintWeekPolaroid;
    var spec = flyerSpec(format);
    canvas.width = spec.w; canvas.height = spec.h;
    var ctx = canvas.getContext('2d');
    var win = weekWindow(wk.from), evs = weekEvents(WEEK_EVENTS, win.from);
    var copy = weekCopy(win.from, wk.v, evs.length);
    var srcs = ['/assets/img/inyourface.png', assetURL(pickBackdrop())];
    // Rows carry the show's own artwork (the post's thumbnail, else its card image, else the
    // feature image); the hosts stay off the image and only their handles are offered.
    var rows = evs.map(function (e) {
      var s = weekShowFor(e, SHOWS);
      srcs.push(assetURL((s && (s.thumb || s.image || s.img)) || ''));
      return {
        e: e, name: weekShowName(e, SHOWS), day: weekDayLabel(e.date), date: weekDateLabel(e.date), time: weekTime(e),
        venue: weekVenueShort(e.venue || (s && s.venue) || ''), serial: 'Nº ' + showCode(e.show, e.start || e.date), price: e.price, tagline: s ? showTagline(s.title) : '', info: stripEmoji(weekInfoFor(WEEK_INFO, e)),   // no emoji on any image (Harry); the caption keeps them
        thumb: null, thumbAt: srcs.length - 1
      };
    });
    loadBrandFonts()
      .then(function () { return Promise.all(srcs.map(loadImg)); })
      .then(function (imgs) {
        rows.forEach(function (row) { row.thumb = imgs[row.thumbAt]; });
        paint(ctx, spec, { rows: rows, from: win.from, copy: copy, logo: imgs[0], backdrop: imgs[1], n: rows.length, nowMs: Date.now() });
        if (done) done(null);
      })
      .catch(function (e) { if (done) done(e); });
  }

  function ensureWeekCss() {
    if (document.getElementById('iyf-week-css')) return;
    var st = document.createElement('style');
    st.id = 'iyf-week-css';
    st.textContent =
      '.iyf-week__from{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:.6rem;margin:0 auto 1rem}' +
      '.iyf-week__from input{font:inherit;padding:.45rem .6rem;border-radius:8px;border:2px solid rgba(255,243,224,.4);background:#0F0F10;color:#FFF3E0}' +
      '.iyf-week__from label{font-weight:700}' +
      '.iyf-week__list{max-width:420px;margin:.5rem auto 1rem;padding:0;list-style:none;font-size:.9rem}' +
      '.iyf-week__list li{padding:.25rem 0;border-bottom:1px solid rgba(255,243,224,.15)}' +
      '.iyf-week__actions{display:flex;flex-wrap:wrap;justify-content:center;gap:.6rem;max-width:420px;margin:.85rem auto 0}' +
      '.iyf-week__actions .lineup-lab__copy{flex:1 1 45%}' +
      '.iyf-week__row{max-width:420px;margin:.6rem auto 0;text-align:center}';
    document.head.appendChild(st);
  }

  // The /week/ page. Everything re-renders in place; the URL mirrors the state.
  function renderWeek() {
    ensureFlyerCss(); ensureWeekCss();
    var p = new URLSearchParams(window.location.search);
    var wk = {
      from: (p.get('from') || '').trim(),
      style: (p.get('style') || '').trim().toLowerCase(),
      format: (p.get('format') || '').trim().toLowerCase(),
      v: parseInt(p.get('v') || '', 10)
    };
    // A fresh load (no v in the URL) rolls a new headline each time, so reloading is a way to
    // try another; the URL then carries v, so a copied link re-opens the same words.
    if (isNaN(wk.v) || wk.v < 0) wk.v = Math.floor(Math.random() * 1000);
    if (!parseYmd(wk.from)) wk.from = ymd(new Date());
    if (!WEEK_STYLES[wk.style]) wk.style = 'classic';
    if (wk.format !== 'post') wk.format = 'story';
    function sync() {
      var q = 'from=' + enc(wk.from) + '&style=' + enc(wk.style) + '&format=' + enc(wk.format) + '&v=' + wk.v;
      try { window.history.replaceState(null, '', window.location.pathname + '?' + q); } catch (e) { /* file: or sandbox */ }
      try { window.__lineupMakerLastURL = window.location.pathname + '?' + q; } catch (e) { /* read-only env */ }
    }
    function paint() { sync(); build(); }
    function build() {
      weekRoot.textContent = '';
      var win = weekWindow(wk.from), evs = weekEvents(WEEK_EVENTS, win.from);
      var head = el('div', 'lineup-lab__head');
      head.appendChild(el('h1', 'lineup-lab__title', '📅 Week Story'));
      weekRoot.appendChild(head);
      weekRoot.appendChild(el('p', 'lineup-lab__sub', 'The Sunday story: every show from the chosen day through the next seven days, ready to post with the calendar link sticker.'));

      var fromRow = el('div', 'iyf-week__from');
      var lab = el('label', '', 'Week starting'); lab.htmlFor = 'iyf-week-from';
      var inp = document.createElement('input'); inp.type = 'date'; inp.id = 'iyf-week-from'; inp.value = wk.from;
      inp.addEventListener('change', function () { if (parseYmd(inp.value)) { wk.from = inp.value; paint(); } });
      fromRow.appendChild(lab); fromRow.appendChild(inp);
      fromRow.appendChild(el('span', 'lineup-lab__copy-hint', win.from === wk.from ? 'to ' + win.to : ''));
      weekRoot.appendChild(fromRow);

      var list = el('ul', 'iyf-week__list');
      if (!evs.length) list.appendChild(el('li', '', 'No shows in this window.'));
      evs.forEach(function (e) {
        list.appendChild(el('li', '', [weekDayLabel(e.date) + ' ' + weekDateLabel(e.date), weekTime(e), weekShowName(e, SHOWS), e.venue].filter(Boolean).join(' · ')));
      });
      weekRoot.appendChild(list);

      var panel = el('div', 'lineup-lab__flyer');
      panel.appendChild(el('h2', 'lineup-lab__outputs-title', '🎨 Share image'));
      var styleToggle = el('div', 'lineup-lab__fmt-toggle lineup-lab__style-toggle');
      [['classic', '🎞️ Polaroid'], ['ticket', '🎟️ Ticket'], ['swiss', '🔴 Swiss'], ['type', '🔠 Bold Type'], ['lava', '🌋 Lava'], ['comic', '💥 Comic'], ['flap', '🛫 Departures'], ['station', '🚉 Station'], ['chalk', '🖍️ Chalkboard'], ['menu', '🍽️ Menu']].forEach(function (pr) {
        var b = button('lineup-lab__fmt-btn' + (wk.style === pr[0] ? ' is-on' : ''), pr[1]);
        b.setAttribute('aria-pressed', wk.style === pr[0] ? 'true' : 'false');
        b.addEventListener('click', function () { wk.style = pr[0]; paint(); });
        styleToggle.appendChild(b);
      });
      panel.appendChild(styleToggle);
      var toggle = el('div', 'lineup-lab__fmt-toggle');
      [['story', '📱 Story 9:16'], ['post', '🖼️ Post 4:5']].forEach(function (pr) {
        var b = button('lineup-lab__fmt-btn' + (wk.format === pr[0] ? ' is-on' : ''), pr[1]);
        b.setAttribute('aria-pressed', wk.format === pr[0] ? 'true' : 'false');
        b.addEventListener('click', function () { wk.format = pr[0]; paint(); });
        toggle.appendChild(b);
      });
      panel.appendChild(toggle);

      var canvas = el('canvas', 'lineup-lab__canvas');
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Generated week story preview');
      panel.appendChild(canvas);
      var status = el('p', 'lineup-lab__copy-status', 'Rendering…');
      panel.appendChild(status);
      var dl = el('button', 'btn-ticket', '⬇️ Download PNG'); dl.type = 'button'; dl.disabled = true;
      panel.appendChild(dl);
      var shuffleRow = el('div', 'iyf-week__row');
      var shuffle = button('lineup-lab__copy lineup-lab__copy--quiet', '🔀 Other words');
      shuffle.addEventListener('click', function () { wk.v = wk.v + 1; paint(); });
      shuffleRow.appendChild(shuffle);
      shuffleRow.appendChild(el('span', 'lineup-lab__copy-hint', ' A different headline, same shows.'));
      panel.appendChild(shuffleRow);

      var actions = el('div', 'iyf-week__actions');
      function addCopy(label, getter, empty) {
        var b = button('lineup-lab__copy lineup-lab__copy--quiet', label);
        b.addEventListener('click', function () {
          var text = getter();
          if (!text) { status.textContent = empty || 'Nothing to copy.'; return; }
          status.textContent = '…'; copy(text, status);
        });
        actions.appendChild(b);
      }
      addCopy('＠ Copy Insta handles', function () { return weekHandlesText(evs, SHOWS, COMEDIANS); }, 'No Instagram handles for these hosts.');
      addCopy('🔗 Copy calendar link', function () { return WEEK_CAL_LINK; });
      addCopy('💬 Copy caption', function () { return weekCaption(evs, SHOWS, win.from, WEEK_INFO); });
      panel.appendChild(actions);
      panel.appendChild(el('p', 'lineup-lab__copy-hint', 'Handles tag the hosts in the story; the calendar link goes in the link sticker (that is the call to action); the caption is for a post.'));
      weekRoot.appendChild(panel);

      drawWeek(canvas, wk, wk.format, wk.style, function (err) {
        if (err) { status.textContent = 'Could not render the image, try again.'; return; }
        status.textContent = evs.length ? 'Looks good? Download, add the link sticker, post it. 🎤' : 'No shows in this window: pick another start day.';
        dl.disabled = false;
        dl.addEventListener('click', function () {
          downloadPng(canvas, 'week-' + win.from + '-' + wk.format + '.png', function () { status.textContent = 'Download failed, long-press / right-click the image to save it.'; });
        });
      });
    }
    paint();
  }

  // --- Ad Card (/adcard/): one headline over a photo or on a brand field --------------------
  // The Meta ads bank (meta-ads/creative-bank-plan.md) is evergreen: no names, no dates, no
  // prices, one sentence that names a person. Six looks, all in the flyer palette, all with
  // the text inside the key-content area so a story or a reel does not crop it. Painted by
  // drawAdCard(canvas, ad, format, done) with ad = { headline, sub, style, photo }; exposed as
  // window.__iyfDrawAdCard for script/meta-bank.ts.
  var AD_INK = '#0F0F10', AD_CREAM = '#FFF3E0', AD_YELLOW = '#FFD54F', AD_RED = '#E53935', AD_SCRIM = '#1A1A1D';
  function adcardStyles() { return ['photo', 'swiss', 'type', 'chalk', 'station', 'logo']; }
  var AD_STATION_BG = '/assets/img/uploads/comedybrew_featured.png';   // the station board's default backdrop; bg= in the URL overrides, empty for none
  // Shrink from startPx until the text fits in maxLines (or minPx). Returns { px, lines }.
  function adFit(ctx, text, maxW, startPx, minPx, maxLines, weight, family) {
    var px = startPx, lines;
    for (;;) { ctx.font = weight + ' ' + px + 'px ' + family; lines = wrapWords(ctx, text, maxW); if (lines.length <= maxLines || px <= minPx) break; px -= 4; }
    return { px: px, lines: lines };
  }
  function adLines(ctx, fit, x, y, color, align, lh) {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
    var lineH = fit.px * (lh || 1.08);
    fit.lines.forEach(function (ln, i) { ctx.fillText(ln, x, y + (i + 1) * lineH - lineH * 0.2); });
    return y + fit.lines.length * lineH;
  }
  function adLogo(ctx, m, x, y, h, mono) {
    if (!m.logo) return 0;
    var w = h * (m.logo.width / m.logo.height);
    if (mono) drawMono(ctx, m.logo, x, y, w, h); else ctx.drawImage(m.logo, x, y, w, h);
    return w;
  }
  // 1. Photo: the room, a dark scrim from the middle down, the headline in Anton on it.
  function paintAdPhoto(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 30, maxW = W - pad * 2;
    ctx.fillStyle = AD_INK; ctx.fillRect(0, 0, W, H);
    if (m.photo) drawCover(ctx, m.photo, 0, 0, W, H);
    var g = ctx.createLinearGradient(0, H * 0.3, 0, H);
    g.addColorStop(0, 'rgba(15,15,16,0)'); g.addColorStop(0.45, 'rgba(15,15,16,0.72)'); g.addColorStop(1, 'rgba(15,15,16,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    adLogo(ctx, m, pad - 10, spec.keyTop + 10, story ? 130 : 100);
    var bottom = H - spec.keyBottom - 26;
    var sub = m.sub ? adFit(ctx, m.sub, maxW, story ? 46 : 40, 30, 2, '600', FONT_BODY) : null;
    var subH = sub ? sub.lines.length * sub.px * 1.2 + 18 : 0;
    var head = adFit(ctx, m.headline, maxW, story ? 124 : 108, 56, 3, '400', FONT_DISPLAY);
    var headH = head.lines.length * head.px * 1.04;
    var y = bottom - subH - headH;
    ctx.font = '400 ' + head.px + 'px ' + FONT_DISPLAY;
    adLines(ctx, head, pad, y, AD_CREAM, 'left', 1.04);
    if (sub) { ctx.font = '600 ' + sub.px + 'px ' + FONT_BODY; adLines(ctx, sub, pad, bottom - subH + 10, AD_YELLOW, 'left', 1.2); }
  }
  // 2. Swiss: the near-white paper, one red circle, Inter 800 flush left in ink.
  function paintAdSwiss(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 34, maxW = W - pad * 2;
    ctx.fillStyle = SWISS_PAPER; ctx.fillRect(0, 0, W, H);
    var r = Math.round(W * 0.21);
    ctx.fillStyle = AD_RED; ctx.beginPath(); ctx.arc(W - pad - r * 0.55, spec.keyTop + r * 0.85, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = AD_RED; ctx.font = '700 ' + (story ? 40 : 34) + 'px ' + FONT_BODY; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('ZÜRICH', pad, spec.keyTop + (story ? 60 : 50));
    ctx.fillStyle = AD_INK; ctx.fillRect(pad, spec.keyTop + (story ? 84 : 70), Math.round(maxW * 0.28), 6);
    var y = spec.keyTop + r * 1.9 + (story ? 60 : 30);
    var head = adFit(ctx, m.headline, maxW, story ? 118 : 100, 52, 4, '800', FONT_BODY);
    ctx.font = '800 ' + head.px + 'px ' + FONT_BODY;
    y = adLines(ctx, head, pad, y, AD_INK, 'left', 1.02) + (story ? 34 : 24);
    if (m.sub) { var sub = adFit(ctx, m.sub, maxW, story ? 46 : 40, 30, 2, '600', FONT_BODY); ctx.font = '600 ' + sub.px + 'px ' + FONT_BODY; y = adLines(ctx, sub, pad, y, AD_RED, 'left', 1.2); }
    // The logo sits on the key-content floor, or under the words when they reach that far
    // (the story card's floor is high, for Reels).
    var lh = story ? 96 : 80, logoY = H - spec.keyBottom - lh - 10;
    if (y + 20 > logoY) logoY = y + 20;
    adLogo(ctx, m, pad, logoY, lh);
  }
  // 3. Bold Type: ink field, the headline in Anton capitals as big as it goes, a red bar for the sub.
  function paintAdType(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 30, maxW = W - pad * 2;
    ctx.fillStyle = AD_INK; ctx.fillRect(0, 0, W, H);
    var lh = story ? 120 : 96, lw = adLogo(ctx, m, 0, 0, 0);   // measured below
    if (m.logo) { lw = lh * (m.logo.width / m.logo.height); ctx.drawImage(m.logo, W / 2 - lw / 2, spec.keyTop + 8, lw, lh); }
    var barH = m.sub ? (story ? 150 : 120) : 0, barY = H - spec.keyBottom - barH;
    var top = spec.keyTop + lh + (story ? 60 : 36), avail = barY - top - (story ? 40 : 24);
    var head = adFit(ctx, String(m.headline).toUpperCase(), maxW, story ? 176 : 150, 64, 4, '400', FONT_DISPLAY);
    var lineH = head.px * 1.0, blockH = head.lines.length * lineH;
    while (blockH > avail && head.px > 64) { head = adFit(ctx, String(m.headline).toUpperCase(), maxW, head.px - 8, 64, 4, '400', FONT_DISPLAY); lineH = head.px * 1.0; blockH = head.lines.length * lineH; }
    ctx.font = '400 ' + head.px + 'px ' + FONT_DISPLAY;
    var y = top + (avail - blockH) / 2;
    ctx.fillStyle = AD_CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    head.lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, y + (i + 1) * lineH - lineH * 0.14); });
    if (m.sub) {
      ctx.fillStyle = AD_RED; ctx.fillRect(0, barY, W, barH);
      var sub = adFit(ctx, m.sub, maxW, story ? 48 : 42, 30, 2, '700', FONT_BODY);
      ctx.font = '700 ' + sub.px + 'px ' + FONT_BODY; ctx.fillStyle = AD_CREAM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var sl = sub.px * 1.15, sy = barY + barH / 2 - (sub.lines.length - 1) * sl / 2;
      sub.lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, sy + i * sl); });
    }
  }
  // 4. Chalkboard: the week story's board, the headline in chalk marker, the sub in chalk white.
  function paintAdChalk(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 40, maxW = W - pad * 2;
    var rnd = chalkRnd('adcard|' + m.headline), bg = chalkRnd('chalk|board');
    ctx.fillStyle = CHALK_BOARD; ctx.fillRect(0, 0, W, H);
    var vg = ctx.createRadialGradient(W / 2, H * 0.4, H * 0.1, W / 2, H * 0.5, H * 0.8);
    vg.addColorStop(0, 'rgba(255,255,255,0.05)'); vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.fillStyle = CHALK_WHITE;
    for (var i = 0; i < 900; i++) { ctx.globalAlpha = 0.03 + bg() * 0.09; ctx.fillRect(bg() * W, bg() * H, 1 + bg() * 2, 1 + bg() * 2); }
    for (var s = 0; s < 4; s++) { ctx.globalAlpha = 0.035; ctx.beginPath(); ctx.ellipse(bg() * W, bg() * H, 120 + bg() * 220, 40 + bg() * 60, bg() * Math.PI, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
    var fx = spec.keySide + 8, fy = spec.keyTop - 6, fw = W - fx * 2, fh = H - spec.keyBottom - fy + 4;
    chalkLine(ctx, fx, fy, fx + fw, fy, CHALK_WHITE, 3, bg); chalkLine(ctx, fx + fw, fy, fx + fw, fy + fh, CHALK_WHITE, 3, bg);
    chalkLine(ctx, fx + fw, fy + fh, fx, fy + fh, CHALK_WHITE, 3, bg); chalkLine(ctx, fx, fy + fh, fx, fy, CHALK_WHITE, 3, bg);
    var lh = story ? 120 : 96;
    if (m.logo) { var lw = lh * (m.logo.width / m.logo.height); ctx.save(); ctx.globalAlpha = 0.9; drawMono(ctx, m.logo, W / 2 - lw / 2, spec.keyTop + 18, lw, lh); ctx.restore(); }
    var head = adFit(ctx, m.headline, maxW, story ? 112 : 96, 52, 3, '400', FONT_ACCENT);
    var sub = m.sub ? adFit(ctx, m.sub, maxW, story ? 52 : 46, 32, 2, '400', FONT_ACCENT) : null;
    var lineH = head.px * 1.12, blockH = head.lines.length * lineH + (sub ? 40 + sub.lines.length * sub.px * 1.2 : 0);
    var top = spec.keyTop + lh + 40, floor = H - spec.keyBottom - 30;
    var y = top + Math.max(0, (floor - top - blockH) / 2);
    head.lines.forEach(function (ln, i) { chalkText(ctx, ln, W / 2, y + (i + 1) * lineH - lineH * 0.2, head.px + 'px ' + FONT_ACCENT, CHALK_YELLOW, 'center', rnd); });
    y += head.lines.length * lineH;
    ctx.font = head.px + 'px ' + FONT_ACCENT;
    var lastW = ctx.measureText(head.lines[head.lines.length - 1]).width;
    chalkLine(ctx, W / 2 - lastW / 2, y + 2, W / 2 + lastW / 2, y + 6, CHALK_YELLOW, 4, rnd);
    if (sub) { y += 40; sub.lines.forEach(function (ln, i) { chalkText(ctx, ln, W / 2, y + (i + 1) * sub.px * 1.2 - sub.px * 0.2, sub.px + 'px ' + FONT_ACCENT, CHALK_WHITE, 'center', rnd); }); }
  }
  // 5. Station board: the indigo board with a red notice banner carrying the headline; the sub
  //    lines (split on " | ") are the white rows, the last row gets the red "DO" box.
  function paintAdStation(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story';
    ctx.fillStyle = WEEK_INK; ctx.fillRect(0, 0, W, H);
    // A subtle backdrop (Harry, 2026-09-13): the show photo behind the board, most of the way to ink.
    if (m.bg) { drawCover(ctx, m.bg, 0, 0, W, H); ctx.fillStyle = 'rgba(15,15,16,0.8)'; ctx.fillRect(0, 0, W, H); }
    var lh = story ? 100 : 80, y = spec.keyTop + 6;
    if (m.logo) { var lw = lh * (m.logo.width / m.logo.height); ctx.drawImage(m.logo, W / 2 - lw / 2, y, lw, lh); }
    y += lh + (story ? 22 : 16);
    var bx = spec.keySide + 4, bw = W - bx * 2;
    var pad = bx + 14, innerW = W - pad * 2;
    var head = adFit(ctx, m.headline, innerW - (story ? 110 : 90), story ? 56 : 46, 30, 3, '700', FONT_BODY);
    var banH = Math.max(story ? 168 : 140, head.lines.length * head.px * 1.2 + 40);
    // The board is as tall as its rows (banner, strip, rows, a foot), centred in the room left
    // under the logo, so three rows do not sit on an empty field.
    var rows = String(m.sub || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
    var stripH = story ? 60 : 50, rowH = story ? 118 : 96, rpx = story ? 44 : 38;
    var boardH = banH + stripH + rows.length * rowH + (story ? 40 : 30), floor = H - spec.keyBottom - 14;
    y += Math.max(0, Math.floor((floor - y - boardH) / 2));
    ctx.fillStyle = STATION_BLUE; ctx.fillRect(bx, y, bw, boardH);
    ctx.fillStyle = WEEK_RED; ctx.fillRect(bx, y, bw, banH);
    var pb = Math.round((story ? 168 : 140) * 0.42), px0 = pad, py0 = y + (banH - pb) / 2;
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3; ctx.strokeRect(px0, py0, pb, pb);
    ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '400 ' + Math.round(pb * 0.7) + 'px ' + FONT_DISPLAY; ctx.fillText('★', px0 + pb / 2, py0 + pb / 2 + 2);
    ctx.font = '700 ' + head.px + 'px ' + FONT_BODY; ctx.textAlign = 'left';
    var tx = px0 + pb + 22, hl = head.px * 1.2, hTop = y + (banH - hl * head.lines.length) / 2;
    head.lines.forEach(function (ln, i) { ctx.fillText(ln, tx, hTop + hl * (i + 0.5)); });
    y += banH;
    ctx.fillStyle = STATION_GREY; ctx.fillRect(bx, y, bw, stripH);
    ctx.fillStyle = STATION_BLUE; ctx.font = '700 ' + (story ? 30 : 26) + 'px ' + FONT_BODY; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText('Zürich', pad, y + stripH / 2); ctx.textAlign = 'right'; ctx.fillText('Nach · Gleis · Hinweis', W - pad, y + stripH / 2);
    y += stripH;
    rows.forEach(function (row, i) {
      var ry = y + i * rowH;
      ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.font = '700 ' + rpx + 'px ' + FONT_BODY;
      var fit = adFit(ctx, row, innerW - (i === rows.length - 1 ? 150 : 0), rpx, 26, 2, '700', FONT_BODY);
      ctx.font = '700 ' + fit.px + 'px ' + FONT_BODY;
      var rl = fit.px * 1.15, rTop = ry + rowH / 2 - (fit.lines.length - 1) * rl / 2;
      fit.lines.forEach(function (ln, k) { ctx.fillText(ln, pad, rTop + k * rl); });
      if (i === rows.length - 1) { ctx.fillStyle = WEEK_RED; var boxW = 120, boxH = rowH - 28; ctx.fillRect(W - pad - boxW, ry + 14, boxW, boxH); ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center'; ctx.font = '700 ' + (story ? 40 : 34) + 'px ' + FONT_BODY; ctx.fillText('DO', W - pad - boxW / 2, ry + rowH / 2); }
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(bx + 10, ry + rowH - 1, bw - 20, 1);
    });
  }
  // 6. Logo: brand red, the logo big, the headline under it in Anton cream, the sub in ink.
  function paintAdLogo(ctx, spec, m) {
    var W = spec.w, H = spec.h, story = spec.format === 'story', pad = spec.keySide + 30, maxW = W - pad * 2;
    ctx.fillStyle = AD_RED; ctx.fillRect(0, 0, W, H);
    var sub = m.sub ? adFit(ctx, m.sub, maxW, story ? 46 : 40, 30, 2, '700', FONT_BODY) : null;
    var head = adFit(ctx, m.headline, maxW, story ? 116 : 100, 56, 3, '400', FONT_DISPLAY);
    var headH = head.lines.length * head.px * 1.04, subH = sub ? sub.lines.length * sub.px * 1.2 + 20 : 0;
    var lw = Math.round(W * (story ? 0.56 : 0.5)), lh = m.logo ? lw * (m.logo.height / m.logo.width) : lw;
    var total = lh + (story ? 60 : 44) + headH + subH, top = spec.keyTop + Math.max(0, (H - spec.keyTop - spec.keyBottom - total) / 2);
    if (m.logo) ctx.drawImage(m.logo, W / 2 - lw / 2, top, lw, lh);
    var y = top + lh + (story ? 60 : 44);
    ctx.font = '400 ' + head.px + 'px ' + FONT_DISPLAY;
    y = adLines(ctx, head, W / 2, y, AD_CREAM, 'center', 1.04);
    if (sub) { ctx.font = '700 ' + sub.px + 'px ' + FONT_BODY; adLines(ctx, sub, W / 2, y + 20, AD_INK, 'center', 1.2); }
  }
  var AD_STYLES = { photo: paintAdPhoto, swiss: paintAdSwiss, type: paintAdType, chalk: paintAdChalk, station: paintAdStation, logo: paintAdLogo };

  // ad = { headline, sub, style, photo } (photo a root-relative gallery path or empty).
  function drawAdCard(canvas, ad, format, done) {
    var paint = AD_STYLES[ad.style] || paintAdPhoto;
    // Ad cards also run on Reels, whose own controls cover the bottom third and the top strip:
    // a story card keeps its words above that (Stories and Reels safe zone), post cards as before.
    var spec = format === 'story' ? Object.assign({}, flyerSpec(format), { keyTop: 270, keyBottom: 690 }) : flyerSpec(format);
    canvas.width = spec.w; canvas.height = spec.h;
    var ctx = canvas.getContext('2d');
    var bg = ad.bg !== undefined ? ad.bg : (ad.style === 'station' ? AD_STATION_BG : '');
    var srcs = ['/assets/img/inyourface.png', assetURL(ad.photo || ''), assetURL(bg || '')];
    loadBrandFonts()
      .then(function () { return Promise.all(srcs.map(function (s) { return s ? loadImg(s) : Promise.resolve(null); })); })
      .then(function (imgs) {
        paint(ctx, spec, { headline: stripEmoji(ad.headline || ''), sub: stripEmoji(ad.sub || ''), logo: imgs[0], photo: imgs[1], bg: imgs[2] });
        if (done) done(null);
      })
      .catch(function (e) { if (done) done(e); });
  }

  // The /adcard/ page: a small form, the canvas, a download button; the URL mirrors the state.
  function renderAdcard() {
    ensureFlyerCss(); ensureWeekCss();
    var p = new URLSearchParams(window.location.search);
    var ad = { headline: (p.get('headline') || 'Lost in Zürich? Find your funny.').trim(), sub: (p.get('sub') || '').trim(), style: (p.get('style') || 'photo').trim().toLowerCase(), photo: (p.get('photo') || '').trim(), bg: p.has('bg') ? (p.get('bg') || '').trim() : undefined, format: (p.get('format') || 'post').trim().toLowerCase() };
    if (!AD_STYLES[ad.style]) ad.style = 'photo';
    if (ad.format !== 'story') ad.format = 'post';
    function sync() {
      var q = 'headline=' + enc(ad.headline) + '&sub=' + enc(ad.sub) + '&style=' + enc(ad.style) + '&photo=' + enc(ad.photo) + (ad.bg !== undefined ? '&bg=' + enc(ad.bg) : '') + '&format=' + enc(ad.format);
      try { window.history.replaceState(null, '', window.location.pathname + '?' + q); } catch (e) { /* sandbox */ }
    }
    function build() {
      adRoot.textContent = '';
      var head = el('div', 'lineup-lab__head');
      head.appendChild(el('h1', 'lineup-lab__title', '🪧 Ad Card'));
      adRoot.appendChild(head);
      adRoot.appendChild(el('p', 'lineup-lab__sub', 'One headline, one line under it, one look. The Meta ads bank renders through this page; by hand it makes one image.'));
      var form = el('div', 'iyf-week__from');
      function field(label, key, wide) {
        var lab = el('label', '', label); var inp = document.createElement('input'); inp.type = 'text'; inp.value = ad[key]; inp.style.minWidth = wide ? '320px' : '200px';
        inp.addEventListener('change', function () { ad[key] = inp.value.trim(); paint(); }); lab.appendChild(inp); form.appendChild(lab);
      }
      field('Headline', 'headline', true); field('Sub', 'sub', true); field('Photo path', 'photo', true);
      adRoot.appendChild(form);
      var styles = el('div', 'iyf-week__actions');
      adcardStyles().forEach(function (s) { var b = el('button', 'lineup-lab__copy' + (s === ad.style ? ' is-active' : ''), s); b.type = 'button'; b.addEventListener('click', function () { ad.style = s; paint(); }); styles.appendChild(b); });
      ['post', 'story'].forEach(function (f) { var b = el('button', 'lineup-lab__copy' + (f === ad.format ? ' is-active' : ''), f); b.type = 'button'; b.addEventListener('click', function () { ad.format = f; paint(); }); styles.appendChild(b); });
      adRoot.appendChild(styles);
      var canvas = document.createElement('canvas'); canvas.className = 'lineup-lab__flyer'; canvas.style.maxWidth = '420px'; canvas.style.width = '100%'; canvas.style.display = 'block'; canvas.style.margin = '1rem auto';
      adRoot.appendChild(canvas);
      var row = el('div', 'iyf-week__row');
      var dl = el('a', 'lineup-lab__copy', 'Download PNG'); dl.href = '#'; dl.addEventListener('click', function (ev) { ev.preventDefault(); var a = document.createElement('a'); a.download = 'adcard-' + ad.style + '-' + ad.format + '.png'; a.href = canvas.toDataURL('image/png'); a.click(); });
      row.appendChild(dl); adRoot.appendChild(row);
      drawAdCard(canvas, ad, ad.format, function (e) { if (e) adRoot.appendChild(el('p', 'lineup-lab__sub', 'Could not draw: ' + e)); });
    }
    function paint() { sync(); build(); }
    paint();
  }

  // Test/preview seam: expose the flyer entry points on window (browser-only, mirrors
  // __lineupMakerLastURL). Lets a harness render a flyer headlessly without walking the
  // wizard UI. No-op in read-only envs.
  try {
    window.__iyfDrawFlyer = drawFlyer; window.__iyfOpenFlyer = openFlyer; window.__iyfDrawWeek = drawWeek; window.__iyfDrawAdCard = drawAdCard;
    window.__iyfFlyerHandles = flyerHandles; window.__iyfFlyerHandlesText = flyerHandlesText;
  } catch (e) { /* read-only env */ }

  // --- route -----------------------------------------------------------------
  function render() {
    root.textContent = '';
    var stage = state.stage || inferStage();
    if (stage === 'order') return renderOrder();
    if (stage === 'pick') return show ? renderPick() : renderShowPicker();
    if (stage === 'format') return show ? renderFormat() : renderShowPicker();
    return renderShowPicker();
  }
  if (adRoot) renderAdcard(); else if (weekRoot) renderWeek(); else render();
})();

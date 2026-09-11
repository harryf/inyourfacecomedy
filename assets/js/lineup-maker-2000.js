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
      showCode: showCode, chargeLines: chargeLines, chargeLine: chargeLine, firstName: firstName,
      stubLines: stubLines, stubLine: stubLine,
      isGuest: isGuest, guestName: guestName, guestToken: guestToken, instaHandle: instaHandle
    };
    return;
  }

  var root = document.getElementById('lineup-lab');
  if (!root) return;

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
  function origin() { return root.getAttribute('data-origin') || window.location.origin; }
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
        var faces = ['400 64px "Anton"', '64px "Permanent Marker"', '700 48px "Inter"', '500 40px "Inter"'];
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
      { style: 'lineup', text: '#FFF3E0', field: '#0F0F10', kind: 'small' }    // date bar
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
    var fname = [(base || 'flyer'), dateSlug, format].filter(Boolean).join('-') + '.png';
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

  // Test/preview seam: expose the flyer entry points on window (browser-only, mirrors
  // __lineupMakerLastURL). Lets a harness render a flyer headlessly without walking the
  // wizard UI. No-op in read-only envs.
  try {
    window.__iyfDrawFlyer = drawFlyer; window.__iyfOpenFlyer = openFlyer;
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
  render();
})();

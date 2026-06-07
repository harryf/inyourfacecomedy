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
    // silently breaks the unit tests. dayLabel/faceScale/flyerSpec are defined far below.
    module.exports = {
      norm: norm, splitTitle: splitTitle, showDate: showDate,
      dayLabel: dayLabel, flyerDate: flyerDate, faceScale: faceScale, flyerSpec: flyerSpec,
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
        b.addEventListener('click', function () { status.textContent = '…'; copy(getter(), status); });
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

  // Canvas spec per Instagram format. Post = 1080x1350 (4:5). Story = 1080x1920
  // (9:16) with a UI-safe inset (top bar/avatar ~250px, bottom reply+link ~320px).
  function flyerSpec(format) {
    if (format === 'story') return { w: 1080, h: 1920, safeTop: 250, safeBottom: 320, format: 'story' };
    return { w: 1080, h: 1350, safeTop: 70, safeBottom: 70, format: 'post' };
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
  function firstName(name) { return (name || '').split(/\s+/)[0] || name || ''; }
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
  function flyerHeader(ctx, spec, m, opts) {
    opts = opts || {};
    var cx = spec.w / 2;
    var logoH = spec.format === 'story' ? 150 : 132;
    var logoY = spec.safeTop + (spec.format === 'story' ? 14 : 30);
    if (m.logo) {
      var lw = logoH * (m.logo.width / m.logo.height);
      ctx.drawImage(m.logo, cx - lw / 2, logoY, lw, logoH);
    }
    ctx.fillStyle = opts.taglineColor || '#FFD54F';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '34px ' + FONT_ACCENT;
    ctx.fillText('English stand-up comedy', cx, logoY + logoH + 42);
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

  // --- STYLE 1: Ticket Stub --------------------------------------------------
  function drawStubCard(ctx, img, cx, topY, w, name, star) {
    var frame = Math.round(w * 0.06);
    var photo = w - frame * 2;
    var capH = Math.round(w * 0.26);
    var h = frame + photo + capH;
    var x = cx - w / 2, y = topY;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.18)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x, y, w, h, 10); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 3; ctx.strokeStyle = '#0F0F10';
    roundRect(ctx, x, y, w, h, 10); ctx.stroke();
    var px = x + frame, py = y + frame;
    if (img) {
      ctx.save(); roundRect(ctx, px, py, photo, photo, 6); ctx.clip();
      drawCover(ctx, img, px, py, photo, photo); ctx.restore();
    } else {
      ctx.fillStyle = '#0F0F10'; ctx.fillRect(px, py, photo, photo);
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.5) + 'px ' + FONT_DISPLAY;
      ctx.fillText((name || '?').charAt(0).toUpperCase(), px + photo / 2, py + photo / 2 + 4);
    }
    if (star) {
      ctx.fillStyle = '#E53935'; ctx.beginPath();
      ctx.arc(px + photo - 4, py + 4, Math.max(16, photo * 0.12), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(photo * 0.14) + 'px ' + FONT_DISPLAY;
      ctx.fillText('★', px + photo - 4, py + 4 + 1);
    }
    // perforation notches punched out of the card sides
    ctx.fillStyle = '#FFF8EE';
    ctx.beginPath(); ctx.arc(x, y + h * 0.62, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + w, y + h * 0.62, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cap = firstName(name).toUpperCase();
    fitFont(ctx, cap, photo, Math.round(capH * 0.5), 16, '700', FONT_BODY);
    ctx.fillText(cap, cx, y + frame + photo + capH / 2);
    ctx.restore();
  }

  function drawTicketHost(ctx, cx, topY, host) {
    var w = 300;
    var tabW = 160, tabH = 48, tabY = topY;
    roundRect(ctx, cx - tabW / 2, tabY, tabW, tabH, tabH / 2);
    ctx.fillStyle = '#E53935'; ctx.fill();
    ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 27px ' + FONT_BODY;
    ctx.fillText('H O S T', cx, tabY + tabH / 2 + 1);
    var cardTop = tabY + tabH - 8;
    drawStubCard(ctx, host.img, cx, cardTop, w, host.name, false);
    var frame = Math.round(w * 0.06);
    var photo = w - frame * 2;
    var cardH = frame + photo + Math.round(w * 0.26);
    return cardTop + cardH;
  }

  function paintTicketStub(ctx, spec, m) {
    var W = spec.w, H = spec.h, top = spec.safeTop, bottom = spec.safeBottom, pad = 64, cx = W / 2;
    ctx.fillStyle = '#FFF8EE'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#0F0F10'; ctx.lineWidth = 6;
    ctx.strokeRect(pad * 0.5, top + 6, W - pad, H - top - bottom - 12);
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#0F0F10' });
    ctx.fillStyle = '#E53935'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '700 30px ' + FONT_BODY;
    ctx.fillText('A D M I T   O N E', cx, headerBottom + 8);
    dashedLine(ctx, pad, headerBottom + 28, W - pad, headerBottom + 28, '#0F0F10');
    var facesTop = headerBottom + 52;
    var metaBaseY = H - bottom - 40;
    var titleTop = drawShowTitle(ctx, spec, m, metaBaseY - 78, '#0F0F10', spec.format === 'story' ? 130 : 120, 3, false);
    drawMeta(ctx, spec, m, metaBaseY, '#E53935', '#FFF3E0', '#B71C1C');
    var rowTop = facesTop;
    if (m.host && m.host.slug) { rowTop = drawTicketHost(ctx, cx, facesTop, m.host) + 24; }
    faceGrid(ctx, spec, m.bill, pad, rowTop, W - pad * 2, (titleTop - 40) - rowTop, 1.32,
      spec.format === 'story' ? 230 : 205, function (ctx, it, ccx, ty, w) {
        drawStubCard(ctx, it.img, ccx, ty, w, it.name, it.headliner);
      });
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
    ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var cap = firstName(name).toUpperCase();
    fitFont(ctx, cap, photo, Math.round(capH * 0.8), 16, '700', FONT_BODY);
    ctx.fillText(cap, cx, y + photo + capH * 0.55);
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
    var nameY = pillY + pillH + 30;
    ctx.fillStyle = '#0F0F10'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    fitFont(ctx, firstName(host.name).toUpperCase(), 320, 40, 20, '', FONT_ACCENT);
    ctx.fillText(firstName(host.name).toUpperCase(), cx, nameY);
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
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#0F0F10' });
    var facesTop = headerBottom + 28;
    var metaBaseY = H - bottom - 40;
    var titleTop = drawRisoTitle(ctx, spec, m, metaBaseY - 86);
    drawMeta(ctx, spec, m, metaBaseY, '#0F0F10', '#FFF3E0', '#0F0F10');
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
  function drawMiniAvatar(ctx, it, cx, cy, r, withName) {
    var ring = it.host ? '#FFD54F' : (it.headliner ? '#FF5252' : '#FFF3E0');
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    if (it.img) drawCover(ctx, it.img, cx - r, cy - r, 2 * r, 2 * r);
    else {
      ctx.fillStyle = '#2A2A2D'; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
      ctx.fillStyle = '#FFD54F'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '400 ' + Math.round(r) + 'px ' + FONT_DISPLAY;
      ctx.fillText((it.name || '?').charAt(0).toUpperCase(), cx, cy + 2);
    }
    ctx.restore();
    ctx.restore();
    if (withName) {
      ctx.fillStyle = '#FFF3E0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      var cap = firstName(it.name).toUpperCase();
      fitFont(ctx, cap, r * 2.6, 22, 12, '500', FONT_BODY);
      ctx.fillText(cap, cx, cy + r + 20);
    }
  }

  function drawAvatarStrip(ctx, spec, m, x0, topY, bandW) {
    var acts = [];
    if (m.host && m.host.slug) acts.push({ img: m.host.img, name: m.host.name, host: true });
    m.bill.forEach(function (b) { acts.push({ img: b.img, name: b.name, headliner: b.headliner }); });
    if (!acts.length) return topY;
    var n = acts.length, gap = 14;
    var d = Math.min(120, (bandW - gap * (n - 1)) / n);
    var rows = 1, perRow = n;
    if (d < 66) { rows = 2; perRow = Math.ceil(n / 2); d = Math.min(120, (bandW - gap * (perRow - 1)) / perRow); }
    var withName = d >= 78;
    var rowH = d + (withName ? 40 : 18);
    var cx = x0 + bandW / 2;
    for (var r = 0; r < rows; r++) {
      var items = acts.slice(r * perRow, (r + 1) * perRow);
      var rowW = items.length * d + gap * (items.length - 1);
      var xx = cx - rowW / 2;
      var cyc = topY + r * rowH + d / 2;
      for (var i = 0; i < items.length; i++) {
        drawMiniAvatar(ctx, items[i], xx + d / 2, cyc, d / 2, withName);
        xx += d + gap;
      }
    }
    return topY + rows * rowH;
  }

  function drawGiantTitle(ctx, spec, m, topAvail, baseline) {
    var cx = spec.w / 2, pad = 48, maxW = spec.w - pad * 2;
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

  function drawTypeMetaBar(ctx, spec, m, metaBaseY) {
    var W = spec.w, pad = 64;
    var dl = m.show ? flyerDate(m.show.next, spec.format, m.nowMs) : '';
    var venue = (m.show && m.show.venue) ? String(m.show.venue).toUpperCase() : '';
    var barH = 80, barY = metaBaseY - barH / 2 - 10;
    ctx.fillStyle = '#E53935'; ctx.fillRect(0, barY, W, barH);
    ctx.fillStyle = '#FFF3E0'; ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.font = '700 40px ' + FONT_BODY;
    if (dl) ctx.fillText(dl, pad, barY + barH / 2 + 1);
    ctx.textAlign = 'right'; ctx.font = '600 36px ' + FONT_BODY;
    if (venue) ctx.fillText(venue, W - pad, barY + barH / 2 + 1);
  }

  function paintTypeStack(ctx, spec, m) {
    var W = spec.w, H = spec.h, top = spec.safeTop, bottom = spec.safeBottom, pad = 64, cx = W / 2;
    ctx.fillStyle = '#0F0F10'; ctx.fillRect(0, 0, W, H);
    var headerBottom = flyerHeader(ctx, spec, m, { taglineColor: '#FFD54F' });
    var bandH = spec.format === 'story' ? 360 : 300;
    var bandY = headerBottom + 10;
    if (m.bg) {
      ctx.save(); roundRect(ctx, pad, bandY, W - pad * 2, bandH, 12); ctx.clip();
      drawCover(ctx, m.bg, pad, bandY, W - pad * 2, bandH);
      var gg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      gg.addColorStop(0, 'rgba(15,15,16,0.1)'); gg.addColorStop(1, 'rgba(15,15,16,0.55)');
      ctx.fillStyle = gg; ctx.fillRect(pad, bandY, W - pad * 2, bandH);
      ctx.restore();
    }
    var avTop = bandY + bandH - 40;
    var avBottom = drawAvatarStrip(ctx, spec, m, pad, avTop, W - pad * 2);
    ctx.fillStyle = '#E53935'; ctx.fillRect(pad, avBottom + 16, W - pad * 2, 8);
    var metaBaseY = H - bottom - 40;
    drawGiantTitle(ctx, spec, m, avBottom + 44, metaBaseY - 90);
    drawTypeMetaBar(ctx, spec, m, metaBaseY);
  }

  // Style registry - keys map to painters; unknown/empty falls back to classic.
  var FLYER_STYLES = {
    classic: paintFlyer,
    ticket: paintTicketStub,
    riso: paintRiso,
    neon: paintNeon,
    type: paintTypeStack
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
          bill: bill, hasGuests: hasGuests, nowMs: Date.now()
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

    // Style toggle - five looks, same lineup. Persists on the host like the format does.
    var styleToggle = el('div', 'lineup-lab__fmt-toggle lineup-lab__style-toggle');
    [['classic', '🎞️ Polaroid'], ['ticket', '🎟️ Ticket'], ['riso', '🖨️ Risograph'], ['neon', '🌃 Neon'], ['type', '🔠 Bold Type']].forEach(function (p) {
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

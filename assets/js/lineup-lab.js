/** Lineup Lab - a URL-state power tool for IN YOUR FACE show organizers.
 *
 *  Everything lives in the query string (no auth, no storage). The state vocabulary is the
 *  SAME one the /comedians/ show-promo links use, so a Lineup Lab URL and a promo URL are the
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
  var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  var byShow = {};
  SHOWS.forEach(function (s) { byShow[norm(s.slug)] = s; });
  function findShow(slug) { return byShow[norm(slug)] || null; }

  var byComedian = {};
  COMEDIANS.forEach(function (c) { byComedian[norm(c.slug)] = c; });
  function findComedian(slug) { return byComedian[norm(slug)] || null; }
  function nameOf(slug) { var c = findComedian(slug); return c ? c.name : slug; }
  function urlOf(slug) { var c = findComedian(slug); return c ? c.url : null; }
  function canonical(slug) { var c = findComedian(slug); return c ? c.slug : null; }
  // resolve a slug list to CANONICAL catalog slugs, dropping anything not in the catalog
  function resolveSlugs(arr) {
    var out = [], seen = {};
    arr.forEach(function (s) { var c = findComedian(s); if (c && !seen[norm(c.slug)]) { seen[norm(c.slug)] = 1; out.push(c.slug); } });
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
    try { window.__lineupLabLastURL = url; } catch (e) { /* read-only env */ }
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
    h.appendChild(el('h1', 'lineup-lab__title', '🎤 Lineup Maker 2000'));
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
    var selected = resolveSlugs(initial);

    var search = el('input', 'lineup-lab__search');
    search.type = 'search';
    search.placeholder = 'Search comedians by name…';
    search.setAttribute('aria-label', 'Search comedians by name');
    root.appendChild(search);

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
        var chip = el('span', 'lineup-lab__chip', nameOf(slug));
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
        results.appendChild(li);
      });
      if (!matches.length) results.appendChild(el('li', 'lineup-lab__empty', 'No comedians match that search.'));
    }
    search.addEventListener('input', renderResults);
    renderTray();
    renderResults();

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
        headliner: resolveSlugs(state.headliner).filter(function (s) { return selected.indexOf(s) >= 0; }),
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
    var dropped = requested.filter(function (s) { return !findComedian(s); }).length;
    if (dropped > 0) {
      root.appendChild(el('p', 'lineup-lab__notice',
        '⚠️ ' + dropped + (dropped === 1 ? ' act in this link is' : ' acts in this link are') +
        ' no longer available and ' + (dropped === 1 ? 'was' : 'were') + ' left off.'));
    }

    // Build the working model from the URL.
    var order = [];
    if (state.type === 'split') {
      resolveSlugs(state.first).forEach(function (s) { order.push(s); });
      order.push(INTERVAL);
      resolveSlugs(state.second).forEach(function (s) { order.push(s); });
    } else {
      resolveSlugs(state.lineup).forEach(function (s) { order.push(s); });
    }
    var work = {
      type: state.type,
      host: canonical(state.host) || '',
      headliner: resolveSlugs(state.headliner),   // 0+ headliners (co-headliners allowed)
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
    }

    function rerender() {
      dynamic.textContent = '';
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

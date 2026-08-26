/** /linkbuilder/ — campaign link builder (see CAMPAIGN_LINKS.md).
 *
 *  Assembles UTM-tagged links that route through /go/ so GA attributes ticket
 *  clicks to a campaign/source. Phone-first: the built link lives in a sticky
 *  bottom bar that updates on every tap, so the flow is tap-tap-copy while
 *  flipping between here and Instagram. Works the same on a laptop.
 *
 *  Conventions enforced here (not merely documented):
 *    - utm values are lowercased + slugified (GA4 never normalizes case);
 *    - utm_medium defaults to GA4's own channel-group tokens per source;
 *    - picking google-ads emits a DIRECT show-page URL with no UTMs at all
 *      (gclid auto-tagging; /go/ would trip the destination-mismatch policy).
 *
 *  Catalogs come from _includes/go-catalogs.liquid — curated site data only.
 */
(function () {
  'use strict';

  // Sources on offer. medium is the GA4 default-channel-group token for the source.
  // google-ads is deliberately NOT offered: Google Ads campaigns use direct show-page
  // URLs with gclid auto-tagging (see CAMPAIGN_LINKS.md). If someone types it into the
  // free-text field anyway, buildLink() still applies the direct-link carve-out.
  var SOURCES = [
    { id: 'meta', label: 'Meta ads', medium: 'paid_social' },
    { id: 'instagram', label: 'Instagram', medium: 'social' },
    { id: 'facebook', label: 'Facebook', medium: 'social' },
    { id: 'tiktok', label: 'TikTok', medium: 'social' },
    { id: 'telegram', label: 'Telegram', medium: 'social' },
    { id: 'reddit', label: 'Reddit', medium: 'social' },
    { id: 'mailchimp', label: 'Mailchimp', medium: 'email' },
    { id: 'guidle', label: 'Guidle', medium: 'referral' },
    { id: 'meetup', label: 'Meetup', medium: 'referral' }
  ];

  // --- test seam (same pattern as comedian-lineup.js) -------------------------
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      SOURCES: SOURCES,
      slugify: slugify,
      mediumFor: mediumFor,
      campaignDefault: campaignDefault,
      buildLink: buildLink,
      primaryTitle: primaryTitle,
      dateLabel: dateLabel
    };
    return;
  }

  function slugify(s) {
    return (s || '').toLowerCase().trim()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function mediumFor(source) {
    var id = slugify(source);
    for (var i = 0; i < SOURCES.length; i++) {
      if (SOURCES[i].id === id) return SOURCES[i].medium;
    }
    return 'social';
  }

  // One campaign per intent: 'comedybrew' promotes the whole series (evergreen,
  // one row in GA forever), 'jackpotcomedy-20260916' promotes a single occurrence.
  // Which one you get follows the "Link to" choice — no extra UI. Editable anyway.
  function campaignDefault(slug, date) {
    return date ? slug + '-' + date.replace(/-/g, '') : slug;
  }

  function primaryTitle(t) {
    return (t || '').split(/\s+[•·]\s+|\s+-\s+/)[0].trim();
  }

  // 'YYYY-MM-DD' → 'Thu 27 Aug' (noon avoids TZ edge flips).
  function dateLabel(iso) {
    var d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    var WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return WD[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()];
  }

  /** Assemble the link. Pure. opts: {date, source, medium, campaign, content}.
   *  google-ads → direct show-page URL, no UTMs (kind 'direct'); everything else
   *  → /go/ with slugified utm params (kind 'event' or 'series'). */
  function buildLink(origin, show, opts) {
    if (slugify(opts.source) === 'google-ads') {
      return { url: origin + show.url, kind: 'direct' };
    }
    var p = new URLSearchParams();
    p.set('show', show.slug);
    if (opts.date) p.set('date', opts.date);
    p.set('utm_source', slugify(opts.source));
    p.set('utm_medium', slugify(opts.medium));
    p.set('utm_campaign', slugify(opts.campaign));
    if (opts.content) p.set('utm_content', slugify(opts.content));
    return { url: origin + '/go/?' + p.toString(), kind: opts.date ? 'event' : 'series' };
  }

  // --- browser flow -----------------------------------------------------------

  function readCatalog(id) {
    var el = document.getElementById(id);
    if (!el) return [];
    try { return JSON.parse(el.textContent) || []; } catch (err) { return []; }
  }

  var root = document.getElementById('link-builder');
  if (!root) return;

  var ORIGIN = 'https://inyourfacecomedy.ch';
  var shows = readCatalog('iyf-go-shows');
  var events = readCatalog('iyf-go-events');

  var todayIso = (function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  })(new Date());

  var state = {
    showSlug: '',
    date: '',            // '' = whole series
    source: '',
    medium: '',
    campaign: '',
    content: '',
    mediumDirty: false,   // stop auto-defaults from clobbering hand edits
    campaignDirty: false
  };

  function currentShow() {
    for (var i = 0; i < shows.length; i++) {
      if (shows[i].slug === state.showSlug) return shows[i];
    }
    return null;
  }

  function upcomingDates(show) {
    var out = [];
    for (var i = 0; i < events.length && out.length < 12; i++) {
      var e = events[i];
      if (e.show === show.slug && e.date >= todayIso) out.push(e.date);
    }
    return out;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // --- skeleton (built once) --------------------------------------------------

  root.insertAdjacentHTML('beforeend',
    '<header class="link-builder__head">' +
      '<h1 class="link-builder__title">Campaign Link Builder</h1>' +
      '<p class="link-builder__sub">Tap a show and a source, copy from the bar below. ' +
      'Links route through /go/ so Analytics sees the campaign.</p>' +
    '</header>' +
    '<section class="link-builder__section" id="lb-shows"><h2 class="link-builder__label">Show</h2><div class="link-builder__grid" id="lb-show-grid"></div></section>' +
    '<section class="link-builder__section" id="lb-target" hidden><h2 class="link-builder__label">Link to</h2><div class="link-builder__chips" id="lb-target-chips"></div></section>' +
    '<section class="link-builder__section" id="lb-sources"><h2 class="link-builder__label">Source</h2><div class="link-builder__chips" id="lb-source-chips"></div>' +
      '<input class="link-builder__input" id="lb-source-free" type="text" inputmode="text" autocapitalize="none" placeholder="or type a source (e.g. whatsapp)">' +
      '<p class="link-builder__note" id="lb-gads-note" hidden>Google Ads links go straight to the show page with no UTM tags: the Ads/GA4 link auto-tags the click (gclid), and a /go/ redirect would trip the destination-mismatch ad policy.</p>' +
    '</section>' +
    '<section class="link-builder__section" id="lb-details"><h2 class="link-builder__label">Details</h2>' +
      '<label class="link-builder__field">utm_medium <input class="link-builder__input" id="lb-medium" type="text" autocapitalize="none"></label>' +
      '<label class="link-builder__field">utm_campaign <input class="link-builder__input" id="lb-campaign" type="text" autocapitalize="none"></label>' +
      '<label class="link-builder__field">utm_content <span class="link-builder__opt">(optional, e.g. ad variant)</span> <input class="link-builder__input" id="lb-content" type="text" autocapitalize="none"></label>' +
    '</section>' +
    '<div class="link-builder__bar" id="lb-bar">' +
      '<div class="link-builder__bar-url" id="lb-url">Pick a show to build your link</div>' +
      '<div class="link-builder__bar-row">' +
        '<span class="link-builder__preview" id="lb-preview"></span>' +
        '<button class="link-builder__copy" id="lb-copy" type="button" disabled>Copy link</button>' +
      '</div>' +
    '</div>');

  var el = {
    showGrid: document.getElementById('lb-show-grid'),
    target: document.getElementById('lb-target'),
    targetChips: document.getElementById('lb-target-chips'),
    sourceChips: document.getElementById('lb-source-chips'),
    sourceFree: document.getElementById('lb-source-free'),
    gadsNote: document.getElementById('lb-gads-note'),
    details: document.getElementById('lb-details'),
    medium: document.getElementById('lb-medium'),
    campaign: document.getElementById('lb-campaign'),
    content: document.getElementById('lb-content'),
    url: document.getElementById('lb-url'),
    preview: document.getElementById('lb-preview'),
    copy: document.getElementById('lb-copy')
  };

  // --- render -----------------------------------------------------------------

  function renderShows() {
    var html = '';
    for (var i = 0; i < shows.length; i++) {
      var s = shows[i];
      var next = s.next ? dateLabel(s.next.slice(0, 10)) : '';
      html += '<button type="button" class="link-builder__card' + (s.slug === state.showSlug ? ' is-on' : '') + '" data-slug="' + esc(s.slug) + '">' +
        '<span class="link-builder__card-name">' + esc(primaryTitle(s.title)) + '</span>' +
        (next ? '<span class="link-builder__card-next">next ' + esc(next) + '</span>' : '') +
        '</button>';
    }
    el.showGrid.innerHTML = html;
  }

  function renderTarget() {
    var show = currentShow();
    var isRecurring = show && (show.type === 'series' || show.type === 'monthly');
    el.target.hidden = !isRecurring;
    if (!isRecurring) { state.date = ''; el.targetChips.innerHTML = ''; return; }
    var html = '<button type="button" class="link-builder__chip' + (state.date === '' ? ' is-on' : '') + '" data-date="">Whole series</button>';
    var dates = upcomingDates(show);
    for (var i = 0; i < dates.length; i++) {
      html += '<button type="button" class="link-builder__chip' + (state.date === dates[i] ? ' is-on' : '') + '" data-date="' + esc(dates[i]) + '">' + esc(dateLabel(dates[i])) + '</button>';
    }
    el.targetChips.innerHTML = html;
  }

  function renderSources() {
    var html = '';
    for (var i = 0; i < SOURCES.length; i++) {
      var s = SOURCES[i];
      html += '<button type="button" class="link-builder__chip' + (state.source === s.id ? ' is-on' : '') + '" data-source="' + esc(s.id) + '">' + esc(s.label) + '</button>';
    }
    el.sourceChips.innerHTML = html;
  }

  function applyDefaults() {
    var show = currentShow();
    if (!state.mediumDirty) {
      state.medium = state.source ? mediumFor(state.source) : '';
      el.medium.value = state.medium;
    }
    if (!state.campaignDirty && show) {
      state.campaign = campaignDefault(show.slug, state.date);
      el.campaign.value = state.campaign;
    }
  }

  function updateBar() {
    var show = currentShow();
    var isGads = slugify(state.source) === 'google-ads';
    el.gadsNote.hidden = !isGads;
    el.details.hidden = isGads;
    if (!show || (!state.source && !isGads)) {
      el.url.textContent = !show ? 'Pick a show to build your link' : 'Pick a source';
      el.preview.textContent = '';
      el.copy.disabled = true;
      return;
    }
    var built = buildLink(ORIGIN, show, {
      date: state.date, source: state.source, medium: state.medium,
      campaign: state.campaign, content: state.content
    });
    el.url.textContent = built.url;
    el.preview.textContent =
      built.kind === 'direct' ? '→ our show page, gclid auto-tagging' :
      built.kind === 'event' ? '→ Eventfrog: ' + primaryTitle(show.title) + ' · ' + dateLabel(state.date) :
      '→ Eventfrog: ' + primaryTitle(show.title) + ' (whole series)';
    el.copy.disabled = false;
  }

  function renderAll() {
    renderShows();
    renderTarget();
    renderSources();
    applyDefaults();
    updateBar();
  }

  // --- events -----------------------------------------------------------------

  el.showGrid.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-slug]');
    if (!btn) return;
    state.showSlug = btn.getAttribute('data-slug');
    state.date = '';
    state.campaignDirty = false;
    renderAll();
  });

  el.targetChips.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-date]');
    if (!btn) return;
    state.date = btn.getAttribute('data-date');
    renderTarget();
    applyDefaults();
    updateBar();
  });

  el.sourceChips.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-source]');
    if (!btn) return;
    state.source = btn.getAttribute('data-source');
    el.sourceFree.value = '';
    state.mediumDirty = false;
    renderSources();
    applyDefaults();
    updateBar();
  });

  el.sourceFree.addEventListener('input', function () {
    state.source = el.sourceFree.value;
    state.mediumDirty = false;
    renderSources();
    applyDefaults();
    updateBar();
  });

  el.medium.addEventListener('input', function () { state.medium = el.medium.value; state.mediumDirty = true; updateBar(); });
  el.campaign.addEventListener('input', function () { state.campaign = el.campaign.value; state.campaignDirty = true; updateBar(); });
  el.content.addEventListener('input', function () { state.content = el.content.value; updateBar(); });

  el.copy.addEventListener('click', function () {
    var text = el.url.textContent;
    function done() {
      el.copy.textContent = 'Copied ✓';
      setTimeout(function () { el.copy.textContent = 'Copy link'; }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else {
      fallbackCopy(text);
      done();
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* nothing left to try */ }
    document.body.removeChild(ta);
  }

  renderAll();
})();

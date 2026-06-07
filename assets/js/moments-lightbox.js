/* moments-lightbox.js — bigger view for comedian frames on /moments/.
 *
 * Progressive enhancement. In the markup each comedian frame is a real
 * <a href="/comedians/<slug>/"> (so crawlers follow the gallery → profile link).
 * Here we intercept the click and, instead of navigating, open a lightbox that
 * shows the photo larger with the comedian's name linking to their profile.
 * With JS off, the link just works and takes you to the profile.
 *
 * Only comedian frames carry [data-lightbox]; audience/moment frames are plain
 * images and are left alone.
 */
(function () {
  'use strict';

  var gallery = document.querySelector('.iyf-moments');
  var box = document.querySelector('.iyf-lightbox');
  if (!gallery || !box) return;

  var imgEl = box.querySelector('.iyf-lightbox__img');
  var nameEl = box.querySelector('.iyf-lightbox__name');
  var closeBtn = box.querySelector('.iyf-lightbox__close');
  var lastFocus = null;

  function open(link) {
    var innerImg = link.querySelector('img');
    imgEl.src = link.getAttribute('data-full') || (innerImg && innerImg.src) || '';
    imgEl.alt = innerImg ? innerImg.alt : (link.getAttribute('data-name') || '');
    nameEl.textContent = link.getAttribute('data-name') || 'Visit profile';
    nameEl.setAttribute('href', link.getAttribute('data-profile') || link.getAttribute('href') || '#');

    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('iyf-lightbox-open');
    closeBtn.focus();
  }

  function close() {
    if (box.hidden) return;
    box.hidden = true;
    document.documentElement.classList.remove('iyf-lightbox-open');
    imgEl.removeAttribute('src');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  // Open: delegate clicks on any comedian frame's link.
  gallery.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-lightbox]');
    if (!link) return;
    e.preventDefault(); // open the bigger view instead of navigating away
    open(link);
  });

  // Close: the × button, or a click on the dark backdrop (not the figure/name).
  closeBtn.addEventListener('click', close);
  box.addEventListener('click', function (e) {
    if (e.target === box) close();
  });

  // Close on Escape; let the name link work normally (it navigates to the profile).
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') close();
  });
})();

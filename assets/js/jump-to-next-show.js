/** Jump-to-next-show — finds the next upcoming row and wires the hero button. */
(function () {
  'use strict';

  const HEADING_SELECTOR = '.iyf-month-heading';
  const CALENDAR_SELECTOR = '.iyf-calendar';
  const BUTTON_ID = 'jump-to-next-show';
  const FLASH_CLASS = 'is-jump-flash';
  const FLASH_MS = 1400;

  const HEADING_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i;
  const ROW_DATE_RE = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})$/i;
  const MONTH_INDEX = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Parse a "Mon D" or "Month D" cell into a local-midnight Date using the given year; null on miss.
  const parseRowDate = (cellText, year) => {
    const match = ROW_DATE_RE.exec(cellText);
    if (!match) return null;
    const monthIndex = MONTH_INDEX[match[1].toLowerCase()];
    const day = parseInt(match[2], 10);
    if (monthIndex === undefined || !Number.isFinite(day)) return null;
    return new Date(year, monthIndex, day, 0, 0, 0, 0);
  };

  const parseHeadingYear = (headingText) => {
    const match = HEADING_RE.exec(headingText);
    if (!match) return null;
    const year = parseInt(match[2], 10);
    return Number.isFinite(year) ? year : null;
  };

  const collectCalendarsAfter = (heading) => {
    const calendars = [];
    let node = heading.nextElementSibling;
    while (node && !node.matches(HEADING_SELECTOR)) {
      if (node.matches(CALENDAR_SELECTOR)) {
        calendars.push(node);
      } else {
        calendars.push(...node.querySelectorAll(CALENDAR_SELECTOR));
      }
      node = node.nextElementSibling;
    }
    return calendars;
  };

  const findNextShowRow = (todayMidnight) => {
    const headings = document.querySelectorAll(HEADING_SELECTOR);
    for (const heading of headings) {
      const year = parseHeadingYear(heading.textContent || '');
      if (year === null) continue;
      const calendars = collectCalendarsAfter(heading);
      for (const calendar of calendars) {
        const rows = calendar.querySelectorAll('tbody tr');
        for (const row of rows) {
          const firstCell = row.cells && row.cells[0];
          if (!firstCell) continue;
          const rowDate = parseRowDate(firstCell.textContent.trim(), year);
          if (!rowDate) continue;
          if (rowDate.getTime() >= todayMidnight.getTime()) {
            return row;
          }
        }
      }
    }
    return null;
  };

  const wireButton = (button, row) => {
    let flashTimeoutId = null;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      row.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      if (reducedMotion) return;
      if (flashTimeoutId !== null) {
        clearTimeout(flashTimeoutId);
        row.classList.remove(FLASH_CLASS);
      }
      row.classList.add(FLASH_CLASS);
      flashTimeoutId = setTimeout(() => {
        row.classList.remove(FLASH_CLASS);
        flashTimeoutId = null;
      }, FLASH_MS);
    });
  };

  const init = () => {
    if (!document.querySelector(HEADING_SELECTOR)) return;
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);

    const row = findNextShowRow(todayMidnight);
    if (!row) {
      button.hidden = true;
      return;
    }
    row.setAttribute('data-next-show', 'true');
    wireButton(button, row);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

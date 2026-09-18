#!/usr/bin/env bun
// Monthly "what's on" email to the whole audience, from _data/calendar.yml.
//
//   bun script/email-monthly.ts                 # next five weeks from today
//   bun script/email-monthly.ts --month 2026-10 # one calendar month
//   bun script/email-monthly.ts --weeks 6 --dry-run
//   bun script/email-monthly.ts --copy script/email-out/<file>.copy.json --update 8350100
//
// One card per show with its real dates (never hand-typed), a bolded show count
// linking to /calendar/, one optional audience photo as the hero, words from
// Claude via script/email-prompts/monthly.md. Playbook: docs/emails.md.

import { USAGE_FOOTER, fail, flagBool, flagString, loadEnv, log, parseArgs, stamp, todayISO, warn } from "./lib/email/cli";
import { CALENDAR_URL, eyebrowFor, hostedName, hostedWide, logoUrl, mailchimpFor, requireFreshCalendar, resolveCopy, showsTable, signoffFor } from "./lib/email/common";
import { publish } from "./lib/email/campaign";
import { heroWithText } from "./lib/email/images";
import { renderHtml, renderText, type Block, type EmailDoc } from "./lib/email/render";
import {
  SITE_URL, addDays, datesLine, findShow, fmtDate, groupByShow, loadCalendar, loadGallery, loadShows, loadVenues, monthLabel,
  type CalendarEvent, type Show,
} from "./lib/email/site";
import type { MonthlyCopy } from "./lib/email/copy";

const USAGE = `Usage: bun script/email-monthly.ts [options]

  --month YYYY-MM    one calendar month (default: the next --weeks from today)
  --weeks N          window length from today (default 5)
  --from YYYY-MM-DD  window start (default today)
  --no-hero          no audience photo at the top
  --hero-title "…"   text baked onto the photo (default "<Month> Comedy")
  --no-hero-text     the photo without any text
  --model <name>     claude model for the copy (default sonnet, or EMAIL_CLAUDE_MODEL)

Shows in another language are listed only when they happen at ROBIN's (set
\`language: it\` / \`es\` on the show's post; English is the default).
${USAGE_FOOTER}`;

export function windowFor(args: { month?: string; weeks?: string; from?: string }, today: string): { from: string; to: string; label: string; month: boolean } {
  if (args.month) {
    if (!/^\d{4}-\d{2}$/.test(args.month)) throw new Error("--month must be YYYY-MM");
    const from = `${args.month}-01`;
    const [y, m] = args.month.split("-").map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);   // last day of the month
    return { from: from < today ? today : from, to, label: monthLabel(args.month), month: true };
  }
  const weeks = Number(args.weeks || 5);
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > 12) throw new Error("--weeks must be 1 to 12");
  const from = args.from || today;
  const to = addDays(from, weeks * 7 - 1);
  return { from, to, label: monthLabel(from.slice(0, 7)), month: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); process.exit(0); }
  loadEnv();
  const dryRun = flagBool(args, "dry-run");
  const today = todayISO();
  const win = windowFor({ month: flagString(args, "month"), weeks: flagString(args, "weeks"), from: flagString(args, "from") }, today);

  const cal = loadCalendar("calendar.yml");
  requireFreshCalendar(cal.generatedAt, args);
  const shows = loadShows();
  const venues = loadVenues();
  const allGroups = groupByShow(cal.events, win.from, win.to);
  // The list goes to the English-speaking audience: a show in another language
  // is in only when it happens at ROBIN's (our own room, our own crowd).
  const skipped = allGroups.filter((g) => !keepForMonthly(findShow(shows, g.show), g.events[0].venue));
  const groups = allGroups.filter((g) => !skipped.includes(g));
  if (!groups.length) fail(`no shows between ${win.from} and ${win.to} in calendar.yml`);
  const showCount = groups.reduce((n, g) => n + g.events.length, 0);
  log(`${win.label}: ${showCount} shows, ${groups.length} series between ${fmtDate(win.from)} and ${fmtDate(win.to)}`);

  const rows = groups.map((g) => {
    const show = findShow(shows, g.show);
    const venue = venues[g.events[0].venue]?.name || g.events[0].venueName || g.events[0].location;
    return { slug: g.show, name: show?.name || g.events[0].name, venue, events: g.events, show };
  });
  for (const r of rows) log(`  ${r.name.padEnd(28)} ${datesLine(r.events)}  @ ${r.venue}`);
  for (const g of skipped) log(`  (skipped ${findShow(shows, g.show)?.name || g.show}: not in English and not at ROBIN's)`);

  const mc = mailchimpFor(args);
  const baseName = `${stamp()}-monthly-${win.from.slice(0, 7)}`;
  const vars: Record<string, string> = {
    month_label: win.label, show_count: String(showCount), window_from: fmtDate(win.from, { year: true }), window_to: fmtDate(win.to, { year: true }),
    shows_table: showsTable(rows), show_slugs: rows.map((r) => r.slug).join(","),
  };
  const { copy } = resolveCopy("monthly", args, vars, baseName, `monthly:${win.from}..${win.to}`) as { copy: MonthlyCopy; path: string };
  const blurbs = new Map(copy.shows.map((s) => [s.slug, s]));
  for (const r of rows) if (!blurbs.has(r.slug)) warn(`copy has no blurb for ${r.slug}; the card will use the tagline`);

  const blocks: Block[] = [];
  if (!flagBool(args, "no-hero")) {
    const hero = pickHero(loadGallery());
    if (hero) {
      // The title is baked into the photo (email cannot layer text on images).
      const text = heroTitleFor(win, flagString(args, "hero-title"));
      const src = flagBool(args, "no-hero-text") ? hero.path : heroWithText(hero.path, 1200, text);
      const h = await hostedWide(mc, src, 1200, hostedName("iyf-email-hero-1200", src, "jpg"));
      blocks.push({ kind: "hero", src: h.url, alt: `${text.title}: ${hero.alt || "the crowd at an IN YOUR FACE Comedy show in Zürich"}`, href: CALENDAR_URL, width: h.width, height: h.height });
    } else warn("no featured audience photo in _data/gallery.yml; no hero");
  }
  copy.opener.forEach((text, i) => blocks.push({ kind: i === 0 ? "lead" : "paragraph", text }));
  blocks.push({ kind: "paragraph", text: `**[${showCount} shows between now and ${fmtDate(win.to, { weekday: false, month: "long" })}](${CALENDAR_URL})**. ${copy.lead}` });
  for (const r of rows) {
    const b = blurbs.get(r.slug);
    blocks.push({
      kind: "showCard", emoji: b?.emoji || "🎤", name: r.name, href: r.show?.url || r.events[0].url, date: r.events[0].date,
      eyebrow: eyebrowFor(r.events, r.show, r.venue), datesLine: datesLine(r.events), blurb: b?.blurb || r.show?.tagline || undefined,
    });
  }
  blocks.push({ kind: "button", label: "Full calendar", href: CALENDAR_URL });
  blocks.push({ kind: "paragraph", text: copy.closing });
  blocks.push({ kind: "signoff", lines: signoffFor("en", "See you out there 🎤") });

  const doc: EmailDoc = {
    subject: copy.subject, preheader: copy.preheader, lang: "en", greeting: null,
    logoUrl: await logoUrl(mc), siteUrl: SITE_URL, calendarUrl: CALENDAR_URL, blocks,
  };
  const html = renderHtml(doc);
  if (/eventfrog/i.test(html)) fail("monthly email must link the site, never Eventfrog");

  await publish({
    mc, baseName, title: `${win.label} Calendar`, subject: copy.subject, preheader: copy.preheader, html, text: renderText(doc),
    update: flagString(args, "update"), dryRun, noOpen: flagBool(args, "no-open"), yes: flagBool(args, "yes"),
  });
}

// English shows always; another language only at ROBIN's.
export function keepForMonthly(show: Show | undefined, venueSlug: string): boolean {
  const lang = show?.language || "en";
  return lang === "en" || venueSlug === "robins";
}

// "October Comedy" over "Shows this month"; a rolling window says so instead.
export function heroTitleFor(win: { from: string; label: string; month?: boolean }, override?: string): { title: string; kicker: string } {
  const month = win.label.split(" ")[0];
  return { title: override || `${month} Comedy`, kicker: win.month ? "Shows this month" : "What's on next" };
}

// Best-looking featured audience photo, newest first on ties. Never a performer
// close-up: the mood is the room, not one face.
export function pickHero(gallery: Array<{ src: string; path: string; type: string; featured: boolean; aesthetic: number; date: string; alt: string }>) {
  return [...gallery].filter((g) => g.type === "audience" && g.featured).sort((a, b) => b.aesthetic - a.aesthetic || b.date.localeCompare(a.date))[0];
}

export type { CalendarEvent, Show };
if (import.meta.main) main().catch((e) => fail((e as Error).message));

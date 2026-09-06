#!/usr/bin/env bun
// Post-show thank-you email from a Lineup Maker thank-you link.
//
//   bun script/email-thankyou.ts "https://inyourfacecomedy.ch/comedians/?show=comedybrew&host=…&first=…&second=…&thankyou"
//   bun script/email-thankyou.ts <link> --dry-run          # render + open locally, no Mailchimp
//   bun script/email-thankyou.ts <link> --segment "<tag>"  # pick the audience segment by name
//   bun script/email-thankyou.ts <link> --copy script/email-out/<file>.copy.json --update 8350024
//
// Flow: parse the link, resolve every comedian against _comedians/, find the
// newest Mailchimp tag for this show (asks before using it), write the copy
// with Claude, render faces + calendar + next date, create the draft, read it
// back, open it. Run it after the ticket import has created the show's tag.
// Playbook: EMAILS.md.

import { existsSync } from "node:fs";
import { USAGE_FOOTER, confirm, fail, flagBool, flagString, loadEnv, log, parseArgs, stamp, todayISO, warn } from "./lib/email/cli";
import { CALENDAR_URL, greetingFor, hostedName, hostedSquare, logoUrl, mailchimpFor, requireFreshCalendar, resolveCopy, signoffFor, slotFor } from "./lib/email/common";
import { publish } from "./lib/email/campaign";
import { parseEventTag, type Segment } from "./lib/email/mailchimp";
import { renderHtml, renderText, type Block, type EmailDoc, type Face } from "./lib/email/render";
import {
  SITE_URL, datesFor, findComedian, findShow, fmtDate, loadCalendar, loadComedians, loadShows, loadVenues, norm, parseDate, timeOf, weekdayOf,
  type Comedian, type Show,
} from "./lib/email/site";
import type { ThankyouCopy } from "./lib/email/copy";

const USAGE = `Usage: bun script/email-thankyou.ts <thank-you link> [options]

  <thank-you link>   the /comedians/?show=…&thankyou link from Lineup Maker 2000
  --segment <name>   Mailchimp tag/segment to send to (default: newest tag matching the show, asked)
  --date YYYY-MM-DD  show date (default: from the tag name, else the last past date of the show)
  --model <name>     claude model for the copy (default sonnet, or EMAIL_CLAUDE_MODEL)
${USAGE_FOOTER}`;

interface Lineup { show: string; host: string[]; first: string[]; second: string[]; headliner: string[]; lineup: string[]; thankyou: boolean }

export function parseThankyouLink(link: string): Lineup {
  const u = new URL(link, SITE_URL);
  const list = (k: string) => (u.searchParams.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ty = u.searchParams.get("thankyou");
  return {
    show: (u.searchParams.get("show") || "").trim(),
    host: list("host"), first: list("first"), second: list("second"), headliner: list("headliner"), lineup: list("lineup"),
    thankyou: u.searchParams.has("thankyou") && !/^(0|false|no|off)$/i.test(ty || ""),
  };
}

export const isGuest = (t: string) => /^guest:/i.test(t);
export const guestName = (t: string) => t.replace(/^guest:/i, "").trim();

interface Person { name: string; comedian?: Comedian; guest: boolean }

// Unknown slugs are collected in `misses`; the caller refuses to build an email
// that silently drops a performer from their own credit.
export function resolvePeople(tokens: string[], comedians: Comedian[], seen: Set<string>, misses: string[] = []): Person[] {
  const out: Person[] = [];
  for (const t of tokens) {
    const key = isGuest(t) ? "guest:" + norm(guestName(t)) : norm(t);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isGuest(t)) { out.push({ name: guestName(t), guest: true }); continue; }
    const c = findComedian(comedians, t);
    if (!c) { misses.push(t); continue; }
    out.push({ name: c.name, comedian: c, guest: false });
  }
  return out;
}

// A thank-you goes out the morning after; a "newest matching tag" older than
// this means the ticket import for the show has not run yet.
export const MAX_TAG_AGE_DAYS = 7;

// "last night" for a show one day ago, else the weekday, else the date.
export function whenPhrase(showDate: string, today: string): string {
  const a = parseDate(showDate)?.getTime() ?? 0;
  const b = parseDate(today)?.getTime() ?? 0;
  const days = Math.round((b - a) / 86_400_000);
  if (days <= 0) return "tonight";
  if (days === 1) return "last night";
  if (days < 7) return `on ${weekdayOf(showDate)}`;
  return `on ${fmtDate(showDate)}`;
}

export function tagMatchesShow(tagName: string, show: Show, eventfrogNames: string[]): boolean {
  const n = norm(tagName);
  if (n.includes(norm(show.name))) return true;
  return eventfrogNames.some((e) => e && n.startsWith(norm(e)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help") || !args.positional[0]) { console.log(USAGE); process.exit(flagBool(args, "help") ? 0 : 1); }
  loadEnv();
  const dryRun = flagBool(args, "dry-run");
  const today = todayISO();

  const lineup = parseThankyouLink(args.positional[0]);
  if (!lineup.show) fail("the link has no show= parameter");
  if (!lineup.thankyou) warn("link has no &thankyou; proceeding anyway");

  const shows = loadShows();
  const show = findShow(shows, lineup.show);
  if (!show) fail(`unknown show "${lineup.show}" (no _posts entry with that permalink)`);
  const venues = loadVenues();
  const venueName = venues[show.venueSlug]?.name || show.venueName || "the venue";
  const comedians = loadComedians();
  const cal = loadCalendar("calendar.yml");
  requireFreshCalendar(cal.generatedAt, args);
  const upcoming = cal.events;
  const past = loadCalendar("calendar_past.yml").events;

  // People, in running order, each placed once (first mention wins, like the site).
  const seen = new Set<string>();
  const misses: string[] = [];
  const groups: Array<{ label?: string; people: Person[] }> = [];
  const host = resolvePeople(lineup.host, comedians, seen, misses);
  if (host.length) groups.push({ label: host.length > 1 ? "Hosts" : "Host", people: host });
  const headliner = resolvePeople(lineup.headliner, comedians, seen, misses);
  if (headliner.length) groups.push({ label: "Headliner", people: headliner });
  const first = resolvePeople(lineup.first, comedians, seen, misses);
  const second = resolvePeople(lineup.second, comedians, seen, misses);
  const flat = resolvePeople(lineup.lineup, comedians, seen, misses);
  if (first.length || second.length) {
    if (first.length) groups.push({ label: "First half", people: first });
    if (second.length) groups.push({ label: "Second half", people: second });
  } else if (flat.length) groups.push({ label: "Line-up", people: flat });
  if (misses.length) fail(`not in _comedians/: ${misses.join(", ")}. Fix the slug in the link, or write them as guest:Their Name`);
  const people = groups.flatMap((g) => g.people);
  if (!people.length) fail("no performers resolved from the link");
  log(`${show.name}: ${people.length} performers (${people.filter((p) => p.guest).length} guests)`);

  // Segment: newest tag that belongs to this show, confirmed by you.
  const mc = mailchimpFor(args);
  let segment: Segment | undefined;
  let showDate = flagString(args, "date") || "";
  const eventfrogNames = [...past, ...upcoming].filter((e) => norm(e.show) === norm(show.slug)).map((e) => e.eventfrogName);
  if (mc) {
    const wanted = flagString(args, "segment");
    if (wanted) {
      segment = await mc.findSegment(wanted);
      if (!segment) fail(`segment "${wanted}" not found`);
      if (segment.member_count === 0) warn(`segment "${segment.name}" has 0 members`);
    } else {
      const recent = await mc.listSegments("static", 15);
      const matches = recent.filter((s) => tagMatchesShow(s.name, show, eventfrogNames));
      log("\nNewest tags in Mailchimp:");
      for (const s of recent.slice(0, 6)) log(`  ${matches.includes(s) ? "*" : " "} ${s.created_at.slice(0, 10)}  ${String(s.member_count).padStart(3)}  ${s.name}`);
      segment = matches[0];
      if (!segment) fail(`no recent tag matches ${show.name}. Import the tickets first, or pass --segment "<name>"`);
      if (segment.member_count === 0) fail(`newest matching tag "${segment.name}" has 0 members; import the tickets first or pass --segment`);
      const tagDate = parseEventTag(segment.name)?.date;
      const ageDays = tagDate ? Math.round((Date.parse(today) - Date.parse(tagDate)) / 86_400_000) : 0;
      if (ageDays > MAX_TAG_AGE_DAYS) fail(`newest matching tag is for ${fmtDate(tagDate!)}, ${ageDays} days ago. Import this show's tickets first, or pass --segment "<name>" to send to that older date anyway`);
      const ok = await confirm(`Send to "${segment.name}" (${segment.member_count} people)?`, { yes: flagBool(args, "yes") });
      if (!ok) fail("stopped: pick a tag with --segment \"<name>\"");
    }
    const parsed = parseEventTag(segment.name);
    if (parsed && !showDate) showDate = parsed.date;
  }
  if (!showDate) {
    const lastPast = past.filter((e) => norm(e.show) === norm(show.slug)).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!lastPast) fail(`cannot tell the show date (no tag date, nothing in calendar_past.yml); pass --date YYYY-MM-DD`);
    showDate = lastPast.date;
  }
  const when = whenPhrase(showDate, today);
  const next = datesFor(upcoming, show.slug, today).find((e) => e.date > showDate);
  const slot = slotFor(show, venueName);

  // Copy.
  const baseName = `${stamp()}-thankyou-${show.slug}`;
  const performers = people.map((p) => p.name).join(", ");
  const vars: Record<string, string> = {
    show_name: show.name, when, show_date: fmtDate(showDate, { year: true }), weekday: weekdayOf(showDate), venue: venueName,
    slot: slot || "none (one-off show)", next_date: next ? `${fmtDate(next.date)} ${timeOf(next.start)} at ${next.venueName}` : "none scheduled",
    host: host.map((p) => p.name).join(", ") || "none", performers, guests: people.filter((p) => p.guest).map((p) => p.name).join(", ") || "none",
    attendees: segment ? String(segment.member_count) : "unknown",
  };
  const { copy } = resolveCopy("thankyou", args, vars, baseName, `thankyou:${show.slug}`) as { copy: ThankyouCopy; path: string };

  // Images: faces and logo hosted on Mailchimp (or local files in a dry run).
  // A face that cannot be produced stops the run: an email of initials discs
  // is not the email that was asked for.
  log(`  images ${people.filter((p) => p.comedian?.photoPath).length} faces`);
  const faceGroups: Array<{ label?: string; people: Face[] }> = [];
  for (const g of groups) {
    const faces: Face[] = [];
    for (const p of g.people) {
      const c = p.comedian;
      let img = "";
      if (c?.photoPath) {
        if (!existsSync(c.photoPath)) fail(`${c.slug}: photo missing at ${c.photoPath}`);
        img = await hostedSquare(mc, c.photoPath, 216, hostedName(`iyf-face-${c.slug}-216`, c.photoPath, "jpg"));
      } else warn(`${p.name} has no photo in _comedians/; shown as initials`);
      faces.push({ name: p.name, handle: c?.handle ?? "", href: c ? (c.instagram || c.url) : "", img, label: p.guest ? "guest" : undefined });
    }
    faceGroups.push({ label: g.label, people: faces });
  }

  // Document.
  const blocks: Block[] = copy.paragraphs.map((text) => ({ kind: "paragraph", text }));
  if (copy.ps) blocks.push({ kind: "paragraph", text: `*P.S. ${copy.ps}*` });
  if (next) {
    blocks.push({ kind: "heading", text: slot ? `${show.name} is on ${slot.replace(/,.*$/, "")}` : `Next ${show.name}` });
    blocks.push({
      kind: "showCard", name: show.name, href: show.url, date: next.date,
      eyebrow: `${weekdayOf(next.date).slice(0, 3)} · ${timeOf(next.start)} · ${next.venueName}`,
      datesLine: `Next one: ${fmtDate(next.date)}`, blurb: show.tagline || undefined, linkLabel: "Tickets & info",
    });
  }
  blocks.push({ kind: "button", label: "See all our shows", href: CALENDAR_URL });
  blocks.push({ kind: "heading", text: `Who you saw ${when}` });
  blocks.push({ kind: "note", text: "Tap a face to follow them on Instagram. They love a follow." });
  blocks.push({ kind: "faces", groups: faceGroups });
  blocks.push({ kind: "signoff", lines: signoffFor("en", "See you at the next one,") });

  const doc: EmailDoc = {
    subject: copy.subject, preheader: copy.preheader, lang: "en", greeting: greetingFor("en"),
    logoUrl: await logoUrl(mc), siteUrl: SITE_URL, calendarUrl: CALENDAR_URL, blocks,
  };

  await publish({
    mc, baseName, title: `Thanks: ${show.name} ${fmtDate(showDate, { weekday: false, year: true })}`,
    subject: copy.subject, preheader: copy.preheader, html: renderHtml(doc), text: renderText(doc),
    segmentId: segment?.id, expectedCount: segment?.member_count, update: flagString(args, "update"), dryRun, noOpen: flagBool(args, "no-open"), yes: flagBool(args, "yes"),
  });
}

if (import.meta.main) main().catch((e) => fail((e as Error).message));

#!/usr/bin/env bun
// Targeted promo email: one or more shows to a chosen group.
//
//   bun script/email-promo.ts --show promessi-spassi --csv ~/Desktop/italians.csv --lang it --brief "Italian speakers in Zürich"
//   bun script/email-promo.ts --show latarima --segment "City - Zurich" --lang es --brief "..."
//   bun script/email-promo.ts --show filippo-spreafico,promessi-spassi --all --brief "everyone: two Italian nights"
//   ... --dry-run / --copy <file> --update <web id>
//
// --csv takes any file with email addresses in it (one per line or a column);
// the addresses that are subscribed members become a static segment named
// promo-<show>-<date>. Keep such CSVs outside the repo (people's data).
// Playbook: EMAILS.md.

import { existsSync, readFileSync } from "node:fs";
import { USAGE_FOOTER, confirm, fail, flagBool, flagString, loadEnv, log, parseArgs, stamp, todayISO, warn } from "./lib/email/cli";
import { CALENDAR_URL, eyebrowFor, greetingFor, hostedName, hostedWide, localPathForSiteUrl, logoUrl, mailchimpFor, requireFreshCalendar, resolveCopy, showsTable, signoffFor, type Lang } from "./lib/email/common";
import { publish } from "./lib/email/campaign";
import type { Mailchimp, Segment } from "./lib/email/mailchimp";
import { renderHtml, renderText, type Block, type EmailDoc } from "./lib/email/render";
import { SITE_URL, addDays, datesFor, datesLine, findShow, loadCalendar, loadShows, loadVenues } from "./lib/email/site";
import type { PromoCopy } from "./lib/email/copy";

const USAGE = `Usage: bun script/email-promo.ts --show <slug[,slug]> (--csv <file> | --segment <name> | --all) [options]

  --show <slugs>     show page slugs, comma separated (e.g. promessi-spassi)
  --csv <file>       file with email addresses; subscribed ones become a new static segment
  --tag <name>       with --csv: name that segment (a tag); an existing tag gets the people added
  --segment <name>   existing Mailchimp tag / segment name
  --all              the whole audience
  --brief "<text>"   who the readers are and why these shows are for them (goes to Claude)
  --lang en|it|es|de language of the whole email (default en)
  --no-flyers        no flyer on each show card (the first show's flyer becomes a hero instead)
  --no-hero          with --no-flyers: no hero either

The copy file may carry per-show blurbs: "shows": [{"slug": "...", "blurb": "..."}], any language each.
  --model <name>     claude model for the copy (default sonnet, or EMAIL_CLAUDE_MODEL)
${USAGE_FOOTER}`;

export function emailsFrom(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) out.add(m[0].toLowerCase());
  return [...out];
}

export function segmentNameFor(slugs: string[], date: string): string {
  return `promo-${slugs.join("+")}-${date}`;
}

// --tag names the segment (a tag in the Mailchimp UI) the CSV becomes; an
// existing tag of that name gets the new members added. Without --tag the
// segment is named promo-<show>-<date>.
async function segmentFromCsv(mc: Mailchimp, file: string, slugs: string[], today: string, yes: boolean, tag?: string): Promise<Segment> {
  if (!existsSync(file)) fail(`csv not found: ${file}`);
  const emails = emailsFrom(readFileSync(file, "utf8"));
  if (!emails.length) fail(`no email addresses found in ${file}`);
  log(`  csv    ${emails.length} addresses in ${file}`);
  const subscribed: string[] = [];
  const missing: string[] = [];
  const other: string[] = [];
  for (let i = 0; i < emails.length; i += 5) {
    await Promise.all(emails.slice(i, i + 5).map(async (e) => {
      const s = await mc.memberStatus(e);
      if (s === "subscribed") subscribed.push(e);
      else if (s === null) missing.push(e);
      else other.push(`${e} (${s})`);
    }));
  }
  if (missing.length) warn(`${missing.length} not in the audience (skipped): ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", ..." : ""}`);
  if (other.length) warn(`${other.length} not subscribed (skipped): ${other.slice(0, 5).join(", ")}${other.length > 5 ? ", ..." : ""}`);
  if (!subscribed.length) fail("none of the addresses is a subscribed member; nothing to send to");
  if (tag) {
    const existing = await mc.findSegment(tag);
    if (existing && existing.type !== "static") fail(`"${tag}" is a ${existing.type} segment, not a tag`);
    const ok = await confirm(existing
      ? `Add ${subscribed.length} subscribed people to the existing tag "${tag}" (${existing.member_count} now)?`
      : `Create the tag "${tag}" with ${subscribed.length} subscribed people?`, { yes });
    if (!ok) fail("stopped");
    const seg = existing ? await mc.addToStaticSegment(existing.id, subscribed) : await mc.createStaticSegment(tag, subscribed);
    log(`  tag    "${seg.name}" now has ${seg.member_count} members`);
    return seg;
  }
  let name = segmentNameFor(slugs, today);
  if (await mc.findSegment(name)) name += `-${stamp().slice(-4)}`;
  const ok = await confirm(`Create segment "${name}" with ${subscribed.length} subscribed people?`, { yes });
  if (!ok) fail("stopped");
  const seg = await mc.createStaticSegment(name, subscribed);
  log(`  segment "${seg.name}" created with ${seg.member_count} members`);
  return seg;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); process.exit(0); }
  loadEnv();
  const dryRun = flagBool(args, "dry-run");
  const yes = flagBool(args, "yes");
  const today = todayISO();
  const lang = (flagString(args, "lang") || "en") as Lang;
  if (!["en", "it", "es", "de"].includes(lang)) fail("--lang must be en, it, es or de");
  const slugs = (flagString(args, "show") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!slugs.length) { console.log(USAGE); fail("--show is required"); }
  const modes = ["csv", "segment", "all"].filter((k) => args.flags[k] !== undefined);
  if (modes.length !== 1 && !dryRun) fail("pick exactly one of --csv, --segment, --all");

  const shows = loadShows();
  const venues = loadVenues();
  const calendar = loadCalendar("calendar.yml");
  requireFreshCalendar(calendar.generatedAt, args);
  const cal = calendar.events;
  const rows = slugs.map((slug) => {
    const show = findShow(shows, slug);
    if (!show) fail(`unknown show "${slug}"`);
    const events = datesFor(cal, show.slug, today).filter((e) => e.date <= addDays(today, 90));
    if (!events.length && !flagBool(args, "allow-undated")) fail(`${show.name} has no upcoming date in calendar.yml within 90 days; pass --allow-undated to promote it without a date card`);
    if (!events.length) warn(`${show.name} has no upcoming date; no date card`);
    const venue = venues[show.venueSlug]?.name || events[0]?.venueName || show.venueName;
    return { slug: show.slug, name: show.name, venue, events, show, extra: show.priceChf ? `CHF ${show.priceChf}` : "free" };
  });
  for (const r of rows) log(`${r.name}: ${datesLine(r.events) || "no dates"} @ ${r.venue}`);

  const mc = mailchimpFor(args);
  let segment: Segment | undefined;
  let audience = "whole audience";
  if (mc) {
    if (flagString(args, "csv")) segment = await segmentFromCsv(mc, flagString(args, "csv")!, slugs, today, yes, flagString(args, "tag"));
    else if (flagString(args, "segment")) {
      segment = await mc.findSegment(flagString(args, "segment")!);
      if (!segment) fail(`segment "${flagString(args, "segment")}" not found`);
      if (!(await confirm(`Send to "${segment.name}" (${segment.member_count} people)?`, { yes }))) fail("stopped");
    } else {
      const n = await mc.audienceCount();
      if (!(await confirm(`Send to the whole audience (${n} people)?`, { yes, defaultYes: false }))) fail("stopped");
    }
    audience = segment ? `${segment.name} (${segment.member_count})` : audience;
  }

  const baseName = `${stamp()}-promo-${slugs.join("+")}`;
  const vars: Record<string, string> = {
    lang, brief: flagString(args, "brief") || "subscribers who might like these shows", shows_table: showsTable(rows), show_name: rows.map((r) => r.name).join(" & "),
  };
  const { copy } = resolveCopy("promo", args, vars, baseName, `promo:${slugs.join("+")}`) as { copy: PromoCopy; path: string };

  // Each card carries its show's flyer (--no-flyers: one hero of the first
  // show instead). Per-show blurbs from the copy file beat the tagline.
  const blocks: Block[] = [];
  const flyers = !flagBool(args, "no-flyers");
  const flyerFor = async (r: (typeof rows)[number]) => {
    const src = localPathForSiteUrl(r.show.featureImg) || localPathForSiteUrl(r.show.thumbnail);
    if (!src) { warn(`${r.name} has no local flyer image`); return undefined; }
    const h = await hostedWide(mc, src, 1072, hostedName(`iyf-email-show-${r.slug}-1072`, src, "jpg"));
    return { src: h.url, alt: r.show.title, width: h.width, height: h.height };
  };
  if (!flyers && !flagBool(args, "no-hero")) {
    const f = await flyerFor(rows[0]);
    if (f) blocks.push({ kind: "hero", src: f.src, alt: f.alt, href: rows[0].show.url, width: f.width, height: f.height });
  }
  copy.paragraphs.forEach((text, i) => blocks.push({ kind: i === 0 ? "lead" : "paragraph", text }));
  const blurbs = new Map((copy.shows ?? []).map((s) => [s.slug, s.blurb]));
  for (const r of rows) {
    if (!r.events.length) continue;
    blocks.push({
      kind: "showCard", name: r.name, href: r.show.url, date: r.events[0].date, eyebrow: eyebrowFor(r.events, r.show, r.venue),
      datesLine: datesLine(r.events), blurb: blurbs.get(r.slug) || r.show.tagline || undefined, linkLabel: copy.cta,
      img: flyers ? await flyerFor(r) : undefined,
    });
  }
  blocks.push({ kind: "button", label: copy.cta, href: rows.length === 1 ? rows[0].show.url : CALENDAR_URL });
  blocks.push({ kind: "signoff", lines: signoffFor(lang) });

  const doc: EmailDoc = {
    subject: copy.subject, preheader: copy.preheader, lang, greeting: greetingFor(lang),
    logoUrl: await logoUrl(mc), siteUrl: SITE_URL, calendarUrl: CALENDAR_URL, blocks,
  };
  log(`  to     ${audience}`);
  await publish({
    mc, baseName, title: `Promo: ${rows.map((r) => r.name).join(" & ")} (${lang}) ${today}`, subject: copy.subject, preheader: copy.preheader,
    html: renderHtml(doc), text: renderText(doc), segmentId: segment?.id, expectedCount: segment?.member_count, update: flagString(args, "update"), dryRun, noOpen: flagBool(args, "no-open"), yes,
  });
}

if (import.meta.main) main().catch((e) => fail((e as Error).message));

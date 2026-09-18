#!/usr/bin/env bun
// Mirrors the website calendar into the Apple calendar shared with the ROBIN's bar staff.
//
//   bun script/robins-calendar.ts [--dry-run] [--no-sales] [--days 120] [--force] [--calendar "Test Calendar"]
//   bun script/robins-calendar.ts --first-load [--keep-dates 2026-12-31] --dry-run
//
// The calendar is ROBINS_CALENDAR in .env: its exact title in Calendar.app. There is no password or id to
// keep: access is the Calendars permission of this Mac's user, and iCloud carries the events onward.
//
// Source of truth: _data/calendar.yml (venue robins only). Target: a local Calendar.app calendar, written
// through script/lib/ekcal.swift (EventKit); iCloud carries it to the staff. One event per show date:
//
//   title     🎤 Comedy Brew [Back]         microphone, show name, room tag (the room is in the title only)
//   notes     Hosted by: ...                from the post's hosts: and hosts_label:
//             Tickets: 12                   only in the last SALES_DAYS days, only for events our Eventfrog
//                                           organiser key can see; every other show gets no Tickets line
//   url       https://inyourfacecomedy.ch/comedybrew/#2026-09-24  the show page; the fragment is our key
//
// HUMANS WIN. script/robins-out/state.json remembers what this script last wrote per field. A field that no
// longer holds that value was edited by a person and is never written again; in edited notes only the line
// that starts "Tickets:" is kept fresh. An event a person deleted is not recreated. An event a person made
// for the same slot (no key in its url) is left alone and no twin is created. A show that leaves the
// website is reported, never deleted. --force is the way back: every field of our keyed events counts as
// ours again and is reset to the website's version (hand-made events stay untouched).
//
// --first-load is for a calendar people filled by hand, once: every repeating series is ended from its next
// occurrence on (history stays), a hand-made one-off in the slot of a website show is replaced by ours, and
// "front" in its title or notes carries over as [Front] (recorded as a human edit, so it sticks). Hand-made
// events that match no website show stay untouched. --keep-dates keeps a plain copy of a series occurrence.
//
// Room: front matter `room: front|back` on the post wins; otherwise Front in July and August, Back the rest
// of the year.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, eventfrogFromEnv, loadEnv, type Eventfrog } from "./lib/eventfrog-api";

const SITE = "https://inyourfacecomedy.ch";
const TZ = "Europe/Zurich";
const VENUE = "robins";
const OUT = join(REPO_ROOT, "script", "robins-out");
const STATE = join(OUT, "state.json");
const EKCAL_SRC = join(REPO_ROOT, "script", "lib", "ekcal.swift");
const EKCAL_BIN = join(OUT, "ekcal");
const SALES_DAYS = 3;
const SLOT_MINUTES = 120;                 // a keyless event starting this close to a show is the same show, made by a person
const FRONT_MONTHS = new Set([7, 8]);
const ROOMS = { front: { tag: "Front" }, back: { tag: "Back" } } as const;   // front: the small room (30); back: the bar room (120)
type RoomKey = keyof typeof ROOMS;
const FIELDS = ["title", "start", "end", "notes", "location"] as const;
type Field = (typeof FIELDS)[number];

interface SiteEvent { show: string; name: string; url: string; start: string; end: string; status?: string }
interface CalEvent { id: string; title: string; start: string; end: string; notes: string; location: string; url: string; all_day: boolean; recurring?: boolean }
type Written = Record<Field, string>;
interface StateRow { id: string; written: Written; deleted_by_human?: boolean }
type State = Record<string, Record<string, StateRow>>;   // calendar title, then key

// ---------- pure parts (tested) ----------

export function zurichParts(iso: string | Date): { date: string; month: number; stamp: string } {
  const d = new Date(iso);
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  const mon = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, month: "short" }).format(d);
  return { date: `${p.year}-${p.month}-${p.day}`, month: Number(p.month), stamp: `${p.weekday} ${Number(p.day)} ${mon} ${p.hour}:${p.minute}` };
}

export function roomFor(startIso: string, override?: string): RoomKey {
  const o = String(override || "").toLowerCase();
  if (o === "front" || o === "back") return o;
  return FRONT_MONTHS.has(zurichParts(startIso).month) ? "front" : "back";
}

export function keyOf(e: Pick<SiteEvent, "url" | "start">): string { return `${SITE}${e.url}#${zurichParts(e.start).date}`; }

export function titleFor(name: string, room: RoomKey): string { return `🎤 ${name} [${ROOMS[room].tag}]`; }

// null = no line: outside the window, or an event our organiser key cannot see.
export function ticketsLine(sold: number | null): string | null { return sold === null ? null : `Tickets: ${sold}`; }

export function notesFor(hostsLabel: string, hosts: string[], tickets: string | null): string {
  const lines: string[] = [];
  if (hosts.length) lines.push(`${hostsLabel}: ${hosts.join(", ")}`);
  if (tickets) lines.push(tickets);
  return lines.join("\n");
}

// Notes a person has edited: only our Tickets line moves, everything else stays as they left it.
export function withTicketsLine(notes: string, tickets: string | null): string {
  if (!tickets) return notes;
  const lines = notes.split("\n");
  const i = lines.findIndex((l) => l.trimStart().startsWith("Tickets:"));
  if (i >= 0) lines[i] = tickets; else lines.push(tickets);
  return lines.join("\n").replace(/^\n+/, "");
}

const same = (field: Field, a: string, b: string) => (field === "start" || field === "end" ? Date.parse(a) === Date.parse(b) : a.trim() === b.trim());

// What to write into an event that exists, given what we wrote last time. A field whose value is no longer
// ours is left alone for good.
export function planUpdate(current: CalEvent, written: Written | undefined, desired: Written, tickets: string | null): { set: Partial<Written>; human: Field[] } {
  const set: Partial<Written> = {}, human: Field[] = [];
  for (const f of FIELDS) {
    const ours = written ? same(f, current[f], written[f]) : same(f, current[f], desired[f]);
    if (!ours) {
      human.push(f);
      if (f === "notes") { const next = withTicketsLine(current.notes, tickets); if (!same(f, next, current.notes)) set.notes = next; }
      continue;
    }
    if (!same(f, current[f], desired[f])) set[f] = desired[f];
  }
  return { set, human };
}

// ---------- the website side ----------

function frontMatter(path: string): any {
  const m = readFileSync(path, "utf8").match(/^---\n([\s\S]*?)\n---/);
  try { return m ? Bun.YAML.parse(m[1]) || {} : {}; } catch { return {}; }
}

function postsByPermalink(): Map<string, any> {
  const dir = join(REPO_ROOT, "_posts"), out = new Map<string, any>();
  for (const f of readdirSync(dir)) if (f.endsWith(".md")) { const fm = frontMatter(join(dir, f)); if (fm.permalink) out.set(String(fm.permalink), fm); }
  return out;
}

function comedianName(slug: string): string {
  const p = join(REPO_ROOT, "_comedians", `${slug}.md`);
  return existsSync(p) ? String(frontMatter(p).title || slug) : slug;
}

function venueAddress(): string {
  const v = (Bun.YAML.parse(readFileSync(join(REPO_ROOT, "_data", "venues.yml"), "utf8")) as any)?.[VENUE] || {};
  return `${v.name}, ${v.street}, ${v.postal_code} ${v.city}`;
}

// ---------- Eventfrog (read-only client, last SALES_DAYS days only) ----------

// Tickets sold for the event that starts at this instant, or null when the organiser key cannot see it.
async function soldFor(ef: Eventfrog, organiserEvents: any[], startIso: string): Promise<number | null> {
  const mine = organiserEvents.find((e) => e.beginDate && Math.abs(Date.parse(e.beginDate) - Date.parse(startIso)) < 60_000);
  if (!mine) return null;
  const tx = await ef.getAll<any>(`/organizer/v1/events/${mine.id}/tickettransactions`);
  return tx.data.reduce((s: number, o: any) => s + ((o.tickets || []) as any[]).filter((t) => !t.cancelled).length, 0);
}

// ---------- the calendar side ----------

function ekcal(args: string[], stdin?: string): any {
  if (!existsSync(EKCAL_BIN) || statSync(EKCAL_BIN).mtimeMs < statSync(EKCAL_SRC).mtimeMs) {
    const c = Bun.spawnSync(["swiftc", "-O", EKCAL_SRC, "-o", EKCAL_BIN]);
    if (c.exitCode !== 0) throw new Error(`swiftc failed: ${c.stderr.toString()}`);
  }
  const r = Bun.spawnSync([EKCAL_BIN, ...args], stdin === undefined ? {} : { stdin: Buffer.from(stdin) });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString().trim() || `ekcal ${args[0]} failed`);
  return JSON.parse(r.stdout.toString());
}

// ---------- main ----------

async function main() {
  const argv = process.argv.slice(2);
  const flag = (n: string) => argv.includes(n);
  const value = (n: string, d: string) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
  loadEnv();
  // The calendar is named once, in .env; --calendar is for a one-off run against another one (the test calendar).
  const calendar = value("--calendar", process.env.ROBINS_CALENDAR || "");
  if (!calendar) throw new Error("no calendar: set ROBINS_CALENDAR in .env (the calendar's exact title in Calendar.app) or pass --calendar");
  const dryRun = flag("--dry-run"), force = flag("--force"), firstLoad = flag("--first-load"), keepDates = new Set(value("--keep-dates", "").split(",").filter(Boolean)), days = Number(value("--days", "120"));
  mkdirSync(OUT, { recursive: true });

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86_400_000);
  const site = ((Bun.YAML.parse(readFileSync(join(REPO_ROOT, "_data", "calendar.yml"), "utf8")) as any)?.events || []) as any[];
  const shows: SiteEvent[] = site.filter((e) => e.venue === VENUE && e.status !== "EventCancelled" && Date.parse(e.end || e.start) > now.getTime() && Date.parse(e.start) < horizon.getTime());
  const posts = postsByPermalink(), location = venueAddress();

  const soon = shows.filter((e) => Date.parse(e.start) - now.getTime() < SALES_DAYS * 86_400_000);
  let ef: Eventfrog | null = null, organiserEvents: any[] = [];
  if (soon.length && !flag("--no-sales")) {
    try { ef = eventfrogFromEnv(); organiserEvents = (await ef.getAll<any>("/organizer/v1/events", {})).data; }
    catch (e: any) { ef = null; console.log(`sales unavailable: ${e.message}`); }
  }

  const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
  const rows = (state[calendar] ||= {});
  const from = new Date(now.getTime() - 86_400_000).toISOString().replace(/\.\d+Z$/, "Z"), to = horizon.toISOString().replace(/\.\d+Z$/, "Z");
  let existing: CalEvent[] = ekcal(["list", calendar, from, to]);

  const ops: any[] = [], report: string[] = [], desiredByKey = new Map<string, Written>();
  const keyed = (c: CalEvent) => c.url.startsWith(`${SITE}/`) && c.url.includes("#");
  const inSlot = (c: CalEvent, e: SiteEvent) => Math.abs(Date.parse(c.start) - Date.parse(e.start)) <= SLOT_MINUTES * 60_000;
  const frontKeys = new Set<string>(), defaultTitles = new Map<string, string>();
  if (firstLoad) {
    if (Object.keys(rows).length) throw new Error(`--first-load is for a calendar this script has never written to; state has ${Object.keys(rows).length} events for "${calendar}"`);
    const gone = new Set<CalEvent>();
    const series = new Map<string, CalEvent[]>();
    for (const c of existing) if (c.recurring) series.set(c.id, [...(series.get(c.id) || []), c]);
    for (const [id, occ] of series) {
      const upcoming = occ.filter((c) => Date.parse(c.start) > now.getTime());
      if (!upcoming.length) continue;
      ops.push({ op: "remove", key: `series:${id}`, id, start: upcoming[0].start, confirm_title: upcoming[0].title, span: "future" });
      report.push(`  END SERIES "${upcoming[0].title}" from ${zurichParts(upcoming[0].start).date} on (${upcoming.length} occurrences inside this window, all later ones too; earlier ones stay)`);
      for (const c of upcoming) {
        gone.add(c);
        if (keepDates.has(zurichParts(c.start).date)) { ops.push({ op: "create", key: `keep:${c.start}`, title: c.title, start: c.start, end: c.end, notes: c.notes, location: c.location, url: c.url }); report.push(`  keep    ${zurichParts(c.start).date} "${c.title}" as a plain one-off copy (--keep-dates)`); }
      }
    }
    for (const c of existing) {
      if (c.recurring || keyed(c) || Date.parse(c.start) <= now.getTime()) continue;
      const show = shows.find((e) => inSlot(c, e));
      if (!show) { report.push(`  untouched ${zurichParts(c.start).date} "${c.title}": matches no website show`); continue; }
      const front = /front/i.test(`${c.title} ${c.notes}`);
      if (front) frontKeys.add(keyOf(show));
      ops.push({ op: "remove", key: `oneoff:${c.id}`, id: c.id, start: c.start, confirm_title: c.title, span: "this" });
      report.push(`  REPLACE ${zurichParts(c.start).date} "${c.title}" ${zurichParts(c.start).stamp.slice(-5)} with the website's ${show.name} ${zurichParts(show.start).stamp.slice(-5)}${front ? " [Front carried over]" : ""}${c.notes ? ` (drops notes: ${c.notes.replace(/\n/g, " / ")})` : ""}`);
      gone.add(c);
    }
    existing = existing.filter((c) => !gone.has(c));
  }
  for (const e of shows) {
    const key = keyOf(e), post = posts.get(e.url) || {}, room = frontKeys.has(key) ? "front" : roomFor(e.start, post.room);
    // A room carried over from a hand-made event is recorded as a human edit of the title, so it sticks.
    if (frontKeys.has(key)) defaultTitles.set(key, titleFor(e.name, roomFor(e.start, post.room)));
    let tickets: string | null = null;
    if (ef && soon.includes(e)) { try { tickets = ticketsLine(await soldFor(ef, organiserEvents, e.start)); } catch (err: any) { report.push(`  sales failed for ${key}: ${err.message}`); } }
    const hosts = ((post.hosts || []) as string[]).map(comedianName);
    const row = rows[key];
    const mine = existing.find((c) => c.url === key) || (row && existing.find((c) => c.id === row.id && Math.abs(Date.parse(c.start) - Date.parse(e.start)) < 86_400_000));
    // No fresh count this run (outside the window, --no-sales, Eventfrog down): keep the line that is there.
    if (!tickets && mine) tickets = mine.notes.split("\n").map((l) => l.trim()).find((l) => /^Tickets: \d+$/.test(l)) || null;
    const desired: Written = { title: titleFor(e.name, room), start: e.start, end: e.end, notes: notesFor(String(post.hosts_label || "Hosted by"), hosts, tickets), location };
    desiredByKey.set(key, desired);

    if (mine) {
      // --force: every field of a keyed event counts as ours again, so it goes back to the website's version.
      const { set, human } = planUpdate(mine, force ? (mine as Written) : row?.written, desired, tickets);
      const label = `${zurichParts(e.start).date} ${desired.title}`;
      if (Object.keys(set).length) { ops.push({ op: "update", key, id: mine.id, ...set }); report.push(`  update  ${label}: ${Object.keys(set).join(", ")}${human.length ? ` (human-edited, left alone: ${human.join(", ")})` : ""}`); }
      else report.push(`  ok      ${label}${human.length ? ` (human-edited, left alone: ${human.join(", ")})` : ""}`);
      continue;
    }
    if (row) { row.deleted_by_human = true; report.push(`  skipped ${zurichParts(e.start).date} ${e.name}: a person deleted it from the calendar, not recreated`); continue; }
    const twin = existing.find((c) => !keyed(c) && inSlot(c, e));
    if (twin) { report.push(`  skipped ${zurichParts(e.start).date} ${e.name}: a hand-made event "${twin.title}" holds that slot, left alone`); continue; }
    ops.push({ op: "create", key, url: key, ...desired });
    report.push(`  create  ${zurichParts(e.start).date} ${desired.title}`);
  }
  for (const [key, row] of Object.entries(rows)) if (!desiredByKey.has(key) && Date.parse(row.written.start) > now.getTime()) report.push(`  GONE FROM WEBSITE, still in the calendar (remove by hand if cancelled): ${row.written.title} ${zurichParts(row.written.start).date}`);

  console.log(`${calendar}: ${shows.length} ROBIN's shows on the website in the next ${days} days, ${existing.length} events in the calendar, ${ops.length} to write${dryRun ? " (dry run)" : ""}`);
  console.log(report.join("\n"));
  if (dryRun || !ops.length) { if (!dryRun) writeFileSync(STATE, JSON.stringify(state, null, 2)); return; }

  const results: any[] = ekcal(["apply", calendar], JSON.stringify(ops));
  for (const r of results) {
    if (!r.ok) { console.log(`  FAILED ${r.op} ${r.key}: ${r.error}`); continue; }
    const desired = desiredByKey.get(r.key), op = ops.find((o) => o.key === r.key)!;
    if (!desired) continue;                     // first-load removals and kept copies are not ours to track
    const before = rows[r.key]?.written;
    // Record only the fields this run wrote; the rest keep their old record so a human edit stays visible.
    const written = { ...(before || desired) } as Written;
    for (const f of FIELDS) if (op[f] !== undefined && (op.op === "create" || before === undefined || f !== "notes" || same(f, op[f], desired[f]))) written[f] = op[f];
    if (defaultTitles.has(r.key)) written.title = defaultTitles.get(r.key)!;
    rows[r.key] = { id: r.id, written };
  }
  writeFileSync(STATE, JSON.stringify(state, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`wrote ${results.length - failed} events${failed ? `, ${failed} FAILED` : ""}`);
  if (failed) process.exit(1);
}

if (import.meta.main) main().catch((e) => { console.error(String(e?.message || e)); process.exit(1); });

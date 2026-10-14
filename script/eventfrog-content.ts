// Keeps the Comedy Brew pages on Eventfrog in the state we want: the series page (the group)
// and every upcoming date get a title, a short description and a description built here from
// one template, a hook line picked per date from `_data/eventfrog-copy.json`, and the show's
// history read from the organiser account (first night, nights so far). Runs daily; writes
// only what differs from what Eventfrog holds, reads every write back, and never touches
// anything but the three copy fields (`lib/eventfrog-write.ts` cannot).
//
//   bun script/eventfrog-content.ts                       # dry run: what would change, per page
//   bun script/eventfrog-content.ts --apply               # write the differences (cap 20 per run), read back
//   bun script/eventfrog-content.ts --apply --only 2026-10-22   # one date only (the hand test)
//   bun script/eventfrog-content.ts --group-only | --events-only
//   bun script/eventfrog-content.ts --verbose             # print the full wanted copy
//
// Why the title keeps a fixed prefix: the Eventfrog page <title> is our title plus
// "in Zürich | Comedy & Cabaret", Google weighs the front of it, the thank-you email finds
// the Mailchimp tag by the words "Comedy Brew", and the calendar crawl stores the name daily.
// Only the hook after the separator changes, and it changes once per date.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Eventfrog, EventfrogAuthError, REPO_ROOT, eventfrogFromEnv, healthcheckPing } from "./lib/eventfrog-api";
import { EventfrogWriter, SHORT_MAX, TITLE_MAX, eventfrogWriterFromEnv, type Copy } from "./lib/eventfrog-write";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";

export const SITE = "https://inyourfacecomedy.ch";
export const HEALTHCHECKS_ENV = "EVENTFROG_CONTENT_HEALTHCHECKS_URL";

export interface ShowConfig {
  slug: string;              // the site's show slug; the group id comes from its post's ticket_url
  prefix: string;            // the fixed front of every event title
  groupTitle: string;        // the series page title (Eventfrog appends "in Zürich")
  contact: string;           // the communications address, never the Eventfrog account one
  capacity: number;
}

// Eventfrog enforces 60 characters on a title (the spec says 255; the API said 60 on
// 2026-10-14), and it appends " in Zürich" on the page. So: a short fixed prefix, a colon,
// a hook of at most HOOK_MAX characters. "Open mic" lives in the short description and
// the description; "stand-up" and "Comedy Brew" stay in every title.
export const COMEDY_BREW: ShowConfig = {
  slug: "comedybrew",
  prefix: "Comedy Brew, English Stand-Up",
  groupTitle: "Comedy Brew: English Stand-Up Open Mic, every Thursday",
  contact: "harry@inyourfacecomedy.ch",
  capacity: 60,
};

export interface EventLite {
  id: string;
  beginDate: string;
  endDate?: string;
  cancelled?: boolean;
  visibility?: { published?: boolean };
  localizedInfo?: { locale: string; title?: string; shortDescription?: string; description?: string | null }[];
}

// ---------- pure: data ----------

/** The Eventfrog group id from the show's post: the digits at the end of its ticket_url. */
export function groupIdFromPost(slug: string, postsDir = join(REPO_ROOT, "_posts")): string {
  for (const f of readdirSync(postsDir)) {
    if (!f.endsWith(".md")) continue;
    const s = readFileSync(join(postsDir, f), "utf8");
    if (!new RegExp(`^permalink:\\s*/${slug}/\\s*$`, "m").test(s)) continue;
    const m = s.match(/^ticket_url:\s*"?([^"\n]+)"?\s*$/m);
    const id = m && m[1].match(/groups\/.*?-(\d{15,})\.html/);
    if (!id) throw new Error(`${f}: ticket_url is not an Eventfrog group link`);
    return id[1];
  }
  throw new Error(`no post with permalink /${slug}/`);
}

export function loadHooks(path = join(REPO_ROOT, "_data", "eventfrog-copy.json")): string[] {
  const j = JSON.parse(readFileSync(path, "utf8")) as { hooks?: unknown };
  const hooks = Array.isArray(j.hooks) ? j.hooks.filter((h): h is string => typeof h === "string" && h.trim().length > 0) : [];
  if (!hooks.length) throw new Error(`${path}: no hooks`);
  for (const h of hooks) {
    if (/—/.test(h)) throw new Error(`hook has an em dash: ${h}`);
    if (h.length > HOOK_MAX) throw new Error(`hook over ${HOOK_MAX} characters (Eventfrog caps the title at ${TITLE_MAX}): ${h}`);
    if (/[.!]$/.test(h)) throw new Error(`hook ends with punctuation (the template adds it): ${h}`);
  }
  return hooks;
}

/** The hook for a date: the pool walked one line per week, counted from the first night
 *  (27 February 2022), so a date always gets the same line, consecutive Thursdays never
 *  repeat within a pool length, and nothing depends on which other dates exist. Editing the
 *  pool shifts future dates, which the next run rewrites once. Pure. */
export const FIRST_NIGHT = "2022-02-27";
export function pickHook(date: string, hooks: string[]): string {
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(FIRST_NIGHT + "T00:00:00Z")) / 86_400_000);
  const week = Math.floor(days / 7);
  return hooks[((week % hooks.length) + hooks.length) % hooks.length];
}

/** Every title the open mic has carried on Eventfrog since 2022; Tall Order and the others
 *  also say "open mic", so the match is on the show's own names. */
export function matchesBrew(title: string | undefined): boolean {
  const t = (title || "").trim();
  return /comedy brew/i.test(t) || /^IN YOUR FACE Stand-Up Comedy Open Mic$/i.test(t);
}

export function roundDown10(n: number): number { return Math.floor(n / 10) * 10; }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Nights so far and the first night's month, from the organiser's full event list. Pure. */
export function history(events: EventLite[], nowIso: string): { nights: number; since: string } {
  const brew = events.filter((e) => !e.cancelled && matchesBrew(e.localizedInfo?.[0]?.title) && typeof e.beginDate === "string");
  const dates = brew.map((e) => e.beginDate).sort();
  const past = dates.filter((d) => d < nowIso);
  const first = dates[0] ? new Date(dates[0]) : null;
  const since = first ? `${MONTHS[Number(first.toISOString().slice(5, 7)) - 1]} ${first.toISOString().slice(0, 4)}` : "";
  return { nights: past.length, since };
}

// ---------- pure: Google reviews (from _data/reviews.yml, written by reviews-from-google.rb) ----------

export interface Review { author: string; excerpt: string; truncated?: boolean }
export interface Reviews { average: number; total: number; google_url: string; reviews: Review[] }

export function loadReviews(path = join(REPO_ROOT, "_data", "reviews.yml")): Reviews {
  const r = Bun.YAML.parse(readFileSync(path, "utf8")) as Reviews;
  const reviews = (r.reviews || []).filter((x) => x && typeof x.excerpt === "string" && x.excerpt.trim().length >= 30 && typeof x.author === "string");
  if (!reviews.length) throw new Error(`${path}: no usable reviews`);
  if (!/^https:\/\/(search\.google\.com|maps\.google\.com|www\.google\.com)\//.test(r.google_url || "")) throw new Error(`${path}: google_url is not a Google link`);
  return { average: Number(r.average) || 0, total: Number(r.total) || reviews.length, google_url: r.google_url, reviews };
}

/** A review excerpt as a quote: whitespace collapsed, an em dash becomes a comma, the
 *  "IN YOUR FACE COMEDY:" prefix one reviewer typed is dropped, a cut excerpt ends in "...". */
export function cleanQuote(r: Review): string {
  let q = r.excerpt.replace(/\s+/g, " ").replace(/\s*—\s*/g, ", ").trim();
  q = q.replace(/^IN YOUR FACE COMEDY:\s*/i, "");
  if (r.truncated && !/[.!?…]$/.test(q)) q += "...";
  return q;
}

/** The review for a date: the same weekly walk as the hooks, offset so the two pools do not
 *  move in step. Pure. */
export function pickReview(date: string, reviews: Review[]): Review {
  const days = Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(FIRST_NIGHT + "T00:00:00Z")) / 86_400_000);
  const week = Math.floor(days / 7) + 3;
  return reviews[((week % reviews.length) + reviews.length) % reviews.length];
}

function reviewLine(r: Review, data: Reviews): string {
  const rating = data.average ? `${data.average} stars from ${data.total} Google reviews` : `${data.total} Google reviews`;
  return `<p>"${esc(cleanQuote(r))}" <em>${esc(r.author)}, on Google.</em> <a href="${data.google_url}">${rating}</a>.</p>`;
}

export function utmLink(path: string, content: string, slug = COMEDY_BREW.slug): string {
  const p = new URLSearchParams({ utm_source: "eventfrog", utm_medium: "referral", utm_campaign: slug, utm_content: content });
  return `${SITE}${path}?${p.toString()}`;
}

/** "Thursday 15 October" in Zürich time. */
export function fmtDay(beginDate: string): string {
  const d = new Date(beginDate);
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", weekday: "long", day: "numeric", month: "long" });
  return f.format(d).replace(",", "");
}

/** The calendar date (YYYY-MM-DD) of a show in Zürich time. */
export function zurichDate(beginDate: string): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Zurich", year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(new Date(beginDate));
}

// ---------- pure: copy ----------

// A colon, not a pipe: Eventfrog's title field strips "|" (seen 2026-10-14 on the first write).
export const TITLE_SEPARATOR = ": ";
export const HOOK_MAX = TITLE_MAX - COMEDY_BREW.prefix.length - TITLE_SEPARATOR.length;   // 29

export function eventTitle(hook: string, show = COMEDY_BREW): string {
  const t = `${show.prefix}${TITLE_SEPARATOR}${hook}`;
  if (t.length > TITLE_MAX) throw new Error(`title over ${TITLE_MAX}: ${t}`);
  return t;
}

export function eventCopy(ev: { beginDate: string }, hook: string, reviews: Reviews, show = COMEDY_BREW): Copy {
  const date = zurichDate(ev.beginDate);
  const calendar = utmLink("/calendar/", `event-${date}`, show.slug);
  const faq = utmLink("/faq/", `event-${date}`, show.slug);
  const page = utmLink(`/${show.slug}/`, `event-${date}`, show.slug);
  const shortDescription = `${hook}. About ten comedians, all in English, every Thursday at ROBIN's near Central. Doors 19:30, done by 22:00.`;
  if (shortDescription.length > SHORT_MAX) throw new Error("shortDescription too long");
  const description = [
    `<p><strong>${esc(hook)}.</strong> Comedy Brew is Zürich's weekly English stand-up open mic: about ten comedians a night, pros trying new jokes next to someone's first five minutes.</p>`,
    `<p><strong>${fmtDay(ev.beginDate)}.</strong> Doors 19:30, first comedian 19:50, done by 22:00 with a break in the middle. ROBIN's, Zähringerstrasse 33, two minutes from Central and five from the main station.</p>`,
    `<p><strong>Grab your ticket above.</strong> ${show.capacity} seats, first come first served, and the busy weeks sell out. Door sales hold up the start, so book now and walk straight in.</p>`,
    reviewLine(pickReview(date, reviews.reviews), reviews),
    `<p>Can't make this one? <a href="${calendar}">Every IN YOUR FACE show, every week</a>.</p>`,
    `<p>In English. 16 and over recommended. Comedians sometimes film their sets. Food, seating, how to perform and the rest: <a href="${faq}">the FAQ</a>. The night in full, with photos and the hosts: <a href="${page}">the Comedy Brew page</a>. Questions: ${show.contact}.</p>`,
  ].join("\n");
  return { title: eventTitle(hook, show), shortDescription, description };
}

export function seriesCopy(h: { nights: number; since: string }, reviews: Reviews, show = COMEDY_BREW): Copy {
  const calendar = utmLink("/calendar/", "series", show.slug);
  const faq = utmLink("/faq/", "series", show.slug);
  const page = utmLink(`/${show.slug}/`, "series", show.slug);
  const count = roundDown10(h.nights);
  const since = h.since ? `Running since ${h.since}: more than ${count} Thursdays of new jokes, first-timers and the odd glorious mess.` : `More than ${count} Thursdays of new jokes, first-timers and the odd glorious mess.`;
  // The two newest reviews (the file is newest first); a new review on Google moves the pair on.
  const quotes = reviews.reviews.slice(0, 2).map((r) => reviewLine(r, reviews));
  const description = [
    `<p><strong>Zürich's weekly English stand-up open mic, every Thursday at ROBIN's.</strong> ${since}</p>`,
    `<p>About ten comedians a night, pros trying new material next to someone's first five minutes. Doors 19:30, first comedian 19:50, done by 22:00 with a break in the middle. ROBIN's, Zähringerstrasse 33, two minutes from Central and five from the main station.</p>`,
    `<p><strong>Pick a Thursday below for tickets.</strong> ${show.capacity} seats, first come first served. Busy weeks sell out, and door sales slow the start.</p>`,
    ...quotes,
    `<p>In English. 16 and over recommended. Comedians sometimes film their sets. Food, seating, how to perform and the rest: <a href="${faq}">the FAQ</a>. The night in full, with photos and the hosts: <a href="${page}">the Comedy Brew page</a>. Every other IN YOUR FACE show: <a href="${calendar}">the calendar</a>. Questions: ${show.contact}.</p>`,
  ].join("\n");
  return { title: show.groupTitle, description };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- pure: comparison ----------

/** What a page says, independent of how Eventfrog's editor re-encodes it: entities decoded,
 *  tags dropped except that every href is kept in order, whitespace collapsed. */
export function essence(html: string | null | undefined): string {
  const s = html || "";
  const hrefs = [...s.matchAll(/href="([^"]*)"/g)].map((m) => decode(m[1]));
  const text = decode(s.replace(/<[^>]+>/g, " "));
  return [text.replace(/\s+/g, " ").trim(), ...hrefs].join(" | ");
}

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, " ").replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

export type Field = keyof Copy;

/** The fields whose wanted essence differs from what the page holds. Pure. */
export function changedFields(current: Copy, wanted: Copy): Field[] {
  const out: Field[] = [];
  for (const k of Object.keys(wanted) as Field[]) {
    if (essence(current[k]) !== essence(wanted[k])) out.push(k);
  }
  return out;
}

export function currentCopy(li: EventLite["localizedInfo"]): { locale: string; copy: Copy } {
  const first = li?.[0];
  if (!first?.locale) throw new Error("object has no localized info");
  return { locale: first.locale, copy: { title: first.title, shortDescription: first.shortDescription, description: first.description ?? "" } };
}

// ---------- the run ----------

export interface PageJob { kind: "group" | "event"; path: string; label: string; date?: string; locale: string; current: Copy; wanted: Copy; changed: Field[] }

export function planJobs(group: { id: string; localizedInfo: EventLite["localizedInfo"] }, events: EventLite[], hist: { nights: number; since: string }, hooks: string[], reviews: Reviews, nowIso: string, show = COMEDY_BREW): PageJob[] {
  const jobs: PageJob[] = [];
  const g = currentCopy(group.localizedInfo);
  const gw = seriesCopy(hist, reviews, show);
  jobs.push({ kind: "group", path: `/organizer/v1/eventgroups/${group.id}`, label: "series page", locale: g.locale, current: g.copy, wanted: gw, changed: changedFields(g.copy, gw) });
  const upcoming = events
    .filter((e) => !e.cancelled && e.visibility?.published !== false && (e.endDate || e.beginDate) >= nowIso)
    .sort((a, b) => a.beginDate.localeCompare(b.beginDate));
  for (const e of upcoming) {
    const c = currentCopy(e.localizedInfo);
    const date = zurichDate(e.beginDate);
    const w = eventCopy(e, pickHook(date, hooks), reviews, show);
    jobs.push({ kind: "event", path: `/organizer/v1/events/${e.id}`, label: date, date, locale: c.locale, current: c.copy, wanted: w, changed: changedFields(c.copy, w) });
  }
  return jobs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(readFileSync(import.meta.path, "utf8").split("\n").slice(0, 14).join("\n")); return; }
  const apply = flagBool(args, "apply");
  const verbose = flagBool(args, "verbose");
  const only = flagString(args, "only");
  const groupOnly = flagBool(args, "group-only");
  const eventsOnly = flagBool(args, "events-only");
  if (only && !/^\d{4}-\d{2}-\d{2}$/.test(only)) fail("--only wants YYYY-MM-DD");
  const show = COMEDY_BREW;

  const ef: Eventfrog = eventfrogFromEnv();
  const nowIso = new Date().toISOString();
  const groupId = groupIdFromPost(show.slug);
  const hooks = loadHooks();
  const reviews = loadReviews();

  let group: { id: string; localizedInfo: EventLite["localizedInfo"] };
  let inGroup: EventLite[];
  let all: EventLite[];
  try {
    group = await ef.get(`/organizer/v1/eventgroups/${groupId}`);
    inGroup = (await ef.getAll<EventLite>("/organizer/v1/events", { groupId })).data;
    all = (await ef.getAll<EventLite>("/organizer/v1/events", {})).data;
  } catch (e) {
    if (e instanceof EventfrogAuthError) { await healthcheckPing(HEALTHCHECKS_ENV, "fail", "key rejected"); fail("Eventfrog key rejected"); }
    throw e;
  }
  const hist = history(all, nowIso);
  log(`${show.slug}: group ${groupId}, ${inGroup.length} events in the group, history ${hist.nights} nights since ${hist.since || "?"}`);

  let jobs = planJobs(group, inGroup, hist, hooks, reviews, nowIso, show);
  if (groupOnly) jobs = jobs.filter((j) => j.kind === "group");
  if (eventsOnly) jobs = jobs.filter((j) => j.kind === "event");
  if (only) jobs = jobs.filter((j) => j.kind === "event" && j.date === only);
  if (!jobs.length) fail("nothing matched the filters");

  for (const j of jobs) {
    const mark = j.changed.length ? `CHANGE ${j.changed.join(",")}` : "in sync";
    log(`  ${j.kind === "group" ? "series" : j.date}  ${mark}`);
    if (j.changed.includes("title")) log(`      title: ${j.current.title}\n          -> ${j.wanted.title}`);
    if (verbose) log(`      wanted: ${JSON.stringify(j.wanted, null, 2).replace(/\n/g, "\n      ")}`);
  }
  const todo = jobs.filter((j) => j.changed.length);
  if (!todo.length) { log("nothing to do"); await healthcheckPing(HEALTHCHECKS_ENV, "ok", "in sync"); return; }
  if (!apply) { log(`\nDry run: ${todo.length} page(s) would change. Add --apply to write.`); return; }

  const writer: EventfrogWriter = eventfrogWriterFromEnv();
  let failed = 0;
  for (const j of todo) {
    try {
      await writer.patchCopy(j.path, j.locale, j.wanted);
      const back = await ef.get(j.path);
      const after = currentCopy(back.localizedInfo).copy;
      const still = changedFields(after, j.wanted);
      if (still.length) { failed++; warn(`${j.label}: written but read-back still differs on ${still.join(",")}`); if (verbose) log(`      read back: ${JSON.stringify(after).slice(0, 600)}`); }
      else log(`  wrote ${j.label}: ${j.changed.join(",")} (read back equal)`);
    } catch (e) {
      failed++;
      warn(`${j.label}: ${(e as Error).message}`);
    }
  }
  const summary = `${todo.length - failed} written, ${failed} failed, ${jobs.length - todo.length} in sync`;
  log(summary);
  await healthcheckPing(HEALTHCHECKS_ENV, failed ? "fail" : "ok", summary);
  if (failed) process.exit(1);
}

if (import.meta.main) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}

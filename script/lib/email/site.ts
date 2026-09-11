// Read-only view of the site's own data for the email scripts: shows from
// _posts front matter, comedians from _comedians, dates from _data/calendar.yml
// (and calendar_past.yml), venues, gallery. Everything here is derived from
// files the cron jobs already maintain; nothing is hand-typed into the emails.
// Pure functions take parsed input so `bun test` can pin them without the repo.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./cli";

export const SITE_URL = (() => {
  try {
    return (readFileSync(join(ROOT, "_config.yml"), "utf8").match(/^url:\s*"?([^"\n]+)"?/m)?.[1] ?? "https://inyourfacecomedy.ch").trim();
  } catch { return "https://inyourfacecomedy.ch"; }
})();

export interface Show {
  slug: string;            // permalink without slashes, e.g. comedybrew
  title: string;           // full post title
  name: string;            // short name: first segment of the title (split on " • " / " - ")
  tagline: string;
  description: string;
  url: string;             // absolute site URL
  eventType: string;       // series | monthly | one-off | single
  language: string;        // en (default) | it | es | de, from `language:` on the post
  recurrenceDay: string;   // Thursday
  recurrenceTime: string;  // 19:30
  venueSlug: string;
  venueName: string;
  hosts: string[];
  thumbnail: string;       // absolute URL or ""
  featureImg: string;      // absolute URL or ""
  priceChf: number;
  nextEventDate: string;   // ISO or ""
  ticketUrl: string;
}

export interface Comedian {
  slug: string;
  name: string;
  photo: string;      // repo-relative path like /assets/img/comedians/x.jpg
  photoPath: string;  // absolute filesystem path or ""
  instagram: string;  // full URL or ""
  handle: string;     // @name or ""
  url: string;        // absolute profile URL
}

export interface CalendarEvent {
  show: string;
  name: string;
  title: string;
  url: string;
  date: string;       // YYYY-MM-DD
  start: string;      // ISO with offset
  end: string;
  venue: string;
  venueName: string;
  location: string;
  priceChf: number;
  ticketUrl: string;
  eventfrogName: string;
}

export interface Venue { slug: string; name: string; street: string; city: string; googleMapsUrl: string }

export interface GalleryPhoto { src: string; path: string; date: string; type: string; aesthetic: number; alt: string; featured: boolean; comedian?: string }

// ---------- parsing helpers (pure) ----------

export function frontMatterOf(text: string): Record<string, unknown> {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  try { return (Bun.YAML.parse(m[1]) as Record<string, unknown>) ?? {}; } catch { return {}; }
}

// Slug matching mirrors comedian-lineup.js: case- and separator-insensitive.
export function norm(s: string): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function shortName(title: string): string {
  return String(title ?? "").split(/\s+•\s+|\s+-\s+|\s+\|\s+/)[0].trim();
}

export function absoluteUrl(p: string): string {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  return SITE_URL.replace(/\/$/, "") + "/" + String(p).replace(/^\/+/, "");
}

export function instagramHandle(url: string): string {
  const m = String(url ?? "").match(/instagram\.com\/([^/?#]+)/i);
  return m ? "@" + m[1].replace(/^@/, "") : "";
}

const str = (v: unknown): string => (v === undefined || v === null ? "" : String(v));
const num = (v: unknown): number => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export function showFromFrontMatter(fm: Record<string, unknown>): Show | null {
  if (!fm.ticket_url || !fm.permalink) return null;
  const permalink = str(fm.permalink);
  return {
    slug: permalink.replace(/^\/+|\/+$/g, ""),
    title: str(fm.title),
    name: shortName(str(fm.title)),
    tagline: str(fm.tagline),
    description: str(fm.description),
    url: absoluteUrl(permalink.replace(/\/?$/, "/")),
    eventType: str(fm.event_type),
    language: (str(fm.language) || "en").toLowerCase(),
    recurrenceDay: str(fm.recurrence_day),
    recurrenceTime: str(fm.recurrence_time),
    venueSlug: str(fm.venue_slug),
    venueName: str(fm.venue),
    hosts: Array.isArray(fm.hosts) ? fm.hosts.map(str) : [],
    thumbnail: absoluteUrl(str(fm.thumbnail)),
    featureImg: absoluteUrl(str(fm["feature-img"] ?? fm.image)),
    priceChf: num(fm.price_chf),
    nextEventDate: fm.next_event_date instanceof Date ? fm.next_event_date.toISOString() : str(fm.next_event_date),
    ticketUrl: str(fm.ticket_url),
  };
}

export function comedianFromFrontMatter(fm: Record<string, unknown>, fileSlug: string): Comedian {
  const slug = str(fm.slug) || fileSlug;
  const photo = str(fm.photo || fm.image);
  return {
    slug,
    name: str(fm.title) || slug,
    photo,
    photoPath: photo ? join(ROOT, photo.replace(/^\/+/, "")) : "",
    instagram: str(fm.instagram),
    handle: instagramHandle(str(fm.instagram)),
    url: absoluteUrl(`/comedians/${slug}/`),
  };
}

export function calendarEvents(yaml: unknown): CalendarEvent[] {
  const events = ((yaml as { events?: unknown[] })?.events ?? []) as Array<Record<string, unknown>>;
  return events.map((e) => ({
    show: str(e.show),
    name: str(e.name),
    title: str(e.title),
    url: absoluteUrl(str(e.url)),
    date: dateOnly(e.date),
    start: str(e.start),
    end: str(e.end),
    venue: str(e.venue),
    venueName: str(e.venue_name),
    location: str(e.location),
    priceChf: num(e.price_chf),
    ticketUrl: str(e.ticket_url),
    eventfrogName: str(e.eventfrog_name),
  }));
}

function dateOnly(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return str(v).slice(0, 10);
}

// ---------- loaders (filesystem) ----------

export function loadShows(): Show[] {
  const dir = join(ROOT, "_posts");
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => showFromFrontMatter(frontMatterOf(readFileSync(join(dir, f), "utf8"))))
    .filter((s): s is Show => !!s);
}

export function loadComedians(): Comedian[] {
  const dir = join(ROOT, "_comedians");
  return readdirSync(dir).filter((f) => f.endsWith(".md")).map((f) => comedianFromFrontMatter(frontMatterOf(readFileSync(join(dir, f), "utf8")), f.replace(/\.md$/, "")));
}

export function loadCalendar(file = "calendar.yml"): { generatedAt: string; events: CalendarEvent[] } {
  const p = join(ROOT, "_data", file);
  if (!existsSync(p)) return { generatedAt: "", events: [] };
  const y = Bun.YAML.parse(readFileSync(p, "utf8")) as { generated_at?: unknown };
  return { generatedAt: str(y?.generated_at), events: calendarEvents(y) };
}

export function loadVenues(): Record<string, Venue> {
  const p = join(ROOT, "_data", "venues.yml");
  if (!existsSync(p)) return {};
  const y = Bun.YAML.parse(readFileSync(p, "utf8")) as Record<string, Record<string, unknown>>;
  const out: Record<string, Venue> = {};
  for (const [slug, v] of Object.entries(y ?? {})) {
    out[slug] = { slug, name: str(v.name), street: str(v.street), city: str(v.city), googleMapsUrl: str(v.google_maps_url) };
  }
  return out;
}

export function loadGallery(): GalleryPhoto[] {
  const p = join(ROOT, "_data", "gallery.yml");
  if (!existsSync(p)) return [];
  const y = Bun.YAML.parse(readFileSync(p, "utf8")) as Array<Record<string, unknown>>;
  return (y ?? []).map((g) => ({
    src: str(g.src),
    path: join(ROOT, str(g.src).replace(/^\/+/, "")),
    date: dateOnly(g.date),
    type: str(g.type),
    aesthetic: num(g.aesthetic),
    alt: str(g.alt),
    featured: g.featured === true,
    comedian: g.comedian ? str(g.comedian) : undefined,
  }));
}

// ---------- lookups (pure) ----------

export function findShow(shows: Show[], slug: string): Show | undefined {
  const want = norm(slug);
  return shows.find((s) => norm(s.slug) === want) ?? shows.find((s) => norm(s.name) === want);
}

export function findComedian(list: Comedian[], slug: string): Comedian | undefined {
  const want = norm(slug);
  return list.find((c) => norm(c.slug) === want) ?? list.find((c) => norm(c.name) === want);
}

// Upcoming dates for one show, ascending, on or after `from` (YYYY-MM-DD).
export function datesFor(events: CalendarEvent[], showSlug: string, from: string): CalendarEvent[] {
  const want = norm(showSlug);
  return events.filter((e) => norm(e.show) === want && e.date >= from).sort((a, b) => a.date.localeCompare(b.date));
}

// Events inside [from, to] grouped by show in first-date order.
export function groupByShow(events: CalendarEvent[], from: string, to: string): Array<{ show: string; events: CalendarEvent[] }> {
  const groups = new Map<string, CalendarEvent[]>();
  for (const e of events.filter((e) => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date))) {
    if (!groups.has(e.show)) groups.set(e.show, []);
    groups.get(e.show)!.push(e);
  }
  return [...groups.entries()].map(([show, evs]) => ({ show, events: evs }));
}

// Is the calendar file older than `hours`? Cron refreshes it daily.
export function calendarStale(generatedAt: string, hours = 36, now = Date.now()): boolean {
  const t = Date.parse(generatedAt);
  if (!Number.isFinite(t)) return true;
  return now - t > hours * 3600_000;
}

// ---------- date formatting (Zürich, English) ----------
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "2026-09-10" -> "Thu 10 Sep". Date-only strings are parsed as calendar dates
// (no timezone shift), which is what a show date is.
export function fmtDate(iso: string, opts: { weekday?: boolean; month?: "short" | "long"; year?: boolean } = {}): string {
  const d = parseDate(iso);
  if (!d) return iso;
  const parts: string[] = [];
  if (opts.weekday !== false) parts.push(DAYS[d.getUTCDay()]);
  parts.push(String(d.getUTCDate()));
  parts.push(opts.month === "long" ? MONTHS_LONG[d.getUTCMonth()] : MONTHS[d.getUTCMonth()]);
  if (opts.year) parts.push(String(d.getUTCFullYear()));
  return parts.join(" ");
}

export function weekdayOf(iso: string): string {
  const d = parseDate(iso);
  return d ? ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()] : "";
}

export function monthLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  return `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
}

// "19:30" from an ISO start, in the offset the string carries (Eventfrog gives local time).
export function timeOf(isoStart: string): string {
  const m = String(isoStart).match(/T(\d{2}:\d{2})/);
  return m ? m[1] : "";
}

export function parseDate(iso: string): Date | null {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  if (!d) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Compact list of dates for a show inside the window: "Thu 10, 17, 24 Sep, 1 Oct".
export function datesLine(events: CalendarEvent[]): string {
  const byMonth = new Map<number, { month: string; days: string[]; weekdays: Set<string> }>();
  for (const e of events) {
    const d = parseDate(e.date);
    if (!d) continue;
    const key = d.getUTCFullYear() * 12 + d.getUTCMonth();
    if (!byMonth.has(key)) byMonth.set(key, { month: MONTHS[d.getUTCMonth()], days: [], weekdays: new Set() });
    const g = byMonth.get(key)!;
    g.days.push(String(d.getUTCDate()));
    g.weekdays.add(DAYS[d.getUTCDay()]);
  }
  const allWeekdays = new Set(events.map((e) => DAYS[parseDate(e.date)?.getUTCDay() ?? 0]));
  const prefix = allWeekdays.size === 1 ? [...allWeekdays][0] + " " : "";
  return prefix + [...byMonth.values()].map((g) => `${g.days.join(", ")} ${g.month}`).join(", ");
}

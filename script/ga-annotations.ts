#!/usr/bin/env bun
// Show dates as GA4 report annotations, so every chart in Google Analytics marks
// the nights a show happened. Reads _data/calendar.yml (Eventfrog-derived, refreshed
// by the 09:00 cron) and creates one annotation per upcoming show date that does
// not exist yet. Idempotent: an annotation is identified by its title + date, so
// re-runs create nothing new and past annotations are left alone (never deleted).
//
//   bun script/ga-annotations.ts --dry-run   # list what would be created
//   bun script/ga-annotations.ts             # create
//
// Auth and .env handling are shared with script/ga-setup.ts (Editor role needed;
// the Admin API v1alpha carries reportingDataAnnotations). See ANALYTICS.md.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { accessToken, api, PROPERTY } from "./ga-setup";

const ROOT = resolve(import.meta.dir, "..");
const DRY = process.argv.includes("--dry-run");

export interface CalEvent { show: string; name: string; date: string; venue_name: string; ticket_url: string }

// calendar.yml is generated with a fixed, flat shape (see refresh-calendar-data.rb), so a
// line parser over the `events:` list is enough and keeps this stdlib-only like the
// Ruby scripts. Values may be single- or double-quoted.
export function parseCalendar(yaml: string): CalEvent[] {
  const out: CalEvent[] = [];
  let inEvents = false;
  let cur: Partial<CalEvent> | null = null;
  const unq = (v: string) => v.trim().replace(/^(['"])(.*)\1$/, "$2");
  for (const line of yaml.split("\n")) {
    if (/^events:\s*$/.test(line)) { inEvents = true; continue; }
    if (inEvents && /^\w+:/.test(line)) { inEvents = false; }
    if (!inEvents) continue;
    const start = line.match(/^- (\w+):\s*(.*)$/);
    if (start) {
      if (cur && cur.show && cur.date) out.push(cur as CalEvent);
      cur = {};
      (cur as any)[start[1]] = unq(start[2]);
      continue;
    }
    const kv = line.match(/^  (\w+):\s*(.*)$/);
    if (kv && cur) (cur as any)[kv[1]] = unq(kv[2]);
  }
  if (cur && cur.show && cur.date) out.push(cur as CalEvent);
  return out.map((e) => ({ show: e.show, name: e.name ?? e.show, date: e.date, venue_name: e.venue_name ?? "", ticket_url: e.ticket_url ?? "" }));
}

// GA caps annotation titles at 60 characters; drop the venue first, then truncate.
export function annotationTitle(e: CalEvent): string {
  const full = e.venue_name ? `${e.name} @ ${e.venue_name}` : e.name;
  if (full.length <= 60) return full;
  return e.name.length <= 60 ? e.name : e.name.slice(0, 57) + "...";
}

// One colour per venue keeps the timeline readable; anything else falls back to purple.
const COLOURS: Record<string, string> = { robins: "RED", otro: "BLUE", "goldfisch-club": "GREEN" };

if (import.meta.main) {
  const events = parseCalendar(readFileSync(join(ROOT, "_data", "calendar.yml"), "utf8"));
  const token = await accessToken();
  const existing: { title: string; date: string }[] = [];
  let pageToken = "";
  do {
    const r = await api(token, "GET", `v1alpha/${PROPERTY}/reportingDataAnnotations?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`);
    for (const a of r.reportingDataAnnotations ?? []) {
      const d = a.annotationDate ?? a.annotationDateRange?.startDate;
      if (d) existing.push({ title: a.title, date: `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` });
    }
    pageToken = r.nextPageToken ?? "";
  } while (pageToken);
  const have = new Set(existing.map((a) => `${a.title}|${a.date}`));

  const todo = events.filter((e) => !have.has(`${annotationTitle(e)}|${e.date}`));
  console.log(`calendar: ${events.length} upcoming dates, annotations: ${existing.length} existing, ${todo.length} to create`);
  let failed = 0;
  for (const e of todo) {
    const [y, m, d] = e.date.split("-").map(Number);
    const venueSlug = events.find((x) => x === e) ? (e as any).venue ?? "" : "";
    const body = {
      title: annotationTitle(e),
      description: e.ticket_url,
      color: COLOURS[venueSlug] ?? "PURPLE",
      annotationDate: { year: y, month: m, day: d },
    };
    if (DRY) { console.log(`would create ${e.date}  ${body.title}`); continue; }
    try { await api(token, "POST", `v1alpha/${PROPERTY}/reportingDataAnnotations`, body); console.log(`created ${e.date}  ${body.title}`); }
    catch (err) { failed++; console.log(`FAIL ${e.date}  ${body.title}: ${(err as Error).message}`); }
  }
  process.exit(failed ? 1 : 0);
}

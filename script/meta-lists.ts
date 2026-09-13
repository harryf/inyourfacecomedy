#!/usr/bin/env bun
// Meta customer-list files (META_ADS.md phase 0 step 4) from the Eventfrog ticket
// sales sheet, kept to people who are subscribed in Mailchimp.
//
//   bun script/meta-lists.ts                      # newest tickets-*.csv and mailchimp-*.csv in meta-ads/lists/
//   bun script/meta-lists.ts --dry-run            # counts only, writes nothing
//   bun script/meta-lists.ts --date 2026-09-13 --months 12
//   bun script/meta-lists.ts --tickets <file> --mailchimp <file>
//
// Inputs (both gitignored under meta-ads/lists/):
//   tickets-YYYY-MM-DD.csv    "Customer Analyser - Tickets Sold" sheet: one row per ticket with
//                             Event Date (DD/MM/YYYY or YYYY-MM-DD), First Name, Last Name, E-Mail,
//                             Postcode, City, Price
//   mailchimp-YYYY-MM-DD.csv  Mailchimp audience export, Subscribed only ("Email Address" column)
// Outputs (same folder, Meta's own column headers so the upload maps them automatically):
//   buyers-recent-YYYY-MM-DD.csv   last show within --months of --date
//   buyers-lapsed-YYYY-MM-DD.csv   last show older than that
//   buyers-all-YYYY-MM-DD.csv      both together, the seed for the value-based lookalike
// A buyer whose email is not in the Mailchimp export is dropped: the opt-in is the consent.
// Playbook: META_ADS.md phase 0.

import { existsSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, todayISO, warn } from "./lib/email/cli";

const ROOT = resolve(import.meta.dir, "..");
const LISTS_DIR = join(ROOT, "meta-ads", "lists");

const USAGE = `Usage: bun script/meta-lists.ts [options]

  --tickets <file>    ticket sales CSV (default: newest meta-ads/lists/tickets-*.csv)
  --mailchimp <file>  Mailchimp subscribed export (default: newest meta-ads/lists/mailchimp-*.csv)
  --date YYYY-MM-DD   as-of date for the recent/lapsed split (default: today)
  --months <n>        recent means a show within this many months of --date (default 12)
  --out <dir>         output folder (default meta-ads/lists)
  --dry-run           print the counts, write nothing
`;

// ---------- CSV (RFC 4180: quoted fields, doubled quotes, CR LF, BOM) ----------

export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

export function parseRecords(text: string): Record<string, string>[] {
  const [header, ...rest] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((k) => k.trim());
  return rest.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

export function csvField(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((r) => r.map(csvField).join(",")).join("\n") + "\n";
}

// ---------- rows ----------

export interface Ticket { email: string; date: string; fn: string; ln: string; zip: string; city: string; price: number }

export interface Buyer { email: string; fn: string; ln: string; ct: string; zip: string; country: string; value: number; last: string; shows: number }

// The sheet mixes DD/MM/YYYY (most rows) with YYYY-MM-DD (rows added by hand). Anything else is null.
export function parseEventDate(s: string): string | null {
  const t = (s || "").trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  return null;
}

export function normEmail(s: string): string {
  return (s || "").trim().toLowerCase();
}

// Meta wants ISO country codes and checks location itself when the cell is empty. A four-digit
// postcode is Swiss here (9485 to 9498 is Liechtenstein); five digits is Germany, letters are
// the UK or Canada, so those get no country rather than a wrong one. Austria, Belgium, Denmark
// and a few others are four digits too: the handful of such cities seen in the sheet get no
// country either. Add to the list when a run shows a new one.
const FOREIGN_FOUR_DIGIT_CITIES = new Set([
  "innsbruck", "klagenfurt", "gmunden", "copenhagen", "antwerp", "poederlee", "madrid", "vilnius", "riga",
  "skofljica", "pragersko", "chemnitz", "thorigny", "saint-genis-pouilly", "lower township", "carnegie", "malvern east", "kensington", "al-thumama-47",
]);
export function countryFor(zip: string, city = ""): string {
  if (/^94(8[5-9]|9[0-8])$/.test(zip)) return "LI";
  if (!/^\d{4}$/.test(zip)) return "";
  return FOREIGN_FOUR_DIGIT_CITIES.has(city.trim().toLowerCase()) ? "" : "CH";
}

export function ticketsFrom(records: Record<string, string>[]): { tickets: Ticket[]; badDates: number; noEmail: number } {
  const tickets: Ticket[] = [];
  let badDates = 0;
  let noEmail = 0;
  for (const r of records) {
    const email = normEmail(r["E-Mail"]);
    if (!email) { noEmail++; continue; }
    const date = parseEventDate(r["Event Date"]);
    if (!date) { badDates++; continue; }
    const price = Number((r["Price"] || "").replace(",", "."));
    tickets.push({
      email, date,
      fn: (r["First Name"] || "").trim(), ln: (r["Last Name"] || "").trim(),
      zip: (r["Postcode"] || "").trim(), city: (r["City"] || "").trim(),
      price: Number.isFinite(price) ? price : 0,
    });
  }
  return { tickets, badDates, noEmail };
}

// One buyer per email: name, city and postcode from the most recent ticket, value summed over all.
export function buyersFrom(tickets: Ticket[]): Map<string, Buyer> {
  const out = new Map<string, Buyer>();
  for (const t of tickets) {
    const b = out.get(t.email);
    if (!b) {
      out.set(t.email, { email: t.email, fn: t.fn, ln: t.ln, ct: t.city, zip: t.zip, country: countryFor(t.zip, t.city), value: t.price, last: t.date, shows: 1 });
      continue;
    }
    b.value += t.price;
    b.shows++;
    if (t.date >= b.last) {
      b.last = t.date;
      if (t.fn) b.fn = t.fn;
      if (t.ln) b.ln = t.ln;
      if (t.city) b.ct = t.city;
      if (t.zip) { b.zip = t.zip; b.country = countryFor(t.zip, t.city || b.ct); }
    }
  }
  return out;
}

// The same calendar day N months earlier, clamped to the month's last day (2026-05-31 minus 3 is 2026-02-28).
export function monthsBefore(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export interface Split { recent: Buyer[]; lapsed: Buyer[]; cutoff: string; neverBought: number }

export function split(buyers: Map<string, Buyer>, subscribed: Set<string>, asOf: string, months: number): Split {
  const cutoff = monthsBefore(asOf, months);
  const recent: Buyer[] = [];
  const lapsed: Buyer[] = [];
  let neverBought = 0;
  for (const email of subscribed) {
    const b = buyers.get(email);
    if (!b) { neverBought++; continue; }
    (b.last >= cutoff ? recent : lapsed).push(b);
  }
  const byEmail = (a: Buyer, b: Buyer) => a.email.localeCompare(b.email);
  recent.sort(byEmail);
  lapsed.sort(byEmail);
  return { recent, lapsed, cutoff, neverBought };
}

export const META_HEADER = ["email", "fn", "ln", "ct", "zip", "country", "value"];

export function metaRows(buyers: Buyer[]): string[][] {
  return buyers.map((b) => [b.email, b.fn, b.ln, b.ct, b.zip, b.country, String(Math.round(b.value * 100) / 100)]);
}

// ---------- files ----------

function newest(prefix: string): string {
  if (!existsSync(LISTS_DIR)) fail(`missing folder ${LISTS_DIR}`);
  const names = readdirSync(LISTS_DIR).filter((n) => n.startsWith(prefix) && n.endsWith(".csv")).sort();
  if (!names.length) fail(`no ${prefix}*.csv in meta-ads/lists/ (see META_ADS.md phase 0)`);
  return join(LISTS_DIR, names[names.length - 1]);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); return; }
  const dryRun = flagBool(args, "dry-run");
  const asOf = flagString(args, "date") || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) fail(`--date wants YYYY-MM-DD, got ${asOf}`);
  const months = Number(flagString(args, "months") || 12);
  if (!Number.isInteger(months) || months < 1) fail(`--months wants a whole number of months`);
  const ticketsPath = flagString(args, "tickets") || newest("tickets-");
  const mailchimpPath = flagString(args, "mailchimp") || newest("mailchimp-");
  const outDir = flagString(args, "out") || LISTS_DIR;
  for (const p of [ticketsPath, mailchimpPath]) if (!existsSync(p)) fail(`missing ${p}`);

  const ticketRecords = parseRecords(await Bun.file(ticketsPath).text());
  const mcRecords = parseRecords(await Bun.file(mailchimpPath).text());
  if (!ticketRecords.length || !("E-Mail" in ticketRecords[0])) fail(`${basename(ticketsPath)}: no "E-Mail" column`);
  if (!mcRecords.length || !("Email Address" in mcRecords[0])) fail(`${basename(mailchimpPath)}: no "Email Address" column`);

  const { tickets, badDates, noEmail } = ticketsFrom(ticketRecords);
  const buyers = buyersFrom(tickets);
  const subscribed = new Set(mcRecords.map((r) => normEmail(r["Email Address"])).filter(Boolean));
  const s = split(buyers, subscribed, asOf, months);

  log(`tickets:      ${basename(ticketsPath)} (${ticketRecords.length} rows, ${buyers.size} buyers)`);
  log(`mailchimp:    ${basename(mailchimpPath)} (${subscribed.size} subscribed)`);
  if (badDates || noEmail) warn(`skipped ${badDates} rows with an unreadable Event Date and ${noEmail} without an email`);
  log(`as of ${asOf}, recent = last show on or after ${s.cutoff} (${months} months)`);
  log(`matched:      ${s.recent.length + s.lapsed.length} buyers are subscribed`);
  log(`  recent:     ${s.recent.length}`);
  log(`  lapsed:     ${s.lapsed.length}`);
  log(`  subscribed but never bought a ticket: ${s.neverBought} (not written)`);
  const dropped = buyers.size - s.recent.length - s.lapsed.length;
  log(`  buyers not subscribed, dropped: ${dropped}`);
  for (const [name, list] of [["recent", s.recent], ["lapsed", s.lapsed]] as const) {
    if (list.length < 100) warn(`${name} has fewer than 100 people; Meta may not build an audience from it (merge the two files, META_ADS.md phase 2)`);
  }

  // buyers-all is the two together: the better seed for one value-based lookalike (bigger source).
  const all = [...s.recent, ...s.lapsed].sort((a, b) => a.email.localeCompare(b.email));
  const files: [string, Buyer[]][] = [
    [join(outDir, `buyers-recent-${asOf}.csv`), s.recent],
    [join(outDir, `buyers-lapsed-${asOf}.csv`), s.lapsed],
    [join(outDir, `buyers-all-${asOf}.csv`), all],
  ];
  for (const [path, list] of files) {
    if (dryRun) { log(`[dry-run] would write ${path} (${list.length} rows)`); continue; }
    await Bun.write(path, toCsv(META_HEADER, metaRows(list)));
    log(`wrote ${path} (${list.length} rows)`);
  }
  if (!dryRun) log(`Upload each file in Ads Manager: Audiences, Create audience, Custom audience, Customer list (META_ADS.md phase 2).`);
}

if (import.meta.main) main().catch((e) => fail(e?.stack || String(e)));

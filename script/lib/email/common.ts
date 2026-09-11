// Bits shared by the three scripts that are neither rendering nor Mailchimp:
// logo and image hosting, copy resolution (--copy / --no-ai / Claude), language
// strings, the show table handed to the prompt.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { OUT_DIR, ROOT, flagBool, flagString, log, warn, type Args } from "./cli";
import { ensureUploaded, imageDimensions, localFileUrl, resizeSquare, resizeWidth, sourceStamp } from "./images";
import { generateCopy, loadCopy, placeholderCopy, saveCopy, type Copy, type EmailType } from "./copy";
import { Mailchimp } from "./mailchimp";
import { SITE_URL, type CalendarEvent, type Show, calendarStale, datesLine, timeOf, weekdayOf } from "./site";

export const LOGO_SRC = join(ROOT, "assets", "img", "inyourface.png");

// In a dry run nothing is uploaded; the preview points at the resized local file.
export async function hostedSquare(mc: Mailchimp | null, src: string, size: number, name: string, format: "jpeg" | "png" = "jpeg", crop = true): Promise<string> {
  const local = resizeSquare(src, size, format, crop);
  return mc ? ensureUploaded(mc, local, name) : localFileUrl(local);
}

export async function hostedWide(mc: Mailchimp | null, src: string, width: number, name: string): Promise<{ url: string; width: number; height: number }> {
  const local = resizeWidth(src, width);
  const dim = imageDimensions(local);
  return { url: mc ? await ensureUploaded(mc, local, name) : localFileUrl(local), ...dim };
}

export async function logoUrl(mc: Mailchimp | null): Promise<string> {
  if (!existsSync(LOGO_SRC)) return "";
  // Fitted, not cropped: the ring of the logo runs to the edges of the file.
  try { return await hostedSquare(mc, LOGO_SRC, 192, hostedName("iyf-email-logo-192-fit", LOGO_SRC, "png"), "png", false); } catch (e) { warn(`logo: ${(e as Error).message}`); return ""; }
}

// A site URL like https://inyourfacecomedy.ch/assets/img/x.png -> local file path, or "".
export function localPathForSiteUrl(url: string): string {
  if (!url) return "";
  const rel = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url.startsWith("/") ? url : "";
  if (!rel) return "";
  const p = join(ROOT, rel.replace(/^\/+/, ""));
  return existsSync(p) ? p : "";
}

// Mailchimp client unless --dry-run (reads are fine, but a dry run must work
// without a key at all).
export function mailchimpFor(args: Args): Mailchimp | null {
  if (flagBool(args, "dry-run")) return null;
  try { return Mailchimp.fromEnv(); } catch (e) { throw new Error(`${(e as Error).message}; use --dry-run to preview without Mailchimp`); }
}

// --copy <file> wins, then --no-ai, else Claude. Whatever is used gets saved
// as <base>.copy.json so a re-run with --copy is always possible.
export function resolveCopy(type: EmailType, args: Args, vars: Record<string, string>, baseName: string, forKey: string): { copy: Copy; path: string } {
  const path = join(OUT_DIR, `${baseName}.copy.json`);
  let copy: Copy;
  const file = flagString(args, "copy");
  if (file) {
    copy = loadCopy(type, file, forKey);
    log(`  copy   from ${file}`);
  } else if (flagBool(args, "no-ai")) {
    copy = placeholderCopy(type, vars);
    log(`  copy   placeholder (--no-ai)`);
  } else {
    log(`  copy   asking claude (${process.env.EMAIL_CLAUDE_MODEL || "sonnet"})...`);
    const r = generateCopy(type, vars, { model: flagString(args, "model") });
    for (const f of r.fixes) warn(f);
    copy = r.copy;
  }
  saveCopy(path, copy, forKey);
  log(`  saved  ${path}`);
  return { copy, path };
}

// Hosted image names carry the source stamp so a replaced photo is re-uploaded.
export function hostedName(prefix: string, src: string, ext: string): string {
  return `${prefix}-${sourceStamp(src)}.${ext}`;
}

// Refuse to build dates on a calendar the cron has not refreshed, unless told to.
export function requireFreshCalendar(generatedAt: string, args: Args): void {
  if (!calendarStale(generatedAt)) return;
  const msg = `calendar.yml was generated ${generatedAt || "never"}; the daily refresh may have missed a run (ruby script/refresh-calendar-data.rb)`;
  if (flagBool(args, "allow-stale") || flagBool(args, "dry-run")) warn(msg);
  else throw new Error(msg + ". Pass --allow-stale to go ahead anyway.");
}

// ---------- language strings ----------
export type Lang = "en" | "it" | "es" | "de";

export function greetingFor(lang: Lang): string {
  const hi = { en: ["Hi", "Hi there"], it: ["Ciao", "Ciao"], es: ["Hola", "Hola"], de: ["Hallo", "Hallo"] }[lang];
  return `*|IF:FNAME|*${hi[0]} *|FNAME|*,*|ELSE:|*${hi[1]},*|END:IF|*`;
}

export function signoffFor(lang: Lang, first?: string): string[] {
  const line = first ?? { en: "See you there,", it: "Ci vediamo lì,", es: "Nos vemos allí,", de: "Bis dann," }[lang];
  return [line, "Harry & the IN YOUR FACE Comedy Crew"];
}

export const CALENDAR_URL = `${SITE_URL}/calendar/`;

// ---------- show summary for prompts and cards ----------
export function eyebrowFor(events: CalendarEvent[], show: Show | undefined, venueName: string): string {
  const days = [...new Set(events.map((e) => weekdayOf(e.date).slice(0, 3)))];
  const time = events[0] ? timeOf(events[0].start) : show?.recurrenceTime ?? "";
  return [days.length === 1 ? days[0] : days.length > 1 ? "Various nights" : "", time, venueName].filter(Boolean).join(" · ");
}

export function slotFor(show: Show | undefined, venueName: string): string {
  if (!show || show.eventType !== "series" || !show.recurrenceDay) return "";
  return `every ${show.recurrenceDay} at ${venueName}${show.recurrenceTime ? `, ${show.recurrenceTime}` : ""}`;
}

export function showsTable(rows: Array<{ slug: string; name: string; venue: string; events: CalendarEvent[]; show?: Show; extra?: string }>): string {
  return rows.map((r) => [
    r.slug, r.name, r.venue, datesLine(r.events) || "no dates", slotFor(r.show, r.venue) || "one-off",
    r.show?.tagline || "", (r.show?.description || "").slice(0, 200), r.extra ?? "",
  ].map((s) => String(s).replace(/\s*\|\s*/g, " / ")).join(" | ")).join("\n");
}

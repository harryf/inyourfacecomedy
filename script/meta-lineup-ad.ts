#!/usr/bin/env bun
// The Buyers lineup ad (META_ADS.md phase 7): for the next Comedy Brew row in the Grist
// `Lineups` table, render the flyer with the page's own drawing code, upload it, and create
// the ad in the Buyers ad set with a tracked /go/ link.
//
//   bun script/meta-lineup-ad.ts --dry-run             # render, print the plan, write nothing to Meta
//   bun script/meta-lineup-ad.ts                       # create or update the ad, PAUSED
//   bun script/meta-lineup-ad.ts --activate            # same, then switch the ad on
//   bun script/meta-lineup-ad.ts --date 2026-09-17     # a specific show date (default: next row from today)
//   bun script/meta-lineup-ad.ts --skip-adset          # leave the Buyers ad set's targeting and budget alone
//   bun script/meta-lineup-ad.ts --replace --activate  # copy or flyer changed: new creative on this date's ad
//
// Copy: meta-ads/lineup-copy.yml (five bodies, titles, descriptions; placeholders filled from
// the calendar), the flyer gets a "THIS THURSDAY" stamp, the button is Book Now.
//
// Steps: Grist row (date, show, link, style) -> calendar entry for time, venue, price ->
// names from _comedians/ in running order -> headless Brave opens the lineup link and calls
// window.__iyfDrawFlyer for post (1080x1350) and story (1080x1920) into script/meta-out/ ->
// upload the post image -> creative (page + Instagram, five texts) -> the one lineup-* ad in
// Buyers gets it and this date's name (created if missing; a re-run on the same date changes
// nothing unless --replace) -> Buyers ad set checked: buyer lists, Advantage+ off, link
// clicks, ramp budget (printed before writing).
// Cron (Mondays, Tuesday fallback, Friday pause): see script/README.md.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, todayISO, warn } from "./lib/email/cli";
import { OUT_DIR, REPO_ROOT, chfToMinor, healthcheck, loadConfig, loadEnv, metaFromEnv, minorToChf, type MetaConfig } from "./lib/meta-api";
import { openBrowser } from "./lib/headless";

const USAGE = `Usage: bun script/meta-lineup-ad.ts [options]

  --date YYYY-MM-DD   show date to build (default: the next Comedy Brew row on or after today)
  --activate          set the ad ACTIVE after creating or finding it (default: leave PAUSED)
  --skip-adset        do not touch the Buyers ad set (targeting, optimisation, budget)
  --replace           the copy or flyer changed: give this date's ad a new creative
  --dry-run           render the images and print everything; no Meta writes
`;

const GRIST_TEAM = "inyourfacecomedy";
const GRIST_DOC = "6idWaHUKEeZN";
const SITE = "https://inyourfacecomedy.ch";

// ---------- inputs ----------

export interface LineupRow { date: string; show: string; link: string; style: string }

export function rowFromGrist(r: any): LineupRow | null {
  const f = r?.fields || {};
  if (!f.date || !f.link) return null;
  const date = typeof f.date === "number" ? new Date(f.date * 1000).toISOString().slice(0, 10) : String(f.date).slice(0, 10);
  return { date, show: String(f.show || "comedybrew").trim(), link: String(f.link).trim(), style: String(f.style || "").trim() || "classic" };
}

export function pickRow(rows: LineupRow[], show: string, fromDate: string, exact?: string): LineupRow | null {
  const mine = rows.filter((r) => r.show === show).sort((a, b) => a.date.localeCompare(b.date));
  if (exact) return mine.find((r) => r.date === exact) || null;
  return mine.find((r) => r.date >= fromDate) || null;
}

export interface LinkState { show: string; type: "split" | "flat"; host: string; first: string[]; second: string[]; lineup: string[]; headliner: string[] }

export function parseLineupLink(link: string): LinkState {
  const u = new URL(link, SITE);
  const list = (k: string) => (u.searchParams.get(k) || "").split(",").map((s) => s.trim()).filter(Boolean);
  const st: LinkState = {
    show: (u.searchParams.get("show") || "").trim(), type: "flat", host: (u.searchParams.get("host") || "").trim(),
    first: list("first"), second: list("second"), lineup: list("lineup"), headliner: list("headliner"),
  };
  const t = (u.searchParams.get("type") || "").toLowerCase();
  st.type = t === "split" || t === "flat" ? t : (st.first.length || st.second.length ? "split" : "flat");
  return st;
}

export interface CalendarEntry { show: string; name: string; date: string; start: string; venue_name?: string; location?: string; price_chf?: number; ticket_url?: string }

export function calendarEntry(entries: CalendarEntry[], show: string, date: string): CalendarEntry | null {
  return entries.find((e) => e.show === show && e.date === date) || null;
}

// Names from _comedians/<slug>.md front matter; a slug without a file (a guest) keeps its slug, prettified.
export function comedianName(slug: string, root = REPO_ROOT): string {
  const s = slug.replace(/^guest:/i, "");
  const p = join(root, "_comedians", `${s}.md`);
  if (existsSync(p)) {
    const m = readFileSync(p, "utf8").match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (m) return m[1];
  }
  return s.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function runningOrder(st: LinkState): string[] {
  const raw = st.type === "split" ? [...st.first, ...st.second] : [...st.lineup];
  return raw.filter((s) => s.toLowerCase() !== st.host.toLowerCase());
}

// ---------- copy ----------

const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WD[dt.getUTCDay()]} ${d} ${MO[m - 1]}`;
}
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WD[dt.getUTCDay()].slice(0, 3)} ${d} ${MO[m - 1].slice(0, 3)}`;
}
export function timeOf(start: string): string { const m = start.match(/T(\d{2}:\d{2})/); return m ? m[1] : "19:30"; }

// "2026-09-17" + "18:00" -> "2026-09-17T18:00:00+02:00", the Zürich offset for that day.
export function zurichIso(date: string, hhmm: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Zurich", hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const offsetMin = Math.round((local - guess) / 60000);
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${date}T${hhmm}:00${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export function goLink(show: string, date: string): string {
  const ymd = date.replace(/-/g, "");
  return `${SITE}/go/?show=${show}&date=${date}&utm_source=meta&utm_medium=paid_social&utm_campaign=${show}-${ymd}&utm_content=lineup-${ymd}`;
}

// Copy comes from meta-ads/lineup-copy.yml: five bodies, five titles, five descriptions,
// with placeholders filled from the calendar entry. Meta's limits: 5 of each; a body over
// 125 characters gets truncated in most placements, so that one is enforced.
export interface AdCopy { bodies: string[]; titles: string[]; descriptions: string[]; stamp: string }
export const BODY_MAX = 125;
export const TITLE_SOFT = 40;
export const DESC_SOFT = 30;

export function copyVars(cal: CalendarEntry): Record<string, string> {
  const weekday = longDate(cal.date).split(" ")[0];
  const venue = (cal.venue_name || cal.location || "ROBIN's").replace(/\s+Coffee$/i, "");
  return {
    show: cal.name, weekday, weekday_upper: weekday.toUpperCase(), date: shortDate(cal.date), time: timeOf(cal.start),
    venue, price: cal.price_chf ? `CHF ${cal.price_chf}` : "",
  };
}

export function fillCopy(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m)).replace(/\s{2,}/g, " ").trim();
}

export function loadCopy(cal: CalendarEntry, file = join(REPO_ROOT, "meta-ads", "lineup-copy.yml")): AdCopy {
  const raw = Bun.YAML.parse(readFileSync(file, "utf8")) as { stamp?: string; bodies: string[]; titles: string[]; descriptions: string[] };
  const vars = copyVars(cal);
  const list = (k: "bodies" | "titles" | "descriptions") => {
    const arr = (raw[k] || []).map((t) => fillCopy(String(t), vars)).filter(Boolean);
    if (!arr.length) throw new Error(`${file}: ${k} is empty`);
    if (arr.length > 5) throw new Error(`${file}: ${k} has ${arr.length} entries, Meta allows 5`);
    return arr;
  };
  const copy = { bodies: list("bodies"), titles: list("titles"), descriptions: list("descriptions"), stamp: fillCopy(raw.stamp || "", vars) };
  const long = copy.bodies.filter((b) => [...b].length > BODY_MAX);
  if (long.length) throw new Error(`${file}: ${long.length} body over ${BODY_MAX} characters:\n  ${long.join("\n  ")}`);
  return copy;
}

// ---------- render (headless Brave, Chrome DevTools Protocol) ----------

// The browser lives in script/lib/headless.ts (shared with meta-bank.ts).

// Runs inside the page: rebuild the wizard state from the URL (same fields the page reads),
// wait for the draw hook, draw into an off-screen canvas, add the stamp, return a PNG data URL.
// The stamp sits top right in the ruler area, clear of the logo, faces and the date bar.
function drawExpression(format: string, style: string, stamp: string): string {
  return `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 60 && typeof window.__iyfDrawFlyer !== "function"; i++) await wait(500);
    if (typeof window.__iyfDrawFlyer !== "function") throw new Error("page did not expose __iyfDrawFlyer");
    const p = new URLSearchParams(location.search);
    const list = (n) => (p.get(n) || "").split(",").map((s) => s.trim()).filter(Boolean);
    const st = { show: (p.get("show") || "").trim(), type: (p.get("type") || "").trim().toLowerCase(), host: (p.get("host") || "").trim(),
      headliner: list("headliner"), lineup: list("lineup"), first: list("first"), second: list("second") };
    if (st.type !== "flat" && st.type !== "split") st.type = (st.first.length || st.second.length) ? "split" : "flat";
    const c = document.createElement("canvas");
    await new Promise((res, rej) => window.__iyfDrawFlyer(c, st, ${JSON.stringify(format)}, ${JSON.stringify(style)}, (e) => e ? rej(e) : res()));
    const stamp = ${JSON.stringify(stamp)};
    if (stamp) {
      const ctx = c.getContext("2d");
      const story = c.height > 1500;
      const cx = story ? 820 : 850, cy = story ? 330 : 118, size = story ? 58 : 54;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-8 * Math.PI / 180);
      ctx.font = "bold " + size + "px Anton, 'Arial Black', Impact, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(stamp).width + 56, h = size + 30;
      ctx.lineWidth = 6; ctx.strokeStyle = "#E53935"; ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#E53935";
      ctx.fillText(stamp, 0, 4);
      ctx.restore();
    }
    return c.toDataURL("image/png");
  })()`;
}

export async function renderFlyers(link: string, style: string, outBase: string, stamp = ""): Promise<{ post: string; story: string }> {
  mkdirSync(OUT_DIR, { recursive: true });
  const { cdp, kill } = await openBrowser();
  try {
    await cdp.send("Page.enable");
    const loaded = new Promise<void>((res) => cdp.on("Page.loadEventFired", () => res()));
    await cdp.send("Page.navigate", { url: link });
    await Promise.race([loaded, new Promise((_, rej) => setTimeout(() => rej(new Error("lineup page did not load in 30 s")), 30_000))]);
    const out: Record<string, string> = {};
    for (const format of ["post", "story"]) {
      const r = await cdp.send("Runtime.evaluate", { expression: drawExpression(format, style, stamp), awaitPromise: true, returnByValue: true, timeout: 60_000 });
      if (r.exceptionDetails) throw new Error(`render ${format}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
      const dataUrl: string = r.result.value;
      if (!dataUrl?.startsWith("data:image/png;base64,")) throw new Error(`render ${format}: no PNG came back`);
      const file = `${outBase}-${format}.png`;
      writeFileSync(file, Buffer.from(dataUrl.slice("data:image/png;base64,".length), "base64"));
      out[format] = file;
    }
    return { post: out.post, story: out.story };
  } finally { kill(); }
}

export function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// ---------- Meta ----------

const CACHE = join(OUT_DIR, "uploads.json");
function readCache(): Record<string, string> { try { return JSON.parse(readFileSync(CACHE, "utf8")); } catch { return {}; } }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); return; }
  const dryRun = flagBool(args, "dry-run");
  const activate = flagBool(args, "activate");
  const skipAdset = flagBool(args, "skip-adset");
  const replace = flagBool(args, "replace");
  const exactDate = flagString(args, "date");
  if (exactDate && !/^\d{4}-\d{2}-\d{2}$/.test(exactDate)) fail("--date wants YYYY-MM-DD");
  loadEnv();
  const config: MetaConfig = loadConfig();
  const gristKey = process.env.GRIST_API_KEY || "";
  if (!gristKey) fail("GRIST_API_KEY is not set in .env");
  const show = config.ramp_shows?.[0] || "comedybrew";

  // 1. The Grist row.
  const gres = await fetch(`https://${GRIST_TEAM}.getgrist.com/api/docs/${GRIST_DOC}/tables/${config.lineup.grist_table}/records`, { headers: { Authorization: `Bearer ${gristKey}` } });
  if (!gres.ok) fail(`Grist ${config.lineup.grist_table}: http ${gres.status}`);
  const rows = ((await gres.json()).records || []).map(rowFromGrist).filter(Boolean) as LineupRow[];
  const row = pickRow(rows, show, todayISO(), exactDate);
  if (!row) fail(`no ${show} row in Grist ${config.lineup.grist_table} ${exactDate ? `for ${exactDate}` : `on or after ${todayISO()}`}; add one (date, show, link, style) or post the week story by hand`);
  const style = row.style || config.lineup.default_style || "classic";
  log(`row:       ${row.date} ${row.show} style=${style}`);
  log(`link:      ${row.link}`);

  // 2. Calendar and names.
  const calData = Bun.YAML.parse(readFileSync(join(REPO_ROOT, "_data", "calendar.yml"), "utf8")) as { events?: CalendarEntry[] };
  const cal = calendarEntry(calData?.events || [], row.show, row.date);
  if (!cal) fail(`_data/calendar.yml has no ${row.show} entry on ${row.date}; run the calendar refresh or check the date`);
  const st = parseLineupLink(row.link);
  const order = runningOrder(st);
  if (!order.length) fail("the lineup link has no acts on it");
  const names = order.map((s) => comedianName(s));
  const host = st.host ? comedianName(st.host) : "";
  const copy = loadCopy(cal);
  const link = goLink(row.show, row.date);
  log(`show:      ${cal.name}, ${longDate(cal.date)} ${timeOf(cal.start)}, ${cal.location || cal.venue_name}, CHF ${cal.price_chf ?? "?"}`);
  log(`host:      ${host || "(none set on the link)"}`);
  log(`order:     ${names.join(" | ")} (not in the copy; the flyer shows the faces)`);
  log(`ad link:   ${link}`);
  log(`button:    Book Now (BOOK_TRAVEL), same as the old Comedy Brew ad`);
  log(`stamp:     ${copy.stamp || "(none)"}`);
  const showList = (label: string, arr: string[], soft: number) => {
    log(`${label}:`);
    for (const t of arr) { const n = [...t].length; log(`  ${String(n).padStart(3)}${n > soft ? "!" : " "} ${t}`); }
  };
  showList("bodies (125 max)", copy.bodies, BODY_MAX);
  showList(`titles (${TITLE_SOFT} shown)`, copy.titles, TITLE_SOFT);
  showList(`descriptions (${DESC_SOFT} shown)`, copy.descriptions, DESC_SOFT);

  // 3. Render.
  const ymd = row.date.replace(/-/g, "");
  const adName = `lineup-${row.date}`;
  const files = await renderFlyers(row.link, style, join(OUT_DIR, `lineup-${row.date}`), copy.stamp);
  for (const [k, f] of Object.entries(files)) { const s = pngSize(f); log(`render:    ${k} ${s.w}x${s.h} ${f}`); }

  if (dryRun) { log("[dry-run] no Meta writes; images are in script/meta-out/"); return; }

  const meta = metaFromEnv(config);
  const act = config.ad_account_id;
  const adsetId = config.adsets.buyers;
  if (!adsetId) fail("config adsets.buyers is empty");

  // 4. Buyers ad set: the experiment is meaningless against all of Switzerland.
  if (!skipAdset) {
    const a = await meta.get(adsetId, { fields: "name,status,daily_budget,optimization_goal,billing_event,destination_type,targeting" });
    const t = a.targeting || {};
    const want = [config.audiences.buyers_recent, config.audiences.buyers_lapsed].filter(Boolean);
    const have = (t.custom_audiences || []).map((c: any) => String(c.id));
    const advOn = t.targeting_automation?.advantage_audience === 1;
    const rampChf = config.budgets?.buyers?.ramp ?? 8;
    const needs = want.some((id) => !have.includes(id)) || advOn || a.optimization_goal !== "LINK_CLICKS" || a.destination_type !== "WEBSITE";
    log(`adset:     ${a.name} ${a.status} budget CHF ${minorToChf(a.daily_budget)}/day goal ${a.optimization_goal} destination ${a.destination_type} audiences [${have.join(",") || "none"}] advantage+ ${advOn ? "on" : "off"}`);
    if (needs) {
      const targeting = {
        geo_locations: { countries: ["CH"], location_types: ["home", "recent"] },
        age_min: t.age_min || 18, age_max: t.age_max || 65,
        custom_audiences: want.map((id) => ({ id })),
        targeting_automation: { advantage_audience: 0 },
      };
      log(`adset:     writing targeting = buyers lists (${want.join(", ")}), Advantage+ off, LINK_CLICKS to the website, budget CHF ${rampChf}/day (was CHF ${minorToChf(a.daily_budget)})`);
      // destination_type WEBSITE: the shell was created as a profile-visit set, and without this
      // Ads Manager counts Instagram profile visits as the result (seen 2026-09-14).
      await meta.post(adsetId, { targeting, optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS", destination_type: "WEBSITE", daily_budget: chfToMinor(rampChf) });
      const b = await meta.get(adsetId, { fields: "daily_budget,optimization_goal,destination_type,targeting" });
      log(`adset:     now budget CHF ${minorToChf(b.daily_budget)}/day goal ${b.optimization_goal} destination ${b.destination_type} audiences [${(b.targeting?.custom_audiences || []).map((c: any) => c.id).join(",")}] advantage+ ${b.targeting?.targeting_automation?.advantage_audience === 1 ? "on" : "off"}`);
    } else log(`adset:     already set up, left as is`);

    // Run window: the ad set stops at the configured hour on show day (lineup.ends_at, default
    // 18:00 Zürich). Setting end_time on a daily-budget ad set is enough; next week's run moves
    // it forward, which also wakes an ad set Meta marked completed.
    const endsAt = config.lineup?.ends_at || "18:00";
    const endIso = zurichIso(row.date, endsAt);
    const cur = await meta.get(adsetId, { fields: "end_time,effective_status" });
    if ((cur.end_time || "").replace(/\+0(\d)00$/, "+0$1:00") !== endIso) {
      await meta.post(adsetId, { end_time: endIso, status: "ACTIVE" });
      const after = await meta.get(adsetId, { fields: "end_time,effective_status" });
      log(`adset:     runs until ${after.end_time} (was ${cur.end_time || "open-ended"}), ${after.effective_status}`);
    } else log(`adset:     runs until ${cur.end_time}, ${cur.effective_status}`);
  }

  // 5. One lineup ad per ad set, updated in place. A multiple-text creative makes Meta treat
  // the ad set as dynamic creative, which allows exactly one ad (paused ones count), so the
  // weekly change is a new creative on the same ad, not a new ad. The ad is found by its
  // lineup- prefix; it is up to date when its name is this date's, unless --replace.
  const existing = await meta.getAll(`${adsetId}/ads`, { fields: "id,name,status,effective_status" });
  const lineupAds = existing.filter((x: any) => /^lineup-/.test(x.name));
  if (lineupAds.length > 1) warn(`${lineupAds.length} lineup- ads in the ad set; using the newest, delete the rest by hand in Ads Manager`);
  let ad = lineupAds.sort((a: any, b: any) => b.name.localeCompare(a.name))[0];
  const current = ad && ad.name === adName && !replace;
  if (ad) log(`ad:        ${ad.name} ${ad.status}/${ad.effective_status}${current ? " (already this date's copy)" : replace ? " (will get the new copy)" : " (last week's; will get this week's copy)"}`);

  // Image (cached by content hash; the flyer's random case number makes most renders new bytes).
  const png = readFileSync(files.post);
  const key = createHash("sha256").update(png).digest("hex").slice(0, 16);
  const cache = readCache();
  let hash = cache[key];
  if (current) log(`image:     ad is current, keeping its image`);
  else if (!hash) {
    const up = await meta.post(`${act}/adimages`, { bytes: png.toString("base64"), name: `${adName}-post-${key}.png` });
    hash = (Object.values(up.images || {})[0] as any)?.hash;
    if (!hash) fail(`image upload returned no hash: ${JSON.stringify(up).slice(0, 300)}`);
    cache[key] = hash;
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n");
    log(`image:     uploaded, hash ${hash}`);
  } else log(`image:     already uploaded, hash ${hash}`);

  // 6. The creative: Meta's multiple text options (asset_feed_spec: up to five bodies, titles
  // and descriptions on one image); Meta picks the pairing per person, the budget stays in one
  // ad. New creative when the ad is missing, from another week, or --replace.
  if (!current) {
    const spec = {
      name: `${adName} creative`,
      object_story_spec: { page_id: config.page_id, instagram_user_id: config.instagram_account_id || undefined },
      asset_feed_spec: {
        images: [{ hash }],
        bodies: copy.bodies.map((text) => ({ text })),
        titles: copy.titles.map((text) => ({ text })),
        descriptions: copy.descriptions.map((text) => ({ text })),
        link_urls: [{ website_url: link, display_url: "inyourfacecomedy.ch" }],
        call_to_action_types: ["BOOK_TRAVEL"],
        ad_formats: ["SINGLE_IMAGE"],
      },
    };
    let creative: any;
    try { creative = await meta.post(`${act}/adcreatives`, spec); }
    catch (e: any) {
      warn(`multiple-text creative refused: ${e.message}`);
      warn(`retrying with optimization_type DEGREES_OF_FREEDOM`);
      creative = await meta.post(`${act}/adcreatives`, { ...spec, asset_feed_spec: { ...spec.asset_feed_spec, optimization_type: "DEGREES_OF_FREEDOM" } });
    }
    log(`creative:  ${creative.id} (${copy.bodies.length} bodies, ${copy.titles.length} titles, ${copy.descriptions.length} descriptions)`);
    if (ad) {
      await meta.post(ad.id, { name: adName, creative: { creative_id: creative.id } });
      ad = await meta.get(ad.id, { fields: "id,name,status,effective_status" });
      log(`ad:        ${ad.id} now ${adName} with the new creative (${ad.status}/${ad.effective_status})`);
    } else {
      ad = await meta.post(`${act}/ads`, { name: adName, adset_id: adsetId, creative: { creative_id: creative.id }, status: "PAUSED" });
      ad = { ...ad, name: adName, status: "PAUSED", effective_status: "PAUSED" };
      log(`ad:        created ${ad.id} (${adName}, PAUSED)`);
    }
  }

  // 7. On if asked.
  if (activate) {
    await meta.post(ad.id, { status: "ACTIVE" });
    const a = await meta.get(ad.id, { fields: "status,effective_status" });
    log(`ad:        ${adName} ${a.status}/${a.effective_status}${a.effective_status === "PENDING_REVIEW" ? " (Meta reviews new ads; usually under a day)" : ""}`);
  } else if (ad.status === "ACTIVE") log(`ad:        ${adName} is already ACTIVE, left on`);
  else log(`ad:        left ${ad.status}; run with --activate to switch it on`);
  log(`done:      ${SITE}/reports/ will show clicks under utm_content=lineup-${ymd} from tomorrow`);
}

if (import.meta.main) {
  main().then(() => healthcheck("META_ADS_HEALTHCHECKS_URL", true)).catch(async (e) => {
    await healthcheck("META_ADS_HEALTHCHECKS_URL", false, String(e?.message || e));
    fail(e?.stack || String(e));
  });
}

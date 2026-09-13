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
//
// Steps: Grist row (date, show, link, style) -> calendar entry for time, venue, price ->
// names from _comedians/ in running order -> headless Brave opens the lineup link and calls
// window.__iyfDrawFlyer for post (1080x1350) and story (1080x1920) into script/meta-out/ ->
// upload the post image -> creative (page + Instagram) -> ad named lineup-<date> in Buyers,
// re-run finds it by name -> older lineup-* ads in Buyers paused -> Buyers ad set checked:
// buyer lists, Advantage+ off, link clicks, ramp budget (printed before writing).
// Cron (Mondays, Tuesday fallback, Friday pause): see script/README.md.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fail, flagBool, flagString, log, parseArgs, todayISO, warn } from "./lib/email/cli";
import { OUT_DIR, REPO_ROOT, chfToMinor, healthcheck, loadConfig, loadEnv, metaFromEnv, minorToChf, type MetaConfig } from "./lib/meta-api";
import { chromiumBinary } from "./lib/email/images";

const USAGE = `Usage: bun script/meta-lineup-ad.ts [options]

  --date YYYY-MM-DD   show date to build (default: the next Comedy Brew row on or after today)
  --activate          set the ad ACTIVE after creating or finding it (default: leave PAUSED)
  --skip-adset        do not touch the Buyers ad set (targeting, optimisation, budget)
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

export function goLink(show: string, date: string): string {
  const ymd = date.replace(/-/g, "");
  return `${SITE}/go/?show=${show}&date=${date}&utm_source=meta&utm_medium=paid_social&utm_campaign=${show}-${ymd}&utm_content=lineup-${ymd}`;
}

export interface AdCopy { message: string; headline: string; description: string }

export function adCopy(cal: CalendarEntry, names: string[], host: string): AdCopy {
  const when = `${longDate(cal.date)}, ${timeOf(cal.start)}`;
  const where = cal.location || cal.venue_name || "ROBIN's Coffee";
  const price = cal.price_chf ? `CHF ${cal.price_chf}` : "";
  const bill = names.map((n, i) => `${i + 1}. ${n}`).join("\n");
  const message = [
    `${cal.name}: ${when} at ${where}.${price ? ` ${price}.` : ""}`,
    host ? `Your host: ${host}.` : "",
    `On the bill, in running order:`,
    bill,
    `New lineup, new jokes. Same coffee.`,
  ].filter(Boolean).join("\n\n").replace("in running order:\n\n", "in running order:\n");
  return {
    message,
    headline: `${cal.name} lineup: ${shortDate(cal.date)}`,
    description: `English stand-up, ${timeOf(cal.start)} at ${where}${price ? `, ${price}` : ""}. Two minutes from Central.`,
  };
}

// ---------- render (headless Brave, Chrome DevTools Protocol) ----------

interface Cdp { send(method: string, params?: any): Promise<any>; on(method: string, fn: (p: any) => void): void; close(): void }

async function openBrowser(): Promise<{ cdp: Cdp; kill: () => void }> {
  const bin = chromiumBinary();
  if (!bin) throw new Error("no Brave or Chrome found for the flyer render");
  const profile = join(tmpdir(), `iyf-meta-lineup-${process.pid}`);
  const child = spawn(bin, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profile}`, "--remote-debugging-port=0", "--window-size=1200,900", "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });
  const wsUrl: string = await new Promise((res, rej) => {
    let buf = "";
    const t = setTimeout(() => rej(new Error("browser did not start (no DevTools line in 30 s)")), 30_000);
    child.stderr.on("data", (d) => { buf += d.toString(); const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) { clearTimeout(t); res(m[1]); } });
    child.on("exit", (c) => { clearTimeout(t); rej(new Error(`browser exited early (${c})`)); });
  });
  const port = new URL(wsUrl).port;
  // The first page target can appear a moment after the DevTools line; poll, then open one.
  let page: any;
  for (let i = 0; i < 20 && !page; i++) {
    const targets: any[] = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    page = targets.find((t) => t.type === "page");
    if (!page) await new Promise((r) => setTimeout(r, 250));
  }
  if (!page) page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  if (!page?.webSocketDebuggerUrl) throw new Error("no page target in headless browser");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = (e) => rej(new Error(`devtools socket: ${String(e)}`)); });
  let id = 0;
  const pending = new Map<number, { res: (v: any) => void; rej: (e: Error) => void }>();
  const listeners = new Map<string, ((p: any) => void)[]>();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id)!; pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    } else if (msg.method) for (const fn of listeners.get(msg.method) || []) fn(msg.params);
  };
  const cdp: Cdp = {
    send: (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); }),
    on: (method, fn) => { listeners.set(method, [...(listeners.get(method) || []), fn]); },
    close: () => { try { ws.close(); } catch {} },
  };
  return { cdp, kill: () => { cdp.close(); try { child.kill(); } catch {} } };
}

// Runs inside the page: rebuild the wizard state from the URL (same fields the page reads),
// wait for the draw hook, draw into an off-screen canvas, return a PNG data URL.
function drawExpression(format: string, style: string): string {
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
    return c.toDataURL("image/png");
  })()`;
}

export async function renderFlyers(link: string, style: string, outBase: string): Promise<{ post: string; story: string }> {
  mkdirSync(OUT_DIR, { recursive: true });
  const { cdp, kill } = await openBrowser();
  try {
    await cdp.send("Page.enable");
    const loaded = new Promise<void>((res) => cdp.on("Page.loadEventFired", () => res()));
    await cdp.send("Page.navigate", { url: link });
    await Promise.race([loaded, new Promise((_, rej) => setTimeout(() => rej(new Error("lineup page did not load in 30 s")), 30_000))]);
    const out: Record<string, string> = {};
    for (const format of ["post", "story"]) {
      const r = await cdp.send("Runtime.evaluate", { expression: drawExpression(format, style), awaitPromise: true, returnByValue: true, timeout: 60_000 });
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
  const copy = adCopy(cal, names, host);
  const link = goLink(row.show, row.date);
  log(`show:      ${cal.name}, ${longDate(cal.date)} ${timeOf(cal.start)}, ${cal.location || cal.venue_name}, CHF ${cal.price_chf ?? "?"}`);
  log(`host:      ${host || "(none set on the link)"}`);
  log(`order:     ${names.join(" | ")}`);
  log(`ad link:   ${link}`);
  log(`headline:  ${copy.headline}`);
  log(`text:\n${copy.message.split("\n").map((l) => "  | " + l).join("\n")}`);

  // 3. Render.
  const ymd = row.date.replace(/-/g, "");
  const adName = `lineup-${row.date}`;
  const files = await renderFlyers(row.link, style, join(OUT_DIR, `lineup-${row.date}`));
  for (const [k, f] of Object.entries(files)) { const s = pngSize(f); log(`render:    ${k} ${s.w}x${s.h} ${f}`); }

  if (dryRun) { log("[dry-run] no Meta writes; images are in script/meta-out/"); return; }

  const meta = metaFromEnv(config);
  const act = config.ad_account_id;
  const adsetId = config.adsets.buyers;
  if (!adsetId) fail("config adsets.buyers is empty");

  // 4. Buyers ad set: the experiment is meaningless against all of Switzerland.
  if (!skipAdset) {
    const a = await meta.get(adsetId, { fields: "name,status,daily_budget,optimization_goal,billing_event,targeting" });
    const t = a.targeting || {};
    const want = [config.audiences.buyers_recent, config.audiences.buyers_lapsed].filter(Boolean);
    const have = (t.custom_audiences || []).map((c: any) => String(c.id));
    const advOn = t.targeting_automation?.advantage_audience === 1;
    const rampChf = config.budgets?.buyers?.ramp ?? 8;
    const needs = want.some((id) => !have.includes(id)) || advOn || a.optimization_goal !== "LINK_CLICKS";
    log(`adset:     ${a.name} ${a.status} budget CHF ${minorToChf(a.daily_budget)}/day goal ${a.optimization_goal} audiences [${have.join(",") || "none"}] advantage+ ${advOn ? "on" : "off"}`);
    if (needs) {
      const targeting = {
        geo_locations: { countries: ["CH"], location_types: ["home", "recent"] },
        age_min: t.age_min || 18, age_max: t.age_max || 65,
        custom_audiences: want.map((id) => ({ id })),
        targeting_automation: { advantage_audience: 0 },
      };
      log(`adset:     writing targeting = buyers lists (${want.join(", ")}), Advantage+ off, LINK_CLICKS, budget CHF ${rampChf}/day (was CHF ${minorToChf(a.daily_budget)})`);
      await meta.post(adsetId, { targeting, optimization_goal: "LINK_CLICKS", billing_event: "IMPRESSIONS", daily_budget: chfToMinor(rampChf) });
      const b = await meta.get(adsetId, { fields: "daily_budget,optimization_goal,targeting" });
      log(`adset:     now budget CHF ${minorToChf(b.daily_budget)}/day goal ${b.optimization_goal} audiences [${(b.targeting?.custom_audiences || []).map((c: any) => c.id).join(",")}] advantage+ ${b.targeting?.targeting_automation?.advantage_audience === 1 ? "on" : "off"}`);
    } else log(`adset:     already set up, left as is`);
  }

  // 5. Image (cached by content hash so a re-run does not upload twice).
  const png = readFileSync(files.post);
  const key = createHash("sha256").update(png).digest("hex").slice(0, 16);
  const cache = readCache();
  let hash = cache[key];
  if (!hash) {
    const up = await meta.post(`${act}/adimages`, { bytes: png.toString("base64"), name: `${adName}-post-${key}.png` });
    hash = (Object.values(up.images || {})[0] as any)?.hash;
    if (!hash) fail(`image upload returned no hash: ${JSON.stringify(up).slice(0, 300)}`);
    cache[key] = hash;
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(CACHE, JSON.stringify(cache, null, 2) + "\n");
    log(`image:     uploaded, hash ${hash}`);
  } else log(`image:     already uploaded, hash ${hash}`);

  // 6. The ad: find by name, else create creative + ad.
  const existing = await meta.getAll(`${adsetId}/ads`, { fields: "id,name,status,effective_status" });
  let ad = existing.find((x: any) => x.name === adName);
  if (!ad) {
    const creative = await meta.post(`${act}/adcreatives`, {
      name: `${adName} creative`,
      object_story_spec: {
        page_id: config.page_id,
        instagram_user_id: config.instagram_account_id || undefined,
        link_data: {
          image_hash: hash, link, message: copy.message, name: copy.headline, description: copy.description,
          call_to_action: { type: "BUY_TICKETS", value: { link } },
        },
      },
    });
    log(`creative:  ${creative.id}`);
    ad = await meta.post(`${act}/ads`, { name: adName, adset_id: adsetId, creative: { creative_id: creative.id }, status: "PAUSED" });
    log(`ad:        created ${ad.id} (${adName}, PAUSED)`);
  } else log(`ad:        exists ${ad.id} (${adName}, ${ad.status}/${ad.effective_status})`);

  // 7. Older lineup ads off, this one on if asked.
  for (const other of existing.filter((x: any) => x.name.startsWith("lineup-") && x.name !== adName && x.status !== "PAUSED")) {
    await meta.post(other.id, { status: "PAUSED" });
    log(`ad:        paused ${other.name}`);
  }
  if (activate) {
    await meta.post(ad.id, { status: "ACTIVE" });
    const a = await meta.get(ad.id, { fields: "status,effective_status" });
    log(`ad:        ${adName} ${a.status}/${a.effective_status}${a.effective_status === "PENDING_REVIEW" ? " (Meta reviews new ads; usually under a day)" : ""}`);
  } else log(`ad:        left PAUSED; run with --activate to switch it on`);
  log(`done:      ${SITE}/reports/ will show clicks under utm_content=lineup-${ymd} from tomorrow`);
}

if (import.meta.main) {
  main().then(() => healthcheck("META_ADS_HEALTHCHECKS_URL", true)).catch(async (e) => {
    await healthcheck("META_ADS_HEALTHCHECKS_URL", false, String(e?.message || e));
    fail(e?.stack || String(e));
  });
}

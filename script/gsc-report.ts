#!/usr/bin/env bun
// The weekly Search Console learning loop (design and reading guide: seo/README.md).
// Each run takes a 28-day snapshot of query and page data, scores every page's
// opportunities against the site's own click curve, reads the experiments ledger to
// judge changes already made, writes the report, and commits the seo/ folder.
//
//   bun script/gsc-report.ts                        # snapshot (if none for today), report, commit + push seo/
//   bun script/gsc-report.ts --dry-run              # fetch and print, write nothing
//   bun script/gsc-report.ts --no-push              # write files, skip git
//   bun script/gsc-report.ts --backfill             # weekly snapshots back 16 months (no report, no git)
//   bun script/gsc-report.ts --log-change /comedybrew/ "open mic zürich, open mic zurich" "Title now opens with Open Mic Zürich"
//
// Auth: GA_REPORTS_CREDENTIALS in .env names the service-account key (repo-relative);
// the account is a Restricted user on the property named by GSC_SITE (default
// sc-domain:inyourfacecomedy.ch). Optional GSC_HEALTHCHECKS_URL gets the summary,
// or /fail with the error. Comedian pages are meta-only by design (seo/README.md).

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createSign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { SITE_URL, addDays, frontMatterOf, pageSource, shapePageTotals, shapeRow, type GscRow, type PageSource, type PageTotals } from "./lib/gsc-report-lib";
import {
  DISCOVERY_DAYS, MIN_ROW_IMPRESSIONS, WINDOW_DAYS, clickCurve, comedianTemplateBrief, experimentYaml, isBrandQuery, judge, loopSummary, metricsFor, movers,
  nextExperimentId, pageBriefs, renderReport, scopeOf, scoreOpportunities, trend, type Experiment, type ExperimentReading, type Names, type Snapshot,
} from "./lib/gsc-loop-lib";

const ROOT = resolve(import.meta.dir, "..");
const SEO_DIR = join(ROOT, "seo");
const SNAP_DIR = join(SEO_DIR, "snapshots");
const REPORT_DIR = join(SEO_DIR, "reports");
const LEDGER = join(SEO_DIR, "experiments.yml");
const BASELINES = join(SEO_DIR, "experiments-baselines.json");
const FINAL_LAG_DAYS = 3;
const HISTORY_DAYS = 16 * 30;   // what Search Console keeps

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(0);
}
const DRY = args.includes("--dry-run");
const NO_PUSH = args.includes("--no-push");
const BACKFILL = args.includes("--backfill");
const LOG_AT = args.indexOf("--log-change");

// ---------- .env (same convention as the other scripts) ----------
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const SITE = process.env.GSC_SITE || "sc-domain:inyourfacecomedy.ch";
const HC_URL = process.env.GSC_HEALTHCHECKS_URL || "";

// ---------- auth: service-account JWT, read-only scope ----------
async function accessToken(): Promise<string> {
  const keyFile = process.env.GA_REPORTS_CREDENTIALS;
  if (!keyFile) throw new Error("GA_REPORTS_CREDENTIALS is not set in .env (path to the service-account key)");
  const key = JSON.parse(readFileSync(resolve(ROOT, keyFile), "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json() as { access_token?: string };
  if (!j.access_token) throw new Error(`service-account token failed: ${JSON.stringify(j).slice(0, 200)}`);
  return j.access_token;
}

// ---------- Search Console ----------
const API = "https://www.googleapis.com/webmasters/v3";

async function query(token: string, body: Record<string, unknown>): Promise<any[]> {
  const rows: any[] = [];
  const PAGE = 25000;
  for (let startRow = 0; ; startRow += PAGE) {
    const r = await fetch(`${API}/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, rowLimit: PAGE, startRow, dataState: "final" }),
    });
    const j = await r.json() as { rows?: any[]; error?: { code: number; message: string } };
    if (!r.ok || j.error) {
      const msg = j.error?.message ?? `HTTP ${r.status}`;
      if (r.status === 403 && /not been used|disabled/i.test(msg)) throw new Error(`Search Console API is disabled on the service account's project: ${msg}`);
      if (r.status === 403) throw new Error(`no access to ${SITE}: add the service account as a user on the property in Search Console (Settings, Users and permissions). ${msg}`);
      throw new Error(`searchAnalytics.query failed: ${msg}`);
    }
    rows.push(...(j.rows ?? []));
    if ((j.rows?.length ?? 0) < PAGE) return rows;
  }
}

function windowFor(date: string): { startDate: string; endDate: string } {
  const endDate = addDays(date, -FINAL_LAG_DAYS);
  return { startDate: addDays(endDate, -(WINDOW_DAYS - 1)), endDate };
}

// Discovery: the longer window opportunities are scored on (fetched, not stored).
async function discovery(token: string, date: string): Promise<{ startDate: string; endDate: string; rows: GscRow[]; pages: PageTotals[] }> {
  const endDate = addDays(date, -FINAL_LAG_DAYS);
  const startDate = addDays(endDate, -(DISCOVERY_DAYS - 1));
  const [pairs, pages] = await Promise.all([
    query(token, { startDate, endDate, dimensions: ["query", "page"] }),
    query(token, { startDate, endDate, dimensions: ["page"] }),
  ]);
  return { startDate, endDate, rows: pairs.map(shapeRow).filter((r) => r.impressions >= MIN_ROW_IMPRESSIONS), pages: pages.map(shapePageTotals) };
}

async function takeSnapshot(token: string, date: string): Promise<Snapshot> {
  const { startDate, endDate } = windowFor(date);
  const [pairs, pages, devices] = await Promise.all([
    query(token, { startDate, endDate, dimensions: ["query", "page"] }),
    query(token, { startDate, endDate, dimensions: ["page"] }),
    query(token, { startDate, endDate, dimensions: ["device"] }),
  ]);
  return {
    date, startDate, endDate,
    rows: pairs.map(shapeRow).filter((r) => r.impressions >= MIN_ROW_IMPRESSIONS).sort((a, b) => b.impressions - a.impressions),
    pages: pages.map(shapePageTotals).sort((a, b) => b.impressions - a.impressions),
    devices: devices.map((d) => ({ device: d.keys[0], clicks: d.clicks, impressions: d.impressions, position: d.position })),
  };
}

// The 28 days before a change, for one page: fixed once, cached in seo/.
async function baselineFor(token: string, exp: Experiment): Promise<GscRow[]> {
  const endDate = addDays(exp.date, -1);
  const startDate = addDays(endDate, -(WINDOW_DAYS - 1));
  const rows = await query(token, {
    startDate, endDate, dimensions: ["query", "page"],
    dimensionFilterGroups: [{ filters: [{ dimension: "page", operator: "equals", expression: SITE_URL + exp.page }] }],
  });
  return rows.map(shapeRow);
}

// ---------- files ----------
function loadSnapshots(): Snapshot[] {
  if (!existsSync(SNAP_DIR)) return [];
  return readdirSync(SNAP_DIR).filter((f) => f.endsWith(".json")).sort()
    .map((f) => JSON.parse(readFileSync(join(SNAP_DIR, f), "utf8")) as Snapshot);
}

function loadExperiments(): Experiment[] {
  if (!existsSync(LEDGER)) return [];
  const doc = Bun.YAML.parse(readFileSync(LEDGER, "utf8")) as any;
  const list: any[] = Array.isArray(doc) ? doc : (doc?.experiments ?? []);
  return list.map((e) => ({
    id: String(e.id), date: String(e.date).slice(0, 10), page: String(e.page), change: String(e.change ?? ""),
    queries: Array.isArray(e.queries) ? e.queries.map(String) : String(e.queries ?? "").split(",").map((s: string) => s.trim()).filter(Boolean),
    status: e.status === "closed" ? "closed" : "open", verdict: e.verdict ? String(e.verdict) : undefined,
  }));
}

interface Sources { sources: Map<string, PageSource>; bodies: Map<string, string>; names: Names }

function stripMarkup(body: string): string {
  return body.replace(/<!--[\s\S]*?-->/g, " ").replace(/\{%[\s\S]*?%\}/g, " ").replace(/\{\{[\s\S]*?\}\}/g, " ")
    .replace(/<[^>]+>/g, " ").replace(/\]\([^)]*\)/g, "]").replace(/[#*_>`]/g, " ");
}

function loadSources(): Sources {
  const files: string[] = ["index.html"];
  for (const dir of ["_posts", "_comedians", "pages"]) {
    if (!existsSync(join(ROOT, dir))) continue;
    for (const f of readdirSync(join(ROOT, dir))) if (f.endsWith(".md")) files.push(`${dir}/${f}`);
  }
  const sources = new Map<string, PageSource>();
  const bodies = new Map<string, string>();
  const names: Names = { people: [], shows: [] };
  for (const file of files) {
    const text = readFileSync(join(ROOT, file), "utf8");
    const src = pageSource(file, text);
    if (!src) continue;
    sources.set(src.path, src);
    const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
    bodies.set(src.path, scopeOf(src.path) === "full" ? stripMarkup(body) : "");
    if (file.startsWith("_comedians/")) names.people.push(src.title);
    if (file.startsWith("_posts/")) {
      const short = src.title.split(/\s*[•|:]\s*|\s+-\s+/)[0];
      if (short && short.split(/\s+/).length <= 4) names.shows.push(short);
    }
  }
  return { sources, bodies, names };
}

// ---------- git ----------
function git(...a: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

function commitAndPush(date: string): string {
  let r = git("add", "-A", "seo");
  if (!r.ok) throw new Error(`git add failed: ${r.out}`);
  if (git("diff", "--quiet", "--staged").ok) return "no changes";
  r = git("commit", "-m", `chore: Search Console snapshot and report (${date})`);
  if (!r.ok) throw new Error(`git commit failed: ${r.out}`);
  r = git("push", "origin", "master");
  if (r.ok) return "pushed";
  if (/non-fast-forward|fetch first|rejected/i.test(r.out)) {
    r = git("pull", "--rebase", "origin", "master");
    if (!r.ok) throw new Error(`git pull --rebase failed: ${r.out}`);
    r = git("push", "origin", "master");
    if (!r.ok) throw new Error(`git push after rebase failed: ${r.out}`);
    return "pushed after rebase";
  }
  throw new Error(`git push failed: ${r.out}`);
}

async function ping(suffix: "" | "/start" | "/fail", body?: string): Promise<void> {
  if (!HC_URL || DRY) return;
  try { await fetch(HC_URL + suffix, { method: "POST", body }); } catch { /* best effort */ }
}

// ---------- modes ----------
function logChange(): void {
  const [page, queries, change] = args.slice(LOG_AT + 1, LOG_AT + 4);
  if (!page || !queries || !change) throw new Error('--log-change wants three arguments: <path> "<query, query>" "<what changed>"');
  if (!page.startsWith("/")) throw new Error(`page wants a site path like /comedybrew/ (got ${page})`);
  const today = new Date().toISOString().slice(0, 10);
  const existing = loadExperiments();
  const exp: Experiment = { id: nextExperimentId(existing, today), date: today, page, queries: queries.split(",").map((s) => s.trim()).filter(Boolean), change, status: "open" };
  const block = experimentYaml(exp);
  if (DRY) { console.log("dry run, would append to seo/experiments.yml:\n" + block); return; }
  mkdirSync(SEO_DIR, { recursive: true });
  if (!existsSync(LEDGER)) writeFileSync(LEDGER, "# The experiments ledger: one entry per page change made for search. Read seo/README.md.\n# The weekly report judges each open entry after 28 days of final data. Close it by hand\n# (status: closed, verdict: ...) once the reading is in.\n");
  appendFileSync(LEDGER, block);
  console.log(`logged ${exp.id} in seo/experiments.yml:\n${block}Commit it with your page change so the date and the edit travel together.`);
}

async function backfill(token: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const oldest = addDays(today, -HISTORY_DAYS);
  const have = new Set(loadSnapshots().map((s) => s.date));
  let taken = 0, skipped = 0;
  for (let k = 1; ; k++) {
    const date = addDays(today, -7 * k);
    const { startDate } = windowFor(date);
    if (startDate < oldest) break;
    if (have.has(date)) { skipped++; continue; }
    const snap = await takeSnapshot(token, date);
    if (!DRY) { mkdirSync(SNAP_DIR, { recursive: true }); writeFileSync(join(SNAP_DIR, `${date}.json`), JSON.stringify(snap) + "\n"); }
    taken++;
    console.log(`  ${date}: ${snap.rows.length} pairs, ${snap.pages.length} pages, ${snap.pages.reduce((n, p) => n + p.clicks, 0)} clicks`);
  }
  console.log(`backfill ${DRY ? "(dry run) " : ""}done: ${taken} snapshots taken, ${skipped} already present`);
}

async function weekly(token: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  let snaps = loadSnapshots();
  let current = snaps.find((s) => s.date === today);
  if (!current) {
    current = await takeSnapshot(token, today);
    if (!DRY) { mkdirSync(SNAP_DIR, { recursive: true }); writeFileSync(join(SNAP_DIR, `${today}.json`), JSON.stringify(current) + "\n"); }
    snaps = [...snaps.filter((s) => s.date < today), current];
  }
  const previous = [...snaps].filter((s) => s.date < today).pop();
  const disc = await discovery(token, today);
  const { sources, bodies, names } = loadSources();
  const curve = clickCurve(disc.rows, isBrandQuery);
  const opps = scoreOpportunities({ rows: disc.rows, curve, sources, bodies, names });
  const briefs = pageBriefs(opps, disc.pages, sources);

  // Experiments: baseline fetched once and cached, latest from this snapshot.
  const experiments = loadExperiments();
  const baselines: Record<string, GscRow[]> = existsSync(BASELINES) ? JSON.parse(readFileSync(BASELINES, "utf8")) : {};
  const readings: ExperimentReading[] = [];
  let baselinesChanged = false;
  for (const exp of experiments) {
    if (!baselines[exp.id]) { baselines[exp.id] = await baselineFor(token, exp); baselinesChanged = true; }
    readings.push(judge(exp, metricsFor(baselines[exp.id], exp.page, exp.queries), metricsFor(current.rows, exp.page, exp.queries), current.endDate));
  }

  const generatedAt = new Date().toISOString();
  const md = renderReport({ snapshot: current, discovery: { startDate: disc.startDate, endDate: disc.endDate, rows: disc.rows.length }, curve, briefs, comedians: comedianTemplateBrief(briefs), readings, trend: trend(snaps), movers: movers(previous, current), generatedAt });
  const lines = loopSummary(briefs, readings);
  console.log(`Search Console ${DRY ? "(dry run) " : ""}${SITE}: snapshot ${current.startDate} to ${current.endDate} (${current.rows.length} pairs), discovery ${disc.startDate} to ${disc.endDate} (${disc.rows.length} pairs over ${disc.pages.length} pages), ${opps.length} opportunities on ${briefs.length} pages, ${readings.length} experiment(s), ${snaps.length} snapshot(s)`);
  for (const l of lines) console.log("  " + l);
  if (DRY) { console.log("dry run: nothing written"); return; }

  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(join(REPORT_DIR, `${today}.md`), md);
  writeFileSync(join(SEO_DIR, "latest.md"), md);
  if (baselinesChanged) writeFileSync(BASELINES, JSON.stringify(baselines) + "\n");
  console.log(`wrote seo/reports/${today}.md and seo/latest.md`);
  if (NO_PUSH) { console.log("files written, --no-push: skipping git"); return; }
  console.log("git: " + commitAndPush(today));
  await ping("", `${opps.length} opportunities on ${briefs.length} pages\n${lines.join("\n")}`);
}

async function main(): Promise<void> {
  if (LOG_AT >= 0) { logChange(); return; }
  await ping("/start");
  const token = await accessToken();
  if (BACKFILL) { await backfill(token); return; }
  await weekly(token);
}

main().catch(async (err) => {
  console.error("gsc-report failed:", err.message);
  await ping("/fail", String(err.message).slice(0, 2000));
  process.exit(1);
});

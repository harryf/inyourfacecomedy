#!/usr/bin/env bun
// Search Console worksheet: which queries show a page of ours just off page one,
// and what that page currently says. Reads the Search Console API with the same
// service account as ga-report.ts (Restricted user on the property), writes a
// Markdown worksheet plus the raw rows into gitignored script/gsc-out/, and prints
// the top pages. Never touches git. See docs/scripts.md, "gsc-report.ts".
//
//   bun script/gsc-report.ts                       # last 90 final days, position 11-20, 10+ impressions
//   bun script/gsc-report.ts --dry-run             # fetch and print, write nothing
//   bun script/gsc-report.ts --band 8-11 --min-impressions 30
//   bun script/gsc-report.ts --days 28 --page /comedybrew/
//   bun script/gsc-report.ts --country che         # one country (ISO 3166-1 alpha-3)
//
// Auth: GA_REPORTS_CREDENTIALS in .env names the service-account key (repo-relative).
// The account must be a user (Restricted is enough) on the Search Console property
// named by GSC_SITE (default sc-domain:inyourfacecomedy.ch). Optional
// GSC_HEALTHCHECKS_URL gets a ping with the summary, or /fail with the error.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createSign } from "node:crypto";
import {
  DEFAULT_BAND, SITE_URL, groupByPage, pageSource, parseBand, reportWindow, shapePageTotals, shapeRow, summaryLines, worksheet,
  type GscRow, type PageSource, type PageTotals,
} from "./lib/gsc-report-lib";

const ROOT = resolve(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "script", "gsc-out");
const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(0);
}
const DRY = args.includes("--dry-run");
const DAYS = Number(flag("--days") ?? 90);
const MIN_IMP = Number(flag("--min-impressions") ?? DEFAULT_BAND.minImpressions);
const BAND = parseBand(flag("--band") ?? `${DEFAULT_BAND.minPosition}-${DEFAULT_BAND.maxPosition}`, MIN_IMP);
const ONLY_PAGE = flag("--page");
const COUNTRY = flag("--country");
if (!Number.isFinite(DAYS) || DAYS < 1 || DAYS > 480) throw new Error("--days wants 1 to 480 (Search Console keeps 16 months)");
if (!Number.isFinite(MIN_IMP) || MIN_IMP < 0) throw new Error("--min-impressions wants a number");

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

function filters(): Record<string, unknown> {
  const groups: any[] = [];
  const f: any[] = [];
  if (ONLY_PAGE) f.push({ dimension: "page", operator: "equals", expression: SITE_URL + ONLY_PAGE });
  if (COUNTRY) f.push({ dimension: "country", operator: "equals", expression: COUNTRY });
  if (f.length) groups.push({ filters: f });
  return groups.length ? { dimensionFilterGroups: groups } : {};
}

// ---------- Jekyll sources ----------
function loadSources(): Map<string, PageSource> {
  const files: string[] = ["index.html"];
  for (const dir of ["_posts", "_comedians", "pages"]) {
    if (!existsSync(join(ROOT, dir))) continue;
    for (const f of readdirSync(join(ROOT, dir))) if (f.endsWith(".md")) files.push(`${dir}/${f}`);
  }
  const map = new Map<string, PageSource>();
  for (const file of files) {
    const src = pageSource(file, readFileSync(join(ROOT, file), "utf8"));
    if (src) map.set(src.path, src);
  }
  return map;
}

async function ping(suffix: "" | "/start" | "/fail", body?: string): Promise<void> {
  if (!HC_URL || DRY) return;
  try { await fetch(HC_URL + suffix, { method: "POST", body }); } catch { /* best effort */ }
}

// ---------- main ----------
async function main(): Promise<void> {
  await ping("/start");
  const today = new Date().toISOString().slice(0, 10);
  const { startDate, endDate } = reportWindow(today, DAYS);
  const token = await accessToken();
  const [pairRows, pageRows] = await Promise.all([
    query(token, { startDate, endDate, dimensions: ["query", "page"], ...filters() }),
    query(token, { startDate, endDate, dimensions: ["page"], ...filters() }),
  ]);
  const rows: GscRow[] = pairRows.map(shapeRow);
  const totals: PageTotals[] = pageRows.map(shapePageTotals);
  const groups = groupByPage(rows, BAND, totals, loadSources());
  const generatedAt = new Date().toISOString();
  const md = worksheet(groups, { startDate, endDate, band: BAND, site: SITE, generatedAt, totalRows: rows.length });
  const lines = summaryLines(groups);

  console.log(`Search Console ${DRY ? "(dry run) " : ""}${SITE}, ${startDate} to ${endDate}: ${rows.length} query/page pairs, ${groups.length} pages with queries at position ${BAND.minPosition}-${BAND.maxPosition} (${BAND.minImpressions}+ impressions)`);
  for (const l of lines) console.log("  " + l);
  if (groups.length > lines.length) console.log(`  ... ${groups.length - lines.length} more pages in the worksheet`);
  if (DRY) { console.log("dry run: nothing written"); return; }

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = `${today}-pos${BAND.minPosition}-${BAND.maxPosition}${ONLY_PAGE ? "-" + ONLY_PAGE.replace(/\W+/g, "_").replace(/^_|_$/g, "") : ""}${COUNTRY ? "-" + COUNTRY : ""}`;
  writeFileSync(join(OUT_DIR, `${stamp}.md`), md);
  writeFileSync(join(OUT_DIR, `${stamp}.json`), JSON.stringify({ site: SITE, startDate, endDate, generatedAt, band: BAND, rows, totals }, null, 1) + "\n");
  writeFileSync(join(OUT_DIR, "latest.md"), md);
  console.log(`wrote script/gsc-out/${stamp}.md (+ .json) and script/gsc-out/latest.md`);
  await ping("", `${groups.length} pages in band ${BAND.minPosition}-${BAND.maxPosition}\n${lines.join("\n")}`);
}

main().catch(async (err) => {
  console.error("gsc-report failed:", err.message);
  await ping("/fail", String(err.message).slice(0, 2000));
  process.exit(1);
});

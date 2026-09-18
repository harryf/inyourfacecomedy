#!/usr/bin/env bun
// After a page changes: make the sitemap tell the truth, tell IndexNow, and read
// back what Google knows. Design and the Google caveats: docs/search-console.md,
// "Re-indexing after a change".
//
//   bun script/reindex.ts                      # pages changed since the last run: bump stamps, commit, push, wait for the deploy, IndexNow, inspect
//   bun script/reindex.ts --since HEAD~3       # explicit git range (first run, or a check)
//   bun script/reindex.ts --urls /comedybrew/,/calendar/   # these pages, no git diff
//   bun script/reindex.ts --all                # every sitemap URL to IndexNow (after a layout or include change); no stamp bumps
//   bun script/reindex.ts --dry-run            # show what would happen, write nothing, ping nothing
//   bun script/reindex.ts --no-push            # bump stamps and commit, skip push, deploy wait and pings
//   bun script/reindex.ts --no-inspect         # skip the Google URL Inspection read
//
// What it does, in order:
//   1. Finds page sources changed since the commit recorded in script/reindex-out/state.json
//      (index.html, _posts, _comedians, pages) and maps them to URLs the live sitemap lists.
//   2. Bumps `last_modified_at` on those whose stamp is older than their last commit by more
//      than ten minutes (hand edits; the generated pages stamp themselves), commits, pushes.
//      jekyll-sitemap writes that stamp as <lastmod>, which is the one signal Google reads.
//   3. Waits until the live sitemap shows the new stamps (the deploy landed), then POSTs the
//      URLs to IndexNow (Bing, Yandex, Seznam, Naver; Google does not consume it).
//   4. Reads Google's URL Inspection for each URL (read-only: verdict, coverage, last crawl).
//      Google has no request-indexing API for ordinary pages (the Indexing API is for job
//      postings and live broadcasts only), so this is feedback, not a trigger.
// Never raises on a failed ping; prints and continues. Exit 1 only on git failures.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createSign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { SITE_URL } from "./lib/gsc-report-lib";
import { bumpFrontMatter, changedPages, indexNowBody, inspectionLines, needsBump, parseSitemap, shapeInspection, templateChanged, type Inspection } from "./lib/reindex-lib";

const ROOT = resolve(import.meta.dir, "..");
const OUT_DIR = join(ROOT, "script", "reindex-out");
const STATE = join(OUT_DIR, "state.json");
const GSC_SITE = process.env.GSC_SITE || "sc-domain:inyourfacecomedy.ch";
const DEPLOY_WAIT_MS = 6 * 60 * 1000;
const INSPECT_MAX = 30;

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(import.meta.path, "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3)).join("\n"));
  process.exit(0);
}
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry-run");
const NO_PUSH = args.includes("--no-push");
const ALL = args.includes("--all");
const NO_INSPECT = args.includes("--no-inspect");
const SINCE = flag("--since");
const URLS = flag("--urls");

// ---------- .env ----------
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---------- git ----------
function git(...a: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: ((r.stdout || "") + (r.stderr || "")).trim() };
}
function mustGit(...a: string[]): string { const r = git(...a); if (!r.ok) throw new Error(`git ${a[0]} failed: ${r.out}`); return r.out; }

// ---------- state ----------
interface State { lastCommit?: string; runs: { at: string; urls: string[]; indexnow: string; bumped: string[] }[] }
const state: State = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { runs: [] };

// ---------- sitemap ----------
async function liveSitemap(): Promise<Map<string, string>> {
  try {
    const r = await fetch(`${SITE_URL}/sitemap.xml`, { headers: { "cache-control": "no-cache" } });
    if (r.ok) return parseSitemap(await r.text());
    console.log(`live sitemap HTTP ${r.status}, using the local build`);
  } catch (e: any) { console.log(`live sitemap unreachable (${e.message}), using the local build`); }
  const local = join(ROOT, "_site", "sitemap.xml");
  if (!existsSync(local)) throw new Error("no sitemap: live fetch failed and _site/sitemap.xml is missing (run jekyll build)");
  return parseSitemap(readFileSync(local, "utf8"));
}

// ---------- IndexNow ----------
function indexNowKey(): string {
  const f = readdirSync(ROOT).find((n) => /^[0-9a-f]{32}\.txt$/.test(n));
  if (!f) throw new Error("no IndexNow key file (32 hex chars .txt) at the repo root");
  return f.replace(/\.txt$/, "");
}

async function pingIndexNow(urls: string[]): Promise<string> {
  const body = indexNowBody(urls, indexNowKey());
  if (DRY) { console.log(`dry run: would POST ${body.urlList.length} url(s) to IndexNow`); return "dry-run"; }
  try {
    const r = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    const note = r.status === 200 ? "ok" : r.status === 202 ? "accepted (key check pending)" : r.status === 422 ? "rejected: url not on this host" : r.status === 429 ? "too many requests" : `HTTP ${r.status}`;
    console.log(`indexnow: ${body.urlList.length} url(s), HTTP ${r.status} ${note}`);
    return `HTTP ${r.status}`;
  } catch (e: any) { console.log(`indexnow: failed (${e.message}), continuing`); return `failed: ${e.message}`; }
}

// ---------- Google (read-only) ----------
async function googleToken(): Promise<string | undefined> {
  const keyFile = process.env.GA_REPORTS_CREDENTIALS;
  if (!keyFile) return undefined;
  const key = JSON.parse(readFileSync(resolve(ROOT, keyFile), "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
  const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }) });
  const j = await r.json() as { access_token?: string };
  return j.access_token;
}

async function inspect(urls: string[]): Promise<Inspection[]> {
  const token = await googleToken();
  if (!token) { console.log("google: GA_REPORTS_CREDENTIALS not set, skipping URL inspection"); return []; }
  const out: Inspection[] = [];
  for (const url of urls.slice(0, INSPECT_MAX)) {
    try {
      const r = await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: GSC_SITE }),
      });
      const j = await r.json() as any;
      if (j.error) { out.push({ url, verdict: "ERROR", coverage: String(j.error.message).slice(0, 80), lastCrawl: "", indexing: "" }); continue; }
      out.push(shapeInspection(url, j));
    } catch (e: any) { out.push({ url, verdict: "ERROR", coverage: e.message, lastCrawl: "", indexing: "" }); }
  }
  if (urls.length > INSPECT_MAX) console.log(`google: inspected the first ${INSPECT_MAX} of ${urls.length} urls (daily quota)`);
  return out;
}

// ---------- deploy wait ----------
async function waitForDeploy(expected: Map<string, string>): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < DEPLOY_WAIT_MS) {
    const live = await liveSitemap();
    const pending = [...expected].filter(([url, stamp]) => Date.parse(live.get(url) ?? "") < Date.parse(stamp) - 1000);
    if (!pending.length) return true;
    process.stdout.write(`waiting for the deploy: ${pending.length} page(s) still carry the old stamp...\r`);
    await Bun.sleep(15000);
  }
  console.log("\ndeploy wait timed out after 6 minutes; pinging anyway (IndexNow will fetch whatever is live)");
  return false;
}

// ---------- main ----------
async function main(): Promise<void> {
  const sitemap = await liveSitemap();
  console.log(`sitemap: ${sitemap.size} urls`);
  const head = mustGit("rev-parse", "HEAD");
  let urls: string[] = [];
  let bumped: string[] = [];
  const expected = new Map<string, string>();

  if (ALL) {
    urls = [...sitemap.keys()];
  } else if (URLS) {
    urls = URLS.split(",").map((s) => s.trim()).filter(Boolean).map((p) => (p.startsWith("http") ? p : SITE_URL + (p.startsWith("/") ? p : "/" + p)));
    const missing = urls.filter((u) => !sitemap.has(u));
    if (missing.length) console.log(`not in the sitemap, skipped: ${missing.join(", ")}`);
    urls = urls.filter((u) => sitemap.has(u));
  } else {
    const since = SINCE ?? state.lastCommit;
    if (!since) throw new Error("first run: pass --since <git ref> (for example --since HEAD~5) so the range is explicit; later runs remember the last commit");
    const files = mustGit("diff", "--name-only", `${since}..HEAD`).split("\n").filter(Boolean);
    const templates = templateChanged(files);
    if (templates.length) console.log(`templates changed too (${templates.slice(0, 4).join(", ")}${templates.length > 4 ? ", ..." : ""}): every page rendered anew; run with --all to tell IndexNow about all of them`);
    const pages = changedPages(files, (f) => (existsSync(join(ROOT, f)) ? readFileSync(join(ROOT, f), "utf8") : undefined), sitemap);
    console.log(`changed pages since ${since.slice(0, 12)}: ${pages.length}`);
    for (const p of pages) {
      const text = readFileSync(join(ROOT, p.file), "utf8");
      const stamp = text.match(/^last_modified_at:\s*["']?([^"'\n]+)/m)?.[1];
      const lastCommitIso = mustGit("log", "-1", "--format=%cI", "--", p.file);
      if (needsBump(stamp, lastCommitIso)) {
        const iso = new Date().toISOString();
        if (!DRY) writeFileSync(join(ROOT, p.file), bumpFrontMatter(text, iso));
        bumped.push(p.file);
        expected.set(p.url, iso);
        console.log(`  bump ${p.file}: last_modified_at ${stamp ?? "(none)"} -> ${iso.slice(0, 19)} (last commit ${lastCommitIso.slice(0, 16)})`);
      } else console.log(`  ok   ${p.file}: stamp current`);
      urls.push(p.url);
    }
    if (bumped.length && !DRY) {
      mustGit("add", "--", ...bumped);
      mustGit("commit", "-m", `chore: bump last_modified_at on ${bumped.length} changed page(s) so the sitemap lastmod is true (reindex)`);
      if (NO_PUSH) console.log("committed the stamps, --no-push: skipping push, deploy wait and pings");
      else {
        let r = git("push", "origin", "master");
        if (!r.ok && /non-fast-forward|fetch first|rejected/i.test(r.out)) { mustGit("pull", "--rebase", "origin", "master"); r = git("push", "origin", "master"); }
        if (!r.ok) throw new Error(`git push failed: ${r.out}`);
        console.log("pushed the stamp bump; Netlify rebuilds the sitemap");
      }
    }
  }

  if (!urls.length) { console.log("nothing to submit"); return; }
  console.log(`urls (${urls.length}):`); for (const u of urls.slice(0, 40)) console.log("  " + u.replace(SITE_URL, ""));
  if (urls.length > 40) console.log(`  ... ${urls.length - 40} more`);
  if (NO_PUSH && bumped.length) return;

  if (expected.size && !DRY) await waitForDeploy(expected);
  const indexnow = await pingIndexNow(urls);
  let inspections: Inspection[] = [];
  if (!NO_INSPECT && !DRY) {
    inspections = await inspect(urls);
    if (inspections.length) { console.log("google url inspection (read-only):"); for (const l of inspectionLines(inspections)) console.log("  " + l); }
  }
  if (!DRY) {
    mkdirSync(OUT_DIR, { recursive: true });
    state.lastCommit = mustGit("rev-parse", "HEAD");
    state.runs.push({ at: new Date().toISOString(), urls, indexnow, bumped });
    state.runs = state.runs.slice(-200);
    writeFileSync(STATE, JSON.stringify(state, null, 1) + "\n");
    console.log(`state: last commit ${state.lastCommit.slice(0, 12)} recorded in script/reindex-out/state.json`);
  }
}

main().catch((err) => { console.error("reindex failed:", err.message); process.exit(1); });

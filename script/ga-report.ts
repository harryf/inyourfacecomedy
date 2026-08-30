#!/usr/bin/env bun
// Daily per-show traffic reports from Google Analytics 4 → /reports/<slug>/.
// See CAMPAIGN_LINKS.md, "Show reports".
//
//   bun script/ga-report.ts               # fetch, write data/CSV/pages, commit, push
//   bun script/ga-report.ts --dry-run     # fetch + print summary, write nothing
//   bun script/ga-report.ts --no-push     # write files, skip git
//   bun script/ga-report.ts --show comedybrew
//
// Reads GA with either a service-account key (GA_REPORTS_CREDENTIALS=path, the
// cron path: never expires) or gcloud Application Default Credentials (the
// "I just logged in" path). Writes:
//   _data/reports/<slug>.json   aggregates the report layout renders
//   assets/reports/<slug>.csv   per-minute click rows for reconciliation
//   pages/reports/<slug>.md     stub page (layout: report)
// then stages exactly those paths by name, commits, and pushes (the site rebuilds
// on push, like refresh-next-event-dates.rb). Pings GA_REPORTS_HEALTHCHECKS_URL
// if set. The OAuth client file and any key file stay gitignored.

import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createSign } from "node:crypto";
import {
  addDays, aggregate, frontMatterOf, gaDate, gaDateTime, parseShow, reportPage, toCsv,
  type ClickRow, type PageRow, type Show,
} from "./lib/ga-report-lib";

const ROOT = resolve(import.meta.dir, "..");
const PROPERTY = "properties/336856557";
const LAUNCH_DATE = "2026-08-26";   // day the /go/ links and ticket_click went live
const DATA_DIR = join(ROOT, "_data", "reports");
const CSV_DIR = join(ROOT, "assets", "reports");
const PAGE_DIR = join(ROOT, "pages", "reports");
// Site origin for full page URLs in the CSV, from _config.yml `url:`.
const SITE_URL = (readFileSync(join(ROOT, "_config.yml"), "utf8").match(/^url:\s*"?([^"\n]+)"?/m)?.[1] ?? "https://inyourfacecomedy.ch").trim();

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const NO_PUSH = args.includes("--no-push");
const ONLY = args.includes("--show") ? args[args.indexOf("--show") + 1] : undefined;

// ---------- .env (same convention as the Ruby scripts) ----------
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const HC_URL = process.env.GA_REPORTS_HEALTHCHECKS_URL || "";

// ---------- auth ----------
async function accessToken(): Promise<string> {
  const keyFile = process.env.GA_REPORTS_CREDENTIALS;
  if (keyFile) {
    const key = JSON.parse(readFileSync(resolve(ROOT, keyFile), "utf8"));
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
      iss: key.client_email, scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    })}`;
    const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error(`service-account token failed: ${JSON.stringify(j).slice(0, 200)}`);
    return j.access_token;
  }
  const adcPath = join(homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (!existsSync(adcPath)) throw new Error("no credentials: set GA_REPORTS_CREDENTIALS or run gcloud auth application-default login");
  const adc = JSON.parse(readFileSync(adcPath, "utf8"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`ADC token failed (${j.error}): re-run gcloud auth application-default login`);
  return j.access_token;
}

// ---------- GA Data API ----------
type GaRow = { dimensionValues: { value: string }[]; metricValues: { value: string }[] };

async function runReport(token: string, body: Record<string, unknown>): Promise<GaRow[]> {
  const rows: GaRow[] = [];
  const limit = 10000;
  for (let offset = 0; ; offset += limit) {
    const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/${PROPERTY}:runReport`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, limit, offset }),
    });
    const j = await r.json();
    if (j.error) throw new Error(`GA ${j.error.code}: ${j.error.message}`);
    rows.push(...(j.rows ?? []));
    if (rows.length >= Number(j.rowCount ?? 0) || !(j.rows?.length)) break;
  }
  return rows;
}

const range = { startDate: LAUNCH_DATE, endDate: "today" };
const eq = (fieldName: string, value: string) => ({ filter: { fieldName, stringFilter: { matchType: "EXACT", value } } });

async function fetchClicks(token: string, slug: string): Promise<ClickRow[]> {
  const rows = await runReport(token, {
    dateRanges: [range],
    // `customEvent:link` is the clicked link's own utm tags ("source|medium|campaign|content"),
    // sent by /go/ and registered 2026-08-30; "(not set)" before that. The session* dimensions
    // are the fallback for site buttons and for redirects older than that (see attribute()).
    dimensions: ["dateHourMinute", "eventName", "sessionSource", "sessionMedium", "sessionCampaignName", "sessionManualAdContent", "pagePathPlusQueryString", "customEvent:link"].map((name) => ({ name })),
    metrics: [{ name: "eventCount" }],
    // The `show` custom dimension only exists from 2026-08-27; before that (and for
    // any event that arrives without it) fall back to what the URLs guarantee:
    // /go/ carries `show=<slug>` in its query string (this also catches ad clicks
    // that arrive with no UTM tags at all, e.g. Meta's bare `?show=x&fbclid=...`),
    // and on-site clicks on the show page itself carry its path. Home/calendar
    // clicks before the dimension existed are the one thing this cannot recover.
    dimensionFilter: { orGroup: { expressions: [
      { andGroup: { expressions: [
        { filter: { fieldName: "eventName", inListFilter: { values: ["ticket_redirect", "ticket_click"] } } },
        eq("customEvent:show", slug),
      ] } },
      { andGroup: { expressions: [
        eq("eventName", "ticket_redirect"),
        // FULL_REGEXP on purpose: GA's RE2 flavour silently matches nothing for a
        // `(^|[?&])` group inside a PARTIAL_REGEXP (probed 2026-08-27).
        { filter: { fieldName: "pagePathPlusQueryString", stringFilter: { matchType: "FULL_REGEXP", value: `/go/\\?(.*&)?show=${slug}(&.*)?` } } },
      ] } },
      // Filter on pagePathPlusQueryString rather than pagePath: GA counts every distinct
      // dimension in filters toward the 9-per-request cap, and adding `link` used the last slot.
      { andGroup: { expressions: [
        eq("eventName", "ticket_click"),
        { filter: { fieldName: "pagePathPlusQueryString", stringFilter: { matchType: "FULL_REGEXP", value: `/${slug}/(\\?.*)?` } } },
      ] } },
    ] } },
  });
  return rows.map((r) => {
    const [dhm, event, source, medium, campaign, content, pageQ, link] = r.dimensionValues.map((v) => v.value);
    const q = pageQ.indexOf("?");
    return {
      datetime: gaDateTime(dhm), date: gaDate(dhm), event: event as ClickRow["event"], source, medium, campaign, content, link,
      page: q >= 0 ? pageQ.slice(0, q) : pageQ, query: q >= 0 ? pageQ.slice(q + 1) : "", count: Number(r.metricValues[0].value),
    };
  });
}

// Show-page visits reach back further than the click events: GA has always had
// page_view for the show page, so the runner gets a 30-day baseline of interest
// in the show even though ticket clicks only exist from LAUNCH_DATE.
async function fetchPages(token: string, slug: string, startDate: string): Promise<PageRow[]> {
  const rows = await runReport(token, {
    dateRanges: [{ startDate, endDate: "today" }],
    dimensions: ["date", "sessionSource", "sessionMedium", "sessionCampaignName"].map((name) => ({ name })),
    metrics: [{ name: "sessions" }, { name: "screenPageViews" }],
    dimensionFilter: eq("pagePath", `/${slug}/`),
  });
  return rows.map((r) => {
    const [d, source, medium, campaign] = r.dimensionValues.map((v) => v.value);
    return { date: gaDate(d), source, medium, campaign, sessions: Number(r.metricValues[0].value), views: Number(r.metricValues[1].value) };
  });
}

async function fetchBroken(token: string, slug: string): Promise<number> {
  const rows = await runReport(token, {
    dateRanges: [range],
    dimensions: [{ name: "pagePathPlusQueryString" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: { filter: { fieldName: "pagePathPlusQueryString", stringFilter: { matchType: "CONTAINS", value: `from=go&show=${slug}` } } },
  });
  return rows.reduce((n, r) => n + Number(r.metricValues[0].value), 0);
}

// Every 404 view carrying from=go, whatever the slug (a typo'd slug never matches
// a show, so the per-show count alone would miss exactly the links most likely to
// be broken). Compared against the previous run in _data/reports/_meta.json.
async function fetchBrokenAll(token: string): Promise<number> {
  const rows = await runReport(token, {
    dateRanges: [range],
    dimensions: [{ name: "pagePathPlusQueryString" }],
    metrics: [{ name: "screenPageViews" }],
    dimensionFilter: { filter: { fieldName: "pagePathPlusQueryString", stringFilter: { matchType: "CONTAINS", value: "from=go" } } },
  });
  return rows.reduce((n, r) => n + Number(r.metricValues[0].value), 0);
}

async function propertyToday(token: string): Promise<string> {
  // The property's timezone decides what "today" means for GA dates.
  const r = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${PROPERTY}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  const tz = j.timeZone || "Europe/Zurich";
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// ---------- shows ----------
function loadShows(): Show[] {
  const dir = join(ROOT, "_posts");
  return readdirSync(dir).filter((f) => f.endsWith(".md"))
    .map((f) => parseShow(frontMatterOf(readFileSync(join(dir, f), "utf8"))))
    .filter((s): s is Show => !!s)
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

// ---------- git ----------
function git(...a: string[]): { ok: boolean; out: string } {
  const r = spawnSync("git", a, { cwd: ROOT, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

function commitAndPush(): string {
  let r = git("add", "-A", "_data/reports", "assets/reports", "pages/reports");
  if (!r.ok) throw new Error(`git add failed: ${r.out}`);
  if (git("diff", "--quiet", "--staged").ok) return "no changes";
  r = git("commit", "-m", "chore: refresh show traffic reports from GA");
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

// ---------- main ----------
async function main(): Promise<void> {
  await ping("/start");
  const token = await accessToken();
  const today = await propertyToday(token);
  const generatedAt = new Date().toISOString();
  const shows = loadShows().filter((s) => !ONLY || s.slug === ONLY);
  if (!shows.length) throw new Error(ONLY ? `no show with slug ${ONLY}` : "no shows found in _posts");

  // Broken-link alert. GA4 custom insights cannot filter on page location or event
  // name (segments there are user-scoped only: demographics, device, first-user
  // source; checked 2026-08-27), so the alert lives here: any increase in from=go
  // 404 views since the last run fails the Healthchecks ping, which routes to
  // Telegram like the other cron jobs. The run itself still completes.
  const metaPath = join(DATA_DIR, "_meta.json");
  const prevMeta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : { broken_total: 0 };
  const brokenTotal = await fetchBrokenAll(token);
  const newBroken = ONLY ? 0 : brokenTotal - Number(prevMeta.broken_total ?? 0);

  const pagesSince = [addDays(today, -29), LAUNCH_DATE].sort()[0];   // whichever is earlier
  const lines: string[] = [];
  for (const show of shows) {
    const [clicks, pages, broken] = await Promise.all([fetchClicks(token, show.slug), fetchPages(token, show.slug, pagesSince), fetchBroken(token, show.slug)]);
    const csvPath = `/assets/reports/${show.slug}.csv`;
    const report = aggregate({ show, clicks, pages, brokenLinks: broken, since: LAUNCH_DATE, pagesSince, today, generatedAt, csvPath });
    lines.push(`${show.slug.padEnd(24)} clicks ${String(report.totals.clicks).padStart(5)} (go ${report.totals.redirect}, site ${report.totals.click})  sessions ${report.totals.sessions}  campaigns ${report.by_campaign.length}  broken ${broken}`);
    if (DRY) continue;
    mkdirSync(DATA_DIR, { recursive: true }); mkdirSync(CSV_DIR, { recursive: true }); mkdirSync(PAGE_DIR, { recursive: true });
    writeFileSync(join(DATA_DIR, `${show.slug}.json`), JSON.stringify(report, null, 1) + "\n");
    writeFileSync(join(CSV_DIR, `${show.slug}.csv`), toCsv(clicks, SITE_URL));
    writeFileSync(join(PAGE_DIR, `${show.slug}.md`), reportPage(show));
  }
  console.log(`GA reports ${DRY ? "(dry run) " : ""}for ${shows.length} show(s), property day ${today}:`);
  for (const l of lines) console.log("  " + l);
  const brokenMsg = `broken campaign links: ${brokenTotal} from=go 404 views since ${LAUNCH_DATE} (${newBroken > 0 ? "+" + newBroken + " NEW since last run" : "no new ones"})`;
  console.log("  " + brokenMsg);
  if (DRY) { console.log("dry run: nothing written"); return; }
  if (!ONLY) writeFileSync(metaPath, JSON.stringify({ broken_total: brokenTotal, generated_at: generatedAt }, null, 1) + "\n");
  if (NO_PUSH) { console.log("files written, --no-push: skipping git"); return; }
  console.log("git: " + commitAndPush());
  if (newBroken > 0) await ping("/fail", `ALERT ${brokenMsg}\nCheck GA: page_view on /404.html with from=go for the slug + campaign.\n\n${lines.join("\n")}`);
  else await ping("", `${brokenMsg}\n${lines.join("\n")}`);
}

main().catch(async (err) => {
  console.error("ga-report failed:", err.message);
  await ping("/fail", String(err.message).slice(0, 2000));
  process.exit(1);
});

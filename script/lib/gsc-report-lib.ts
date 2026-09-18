// Pure helpers for script/gsc-report.ts (no network, no filesystem writes): the
// Search Console row shape, the "just off page one" band filter, grouping by page,
// the page-to-source lookup over the Jekyll front matter, and the Markdown
// worksheet. Kept separate so `bun test` can pin the behaviour without Google.
// Design: docs/scripts.md, "gsc-report.ts".

export const SITE_URL = "https://inyourfacecomedy.ch";

// One Search Console row: a query and the page that ranked for it.
export interface GscRow {
  query: string;
  page: string;        // full URL as Search Console reports it
  clicks: number;
  impressions: number;
  ctr: number;         // 0..1
  position: number;    // average position, 1 = top
}

// Per-page totals (dimension page only), so a worksheet entry can say how the
// page does overall, not just in the band.
export interface PageTotals {
  page: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface Band {
  minPosition: number;     // inclusive
  maxPosition: number;     // inclusive
  minImpressions: number;  // rows below this are noise
}

export const DEFAULT_BAND: Band = { minPosition: 11, maxPosition: 20, minImpressions: 10 };

// What the site currently says about a page: the front matter jekyll-seo-tag turns
// into <title> and the meta description.
export interface PageSource {
  path: string;          // "/comedybrew/"
  file: string;          // "_posts/2024-01-18-comedybrew.md", relative to the repo root
  title: string;
  description: string;
}

export interface PageGroup {
  path: string;
  source: PageSource | undefined;
  totals: PageTotals | undefined;
  bandImpressions: number;
  bandClicks: number;
  rows: GscRow[];        // band rows for this page, most impressions first
}

// ---------- API rows ----------

// Search Console returns { keys: [query, page], clicks, impressions, ctr, position }.
export function shapeRow(r: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }): GscRow {
  return { query: r.keys[0], page: r.keys[1], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position };
}

export function shapePageTotals(r: { keys: string[]; clicks: number; impressions: number; position: number }): PageTotals {
  return { page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: r.position };
}

// Parse "11-20" into a band, keeping the impressions floor.
export function parseBand(spec: string, minImpressions: number): Band {
  const m = spec.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (!m) throw new Error(`--band wants MIN-MAX, e.g. 11-20 (got ${JSON.stringify(spec)})`);
  const minPosition = Number(m[1]), maxPosition = Number(m[2]);
  if (minPosition > maxPosition) throw new Error(`--band ${spec}: minimum above maximum`);
  return { minPosition, maxPosition, minImpressions };
}

export function inBand(row: GscRow, band: Band): boolean {
  return row.position >= band.minPosition && row.position <= band.maxPosition && row.impressions >= band.minImpressions;
}

// Site-relative path of a Search Console page URL ("/comedybrew/").
export function pagePath(url: string): string {
  const u = url.startsWith(SITE_URL) ? url.slice(SITE_URL.length) : url.replace(/^https?:\/\/[^/]+/, "");
  const noQuery = u.split(/[?#]/)[0];
  return noQuery === "" ? "/" : noQuery;
}

// ---------- grouping ----------

export function groupByPage(rows: GscRow[], band: Band, totals: PageTotals[], sources: Map<string, PageSource>): PageGroup[] {
  const totalsByPath = new Map(totals.map((t) => [pagePath(t.page), t]));
  const groups = new Map<string, PageGroup>();
  for (const row of rows) {
    if (!inBand(row, band)) continue;
    const path = pagePath(row.page);
    let g = groups.get(path);
    if (!g) {
      g = { path, source: sources.get(path), totals: totalsByPath.get(path), bandImpressions: 0, bandClicks: 0, rows: [] };
      groups.set(path, g);
    }
    g.rows.push(row);
    g.bandImpressions += row.impressions;
    g.bandClicks += row.clicks;
  }
  for (const g of groups.values()) g.rows.sort((a, b) => b.impressions - a.impressions || a.position - b.position);
  return [...groups.values()].sort((a, b) => b.bandImpressions - a.bandImpressions || a.path.localeCompare(b.path));
}

// ---------- Jekyll sources ----------

export function frontMatterOf(text: string): Record<string, string> {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out: Record<string, string> = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[kv[1]] = v;
  }
  return out;
}

// Which URL path a source file renders to. Posts and pages carry `permalink:`;
// comedians follow the collection rule /comedians/:name/ (the file name); the
// home page is index.html at "/". Returns undefined for files with no known path.
export function sourcePath(file: string, fm: Record<string, string>): string | undefined {
  if (file === "index.html") return "/";
  if (fm.permalink) return fm.permalink.endsWith("/") || fm.permalink.includes(".") ? fm.permalink : fm.permalink + "/";
  const comedian = file.match(/^_comedians\/([^/]+)\.md$/);
  if (comedian) return `/comedians/${comedian[1]}/`;
  return undefined;
}

export function pageSource(file: string, text: string): PageSource | undefined {
  const fm = frontMatterOf(text);
  const path = sourcePath(file, fm);
  if (!path) return undefined;
  return { path, file, title: fm.title ?? "", description: fm.description ?? "" };
}

// ---------- dates ----------

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Search Console finalises a day about three days later; the window ends there.
export const FINAL_LAG_DAYS = 3;

export function reportWindow(today: string, days: number): { startDate: string; endDate: string } {
  const endDate = addDays(today, -FINAL_LAG_DAYS);
  return { startDate: addDays(endDate, -(days - 1)), endDate };
}

// ---------- worksheet ----------

function fmtPos(p: number): string { return p.toFixed(1); }
function pct(x: number): string { return (x * 100).toFixed(1) + "%"; }

export function worksheet(groups: PageGroup[], opts: { startDate: string; endDate: string; band: Band; site: string; generatedAt: string; totalRows: number }): string {
  const { band } = opts;
  const out: string[] = [];
  out.push(`# Search Console worksheet: position ${band.minPosition} to ${band.maxPosition}`);
  out.push("");
  out.push(`Property ${opts.site}, ${opts.startDate} to ${opts.endDate} (final data), generated ${opts.generatedAt}.`);
  out.push(`Rows in the band: ${groups.reduce((n, g) => n + g.rows.length, 0)} query and page pairs with ${band.minImpressions} or more impressions, out of ${opts.totalRows} pairs in the window. Pages are ordered by impressions in the band; queries within a page the same way.`);
  out.push("");
  out.push("How to read it: each query here already shows the page on the second Google results page. A title or opening line that names the query's words moves it more than any other edit. Brand and comedian-name queries compete with the comedian's own profiles; venue-intent queries (comedy, open mic, Zürich) are the ones the site can own.");
  out.push("");
  if (!groups.length) { out.push("_Nothing in the band for this window._"); return out.join("\n") + "\n"; }
  out.push("## Pages");
  out.push("");
  out.push("| Page | Band impressions | Band clicks | Queries | Page overall (imp, clicks, pos) |");
  out.push("|---|---|---|---|---|");
  for (const g of groups) {
    const t = g.totals ? `${g.totals.impressions}, ${g.totals.clicks}, ${fmtPos(g.totals.position)}` : "n/a";
    out.push(`| ${g.path} | ${g.bandImpressions} | ${g.bandClicks} | ${g.rows.length} | ${t} |`);
  }
  out.push("");
  for (const g of groups) {
    out.push(`## ${g.path}`);
    out.push("");
    if (g.source) {
      out.push(`Source: \`${g.source.file}\``);
      out.push("");
      out.push(`- Title: ${g.source.title || "_(none)_"}`);
      out.push(`- Description: ${g.source.description || "_(none)_"}`);
    } else {
      out.push("Source: _not found in _posts, _comedians, pages or index.html_ (redirect, old URL or generated page)");
    }
    out.push("");
    out.push("| Query | Impressions | Clicks | CTR | Position |");
    out.push("|---|---|---|---|---|");
    for (const r of g.rows) out.push(`| ${r.query.replace(/\|/g, "\\|")} | ${r.impressions} | ${r.clicks} | ${pct(r.ctr)} | ${fmtPos(r.position)} |`);
    out.push("");
  }
  return out.join("\n") + "\n";
}

// One line per page for the terminal and the Healthchecks body.
export function summaryLines(groups: PageGroup[], limit = 12): string[] {
  return groups.slice(0, limit).map((g) => {
    const top = g.rows.slice(0, 3).map((r) => `${r.query} (${r.impressions} @ ${fmtPos(r.position)})`).join(", ");
    return `${g.path.padEnd(32)} ${String(g.bandImpressions).padStart(5)} imp  ${top}`;
  });
}

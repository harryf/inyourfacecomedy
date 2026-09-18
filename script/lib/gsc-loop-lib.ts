// Pure helpers for the weekly Search Console learning loop in script/gsc-report.ts:
// snapshot shape, the site's own click curve by position, opportunity scoring over
// every page, missing-word analysis against the page's title, description and body,
// the experiments ledger with hold period and verdicts, trend lines over snapshots,
// and the Markdown report. No network, no filesystem. Design: seo/README.md.

import { pagePath, type GscRow, type PageSource, type PageTotals } from "./gsc-report-lib";

// ---------- windows ----------

// Two windows: 28 days for the weekly snapshot (trend, movers, experiment verdicts,
// stored) and 90 days for discovery (opportunity scoring: small queries need the
// longer run to show at all; fetched each week, not stored).
export const WINDOW_DAYS = 28;
export const DISCOVERY_DAYS = 90;
export const MIN_ROW_IMPRESSIONS = 3;

// ---------- snapshot ----------

export interface Snapshot {
  date: string;              // run date, the file name
  startDate: string;         // 28-day window, final data
  endDate: string;
  rows: GscRow[];            // query x page, impressions >= MIN_ROW_IMPRESSIONS
  pages: PageTotals[];       // every page with any impression
  devices: { device: string; clicks: number; impressions: number; position: number }[];
}

// ---------- scope: what may be changed on a page ----------

export type Scope = "full" | "meta-only";

// Comedian pages are generated from Grist by sync-comedians.rb and carry the
// comedian's own bio. Their body is never proposed for change; the title and meta
// description pattern (the template) is the only lever, and it applies to all of them.
export function scopeOf(path: string): Scope {
  return path.startsWith("/comedians/") && path !== "/comedians/" ? "meta-only" : "full";
}

// ---------- click curve ----------

// Fallback expected CTR by rounded position when the site has too few impressions
// at that position to speak for itself (industry-shaped, deliberately conservative).
export const DEFAULT_CURVE: Record<number, number> = {
  1: 0.28, 2: 0.15, 3: 0.10, 4: 0.075, 5: 0.06, 6: 0.048, 7: 0.04, 8: 0.033, 9: 0.028, 10: 0.024,
  11: 0.016, 12: 0.014, 13: 0.012, 14: 0.011, 15: 0.010, 16: 0.009, 17: 0.008, 18: 0.007, 19: 0.006, 20: 0.006,
};
export const CURVE_MIN_IMPRESSIONS = 150;

export interface CurvePoint { position: number; ctr: number; impressions: number; source: "site" | "default" }

// Impression-weighted CTR per rounded position 1..20 from this window's rows, falling
// back to the default where the bucket is thin. Brand queries are excluded (their CTR
// says nothing about how a stranger reacts to a listing).
export function clickCurve(rows: GscRow[], isBrand: (q: string) => boolean): CurvePoint[] {
  const buckets = new Map<number, { clicks: number; impressions: number }>();
  for (const r of rows) {
    if (isBrand(r.query)) continue;
    const p = Math.min(20, Math.max(1, Math.round(r.position)));
    const b = buckets.get(p) ?? { clicks: 0, impressions: 0 };
    b.clicks += r.clicks; b.impressions += r.impressions;
    buckets.set(p, b);
  }
  const out: CurvePoint[] = [];
  for (let p = 1; p <= 20; p++) {
    const b = buckets.get(p);
    if (b && b.impressions >= CURVE_MIN_IMPRESSIONS) out.push({ position: p, ctr: b.clicks / b.impressions, impressions: b.impressions, source: "site" });
    else out.push({ position: p, ctr: DEFAULT_CURVE[p], impressions: b?.impressions ?? 0, source: "default" });
  }
  return out;
}

export function ctrAt(curve: CurvePoint[], position: number): number {
  const p = Math.min(20, Math.max(1, Math.round(position)));
  return curve[p - 1].ctr;
}

// ---------- words ----------

const STOP = new Set(["in", "the", "a", "an", "of", "and", "to", "for", "at", "on", "near", "me", "und", "der", "die", "das", "im", "mit", "für", "fur", "zum", "zur", "&", "-", "|", "•"]);

// Lowercase, strip diacritics (zürich and zurich are one word), drop punctuation,
// singularise the cheap way. The comparison is on these normalised tokens.
export function tokens(text: string): string[] {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
}

export function missingWords(query: string, haystack: string): string[] {
  const have = new Set(tokens(haystack));
  return [...new Set(tokens(query))].filter((w) => !have.has(w));
}

// ---------- brand ----------

export const BRAND_PATTERNS = [/in\s*your\s*face/i, /\biyf\b/i, /inyourfacecomedy/i];
export function isBrandQuery(q: string): boolean { return BRAND_PATTERNS.some((re) => re.test(q)); }

// Comedian and show names come from the site itself: every comedian page title and
// the short name of every show. A query that is mostly a name competes with the
// person's own profiles; the report says so instead of pretending a title change will
// win it. People: the whole name inside the query (with the name at least half of it),
// or the whole query inside the name (a surname alone). Shows: the whole short name
// inside the query, so "comedy show zurich" is not "The Nerdy Comedy Show".
export interface Names { people: string[]; shows: string[] }

export function isNameQuery(q: string, names: Names): boolean {
  const qt = tokens(q);
  if (!qt.length) return false;
  const qs = new Set(qt);
  for (const n of names.people) {
    const nt = tokens(n);
    if (!nt.length) continue;
    if (nt.every((w) => qs.has(w)) && nt.length / qt.length >= 0.5) return true;
    if (qt.every((w) => nt.includes(w))) return true;
  }
  for (const n of names.shows) {
    const nt = tokens(n);
    if (nt.length && nt.every((w) => qs.has(w)) && nt.length / qt.length >= 0.5) return true;
  }
  return false;
}

// ---------- opportunities ----------

export type OppKind = "page-two" | "page-one-low" | "snippet" | "cannibal";

export interface Opportunity {
  kind: OppKind;
  query: string;
  page: string;              // path
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  targetPosition: number;    // where the lever aims
  gain: number;              // extra clicks per window if the target is reached (0 for cannibal)
  missing: string[];         // query words absent from the page's title, description and body
  name: boolean;             // mostly a person's or show's name
  note?: string;
}

export interface ScoringInput {
  rows: GscRow[];
  curve: CurvePoint[];
  sources: Map<string, PageSource>;
  bodies: Map<string, string>;   // path -> body text (empty for meta-only pages)
  names: Names;
}

export const OPP_MIN_IMPRESSIONS = 10;
export const SNIPPET_MIN_IMPRESSIONS = 30;

function haystackFor(path: string, input: ScoringInput): string {
  const src = input.sources.get(path);
  const body = scopeOf(path) === "full" ? (input.bodies.get(path) ?? "") : "";
  return `${src?.title ?? ""} ${src?.description ?? ""} ${body}`;
}

export function scoreOpportunities(input: ScoringInput): Opportunity[] {
  const out: Opportunity[] = [];
  const byQuery = new Map<string, GscRow[]>();
  for (const r of input.rows) {
    if (isBrandQuery(r.query)) continue;
    const list = byQuery.get(r.query) ?? [];
    list.push(r); byQuery.set(r.query, list);
  }
  for (const r of input.rows) {
    if (isBrandQuery(r.query) || r.impressions < OPP_MIN_IMPRESSIONS) continue;
    const path = pagePath(r.page);
    const base = { query: r.query, page: path, impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position, missing: missingWords(r.query, haystackFor(path, input)), name: isNameQuery(r.query, input.names) };
    if (r.position >= 11 && r.position <= 20) {
      const target = 8;
      out.push({ ...base, kind: "page-two", targetPosition: target, gain: Math.max(0, r.impressions * ctrAt(input.curve, target) - r.clicks) });
    } else if (r.position > 5.5 && r.position < 11) {
      const target = Math.max(3, r.position - 3);
      out.push({ ...base, kind: "page-one-low", targetPosition: target, gain: Math.max(0, r.impressions * ctrAt(input.curve, target) - r.clicks) });
    } else if (r.position <= 8 && r.impressions >= SNIPPET_MIN_IMPRESSIONS && r.ctr < 0.5 * ctrAt(input.curve, r.position)) {
      out.push({ ...base, kind: "snippet", targetPosition: r.position, gain: Math.max(0, r.impressions * ctrAt(input.curve, r.position) - r.clicks), note: `CTR ${(r.ctr * 100).toFixed(1)}% against ${(ctrAt(input.curve, r.position) * 100).toFixed(1)}% typical at this position` });
    }
  }
  // Cannibalisation: one query, two or more pages each holding a real share.
  for (const [query, list] of byQuery) {
    const total = list.reduce((n, r) => n + r.impressions, 0);
    if (total < 20) continue;
    const holders = list.filter((r) => r.impressions / total >= 0.15);
    if (holders.length < 2) continue;
    holders.sort((a, b) => b.impressions - a.impressions);
    for (const r of holders) {
      out.push({ kind: "cannibal", query, page: pagePath(r.page), impressions: r.impressions, clicks: r.clicks, ctr: r.ctr, position: r.position, targetPosition: r.position, gain: 0, missing: [], name: isNameQuery(query, input.names), note: `${holders.length} pages share this query: ${holders.map((h) => `${pagePath(h.page)} (${h.impressions} @ ${h.position.toFixed(1)})`).join(", ")}` });
    }
  }
  return out.sort((a, b) => b.gain - a.gain || b.impressions - a.impressions);
}

// ---------- page briefs ----------

export interface PageBrief {
  path: string;
  scope: Scope;
  source: PageSource | undefined;
  totals: PageTotals | undefined;
  gain: number;
  opportunities: Opportunity[];
  missing: { word: string; weight: number }[];   // impression-weighted words absent from the page
}

export function pageBriefs(opps: Opportunity[], totals: PageTotals[], sources: Map<string, PageSource>): PageBrief[] {
  const totalsByPath = new Map(totals.map((t) => [pagePath(t.page), t]));
  const map = new Map<string, PageBrief>();
  for (const o of opps) {
    let b = map.get(o.page);
    if (!b) { b = { path: o.page, scope: scopeOf(o.page), source: sources.get(o.page), totals: totalsByPath.get(o.page), gain: 0, opportunities: [], missing: [] }; map.set(o.page, b); }
    b.opportunities.push(o);
    b.gain += o.gain;
  }
  for (const b of map.values()) {
    const w = new Map<string, number>();
    // Name queries do not feed a full page's missing words (the page is not going to
    // rename itself), but on a meta-only page the name is the title, so whatever else
    // the query says (comedian, comedy, zürich) is exactly what the pattern could add.
    for (const o of b.opportunities) if (!o.name || b.scope === "meta-only") for (const m of o.missing) w.set(m, (w.get(m) ?? 0) + o.impressions);
    b.missing = [...w].map(([word, weight]) => ({ word, weight })).sort((a, c) => c.weight - a.weight);
    b.opportunities.sort((a, c) => c.gain - a.gain || c.impressions - a.impressions);
  }
  return [...map.values()].sort((a, b) => b.gain - a.gain || a.path.localeCompare(b.path));
}

// All comedian pages as one unit: their combined gain and the words most often
// missing, which is what a title or description pattern change would add.
export function comedianTemplateBrief(briefs: PageBrief[]): { pages: number; gain: number; impressions: number; missing: { word: string; weight: number }[]; examples: PageBrief[] } {
  const cs = briefs.filter((b) => b.scope === "meta-only");
  const w = new Map<string, number>();
  let impressions = 0;
  for (const b of cs) {
    for (const o of b.opportunities) impressions += o.impressions;
    for (const m of b.missing) w.set(m.word, (w.get(m.word) ?? 0) + m.weight);
  }
  return { pages: cs.length, gain: cs.reduce((n, b) => n + b.gain, 0), impressions, missing: [...w].map(([word, weight]) => ({ word, weight })).sort((a, c) => c.weight - a.weight), examples: cs.slice(0, 5) };
}

// ---------- experiments ----------

export interface Experiment {
  id: string;
  date: string;              // the day the change went live
  page: string;              // path
  queries: string[];         // the queries the change aims at
  change: string;            // what was changed, in words
  status?: "open" | "closed";
  verdict?: string;          // filled by hand when closing
}

export interface QueryMetrics { query: string; impressions: number; clicks: number; position: number }

export interface ExperimentReading {
  experiment: Experiment;
  daysSince: number;
  judgeable: boolean;        // hold period over
  baseline: QueryMetrics[];  // the 28 days before the change
  latest: QueryMetrics[];    // the current window
  verdict: "too early" | "improved" | "worse" | "flat" | "no data";
  summary: string;
}

export const HOLD_DAYS = 28;

export function metricsFor(rows: GscRow[], page: string, queries: string[]): QueryMetrics[] {
  return queries.map((q) => {
    const want = q.trim().toLowerCase();
    const hits = rows.filter((r) => pagePath(r.page) === page && r.query.trim().toLowerCase() === want);
    const impressions = hits.reduce((n, r) => n + r.impressions, 0);
    const clicks = hits.reduce((n, r) => n + r.clicks, 0);
    const position = impressions ? hits.reduce((n, r) => n + r.position * r.impressions, 0) / impressions : 0;
    return { query: q, impressions, clicks, position };
  });
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
}

export function judge(exp: Experiment, baseline: QueryMetrics[], latest: QueryMetrics[], windowEnd: string): ExperimentReading {
  const daysSince = daysBetween(exp.date, windowEnd);
  const judgeable = daysSince >= HOLD_DAYS;
  const pairs = baseline.map((b, i) => ({ b, l: latest[i] })).filter(({ b, l }) => b.impressions >= 10 && l.impressions >= 10);
  let verdict: ExperimentReading["verdict"];
  let summary: string;
  if (!judgeable) { verdict = "too early"; summary = `${daysSince} of ${HOLD_DAYS} days of final data since the change`; }
  else if (!pairs.length) { verdict = "no data"; summary = "fewer than 10 impressions on the target queries in one of the windows"; }
  else {
    const wImp = pairs.reduce((n, p) => n + p.b.impressions, 0);
    const dPos = pairs.reduce((n, p) => n + (p.l.position - p.b.position) * p.b.impressions, 0) / wImp;
    const cB = pairs.reduce((n, p) => n + p.b.clicks, 0), cL = pairs.reduce((n, p) => n + p.l.clicks, 0);
    const dClicks = cB ? (cL - cB) / cB : (cL > 0 ? 1 : 0);
    if (dPos <= -1 || (dClicks >= 0.3 && cL >= 5)) verdict = "improved";
    else if (dPos >= 1 || (dClicks <= -0.3 && cB >= 5)) verdict = "worse";
    else verdict = "flat";
    summary = `position ${dPos > 0 ? "+" : ""}${dPos.toFixed(1)}, clicks ${cB} to ${cL} on ${pairs.length} judged quer${pairs.length === 1 ? "y" : "ies"}`;
  }
  return { experiment: exp, daysSince, judgeable, baseline, latest, verdict, summary };
}

// ---------- trend ----------

export interface TrendPoint { date: string; endDate: string; clicks: number; impressions: number; position: number; pages: number }

export function trend(snaps: Snapshot[]): TrendPoint[] {
  return snaps.map((s) => {
    const impressions = s.pages.reduce((n, p) => n + p.impressions, 0);
    const clicks = s.pages.reduce((n, p) => n + p.clicks, 0);
    const position = impressions ? s.pages.reduce((n, p) => n + p.position * p.impressions, 0) / impressions : 0;
    return { date: s.date, endDate: s.endDate, clicks, impressions, position, pages: s.pages.filter((p) => p.impressions > 0).length };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export interface Mover { query: string; page: string; impressions: number; from: number; to: number }

// Queries whose position moved by two or more places since the previous snapshot.
export function movers(prev: Snapshot | undefined, cur: Snapshot, minImpressions = 20): Mover[] {
  if (!prev) return [];
  const key = (r: GscRow) => `${r.query}\u0000${pagePath(r.page)}`;
  const before = new Map(prev.rows.map((r) => [key(r), r]));
  const out: Mover[] = [];
  for (const r of cur.rows) {
    const p = before.get(key(r));
    if (!p || r.impressions < minImpressions || p.impressions < minImpressions) continue;
    if (Math.abs(r.position - p.position) >= 2) out.push({ query: r.query, page: pagePath(r.page), impressions: r.impressions, from: p.position, to: r.position });
  }
  return out.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
}

// ---------- report ----------

const f1 = (n: number) => n.toFixed(1);
const pct = (x: number) => (x * 100).toFixed(1) + "%";
const esc = (s: string) => s.replace(/\|/g, "\\|");

const KIND_LABEL: Record<OppKind, string> = {
  "page-two": "page two, aim for page one",
  "page-one-low": "bottom of page one, aim higher",
  "snippet": "ranks well, few clicks: the listing text",
  "cannibal": "two pages share the query",
};

export interface ReportInput {
  snapshot: Snapshot;
  discovery: { startDate: string; endDate: string; rows: number };
  curve: CurvePoint[];
  briefs: PageBrief[];
  comedians: ReturnType<typeof comedianTemplateBrief>;
  readings: ExperimentReading[];
  trend: TrendPoint[];
  movers: Mover[];
  generatedAt: string;
  topPages?: number;
  topOpps?: number;
}

export function renderReport(input: ReportInput): string {
  const { snapshot: s, briefs } = input;
  const topPages = input.topPages ?? 12, topOpps = input.topOpps ?? 25;
  const allOpps = briefs.flatMap((b) => b.opportunities).sort((a, b) => b.gain - a.gain || b.impressions - a.impressions);
  const out: string[] = [];
  out.push(`# Search Console loop: week of ${s.date}`);
  out.push("");
  out.push(`Snapshot window ${s.startDate} to ${s.endDate} (${WINDOW_DAYS} days of final data, ${s.rows.length} query and page pairs with ${MIN_ROW_IMPRESSIONS} or more impressions over ${s.pages.filter((p) => p.impressions > 0).length} pages) drives the trend, the movers and the experiment verdicts. Discovery window ${input.discovery.startDate} to ${input.discovery.endDate} (${DISCOVERY_DAYS} days, ${input.discovery.rows} pairs) drives the opportunities and page briefs, because small queries only show over a longer run. Generated ${input.generatedAt}. How to read this and how to log a change: \`seo/README.md\`.`);
  out.push("");

  // Trend
  if (input.trend.length) {
    out.push("## Trend");
    out.push("");
    out.push("| Window ends | Clicks | Impressions | CTR | Avg position | Pages seen |");
    out.push("|---|---|---|---|---|---|");
    for (const t of input.trend.slice(-10)) out.push(`| ${t.endDate} | ${t.clicks} | ${t.impressions} | ${t.impressions ? pct(t.clicks / t.impressions) : "n/a"} | ${f1(t.position)} | ${t.pages} |`);
    out.push("");
    const devs = s.devices.filter((d) => d.impressions > 0);
    if (devs.length) out.push(`Devices this window: ${devs.map((d) => `${d.device.toLowerCase()} ${d.impressions} impressions at position ${f1(d.position)}`).join("; ")}.`);
    out.push("");
  }

  // Experiments
  out.push("## Experiments");
  out.push("");
  if (!input.readings.length) out.push("_No changes logged yet. After you change a page, run `bun script/gsc-report.ts --log-change <path> \"<query, query>\" \"<what changed>\"` and this section fills in over the next weeks._");
  if (!input.readings.length) out.push("");
  else {
    out.push("| Id | Page | Changed | Days | Verdict | Reading |");
    out.push("|---|---|---|---|---|---|");
    for (const r of input.readings) out.push(`| ${r.experiment.id} | ${r.experiment.page} | ${r.experiment.date} | ${r.daysSince} | ${r.verdict}${r.experiment.status === "closed" ? " (closed)" : ""} | ${esc(r.summary)} |`);
    out.push("");
    for (const r of input.readings) {
      out.push(`### ${r.experiment.id}: ${esc(r.experiment.change)}`);
      out.push("");
      out.push("| Query | Before imp | Before clicks | Before pos | Now imp | Now clicks | Now pos |");
      out.push("|---|---|---|---|---|---|---|");
      r.baseline.forEach((b, i) => { const l = r.latest[i]; out.push(`| ${esc(b.query)} | ${b.impressions} | ${b.clicks} | ${b.impressions ? f1(b.position) : "n/a"} | ${l.impressions} | ${l.clicks} | ${l.impressions ? f1(l.position) : "n/a"} |`); });
      out.push("");
    }
  }

  // Click curve
  out.push("## Your click curve");
  out.push("");
  out.push("Share of impressions that become clicks at each position, from this window's non-brand queries where the site has enough data (marked site), else a conservative default. The gains below are priced against it.");
  out.push("");
  out.push("| Position | " + input.curve.map((c) => c.position).join(" | ") + " |");
  out.push("|---|" + input.curve.map(() => "---").join("|") + "|");
  out.push("| CTR | " + input.curve.map((c) => pct(c.ctr) + (c.source === "site" ? "" : "*")).join(" | ") + " |");
  out.push("");
  out.push("\\* default, fewer than " + CURVE_MIN_IMPRESSIONS + " impressions at that position.");
  out.push("");

  // Opportunities
  out.push(`## Opportunities, priced in extra clicks per ${DISCOVERY_DAYS} days`);
  out.push("");
  out.push(`Every non-brand query with ${OPP_MIN_IMPRESSIONS} or more impressions, scored: page-two queries priced at reaching position 8, bottom-of-page-one queries at climbing three places, well-ranked queries with under half the typical CTR at reaching that CTR. "Missing" lists the query's words absent from the page's title, description and body (comedian pages: title and description only). "Name" marks queries that are mostly a comedian's or show's name; those compete with the person's own profiles.`);
  out.push("");
  out.push("| Gain | Kind | Query | Page | Imp | Clicks | Pos | Missing | Name |");
  out.push("|---|---|---|---|---|---|---|---|---|");
  for (const o of allOpps.filter((o) => o.kind !== "cannibal").slice(0, topOpps)) out.push(`| ${f1(o.gain)} | ${KIND_LABEL[o.kind]} | ${esc(o.query)} | ${o.page} | ${o.impressions} | ${o.clicks} | ${f1(o.position)} | ${o.missing.join(", ")} | ${o.name ? "yes" : ""} |`);
  out.push("");
  const cann = allOpps.filter((o) => o.kind === "cannibal");
  if (cann.length) {
    out.push("### Two pages share one query");
    out.push("");
    const seen = new Set<string>();
    for (const o of cann) { if (seen.has(o.query)) continue; seen.add(o.query); out.push(`- ${esc(o.query)}: ${esc(o.note ?? "")}`); }
    out.push("");
  }

  // Page briefs
  out.push("## Page briefs");
  out.push("");
  out.push("Pages ordered by total gain. Each brief shows what the page says now and which words its queries use that the page does not. For pages marked meta-only the body is off limits; see the comedian section.");
  out.push("");
  for (const b of briefs.filter((b) => b.scope === "full").slice(0, topPages)) {
    out.push(`### ${b.path} (gain ${f1(b.gain)})`);
    out.push("");
    if (b.source) { out.push(`Source \`${b.source.file}\``); out.push(""); out.push(`- Title: ${b.source.title || "_(none)_"}`); out.push(`- Description: ${b.source.description || "_(none)_"}`); }
    else out.push("Source: _not found_ (redirect, old URL or generated page)");
    if (b.totals) out.push(`- Overall: ${b.totals.impressions} impressions, ${b.totals.clicks} clicks, position ${f1(b.totals.position)}`);
    if (b.missing.length) out.push(`- Words the queries use that the page does not: ${b.missing.slice(0, 8).map((m) => `${m.word} (${m.weight})`).join(", ")}`);
    out.push("");
    out.push("| Query | Kind | Imp | Clicks | Pos | Gain | Missing |");
    out.push("|---|---|---|---|---|---|---|");
    for (const o of b.opportunities.filter((o) => o.kind !== "cannibal").slice(0, 12)) out.push(`| ${esc(o.query)} | ${KIND_LABEL[o.kind]} | ${o.impressions} | ${o.clicks} | ${f1(o.position)} | ${f1(o.gain)} | ${o.missing.join(", ")}${o.name ? " (name)" : ""} |`);
    out.push("");
  }

  // Comedians as one template
  out.push("## Comedian pages (meta-only)");
  out.push("");
  const c = input.comedians;
  if (!c.pages) out.push("_No comedian page has a scored opportunity this window._");
  else {
    out.push(`${c.pages} comedian pages carry opportunities worth ${f1(c.gain)} extra clicks a quarter over ${c.impressions} impressions. Their bios are the comedians' own words and are never edited. The one lever is the shared pattern for the title and the meta description (sync-comedians.rb builds the description; the layout and jekyll-seo-tag build the title), so the words below are what a pattern change could add to all of them at once.`);
    out.push("");
    out.push(`- Words the queries use that the pages do not: ${c.missing.slice(0, 10).map((m) => `${m.word} (${m.weight})`).join(", ") || "none"}`);
    out.push("");
    out.push("| Page | Gain | Top query | Imp | Pos | Name |");
    out.push("|---|---|---|---|---|---|");
    for (const b of briefs.filter((b) => b.scope === "meta-only").slice(0, 15)) { const o = b.opportunities[0]; out.push(`| ${b.path} | ${f1(b.gain)} | ${esc(o.query)} | ${o.impressions} | ${f1(o.position)} | ${o.name ? "yes" : ""} |`); }
    out.push("");
  }

  // Movers
  if (input.movers.length) {
    out.push("## Movers since last week");
    out.push("");
    out.push("| Query | Page | Imp | Was | Now |");
    out.push("|---|---|---|---|---|");
    for (const m of input.movers.slice(0, 20)) out.push(`| ${esc(m.query)} | ${m.page} | ${m.impressions} | ${f1(m.from)} | ${f1(m.to)} |`);
    out.push("");
  }
  return out.join("\n") + "\n";
}

// One line per top page for the terminal and Healthchecks.
export function loopSummary(briefs: PageBrief[], readings: ExperimentReading[], limit = 8): string[] {
  const lines = briefs.slice(0, limit).map((b) => `${b.path.padEnd(34)} gain ${f1(b.gain).padStart(6)}  ${b.opportunities.slice(0, 2).map((o) => `${o.query} (${o.impressions} @ ${f1(o.position)})`).join(", ")}${b.scope === "meta-only" ? "  [meta-only]" : ""}`);
  for (const r of readings) lines.push(`experiment ${r.experiment.id} ${r.experiment.page}: ${r.verdict} (${r.summary})`);
  return lines;
}

// ---------- ledger text ----------

export function experimentYaml(e: Experiment): string {
  const q = e.queries.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(", ");
  return `- id: ${e.id}\n  date: ${e.date}\n  page: ${e.page}\n  queries: [${q}]\n  change: "${e.change.replace(/"/g, '\\"')}"\n  status: open\n`;
}

export function nextExperimentId(existing: Experiment[], date: string): string {
  const prefix = `exp-${date}`;
  const n = existing.filter((e) => e.id.startsWith(prefix)).length + 1;
  return `${prefix}-${n}`;
}

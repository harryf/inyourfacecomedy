// Friday readout of the ads: Meta's numbers beside the site's /go/ counts, floors and verdicts
// (plan: meta-ads/creative-bank-plan.md, "The loop"). Read-only unless --apply.
//
//   bun script/meta-insights.ts                  # last 14 days, every ad set in the campaign plus the old one
//   bun script/meta-insights.ts --days 28
//   bun script/meta-insights.ts --adset cold     # one ad set (cold, warm, intent, buyers, old)
//   bun script/meta-insights.ts --apply          # pause the ads with a "retire" verdict (asks first)
//
// Writes script/meta-out/insights-<date>.md and .json (gitignored). Never writes to the old
// ad set (config old_adset_id) or to Buyers, whose one ad the lineup script owns.
//
// Meta's recommendations (the "N recommendations" pills in Ads Manager) are read from two
// surfaces and printed in their own section: the account edge act_<id>/recommendations (the
// Ads Manager items, with a deep link) and the `recommendations` field on each ad set and
// ad (per-object checks such as a language mismatch). They are read, never applied: each is
// an Advantage+ toggle, a creative asset or a targeting change, and the Saturday review
// decides. There is no API call that applies a recommendation.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { confirm, fail, flagBool, flagString, log, parseArgs, todayISO, warn } from "./lib/email/cli";
import { DEFAULT_RULES, OUT_DIR, REPO_ROOT, healthcheck, loadConfig, metaFromEnv, minorToChf, type InsightsRules, type MetaConfig } from "./lib/meta-api";

const USAGE = `usage: bun script/meta-insights.ts [--days N] [--adset KEY] [--apply] [--yes] [--dry-run]

  --days N       window ending today (default 14)
  --adset KEY    cold | warm | intent | buyers | old (default: all)
  --apply        pause ads whose verdict is "retire" (never in Buyers or the old ad set)
  --yes          skip the confirmation before pausing
  --dry-run      readout only (the default)
`;

// ---------- rows ----------

export interface AdRow {
  adset: string;            // config key: cold, warm, intent, buyers, old, or the ad set id
  adset_id: string;
  ad_id: string;
  ad_name: string;
  status: string;
  created: string;          // ISO date
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  link_clicks: number;
  lpv: number;
  ticket: number;           // Meta's custom conversion count
  site: number | null;      // /go/ clicks the site counted under this ad's utm_content, null when the report has no row
  cost_per_ticket: number | null;
  cost_per_lpv: number | null;
  metric: "ticket" | "lpv" | null;
  verdict: "keep" | "retire" | "untested" | "starved" | "protected";
  note: string;
}

export function actionCount(actions: { action_type: string; value: string }[] | undefined, type: string): number {
  return Number((actions || []).find((a) => a.action_type === type)?.value || 0);
}

// ---------- verdicts, pure ----------

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Which metric ranks an ad, if any: ticket clicks past the ticket floor, else landing page
// views past the LPV floor, else nothing (untested).
export function rankingMetric(r: Pick<AdRow, "ticket" | "lpv">, rules: InsightsRules): AdRow["metric"] {
  if (r.ticket >= rules.ticket_floor) return "ticket";
  if (r.lpv >= rules.lpv_floor) return "lpv";
  return null;
}

// Verdicts for the ads of ONE ad set. Rank on the best metric the ad set as a whole supports:
// ticket if at least two ads clear the ticket floor, else lpv. An ad is "retire" when its cost is
// worse than retire_factor times the median of the ranked ads, at most max_retire per ad set,
// never the last two ads; "starved" when it has been under the floor for starved_after_days
// while a sibling passed; "protected" when the ad set is not the script's to touch.
export function verdicts(rows: AdRow[], rules: InsightsRules, today: string, protectedSet = false): AdRow[] {
  const active = rows.filter((r) => r.status === "ACTIVE");
  const ticketRanked = active.filter((r) => r.ticket >= rules.ticket_floor);
  const useTicket = ticketRanked.length >= 2;
  const ranked = useTicket ? ticketRanked : active.filter((r) => r.lpv >= rules.lpv_floor);
  const cost = (r: AdRow) => (useTicket ? r.cost_per_ticket : r.cost_per_lpv) ?? Infinity;
  const med = median(ranked.map(cost).filter((x) => Number.isFinite(x)));
  const out = rows.map((r) => ({ ...r, metric: rankingMetric(r, rules) }));
  for (const r of out) {
    r.note = "";
    if (protectedSet) { r.verdict = "protected"; continue; }
    if (r.status !== "ACTIVE") { r.verdict = "keep"; r.note = r.status.toLowerCase(); continue; }
    const inRank = ranked.some((x) => x.ad_id === r.ad_id);
    if (!inRank) {
      const ageDays = (Date.parse(today) - Date.parse(r.created)) / 86400000;
      if (ranked.length && ageDays >= rules.starved_after_days) { r.verdict = "starved"; r.note = `${Math.floor(ageDays)} days under the floor while siblings passed`; }
      else { r.verdict = "untested"; r.note = `under the floor (${r.ticket}/${rules.ticket_floor} ticket, ${r.lpv}/${rules.lpv_floor} lpv)`; }
      continue;
    }
    r.metric = useTicket ? "ticket" : "lpv";
    const c = cost(r);
    if (Number.isFinite(med) && c > med * rules.retire_factor) { r.verdict = "retire"; r.note = `${useTicket ? "cost/ticket" : "cost/lpv"} ${c.toFixed(2)} vs median ${med.toFixed(2)} x ${rules.retire_factor}`; }
    else { r.verdict = "keep"; r.note = `${useTicket ? "cost/ticket" : "cost/lpv"} ${c.toFixed(2)}, median ${Number.isFinite(med) ? med.toFixed(2) : "n/a"}`; }
  }
  // Cap the retirements: worst first, at most max_retire, and never below two live ads.
  const retiring = out.filter((r) => r.verdict === "retire").sort((a, b) => cost(b) - cost(a));
  const keepAlive = Math.max(0, active.length - 2);
  const allowed = Math.min(rules.max_retire_per_adset, keepAlive);
  retiring.slice(allowed).forEach((r) => { r.verdict = "keep"; r.note += "; kept (retire cap)"; });
  return out;
}

// ---------- the site's count ----------

// /go/ clicks per utm_content across every report in _data/reports/, for source meta. The
// report window is its own (about the last 19 days), printed in the header.
export function siteClicksByContent(reports: any[]): { window: string; clicks: Map<string, number> } {
  const clicks = new Map<string, number>();
  let since = "", through = "";
  for (const rep of reports) {
    if (rep.since && (!since || rep.since < since)) since = rep.since;
    if (rep.through && rep.through > through) through = rep.through;
    for (const c of rep.by_campaign || []) {
      if (c.source !== "meta") continue;
      for (const x of c.content || []) clicks.set(String(x.content), (clicks.get(String(x.content)) || 0) + Number(x.clicks || 0));
    }
  }
  return { window: since && through ? `${since} to ${through}` : "unknown", clicks };
}

export function siteFor(clicks: Map<string, number>, ad: { ad_id: string; ad_name: string }): number | null {
  if (clicks.has(ad.ad_name)) return clicks.get(ad.ad_name)!;
  if (clicks.has(ad.ad_id)) return clicks.get(ad.ad_id)!;
  return null;
}

export function showsInWindow(yamls: string[], show: string, since: string, until: string): number {
  const seen = new Set<string>();
  for (const y of yamls) for (const e of ((Bun.YAML.parse(y) as any)?.events || [])) if (e.show === show && e.date >= since && e.date <= until) seen.add(e.date);
  return seen.size;
}

// ---------- recommendations, pure ----------

export interface Recommendation {
  source: "account" | "object";   // act_<id>/recommendations, or the recommendations field on an ad set or ad
  type: string;                   // REELS_PC_RECOMMENDATION, or the per-object code
  objects: string[];              // config key ("adset cold"), ad name ("ad cold-C3"), or the raw id
  object_ids: string[];
  since: string;                  // ISO date of recommendation_time, or "" for object items
  lift: string;                   // Meta's estimate text, "" when absent
  text: string;
  url: string;                    // Ads Manager deep link, "" for object items
  accepted: string;               // the reason from config insights.accepted_recommendations, "" when not accepted
}

export interface AcceptedRecommendation { type: string; object: string; reason: string }

const isoDay = (t: unknown): string => {
  if (t === undefined || t === null || t === "") return "";
  if (typeof t === "number" || /^\d{9,11}$/.test(String(t))) return new Date(Number(t) * 1000).toISOString().slice(0, 10);
  return String(t).slice(0, 10);
};
const oneLine = (x: unknown) => String(x ?? "").replace(/\s+/g, " ").trim();

// Flatten both surfaces. `groups` is the account edge's data array (each entry holds a
// `recommendations` list); `objects` is a list of { id, recommendations } read off the ad sets
// and ads. `names` maps ids to display names; unknown ids stay raw. One row per type and
// object (the ad set field can echo the account item). Rows named in `accepted` (type plus
// object name) carry the reason and sort last.
export function collectRecommendations(groups: any[], objects: { id: string; recommendations?: any[] }[], names: Map<string, string>, accepted: AcceptedRecommendation[] = []): Recommendation[] {
  const out: Recommendation[] = [];
  const seen = new Set<string>();
  const nameOf = (id: string) => names.get(String(id)) || String(id);
  const push = (r: Recommendation) => {
    const key = r.type + "|" + r.object_ids.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    r.accepted = accepted.find((a) => String(a.type) === r.type && r.objects.includes(a.object))?.reason || "";
    out.push(r);
  };
  for (const g of groups || []) for (const r of g?.recommendations || []) {
    const ids = (r.object_ids || []).map(String);
    push({
      source: "account", type: String(r.type || ""), objects: ids.map(nameOf), object_ids: ids,
      since: isoDay(r.recommendation_time), lift: oneLine(r.recommendation_content?.lift_estimate),
      text: oneLine(r.recommendation_content?.body), url: String(r.url || ""), accepted: "",
    });
  }
  for (const o of objects || []) for (const r of o.recommendations || []) {
    push({
      source: "object", type: String(r.code ?? r.title ?? ""), objects: [nameOf(o.id)], object_ids: [String(o.id)],
      since: "", lift: r.importance ? `importance ${r.importance}, confidence ${r.confidence || "?"}` : "",
      text: oneLine([r.title, r.message].filter(Boolean).join(": ")), url: "", accepted: "",
    });
  }
  return [...out.filter((r) => !r.accepted), ...out.filter((r) => r.accepted)];
}

const cell = (x: string) => x.replace(/\|/g, "\\|");

// `error` set means the surfaces could not be read: rendered as unavailable, never as none.
export function renderRecommendations(recs: Recommendation[], error = ""): string[] {
  const L: string[] = ["**Meta recommendations** (read only; the Saturday review decides, nothing is applied by script)", ""];
  if (error) { L.push(`unavailable this run: ${cell(oneLine(error)).slice(0, 200)}`, ""); return L; }
  if (!recs.length) { L.push("none (the API exposes a subset; Ads Manager may still show pills)", ""); return L; }
  L.push(`${recs.length} item(s) on the API; Ads Manager may show more, not every pill reaches the API.`, "");
  L.push("| Object | Type | Since | Meta's estimate | Text | Decision | Link |", "|---|---|---|---|---|---|---|");
  for (const r of recs) L.push(`| ${cell(r.objects.join(", "))} | ${cell(r.type)} | ${r.since} | ${cell(r.lift)} | ${cell(r.text)} | ${r.accepted ? "accepted: " + cell(r.accepted) : "open"} | ${r.url ? "[Ads Manager](" + r.url + ")" : ""} |`);
  L.push("");
  return L;
}

// ---------- markdown ----------

const chf = (n: number | null) => (n === null || !Number.isFinite(n) ? "" : n.toFixed(2));

export function renderMarkdown(rowsByAdset: Map<string, AdRow[]>, meta: { since: string; until: string; shows: number; siteWindow: string; adsetInfo: Map<string, string>; flags: string[]; recommendations?: Recommendation[]; recommendationsError?: string }): string {
  const L: string[] = [];
  L.push(`# Meta ads readout, ${meta.since} to ${meta.until}`, "");
  L.push(`${meta.shows} Comedy Brew date(s) in the window. Site /go/ counts cover ${meta.siteWindow} (the report's own window). Meta ticket clicks are the custom conversion, 1-day click; the site count is the ground truth for ranking. Verdicts rank inside one ad set only.`, "");
  if (meta.flags.length) { L.push("**Flags**", ""); for (const f of meta.flags) L.push(`- ${f}`); L.push(""); }
  if (meta.recommendations || meta.recommendationsError) L.push(...renderRecommendations(meta.recommendations || [], meta.recommendationsError || ""));
  for (const [key, rows] of rowsByAdset) {
    L.push(`## ${key}${meta.adsetInfo.get(key) ? `: ${meta.adsetInfo.get(key)}` : ""}`, "");
    L.push("| Ad | Status | Spend | Impr. | Freq. | Link clicks | LPV | Ticket (Meta) | /go/ (site) | CHF/ticket | CHF/LPV | Verdict | Note |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|");
    for (const r of [...rows].sort((a, b) => b.spend - a.spend)) L.push(`| ${r.ad_name} | ${r.status} | ${r.spend.toFixed(2)} | ${r.impressions} | ${r.frequency.toFixed(1)} | ${r.link_clicks} | ${r.lpv} | ${r.ticket} | ${r.site ?? ""} | ${chf(r.cost_per_ticket)} | ${chf(r.cost_per_lpv)} | ${r.verdict} | ${r.note} |`);
    const t = rows.reduce((s, r) => ({ spend: s.spend + r.spend, lpv: s.lpv + r.lpv, ticket: s.ticket + r.ticket, site: s.site + (r.site || 0) }), { spend: 0, lpv: 0, ticket: 0, site: 0 });
    L.push(`| total | | ${t.spend.toFixed(2)} | | | | ${t.lpv} | ${t.ticket} | ${t.site} | ${chf(t.ticket ? t.spend / t.ticket : null)} | ${chf(t.lpv ? t.spend / t.lpv : null)} | | |`, "");
  }
  return L.join("\n");
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); return; }
  const days = Number(flagString(args, "days") || 14);
  if (!Number.isFinite(days) || days < 1) fail("--days must be a positive number");
  const only = flagString(args, "adset");
  const apply = flagBool(args, "apply") && !flagBool(args, "dry-run");
  const config: MetaConfig = loadConfig();
  const rules: InsightsRules = { ...DEFAULT_RULES, ...(config.insights || {}) };
  const meta = metaFromEnv(config);
  const today = todayISO();
  const until = today;
  const since = new Date(Date.parse(today) - (days - 1) * 86400000).toISOString().slice(0, 10);
  const time_range = { since, until };
  const ticketType = `offsite_conversion.custom.${config.custom_conversion_id}`;

  // Which ad sets: the config's four plus the old one, keyed by config name.
  const keyOf = new Map<string, string>();
  for (const [k, id] of Object.entries(config.adsets)) if (id) keyOf.set(String(id), k);
  if (config.old_adset_id) keyOf.set(String(config.old_adset_id), "old");
  const wanted = only ? [only] : [...new Set(keyOf.values())];
  for (const w of wanted) if (![...keyOf.values()].includes(w)) fail(`--adset ${w} is not one of ${[...keyOf.values()].join(", ")}`);

  // Ads, then insights at ad level (ads without delivery are absent from insights and get zero rows).
  const ads = await meta.getAll(`${config.campaign_id}/ads`, { fields: "id,name,adset_id,status,effective_status,created_time" });
  // 1-day click attribution to match the ad sets, so the numbers agree with Ads Manager.
  const ins = await meta.getAll(`${config.campaign_id}/insights`, { level: "ad", time_range, action_attribution_windows: ["1d_click"], fields: "ad_id,adset_id,spend,impressions,reach,frequency,inline_link_clicks,actions" });
  const insById = new Map(ins.map((r: any) => [String(r.ad_id), r]));
  const seenTypes = [...new Set(ins.flatMap((r: any) => (r.actions || []).map((a: any) => String(a.action_type))))].sort();
  const conversionSeen = seenTypes.includes(ticketType);
  const adsetIns = await meta.getAll(`${config.campaign_id}/insights`, { level: "adset", time_range: { since: new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10), until }, fields: "adset_id,frequency,reach,spend" });
  const freq7 = new Map(adsetIns.map((r: any) => [String(r.adset_id), Number(r.frequency || 0)]));

  // Site counts.
  const repDir = join(REPO_ROOT, "_data", "reports");
  const reports = existsSync(repDir) ? readdirSync(repDir).filter((f) => f.endsWith(".json") && !f.startsWith("_")).map((f) => JSON.parse(readFileSync(join(repDir, f), "utf8"))) : [];
  const site = siteClicksByContent(reports);

  const rowsByAdset = new Map<string, AdRow[]>();
  for (const ad of ads) {
    const key = keyOf.get(String(ad.adset_id));
    if (!key || !wanted.includes(key)) continue;
    const r: any = insById.get(String(ad.id)) || {};
    const spend = Number(r.spend || 0), lpv = actionCount(r.actions, "landing_page_view"), ticket = actionCount(r.actions, ticketType);
    const row: AdRow = {
      adset: key, adset_id: String(ad.adset_id), ad_id: String(ad.id), ad_name: ad.name, status: ad.effective_status || ad.status, created: String(ad.created_time).slice(0, 10),
      spend, impressions: Number(r.impressions || 0), reach: Number(r.reach || 0), frequency: Number(r.frequency || 0), link_clicks: Number(r.inline_link_clicks || 0), lpv, ticket,
      site: siteFor(site.clicks, { ad_id: String(ad.id), ad_name: ad.name }),
      cost_per_ticket: ticket ? spend / ticket : null, cost_per_lpv: lpv ? spend / lpv : null, metric: null, verdict: "keep", note: "",
    };
    if (!rowsByAdset.has(key)) rowsByAdset.set(key, []);
    rowsByAdset.get(key)!.push(row);
  }
  for (const key of wanted) if (!rowsByAdset.has(key)) rowsByAdset.set(key, []);

  const flags: string[] = [];
  const adsetInfo = new Map<string, string>();
  // Names for the recommendations section, and the per-object items collected on the way.
  const names = new Map<string, string>();
  for (const [id, k] of keyOf) names.set(id, `adset ${k}`);
  for (const ad of ads) names.set(String(ad.id), `ad ${ad.name}`);
  for (const [key, rows] of rowsByAdset) {
    const id = key === "old" ? config.old_adset_id! : config.adsets[key as keyof typeof config.adsets];
    const a = await meta.get(id, { fields: "name,effective_status,daily_budget,optimization_goal,targeting" });
    const sizes: string[] = [];
    for (const c of a.targeting?.custom_audiences || []) { try { const s = await meta.get(c.id, { fields: "name,approximate_count_lower_bound,approximate_count_upper_bound" }); sizes.push(`${s.name} ${s.approximate_count_lower_bound}-${s.approximate_count_upper_bound}`); } catch { sizes.push(`${c.name || c.id} ?`); } }
    const f7 = freq7.get(String(id)) || 0;
    adsetInfo.set(key, `${a.name}, ${a.effective_status}, CHF ${minorToChf(a.daily_budget)}/day, ${a.optimization_goal}, 7-day frequency ${f7.toFixed(1)}${sizes.length ? `, audiences: ${sizes.join("; ")}` : ""}`);
    if (f7 > rules.frequency_flag) flags.push(`${key}: 7-day frequency ${f7.toFixed(1)} is over ${rules.frequency_flag}; the audience is running out of people`);
    const spend = rows.reduce((s, r) => s + r.spend, 0), ticket = rows.reduce((s, r) => s + r.ticket, 0);
    if (ticket && spend / ticket > 3) flags.push(`${key}: CHF ${(spend / ticket).toFixed(2)} per ticket click over the window; look at the ad set, not the ads`);
    rowsByAdset.set(key, verdicts(rows, rules, today, key === "old" || key === "buyers"));
  }

  const cal = ["calendar.yml", "calendar_past.yml"].map((f) => join(REPO_ROOT, "_data", f)).filter(existsSync).map((p) => readFileSync(p, "utf8"));
  const shows = showsInWindow(cal, "comedybrew", since, until);
  if (!conversionSeen) flags.push(`no ${ticketType} in any ad's actions this window (types seen: ${seenTypes.filter((t) => !t.startsWith("onsite_") && !t.startsWith("post")).join(", ") || "none"}); ticket clicks read as 0 until Meta attributes the custom conversion`);
  // Meta's recommendations: the account edge (what Ads Manager shows) plus the per-object items.
  // A failure here is a warning; the readout still writes.
  // Both are read apart from the core insight calls, so a permission or version change here
  // cannot take the readout down.
  const wantedAdsetIds = [...keyOf].filter(([, k]) => wanted.includes(k)).map(([id]) => id);
  const wantedAdIds = ads.filter((ad: any) => wanted.includes(keyOf.get(String(ad.adset_id)) || "")).map((ad: any) => String(ad.id));
  let recommendations: Recommendation[] | null = null;
  let recommendationsError = "";
  try {
    const groups: any[] = (await meta.get(`${config.ad_account_id}/recommendations`, { limit: 50 })).data || [];
    const recObjects: { id: string; recommendations?: any[] }[] = [];
    for (const id of wantedAdsetIds) recObjects.push({ id, recommendations: (await meta.get(id, { fields: "recommendations" })).recommendations });
    for (const a of await meta.getAll(`${config.campaign_id}/ads`, { fields: "id,recommendations" })) if (wantedAdIds.includes(String(a.id))) recObjects.push({ id: String(a.id), recommendations: a.recommendations });
    const wantedIds = new Set([...wantedAdsetIds, ...wantedAdIds]);
    recommendations = collectRecommendations(groups, recObjects, names, rules.accepted_recommendations || []).filter((r) => !only || r.object_ids.some((id) => wantedIds.has(id)));
  } catch (e: any) {
    recommendationsError = String(e?.message || e);
    warn(`recommendations could not be read: ${recommendationsError.slice(0, 200)}`);
    flags.push("Meta recommendations could not be read this run (see the section)");
  }
  const md = renderMarkdown(rowsByAdset, { since, until, shows, siteWindow: site.window, adsetInfo, flags, recommendations: recommendations || [], recommendationsError });
  mkdirSync(OUT_DIR, { recursive: true });
  const base = join(OUT_DIR, `insights-${today}`);
  writeFileSync(`${base}.md`, md);
  writeFileSync(`${base}.json`, JSON.stringify({ since, until, shows, site_window: site.window, rules, flags, recommendations, recommendations_error: recommendationsError || null, adsets: Object.fromEntries(rowsByAdset) }, null, 2));
  log(md);
  log(`\nwritten ${base}.md and .json`);

  const retire = [...rowsByAdset.values()].flat().filter((r) => r.verdict === "retire");
  if (!apply) { if (retire.length) log(`${retire.length} ad(s) with a retire verdict; run with --apply to pause them`); return; }
  if (!retire.length) { log("nothing to retire"); return; }
  for (const r of retire) {
    if (!(await confirm(`pause ${r.ad_name} (${r.adset}): ${r.note}?`, { yes: flagBool(args, "yes"), defaultYes: false }))) { log(`  left running`); continue; }
    await meta.post(r.ad_id, { status: "PAUSED" });
    const back = await meta.get(r.ad_id, { fields: "status" });
    log(`  ${r.ad_name} now ${back.status}`);
  }
}

if (import.meta.main) {
  main().then(() => healthcheck("META_ADS_HEALTHCHECKS_URL", true)).catch(async (e) => {
    await healthcheck("META_ADS_HEALTHCHECKS_URL", false, String(e?.message || e));
    fail(String(e?.message || e));
  });
}

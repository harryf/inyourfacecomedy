// Write the bank ad sets' targeting, goal and budgets from meta-ads/config.yml (phase 6 of
// META_ADS.md, plan: meta-ads/creative-bank-plan.md).
//
//   bun script/meta-adsets.ts                 # diff only: what each field is and what config says
//   bun script/meta-adsets.ts --apply         # write the differences (asks once per ad set)
//   bun script/meta-adsets.ts --adset cold    # one ad set
//   bun script/meta-adsets.ts --apply --yes   # no questions (cron never uses this)
//
// Never touches Buyers (meta-lineup-ad.ts owns it) or the old ad set (config old_adset_id).
// The cap rule: a write that would raise the projected month above monthly_cap_chf is refused
// with the arithmetic printed; a write that lowers spend always goes through.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { confirm, fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { MetaApiError, REPO_ROOT, chfToMinor, healthcheck, loadConfig, metaFromEnv, minorToChf, type AdsetSpec, type MetaConfig } from "./lib/meta-api";

const USAGE = `usage: bun script/meta-adsets.ts [--apply] [--adset cold|warm|intent] [--yes] [--dry-run]

  (no flags)     print the diff per ad set and write nothing
  --validate     send the write with execution_options validate_only: Meta checks it, writes nothing
  --apply        write every differing field (targeting is written as one object)
  --adset KEY    only that ad set
  --yes          skip the per-ad-set confirmation
  --dry-run      same as no flags (kept for the house convention)
`;

export type BankKey = "cold" | "warm" | "intent";
export const BANK_KEYS: BankKey[] = ["cold", "warm", "intent"];

// ---------- desired state, pure ----------

export interface Desired {
  targeting: Record<string, unknown>;
  optimization_goal: string;
  billing_event: "IMPRESSIONS";
  destination_type: "WEBSITE";
  promoted_object?: { pixel_id: string };   // not sent: Meta rejects the pixel as promoted object on a traffic ad set (1885014)
  attribution_spec: { event_type: "CLICK_THROUGH"; window_days: 1 }[];
  daily_budget: number;             // minor units
}

export function desiredFor(spec: AdsetSpec, audiences: Record<string, string>, pixelId: string, baseChf: number): Desired {
  const aud = (keys: string[]) => keys.map((k) => { const id = audiences[k]; if (!id) throw new Error(`audience key ${k} is not in config.audiences`); return { id: String(id) }; });
  const geo: Record<string, unknown> = { location_types: spec.location.location_types || ["home", "recent"] };
  if (spec.location.city_key) geo.cities = [{ key: String(spec.location.city_key), radius: spec.location.radius_km ?? 30, distance_unit: "kilometer" }];
  else if (spec.location.countries?.length) geo.countries = spec.location.countries;
  else throw new Error("spec.location needs city_key or countries");
  const targeting: Record<string, unknown> = {
    geo_locations: geo,
    age_min: spec.ages[0],
    age_max: spec.ages[1],
    targeting_automation: { advantage_audience: 0 },
  };
  if (spec.locales?.length) targeting.locales = [...spec.locales].sort((a, b) => a - b);
  if (spec.include.length) targeting.custom_audiences = aud(spec.include);
  if (spec.exclude.length) targeting.excluded_custom_audiences = aud(spec.exclude);
  return {
    targeting,
    optimization_goal: spec.optimization,
    billing_event: "IMPRESSIONS",
    destination_type: "WEBSITE",
    // promoted_object left unset: landing page views on OUTCOME_TRAFFIC needs none (validate_only 2026-09-13)
    attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 1 }],
    daily_budget: chfToMinor(baseChf),
  };
}

// A flat, comparable view of the fields we manage, from either a Meta ad set object or a Desired.
export function flatten(a: any): Record<string, string> {
  const t = a.targeting || {};
  const g = t.geo_locations || {};
  const ids = (xs: any[] | undefined) => (xs || []).map((x) => String(x.id)).sort().join(",");
  const city = (g.cities || [])[0];
  return {
    "geo": city ? `city ${city.key} r=${city.radius}${city.distance_unit === "mile" ? "mi" : "km"}` : `countries ${(g.countries || []).join(",") || "none"}`,
    // Meta stores "home,recent" as home, recent and frequently_in (people living in or recently in); same thing.
    "location_types": (g.location_types || []).filter((x: string) => x !== "frequently_in").sort().join(","),
    "ages": `${t.age_min ?? "?"}-${t.age_max ?? "?"}`,
    "locales": (t.locales || []).slice().sort((p: number, q: number) => p - q).join(","),
    "include": ids(t.custom_audiences),
    "exclude": ids(t.excluded_custom_audiences),
    "advantage_audience": String(t.targeting_automation?.advantage_audience ?? 0),
    "optimization_goal": String(a.optimization_goal || ""),
    "billing_event": String(a.billing_event || ""),
    "destination_type": String(a.destination_type || ""),
    "attribution": (a.attribution_spec || []).map((x: any) => `${x.event_type}:${x.window_days}`).join(","),
    "daily_budget": String(a.daily_budget ?? ""),
  };
}

export interface Diff { field: string; from: string; to: string }
export function diffFields(current: any, desired: Desired): Diff[] {
  const c = flatten(current), d = flatten(desired);
  return Object.keys(d).filter((k) => c[k] !== d[k]).map((field) => ({ field, from: c[field], to: d[field] }));
}

const TARGETING_FIELDS = new Set(["geo", "location_types", "ages", "locales", "include", "exclude", "advantage_audience"]);

// The POST body for a set of diffs: targeting goes as one object when any of its fields moved.
export function postBody(diffs: Diff[], desired: Desired): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (diffs.some((d) => TARGETING_FIELDS.has(d.field))) body.targeting = desired.targeting;
  for (const d of diffs) {
    if (TARGETING_FIELDS.has(d.field)) continue;
    if (d.field === "attribution") body.attribution_spec = desired.attribution_spec;
    else body[d.field] = (desired as any)[d.field];
  }
  return body;
}

// ---------- the cap, pure ----------

export interface MonthInputs {
  dailyChf: Record<string, number>;         // every running ad set's daily budget, old set included
  rampsChf: Record<string, number>;         // ramp minus base per ramped ad set (0 when none)
  rampDays: number;                          // days per show at the ramp figure
  showsPerMonth: number;
}
export const DAYS_PER_MONTH = 30.4;

export function projectedMonthChf(m: MonthInputs): number {
  const base = Object.values(m.dailyChf).reduce((s, v) => s + v, 0) * DAYS_PER_MONTH;
  const ramps = Object.values(m.rampsChf).reduce((s, v) => s + Math.max(0, v), 0) * m.rampDays * m.showsPerMonth;
  return Math.round((base + ramps) * 100) / 100;
}

// A write is allowed when it stays under the cap, or when it lowers the projection (a refusal
// must never keep spend high).
export function capAllows(currentChf: number, projectedChf: number, capChf: number): { ok: boolean; reason: string } {
  if (projectedChf <= capChf) return { ok: true, reason: `projected CHF ${projectedChf} within the CHF ${capChf} cap` };
  if (projectedChf < currentChf) return { ok: true, reason: `projected CHF ${projectedChf} is over the CHF ${capChf} cap but lower than today's CHF ${currentChf}` };
  return { ok: false, reason: `projected CHF ${projectedChf} would exceed the CHF ${capChf} cap (today CHF ${currentChf}); lower budgets in config or raise monthly_cap_chf` };
}

// Comedy Brew dates in the next 30 days, from the calendar (never from config).
export function showsInNext30Days(calendarYaml: string, rampShows: string[], today: string): number {
  const cal = Bun.YAML.parse(calendarYaml) as { events?: { show: string; date: string }[] };
  const end = new Date(today); end.setDate(end.getDate() + 30);
  const endIso = end.toISOString().slice(0, 10);
  return (cal.events || []).filter((e) => rampShows.includes(e.show) && e.date >= today && e.date <= endIso).length;
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); return; }
  const apply = flagBool(args, "apply") && !flagBool(args, "dry-run");
  const validate = flagBool(args, "validate") && !apply;
  const only = flagString(args, "adset") as BankKey | undefined;
  if (only && !BANK_KEYS.includes(only)) fail(`--adset must be one of ${BANK_KEYS.join(", ")}`);
  const config: MetaConfig = loadConfig();
  if (!config.targeting) fail("config has no targeting: block (see meta-ads/config.example.yml)");
  const meta = metaFromEnv(config);
  const keys = only ? [only] : BANK_KEYS;

  // Every ad set that spends, for the cap arithmetic: the bank sets, Buyers and the old set.
  const running: Record<string, number> = {};
  for (const [k, id] of Object.entries(config.adsets)) {
    const a = await meta.get(id, { fields: "daily_budget,effective_status" });
    running[k] = a.effective_status === "ACTIVE" || a.effective_status === "CAMPAIGN_PAUSED" ? minorToChf(a.daily_budget) : 0;
  }
  if (config.old_adset_id) { const o = await meta.get(config.old_adset_id, { fields: "daily_budget,effective_status" }); running.old = o.effective_status === "ACTIVE" ? minorToChf(o.daily_budget) : 0; }
  const ramps: Record<string, number> = {};
  for (const [k, b] of Object.entries(config.budgets)) ramps[k] = (b.ramp ?? b.base) - b.base;
  const shows = showsInNext30Days(readFileSync(join(REPO_ROOT, "_data", "calendar.yml"), "utf8"), config.ramp_shows || [], new Date().toISOString().slice(0, 10));
  const current = projectedMonthChf({ dailyChf: running, rampsChf: ramps, rampDays: 3, showsPerMonth: shows });
  // After: the bank sets at their base; Buyers at its base too, because the lineup script runs
  // it at the ramp figure only from Monday to show day (its ramp is counted with the others).
  const after: Record<string, number> = { ...running, buyers: config.budgets.buyers?.base ?? running.buyers ?? 0 };
  for (const k of keys) after[k] = config.budgets[k].base;
  const projected = projectedMonthChf({ dailyChf: after, rampsChf: ramps, rampDays: 3, showsPerMonth: shows });
  const cap = capAllows(current, projected, config.monthly_cap_chf);
  log(`month:     today CHF ${current} (daily ${Object.entries(running).map(([k, v]) => `${k} ${v}`).join(", ")}; ${shows} ramped shows in 30 days)`);
  log(`month:     after CHF ${projected}: ${cap.reason}`);

  let wrote = 0;
  for (const key of keys) {
    const spec = config.targeting[key];
    if (!spec) { warn(`${key}: no targeting spec in config, skipped`); continue; }
    const id = config.adsets[key];
    if (!id) { warn(`${key}: config.adsets.${key} is empty, skipped`); continue; }
    if (id === config.old_adset_id || id === config.adsets.buyers) fail(`${key} points at a protected ad set (${id})`);
    const cur = await meta.get(id, { fields: "name,effective_status,daily_budget,optimization_goal,billing_event,destination_type,promoted_object,attribution_spec,targeting" });
    const desired = desiredFor(spec, config.audiences, config.pixel_id, config.budgets[key].base);
    const diffs = diffFields(cur, desired);
    log(`\n${key}: ${cur.name} (${id}) ${cur.effective_status}`);
    if (!diffs.length) { log(`  in sync`); continue; }
    for (const d of diffs) log(`  ${d.field.padEnd(18)} ${d.from || "(none)"}  ->  ${d.to || "(none)"}`);
    // Meta accepts a tiny include audience and then under-delivers, so warn from the size, not the error.
    for (const k of spec.include) {
      try { const s = await meta.get(config.audiences[k], { fields: "name,approximate_count_lower_bound,approximate_count_upper_bound" }); if (Number(s.approximate_count_upper_bound) < 1000) warn(`${key}: included audience ${s.name} is ${s.approximate_count_lower_bound} to ${s.approximate_count_upper_bound} people; it will under-deliver`); } catch { /* size is advisory */ }
    }
    if (!apply && !validate) continue;
    if (apply && !cap.ok) { warn(`${key}: not written, ${cap.reason}`); continue; }
    if (apply && !(await confirm(`  write these ${diffs.length} fields to ${key}?`, { yes: flagBool(args, "yes"), defaultYes: false }))) { log(`  skipped`); continue; }
    const extra = validate ? { execution_options: ["validate_only"] } : {};
    let body = { ...postBody(diffs, desired), ...extra };
    const send = async (b: Record<string, unknown>) => {
      try { return await meta.post(id, b); } catch (e) {
        const msg = e instanceof MetaApiError ? `${e.detail.message} ${e.detail.error_user_msg || ""}` : String(e);
        // Meta refuses an include list whose audiences are too small: drop show_clickers once.
        if (/too small|not large enough|audience size/i.test(msg) && spec.include.length > 1 && b.targeting) {
          const slim = { ...spec, include: spec.include.filter((k) => k !== "show_clickers") };
          warn(`${key}: Meta rejected the include list (${msg.trim()}); retrying with ${slim.include.join(", ")}`);
          return meta.post(id, { ...postBody(diffs, desiredFor(slim, config.audiences, config.pixel_id, config.budgets[key].base)), ...extra });
        }
        // The pixel as promoted object is not always accepted on an edit; landing page views work without it.
        if (/promoted.object|pixel/i.test(msg) && b.promoted_object) {
          warn(`${key}: Meta rejected promoted_object (${msg.trim()}); retrying without it`);
          const { promoted_object: _drop, ...rest } = b;
          return meta.post(id, rest);
        }
        throw e;
      }
    };
    if (validate) {
      try { const r = await send(body); log(`  validate_only: Meta accepts this write (${JSON.stringify(r)})`); }
      catch (e) { warn(`${key}: validate_only REJECTED: ${e instanceof MetaApiError ? e.message : String(e)}`); }
      continue;
    }
    await send(body);
    const back = await meta.get(id, { fields: "daily_budget,optimization_goal,billing_event,destination_type,promoted_object,attribution_spec,targeting" });
    const left = diffFields(back, desired);
    if (left.length) warn(`${key}: after the write ${left.length} fields still differ: ${left.map((d) => `${d.field} ${d.from} != ${d.to}`).join("; ")}`);
    else log(`  written and read back: in sync`);
    wrote++;
  }
  log(`\n${apply ? `${wrote} ad set(s) written` : validate ? "validate only; nothing written" : "diff only; add --validate to have Meta check it, --apply to write"}`);
}

if (import.meta.main) {
  main().then(() => healthcheck("META_ADS_HEALTHCHECKS_URL", true)).catch(async (e) => {
    await healthcheck("META_ADS_HEALTHCHECKS_URL", false, String(e?.message || e));
    fail(String(e?.message || e));
  });
}

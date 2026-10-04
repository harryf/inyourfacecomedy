// The moment scheduler (plan: meta-ads/moments-plan.md). Six moment ad sets in the Comedy Brew
// campaign, cold and warm times planner, tomorrow and tonight, each holding the bank's moment ads
// (meta-ads/bank/*.yml, a `moment:` block). Every run puts Meta in the state that is right for
// this moment, so one daily cron line covers the week and a missed run is caught by the next:
//
//   Saturday to Monday before a show   the planner ad sets run, until Monday 23:59
//   Wednesday                          the tomorrow ad sets run, until 23:59
//   Thursday (show day)                the tonight ad sets run, until 19:30
//   any other time                     all six paused; the evergreen Cold and Warm keep running
//
// Inside an open ad set one condition picks the ads: long weekend (the Friday after the show is a
// Zürich holiday), wet (MeteoSwiss forecast for show day, read fresh on every run), or any. The
// end of each window is written on the ad set itself, so Meta stops "tonight" at 19:30 even when
// this Mac is asleep. A run that does not happen means no moment ads that day, never wrong ones.
// Budgets: meta-ads/config.yml `moments:` (envelope, Cold share, split by moment, boosts), the
// evergreen Cold and Warm daily budgets included. The old carousel is never touched.
//
//   bun script/meta-moments.ts --setup --validate   # Meta checks the six ad sets, nothing written
//   bun script/meta-moments.ts --setup              # create the six ad sets (paused) and their ads
//   bun script/meta-moments.ts --dry-run            # what this moment needs, nothing written
//   bun script/meta-moments.ts                      # make Meta match (the daily cron run)
//   bun script/meta-moments.ts --dry-run --at 2026-10-08T08:00:00+02:00   # pretend it is then
//
// Writes script/meta-out/moments-<date>.md (gitignored); ids in meta-ads/creative/bank/moments-state.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { OUT_DIR, REPO_ROOT, chfToMinor, healthcheck, loadConfig, metaFromEnv, minorToChf, type MetaConfig } from "./lib/meta-api";
import { CREATIVE_DIR, adName, creativeSpec, imageFiles, loadBank, patient, uploadImage, writeBoard, type Bank, type Concept } from "./meta-bank";
import { AUDIENCES, MOMENT_PHASES, budgetPlan, csvRows, holidaysFromApi, isLongWeekend, nextShow, openWindow, pickWhen, wetVerdict, windowsFor, zurichHolidays, zurichParts, type Audience, type MomentPhase, type MomentsConfig, type WeatherVerdict } from "./lib/moments-lib";

const USAGE = `usage: bun script/meta-moments.ts [--setup [--validate]] [--dry-run] [--at ISO]`;
const STATE_FILE = join(CREATIVE_DIR, "moments-state.json");   // gitignored with the rest of creative/
const HC = "META_MOMENTS_HEALTHCHECKS_URL";
const COPY_FIELDS = "targeting,optimization_goal,billing_event,bid_strategy,destination_type,attribution_spec,promoted_object";

export interface MomentsState {
  adsets: Record<string, string>;                                   // "cold-tonight" -> ad set id
  ads: Record<string, { ad_id: string; creative_id: string; adset: string; phase: MomentPhase; when: string }>;   // "cold-C24"
}
export function readMomentsState(file = STATE_FILE): MomentsState {
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return { adsets: {}, ads: {} }; }
}
function saveState(s: MomentsState) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n"); }

function momentsConfig(config: MetaConfig): MomentsConfig {
  const m = (config as any).moments as MomentsConfig | undefined;
  if (!m) fail("meta-ads/config.yml has no moments: block (see config.example.yml)");
  return m;
}
const adsetKey = (aud: Audience, phase: MomentPhase) => `${aud}-${phase}`;
function momentConcepts(bank: Bank, phase: MomentPhase): Concept[] { return bank.concepts.filter((c) => c.moment?.phase === phase && c.status !== "retired"); }

// ---------- setup ----------

async function setup(validate: boolean, dryRun: boolean) {
  const config = loadConfig();
  const act = config.ad_account_id;
  const mc = momentsConfig(config);
  const meta = metaFromEnv(config);
  const state = readMomentsState();
  for (const aud of AUDIENCES) {
    const parentId = config.adsets[aud];
    const parent = await meta.get(parentId, { fields: COPY_FIELDS });
    const bank = loadBank(aud);
    for (const phase of MOMENT_PHASES) {
      const key = adsetKey(aud, phase);
      const concepts = momentConcepts(bank, phase);
      if (!concepts.length) { warn(`${key}: no moment concepts in the bank, skipped`); continue; }
      const body: Record<string, unknown> = {
        name: key, campaign_id: config.campaign_id, status: "PAUSED",
        daily_budget: chfToMinor(mc.floor_chf),
        targeting: parent.targeting, optimization_goal: parent.optimization_goal, billing_event: parent.billing_event,
        bid_strategy: parent.bid_strategy, destination_type: parent.destination_type, attribution_spec: parent.attribution_spec,
        promoted_object: parent.promoted_object ? { page_id: parent.promoted_object.page_id } : undefined,
      };
      if (dryRun) { log(`${key}: would create (targeting of ${aud}) with ${concepts.map((c) => c.id).join(", ")}`); continue; }
      if (validate) {
        // Meta wants a daily-budget ad set scheduled for 24 hours or more, counted from its
        // start_time. The ad sets start the day they are made, so the daily run's short windows
        // (tonight is 07:00 to 19:30) are always days after the start; creation is checked with 25 h.
        const end = new Date(Date.now() + 25 * 3600_000).toISOString();
        const r = await patient(`${key} validate`, () => meta.post(`${act}/adsets`, { ...body, end_time: end, execution_options: ["validate_only"] }));
        log(`${key}: validate_only ${JSON.stringify(r)}`);
        continue;
      }
      let adsetId = state.adsets[key];
      if (!adsetId) {
        const r = await patient(`${key} ad set`, () => meta.post(`${act}/adsets`, body));
        adsetId = String(r.id); state.adsets[key] = adsetId; saveState(state);
        log(`${key}: ad set ${adsetId} created, paused`);
      } else log(`${key}: ad set ${adsetId} already there`);
      const momentBank: Bank = { ...bank, link: { ...bank.link, utm_campaign: key } };
      for (const c of concepts) {
        const name = adName(aud, c);
        if (state.ads[name]) { log(`${name}: ad ${state.ads[name].ad_id} already there`); continue; }
        const files = imageFiles(aud, c);
        if (!existsSync(files.post) || !existsSync(files.story)) fail(`${name}: no rendered images; run meta-bank.ts --render --local --only ${c.id}`);
        const post = await uploadImage(meta, act, name, files.post);
        const story = await uploadImage(meta, act, name, files.story);
        const creative = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, creativeSpec(config, aud, momentBank, c, { post, story })));
        // Created ACTIVE inside the paused ad set so Meta reviews it now, days before its window;
        // the daily run pauses every ad its condition does not pick.
        const ad = await patient(`${name} ad`, () => meta.post(`${act}/ads`, { name, adset_id: adsetId, creative: { creative_id: creative.id }, status: "ACTIVE" }));
        state.ads[name] = { ad_id: String(ad.id), creative_id: String(creative.id), adset: key, phase, when: c.moment!.when };
        saveState(state);
        log(`${name}: creative ${creative.id}, ad ${ad.id} in ${key}`);
      }
    }
  }
}

// ---------- conditions ----------

async function holidaysAround(show: string): Promise<{ dates: string[]; source: string }> {
  const from = show, to = new Date(Date.parse(show) + 3 * 86_400_000).toISOString().slice(0, 10);
  try {
    const r = await fetch(`https://openholidaysapi.org/PublicHolidays?countryIsoCode=CH&subdivisionCode=CH-ZH&languageIsoCode=EN&validFrom=${from}&validTo=${to}`, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`http ${r.status}`);
    return { dates: holidaysFromApi(await r.json()), source: "OpenHolidays" };
  } catch (e: any) {
    warn(`holidays: OpenHolidays failed (${e.message}), using the computed Zürich list`);
    const y = Number(show.slice(0, 4));
    return { dates: [...zurichHolidays(y), ...zurichHolidays(y + 1)], source: "computed" };
  }
}

const STAC = "https://data.geo.admin.ch/api/stac/v1/collections/ch.meteoschweiz.ogd-local-forecasting/items?limit=10";
// The newest model run of each parameter, read for two points only (the files cover every point
// in Switzerland, about 30 MB each for the hourly ones).
async function weather(show: string, mc: MomentsConfig): Promise<WeatherVerdict & { run: string }> {
  const items = await (await fetch(STAC, { signal: AbortSignal.timeout(30_000) })).json() as any;
  const assets = (items.features || []).flatMap((f: any) => Object.entries(f.assets || {}).map(([k, a]: [string, any]) => ({ k, href: a.href as string })));
  const newest = (param: string) => {
    const a = assets.filter((x: any) => x.k.includes(`.${param}.`)).sort((x: any, y: any) => (x.k < y.k ? 1 : -1))[0];
    if (!a) throw new Error(`no MeteoSwiss file for ${param}`);
    return a;
  };
  const get = async (param: string, point: string) => {
    const a = newest(param);
    const r = await fetch(a.href, { signal: AbortSignal.timeout(120_000) });
    if (!r.ok) throw new Error(`${param}: http ${r.status}`);
    return { rows: csvRows(await r.text(), point), run: a.k.split(".")[2] };
  };
  const rain = await get("rka150p0", mc.postcode_point);
  const chance = await get("rp0003i0", mc.postcode_point);
  const high = await get("tre200dx", mc.station_point);
  const v = wetVerdict(show, { dailyRainMm: rain.rows, rainChance3h: chance.rows, dailyMaxC: high.rows }, mc.wet_rule);
  return { ...v, run: rain.run };
}

// ---------- the daily run ----------

interface Change { what: string; from: string; to: string }

async function run(dryRun: boolean, atIso: string | undefined) {
  const now = atIso ? new Date(atIso) : new Date();
  if (Number.isNaN(now.getTime())) fail(`--at: not a date: ${atIso}`);
  const config = loadConfig();
  const mc = momentsConfig(config);
  const state = readMomentsState();
  if (!Object.keys(state.adsets).length) fail("no moment ad sets yet: run --setup first");
  const cal = Bun.YAML.parse(readFileSync(join(REPO_ROOT, "_data", "calendar.yml"), "utf8")) as { events?: { show: string; date: string }[] };
  const show = nextShow(cal.events || [], now);
  const window = show ? openWindow(show, now) : null;
  const lines: string[] = [];
  const say = (s: string) => { log(s); lines.push(s); };
  const z = zurichParts(now);
  say(`# Moments, ${z.date} ${String(z.hour).padStart(2, "0")}:${String(z.minute).padStart(2, "0")}${dryRun ? " (dry run)" : ""}`);
  say("");
  say(show ? `Next Comedy Brew: ${show}. Windows: ${windowsFor(show).map((w) => `${w.phase} ${w.from}${w.until !== w.from ? ` to ${w.until}` : ""} until ${w.endIso.slice(11, 16)}`).join("; ")}.` : "No Comedy Brew in the next six days: every moment ad set paused.");
  say(`Open now: ${window ? window.phase : "none"}.`);

  let longWeekend = false, wet = false;
  if (show) {
    const h = await holidaysAround(show);
    longWeekend = isLongWeekend(show, h.dates);
    say(`Holidays (${h.source}): the Friday after the show is ${longWeekend ? "a holiday: long weekend" : "a working day"}.`);
    try {
      const w = await weather(show, mc);
      wet = w.wet;
      say(`Weather (MeteoSwiss run ${w.run}, postcode point ${mc.postcode_point}, station ${mc.station_point}): ${w.facts}. ${w.wet ? `Wet: ${w.reasons.join("; ")}.` : "Not wet."}`);
    } catch (e: any) {
      warn(`weather: ${e.message}; treated as not wet`);
      say(`Weather: unavailable (${e.message}); treated as not wet.`);
    }
  }
  const plan = budgetPlan(mc, longWeekend, wet, config.monthly_cap_chf);
  say(`Budget plan: CHF ${plan.week_chf} for the show week, boosts planner ${plan.boost.planner}, tomorrow ${plan.boost.tomorrow}, tonight ${plan.boost.tonight}.${plan.note ? ` ${plan.note}.` : ""}`);
  say("");

  const meta = metaFromEnv(config);
  const changes: Change[] = [];
  const write = async (id: string, label: string, body: Record<string, unknown>, from: string, to: string) => {
    changes.push({ what: label, from, to });
    if (!dryRun) await patient(label, () => meta.post(id, body));
  };

  // The evergreen budgets first: they run whatever the moment.
  for (const aud of AUDIENCES) {
    const cur = await meta.get(config.adsets[aud], { fields: "daily_budget" });
    const want = chfToMinor(plan.daily[aud]);
    if (Number(cur.daily_budget) !== want) await write(config.adsets[aud], `${aud} daily budget`, { daily_budget: want }, `CHF ${minorToChf(cur.daily_budget)}`, `CHF ${plan.daily[aud]}`);
  }

  for (const aud of AUDIENCES) for (const phase of MOMENT_PHASES) {
    const key = adsetKey(aud, phase);
    const id = state.adsets[key];
    if (!id) { warn(`${key}: not set up`); continue; }
    const cur = await meta.get(id, { fields: "status,daily_budget,end_time" });
    const ads = Object.entries(state.ads).filter(([, a]) => a.adset === key);
    const open = window?.phase === phase;
    if (!open) {
      if (cur.status !== "PAUSED") await write(id, `${key} status`, { status: "PAUSED" }, cur.status, "PAUSED");
      continue;
    }
    // Pick the ads, falling back to the any line when the bank has no ad for the condition.
    let when = pickWhen(phase, longWeekend, wet);
    if (!ads.some(([, a]) => a.when === when)) { warn(`${key}: no ${when} ad, running the any line`); when = "any"; }
    // Ads before the ad set, so the wrong line never runs for a moment.
    for (const [name, a] of ads) {
      const want = a.when === when ? "ACTIVE" : "PAUSED";
      const curAd = await meta.get(a.ad_id, { fields: "status" });
      if (curAd.status !== want) await write(a.ad_id, `${name} status`, { status: want }, curAd.status, want);
    }
    const body: Record<string, unknown> = {};
    const wantBudget = chfToMinor(plan.daily[key]);
    const wantEnd = Date.parse(window!.endIso);
    if (Number(cur.daily_budget) !== wantBudget) body.daily_budget = wantBudget;
    if (!cur.end_time || Date.parse(cur.end_time) !== wantEnd) body.end_time = window!.endIso;
    if (cur.status !== "ACTIVE") body.status = "ACTIVE";
    if (Object.keys(body).length) await write(id, `${key} (${when})`, body, `${cur.status}, CHF ${minorToChf(cur.daily_budget)}, ends ${cur.end_time || "never"}`, `ACTIVE, CHF ${plan.daily[key]}, ends ${window!.endIso}`);
    else changes.push({ what: `${key} (${when})`, from: "as wanted", to: "no change" });
  }

  say("| Change | From | To |");
  say("|---|---|---|");
  for (const c of changes) say(`| ${c.what} | ${c.from} | ${c.to} |`);
  if (!changes.length) say("| nothing to do | | |");

  if (!dryRun) {
    say("");
    say("Read back:");
    for (const [key, id] of Object.entries(state.adsets)) {
      const b = await meta.get(id, { fields: "status,effective_status,daily_budget,end_time" });
      const on = Object.entries(state.ads).filter(([, a]) => a.adset === key);
      const st = await Promise.all(on.map(async ([n, a]) => `${n} ${(await meta.get(a.ad_id, { fields: "status" })).status}`));
      say(`- ${key}: ${b.status}/${b.effective_status}, CHF ${minorToChf(b.daily_budget)}, ends ${b.end_time || "never"}; ${st.join(", ")}`);
    }
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const file = join(OUT_DIR, `moments-${z.date}.md`);
  (existsSync(file) ? appendFileSync : writeFileSync)(file, (existsSync(file) ? "\n\n" : "") + lines.join("\n") + "\n");
  log(`\nwritten to ${file}`);
  // The local board shows what runs, so it follows every real run.
  if (!dryRun) { const b = await writeBoard(); log(`board ${b.file}: ${b.rows} ads, states ${b.live ? "read from Meta" : "from the bank files"}`); }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); return; }
  if (flagBool(args, "setup")) return setup(flagBool(args, "validate"), flagBool(args, "dry-run"));
  return run(flagBool(args, "dry-run"), flagString(args, "at"));
}

if (import.meta.main) {
  const dry = process.argv.includes("--dry-run") || process.argv.includes("--setup");
  main().then(() => dry ? undefined : healthcheck(HC, true)).catch(async (e) => {
    if (!dry) await healthcheck(HC, false, String(e?.message || e));
    fail(String(e?.message || e));
  });
}

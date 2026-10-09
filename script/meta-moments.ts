// The moment scheduler (plan: meta-ads/moments-plan.md). Moment ad sets in the Comedy Brew
// campaign, cold and warm, hold the bank's moment ads (meta-ads/bank/*.yml, a `moment:` block).
// Every run puts Meta in the state that is right for this moment, so one daily cron line covers
// the week and a missed run is caught by the next:
//
//   Saturday to Monday before a show   the planner ad sets (persistent, daily budget) run, until Monday 23:59
//   Wednesday                          "cold-tomorrow <show>" and the warm one run, 00:00 to 23:59
//   Thursday (show day)                "cold-tonight <show>" and the warm one run, 00:00 to 18:00
//   any other time                     nothing of the above; the evergreen Cold and Warm keep running
//
// The tomorrow and tonight ad sets are made fresh for every show, as soon as it is within six
// days (the Friday before): lifetime budget, start and end written on Meta, their ads reviewed
// days ahead. Meta starts and stops them by itself and paces the whole budget into the window, so
// a sleeping Mac costs nothing but the weather pick. Inside each ad set one condition picks the
// ad: long weekend (the Friday after the show is a Zürich holiday), wet (MeteoSwiss forecast for
// show day, read fresh on every run), or any; the others are paused. A run that does not happen
// leaves the last pick, never a wrong line. Budgets: meta-ads/config.yml `moments:` (envelope,
// Cold share, split by moment, boosts), the evergreen Cold and Warm daily budgets included. The
// old carousel is never touched.
//
//   bun script/meta-moments.ts --setup --validate   # Meta checks the planner ad sets, nothing written
//   bun script/meta-moments.ts --setup              # create the planner ad sets (paused) and their ads
//   bun script/meta-moments.ts --dry-run            # what this moment needs, nothing written
//   bun script/meta-moments.ts --dry-run --validate # the same, and Meta checks the week's ad set bodies (validate_only)
//   bun script/meta-moments.ts                      # make Meta match (the daily cron run)
//   bun script/meta-moments.ts --dry-run --at 2026-10-08T08:00:00+02:00   # pretend it is then
//
// Writes script/meta-out/moments-<date>.md (gitignored); ids in meta-ads/creative/bank/moments-state.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { OUT_DIR, REPO_ROOT, chfToMinor, healthcheck, loadConfig, metaFromEnv, minorToChf, type MetaConfig } from "./lib/meta-api";
import { CREATIVE_DIR, adName, creativeSpec, imageFiles, loadBank, patient, uploadImage, writeBoard, type Bank, type Concept } from "./meta-bank";
import { AUDIENCES, PERSISTENT_PHASES, WINDOWED_PHASES, adsetKey, budgetPlan, csvRows, holidaysFromApi, isLongWeekend, migrateState, nextShow, openWindow, orphanWindows, pickWhen, wetVerdict, windowAdsetName, windowBudgetChf, windowFor, windowStart, windowsFor, zurichHolidays, zurichParts, type Audience, type MomentPhase, type MomentsConfig, type MomentsState, type WeatherVerdict, type WindowSet } from "./lib/moments-lib";

const USAGE = `usage: bun script/meta-moments.ts [--setup [--validate]] [--dry-run [--validate]] [--at ISO]`;
const STATE_FILE = join(CREATIVE_DIR, "moments-state.json");   // gitignored with the rest of creative/
const HC = "META_MOMENTS_HEALTHCHECKS_URL";
const COPY_FIELDS = "targeting,optimization_goal,billing_event,bid_strategy,destination_type,attribution_spec,promoted_object";

// The state file (shape and migration: moments-lib.ts MomentsState). Read migrated in memory;
// a real run saves it.
export function readMomentsState(file = STATE_FILE): MomentsState {
  let s: MomentsState;
  try { s = JSON.parse(readFileSync(file, "utf8")); } catch { s = { adsets: {}, ads: {} }; }
  migrateState(s);
  return s;
}
function saveState(s: MomentsState) { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2) + "\n"); }

function momentsConfig(config: MetaConfig): MomentsConfig {
  const m = (config as any).moments as MomentsConfig | undefined;
  if (!m) fail("meta-ads/config.yml has no moments: block (see config.example.yml)");
  return m;
}
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
    for (const phase of PERSISTENT_PHASES) {
      const key = adsetKey(aud, phase);
      const concepts = momentConcepts(bank, phase);
      if (!concepts.length) { warn(`${key}: no moment concepts in the bank, skipped`); continue; }
      const body: Record<string, unknown> = { name: key, status: "PAUSED", daily_budget: chfToMinor(mc.floor_chf), ...adsetBase(config, parent) };
      if (dryRun) { log(`${key}: would create (targeting of ${aud}) with ${concepts.map((c) => c.id).join(", ")}`); continue; }
      if (validate) {
        // Meta wants a daily-budget ad set scheduled for 24 hours or more, counted from its
        // start_time. The planner sets start the day they are made, so the three-day windows
        // are always days after the start; creation is checked with 25 h.
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
        const creativeId = await ensureCreative(meta, act, config, aud, momentBank, c, state);
        // Created ACTIVE inside the paused ad set so Meta reviews it now, days before its window;
        // the daily run pauses every ad its condition does not pick.
        const ad = await patient(`${name} ad`, () => meta.post(`${act}/ads`, { name, adset_id: adsetId, creative: { creative_id: creativeId }, status: "ACTIVE" }));
        state.ads[name] = { ad_id: String(ad.id), creative_id: creativeId, adset: key, phase, when: c.moment!.when };
        saveState(state);
        log(`${name}: creative ${creativeId}, ad ${ad.id} in ${key}`);
      }
    }
  }
}

// What every moment ad set copies from its evergreen parent.
function adsetBase(config: MetaConfig, parent: any): Record<string, unknown> {
  return {
    campaign_id: config.campaign_id,
    targeting: parent.targeting, optimization_goal: parent.optimization_goal, billing_event: parent.billing_event,
    bid_strategy: parent.bid_strategy, destination_type: parent.destination_type, attribution_spec: parent.attribution_spec,
    promoted_object: parent.promoted_object ? { page_id: parent.promoted_object.page_id } : undefined,
  };
}
// One creative per concept, made once and reused by every week's ad (its url_tags carry
// utm_campaign = the bare key, so reports keep grouping by moment).
async function ensureCreative(meta: ReturnType<typeof metaFromEnv>, act: string, config: MetaConfig, aud: Audience, momentBank: Bank, c: Concept, state: MomentsState): Promise<string> {
  const name = adName(aud, c);
  const have = state.creatives?.[name];
  if (have) return have;
  const files = imageFiles(aud, c);
  if (!existsSync(files.post) || !existsSync(files.story)) fail(`${name}: no rendered images; run meta-bank.ts --render --local --only ${c.id}`);
  const post = await uploadImage(meta, act, name, files.post);
  const story = await uploadImage(meta, act, name, files.story);
  const creative = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, creativeSpec(config, aud, momentBank, c, { post, story })));
  (state.creatives ||= {})[name] = String(creative.id);
  saveState(state);
  return String(creative.id);
}

// ---------- the week's window ad sets ----------

// The tomorrow and tonight ad sets for this show, made when missing: lifetime budget for the
// window, start and end on Meta, ACTIVE from the first second (Meta waits for the start), the
// phase's three ads inside from the stored creatives. A window that has ended is never made; one
// whose start has passed starts now. Returns the sets, by key, with their ads.
async function ensureWindowSets(meta: ReturnType<typeof metaFromEnv>, config: MetaConfig, state: MomentsState, show: string, plan: { daily: Record<string, number> }, now: Date, dryRun: boolean, validate: boolean, say: (s: string) => void): Promise<Record<string, WindowSet>> {
  const act = config.ad_account_id;
  const sets = ((state.windows ||= {})[show] ||= {});
  for (const aud of AUDIENCES) {
    let parent: any;
    const bank = loadBank(aud);
    for (const phase of WINDOWED_PHASES) {
      const key = adsetKey(aud, phase);
      const w = windowFor(show, phase);
      const start = windowStart(w, now);
      if (start === "ended") continue;
      const concepts = momentConcepts(bank, phase);
      if (!concepts.length) { warn(`${key}: no moment concepts in the bank, skipped`); continue; }
      const name = windowAdsetName(aud, phase, show);
      const chf = windowBudgetChf(plan, aud, phase);
      const momentBank: Bank = { ...bank, link: { ...bank.link, utm_campaign: key } };
      // Ads missing from a set (a run that died on Meta's request limit halfway) are made on the
      // next run, so a set never stays short of a line.
      const fillAds = async (set: WindowSet) => {
        for (const c of concepts) {
          const adName_ = adName(aud, c);
          if (set.ads[adName_]) continue;
          if (dryRun) { say(`  - would add ${adName_} to ${set.name}`); continue; }
          const creativeId = await ensureCreative(meta, act, config, aud, momentBank, c, state);
          // ACTIVE so Meta reviews it at once; the pick below pauses the lines the conditions do not choose.
          const ad = await patient(`${adName_} ad`, () => meta.post(`${act}/ads`, { name: adName_, adset_id: set.adset_id, creative: { creative_id: creativeId }, status: "ACTIVE" }));
          set.ads[adName_] = { ad_id: String(ad.id), when: c.moment!.when };
          state.ads[adName_] = { ad_id: String(ad.id), creative_id: creativeId, adset: key, phase, when: c.moment!.when };
          saveState(state);
          say(`  - ${adName_}: ad ${ad.id} (creative ${creativeId})`);
        }
      };
      if (sets[key]) { await fillAds(sets[key]); continue; }
      if (dryRun && !validate) { say(`- would create ${name}: lifetime CHF ${chf}, ${start.start_time ? `starts ${start.start_time}` : "starts now"}, ends ${w.endIso}, ads ${concepts.map((c) => adName(aud, c)).join(", ")}`); continue; }
      parent ||= await meta.get(config.adsets[aud], { fields: COPY_FIELDS });
      const body = { name, status: "ACTIVE", lifetime_budget: chfToMinor(chf), ...start, end_time: w.endIso, ...adsetBase(config, parent) };
      if (dryRun) {
        // Meta checks the exact body it would get, writes nothing.
        const v = await patient(`${name} validate`, () => meta.post(`${act}/adsets`, { ...body, execution_options: ["validate_only"] }));
        say(`- would create ${name}: lifetime CHF ${chf}, ${start.start_time ? `starts ${start.start_time}` : "starts now"}, ends ${w.endIso}, ads ${concepts.map((c) => adName(aud, c)).join(", ")}; Meta validate_only ${JSON.stringify(v)}`);
        continue;
      }
      const r = await patient(`${name} ad set`, () => meta.post(`${act}/adsets`, body));
      const set: WindowSet = { adset_id: String(r.id), name, start: start.start_time || now.toISOString(), end: w.endIso, ads: {} };
      sets[key] = set; saveState(state);
      say(`- created ${name} (${set.adset_id}): lifetime CHF ${chf}, ${start.start_time ? `starts ${start.start_time}` : "starts now"}, ends ${w.endIso}`);
      await fillAds(set);
    }
  }
  return sets;
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

async function run(dryRun: boolean, validate: boolean, atIso: string | undefined) {
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
  say(show ? `Next Comedy Brew: ${show}. Windows: ${windowsFor(show).map((w) => `${w.phase} ${w.from}${w.until !== w.from ? ` to ${w.until}` : ""} until ${w.endIso.slice(11, 16)}`).join("; ")}.` : "No Comedy Brew in the next six days: the planner ad sets paused, no week's ad sets to make.");
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

  // The pick for a phase, falling back to the any line when the bank has no ad for the condition;
  // ads are written before their ad set, so the wrong line never runs for a moment.
  const pickAds = async (key: string, phase: MomentPhase, ads: [string, { ad_id: string; when: string }][]) => {
    let when = pickWhen(phase, longWeekend, wet);
    if (!ads.some(([, a]) => a.when === when)) { warn(`${key}: no ${when} ad, running the any line`); when = "any"; }
    if (!ads.some(([, a]) => a.when === when)) warn(`${key}: no ad for ${when} either, nothing will run`);
    for (const [name, a] of ads) {
      const want = a.when === when ? "ACTIVE" : "PAUSED";
      const curAd = await meta.get(a.ad_id, { fields: "status" });
      if (curAd.status !== want) await write(a.ad_id, `${name} status`, { status: want }, curAd.status, want);
    }
    return when;
  };

  // The persistent planner sets: on inside their window with the end written, off outside it.
  for (const aud of AUDIENCES) for (const phase of PERSISTENT_PHASES) {
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
    const when = await pickAds(key, phase, ads);
    const body: Record<string, unknown> = {};
    const wantBudget = chfToMinor(plan.daily[key]);
    const wantEnd = Date.parse(window!.endIso);
    if (Number(cur.daily_budget) !== wantBudget) body.daily_budget = wantBudget;
    if (!cur.end_time || Date.parse(cur.end_time) !== wantEnd) body.end_time = window!.endIso;
    if (cur.status !== "ACTIVE") body.status = "ACTIVE";
    if (Object.keys(body).length) await write(id, `${key} (${when})`, body, `${cur.status}, CHF ${minorToChf(cur.daily_budget)}, ends ${cur.end_time || "never"}`, `ACTIVE, CHF ${plan.daily[key]}, ends ${window!.endIso}`);
    else changes.push({ what: `${key} (${when})`, from: "as wanted", to: "no change" });
  }

  // The week's tomorrow and tonight sets: made when missing, then the pick, the lifetime budget
  // (the boost follows the forecast) and the end checked on every run. Status and start are Meta's.
  const windowSets = show ? await ensureWindowSets(meta, config, state, show, plan, now, dryRun, validate, say) : {};
  for (const aud of AUDIENCES) for (const phase of WINDOWED_PHASES) {
    const key = adsetKey(aud, phase);
    const set = windowSets[key];
    if (!set) continue;
    const w = windowFor(show!, phase);
    if (now.getTime() >= Date.parse(w.endIso)) continue;
    const cur = await meta.get(set.adset_id, { fields: "status,lifetime_budget,end_time" });
    const when = await pickAds(set.name, phase, Object.entries(set.ads));
    const body: Record<string, unknown> = {};
    const started = now.getTime() >= Date.parse(w.startIso);
    // Once the window runs, the budget never goes down: Meta refuses a lifetime budget under what
    // is spent, and a forecast that turns dry at noon is no reason to stop a line that is paced.
    let wantChf = windowBudgetChf(plan, aud, phase);
    if (started) wantChf = Math.max(wantChf, minorToChf(cur.lifetime_budget));
    if (Number(cur.lifetime_budget) !== chfToMinor(wantChf)) body.lifetime_budget = chfToMinor(wantChf);
    if (!cur.end_time || Date.parse(cur.end_time) !== Date.parse(w.endIso)) body.end_time = w.endIso;
    if (cur.status !== "ACTIVE") body.status = "ACTIVE";
    if (!Object.keys(body).length) { changes.push({ what: `${set.name} (${when})`, from: "as wanted", to: "no change" }); continue; }
    try {
      await write(set.adset_id, `${set.name} (${when})`, body, `${cur.status}, lifetime CHF ${minorToChf(cur.lifetime_budget)}, ends ${cur.end_time || "never"}`, `ACTIVE, lifetime CHF ${wantChf}, ends ${w.endIso}`);
    } catch (e: any) {
      // The ads are already right; a refused budget or end on a running set is worth a line, not a dead run.
      warn(`${set.name}: Meta refused ${JSON.stringify(body)}: ${e.message}`);
      changes.push({ what: `${set.name} (${when})`, from: "write refused", to: String(e.message).slice(0, 120) });
    }
  }
  // A show that left the calendar while its window was still ahead: its sets go off.
  const calDates = (cal.events || []).filter((e) => e.show === "comedybrew").map((e) => e.date);
  for (const o of orphanWindows(state, calDates, now)) {
    const cur = await meta.get(o.set.adset_id, { fields: "status" });
    if (cur.status !== "PAUSED") await write(o.set.adset_id, `${o.set.name} (show gone from the calendar)`, { status: "PAUSED" }, cur.status, "PAUSED");
  }
  if (!dryRun) saveState(state);

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
    for (const set of Object.values(windowSets)) {
      const b = await meta.get(set.adset_id, { fields: "status,effective_status,lifetime_budget,start_time,end_time" });
      const st = await Promise.all(Object.entries(set.ads).map(async ([n, a]) => { const x = await meta.get(a.ad_id, { fields: "status,effective_status" }); return `${n} ${x.status}/${x.effective_status}`; }));
      say(`- ${set.name}: ${b.status}/${b.effective_status}, lifetime CHF ${minorToChf(b.lifetime_budget)}, ${b.start_time} to ${b.end_time}; ${st.join(", ")}`);
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
  // A pretend time or a validate_only pass on a real run would create a set that starts now and
  // runs its line on the wrong day; both exist for dry runs only.
  if (!flagBool(args, "dry-run") && (flagBool(args, "validate") || flagString(args, "at"))) fail(`--validate and --at need --dry-run on the daily run\n${USAGE}`);
  return run(flagBool(args, "dry-run"), flagBool(args, "validate"), flagString(args, "at"));
}

if (import.meta.main) {
  const dry = process.argv.includes("--dry-run") || process.argv.includes("--setup");
  main().then(() => dry ? undefined : healthcheck(HC, true)).catch(async (e) => {
    if (!dry) await healthcheck(HC, false, String(e?.message || e));
    fail(String(e?.message || e));
  });
}

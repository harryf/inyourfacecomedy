// Pure parts of script/meta-moments.ts (plan: meta-ads/moments-plan.md): which moment today is,
// which ad each moment ad set runs, the weather and holiday rules, and the budget split.
// No network and no clock in here; the caller passes "now" and the fetched data.

export const MOMENT_PHASES = ["planner", "tomorrow", "tonight"] as const;
export type MomentPhase = typeof MOMENT_PHASES[number];
export type MomentWhen = "any" | "wet" | "long_weekend";
export type Audience = "cold" | "warm";
export const AUDIENCES: Audience[] = ["cold", "warm"];

export const TZ = "Europe/Zurich";
const DAY = 86_400_000;

// ---------- dates in Zürich ----------

// The Zürich calendar date and hour of an instant.
export function zurichParts(now: Date): { date: string; hour: number; minute: number; weekday: number } {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
}
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY);
}
// "2026-10-08", "19:30" -> "2026-10-08T19:30:00+02:00" (the offset Zürich has on that day).
export function zurichIso(date: string, time: string): string {
  const noon = new Date(`${date}T12:00:00Z`);
  const off = new Intl.DateTimeFormat("en", { timeZone: TZ, timeZoneName: "longOffset" }).formatToParts(noon).find((x) => x.type === "timeZoneName")!.value;
  const m = off.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return `${date}T${time}:00${m ? `${m[1]}:${m[2] || "00"}` : "+00:00"}`;
}

// ---------- windows ----------

// The show is a Thursday. Planner: Saturday to Monday before it (the Saturday run opens it; a
// missed Saturday is caught by Sunday's or Monday's run). Tomorrow: the Wednesday. Tonight: show
// day until doors close for online sales (19:30). The end is what Meta enforces.
export interface Window { phase: MomentPhase; from: string; until: string; endIso: string }
export const TONIGHT_ENDS = "19:30";
export function windowsFor(show: string): Window[] {
  return [
    { phase: "planner", from: addDays(show, -5), until: addDays(show, -3), endIso: zurichIso(addDays(show, -3), "23:59") },
    { phase: "tomorrow", from: addDays(show, -1), until: addDays(show, -1), endIso: zurichIso(addDays(show, -1), "23:59") },
    { phase: "tonight", from: show, until: show, endIso: zurichIso(show, TONIGHT_ENDS) },
  ];
}
// The window open at this instant, if any.
export function openWindow(show: string, now: Date): Window | null {
  const { date } = zurichParts(now);
  for (const w of windowsFor(show)) if (date >= w.from && date <= w.until && now.getTime() < Date.parse(w.endIso)) return w;
  return null;
}
// The next Comedy Brew from calendar.yml events: the first on or after today whose doors have
// not closed yet, at most 6 days ahead (further than that, no window is near).
export function nextShow(events: { show: string; date: string }[], now: Date, show = "comedybrew"): string | null {
  const { date } = zurichParts(now);
  const dates = [...new Set(events.filter((e) => e.show === show).map((e) => e.date))].sort();
  for (const d of dates) {
    if (d < date) continue;
    if (d === date && now.getTime() >= Date.parse(zurichIso(d, TONIGHT_ENDS))) continue;
    return daysBetween(date, d) <= 6 ? d : null;
  }
  return null;
}

// ---------- holidays ----------

// Zürich public holidays computed (the fallback when the OpenHolidays API is down): fixed dates
// plus Good Friday, Easter Monday, Ascension and Whit Monday.
export function easter(year: number): string {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function zurichHolidays(year: number): string[] {
  const e = easter(year);
  return [`${year}-01-01`, `${year}-01-02`, addDays(e, -2), addDays(e, 1), `${year}-05-01`, addDays(e, 39), addDays(e, 50), `${year}-08-01`, `${year}-12-25`, `${year}-12-26`].sort();
}
// OpenHolidays /PublicHolidays rows -> the dates that hold in canton Zürich (nationwide or CH-ZH,
// not the city-only ones such as Sechseläuten, which is an afternoon off for some).
export function holidaysFromApi(rows: { startDate: string; endDate?: string; nationwide?: boolean; subdivisions?: { code: string }[] }[]): string[] {
  const out = new Set<string>();
  for (const r of rows) {
    if (!(r.nationwide || (r.subdivisions || []).some((s) => s.code === "CH-ZH"))) continue;
    for (let d = r.startDate; d <= (r.endDate || r.startDate); d = addDays(d, 1)) out.add(d);
  }
  return [...out].sort();
}
export function isLongWeekend(show: string, holidays: string[]): boolean {
  return holidays.includes(addDays(show, 1));
}

// ---------- weather ----------

// MeteoSwiss open data, local forecast CSVs (point_id;point_type_id;Date;value; Date is UTC
// yyyymmddHHMM). Rows for one point only.
export function csvRows(text: string, pointId: string): { at: string; value: number }[] {
  const out: { at: string; value: number }[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith(`${pointId};`)) continue;
    const [, , at, v] = line.split(";");
    if (at && v !== undefined && v.trim() !== "") out.push({ at: at.trim(), value: Number(v) });
  }
  return out;
}
export const utcStamp = (iso: string) => new Date(iso).toISOString().replace(/[-:T]/g, "").slice(0, 12);

export interface WeatherInput {
  dailyRainMm: { at: string; value: number }[];     // rka150p0 at the postcode point
  rainChance3h: { at: string; value: number }[];    // rp0003i0 at the postcode point, percent
  dailyMaxC: { at: string; value: number }[];       // tre200dx at the station (postcodes carry no daily max)
}
export interface WetRule { rain_mm: number; chance_pct: number; drop_c: number }
export const DEFAULT_WET: WetRule = { rain_mm: 3, chance_pct: 60, drop_c: 5 };
export interface WeatherVerdict { wet: boolean; reasons: string[]; facts: string }
// Show day is "wet" when it rains a real amount, when rain is likely in the evening (17:00 to
// 21:00 Zürich), or when the day's high falls well below the two days before it.
export function wetVerdict(show: string, w: WeatherInput, rule: WetRule = DEFAULT_WET): WeatherVerdict {
  const day = (rows: { at: string; value: number }[], date: string) => rows.find((r) => r.at.startsWith(date.replace(/-/g, "")))?.value;
  const rain = day(w.dailyRainMm, show);
  const from = utcStamp(zurichIso(show, "17:00")), to = utcStamp(zurichIso(show, "21:00"));
  const evening = w.rainChance3h.filter((r) => r.at >= from && r.at <= to).map((r) => r.value);
  const chance = evening.length ? Math.max(...evening) : undefined;
  const high = day(w.dailyMaxC, show);
  const before = [day(w.dailyMaxC, addDays(show, -1)), day(w.dailyMaxC, addDays(show, -2))].filter((x): x is number => x !== undefined);
  const drop = high !== undefined && before.length ? Math.max(...before) - high : undefined;
  const reasons: string[] = [];
  if (rain !== undefined && rain >= rule.rain_mm) reasons.push(`rain ${rain} mm on the day`);
  if (chance !== undefined && chance >= rule.chance_pct) reasons.push(`${chance}% chance of rain in the evening`);
  if (drop !== undefined && drop >= rule.drop_c) reasons.push(`high ${high} °C, ${Math.round(drop * 10) / 10} °C below the days before`);
  const facts = `rain ${rain ?? "?"} mm, evening chance ${chance ?? "?"}%, high ${high ?? "?"} °C (before: ${before.join(", ") || "?"})`;
  return { wet: reasons.length > 0, reasons, facts };
}

// ---------- which ad runs ----------

// Long weekend beats wet (the stronger reason to go out); the planner has no wet line, because a
// forecast five days out is not worth a promise.
export function pickWhen(phase: MomentPhase, longWeekend: boolean, wet: boolean): MomentWhen {
  if (longWeekend) return "long_weekend";
  if (wet && phase !== "planner") return "wet";
  return "any";
}

// ---------- money ----------

export interface MomentsConfig {
  weekly_envelope_chf: number;          // Cold plus Warm per show week, the old carousel apart
  cold_share: number;                   // 0.7
  split: { planner: number; evergreen: number; tomorrow: number; tonight: number };   // shares of the envelope, sum 1
  wet_boost: number;                    // 1.5 on tomorrow and tonight
  long_weekend_boost: number;           // 1.5 on all three moments
  max_boost: number;                    // 1.75
  floor_chf: number;                    // the smallest daily budget written (Meta's minimum is 0.83)
  old_set_month_chf: number;            // the old carousel's month, for the cap check
  wet_rule?: WetRule;
  postcode_point: string;               // MeteoSwiss point id of the postcode (800100 = 8001 Zürich)
  station_point: string;                // MeteoSwiss station point for the daily high (71 = Zürich Fluntern)
}
export const DAYS: Record<MomentPhase | "evergreen", number> = { planner: 3, evergreen: 7, tomorrow: 1, tonight: 1 };

export interface BudgetPlan { daily: Record<string, number>; week_chf: number; boost: { planner: number; tomorrow: number; tonight: number }; note: string }
// Daily budgets per ad set key (cold, warm, cold-planner, ...), rounded to 5 Rappen, never under
// the floor. Boosts multiply the moment shares. The cap check: this week as planned plus 3.35
// plain weeks plus the old carousel's month; over the cap, the boosts go back to 1 (the base
// never moves here).
export function budgetPlan(cfg: MomentsConfig, longWeekend: boolean, wet: boolean, monthlyCapChf: number): BudgetPlan {
  const clamp = (x: number) => Math.min(x, cfg.max_boost);
  let boost = {
    planner: clamp(longWeekend ? cfg.long_weekend_boost : 1),
    tomorrow: clamp((longWeekend ? cfg.long_weekend_boost : 1) * (wet ? cfg.wet_boost : 1)),
    tonight: clamp((longWeekend ? cfg.long_weekend_boost : 1) * (wet ? cfg.wet_boost : 1)),
  };
  const build = (b: typeof boost) => {
    const daily: Record<string, number> = {};
    let week = 0;
    for (const aud of AUDIENCES) {
      const share = aud === "cold" ? cfg.cold_share : 1 - cfg.cold_share;
      for (const part of ["evergreen", ...MOMENT_PHASES] as const) {
        const mult = part === "evergreen" ? 1 : b[part];
        const perDay = Math.max(cfg.floor_chf, Math.round((cfg.weekly_envelope_chf * share * cfg.split[part] * mult / DAYS[part]) * 20) / 20);
        daily[part === "evergreen" ? aud : `${aud}-${part}`] = perDay;
        week += perDay * DAYS[part];
      }
    }
    return { daily, week: Math.round(week * 100) / 100 };
  };
  const plain = build({ planner: 1, tomorrow: 1, tonight: 1 }).week;
  let { daily, week } = build(boost);
  let note = "";
  const month = (w: number) => Math.round((w + plain * 3.35 + cfg.old_set_month_chf) * 100) / 100;
  if (month(week) > monthlyCapChf && Object.values(boost).some((x) => x > 1)) {
    note = `boosts dropped: CHF ${week} this week projects CHF ${month(week)} a month, over the CHF ${monthlyCapChf} cap`;
    boost = { planner: 1, tomorrow: 1, tonight: 1 };
    ({ daily, week } = build(boost));
  }
  return { daily, week_chf: week, boost, note };
}

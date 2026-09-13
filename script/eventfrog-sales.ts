// Comedy Brew ticket sales from Eventfrog (read-only) beside the Meta spend, with the capacity
// guard, the profit line and the Saturday review. Strategy and thresholds:
// ~/Documents/2026-09-13-comedy-brew-sales-tracking-strategy.md. Config: meta-ads/config.yml `comedybrew:`.
//
//   bun script/eventfrog-sales.ts --poll --slot daily      # 09:00: next two shows, snapshot + order rows, readout; Fridays also the final record
//   bun script/eventfrog-sales.ts --poll --slot midday     # Tue/Wed 13, 17, 20: the next show only
//   bun script/eventfrog-sales.ts --poll --slot showday    # Thu 10 to 20 hourly: the next show; no-op when today is not a show
//   bun script/eventfrog-sales.ts --backfill [--limit 6]   # past Comedy Brews: order rows, check-ins, payouts, spend, final records
//   bun script/eventfrog-sales.ts --final [--date D]       # the final record for a past show (default: the newest without one)
//   bun script/eventfrog-sales.ts --guard [--apply]        # capacity guard for the next show; dry-run prints, --apply writes to Meta
//   bun script/eventfrog-sales.ts --review                 # Saturday: review-<date>.md, the ramp verdict for the coming week
//   bun script/eventfrog-sales.ts --curve 2026-09-10       # a past show's sales curve from the order rows
//
// Everything written lands in script/eventfrog-out/ (gitignored). No buyer field is ever written.
// Eventfrog calls go through lib/eventfrog-api.ts, which has one verb. Meta is read for spend and
// written only by --guard --apply, through lib/meta-api.ts.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { Eventfrog, EventfrogAuthError, REPO_ROOT, eventfrogFromEnv, healthcheckPing } from "./lib/eventfrog-api";
import { loadConfig, metaFromEnv, minorToChf, chfToMinor, type Meta, type MetaConfig } from "./lib/meta-api";

export const OUT_DIR = join(REPO_ROOT, "script", "eventfrog-out");
const HC = "EVENTFROG_HEALTHCHECKS_URL";
const TZ = "Europe/Zurich";

const USAGE = `usage: bun script/eventfrog-sales.ts (--poll --slot daily|midday|showday | --backfill [--limit N] | --final [--date D] | --guard [--apply] | --review | --curve D) [--dry-run]`;

// ---------- config ----------

export interface BrewConfig {
  show: string; group_id: string; capacity_override: number; fixed_cost_chf: number; per_ticket_cost_chf: number;
  door_sales: "none" | "cash"; new_buyer_value_chf: number; door_reserve: number; seats_left_ramp_stop: number;
  ramp_warn_share: number; ramp_stop_share: number; ramp_restore_share: number; weekly_envelope_chf: number; student_title: string;
}
export const DEFAULT_BREW: BrewConfig = {
  show: "comedybrew", group_id: "", capacity_override: 0, fixed_cost_chf: 0, per_ticket_cost_chf: 0, door_sales: "none", new_buyer_value_chf: 0,
  door_reserve: 4, seats_left_ramp_stop: 6, ramp_warn_share: 0.8, ramp_stop_share: 1.0, ramp_restore_share: 0.6, weekly_envelope_chf: 115, student_title: "student",
};

// ---------- time (Zürich, explicit; the tests run under TZ=UTC) ----------

export interface ZTime { date: string; hour: number; minute: number; weekday: number; stamp: string }   // weekday: 0 Sunday .. 6 Saturday
export function zurich(iso: string | Date): ZTime {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false }).formatToParts(d).map((p) => [p.type, p.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const hour = Number(parts.hour) % 24;
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour, minute: Number(parts.minute), weekday, stamp: `${parts.year}-${parts.month}-${parts.day}T${String(hour).padStart(2, "0")}:${parts.minute}` };
}
export const zurichNow = () => zurich(new Date());
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const hoursBefore = (orderIso: string, startIso: string) => (Date.parse(startIso) - Date.parse(orderIso)) / 3600000;

// The week's spend belongs to the show it runs up to: the Friday after the previous Thursday to show day.
export function attributionWindow(showDate: string): { since: string; until: string } { return { since: addDays(showDate, -6), until: showDate }; }

// ---------- records ----------

export interface Show { event_id: string; show_date: string; start: string; title?: string }
export interface OrderRow { order_id: string; event_id: string; show_date: string; order_date: string; tickets: number; students: number; gross_chf: number; cancelled: number; payment: string; type: string }
export interface Snapshot { event_id: string; show_date: string; taken_at: string; slot: string; tickets: number; students: number; cancelled: number; orders: number; gross_chf: number; capacity: number; remaining: number; last_order_at: string | null }
export interface Final {
  show_date: string; event_id: string; tickets: number; students: number; gross_chf: number; cancelled: number; orders: number; capacity: number; checkins: number | null;
  payout: { amount_chf: number; date: string; state: string } | null; window: { since: string; until: string }; spend: Record<string, number>; site_clicks: number | null;
  blended_net_chf: number; ads_per_ticket_chf: number | null; ramp_ran: boolean; profit_chf: number; written_at: string;
}
export interface RampState { level: "full" | "half" | "off"; since: string; clean_weeks: number; metric_chf: number | null; note: string }

// A transaction with the buyer stripped: order id, dates, counts, money, payment. Ticket ids (verification numbers) go too.
export function redactOrder(o: any, show: Show, isStudent: (categoryId: any) => boolean): OrderRow {
  const tickets = (o.tickets || []) as any[];
  const live = tickets.filter((t) => !t.cancelled);
  return {
    order_id: String(o.id), event_id: show.event_id, show_date: show.show_date, order_date: String(o.orderDate),
    tickets: live.length, students: live.filter((t) => isStudent(t.categoryId)).length, gross_chf: live.reduce((s, t) => s + Number(t.price || 0), 0) / 100,
    cancelled: tickets.length - live.length, payment: String(o.payment?.methods?.[0]?.type?.name || o.payment?.occasion || ""), type: String(o.type || ""),
  };
}

// Capacity is one pool: a sub-category (parentId set, 0 tickets of its own) draws from its parent.
export function capacityOf(categories: any[], override = 0): number {
  if (override > 0) return override;
  return categories.filter((c) => !c.parentId).reduce((s, c) => s + Number(c.totalNumberOfTickets || 0), 0);
}
export function studentTest(categories: any[], title = "student"): (categoryId: any) => boolean {
  const ids = new Set(categories.filter((c) => (c.localizedInfo || []).some((l: any) => String(l.title || "").toLowerCase().includes(title))).map((c) => String(c.id)));
  return (id) => ids.has(String(id));
}
export function summarise(rows: OrderRow[], capacity: number): Pick<Snapshot, "tickets" | "students" | "cancelled" | "orders" | "gross_chf" | "capacity" | "remaining" | "last_order_at"> {
  const tickets = rows.reduce((s, r) => s + r.tickets, 0);
  return {
    tickets, students: rows.reduce((s, r) => s + r.students, 0), cancelled: rows.reduce((s, r) => s + r.cancelled, 0), orders: rows.filter((r) => r.tickets > 0).length,
    gross_chf: Math.round(rows.reduce((s, r) => s + r.gross_chf, 0) * 100) / 100, capacity, remaining: Math.max(0, capacity - tickets),
    last_order_at: rows.length ? rows.map((r) => r.order_date).sort().at(-1)! : null,
  };
}

// ---------- the curve, the projection, the pace ----------

// Hours before the start for every ticket of a show (one entry per ticket).
export function curveOf(rows: OrderRow[], start: string): number[] {
  const out: number[] = [];
  for (const r of rows) for (let i = 0; i < r.tickets; i++) out.push(hoursBefore(r.order_date, start));
  return out;
}
// The 2022 to 2026 export (strategy report 1.2): share of tickets bought at least H hours before the start.
export function baselineShare(hours: number): number {
  if (hours >= 168) return 0.148;
  if (hours >= 96) return 0.277;
  if (hours >= 48) return 0.456;
  if (hours >= 24) return 0.606;
  return 0.606 + (1 - 0.606) * (1 - Math.max(0, hours) / 24);
}
export function median(xs: number[]): number { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
// Median over completed shows of the share sold at least `hours` before; the export baseline under three shows.
export function shareSoldBy(hours: number, curves: number[][]): number {
  const done = curves.filter((c) => c.length);
  if (done.length < 3) return baselineShare(hours);
  return median(done.map((c) => c.filter((h) => h >= hours).length / c.length));
}
export function projectFinal(sold: number, share: number): number { return share > 0 ? Math.round(sold / share) : sold; }
// Median tickets sold at this distance from the show, over completed shows.
export function paceMedian(hours: number, curves: number[][]): number { const done = curves.filter((c) => c.length); return done.length ? median(done.map((c) => c.filter((h) => h >= hours).length)) : NaN; }

// ---------- the guards ----------

export interface GuardInput { remaining: number; capacity: number; projected: number | null; door_reserve: number; seats_left_ramp_stop: number }
export interface GuardAction { type: "ramp_off" | "pause_lineup"; reason: string }
// Never names Cold or the old ad set; never pauses an ad set. ramp_off = Warm, Intent and Buyers back to base; pause_lineup = the dated ad only.
export function guardDecision(g: GuardInput): GuardAction[] {
  const out: GuardAction[] = [];
  const target = g.capacity - g.door_reserve;
  if (g.projected !== null && g.projected >= target) out.push({ type: "ramp_off", reason: `projected final ${g.projected} reaches ${target} (capacity ${g.capacity} minus door reserve ${g.door_reserve})` });
  else if (g.remaining <= g.seats_left_ramp_stop) out.push({ type: "ramp_off", reason: `${g.remaining} seats left, at or under ${g.seats_left_ramp_stop}` });
  if (g.remaining <= 0) out.push({ type: "pause_lineup", reason: "sold out: the lineup ad links to the dated event page" });
  return out;
}

export function blendedNet(tickets: number, students: number, normal: number, student: number, perTicket: number): number {
  if (!tickets) return normal - perTicket;
  return Math.round(((tickets - students) * normal + students * student) / tickets * 100) / 100 - perTicket;
}
export function profitLine(f: Pick<Final, "gross_chf" | "spend" | "tickets">, cfg: BrewConfig): number {
  return Math.round((f.gross_chf - (f.spend.total || 0) - cfg.fixed_cost_chf - cfg.per_ticket_cost_chf * f.tickets) * 100) / 100;
}
// Did the ramp run that week: the three ramp ad sets spent clearly more than seven days of base.
export function rampRan(spend: Record<string, number>, budgets: MetaConfig["budgets"]): boolean {
  const base = ["warm", "intent", "buyers"].reduce((s, k) => s + (budgets[k]?.base || 0), 0) * 7;
  const actual = ["warm", "intent", "buyers"].reduce((s, k) => s + (spend[k] || 0), 0);
  return actual > base * 1.3;
}

// The profit guard: the ramp judged on its own increment against shares of the blended net price, with hysteresis.
export function rampVerdict(finals: Final[], cfg: BrewConfig, previous: RampState | null, today: string): RampState {
  const recent = [...finals].sort((a, b) => (a.show_date < b.show_date ? 1 : -1)).slice(0, 4);
  const prev: RampState = previous || { level: "full", since: today, clean_weeks: 0, metric_chf: null, note: "" };
  if (!recent.length) return { ...prev, note: "no final records yet" };
  const blended = recent[0].blended_net_chf;
  const rampWeeks = recent.filter((f) => f.ramp_ran);
  const baseWeeks = finals.filter((f) => !f.ramp_ran);
  let metric: number | null, how: string;
  if (rampWeeks.length && baseWeeks.length >= 2) {
    const baseMedian = median(baseWeeks.map((f) => f.tickets));
    const perExtra = rampWeeks.map((f) => { const extra = f.tickets - baseMedian; const ramp = (f.spend.warm || 0) + (f.spend.intent || 0) + (f.spend.buyers || 0) - 7 * 0; return extra > 0 ? ramp / extra : Infinity; });
    metric = median(perExtra); how = `ramp francs per extra ticket over the base-week median of ${baseMedian} (${rampWeeks.length} ramp weeks, ${baseWeeks.length} base weeks)`;
  } else {
    const per = recent.filter((f) => f.ads_per_ticket_chf !== null).map((f) => f.ads_per_ticket_chf as number);
    metric = per.length ? median(per) : null; how = `ads per ticket over all tickets (${per.length} shows; no base-only weeks yet, so every ticket counts as ad-driven)`;
  }
  const warn = cfg.ramp_warn_share * blended, stop = cfg.ramp_stop_share * blended, restore = cfg.ramp_restore_share * blended;
  if (metric === null) return { ...prev, metric_chf: null, note: `${how}: nothing to judge` };
  const m = Math.round(metric * 100) / 100;
  if (m > stop) return { level: "off", since: prev.level === "off" ? prev.since : today, clean_weeks: 0, metric_chf: m, note: `${how}: CHF ${m} is over ${stop.toFixed(2)} (1.0 x blended ${blended}); no ramp` };
  if (m > warn) return { level: prev.level === "off" ? "off" : "half", since: prev.level === "full" ? today : prev.since, clean_weeks: 0, metric_chf: m, note: `${how}: CHF ${m} is over ${warn.toFixed(2)} (0.8 x blended ${blended}); ramp halved${prev.level === "off" ? ", stays off until under the restore line" : ""}` };
  if (prev.level === "full") return { level: "full", since: prev.since, clean_weeks: prev.clean_weeks + 1, metric_chf: m, note: `${how}: CHF ${m} is under ${warn.toFixed(2)}; ramp as configured` };
  if (m < restore) {
    const clean = prev.clean_weeks + 1;
    if (clean >= 2) return { level: "full", since: today, clean_weeks: 0, metric_chf: m, note: `${how}: CHF ${m} under the restore line ${restore.toFixed(2)} for ${clean} weeks; ramp restored` };
    return { ...prev, clean_weeks: clean, metric_chf: m, note: `${how}: CHF ${m} under the restore line ${restore.toFixed(2)}, week ${clean} of 2; ramp stays ${prev.level}` };
  }
  return { ...prev, clean_weeks: 0, metric_chf: m, note: `${how}: CHF ${m} between the restore line ${restore.toFixed(2)} and the warn line ${warn.toFixed(2)}; ramp stays ${prev.level}` };
}

// ---------- slots ----------

export function slotShows(slot: string, shows: Show[], today: string): Show[] {
  const upcoming = shows.filter((s) => s.show_date >= today).sort((a, b) => (a.show_date < b.show_date ? -1 : 1));
  if (slot === "daily") return upcoming.slice(0, 2);
  if (slot === "midday") return upcoming.slice(0, 1);
  if (slot === "showday") return upcoming.filter((s) => s.show_date === today).slice(0, 1);
  throw new Error(`unknown slot ${slot}`);
}

// ---------- files ----------

const jsonl = (name: string): any[] => { const p = join(OUT_DIR, name); return existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []; };
const appendJsonl = (name: string, row: any) => { mkdirSync(OUT_DIR, { recursive: true }); writeFileSync(join(OUT_DIR, name), JSON.stringify(row) + "\n", { flag: "a" }); };
const writeJsonl = (name: string, rows: any[]) => { mkdirSync(OUT_DIR, { recursive: true }); writeFileSync(join(OUT_DIR, name), rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length ? "\n" : "")); };
const readJson = <T,>(name: string, fallback: T): T => { const p = join(OUT_DIR, name); return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : fallback; };
const writeJson = (name: string, v: any) => { mkdirSync(join(OUT_DIR, "shows"), { recursive: true }); writeFileSync(join(OUT_DIR, name), JSON.stringify(v, null, 2) + "\n"); };
const finals = (): Final[] => { const d = join(OUT_DIR, "shows"); return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(d, f), "utf8")) as Final) : []; };
export function upsertOrders(existing: OrderRow[], fresh: OrderRow[]): { rows: OrderRow[]; added: number; changed: number } {
  const byId = new Map(existing.map((r) => [r.order_id, r]));
  let added = 0, changed = 0;
  for (const r of fresh) { const old = byId.get(r.order_id); if (!old) added++; else if (JSON.stringify(old) !== JSON.stringify(r)) changed++; byId.set(r.order_id, r); }
  return { rows: [...byId.values()].sort((a, b) => (a.order_date < b.order_date ? -1 : 1)), added, changed };
}

// ---------- Eventfrog reads ----------

// Every Comedy Brew the key can see (one call), cached for the day so the hourly slots do not repeat it.
async function loadShows(ef: Eventfrog, cfg: BrewConfig, today: string): Promise<Show[]> {
  const cache = readJson<{ date: string; shows: Show[] }>("events.json", { date: "", shows: [] });
  if (cache.date === today && cache.shows.length) return cache.shows;
  const { data } = await ef.getAll<any>("/organizer/v1/events", {});
  const shows: Show[] = data.filter((e: any) => String(e.groupId || "") === cfg.group_id && e.beginDate).map((e: any) => ({ event_id: String(e.id), show_date: zurich(e.beginDate).date, start: String(e.beginDate), title: e.localizedInfo?.[0]?.title })).sort((a: Show, b: Show) => (a.show_date < b.show_date ? -1 : 1));
  if (!shows.length) fail(`no events with groupId ${cfg.group_id} in the organizer list; check comedybrew.group_id`);
  writeJson("events.json", { date: today, shows });
  return shows;
}

async function pollShow(ef: Eventfrog, cfg: BrewConfig, show: Show, slot: string, withCategories: boolean): Promise<Snapshot> {
  const orders = jsonl("orders.jsonl") as OrderRow[];
  let capacity = orders.length ? (jsonl("sales.jsonl") as Snapshot[]).filter((s) => s.event_id === show.event_id).at(-1)?.capacity || 0 : 0;
  let isStudent: (id: any) => boolean = (id) => String(id) !== "1";
  if (withCategories || !capacity) { const cats = await ef.get<{ data: any[] }>(`/organizer/v1/events/${show.event_id}/ticketcategories`); capacity = capacityOf(cats.data || [], cfg.capacity_override); isStudent = studentTest(cats.data || [], cfg.student_title); }
  const tx = await ef.getAll<any>(`/organizer/v1/events/${show.event_id}/tickettransactions`);
  const fresh = tx.data.map((o) => redactOrder(o, show, isStudent));
  const { rows, added, changed } = upsertOrders(orders, fresh);
  if (added || changed) writeJsonl("orders.jsonl", rows);
  const mine = rows.filter((r) => r.event_id === show.event_id);
  const snap: Snapshot = { event_id: show.event_id, show_date: show.show_date, taken_at: new Date().toISOString(), slot, ...summarise(mine, capacity) };
  appendJsonl("sales.jsonl", snap);
  return snap;
}

// ---------- Meta reads ----------

function metaOrNull(config: MetaConfig): Meta | null { try { return metaFromEnv(config); } catch (e: any) { warn(`Meta unavailable: ${e.message}`); return null; } }
async function spendInWindow(meta: Meta | null, config: MetaConfig, since: string, until: string): Promise<Record<string, number>> {
  const out: Record<string, number> = { total: 0 };
  if (!meta) return out;
  const keyOf = new Map<string, string>(Object.entries(config.adsets).map(([k, id]) => [String(id), k]));
  if (config.old_adset_id) keyOf.set(String(config.old_adset_id), "old");
  const rows = await meta.getAll(`${config.campaign_id}/insights`, { level: "adset", time_range: { since, until }, fields: "adset_id,spend" });
  for (const r of rows) { const k = keyOf.get(String(r.adset_id)) || String(r.adset_id); out[k] = (out[k] || 0) + Number(r.spend || 0); out.total += Number(r.spend || 0); }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 100) / 100;
  return out;
}
export function siteClicks(report: any, since: string, until: string): number | null {
  if (!report?.by_day) return null;
  return report.by_day.filter((d: any) => d.date >= since && d.date <= until).reduce((s: number, d: any) => s + Number(d.redirect || 0) + Number(d.click || 0), 0);
}

// ---------- modes ----------

async function writeFinal(ef: Eventfrog, meta: Meta | null, config: MetaConfig, cfg: BrewConfig, show: Show, prices: { normal: number; student: number }): Promise<Final> {
  const snap = await pollShow(ef, cfg, show, "final", true);
  const ci = await ef.getAll<any>(`/organizer/v1/events/${show.event_id}/checkins`);
  const po = await ef.get<{ data: any[] }>(`/organizer/v1/events/${show.event_id}/payouts`);
  const paid = (po.data || []).find((p) => p.state === "paid") || (po.data || [])[0];
  const window = attributionWindow(show.show_date);
  const spend = await spendInWindow(meta, config, window.since, window.until);
  const repPath = join(REPO_ROOT, "_data", "reports", `${cfg.show}.json`);
  const site = existsSync(repPath) ? siteClicks(JSON.parse(readFileSync(repPath, "utf8")), window.since, window.until) : null;
  const blended = blendedNet(snap.tickets, snap.students, prices.normal, prices.student, cfg.per_ticket_cost_chf);
  const f: Final = {
    show_date: show.show_date, event_id: show.event_id, tickets: snap.tickets, students: snap.students, gross_chf: snap.gross_chf, cancelled: snap.cancelled, orders: snap.orders, capacity: snap.capacity,
    checkins: ci.data.filter((c) => c.checkedIn).length, payout: paid ? { amount_chf: Number(paid.amount || 0) / 100, date: String(paid.payDate || ""), state: String(paid.state || "") } : null,
    window, spend, site_clicks: site, blended_net_chf: blended, ads_per_ticket_chf: snap.tickets && spend.total ? Math.round(spend.total / snap.tickets * 100) / 100 : null,
    ramp_ran: rampRan(spend, config.budgets), profit_chf: 0, written_at: new Date().toISOString(),
  };
  f.profit_chf = profitLine(f, cfg);
  writeJson(`shows/${show.show_date}.json`, f);
  return f;
}

function pricesFrom(rows: OrderRow[]): { normal: number; student: number } {
  // Ticket prices from the calendar's price_chf for normal; student from the order rows (gross of student-only orders) or half.
  const cal = join(REPO_ROOT, "_data", "calendar.yml");
  let normal = 10;
  try { const ev = ((Bun.YAML.parse(readFileSync(cal, "utf8")) as any)?.events || []).find((e: any) => e.show === "comedybrew"); if (ev?.price_chf) normal = Number(ev.price_chf); } catch { /* keep 10 */ }
  const so = rows.filter((r) => r.tickets > 0 && r.students === r.tickets);
  const student = so.length ? Math.round(median(so.map((r) => r.gross_chf / r.tickets)) * 100) / 100 : normal / 2;
  return { normal, student };
}

function readoutLine(show: Show, snap: Snapshot, curves: number[][], spend: Record<string, number> | null, now: Date): string {
  const hb = hoursBefore(now.toISOString(), show.start);
  const days = Math.max(0, Math.floor(hb / 24));
  const pace = paceMedian(hb, curves);
  const ads = spend && snap.tickets ? ` ads/ticket so far ${(spend.total / snap.tickets).toFixed(2)}` : "";
  return `${show.show_date}  sold ${snap.tickets}/${snap.capacity} (students ${snap.students})  remaining ${snap.remaining}  ${days} day(s) out  pace: median at this distance ${Number.isFinite(pace) ? pace : "n/a"}  spend this window CHF ${spend ? spend.total.toFixed(2) : "n/a"}${ads}`;
}

async function runPoll(args: any, ef: Eventfrog, config: MetaConfig, cfg: BrewConfig) {
  const slot = flagString(args, "slot") || "daily";
  const now = zurichNow();
  const shows = await loadShows(ef, cfg, now.date);
  const targets = slotShows(slot, shows, now.date);
  if (!targets.length) { log(`${now.stamp} slot ${slot}: no show today, nothing to poll`); return; }
  const meta = metaOrNull(config);
  const orders = jsonl("orders.jsonl") as OrderRow[];
  const curves = shows.filter((s) => s.show_date < now.date).map((s) => curveOf(orders.filter((r) => r.event_id === s.event_id), s.start));
  const lines: string[] = [];
  for (const show of targets) {
    const before = (jsonl("sales.jsonl") as Snapshot[]).filter((s) => s.event_id === show.event_id).at(-1);
    const snap = await pollShow(ef, cfg, show, slot, slot === "daily");
    const w = attributionWindow(show.show_date);
    const spend = meta && w.since <= now.date ? await spendInWindow(meta, config, w.since, now.date < w.until ? now.date : w.until) : null;
    const delta = before ? snap.tickets - before.tickets : 0;
    lines.push(readoutLine(show, snap, curves, spend, new Date()) + (before ? ` (+${delta} since ${zurich(before.taken_at).stamp})` : ""));
    const hb = hoursBefore(new Date().toISOString(), show.start);
    if (hb <= 72 && hb > 0) { const share = shareSoldBy(hb, curves); lines.push(`  projection: ${snap.tickets} sold with ${(share * 100).toFixed(0)} percent usually sold by now projects to ${projectFinal(snap.tickets, share)} of ${snap.capacity} (guard line ${snap.capacity - cfg.door_reserve})`); }
  }
  if (cfg.door_sales === "cash") lines.push("  (door cash is not in Eventfrog: the sales figure is a floor)");
  const md = `# Comedy Brew sales ${now.stamp} (${slot})\n\n${lines.map((l) => `- ${l}`).join("\n")}\n`;
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, `sales-${now.date}.md`), md, { flag: slot === "daily" ? "w" : "a" });
  log(lines.join("\n"));
  await healthcheckPing(HC, "log", `${now.stamp} ${slot}\n${lines.join("\n")}`);
  // Friday, or any day: a past show within seven days without its final record gets one.
  if (slot === "daily") {
    const done = new Set(finals().map((f) => f.show_date));
    for (const s of shows.filter((s) => s.show_date < now.date && s.show_date >= addDays(now.date, -7) && !done.has(s.show_date))) {
      const f = await writeFinal(ef, meta, config, cfg, s, pricesFrom(jsonl("orders.jsonl")));
      log(`final ${s.show_date}: ${f.tickets} tickets CHF ${f.gross_chf}, ${f.checkins} checked in, spend CHF ${f.spend.total}, profit CHF ${f.profit_chf}`);
    }
  }
}

async function runBackfill(args: any, ef: Eventfrog, config: MetaConfig, cfg: BrewConfig) {
  const limit = Number(flagString(args, "limit") || 6);
  const now = zurichNow();
  const shows = await loadShows(ef, cfg, now.date);
  const done = new Set(readJson<{ done: string[] }>("backfill.json", { done: [] }).done);
  const past = shows.filter((s) => s.show_date < now.date && !done.has(s.event_id)).sort((a, b) => (a.show_date < b.show_date ? 1 : -1)).slice(0, limit);
  if (!past.length) { log("backfill: nothing left to fetch"); return; }
  const meta = metaOrNull(config);
  const haveFinal = new Set(finals().map((f) => f.show_date));
  for (const s of past) {
    if (haveFinal.has(s.show_date)) { await pollShow(ef, cfg, s, "backfill", true); log(`${s.show_date}: order rows refreshed (final exists)`); }
    else { const f = await writeFinal(ef, meta, config, cfg, s, pricesFrom(jsonl("orders.jsonl"))); log(`${s.show_date}: ${f.tickets} tickets CHF ${f.gross_chf}, ${f.checkins ?? "?"} checked in, payout ${f.payout ? `CHF ${f.payout.amount_chf} ${f.payout.date}` : "none"}, spend CHF ${f.spend.total}, ads/ticket ${f.ads_per_ticket_chf ?? "n/a"}, profit CHF ${f.profit_chf}`); }
    done.add(s.event_id);
    writeJson("backfill.json", { done: [...done] });
  }
  log(`backfill: ${past.length} show(s) this run, ${ef.calls} Eventfrog calls, remaining this minute ${ef.remaining ?? "?"}`);
}

async function runFinal(args: any, ef: Eventfrog, config: MetaConfig, cfg: BrewConfig) {
  const now = zurichNow();
  const shows = await loadShows(ef, cfg, now.date);
  const date = flagString(args, "date");
  const have = new Set(finals().map((f) => f.show_date));
  const show = date ? shows.find((s) => s.show_date === date) : shows.filter((s) => s.show_date < now.date && !have.has(s.show_date)).sort((a, b) => (a.show_date < b.show_date ? 1 : -1))[0];
  if (!show) fail(date ? `no Comedy Brew on ${date}` : "every past show has its final record");
  const f = await writeFinal(ef, metaOrNull(config), config, cfg, show, pricesFrom(jsonl("orders.jsonl")));
  log(`final ${show.show_date}: ${f.tickets} tickets (${f.students} students) CHF ${f.gross_chf}, ${f.checkins} checked in, payout ${f.payout ? `CHF ${f.payout.amount_chf} on ${f.payout.date}` : "not yet"}, window ${f.window.since} to ${f.window.until}, spend ${JSON.stringify(f.spend)}, site clicks ${f.site_clicks ?? "n/a"}, blended net CHF ${f.blended_net_chf}, ads/ticket ${f.ads_per_ticket_chf ?? "n/a"}, ramp ${f.ramp_ran ? "ran" : "did not run"}, profit CHF ${f.profit_chf}`);
  const g = readJson<any>("guard.json", { actions: [] });
  const mine = (g.actions || []).filter((a: any) => a.show_date === show.show_date && !a.restored);
  for (const a of mine) { a.restored = new Date().toISOString(); log(`guard restore: ${a.type} for ${a.show_date} is closed; the ramp for the coming week is set by the review, the lineup ad stays paused (Monday makes next week's)`); }
  if (mine.length) writeJson("guard.json", g);
}

async function runGuard(args: any, ef: Eventfrog, config: MetaConfig, cfg: BrewConfig) {
  const apply = flagBool(args, "apply") && !flagBool(args, "dry-run");
  const now = zurichNow();
  const shows = await loadShows(ef, cfg, now.date);
  const next = slotShows("midday", shows, now.date)[0];
  if (!next) { log("guard: no upcoming show"); return; }
  const snaps = (jsonl("sales.jsonl") as Snapshot[]).filter((s) => s.event_id === next.event_id);
  const snap = snaps.length && snaps.at(-1)!.taken_at.slice(0, 10) === new Date().toISOString().slice(0, 10) ? snaps.at(-1)! : await pollShow(ef, cfg, next, "guard", !snaps.length);
  const orders = jsonl("orders.jsonl") as OrderRow[];
  const curves = shows.filter((s) => s.show_date < now.date).map((s) => curveOf(orders.filter((r) => r.event_id === s.event_id), s.start));
  const hb = hoursBefore(new Date().toISOString(), next.start);
  const projected = hb <= 72 && hb > 0 ? projectFinal(snap.tickets, shareSoldBy(hb, curves)) : null;
  const actions = guardDecision({ remaining: snap.remaining, capacity: snap.capacity, projected, door_reserve: cfg.door_reserve, seats_left_ramp_stop: cfg.seats_left_ramp_stop });
  const head = `guard ${now.stamp} for ${next.show_date}: sold ${snap.tickets}/${snap.capacity}, remaining ${snap.remaining}, projected ${projected ?? "n/a (more than 72 h out)"}`;
  if (!actions.length) { log(`${head}: nothing to do`); return; }
  const g = readJson<any>("guard.json", { actions: [] });
  const already = new Set((g.actions || []).filter((a: any) => a.show_date === next.show_date && !a.restored).map((a: any) => a.type));
  const meta = metaOrNull(config);
  for (const a of actions) {
    if (already.has(a.type)) { log(`${head}: ${a.type} already done this week (${a.reason})`); continue; }
    log(`${head}: ${a.type}: ${a.reason}`);
    const record: any = { show_date: next.show_date, type: a.type, reason: a.reason, at: new Date().toISOString(), applied: false, changes: [] as any[] };
    if (a.type === "ramp_off" && meta) {
      for (const k of ["warm", "intent", "buyers"] as const) {
        const id = config.adsets[k]; const base = chfToMinor(config.budgets[k]?.base || 0);
        const cur = await meta.get(id, { fields: "name,daily_budget,status" });
        if (Number(cur.daily_budget) <= base) { log(`  ${k}: daily budget CHF ${minorToChf(cur.daily_budget)} is already base`); continue; }
        log(`  ${k}: daily budget CHF ${minorToChf(cur.daily_budget)} -> base CHF ${minorToChf(base)}${apply ? "" : " (dry-run)"}`);
        if (apply) { await meta.post(id, { daily_budget: base }); const back = await meta.get(id, { fields: "daily_budget" }); record.changes.push({ adset: k, before: minorToChf(cur.daily_budget), after: minorToChf(back.daily_budget) }); }
      }
    }
    if (a.type === "pause_lineup" && meta) {
      const ads = await meta.getAll(`${config.adsets.buyers}/ads`, { fields: "id,name,status,effective_status" });
      const ad = ads.find((x: any) => x.name === `lineup-${next.show_date.replace(/-/g, "")}`);
      if (!ad) log(`  no lineup ad named lineup-${next.show_date.replace(/-/g, "")} in Buyers`);
      else if (ad.status === "PAUSED") log(`  ${ad.name} is already paused`);
      else { log(`  ${ad.name}: ACTIVE -> PAUSED${apply ? "" : " (dry-run)"}`); if (apply) { await meta.post(ad.id, { status: "PAUSED" }); const back = await meta.get(ad.id, { fields: "status" }); record.changes.push({ ad: ad.name, before: ad.status, after: back.status }); } }
    }
    record.applied = apply;
    g.actions.push(record);
    writeJson("guard.json", g);
    await healthcheckPing(HC, apply ? "fail" : "log", `${head}: ${a.type}${apply ? " applied" : " (dry-run, run --guard --apply to act)"}: ${a.reason}`);
  }
}

async function runReview(args: any, ef: Eventfrog, config: MetaConfig, cfg: BrewConfig) {
  const now = zurichNow();
  const all = finals().sort((a, b) => (a.show_date < b.show_date ? 1 : -1));
  if (!all.length) fail("no final records under script/eventfrog-out/shows/; run --backfill or --final first");
  const g = readJson<any>("guard.json", { actions: [], ramp: null });
  const verdict = rampVerdict(all, cfg, g.ramp || null, now.date);
  const meta = metaOrNull(config);
  const monthStart = `${now.date.slice(0, 7)}-01`;
  const mtd = meta ? await spendInWindow(meta, config, monthStart, now.date) : null;
  const orders = jsonl("orders.jsonl") as OrderRow[];
  const last = all[0];
  const shows = await loadShows(ef, cfg, now.date);
  const lastShow = shows.find((s) => s.show_date === last.show_date);
  const L: string[] = [];
  L.push(`# Comedy Brew review, Saturday ${now.date}`, "", `Confounders this week (lineup, holidays, weather, other events): _fill in_`, "");
  L.push(`## Ramp verdict for the coming week: ${verdict.level}`, "", verdict.note, "", `Thresholds from the blended net price CHF ${last.blended_net_chf}: warn ${(cfg.ramp_warn_share * last.blended_net_chf).toFixed(2)}, stop ${(cfg.ramp_stop_share * last.blended_net_chf).toFixed(2)}, restore ${(cfg.ramp_restore_share * last.blended_net_chf).toFixed(2)}. Set the ramp with meta-adsets.ts --apply or in Ads Manager; this is the week's one change when it is a cut.`, "");
  L.push("## Last shows", "", "| Show | Tickets | Students | Gross | Checked in | Payout | Window spend | Cold | Warm | Intent | Buyers | Old | Site clicks | Ads/ticket | Ramp | Profit |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
  for (const f of all.slice(0, 6)) L.push(`| ${f.show_date} | ${f.tickets} | ${f.students} | ${f.gross_chf.toFixed(2)} | ${f.checkins ?? ""} | ${f.payout ? f.payout.amount_chf.toFixed(2) : ""} | ${(f.spend.total || 0).toFixed(2)} | ${(f.spend.cold || 0).toFixed(2)} | ${(f.spend.warm || 0).toFixed(2)} | ${(f.spend.intent || 0).toFixed(2)} | ${(f.spend.buyers || 0).toFixed(2)} | ${(f.spend.old || 0).toFixed(2)} | ${f.site_clicks ?? ""} | ${f.ads_per_ticket_chf ?? ""} | ${f.ramp_ran ? "ran" : "off"} | ${f.profit_chf.toFixed(2)} |`);
  const recent = all.slice(0, 4);
  const tpc = recent.filter((f) => f.spend.total).map((f) => f.tickets / f.spend.total);
  L.push("", `Four-show medians: tickets ${median(recent.map((f) => f.tickets))}, spend CHF ${median(recent.map((f) => f.spend.total || 0)).toFixed(2)}, tickets per CHF ${tpc.length ? median(tpc).toFixed(3) : "n/a"}, profit CHF ${median(recent.map((f) => f.profit_chf)).toFixed(2)}. A week inside plus or minus 20 percent of the median is noise.`, "");
  if (mtd) L.push(`Month to date: CHF ${mtd.total.toFixed(2)} of the CHF ${config.monthly_cap_chf} cap (weekly envelope CHF ${cfg.weekly_envelope_chf}).`, "");
  if (lastShow) {
    const c = orders.filter((r) => r.event_id === lastShow.event_id);
    L.push(`## Curve for ${last.show_date}`, "", curveTable(c, lastShow.start), "");
  }
  const acted = (g.actions || []).filter((a: any) => a.show_date === last.show_date);
  L.push("## Guard", "", acted.length ? acted.map((a: any) => `- ${a.type} ${a.applied ? "applied" : "dry-run"} at ${a.at}: ${a.reason}`).join("\n") : "- no guard action this week", "");
  if (cfg.fixed_cost_chf === 0) L.push("Fixed cost per night is 0 in config (Harry, 13 September 2026: nothing per show; sunk costs reviewed later), so profit is gross minus ads.", "");
  g.ramp = verdict;
  writeJson("guard.json", g);
  const p = join(OUT_DIR, `review-${now.date}.md`);
  writeFileSync(p, L.join("\n") + "\n");
  log(L.join("\n"));
  log(`\nwritten ${p}`);
}

export function curveTable(rows: OrderRow[], start: string): string {
  const byDays: Record<string, number> = {}, byHour: Record<string, number> = {};
  const showDate = zurich(start).date;
  for (const r of rows) for (let i = 0; i < r.tickets; i++) {
    const hb = hoursBefore(r.order_date, start);
    const b = hb < 0 ? "after start" : hb < 24 ? "0" : hb >= 168 ? "7+" : String(Math.floor(hb / 24));
    byDays[b] = (byDays[b] || 0) + 1;
    const z = zurich(r.order_date);
    if (z.date === showDate) byHour[String(z.hour).padStart(2, "0") + ":00"] = (byHour[String(z.hour).padStart(2, "0") + ":00"] || 0) + 1;
  }
  const order = ["7+", "6", "5", "4", "3", "2", "1", "0", "after start"];
  const d = order.filter((k) => byDays[k]).map((k) => `${k === "0" ? "show day" : k === "after start" ? k : `${k} day(s) before`} ${byDays[k]}`).join(", ");
  const h = Object.keys(byHour).sort().map((k) => `${k} ${byHour[k]}`).join(", ");
  return `Tickets by day: ${d || "none"}\n\nShow-day hours (Zürich): ${h || "none"}`;
}

async function runCurve(args: any, ef: Eventfrog, cfg: BrewConfig) {
  const date = flagString(args, "curve");
  if (!date) fail("--curve needs a date");
  const shows = await loadShows(ef, cfg, zurichNow().date);
  const show = shows.find((s) => s.show_date === date);
  if (!show) fail(`no Comedy Brew on ${date}`);
  const rows = (jsonl("orders.jsonl") as OrderRow[]).filter((r) => r.event_id === show.event_id);
  if (!rows.length) fail(`no order rows for ${date}; run --backfill`);
  log(`${date}: ${rows.reduce((s, r) => s + r.tickets, 0)} tickets in ${rows.length} orders, CHF ${rows.reduce((s, r) => s + r.gross_chf, 0)}`);
  log(curveTable(rows, show.start));
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(USAGE); return; }
  const config = loadConfig();
  const cfg: BrewConfig = { ...DEFAULT_BREW, ...((config as any).comedybrew || {}) };
  if (!cfg.group_id) fail("config comedybrew.group_id is missing (the Comedy Brew event group id on Eventfrog)");
  const ef = eventfrogFromEnv();
  const curve = flagString(args, "curve");
  if (flagBool(args, "poll")) return runPoll(args, ef, config, cfg);
  if (flagBool(args, "backfill")) return runBackfill(args, ef, config, cfg);
  if (flagBool(args, "final")) return runFinal(args, ef, config, cfg);
  if (flagBool(args, "review")) return runReview(args, ef, config, cfg);
  if (curve) return runCurve(args, ef, cfg);
  if (flagBool(args, "guard")) return runGuard(args, ef, config, cfg);
  fail(USAGE);
}

if (import.meta.main) {
  main().then(() => healthcheckPing(HC, "ok")).catch(async (e) => {
    const msg = e instanceof EventfrogAuthError ? `Eventfrog key rejected: ${e.message}` : String(e?.message || e);
    await healthcheckPing(HC, "fail", msg);
    fail(msg);
  });
}

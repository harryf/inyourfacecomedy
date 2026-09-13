import { describe, expect, test } from "bun:test";
import { Eventfrog, EventfrogAuthError, EventfrogRateLimitError, READ_PATHS } from "../lib/eventfrog-api";
import {
  DEFAULT_BREW, attributionWindow, baselineShare, blendedNet, capacityOf, curveOf, curveTable, guardDecision, paceMedian, profitLine, projectFinal, rampRan, rampVerdict,
  redactOrder, shareSoldBy, siteClicks, slotShows, studentTest, summarise, upsertOrders, zurich, type Final, type OrderRow, type Show,
} from "../eventfrog-sales";

const KEY = "sk-eventfrog-secret-0123456789";
const response = (status: number, body: any, headers: Record<string, string> = {}) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

describe("the client is read-only by construction", () => {
  test("only GET exists and fetch is called with method GET and the key in the header only", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const ef = new Eventfrog(KEY, { fetchFn: (async (u: any, init: any) => { seen.push({ url: String(u), init }); return response(200, { data: [], totalNumberOfResources: 0 }, { "x-ratelimit-remaining": "29" }); }) as any });
    expect((ef as any).post).toBeUndefined(); expect((ef as any).patch).toBeUndefined(); expect((ef as any).delete).toBeUndefined(); expect((ef as any).put).toBeUndefined();
    await ef.get("/organizer/v1/events/1/tickettransactions", { perPage: 1000 });
    expect(seen[0].init.method).toBe("GET");
    expect((seen[0].init.headers as any).Authorization).toBe(`Bearer ${KEY}`);
    expect(seen[0].url).not.toContain(KEY); expect(seen[0].url).not.toContain("apiKey");
    expect(ef.remaining).toBe(29);
  });
  test("a path outside the whitelist is refused before any fetch", async () => {
    let calls = 0;
    const ef = new Eventfrog(KEY, { fetchFn: (async () => { calls++; return response(200, {}); }) as any });
    await expect(ef.get("/organizer/v1/events/1/embedsettings")).rejects.toThrow(/not in the read whitelist/);
    await expect(ef.get("/organizer/v1/addresses")).rejects.toThrow(/whitelist/);
    expect(calls).toBe(0);
    expect(READ_PATHS.length).toBe(6);
  });
  test("401 and 403 raise the auth error, 429 waits once then throws, and the key never leaks into an error", async () => {
    const auth = new Eventfrog(KEY, { fetchFn: (async () => response(401, "nope")) as any });
    await expect(auth.get("/organizer/v1/events")).rejects.toBeInstanceOf(EventfrogAuthError);
    const waits: number[] = [];
    const limited = new Eventfrog(KEY, { fetchFn: (async () => response(429, "slow", { "x-ratelimit-retry-after-seconds": "7" })) as any, sleep: async (ms) => { waits.push(ms); } });
    await expect(limited.get("/organizer/v1/events")).rejects.toBeInstanceOf(EventfrogRateLimitError);
    expect(waits).toEqual([7000]); expect(limited.calls).toBe(2);
    const leaky = new Eventfrog(KEY, { fetchFn: (async () => response(500, `boom ${KEY}`)) as any });
    await expect(leaky.get("/organizer/v1/events")).rejects.toThrow(/<key>/);
    try { await leaky.get("/organizer/v1/events"); } catch (e: any) { expect(String(e.message)).not.toContain(KEY); }
  });
  test("the per-run cap stops a loop", async () => {
    const ef = new Eventfrog(KEY, { fetchFn: (async () => response(200, {})) as any, maxCalls: 2 });
    await ef.get("/organizer/v1/events"); await ef.get("/organizer/v1/events");
    await expect(ef.get("/organizer/v1/events")).rejects.toThrow(/cap/);
  });
});

const show: Show = { event_id: "e1", show_date: "2026-09-10", start: "2026-09-10T19:30:00+02:00" };
const cats = [{ id: 1, totalNumberOfTickets: 60, localizedInfo: [{ title: "Normal" }] }, { id: 2, parentId: 1, totalNumberOfTickets: 0, localizedInfo: [{ title: "Students" }] }];
const order = (id: string, date: string, tickets: { cat: number; price: number; cancelled?: boolean }[]) => ({ id, type: "shop_order", orderDate: date, payment: { occasion: "online", methods: [{ type: { id: "201", name: "Twint" } }] }, customer: { email: "someone@example.com", firstname: "A", lastname: "B", zip: "8000" }, tickets: tickets.map((t, i) => ({ id: `V${id}${i}`, categoryId: t.cat, price: t.price, cancelled: !!t.cancelled })) });

describe("orders, capacity, snapshot", () => {
  test("redactOrder keeps counts and money, drops the buyer and the ticket ids", () => {
    const r = redactOrder(order("86825001", "2026-08-25T11:43:09Z", [{ cat: 2, price: 500 }, { cat: 1, price: 1000 }, { cat: 1, price: 1000, cancelled: true }]), show, studentTest(cats));
    expect(r).toEqual({ order_id: "86825001", event_id: "e1", show_date: "2026-09-10", order_date: "2026-08-25T11:43:09Z", tickets: 2, students: 1, gross_chf: 15, cancelled: 1, payment: "Twint", type: "shop_order" });
    expect(JSON.stringify(r)).not.toContain("@"); expect(JSON.stringify(r)).not.toContain("V8682");
  });
  test("capacity is one pool, the student sub-category shares it", () => {
    expect(capacityOf(cats)).toBe(60); expect(capacityOf(cats, 80)).toBe(80);
    const rows: OrderRow[] = [redactOrder(order("1", "2026-09-01T10:00:00Z", [{ cat: 1, price: 1000 }, { cat: 2, price: 500 }]), show, studentTest(cats)), redactOrder(order("2", "2026-09-02T10:00:00Z", [{ cat: 1, price: 1000 }]), show, studentTest(cats))];
    expect(summarise(rows, 60)).toEqual({ tickets: 3, students: 1, cancelled: 0, orders: 2, gross_chf: 25, capacity: 60, remaining: 57, last_order_at: "2026-09-02T10:00:00Z" });
  });
  test("upsertOrders keys by order id and reports adds and changes", () => {
    const a = redactOrder(order("1", "2026-09-01T10:00:00Z", [{ cat: 1, price: 1000 }]), show, () => false);
    const a2 = { ...a, cancelled: 1, tickets: 0, gross_chf: 0 };
    const b = redactOrder(order("2", "2026-09-02T10:00:00Z", [{ cat: 1, price: 1000 }]), show, () => false);
    expect(upsertOrders([a], [a2, b])).toEqual({ rows: [a2, b], added: 1, changed: 1 });
  });
});

describe("time and windows", () => {
  test("zurich converts UTC on both sides of the October change", () => {
    expect(zurich("2026-09-10T17:33:16Z")).toMatchObject({ date: "2026-09-10", hour: 19, weekday: 4 });
    expect(zurich("2026-10-29T17:33:16Z")).toMatchObject({ date: "2026-10-29", hour: 18, weekday: 4 });
    expect(zurich("2026-09-13T22:30:00Z").date).toBe("2026-09-14");
  });
  test("attribution window is the Friday six days before to the show", () => { expect(attributionWindow("2026-09-17")).toEqual({ since: "2026-09-11", until: "2026-09-17" }); });
  test("slots pick the next two, the next one, or today's show", () => {
    const shows: Show[] = [{ ...show, show_date: "2026-09-10" }, { ...show, event_id: "e2", show_date: "2026-09-17" }, { ...show, event_id: "e3", show_date: "2026-09-24" }, { ...show, event_id: "e4", show_date: "2026-10-01" }];
    expect(slotShows("daily", shows, "2026-09-13").map((s) => s.event_id)).toEqual(["e2", "e3"]);
    expect(slotShows("midday", shows, "2026-09-13").map((s) => s.event_id)).toEqual(["e2"]);
    expect(slotShows("showday", shows, "2026-09-13")).toEqual([]);
    expect(slotShows("showday", shows, "2026-09-17").map((s) => s.event_id)).toEqual(["e2"]);
  });
});

describe("curve, projection, pace", () => {
  const rowsFor = (times: string[]): OrderRow[] => times.map((t, i) => ({ order_id: String(i), event_id: "e", show_date: "d", order_date: t, tickets: 1, students: 0, gross_chf: 10, cancelled: 0, payment: "", type: "" }));
  const start = "2026-09-10T19:30:00+02:00";
  const c1 = curveOf(rowsFor(["2026-09-10T15:00:00Z", "2026-09-10T16:00:00Z", "2026-09-09T10:00:00Z", "2026-09-03T10:00:00Z"]), start);
  test("curveOf gives hours before per ticket", () => { expect(c1.map(Math.round)).toEqual([3, 2, 32, 176]); });
  test("shareSoldBy uses the baseline under three shows and the median after", () => {
    expect(shareSoldBy(30, [c1])).toBeCloseTo(baselineShare(30), 5);
    expect(baselineShare(200)).toBe(0.148); expect(baselineShare(0)).toBeCloseTo(1, 5);
    expect(shareSoldBy(30, [c1, c1, c1])).toBe(0.5);
  });
  test("projectFinal divides and guards a zero share; paceMedian counts sold at the distance", () => {
    expect(projectFinal(15, 0.3)).toBe(50); expect(projectFinal(15, 0)).toBe(15);
    expect(paceMedian(30, [c1, c1, c1])).toBe(2); expect(Number.isNaN(paceMedian(30, []))).toBe(true);
  });
  test("curveTable buckets by day before and show-day hour in Zürich", () => {
    const t = curveTable(rowsFor(["2026-09-10T15:00:00Z", "2026-09-09T10:00:00Z", "2026-09-03T10:00:00Z"]), start);
    expect(t).toContain("7+ day(s) before 1"); expect(t).toContain(", 1 day(s) before 1"); expect(t).toContain("show day 1"); expect(t).toContain("17:00 1");
  });
});

describe("guards and money", () => {
  const base = { capacity: 60, door_reserve: 4, seats_left_ramp_stop: 6 };
  test("the capacity guard: projection first, seats-left backstop, lineup pause at sold out, never an ad set", () => {
    expect(guardDecision({ ...base, remaining: 40, projected: 50 })).toEqual([]);
    expect(guardDecision({ ...base, remaining: 40, projected: 56 }).map((a) => a.type)).toEqual(["ramp_off"]);
    expect(guardDecision({ ...base, remaining: 6, projected: null }).map((a) => a.type)).toEqual(["ramp_off"]);
    expect(guardDecision({ ...base, remaining: 0, projected: null }).map((a) => a.type)).toEqual(["ramp_off", "pause_lineup"]);
    const text = JSON.stringify(guardDecision({ ...base, remaining: 0, projected: 70 }));
    expect(text).not.toMatch(/\bcold\b|\bold ad set\b|pause_adset|PAUSED/);
  });
  test("blended net and the profit line", () => {
    expect(blendedNet(106, 24, 10, 5, 0)).toBeCloseTo(8.87, 2); expect(blendedNet(0, 0, 10, 5, 0)).toBe(10); expect(blendedNet(10, 0, 10, 5, 0.5)).toBe(9.5);
    expect(profitLine({ gross_chf: 220, spend: { total: 150 }, tickets: 24 }, { ...DEFAULT_BREW })).toBe(70);
    expect(profitLine({ gross_chf: 220, spend: { total: 150 }, tickets: 24 }, { ...DEFAULT_BREW, fixed_cost_chf: 50, per_ticket_cost_chf: 1 })).toBe(-4);
  });
  test("rampRan compares the three ramp ad sets with seven days of base", () => {
    const budgets = { cold: { base: 3 }, warm: { base: 3, ramp: 10 }, intent: { base: 2, ramp: 5 }, buyers: { base: 2, ramp: 8 } };
    expect(rampRan({ warm: 21, intent: 14, buyers: 14 }, budgets)).toBe(false);
    expect(rampRan({ warm: 45, intent: 20, buyers: 30 }, budgets)).toBe(true);
  });
  const fin = (date: string, tickets: number, spend: number, ramp = true): Final => ({ show_date: date, event_id: "e", tickets, students: 4, gross_chf: tickets * 9, cancelled: 0, orders: tickets, capacity: 60, checkins: null, payout: null, window: attributionWindow(date), spend: { total: spend, warm: spend * 0.4, intent: spend * 0.2, buyers: spend * 0.3, cold: spend * 0.1 }, site_clicks: null, blended_net_chf: 8.85, ads_per_ticket_chf: spend / tickets, ramp_ran: ramp, profit_chf: tickets * 9 - spend, written_at: "" });
  test("rampVerdict: all-ticket metric before base weeks exist, then stop, half, and the two-week restore", () => {
    const cheap = [fin("2026-09-10", 30, 100), fin("2026-09-03", 28, 100), fin("2026-08-27", 30, 90), fin("2026-08-20", 32, 100)];
    expect(rampVerdict(cheap, DEFAULT_BREW, null, "2026-09-12").level).toBe("full");
    const dear = [fin("2026-09-10", 12, 150), fin("2026-09-03", 14, 150), fin("2026-08-27", 13, 150), fin("2026-08-20", 15, 150)];
    const off = rampVerdict(dear, DEFAULT_BREW, null, "2026-09-12");
    expect(off.level).toBe("off"); expect(off.note).toContain("every ticket counts as ad-driven");
    const mid = [fin("2026-09-10", 20, 150), fin("2026-09-03", 20, 150), fin("2026-08-27", 20, 150), fin("2026-08-20", 20, 150)];
    expect(rampVerdict(mid, DEFAULT_BREW, null, "2026-09-12").level).toBe("half");
    const w1 = rampVerdict(cheap, DEFAULT_BREW, off, "2026-09-19");
    expect(w1.level).toBe("off"); expect(w1.clean_weeks).toBe(1);
    const w2 = rampVerdict(cheap, DEFAULT_BREW, w1, "2026-09-26");
    expect(w2.level).toBe("full"); expect(w2.note).toContain("restored");
  });
  test("rampVerdict judges the ramp on its increment once base weeks exist", () => {
    const finals = [fin("2026-09-10", 30, 150, true), fin("2026-09-03", 24, 100, false), fin("2026-08-27", 31, 150, true), fin("2026-08-20", 26, 100, false)];
    const v = rampVerdict(finals, DEFAULT_BREW, null, "2026-09-12");
    expect(v.note).toContain("ramp francs per extra ticket");
    // ramp weeks spend 0.9 x 150 = 135 on the three ramp sets, over a base median of 25 tickets: 5 or 6 extra, about CHF 25 per extra: off
    expect(v.level).toBe("off");
  });
  test("siteClicks sums redirects and clicks inside the window", () => {
    expect(siteClicks({ by_day: [{ date: "2026-09-10", redirect: 5, click: 1 }, { date: "2026-09-18", redirect: 9, click: 0 }, { date: "2026-09-12", redirect: 2, click: 2 }] }, "2026-09-11", "2026-09-17")).toBe(4);
    expect(siteClicks(null, "a", "b")).toBeNull();
  });
});

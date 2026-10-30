import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COPY_PATHS, EventfrogWriter, PLACEMENT_FIELDS, WRITE_PATHS, copyEventBody, placementBody } from "../lib/eventfrog-write";
import { COMEDY_BREW, HOOK_MAX, loadCopyPool, pickHook, planJobs, type EventLite, type Reviews } from "../eventfrog-content";
import { addDays, compareCategories, compareCopy, isThursday, loadState, missingThursdays, planCopies, saveState, type Category, type EventShape } from "../eventfrog-dates";

const KEY = "sk-eventfrog-secret-0123456789";
const response = (status: number, body: any, headers: Record<string, string> = {}) =>
  new Response(body === null ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const POOL = { hooks: ["A line", "B line", "C line"], dates: { "2027-05-06": "Day off? Make a night of it" }, horizon: "2027-07-29" };

describe("which Thursdays are missing", () => {
  test("Thursdays after the latest date up to the horizon, skipping ones that exist; gaps before the latest date are left alone", () => {
    expect(isThursday("2027-01-07")).toBe(true);
    expect(isThursday("2027-01-08")).toBe(false);
    expect(addDays("2026-12-31", 7)).toBe("2027-01-07");
    const m = missingThursdays(["2026-12-24", "2026-12-31", "2026-12-10"], "2027-01-28");
    expect(m).toEqual(["2027-01-07", "2027-01-14", "2027-01-21", "2027-01-28"]);
    expect(missingThursdays(["2026-12-31"], "2026-12-31")).toEqual([]);
    expect(missingThursdays(["2026-12-31", "2027-01-14"], "2027-01-21")).toEqual(["2027-01-21"]);   // 14 Jan is the latest, 7 Jan is a gap and stays one
    expect(() => missingThursdays([], "2027-01-21")).toThrow(/no existing date/);
    expect(() => missingThursdays(["2026-12-31"], "July")).toThrow(/YYYY-MM-DD/);
  });

  test("dates created earlier but still unpublished are kept in the list so their copy gets checked", () => {
    expect(missingThursdays(["2026-12-31"], "2027-01-21", ["2027-01-07"])).toEqual(["2027-01-07", "2027-01-14", "2027-01-21"]);
    expect(missingThursdays(["2026-12-31", "2027-01-14"], "2027-01-21", ["2027-01-07"])).toEqual(["2027-01-07", "2027-01-21"]);   // a known gap is ours to look after
    expect(missingThursdays(["2026-12-31", "2027-01-07"], "2027-01-07", ["2027-01-07"])).toEqual([]);                            // published now: the listing owns it
  });

  test("the state file keeps date to id, survives a round trip, and drops junk", () => {
    const p = join(tmpdir(), `dates-state-${Math.random().toString(36).slice(2)}`, "dates-state.json");
    expect(loadState(p)).toEqual({ created: {} });
    saveState({ created: { "2027-01-14": { id: "2", source: "1", createdAt: "t" }, "2027-01-07": { id: "7521848404105780352", source: "7521657850856244379", createdAt: "2026-10-30T09:00:00Z" } } }, p);
    const back = loadState(p);
    expect(Object.keys(back.created)).toEqual(["2027-01-07", "2027-01-14"]);
    expect(back.created["2027-01-07"].id).toBe("7521848404105780352");
    writeFileSync(p, JSON.stringify({ created: { "2027-01-21": { id: "not-a-snowflake" }, "someday": { id: "3" } } }));
    expect(loadState(p)).toEqual({ created: {} });
  });

  test("the 2027 run is 30 Thursdays, 7 January to 29 July", () => {
    const m = missingThursdays(["2026-12-31"], "2027-07-29");
    expect(m.length).toBe(30);
    expect(m[0]).toBe("2027-01-07");
    expect(m[29]).toBe("2027-07-29");
    expect(m.every(isThursday)).toBe(true);
  });
});

describe("the copy request", () => {
  test("19:30 to 22:00 local Zürich time, the source locale, the date's own title; a pinned line beats the walk", () => {
    const plans = planCopies(["2027-04-29", "2027-05-06"], POOL, "de_CH");
    expect(plans[0].request).toEqual({ beginDate: "2027-04-29T19:30:00", endDate: "2027-04-29T22:00:00", timeZone: "Europe/Zurich", locale: "de_CH", title: `${COMEDY_BREW.prefix}: ${pickHook("2027-04-29", POOL.hooks)}` });
    expect(plans[1].hook).toBe("Day off? Make a night of it");
    expect(plans[1].title).toBe("Comedy Brew, English Stand-Up: Day off? Make a night of it");
    expect(plans[1].title.length).toBeLessThanOrEqual(60);
  });

  test("the body carries the five fields and nothing else, in the spec's shape", () => {
    const req = { beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich", locale: "de_CH", title: "Comedy Brew, English Stand-Up: New year, same Thursday" };
    expect(copyEventBody(req)).toEqual({ beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich", localizedInfos: [{ locale: "de_CH", title: req.title }] });
    expect(() => copyEventBody({ ...req, beginDate: "2027-01-07T19:30:00+01:00" })).toThrow(/without offset/);
    expect(() => copyEventBody({ ...req, endDate: "2027-01-07T19:00:00" })).toThrow(/after beginDate/);
    expect(() => copyEventBody({ ...req, timeZone: "CET" })).toThrow(/timeZone/);
    expect(() => copyEventBody({ ...req, locale: "../x" })).toThrow(/locale/);
    expect(() => copyEventBody({ ...req, title: "x".repeat(61) })).toThrow(/3 to 60/);
    expect(() => copyEventBody({ ...req, title: "with — dash" })).toThrow(/em dash/);
    expect(() => copyEventBody({ ...req, visibility: { published: true } } as any)).toThrow(/field not allowed: visibility/);
    expect(() => copyEventBody({ ...req, title: "" })).toThrow(/needs title/);
  });
});

describe("the copy verb on the writer", () => {
  test("POSTs to the copy path only, takes the id from the Location header, counts against the cap", async () => {
    const seen: { url: string; method: string; body: any }[] = [];
    const w = new EventfrogWriter(KEY, { maxWrites: 2, fetchFn: (async (url: any, init: any) => { seen.push({ url: String(url), method: init.method, body: JSON.parse(init.body) }); return response(201, null, { location: "https://api.eventfrog.net/organizer/v1/events/7500000000000000001" }); }) as any });
    const req = { beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich", locale: "de_CH", title: "Comedy Brew, English Stand-Up: New year, same Thursday" };
    const r = await w.copyEvent("7521657850856244379", req);
    expect(r.id).toBe("7500000000000000001");
    expect(seen[0].url).toBe("https://api.eventfrog.net/organizer/v1/events/7521657850856244379/copy");
    expect(seen[0].method).toBe("POST");
    expect(seen[0].body.localizedInfos[0].title).toBe(req.title);
    expect(Object.keys(seen[0].body).sort()).toEqual(["beginDate", "endDate", "localizedInfos", "timeZone"]);
    await expect(w.copyEvent("abc", req)).rejects.toThrow(/bad source id/);
    await w.copyEvent("1", req);
    await expect(w.copyEvent("1", req)).rejects.toThrow(/write cap of 2/);
    expect(seen.length).toBe(2);
    expect(COPY_PATHS.length).toBe(1);
    expect(WRITE_PATHS.length).toBe(2);   // the copy verb did not widen the PATCH whitelist
  });

  test("an id in the body is accepted when there is no Location; neither means a failure", async () => {
    const w = new EventfrogWriter(KEY, { fetchFn: (async () => response(201, { id: "7500000000000000002" })) as any });
    const req = { beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich", locale: "de_CH", title: "Comedy Brew, English Stand-Up: x" };
    expect((await w.copyEvent("1", req)).id).toBe("7500000000000000002");
    const w2 = new EventfrogWriter(KEY, { fetchFn: (async () => response(201, {})) as any });
    await expect(w2.copyEvent("1", req)).rejects.toThrow(/no event id/);
    const w3 = new EventfrogWriter(KEY, { fetchFn: (async () => response(403, { title: "keyAccessType READ" })) as any });
    await expect(w3.copyEvent("1", req)).rejects.toThrow(/key rejected/);
  });

  test("placement patches reach group id and times on an event, nothing else, never a group", async () => {
    expect(PLACEMENT_FIELDS).toEqual(["groupId", "beginDate", "endDate", "timeZone"]);
    expect(placementBody({ groupId: "7132091334890862636" })).toEqual({ groupId: "7132091334890862636" });
    expect(() => placementBody({ visibility: { published: true } } as any)).toThrow(/placement field not allowed: visibility/);
    expect(() => placementBody({ groupId: "x" })).toThrow(/bad groupId/);
    expect(() => placementBody({ beginDate: "2027-01-07T19:30:00Z" })).toThrow(/without offset/);
    expect(() => placementBody({})).toThrow(/empty placement/);
    const seen: { url: string; method: string; body: any }[] = [];
    const w = new EventfrogWriter(KEY, { fetchFn: (async (url: any, init: any) => { seen.push({ url: String(url), method: init.method, body: JSON.parse(init.body) }); return response(200, {}); }) as any });
    await w.patchPlacement("/organizer/v1/events/1", { groupId: "2", beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich" });
    expect(seen[0]).toEqual({ url: "https://api.eventfrog.net/organizer/v1/events/1", method: "PATCH", body: { groupId: "2", beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich" } });
    await expect(w.patchPlacement("/organizer/v1/eventgroups/1", { groupId: "2" })).rejects.toThrow(/placement whitelist/);
    await expect(w.patchPlacement("/organizer/v1/events/1/copy", { groupId: "2" })).rejects.toThrow(/placement whitelist/);
  });
});

describe("the read-back comparison", () => {
  const source: EventShape = { id: "1", groupId: "g", locationId: "loc", model: "free", beginDate: "2026-12-31T19:30:00+01:00", endDate: "2026-12-31T22:00:00+01:00", cashlessEnabled: true, visibility: { published: true }, localizedInfo: [{ locale: "de_CH", title: "old", emblem: { url: "https://res.eventfrog.net/x.png" } }], ticketing: { currency: "CHF", paymentOccasions: { online: { serviceFeePayer: "organizer" }, onsiteEnabled: false } }, embedSettings: { color: "#60BF00" } };
  const plan = planCopies(["2027-01-07"], POOL, "de_CH")[0];
  const good: EventShape = { ...source, id: "2", beginDate: "2027-01-07T19:30:00+01:00", endDate: "2027-01-07T22:00:00+01:00", localizedInfo: [{ locale: "de_CH", title: plan.title, emblem: { url: "https://res.eventfrog.net/y.png" } }] };

  test("a faithful copy has nothing to fix and no problems", () => {
    const c = compareCopy(source, good, plan);
    expect(c.fix).toEqual({});
    expect(c.problems).toEqual([]);
    expect(c.notes).toEqual([]);
  });

  test("a copy outside the group or at the wrong time is fixable; unpublished is a note; a lost emblem, location or payment setup is a problem", () => {
    const c = compareCopy(source, { ...good, groupId: undefined, beginDate: "2027-01-07T20:00:00+01:00", endDate: undefined, visibility: { published: false } }, plan);
    expect(c.fix).toEqual({ groupId: "g", beginDate: "2027-01-07T19:30:00", endDate: "2027-01-07T22:00:00", timeZone: "Europe/Zurich" });
    expect(c.notes.some((n) => /unpublished/.test(n))).toBe(true);
    expect(c.problems).toEqual([]);
    const bad = compareCopy(source, { ...good, locationId: "elsewhere", localizedInfo: [{ locale: "de_CH", title: plan.title }], ticketing: { currency: "CHF", paymentOccasions: { online: { serviceFeePayer: "customer" } } } }, plan);
    expect(bad.problems).toEqual(["emblem image missing", "location elsewhere, source loc", "online payment setup differs"]);
  });

  test("a summer date compares in Zürich time, not UTC", () => {
    const july = planCopies(["2027-07-01"], POOL, "de_CH")[0];
    const c = compareCopy(source, { ...good, beginDate: "2027-07-01T17:30:00Z", endDate: "2027-07-01T20:00:00Z" }, july);
    expect(c.fix).toEqual({});
  });

  test("ticket categories must match on title, price, seats, main or sub, visibility and stop mode", () => {
    const src: Category[] = [
      { id: 1, localizedInfo: [{ title: "Normal" }], priceStrategy: { fixed: { price: 1000 } }, totalNumberOfTickets: 60, visibility: { type: "always" }, saleStopMode: "none" },
      { id: 2, parentId: 1, localizedInfo: [{ title: "Students" }], priceStrategy: { fixed: { price: 500 } }, totalNumberOfTickets: 0, visibility: { type: "always" }, saleStopMode: "none" },
    ];
    const same = src.map((c) => ({ ...c, id: (c.id || 0) + 10, parentId: c.parentId ? 11 : undefined }));
    expect(compareCategories(src, same)).toEqual([]);
    expect(compareCategories(src, [same[0]])).toEqual(["ticket categories: 1, source 2"]);
    expect(compareCategories(src, [same[0], { ...same[1], totalNumberOfTickets: 60 }])[0]).toMatch(/ticket category differs/);
    expect(compareCategories(src, [{ ...same[0], priceStrategy: { fixed: { price: 1200 } } }, same[1]])[0]).toMatch(/1200/);
  });
});

describe("pinned lines in the copy pool", () => {
  const file = (j: unknown) => { const p = join(tmpdir(), `eventfrog-copy-${Math.random().toString(36).slice(2)}.json`); writeFileSync(p, JSON.stringify(j)); return p; };

  test("a pinned line wins for its date only, the walk carries on either side, and the real file validates", () => {
    const pool = loadCopyPool(file({ hooks: ["A line", "B line"], dates: { "2027-05-06": "Day off? Make a night of it" }, horizon: "2027-07-29" }));
    expect(pool.horizon).toBe("2027-07-29");
    expect(pickHook("2027-05-06", pool.hooks, pool.dates)).toBe("Day off? Make a night of it");
    expect(pickHook("2027-04-29", pool.hooks, pool.dates)).toBe(pickHook("2027-04-29", pool.hooks));
    expect(pickHook("2027-05-13", pool.hooks, pool.dates)).toBe(pickHook("2027-05-13", pool.hooks));
    const real = loadCopyPool();
    expect(real.horizon).toBe("2027-07-29");
    expect(Object.keys(real.dates).length).toBeGreaterThanOrEqual(14);
    for (const [d, h] of Object.entries(real.dates)) { expect(h.length).toBeLessThanOrEqual(HOOK_MAX); expect(new Date(d + "T00:00:00Z").getUTCDay()).toBe(4); }
  });

  test("pinned lines obey the hook rules and the keys must be dates", () => {
    expect(() => loadCopyPool(file({ hooks: ["A"], dates: { "2027-05-06": "x".repeat(30) } }))).toThrow(/pinned hook 2027-05-06 over 29/);
    expect(() => loadCopyPool(file({ hooks: ["A"], dates: { "2027-05-06": "Ends with a stop." } }))).toThrow(/punctuation/);
    expect(() => loadCopyPool(file({ hooks: ["A"], dates: { "Ascension": "Day off" } }))).toThrow(/not a date/);
    expect(() => loadCopyPool(file({ hooks: ["A"], dates: ["Day off"] }))).toThrow(/object/);
    expect(() => loadCopyPool(file({ hooks: ["A"], horizon: "next July" }))).toThrow(/horizon/);
    expect(loadCopyPool(file({ hooks: ["A"] })).dates).toEqual({});
  });

  test("the daily content job titles a pinned date with its line", () => {
    const reviews: Reviews = { average: 4.9, total: 100, google_url: "https://search.google.com/local/reviews?placeid=x", reviews: [{ author: "Ann", excerpt: "A proper laugh, friendly room and ten comedians for the price of a coffee." }] };
    const ev: EventLite = { id: "9", beginDate: "2027-05-06T19:30:00+02:00", endDate: "2027-05-06T22:00:00+02:00", visibility: { published: true }, localizedInfo: [{ locale: "de_CH", title: "old", shortDescription: "", description: "" }] };
    const group = { id: "g", localizedInfo: [{ locale: "en_CH", title: "Series", description: "" }] };
    const jobs = planJobs(group, [ev], { nights: 150, since: "February 2022" }, POOL.hooks, reviews, "2027-01-01T00:00:00Z", COMEDY_BREW, POOL.dates);
    expect(jobs[1].wanted.title).toBe("Comedy Brew, English Stand-Up: Day off? Make a night of it");
    expect(jobs[1].wanted.description).toContain("<strong>Day off? Make a night of it.</strong>");
  });
});

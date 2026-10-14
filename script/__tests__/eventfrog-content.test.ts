import { describe, expect, test } from "bun:test";
import { COPY_FIELDS, EventfrogWriter, WRITE_PATHS, copyBody } from "../lib/eventfrog-write";
import {
  COMEDY_BREW, HOOK_MAX, changedFields, essence, eventCopy, eventTitle, fmtDay, history, matchesBrew, pickHook, planJobs, roundDown10, seriesCopy, utmLink, zurichDate,
  type EventLite,
} from "../eventfrog-content";

const KEY = "sk-eventfrog-secret-0123456789";
const response = (status: number, body: any) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("the writer reaches three copy fields on two paths and nothing else", () => {
  test("paths outside the whitelist are refused before any fetch", async () => {
    let calls = 0;
    const w = new EventfrogWriter(KEY, { fetchFn: (async () => { calls++; return response(200, {}); }) as any });
    for (const p of ["/organizer/v1/events/1/ticketcategories", "/organizer/v1/events/1/embedsettings", "/organizer/v1/events", "/organizer/v1/addresses/1", "/organizer/v1/events/abc"]) {
      await expect(w.patchCopy(p, "de_CH", { title: "Comedy Brew: test" })).rejects.toThrow(/not in the write whitelist/);
    }
    expect(calls).toBe(0);
    expect(WRITE_PATHS.length).toBe(2);
  });

  test("a body cannot carry anything but title, shortDescription, description", () => {
    expect(COPY_FIELDS).toEqual(["title", "shortDescription", "description"]);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", { title: "ok title", ticketing: { saleEndDate: "x" } } as any)).toThrow(/field not allowed: ticketing/);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", { visibility: { published: false } } as any)).toThrow(/field not allowed/);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", { beginDate: "2027-01-01" } as any)).toThrow(/field not allowed/);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", {})).toThrow(/empty copy/);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", { title: "ab" })).toThrow(/3 to 60/);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", { title: "x".repeat(61) })).toThrow(/3 to 60/);
    expect(() => copyBody("/organizer/v1/events/1", "de_CH", { title: "with an em dash — no" })).toThrow(/em dash/);
    expect(() => copyBody("/organizer/v1/events/1", "../x", { title: "ok title" })).toThrow(/bad locale/);
  });

  test("events get localizedInfos (plural), groups get localizedInfo, keyed by the existing locale", () => {
    expect(copyBody("/organizer/v1/events/1", "de_CH", { title: "Comedy Brew: t" })).toEqual({ localizedInfos: { de_CH: { title: "Comedy Brew: t" } } });
    expect(copyBody("/organizer/v1/eventgroups/1", "en_CH", { title: "Series", description: "<p>x</p>" })).toEqual({ localizedInfo: { en_CH: { title: "Series", description: "<p>x</p>" } } });
  });

  test("a write is a PATCH with the key in the header only, and the cap stops a runaway run", async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const w = new EventfrogWriter(KEY, { fetchFn: (async (u: any, init: any) => { seen.push({ url: String(u), init }); return response(200, { id: "1" }); }) as any, maxWrites: 2 });
    await w.patchCopy("/organizer/v1/events/1", "de_CH", { title: "Comedy Brew: one" });
    expect(seen[0].init.method).toBe("PATCH");
    expect((seen[0].init.headers as any).Authorization).toBe(`Bearer ${KEY}`);
    expect(seen[0].url).toBe("https://api.eventfrog.net/organizer/v1/events/1");
    expect(seen[0].url).not.toContain(KEY);
    expect(JSON.parse(String(seen[0].init.body))).toEqual({ localizedInfos: { de_CH: { title: "Comedy Brew: one" } } });
    await w.patchCopy("/organizer/v1/events/2", "de_CH", { title: "Comedy Brew: two" });
    await expect(w.patchCopy("/organizer/v1/events/3", "de_CH", { title: "Comedy Brew: three" })).rejects.toThrow(/write cap/);
    expect(seen.length).toBe(2);
  });

  test("401 and 403 raise the auth error, other failures carry the status and never the key", async () => {
    const w = new EventfrogWriter(KEY, { fetchFn: (async () => new Response("denied", { status: 403 })) as any });
    await expect(w.patchCopy("/organizer/v1/events/1", "de_CH", { title: "Comedy Brew: t" })).rejects.toThrow(/key rejected/);
    const w2 = new EventfrogWriter(KEY, { fetchFn: (async () => new Response(`bad ${KEY}`, { status: 422 })) as any });
    const err = await w2.patchCopy("/organizer/v1/events/1", "de_CH", { title: "Comedy Brew: t" }).catch((e) => e);
    expect(String(err.message)).toContain("422");
    expect(String(err.message)).not.toContain(KEY);
  });
});

const HOOKS = ["Fix your Thursday boredom", "Nobody will make you talk", "Bring the flatmates", "Where Thursday goes", "Thursday, sorted", "Half the room came alone", "Have you actually been?"];

describe("hooks and titles", () => {
  test("a date always gets the same hook, consecutive Thursdays walk the pool without a repeat", () => {
    expect(pickHook("2026-10-15", HOOKS)).toBe(pickHook("2026-10-15", HOOKS));
    const thursdays: string[] = [];
    for (let i = 0; i < HOOKS.length; i++) { const d = new Date(Date.UTC(2026, 9, 15 + 7 * i)); thursdays.push(d.toISOString().slice(0, 10)); }
    const picked = thursdays.map((d) => pickHook(d, HOOKS));
    expect(new Set(picked).size).toBe(HOOKS.length);
    for (const d of thursdays) expect(HOOKS).toContain(pickHook(d, HOOKS));
    expect(pickHook("2022-02-27", HOOKS)).toBe(HOOKS[0]);   // the first night starts the walk
    expect(HOOKS).toContain(pickHook("2021-01-01", HOOKS));  // a date before it still resolves
  });

  test("the title keeps the fixed prefix, says Comedy Brew, leaves the city to Eventfrog", () => {
    const t = eventTitle("Fix your Thursday boredom");
    expect(t).toBe("Comedy Brew, English Stand-Up: Fix your Thursday boredom");
    expect(t.startsWith(COMEDY_BREW.prefix)).toBe(true);
    expect(t).toContain("Comedy Brew");                 // the thank-you email matches the Mailchimp tag on it
    expect(/z[uü]rich/i.test(t)).toBe(false);          // Eventfrog appends "in Zürich" itself
    expect(t.length).toBeLessThanOrEqual(60);
    expect(() => eventTitle("x".repeat(30))).toThrow(/over 60/);
    expect(HOOK_MAX).toBe(29);
    expect(COMEDY_BREW.groupTitle.length).toBeLessThanOrEqual(60);
  });
});

describe("history from the organiser's event list", () => {
  const ev = (title: string, beginDate: string, cancelled = false): EventLite => ({ id: beginDate, beginDate, cancelled, localizedInfo: [{ locale: "de_CH", title }] });
  const EVENTS = [
    ev("IN YOUR FACE Stand-Up Comedy Open Mic", "2022-02-27T19:00:00+01:00"),
    ev("IN YOUR FACE Comedy Brew at ROBIN's coffee", "2023-05-04T19:30:00+02:00"),
    ev("IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic ", "2026-10-08T19:30:00+02:00"),
    ev("IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic", "2026-10-15T19:30:00+02:00"),
    ev("Comedy Brew, English Stand-Up: Thursday, sorted", "2026-10-22T19:30:00+02:00"),
    ev("TALL ORDER: english stand-up comedy open mic", "2026-10-20T20:00:00+02:00"),
    ev("Pulp Non-Fiction Storytelling Open Mic Zurich", "2026-11-01T19:00:00+01:00"),
    ev("IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic", "2024-01-11T19:30:00+01:00", true),
  ];

  test("matchesBrew knows the four historical names and the new one, and rejects the other open mics", () => {
    for (const e of EVENTS.slice(0, 5)) expect(matchesBrew(e.localizedInfo![0].title)).toBe(true);
    expect(matchesBrew("TALL ORDER: english stand-up comedy open mic")).toBe(false);
    expect(matchesBrew("Pulp Non-Fiction Storytelling Open Mic Zurich")).toBe(false);
    expect(matchesBrew(undefined)).toBe(false);
  });

  test("nights counts past, non-cancelled Brew nights; since is the first night's month", () => {
    const h = history(EVENTS, "2026-10-14T12:00:00.000Z");
    expect(h).toEqual({ nights: 3, since: "February 2022" });
    expect(roundDown10(153)).toBe(150);
    expect(roundDown10(9)).toBe(0);
  });
});

describe("the copy", () => {
  const ev = { beginDate: "2026-10-15T19:30:00+02:00" };

  test("dates render in Zürich time", () => {
    expect(fmtDay(ev.beginDate)).toBe("Thursday 15 October");
    expect(zurichDate("2026-10-15T23:30:00Z")).toBe("2026-10-16");   // 01:30 local the next day
    expect(zurichDate(ev.beginDate)).toBe("2026-10-15");
  });

  test("the site links carry the UTM tags, source eventfrog, medium referral", () => {
    expect(utmLink("/calendar/", "event-2026-10-15")).toBe("https://inyourfacecomedy.ch/calendar/?utm_source=eventfrog&utm_medium=referral&utm_campaign=comedybrew&utm_content=event-2026-10-15");
  });

  test("an event page: hook first, the night, buy now, the calendar link, the FAQ link, the contact address", () => {
    const c = eventCopy(ev, "Nobody will make you talk");
    expect(c.title).toBe("Comedy Brew, English Stand-Up: Nobody will make you talk");
    expect(c.shortDescription!.startsWith("Nobody will make you talk. ")).toBe(true);
    expect(c.shortDescription!.length).toBeLessThanOrEqual(255);
    const d = c.description!;
    expect(d.startsWith("<p><strong>Nobody will make you talk.</strong>")).toBe(true);
    expect(d).toContain("Thursday 15 October");
    expect(d).toContain("Grab your ticket above");
    expect(d).toContain("60 seats");
    expect(d).toContain('href="https://inyourfacecomedy.ch/calendar/?utm_source=eventfrog&amp;utm_medium=referral&amp;utm_campaign=comedybrew&amp;utm_content=event-2026-10-15"'.replace(/&amp;/g, "&"));
    expect(d).toContain("/faq/?utm_source=eventfrog");
    expect(d).toContain("harry@inyourfacecomedy.ch");
    expect(d).not.toContain("hfuecks");
    expect(d).not.toMatch(/CHF/);
    expect(d).not.toContain("—");
    expect(d).not.toMatch(/tonight|tomorrow/i);
  });

  test("the series page names the start month and a rounded-down night count", () => {
    const c = seriesCopy({ nights: 153, since: "February 2022" });
    expect(c.title).toBe(COMEDY_BREW.groupTitle);
    expect(c.description).toContain("Running since February 2022: more than 150 Thursdays");
    expect(c.description).toContain("Pick a Thursday below for tickets");
    expect(c.description).toContain("utm_content=series");
    expect(c.description).toContain("harry@inyourfacecomedy.ch");
    expect(c.shortDescription).toBeUndefined();        // groups have no short description
  });

  test("a hook with an ampersand is escaped in the HTML, not in the title", () => {
    const c = eventCopy(ev, "Jokes & drinks");
    expect(c.description).toContain("<strong>Jokes &amp; drinks.</strong>");
    expect(c.title).toContain("Jokes & drinks");
  });
});

describe("comparison survives Eventfrog's editor", () => {
  test("entities, added rel/target attributes and whitespace do not count as a change; words and links do", () => {
    const wanted = `<p>Can't make it? <a href="https://inyourfacecomedy.ch/calendar/?a=1&b=2">the calendar</a>.</p>`;
    const stored = `<p>Can&#39;t make it?&nbsp;<a href="https://inyourfacecomedy.ch/calendar/?a=1&amp;b=2" target="_blank" rel="nofollow">the calendar</a>.</p>\n`;
    expect(essence(stored)).toBe(essence(wanted));
    expect(changedFields({ description: stored }, { description: wanted })).toEqual([]);
    expect(changedFields({ description: stored }, { description: wanted.replace("calendar", "calender") })).toEqual(["description"]);
    expect(changedFields({ description: stored }, { description: wanted.replace("b=2", "b=3") })).toEqual(["description"]);
    expect(changedFields({ title: "A", description: "" }, { title: "A", description: "<p>x</p>" })).toEqual(["description"]);
  });
});

describe("planning a run", () => {
  const group = { id: "7132091334890862636", localizedInfo: [{ locale: "en_CH", title: "old", description: "<p>old</p>" }] };
  const events: EventLite[] = [
    { id: "2", beginDate: "2026-10-22T19:30:00+02:00", endDate: "2026-10-22T22:00:00+02:00", visibility: { published: true }, localizedInfo: [{ locale: "de_CH", title: "old", shortDescription: "old", description: "<p>old</p>" }] },
    { id: "1", beginDate: "2026-10-15T19:30:00+02:00", endDate: "2026-10-15T22:00:00+02:00", visibility: { published: true }, localizedInfo: [{ locale: "de_CH", title: "old", shortDescription: "old", description: "<p>old</p>" }] },
    { id: "0", beginDate: "2026-10-08T19:30:00+02:00", endDate: "2026-10-08T22:00:00+02:00", visibility: { published: true }, localizedInfo: [{ locale: "de_CH", title: "past", description: "" }] },
    { id: "9", beginDate: "2026-10-29T19:30:00+02:00", endDate: "2026-10-29T22:00:00+02:00", cancelled: true, localizedInfo: [{ locale: "de_CH", title: "cancelled", description: "" }] },
  ];
  const hist = { nights: 153, since: "February 2022" };

  test("the series page first, then upcoming dates in order; past and cancelled dates are left alone", () => {
    const jobs = planJobs(group, events, hist, HOOKS, "2026-10-14T12:00:00.000Z");
    expect(jobs.map((j) => j.label)).toEqual(["series page", "2026-10-15", "2026-10-22"]);
    expect(jobs[0].path).toBe("/organizer/v1/eventgroups/7132091334890862636");
    expect(jobs[0].locale).toBe("en_CH");
    expect(jobs[1].path).toBe("/organizer/v1/events/1");
    expect(jobs[1].locale).toBe("de_CH");
    expect(jobs[1].changed).toEqual(["title", "shortDescription", "description"]);
  });

  test("a page already in the wanted state is in sync and is not written", () => {
    const jobs = planJobs(group, events, hist, HOOKS, "2026-10-14T12:00:00.000Z");
    const synced = events.map((e) => e.id === "1" ? { ...e, localizedInfo: [{ locale: "de_CH", ...jobs[1].wanted }] } : e);
    const again = planJobs(group, synced, hist, HOOKS, "2026-10-14T12:00:00.000Z");
    expect(again[1].changed).toEqual([]);
    expect(again[2].changed.length).toBe(3);
  });
});

describe("the write key is its own variable", () => {
  test("without EVENTFROG_ORGANIZER_WRITE the writer refuses to start, even with the read key set", async () => {
    const { eventfrogWriterFromEnv, WRITE_KEY_ENV } = await import("../lib/eventfrog-write");
    expect(WRITE_KEY_ENV).toBe("EVENTFROG_ORGANIZER_WRITE");
    const saved = process.env[WRITE_KEY_ENV];
    process.env[WRITE_KEY_ENV] = "";                 // defined but empty: loadEnv() leaves it alone, so .env cannot fill it in
    process.env.EVENTFROG_ORGANIZER = "sk-read-only";
    try { expect(() => eventfrogWriterFromEnv()).toThrow(/EVENTFROG_ORGANIZER_WRITE is not set/); }
    finally { if (saved !== undefined) process.env[WRITE_KEY_ENV] = saved; else delete process.env[WRITE_KEY_ENV]; }
  });
});

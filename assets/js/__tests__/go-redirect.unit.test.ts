// Pure-logic unit tests for assets/js/go-redirect.js — the /go/ campaign-link
// redirector. The invariant that matters most here: for ANY query-string input,
// every resolvable destination is either a curated catalog ticket URL or a
// same-site path. There is no code path from query input to an arbitrary URL.
import { describe, expect, test } from "bun:test";

// The script lives in _includes/ because _layouts/go.html inlines it into the
// page (no separate asset fetch on the redirect hot path).
const go = require("../../../_includes/go-redirect.js") as {
  norm: (s: string) => string;
  isValidDate: (s: string) => boolean;
  localISODate: (d: Date) => string;
  primaryTitle: (t: string) => string;
  isUpcoming: (e: unknown, today: string, nowMs?: number) => boolean;
  nextEvent: (events: unknown[], show: unknown, today: string, nowMs?: number) => { date: string } | null;
  resolveTarget: (
    shows: unknown[], events: unknown[],
    showParam: string, dateParam: string, today: string, nowMs?: number
  ) => { kind: string; url?: string; show?: { slug: string }; event?: { date: string } };
  build404: (search: string, showParam: string) => string;
  linkTag: (p: URLSearchParams) => string;
  daysToShow: (showDate: string, today: string) => string;
  showParams: (res: unknown, today: string) => Record<string, unknown>;
  pixelParams: (res: unknown, params: URLSearchParams, today: string) => Record<string, unknown>;
  newEventId: () => string;
};

const SHOWS = [
  { slug: "comedybrew", title: "Comedy Brew • English Stand-Up Comedy Open Mic", url: "/comedybrew/", tickets: "https://eventfrog.ch/en/p/groups/brew-group.html", type: "series", next: "2026-09-10T19:30:00+02:00", venue: "robins", price: 10 },
  { slug: "jackpotcomedy", title: "Jackpot Comedy - downstairs @ OTRO", url: "/jackpotcomedy/", tickets: "https://eventfrog.ch/en/p/groups/jackpot-group.html", type: "series", next: "2026-09-16T20:00:00+02:00", venue: "otro", price: 0 },
  { slug: "noticketseries", title: "Ticketless", url: "/noticketseries/", tickets: "", type: "series" },
];

// Listed out of date order on purpose: the resolver must pick the earliest, not the first.
const EVENTS = [
  { show: "comedybrew", date: "2026-09-10", end: "2026-09-10T22:00:00+02:00", tickets: "https://eventfrog.ch/en/p/theatre-stage/brew-0910.html", venue: "robins", price: 10 },
  { show: "comedybrew", date: "2026-09-03", end: "2026-09-03T22:00:00+02:00", tickets: "https://eventfrog.ch/en/p/theatre-stage/brew-0903.html", venue: "robins", price: 10 },
  { show: "comedybrew", date: "2026-08-20", end: "2026-08-20T22:00:00+02:00", tickets: "https://eventfrog.ch/en/p/theatre-stage/brew-0820.html", venue: "robins", price: 10 },
  { show: "jackpotcomedy", date: "2026-09-16", end: "2026-09-16T22:30:00+02:00", tickets: "https://eventfrog.ch/en/p/theatre-stage/jackpot-0916.html", venue: "otro", price: 0 },
];

const TODAY = "2026-08-26";

describe("go-redirect • resolveTarget happy paths", () => {
  test("show alone resolves to the NEXT upcoming date's own event page (the earliest after today)", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "", TODAY);
    expect(r.kind).toBe("next");
    expect(r.url).toBe("https://eventfrog.ch/en/p/theatre-stage/brew-0903.html");
    expect(r.event!.date).toBe("2026-09-03");
  });

  test("show + future date resolves to that date's own event page", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "jackpotcomedy", "2026-09-16", TODAY);
    expect(r.kind).toBe("event");
    expect(r.url).toBe("https://eventfrog.ch/en/p/theatre-stage/jackpot-0916.html");
  });

  test("slug matching is case- and separator-insensitive (promo-link contract)", () => {
    expect(go.resolveTarget(SHOWS, EVENTS, "Comedy-Brew", "", TODAY).kind).toBe("next");
    expect(go.resolveTarget(SHOWS, EVENTS, "COMEDYBREW", "", TODAY).kind).toBe("next");
  });
});

describe("go-redirect • the show-day cut-off (before and after each show, with nothing to edit)", () => {
  const SHOW_DAY = "2026-09-03";
  const beforeEnd = Date.parse("2026-09-03T18:00:00+02:00");
  const afterEnd = Date.parse("2026-09-03T22:00:01+02:00");

  test("on the show day before its end time, the link lands on tonight's page", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "", SHOW_DAY, beforeEnd);
    expect(r.kind).toBe("next");
    expect(r.event!.date).toBe("2026-09-03");
  });

  test("a minute after the end time, the same link lands on next week's page", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "", SHOW_DAY, afterEnd);
    expect(r.kind).toBe("next");
    expect(r.event!.date).toBe("2026-09-10");
  });

  test("today's event with no parseable end stays on until midnight", () => {
    expect(go.isUpcoming({ date: SHOW_DAY, end: "" }, SHOW_DAY, afterEnd)).toBe(true);
    expect(go.isUpcoming({ date: SHOW_DAY, end: "garbage" }, SHOW_DAY, afterEnd)).toBe(true);
    expect(go.isUpcoming({ date: SHOW_DAY, end: "2026-09-03T22:00:00+02:00" }, SHOW_DAY, afterEnd)).toBe(false);
    expect(go.isUpcoming({ date: SHOW_DAY, end: "2026-09-03T22:00:00+02:00" }, SHOW_DAY, beforeEnd)).toBe(true);
    expect(go.isUpcoming({ date: "2026-09-02" }, SHOW_DAY, beforeEnd)).toBe(false);
    expect(go.isUpcoming({ date: "2026-09-04" }, SHOW_DAY, afterEnd)).toBe(true);
    expect(go.isUpcoming({ date: "nope" }, SHOW_DAY, afterEnd)).toBe(false);
  });

  test("nextEvent skips dates without a ticket link", () => {
    const events = [
      { show: "comedybrew", date: "2026-09-03", tickets: "" },
      { show: "comedybrew", date: "2026-09-10", tickets: "https://eventfrog.ch/en/p/theatre-stage/brew-0910.html" },
    ];
    expect(go.nextEvent(events, { slug: "comedybrew" }, TODAY)!.date).toBe("2026-09-10");
  });
});

describe("go-redirect • fallback chain", () => {
  test("a PAST date skips the event branch and lands on the next upcoming date", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-01-01", TODAY);
    expect(r.kind).toBe("next");
    expect(r.event!.date).toBe("2026-09-03");
  });

  test("an unknown future date lands on the next upcoming date", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-12-25", TODAY);
    expect(r.kind).toBe("next");
  });

  test("with nothing upcoming in the calendar, the series link (group page) is the fallback", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "", "2026-09-11");
    expect(r.kind).toBe("series");
    expect(r.url).toBe("https://eventfrog.ch/en/p/groups/brew-group.html");
    // A past calendar date never counts, even when it is the only one.
    expect(go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-09-03", "2026-09-11").kind).toBe("series");
  });

  test("a show with no ticket link falls back to its own page (same-site path)", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "noticketseries", "", TODAY);
    expect(r.kind).toBe("showpage");
    expect(r.url).toBe("/noticketseries/");
  });

  test("unknown show → notfound (never a guess, never external)", () => {
    expect(go.resolveTarget(SHOWS, EVENTS, "not-a-show", "", TODAY).kind).toBe("notfound");
    expect(go.resolveTarget(SHOWS, EVENTS, "", "", TODAY).kind).toBe("notfound");
  });
});

describe("go-redirect • the open-redirect invariant (hostile inputs)", () => {
  const HOSTILE = [
    "https://evil.example",
    "//evil.example",
    "javascript:alert(1)",
    "..%2f..%2fetc",
    "comedybrew https://evil.example",
    "<script>alert(1)</script>",
  ];

  test("every resolvable destination is catalog data or a same-site path", () => {
    for (const bad of HOSTILE) {
      for (const date of ["", "2026-09-03", bad]) {
        const r = go.resolveTarget(SHOWS, EVENTS, bad, date, TODAY);
        if (r.kind === "notfound") continue;
        const catalogUrls = [
          ...SHOWS.map((s) => (s as { tickets: string }).tickets),
          ...SHOWS.map((s) => (s as { url: string }).url),
          ...EVENTS.map((e) => (e as { tickets: string }).tickets),
        ];
        expect(catalogUrls).toContain(r.url!);
      }
    }
  });

  test("norm() strips everything a crafted slug could hide behind", () => {
    expect(go.norm("javascript:alert(1)")).toBe("javascriptalert1");
    expect(go.norm("https://evil.example")).toBe("httpsevilexample");
  });
});

describe("go-redirect • build404 (broken links surface in GA)", () => {
  test("carries from=go, the offending slug, and ONLY utm_* params", () => {
    const url = go.build404("?show=typo&utm_source=meta&utm_medium=paid_social&utm_campaign=x&url=https://evil.example&foo=bar", "typo");
    expect(url.startsWith("/404.html?")).toBe(true);
    const p = new URLSearchParams(url.split("?")[1]);
    expect(p.get("from")).toBe("go");
    expect(p.get("show")).toBe("typo");
    expect(p.get("utm_source")).toBe("meta");
    expect(p.get("utm_campaign")).toBe("x");
    expect(p.get("url")).toBeNull();     // non-utm params never forwarded
    expect(p.get("foo")).toBeNull();
  });

  test("the slug is length-capped and URL-encoded (no query-string breakout)", () => {
    const url = go.build404("", "a".repeat(500) + "&x=1");
    const p = new URLSearchParams(url.split("?")[1]);
    expect((p.get("show") || "").length).toBeLessThanOrEqual(64);
    expect(p.get("x")).toBeNull();       // the & was encoded, not interpreted
  });
});

describe("go-redirect • small helpers", () => {
  test("isValidDate accepts YYYY-MM-DD only", () => {
    expect(go.isValidDate("2026-09-16")).toBe(true);
    expect(go.isValidDate("2026-9-16")).toBe(false);
    expect(go.isValidDate("16.09.2026")).toBe(false);
    expect(go.isValidDate("")).toBe(false);
  });

  test("primaryTitle takes the first segment of a show title", () => {
    expect(go.primaryTitle("Comedy Brew • English Stand-Up")).toBe("Comedy Brew");
    expect(go.primaryTitle("Jackpot Comedy - downstairs @ OTRO")).toBe("Jackpot Comedy");
    expect(go.primaryTitle("Plain Title")).toBe("Plain Title");
  });

  test("localISODate formats local dates as YYYY-MM-DD", () => {
    expect(go.localISODate(new Date(2026, 8, 3))).toBe("2026-09-03");
  });

  test("linkTag packs the clicked link's own utm tags for the GA `link` dimension", () => {
    expect(go.linkTag(new URLSearchParams("show=comedybrew&utm_source=meta&utm_medium=paid_social&utm_campaign=comedybrew&utm_content=120203748201470314")))
      .toBe("meta|paid_social|comedybrew|120203748201470314");
    expect(go.linkTag(new URLSearchParams("show=comedybrew&utm_campaign=newsletter"))).toBe("||newsletter|");
    expect(go.linkTag(new URLSearchParams("show=comedybrew&fbclid=abc"))).toBe("");     // untagged: nothing to say
    expect(go.linkTag(new URLSearchParams("utm_source=a|b"))).toBe("a/b|||");           // separator never leaks in
    expect(go.linkTag(new URLSearchParams("utm_content=" + "x".repeat(200))).length).toBe(100);
  });
});

describe("go-redirect • show context for GA (docs/analytics.md)", () => {
  test("daysToShow buckets like the Eventfrog sales export", () => {
    const cases: [string, string][] = [
      ["2026-08-26", "00"], ["2026-08-27", "01"], ["2026-08-28", "02-03"], ["2026-08-29", "02-03"],
      ["2026-08-30", "04-07"], ["2026-09-02", "04-07"], ["2026-09-03", "08-14"], ["2026-09-09", "08-14"],
      ["2026-09-10", "15-30"], ["2026-09-25", "15-30"], ["2026-09-26", "31+"], ["2027-01-01", "31+"],
      ["2026-08-25", "past"], ["", "(unknown)"], ["nope", "(unknown)"],
    ];
    for (const [date, bucket] of cases) expect(go.daysToShow(date, TODAY)).toBe(bucket);
    expect(go.daysToShow("2026-09-01", "")).toBe("(unknown)");
    // GA sorts dimension values as strings; zero padding keeps the buckets in order.
    const labels = ["00", "01", "02-03", "04-07", "08-14", "15-30", "31+"];
    expect([...labels].sort()).toEqual(labels);
  });

  test("a date link carries that date's venue, price and days-to-show", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-09-03", TODAY);
    expect(go.showParams(r, TODAY)).toEqual({
      venue: "robins", show_date: "2026-09-03", days_to_show: "08-14", price_chf: 10, value: 10, currency: "CHF",
    });
  });

  test("an undated link reports the resolved next date and its venue/price", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "", TODAY);
    expect(go.showParams(r, TODAY)).toEqual({
      venue: "robins", show_date: "2026-09-03", days_to_show: "08-14", price_chf: 10, value: 10, currency: "CHF",
    });
  });

  test("a series fallback reports the show's next date from its post and its own venue/price", () => {
    const r = go.resolveTarget(SHOWS, [], "jackpotcomedy", "", TODAY);
    expect(r.kind).toBe("series");
    expect(go.showParams(r, TODAY)).toEqual({
      venue: "otro", show_date: "2026-09-16", days_to_show: "15-30", price_chf: 0, value: 0, currency: "CHF",
    });
  });

  test("a show with no catalog context reports (unknown), never undefined", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "noticketseries", "", TODAY);
    expect(go.showParams(r, TODAY)).toEqual({
      venue: "(unknown)", show_date: "(unknown)", days_to_show: "(unknown)", price_chf: 0, value: 0, currency: "CHF",
    });
  });

  test("an unknown show adds nothing to the event", () => {
    expect(go.showParams(go.resolveTarget(SHOWS, EVENTS, "nope", "", TODAY), TODAY)).toEqual({});
    expect(go.showParams(null, TODAY)).toEqual({});
  });
});

describe("go-redirect • Meta pixel TicketRedirect payload", () => {
  const P = new URLSearchParams("show=comedybrew&date=2026-09-03&utm_source=meta&utm_medium=paid_social&utm_campaign=comedybrew-20260903");

  test("a date link names the show as content and carries the same context as GA", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-09-03", TODAY);
    expect(go.pixelParams(r, P, TODAY)).toEqual({
      content_name: "comedybrew", content_ids: ["comedybrew"], content_type: "product",
      show_date: "2026-09-03", days_to_show: "08-14", price_chf: 10, value: 10, currency: "CHF",
      link: "meta|paid_social|comedybrew-20260903|", resolution: "event",
    });
  });

  test("an undated link reports the resolved date and a next resolution", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "jackpotcomedy", "", TODAY);
    const p = go.pixelParams(r, new URLSearchParams("show=jackpotcomedy"), TODAY);
    expect(p.content_name).toBe("jackpotcomedy");
    expect(p.show_date).toBe("2026-09-16");
    expect(p.resolution).toBe("next");
    expect(p.link).toBe("");
  });

  test("a series fallback keeps the series resolution value (GA history stays readable)", () => {
    const r = go.resolveTarget(SHOWS, [], "jackpotcomedy", "", TODAY);
    expect(go.pixelParams(r, new URLSearchParams("show=jackpotcomedy"), TODAY).resolution).toBe("series");
  });

  test("an unknown show sends no pixel event (a broken link is not ticket intent)", () => {
    expect(go.pixelParams(go.resolveTarget(SHOWS, EVENTS, "nope", "", TODAY), P, TODAY)).toEqual({});
    expect(go.pixelParams(null, P, TODAY)).toEqual({});
  });

  test("newEventId is unique per call and non-empty", () => {
    const a = go.newEventId();
    const b = go.newEventId();
    expect(a.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
  });
});

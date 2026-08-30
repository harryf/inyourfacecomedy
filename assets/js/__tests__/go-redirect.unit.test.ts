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
  resolveTarget: (
    shows: unknown[], events: unknown[],
    showParam: string, dateParam: string, today: string
  ) => { kind: string; url?: string; show?: { slug: string } };
  build404: (search: string, showParam: string) => string;
  linkTag: (p: URLSearchParams) => string;
};

const SHOWS = [
  { slug: "comedybrew", title: "Comedy Brew • English Stand-Up Comedy Open Mic", url: "/comedybrew/", tickets: "https://eventfrog.ch/en/p/groups/brew-group.html", type: "series" },
  { slug: "jackpotcomedy", title: "Jackpot Comedy - downstairs @ OTRO", url: "/jackpotcomedy/", tickets: "https://eventfrog.ch/en/p/groups/jackpot-group.html", type: "series" },
  { slug: "noticketseries", title: "Ticketless", url: "/noticketseries/", tickets: "", type: "series" },
];

const EVENTS = [
  { show: "comedybrew", date: "2026-09-03", tickets: "https://eventfrog.ch/en/p/theatre-stage/brew-0903.html" },
  { show: "jackpotcomedy", date: "2026-09-16", tickets: "https://eventfrog.ch/en/p/theatre-stage/jackpot-0916.html" },
];

const TODAY = "2026-08-26";

describe("go-redirect • resolveTarget happy paths", () => {
  test("show alone resolves to the series ticket link", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "", TODAY);
    expect(r.kind).toBe("series");
    expect(r.url).toBe("https://eventfrog.ch/en/p/groups/brew-group.html");
  });

  test("show + future date resolves to that date's own event page", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "jackpotcomedy", "2026-09-16", TODAY);
    expect(r.kind).toBe("event");
    expect(r.url).toBe("https://eventfrog.ch/en/p/theatre-stage/jackpot-0916.html");
  });

  test("slug matching is case- and separator-insensitive (promo-link contract)", () => {
    expect(go.resolveTarget(SHOWS, EVENTS, "Comedy-Brew", "", TODAY).kind).toBe("series");
    expect(go.resolveTarget(SHOWS, EVENTS, "COMEDYBREW", "", TODAY).kind).toBe("series");
  });
});

describe("go-redirect • fallback chain", () => {
  test("a PAST date skips the event branch and falls back to the series link", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-01-01", TODAY);
    expect(r.kind).toBe("series");
  });

  test("an unknown future date falls back to the series link", () => {
    const r = go.resolveTarget(SHOWS, EVENTS, "comedybrew", "2026-12-25", TODAY);
    expect(r.kind).toBe("series");
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

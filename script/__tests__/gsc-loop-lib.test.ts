// Tests for script/lib/gsc-loop-lib.ts: scope, click curve, words, scoring, briefs,
// experiments, trend, movers, report. No network.
import { describe, expect, test } from "bun:test";
import type { GscRow, PageSource, PageTotals } from "../lib/gsc-report-lib";
import {
  DEFAULT_CURVE, HOLD_DAYS, clickCurve, comedianTemplateBrief, ctrAt, daysBetween, experimentYaml, isBrandQuery, isNameQuery, judge, loopSummary,
  metricsFor, missingWords, movers, nextExperimentId, pageBriefs, renderReport, scopeOf, scoreOpportunities, tokens, trend, type Experiment, type Snapshot,
} from "../lib/gsc-loop-lib";

const row = (query: string, page: string, impressions: number, position: number, clicks = 0): GscRow =>
  ({ query, page: `https://inyourfacecomedy.ch${page}`, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position });

describe("scope", () => {
  test("comedian profiles are meta-only, everything else full", () => {
    expect(scopeOf("/comedians/emir-tonbul/")).toBe("meta-only");
    expect(scopeOf("/comedians/")).toBe("full");
    expect(scopeOf("/comedybrew/")).toBe("full");
    expect(scopeOf("/")).toBe("full");
  });
});

describe("click curve", () => {
  test("uses the site's own CTR where a position has enough impressions, else the default", () => {
    const rows = [row("a", "/", 200, 3, 30), row("b", "/x/", 100, 3, 10), row("c", "/", 50, 9, 5), row("in your face comedy", "/", 1000, 1, 500)];
    const curve = clickCurve(rows, isBrandQuery);
    expect(curve[2]).toEqual({ position: 3, ctr: 40 / 300, impressions: 300, source: "site" });
    expect(curve[8].source).toBe("default");
    expect(curve[8].ctr).toBe(DEFAULT_CURVE[9]);
    expect(curve[0].source).toBe("default");   // the brand query did not count
    expect(ctrAt(curve, 3.4)).toBe(40 / 300);
    expect(ctrAt(curve, 27)).toBe(DEFAULT_CURVE[20]);
  });
});

describe("words", () => {
  test("tokens fold diacritics, drop stopwords and cheap plurals", () => {
    expect(tokens("Comedy Zürich")).toEqual(["comedy", "zurich"]);
    expect(tokens("stand-up comedy shows in Zurich")).toEqual(["stand", "up", "comedy", "show", "zurich"]);
    expect(tokens("open mics")).toEqual(["open", "mic"]);
    expect(tokens("Comedy Brew • English Stand-Up")).toEqual(["comedy", "brew", "english", "stand", "up"]);
  });
  test("missingWords lists query words the page lacks", () => {
    expect(missingWords("comedy zürich", "English Stand-up Comedy in Zurich")).toEqual([]);
    expect(missingWords("open mic zürich", "Comedy Brew English Stand-Up Comedy in Zürich")).toEqual(["open", "mic"]);
    expect(missingWords("comedy shows", "Comedy in Zürich tonight: every show listed")).toEqual([]);
  });
  test("brand and name detection", () => {
    expect(isBrandQuery("in your face comedy")).toBe(true);
    expect(isBrandQuery("inyourfacecomedy zurich")).toBe(true);
    expect(isBrandQuery("comedy zürich")).toBe(false);
    const names = { people: ["Emir Tonbul", "Andrea Ramirez"], shows: ["Comedy Brew", "The NERDY COMEDY Show"] };
    expect(isNameQuery("emir tonbul", names)).toBe(true);
    expect(isNameQuery("emir tonbul comedian", names)).toBe(true);
    expect(isNameQuery("tonbul", names)).toBe(true);
    expect(isNameQuery("comedy zürich", names)).toBe(false);
    expect(isNameQuery("comedy brew", names)).toBe(true);
    expect(isNameQuery("comedy show zurich", names)).toBe(false);
    expect(isNameQuery("nerdy comedy show", names)).toBe(true);
    expect(isNameQuery("andrea ramirez duncan saint", names)).toBe(true);
  });
});

const sources = new Map<string, PageSource>([
  ["/", { path: "/", file: "index.html", title: "English Stand-up Comedy in Zürich", description: "Weekly shows and open mics." }],
  ["/comedybrew/", { path: "/comedybrew/", file: "_posts/x.md", title: "Comedy Brew • English Stand-Up Comedy Open Mic • Thursday at ROBINS Zürich", description: "Join us." }],
  ["/comedians/emir-tonbul/", { path: "/comedians/emir-tonbul/", file: "_comedians/emir-tonbul.md", title: "Emir Tonbul", description: "Swiss-Turkish comedian." }],
  ["/comedians/teddy-hall/", { path: "/comedians/teddy-hall/", file: "_comedians/teddy-hall.md", title: "Teddy Hall", description: "Comedian." }],
]);
const bodies = new Map<string, string>([["/", ""], ["/comedybrew/", "Every Thursday open mic at ROBIN's in Niederdorf."], ["/comedians/emir-tonbul/", ""], ["/comedians/teddy-hall/", ""]]);
const names = { people: ["Emir Tonbul", "Teddy Hall"], shows: ["Comedy Brew"] };
const rows: GscRow[] = [
  row("comedy zürich", "/", 409, 13.5, 6),
  row("open mic zürich", "/comedybrew/", 205, 13.2, 2),
  row("stand up comedy zurich", "/", 458, 6.07, 39),
  row("stand up comedy schweiz", "/", 124, 9.6, 1),
  row("teddy hall", "/comedians/teddy-hall/", 329, 9.5, 7),
  row("emir tonbul", "/comedians/emir-tonbul/", 245, 4.2, 44),
  row("zurich comedian", "/comedians/emir-tonbul/", 30, 12, 0),
  row("open mic zurich", "/", 40, 7, 1),
  row("open mic zurich", "/comedybrew/", 31, 9.1, 0),
  row("in your face comedy", "/", 111, 2.8, 52),
  row("tiny", "/", 4, 15, 0),
];
const totals: PageTotals[] = [{ page: "https://inyourfacecomedy.ch/", clicks: 526, impressions: 9797, position: 8.5 }];
const curve = clickCurve(rows, isBrandQuery);

describe("scoring", () => {
  const opps = scoreOpportunities({ rows, curve, sources, bodies, names });
  test("classifies by position band, prices the gain, skips brand and tiny rows", () => {
    const kinds = Object.fromEntries(opps.map((o) => [`${o.query}@${o.page}`, o.kind]));
    expect(kinds["comedy zürich@/"]).toBe("page-two");
    expect(kinds["stand up comedy schweiz@/"]).toBe("page-one-low");
    expect(kinds["teddy hall@/comedians/teddy-hall/"]).toBe("page-one-low");
    expect(kinds["in your face comedy@/"]).toBeUndefined();
    expect(kinds["tiny@/"]).toBeUndefined();
    const cz = opps.find((o) => o.query === "comedy zürich")!;
    expect(cz.targetPosition).toBe(8);
    expect(cz.gain).toBeCloseTo(409 * DEFAULT_CURVE[8] - 6, 5);
    expect(cz.missing).toEqual([]);                       // title has comedy and zurich
    const om = opps.find((o) => o.query === "open mic zürich")!;
    expect(om.missing).toEqual([]);                       // body has "open mic"
    expect(om.name).toBe(false);
  });
  test("meta-only pages are checked against title and description only, and names are flagged", () => {
    const zc = opps.find((o) => o.query === "zurich comedian")!;
    expect(zc.missing).toEqual(["zurich"]);
    expect(zc.name).toBe(false);
    expect(opps.find((o) => o.query === "teddy hall")!.name).toBe(true);
  });
  test("snippet opportunities need a good position and half the typical CTR", () => {
    const snippet = scoreOpportunities({ rows: [row("comedy club zürich", "/", 400, 3, 2)], curve, sources, bodies, names });
    expect(snippet[0].kind).toBe("snippet");
    expect(snippet[0].note).toMatch(/CTR 0\.5% against/);
    const fine = scoreOpportunities({ rows: [row("comedy club zürich", "/", 400, 3, 60)], curve, sources, bodies, names });
    expect(fine).toEqual([]);
  });
  test("cannibalisation lists every page holding a real share of one query", () => {
    const c = opps.filter((o) => o.kind === "cannibal");
    expect(c.map((o) => o.page).sort()).toEqual(["/", "/comedybrew/"]);
    expect(c[0].query).toBe("open mic zurich");
    expect(c[0].note).toMatch(/2 pages share this query/);
  });
  test("sorted by gain", () => {
    for (let i = 1; i < opps.length; i++) expect(opps[i - 1].gain).toBeGreaterThanOrEqual(opps[i].gain);
  });
});

describe("briefs", () => {
  const opps = scoreOpportunities({ rows, curve, sources, bodies, names });
  const briefs = pageBriefs(opps, totals, sources);
  test("one brief per page, ordered by gain, with totals, scope and weighted missing words", () => {
    expect(briefs[0].path).toBe("/");
    expect(briefs[0].totals?.impressions).toBe(9797);
    expect(briefs[0].scope).toBe("full");
    const emir = briefs.find((b) => b.path === "/comedians/emir-tonbul/")!;
    expect(emir.scope).toBe("meta-only");
    expect(emir.missing).toEqual([{ word: "zurich", weight: 30 }]);
    const teddy = briefs.find((b) => b.path === "/comedians/teddy-hall/")!;
    expect(teddy.missing).toEqual([]);                    // "teddy hall" has nothing beyond the name
  });
  test("comedian template brief aggregates the meta-only pages", () => {
    const c = comedianTemplateBrief(briefs);
    expect(c.pages).toBe(2);
    expect(c.missing[0].word).toBe("zurich");
    expect(c.gain).toBeCloseTo(briefs.filter((b) => b.scope === "meta-only").reduce((n, b) => n + b.gain, 0), 6);
  });
  test("loopSummary marks meta-only pages", () => {
    const lines = loopSummary(briefs, []);
    expect(lines.find((l) => l.includes("/comedians/teddy-hall/"))).toMatch(/\[meta-only\]$/);
  });
});

describe("experiments", () => {
  const exp: Experiment = { id: "exp-2026-09-20-1", date: "2026-09-20", page: "/comedybrew/", queries: ["open mic zürich", "open mic zurich"], change: "Title opens with Open Mic Zürich", status: "open" };
  const baseline = [row("open mic zürich", "/comedybrew/", 200, 13.0, 2), row("open mic zurich", "/comedybrew/", 30, 9.0, 0), row("open mic zürich", "/", 50, 20, 0)];
  test("metricsFor matches queries by normalised tokens and only on the page", () => {
    const m = metricsFor(baseline, "/comedybrew/", ["Open Mic Zürich", "open mic zurich"]);
    expect(m[0]).toEqual({ query: "Open Mic Zürich", impressions: 200, clicks: 2, position: 13 });
    expect(m[1].impressions).toBe(30);
  });
  test("too early inside the hold period", () => {
    const r = judge(exp, metricsFor(baseline, exp.page, exp.queries), metricsFor(baseline, exp.page, exp.queries), "2026-10-10");
    expect(r.verdict).toBe("too early");
    expect(r.daysSince).toBe(20);
    expect(r.judgeable).toBe(false);
  });
  test("improved when the position moved up a place or more", () => {
    const latest = [row("open mic zürich", "/comedybrew/", 220, 9.8, 5), row("open mic zurich", "/comedybrew/", 35, 8.0, 1)];
    const r = judge(exp, metricsFor(baseline, exp.page, exp.queries), metricsFor(latest, exp.page, exp.queries), "2026-10-20");
    expect(r.verdict).toBe("improved");
    expect(r.summary).toMatch(/position -2\.9, clicks 2 to 6 on 2 judged queries/);
  });
  test("worse when it slid, flat when nothing moved, no data when thin", () => {
    const worse = [row("open mic zürich", "/comedybrew/", 200, 15.5, 1), row("open mic zurich", "/comedybrew/", 30, 11, 0)];
    expect(judge(exp, metricsFor(baseline, exp.page, exp.queries), metricsFor(worse, exp.page, exp.queries), "2026-10-20").verdict).toBe("worse");
    const flat = [row("open mic zürich", "/comedybrew/", 210, 13.3, 2), row("open mic zurich", "/comedybrew/", 28, 9.2, 0)];
    expect(judge(exp, metricsFor(baseline, exp.page, exp.queries), metricsFor(flat, exp.page, exp.queries), "2026-10-20").verdict).toBe("flat");
    expect(judge(exp, metricsFor(baseline, exp.page, exp.queries), metricsFor([], exp.page, exp.queries), "2026-10-20").verdict).toBe("no data");
  });
  test("ledger helpers", () => {
    expect(daysBetween("2026-09-20", "2026-10-18")).toBe(HOLD_DAYS);
    expect(nextExperimentId([exp], "2026-09-20")).toBe("exp-2026-09-20-2");
    expect(nextExperimentId([exp], "2026-09-21")).toBe("exp-2026-09-21-1");
    expect(experimentYaml(exp)).toBe('- id: exp-2026-09-20-1\n  date: 2026-09-20\n  page: /comedybrew/\n  queries: ["open mic zürich", "open mic zurich"]\n  change: "Title opens with Open Mic Zürich"\n  status: open\n');
  });
});

const snap = (date: string, rows: GscRow[], pages: PageTotals[]): Snapshot => ({ date, startDate: "s", endDate: date, rows, pages, devices: [] });

describe("trend and movers", () => {
  test("trend aggregates page totals per snapshot in date order", () => {
    const t = trend([snap("2026-09-18", [], [{ page: "p", clicks: 10, impressions: 100, position: 8 }, { page: "q", clicks: 0, impressions: 0, position: 0 }]), snap("2026-09-11", [], [{ page: "p", clicks: 5, impressions: 50, position: 10 }])]);
    expect(t.map((x) => x.date)).toEqual(["2026-09-11", "2026-09-18"]);
    expect(t[1]).toEqual({ date: "2026-09-18", endDate: "2026-09-18", clicks: 10, impressions: 100, position: 8, pages: 1 });
  });
  test("movers need two places and enough impressions in both snapshots", () => {
    const prev = snap("2026-09-11", [row("comedy zürich", "/", 400, 13.5), row("small", "/", 10, 5), row("stable", "/", 100, 6)], []);
    const cur = snap("2026-09-18", [row("comedy zürich", "/", 420, 10.9), row("small", "/", 30, 20), row("stable", "/", 90, 6.5)], []);
    expect(movers(prev, cur)).toEqual([{ query: "comedy zürich", page: "/", impressions: 420, from: 13.5, to: 10.9 }]);
    expect(movers(undefined, cur)).toEqual([]);
  });
});

describe("report", () => {
  test("renders every section with the data", () => {
    const opps = scoreOpportunities({ rows, curve, sources, bodies, names });
    const briefs = pageBriefs(opps, totals, sources);
    const current: Snapshot = { date: "2026-09-18", startDate: "2026-08-19", endDate: "2026-09-15", rows, pages: totals, devices: [{ device: "MOBILE", clicks: 1, impressions: 10, position: 6 }] };
    const exp: Experiment = { id: "exp-1", date: "2026-08-01", page: "/comedybrew/", queries: ["open mic zürich"], change: "x", status: "open" };
    const readings = [judge(exp, metricsFor([row("open mic zürich", "/comedybrew/", 200, 15)], exp.page, exp.queries), metricsFor(rows, exp.page, exp.queries), current.endDate)];
    const md = renderReport({ snapshot: current, discovery: { startDate: "2026-06-18", endDate: "2026-09-15", rows: 11 }, curve, briefs, comedians: comedianTemplateBrief(briefs), readings, trend: trend([current]), movers: [], generatedAt: "g" });
    expect(md).toContain("# Search Console loop: week of 2026-09-18");
    expect(md).toContain("## Trend");
    expect(md).toContain("| exp-1 | /comedybrew/ | 2026-08-01 | 45 | improved |");
    expect(md).toContain("## Your click curve");
    expect(md).toContain("| comedy zürich | / | 409 | 6 | 13.5 |");
    expect(md).toContain("### / (gain");
    expect(md).toContain("- Title: English Stand-up Comedy in Zürich");
    expect(md).toContain("## Comedian pages (meta-only)");
    expect(md).toContain("| /comedians/teddy-hall/ |");
    expect(md).not.toContain("### /comedians/teddy-hall/");   // no page brief with body advice for a comedian
    expect(md).toContain("open mic zurich: 2 pages share this query");
  });
  test("empty experiments section explains how to log a change", () => {
    const current: Snapshot = { date: "d", startDate: "s", endDate: "e", rows: [], pages: [], devices: [] };
    const md = renderReport({ snapshot: current, discovery: { startDate: "2026-06-18", endDate: "2026-09-15", rows: 11 }, curve, briefs: [], comedians: comedianTemplateBrief([]), readings: [], trend: [], movers: [], generatedAt: "g" });
    expect(md).toContain("--log-change");
    expect(md).toContain("_No comedian page has a scored opportunity this window._");
  });
});

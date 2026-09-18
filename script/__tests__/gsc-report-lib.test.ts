// Tests for script/lib/gsc-report-lib.ts: band filter, grouping, source lookup,
// window, worksheet. No network; the Search Console calls live in script/gsc-report.ts.
import { describe, expect, test } from "bun:test";
import {
  DEFAULT_BAND, frontMatterOf, groupByPage, inBand, pagePath, pageSource, parseBand, reportWindow, shapeRow, sourcePath, summaryLines, worksheet,
  type GscRow, type PageSource, type PageTotals,
} from "../lib/gsc-report-lib";

const row = (query: string, page: string, impressions: number, position: number, clicks = 0): GscRow =>
  ({ query, page: `https://inyourfacecomedy.ch${page}`, clicks, impressions, ctr: impressions ? clicks / impressions : 0, position });

describe("band", () => {
  test("parseBand reads MIN-MAX and keeps the impressions floor", () => {
    expect(parseBand("11-20", 10)).toEqual({ minPosition: 11, maxPosition: 20, minImpressions: 10 });
    expect(parseBand("8-11.5", 30)).toEqual({ minPosition: 8, maxPosition: 11.5, minImpressions: 30 });
  });
  test("parseBand rejects nonsense", () => {
    expect(() => parseBand("20-11", 10)).toThrow(/minimum above maximum/);
    expect(() => parseBand("eleven", 10)).toThrow(/MIN-MAX/);
  });
  test("inBand is inclusive on both ends and applies the impressions floor", () => {
    expect(inBand(row("a", "/", 10, 11), DEFAULT_BAND)).toBe(true);
    expect(inBand(row("a", "/", 10, 20), DEFAULT_BAND)).toBe(true);
    expect(inBand(row("a", "/", 10, 10.9), DEFAULT_BAND)).toBe(false);
    expect(inBand(row("a", "/", 10, 20.1), DEFAULT_BAND)).toBe(false);
    expect(inBand(row("a", "/", 9, 15), DEFAULT_BAND)).toBe(false);
  });
});

describe("rows and paths", () => {
  test("shapeRow flattens the API keys", () => {
    expect(shapeRow({ keys: ["comedy zürich", "https://inyourfacecomedy.ch/"], clicks: 6, impressions: 415, ctr: 0.0145, position: 13.6 }))
      .toEqual({ query: "comedy zürich", page: "https://inyourfacecomedy.ch/", clicks: 6, impressions: 415, ctr: 0.0145, position: 13.6 });
  });
  test("pagePath strips the site, query strings and fragments", () => {
    expect(pagePath("https://inyourfacecomedy.ch/")).toBe("/");
    expect(pagePath("https://inyourfacecomedy.ch/comedybrew/?utm=x#top")).toBe("/comedybrew/");
    expect(pagePath("http://www.inyourfacecomedy.ch/calendar/")).toBe("/calendar/");
  });
});

describe("sources", () => {
  test("frontMatterOf reads quoted and bare values", () => {
    const fm = frontMatterOf(`---\nlayout: post\ntitle: "Comedy Brew: English Stand-up"\ndescription: Weekly show.\npermalink: /comedybrew/\n---\nbody`);
    expect(fm.title).toBe("Comedy Brew: English Stand-up");
    expect(fm.description).toBe("Weekly show.");
    expect(fm.permalink).toBe("/comedybrew/");
  });
  test("sourcePath follows permalinks, the comedians collection and the home page", () => {
    expect(sourcePath("index.html", {})).toBe("/");
    expect(sourcePath("_posts/2024-01-18-comedybrew.md", { permalink: "/comedybrew/" })).toBe("/comedybrew/");
    expect(sourcePath("pages/404.md", { permalink: "/404.html" })).toBe("/404.html");
    expect(sourcePath("pages/x.md", { permalink: "/x" })).toBe("/x/");
    expect(sourcePath("_comedians/emir-tonbul.md", {})).toBe("/comedians/emir-tonbul/");
    expect(sourcePath("_posts/2024-01-18-nolink.md", {})).toBeUndefined();
  });
  test("pageSource carries title and description", () => {
    const src = pageSource("_comedians/emir-tonbul.md", `---\ntitle: "Emir Tonbul"\ndescription: "Swiss-Turkish comedian."\n---\n`);
    expect(src).toEqual({ path: "/comedians/emir-tonbul/", file: "_comedians/emir-tonbul.md", title: "Emir Tonbul", description: "Swiss-Turkish comedian." });
  });
});

describe("window", () => {
  test("reportWindow ends three days back and spans the requested days", () => {
    expect(reportWindow("2026-09-18", 90)).toEqual({ startDate: "2026-06-18", endDate: "2026-09-15" });
    expect(reportWindow("2026-09-18", 1)).toEqual({ startDate: "2026-09-15", endDate: "2026-09-15" });
  });
});

describe("grouping and worksheet", () => {
  const rows: GscRow[] = [
    row("comedy zürich", "/", 415, 13.6, 6),
    row("open mic zürich", "/calendar/", 226, 12.5, 5),
    row("comedy", "/", 96, 13.3),
    row("stand up comedy zurich", "/", 458, 6.07, 39),     // page one, out of band
    row("tiny", "/", 3, 15),                              // below the floor
    row("filippo spreafico", "/filippo-spreafico/", 13, 17.5),
  ];
  const totals: PageTotals[] = [
    { page: "https://inyourfacecomedy.ch/", clicks: 542, impressions: 10122, position: 8.5 },
    { page: "https://inyourfacecomedy.ch/calendar/", clicks: 37, impressions: 2298, position: 8.18 },
  ];
  const sources = new Map<string, PageSource>([
    ["/", { path: "/", file: "index.html", title: "English Stand-up Comedy in Zürich", description: "Weekly shows." }],
    ["/calendar/", { path: "/calendar/", file: "pages/1_calendar.md", title: "Comedy in Zürich Tonight", description: "See shows." }],
  ]);

  test("groupByPage keeps only band rows, orders pages and queries by impressions, attaches totals and sources", () => {
    const groups = groupByPage(rows, DEFAULT_BAND, totals, sources);
    expect(groups.map((g) => g.path)).toEqual(["/", "/calendar/", "/filippo-spreafico/"]);
    expect(groups[0].rows.map((r) => r.query)).toEqual(["comedy zürich", "comedy"]);
    expect(groups[0].bandImpressions).toBe(511);
    expect(groups[0].bandClicks).toBe(6);
    expect(groups[0].totals?.position).toBe(8.5);
    expect(groups[0].source?.file).toBe("index.html");
    expect(groups[2].source).toBeUndefined();
    expect(groups[2].totals).toBeUndefined();
  });

  test("worksheet names the window, lists pages, shows title and description, flags missing sources", () => {
    const groups = groupByPage(rows, DEFAULT_BAND, totals, sources);
    const md = worksheet(groups, { startDate: "2026-06-18", endDate: "2026-09-15", band: DEFAULT_BAND, site: "sc-domain:inyourfacecomedy.ch", generatedAt: "2026-09-18T20:00:00Z", totalRows: rows.length });
    expect(md).toContain("# Search Console worksheet: position 11 to 20");
    expect(md).toContain("2026-06-18 to 2026-09-15");
    expect(md).toContain("| / | 511 | 6 | 2 | 10122, 542, 8.5 |");
    expect(md).toContain("- Title: English Stand-up Comedy in Zürich");
    expect(md).toContain("| comedy zürich | 415 | 6 | 1.4% | 13.6 |");
    expect(md).toContain("## /filippo-spreafico/");
    expect(md).toContain("Source: _not found");
    expect(md).not.toContain("stand up comedy zurich");
    expect(md).not.toContain("| tiny |");
  });

  test("worksheet says so when the band is empty", () => {
    const md = worksheet([], { startDate: "a", endDate: "b", band: DEFAULT_BAND, site: "s", generatedAt: "g", totalRows: 0 });
    expect(md).toContain("_Nothing in the band for this window._");
  });

  test("summaryLines gives one line per page with the top three queries", () => {
    const lines = summaryLines(groupByPage(rows, DEFAULT_BAND, totals, sources));
    expect(lines[0]).toMatch(/^\/\s+511 imp  comedy zürich \(415 @ 13\.6\), comedy \(96 @ 13\.3\)$/);
    expect(lines).toHaveLength(3);
  });
});

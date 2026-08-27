// Tests for script/lib/ga-report-lib.ts: show discovery, noise filtering,
// aggregation, CSV. No network; the GA calls live in script/ga-report.ts.
import { describe, expect, test } from "bun:test";
import {
  aggregate, frontMatterOf, gaDate, gaDateTime, addDays, inferSource, isNoiseSource, parseShow, reportPage, toCsv,
  type ClickRow, type PageRow, type Show,
} from "../lib/ga-report-lib";

const POST = `---
layout: post
title: "Comedy Brew: English Stand-up"
permalink: /comedybrew/
ticket_url: https://eventfrog.ch/comedybrew
ticket_url_resolved: https://eventfrog.ch/en/p/groups/comedy-brew-123.html
event_type: series
---
Body text
`;

const show: Show = { slug: "comedybrew", title: "Comedy Brew", ticketUrl: "https://eventfrog.ch/x", eventType: "series" };

const click = (o: Partial<ClickRow>): ClickRow => ({
  datetime: "2026-08-26 19:05", date: "2026-08-26", event: "ticket_redirect",
  source: "meta", medium: "paid_social", campaign: "comedybrew", content: "", page: "/go/", query: "show=comedybrew&utm_source=meta", count: 1, ...o,
});

describe("ga-report • inferSource", () => {
  test("tagged rows pass through", () => {
    expect(inferSource({ source: "meta", medium: "paid_social", query: "" })).toEqual({ source: "meta", medium: "paid_social" });
  });
  test("untagged rows with an ad click id are labelled by network", () => {
    expect(inferSource({ source: "(not set)", medium: "(not set)", query: "show=comedybrew&fbclid=IwAR123" })).toEqual({ source: "meta", medium: "untagged" });
    expect(inferSource({ source: "(direct)", medium: "(none)", query: "show=x&ttclid=abc" })).toEqual({ source: "tiktok", medium: "untagged" });
  });
  test("no tags, no click id: direct", () => {
    expect(inferSource({ source: "(direct)", medium: "(none)", query: "show=comedybrew" })).toEqual({ source: "(direct)", medium: "(none)" });
  });
});

describe("ga-report • show discovery", () => {
  test("parses a show post, preferring the resolved ticket url", () => {
    const s = parseShow(frontMatterOf(POST));
    expect(s).toEqual({ slug: "comedybrew", title: "Comedy Brew", ticketUrl: "https://eventfrog.ch/en/p/groups/comedy-brew-123.html", eventType: "series" });
  });
  test("a post without ticket_url is not a show", () => {
    expect(parseShow("title: x\npermalink: /x/\n")).toBeNull();
  });
  test("rejects a slug that would not be a safe path", () => {
    expect(parseShow("permalink: /../x/\nticket_url: https://e.ch/x\n")).toBeNull();
  });
});

describe("ga-report • noise + dates", () => {
  test("local dev and preview hosts are noise, real sources are not", () => {
    for (const s of ["localhost:4000", "127.0.0.1:4000", "localhost:8788", "inyourfacecomedy.pages.dev", "deploy-preview-3.inyourfacecomedy.pages.dev"]) expect(isNoiseSource(s)).toBe(true);
    for (const s of ["meta", "google", "l.instagram.com", "(direct)", "hellozurich.ch"]) expect(isNoiseSource(s)).toBe(false);
  });
  test("GA date strings convert", () => {
    expect(gaDate("20260826")).toBe("2026-08-26");
    expect(gaDateTime("202608261905")).toBe("2026-08-26 19:05");
    expect(addDays("2026-08-01", -2)).toBe("2026-07-30");
  });
});

describe("ga-report • aggregate", () => {
  const clicks: ClickRow[] = [
    click({ count: 4 }),
    click({ content: "120203748201470314", datetime: "2026-08-27 08:00", date: "2026-08-27", count: 2 }),
    click({ event: "ticket_click", source: "google", medium: "organic", campaign: "(organic)", page: "/comedybrew/", count: 3 }),
    click({ source: "localhost:4000", medium: "referral", campaign: "(referral)", count: 9 }),   // filtered
    click({ source: "instagram", medium: "social", campaign: "comedybrew", content: "inyourface_profile", count: 2 }),
    click({ source: "(not set)", medium: "(not set)", campaign: "(not set)", query: "show=comedybrew&fbclid=IwZZ", count: 5 }),  // bare Meta ad link
  ];
  const pages: PageRow[] = [
    { date: "2026-08-26", source: "google", medium: "organic", campaign: "(organic)", sessions: 10, views: 12 },
    { date: "2026-08-26", source: "localhost:4000", medium: "referral", campaign: "(referral)", sessions: 5, views: 5 },
  ];
  const r = aggregate({ show, clicks, pages, brokenLinks: 1, since: "2026-08-26", today: "2026-08-28", generatedAt: "2026-08-28T05:00:00.000Z", csvPath: "/assets/reports/comedybrew.csv" });

  test("totals split campaign vs site clicks and drop noise", () => {
    expect(r.totals).toMatchObject({ clicks: 16, redirect: 13, click: 3, clicks_30d: 16, sessions: 10, views: 12, broken_links: 1, untagged: 5 });
  });
  test("untagged ad clicks are attributed to the network, not to a campaign", () => {
    expect(r.by_source.find((s) => s.medium === "untagged")).toMatchObject({ source: "meta", clicks: 5 });
    expect(r.by_campaign.reduce((n, c) => n + c.clicks, 0)).toBe(8);
  });
  test("by_day covers every day since launch and flags provisional days", () => {
    expect(r.by_day.map((d) => d.date)).toEqual(["2026-08-26", "2026-08-27", "2026-08-28"]);
    expect(r.by_day[0]).toMatchObject({ redirect: 11, click: 3, views: 12, provisional: false });
    expect(r.by_day[1]).toMatchObject({ redirect: 2, provisional: true });
    expect(r.complete_through).toBe("2026-08-26");
  });
  test("campaigns are keyed by campaign+source with ad content underneath", () => {
    expect(r.by_campaign.map((c) => [c.campaign, c.source, c.clicks])).toEqual([["comedybrew", "meta", 6], ["comedybrew", "instagram", 2]]);
    expect(r.by_campaign[0].content).toEqual([{ content: "120203748201470314", clicks: 2 }]);
    expect(r.by_campaign[0]).toMatchObject({ first: "2026-08-26", last: "2026-08-27" });
  });
  test("sources merge clicks and page sessions, sorted by clicks", () => {
    expect(r.by_source[0]).toMatchObject({ source: "meta", medium: "paid_social", clicks: 6, sessions: 0 });
    expect(r.by_source.find((s) => s.source === "google")).toMatchObject({ clicks: 3, sessions: 10 });
    expect(r.by_source.some((s) => s.source.startsWith("localhost"))).toBe(false);
  });
});

describe("ga-report • csv + page stub", () => {
  test("csv is oldest first, quoted where needed, noise dropped", () => {
    const csv = toCsv([
      click({ datetime: "2026-08-27 08:00", date: "2026-08-27", content: "a,b" }),
      click({ source: "localhost:4000" }),
      click({ campaign: "(not set)", source: "(direct)", medium: "(none)" }),
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe("datetime,event,source,medium,campaign,content,page,clicks");
    expect(lines[1]).toBe("2026-08-26 19:05,ticket_redirect,(direct),(none),,,/go/,1");
    expect(lines[2]).toBe('2026-08-27 08:00,ticket_redirect,meta,paid_social,comedybrew,"a,b",/go/,1');
    expect(lines.length).toBe(3);
  });
  test("page stub is unlisted and points at the report layout", () => {
    const p = reportPage(show);
    expect(p).toContain("layout: report");
    expect(p).toContain("permalink: /reports/comedybrew/");
    expect(p).toContain("noindex: true");
    expect(p).toContain("sitemap: false");
  });
});

// Pure-logic unit tests for assets/js/link-builder.js — the /linkbuilder/ tool.
// Pins the UTM taxonomy (GA4 channel-group tokens, lowercase-forever) and the
// google-ads carve-out (direct show-page URL, NO utm params at all).
import { describe, expect, test } from "bun:test";

const lb = require("../link-builder.js") as {
  SOURCES: Array<{ id: string; label: string; medium: string }>;
  slugify: (s: string) => string;
  mediumFor: (source: string) => string;
  campaignDefault: (slug: string, date: string) => string;
  buildLink: (
    origin: string,
    show: { slug: string; url: string },
    opts: { date?: string; source: string; medium?: string; campaign?: string; content?: string }
  ) => { url: string; kind: string };
};

const ORIGIN = "https://inyourfacecomedy.ch";
const SHOW = { slug: "jackpotcomedy", url: "/jackpotcomedy/" };

describe("link-builder • the nine offered sources", () => {
  test("all nine channels are on offer, in builder ids", () => {
    const ids = lb.SOURCES.map((s) => s.id);
    for (const want of ["meta", "instagram", "facebook", "guidle", "meetup", "reddit", "mailchimp", "tiktok", "telegram"]) {
      expect(ids).toContain(want);
    }
    expect(ids.length).toBe(9);
  });

  test("google-ads is deliberately NOT a chip (direct links + gclid instead)", () => {
    expect(lb.SOURCES.map((s) => s.id)).not.toContain("google-ads");
  });
});

describe("link-builder • medium defaults are GA4 channel-group tokens", () => {
  test.each([
    ["meta", "paid_social"],
    ["instagram", "social"],
    ["facebook", "social"],
    ["tiktok", "social"],
    ["telegram", "social"],
    ["reddit", "social"],
    ["mailchimp", "email"],
    ["guidle", "referral"],
    ["meetup", "referral"],
  ])("%s → %s", (source, medium) => {
    expect(lb.mediumFor(source)).toBe(medium);
  });

  test("a free-text source defaults to social", () => {
    expect(lb.mediumFor("whatsapp")).toBe("social");
    expect(lb.mediumFor("WhatsApp!")).toBe("social");
  });
});

describe("link-builder • slugify (GA4 never normalizes case — we do)", () => {
  test("lowercases, trims, and hyphenates", () => {
    expect(lb.slugify("Meta")).toBe("meta");
    expect(lb.slugify("  WhatsApp Status ")).toBe("whatsapp-status");
    expect(lb.slugify("Story/Swipe-Up!")).toBe("story-swipe-up");
  });
});

describe("link-builder • campaignDefault follows the series-vs-occurrence choice", () => {
  test("whole series: one evergreen campaign, just the slug", () => {
    expect(lb.campaignDefault("comedybrew", "")).toBe("comedybrew");
  });
  test("specific occurrence: {show}-{yyyymmdd}", () => {
    expect(lb.campaignDefault("jackpotcomedy", "2026-09-16")).toBe("jackpotcomedy-20260916");
  });
});

describe("link-builder • buildLink", () => {
  test("series link routes through /go/ with slugified utm params", () => {
    const built = lb.buildLink(ORIGIN, SHOW, {
      source: "Meta", medium: "Paid_Social", campaign: "Jackpot Sept",
    });
    expect(built.kind).toBe("series");
    const u = new URL(built.url);
    expect(u.origin).toBe(ORIGIN);
    expect(u.pathname).toBe("/go/");
    expect(u.searchParams.get("show")).toBe("jackpotcomedy");
    expect(u.searchParams.get("date")).toBeNull();
    expect(u.searchParams.get("utm_source")).toBe("meta");
    expect(u.searchParams.get("utm_medium")).toBe("paid_social");
    expect(u.searchParams.get("utm_campaign")).toBe("jackpot-sept");
  });

  test("date link carries the date and kind 'event'", () => {
    const built = lb.buildLink(ORIGIN, SHOW, {
      date: "2026-09-16", source: "mailchimp", medium: "email", campaign: "x",
    });
    expect(built.kind).toBe("event");
    expect(new URL(built.url).searchParams.get("date")).toBe("2026-09-16");
  });

  test("utm_content is included only when set", () => {
    const withip = lb.buildLink(ORIGIN, SHOW, { source: "meta", medium: "paid_social", campaign: "x", content: "Variant B" });
    expect(new URL(withip.url).searchParams.get("utm_content")).toBe("variant-b");
    const without = lb.buildLink(ORIGIN, SHOW, { source: "meta", medium: "paid_social", campaign: "x" });
    expect(new URL(without.url).searchParams.get("utm_content")).toBeNull();
  });

  test("dest 'page': the site page itself with UTM tags, no /go/, no show param", () => {
    const built = lb.buildLink(ORIGIN, { slug: "calendar", url: "/calendar/" }, {
      dest: "page", source: "instagram", medium: "social", campaign: "calendar",
    } as never);
    expect(built.kind).toBe("page");
    const u = new URL(built.url);
    expect(u.pathname).toBe("/calendar/");
    expect(u.searchParams.get("utm_source")).toBe("instagram");
    expect(u.searchParams.get("utm_medium")).toBe("social");
    expect(u.searchParams.get("utm_campaign")).toBe("calendar");
    expect(u.searchParams.get("show")).toBeNull();
    expect(built.url.includes("/go/")).toBe(false);
  });

  test("dest 'page' on a show: the show's own page with UTMs, not Eventfrog", () => {
    const built = lb.buildLink(ORIGIN, SHOW, {
      dest: "page", source: "instagram", medium: "social", campaign: "jackpotcomedy",
    } as never);
    expect(built.kind).toBe("page");
    expect(new URL(built.url).pathname).toBe("/jackpotcomedy/");
    expect(new URL(built.url).searchParams.get("utm_campaign")).toBe("jackpotcomedy");
  });

  test("google-ads: direct show-page URL with NO utm params (gclid auto-tagging)", () => {
    const built = lb.buildLink(ORIGIN, SHOW, { source: "Google-Ads", medium: "cpc", campaign: "x" });
    expect(built.kind).toBe("direct");
    expect(built.url).toBe("https://inyourfacecomedy.ch/jackpotcomedy/");
    expect(built.url.includes("utm_")).toBe(false);
    expect(built.url.includes("/go/")).toBe(false);
  });
});

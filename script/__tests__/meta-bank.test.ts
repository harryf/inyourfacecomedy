import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BANK_DIR, GROUPS, adcardUrl, contactSheet, loadBank, sheetRows, type Concept } from "../meta-bank";

const c = (p: Partial<Concept>): Concept => ({ id: "X1", person: "someone", body: "b", title: "t", image: { style: "photo" }, status: "bench", ...p });

describe("the bank files", () => {
  test("all three groups load, every concept has a style, no body over 125 characters", () => {
    for (const g of GROUPS) {
      const b = loadBank(g, BANK_DIR);
      expect(b.adset).toBe(g);
      expect(b.concepts.length).toBeGreaterThanOrEqual(8);
      for (const x of b.concepts) { expect(x.id).toMatch(/^[CWI]\d+$/); expect(x.title.length).toBeLessThanOrEqual(40); expect(x.body).not.toMatch(/CHF|\u2014/); }
    }
  });
  test("a body over 125 characters is refused", () => {
    const dir = mkdtempSync(join(tmpdir(), "bank-"));
    writeFileSync(join(dir, "cold.yml"), `adset: cold\nlink: { show: comedybrew, utm_campaign: cold }\ndescription: d\nconcepts:\n  - { id: C1, person: p, body: "${"x".repeat(126)}", title: t, image: { style: photo }, status: bench }\n`);
    expect(() => loadBank("cold", dir)).toThrow(/126 characters/);
  });
});

describe("urls and the contact sheet", () => {
  test("the card url carries headline, sub, style, photo and format; the title stands in for a missing headline", () => {
    const u = new URL(adcardUrl("http://x", c({ title: "Hello there", image: { style: "swiss", sub: "s" } }), "story"));
    expect(u.pathname).toBe("/adcard/");
    expect(u.searchParams.get("headline")).toBe("Hello there");
    expect(u.searchParams.get("style")).toBe("swiss");
    expect(u.searchParams.get("format")).toBe("story");
    expect(u.searchParams.get("photo")).toBe("");
  });
  test("sheet rows come from the images on disk, whatever the last render touched", () => {
    const dir = mkdtempSync(join(tmpdir(), "creative-"));
    const bank = mkdtempSync(join(tmpdir(), "bank-"));
    writeFileSync(join(bank, "cold.yml"), "adset: cold\nlink: { show: comedybrew, utm_campaign: cold }\ndescription: d\nconcepts:\n  - { id: C1, person: p, body: b, title: t, image: { style: photo }, status: bench }\n  - { id: C2, person: p, body: b, title: t, image: { style: swiss }, status: bench }\n");
    const { mkdirSync } = require("node:fs");
    mkdirSync(join(dir, "cold"), { recursive: true });
    writeFileSync(join(dir, "cold", "C2-post.png"), ""); writeFileSync(join(dir, "cold", "C2-story.png"), "");
    expect(sheetRows(dir, bank).map((r) => r.id)).toEqual(["C2"]);
  });
  test("the contact sheet lists every row with both images", () => {
    const html = contactSheet([{ group: "cold", id: "C1", person: "p", body: "b", title: "t", post: "cold/C1-post.png", story: "cold/C1-story.png" }]);
    expect(html).toContain("cold/C1-post.png"); expect(html).toContain("cold/C1-story.png"); expect(html).toContain("<b>cold C1</b>");
  });
});

describe("push: names, links and the creative", () => {
  const { adName, bankLink, creativeSpec, pushList, URL_TAGS } = require("../meta-bank");
  const bank = { adset: "cold", link: { show: "comedybrew", utm_campaign: "cold" }, description: "d", concepts: [c({ id: "C1", status: "live" }), c({ id: "C2", status: "bench" }), c({ id: "C3", status: "live", description: "own" })] };
  test("live concepts push by default; --only overrides status", () => {
    expect(pushList(bank, []).map((x: Concept) => x.id)).toEqual(["C1", "C3"]);
    expect(pushList(bank, ["C2"]).map((x: Concept) => x.id)).toEqual(["C2"]);
  });
  test("the link goes through /go/ with the ad set as the campaign and the ad name as content via url_tags", () => {
    expect(bankLink(bank)).toBe("https://inyourfacecomedy.ch/go/?show=comedybrew&utm_source=meta&utm_medium=paid_social&utm_campaign=cold");
    expect(URL_TAGS).toBe("utm_content={{ad.name}}");
    expect(adName("cold", { id: "C1" })).toBe("cold-C1");
  });
  test("the creative is single-text with two images: story on Stories and Reels first, post everywhere else, Book Now, the concept's own description when it has one", () => {
    const s = creativeSpec({ page_id: "p", instagram_account_id: "ig" }, "cold", bank, bank.concepts[2], { post: "hp", story: "hs" });
    const f = s.asset_feed_spec;
    expect((s.object_story_spec as any).link_data).toBeUndefined();
    expect(s.object_story_spec.page_id).toBe("p"); expect(s.object_story_spec.instagram_user_id).toBe("ig");
    expect(f.images).toEqual([{ hash: "hp", adlabels: [{ name: "feed" }] }, { hash: "hs", adlabels: [{ name: "story" }] }]);
    expect(f.bodies).toHaveLength(1); expect(f.titles).toHaveLength(1); expect(f.descriptions).toHaveLength(1);
    expect(f.bodies[0].text).toBe("b"); expect(f.titles[0].text).toBe("t"); expect(f.descriptions[0].text).toBe("own");
    expect(f.call_to_action_types).toEqual(["BOOK_TRAVEL"]); expect(f.ad_formats).toEqual(["SINGLE_IMAGE"]);
    expect(f.link_urls[0].website_url).toBe(bankLink(bank));
    expect(s.url_tags).toBe(URL_TAGS);
    const features = s.degrees_of_freedom_spec.creative_features_spec;
    expect(Object.keys(features).length).toBeGreaterThanOrEqual(80);
    expect(features.text_optimizations.enroll_status).toBe("OPT_OUT"); expect(features.image_templates.enroll_status).toBe("OPT_OUT");
    expect(Object.values(features).every((v: any) => v.enroll_status === "OPT_OUT")).toBe(true);
    const rules = f.asset_customization_rules;
    expect(rules.map((r: any) => [r.image_label.name, r.priority])).toEqual([["story", 1], ["feed", 2]]);
    expect(rules[0].customization_spec.facebook_positions).toEqual(["story", "facebook_reels"]);
    expect(rules[0].customization_spec.instagram_positions).toEqual(["story", "reels"]);
    expect(rules[1].customization_spec.facebook_positions).toBeUndefined();
    expect(rules[1].customization_spec.publisher_platforms).toContain("facebook");
    expect(creativeSpec({ page_id: "p", instagram_account_id: "" }, "cold", bank, bank.concepts[0], { post: "a", story: "b" }).asset_feed_spec.descriptions[0].text).toBe("d");
  });
  test("restory lists the ads still on one image whose concept is in the bank", () => {
    const { restoryList } = require("../meta-bank");
    const state = {
      "cold-C1": { ad_id: "1", creative_id: "c1", image_hash: "h", pushed: "x" },
      "cold-C3": { ad_id: "3", creative_id: "c3", image_hash: "h", pushed: "x", story_hash: "s" },
      "cold-C9": { ad_id: "9", creative_id: "c9", image_hash: "h", pushed: "x" },
      "warm-W1": { ad_id: "5", creative_id: "c5", image_hash: "h", pushed: "x" },
    };
    const warm = { ...bank, adset: "warm", concepts: [c({ id: "W1", status: "live" })] };
    expect(restoryList(state, { cold: bank, warm }).map((r: any) => r.name)).toEqual(["cold-C1", "warm-W1"]);
    expect(restoryList(state, { cold: bank, warm }, "warm").map((r: any) => r.name)).toEqual(["warm-W1"]);
    expect(restoryList(state, { cold: bank, warm }, undefined, ["C1"]).map((r: any) => r.name)).toEqual(["cold-C1"]);
    expect(restoryList(state, { cold: bank }).map((r: any) => r.name)).toEqual(["cold-C1"]);
  });
});

describe("sync: the bank files' status against Meta's on/off state", () => {
  const { syncPlan } = require("../meta-bank");
  const concept = (id: string, status: Concept["status"]) => ({ id, person: "p", body: "b", title: "t", image: { style: "type" }, status }) as Concept;
  const banks = { cold: { adset: "cold", link: { show: "comedybrew", utm_campaign: "cold" }, description: "d", concepts: [concept("C1", "resting"), concept("C7", "live"), concept("C9", "retired")] } } as any;
  const entry = (ad_id: string) => ({ ad_id, creative_id: "c", image_hash: "h", pushed: "2026-09-13" });
  const state = { "cold-C1": entry("1"), "cold-C7": entry("7"), "cold-C9": entry("9"), "cold-C99": entry("99") };

  test("a resting or retired concept's running ad is paused; a live one that is off comes back", () => {
    const plan = syncPlan(state, banks, { "1": "ACTIVE", "7": "PAUSED", "9": "ACTIVE", "99": "ACTIVE" });
    expect(plan.map((p: any) => `${p.name} ${p.from}>${p.to}`)).toEqual(["cold-C1 ACTIVE>PAUSED", "cold-C7 PAUSED>ACTIVE", "cold-C9 ACTIVE>PAUSED"]);
  });
  test("nothing to do when Meta already matches, and an ad Meta no longer lists is left alone", () => {
    expect(syncPlan(state, banks, { "1": "PAUSED", "7": "ACTIVE" })).toEqual([]);
  });
  test("--only narrows the plan", () => {
    expect(syncPlan(state, banks, { "1": "ACTIVE", "9": "ACTIVE" }, undefined, ["C9"]).map((p: any) => p.name)).toEqual(["cold-C9"]);
  });
});

describe("video ads: names, lists and the creative", () => {
  const { conceptFor, pushList, syncPlan, videoAdName, videoCreativeSpec, videoList } = require("../meta-bank");
  const c = (id: string, status: Concept["status"], video?: Concept["video"]) => ({ id, person: "p", body: "b", title: "t", image: { style: "type" }, status, video }) as Concept;
  const bank = { adset: "cold", link: { show: "comedybrew", utm_campaign: "cold" }, description: "d", concepts: [c("C4", "live", { composition: "FifthLanguage" }), c("C7", "live"), c("C12", "live", { composition: "Departures", twin: false }), c("C13", "bench", { composition: "X" })] } as any;

  test("a twin concept gets both ads, a video-only concept gets no still ad, bench stays out", () => {
    expect(pushList(bank, []).map((x: Concept) => x.id)).toEqual(["C4", "C7"]);
    expect(videoList(bank, []).map((x: Concept) => x.id)).toEqual(["C4", "C12"]);
    expect(videoAdName("cold", { id: "C4" })).toBe("cold-C4v");
  });
  test("an ad name finds its concept, with or without the v", () => {
    expect(conceptFor(bank, "C4v")?.id).toBe("C4");
    expect(conceptFor(bank, "C7v")).toBeUndefined();   // C7 has no video
    expect(conceptFor(bank, "C7")?.id).toBe("C7");
  });
  test("the video goes to Stories and Reels, the image everywhere else, one text", () => {
    const spec = videoCreativeSpec({ page_id: "1", instagram_account_id: "2" }, "cold", bank, bank.concepts[0], { post: "P", story: "S", video_id: "V" });
    expect(spec.name).toBe("cold-C4v creative");
    expect(spec.asset_feed_spec.ad_formats).toEqual(["AUTOMATIC_FORMAT"]);
    expect(spec.asset_feed_spec.images).toEqual([{ hash: "P", adlabels: [{ name: "feed" }] }]);
    expect(spec.asset_feed_spec.videos).toEqual([{ video_id: "V", thumbnail_hash: "S", adlabels: [{ name: "story" }] }]);
    expect(spec.asset_feed_spec.asset_customization_rules.map((r: any) => Object.keys(r).find((k) => k.endsWith("_label")))).toEqual(["video_label", "image_label"]);
    expect(spec.asset_feed_spec.bodies).toHaveLength(1);
    expect(spec.url_tags).toBe("utm_content={{ad.name}}");
  });
  test("sync follows the concept's status for the video ad too, and skips a half-made entry", () => {
    const e = (ad_id: string) => ({ ad_id, creative_id: "c", image_hash: "h", pushed: "x" });
    const rested = { cold: { ...bank, concepts: [c("C4", "resting", { composition: "FifthLanguage" })] } } as any;
    expect(syncPlan({ "cold-C4v": e("4"), "cold-C12v": e("") }, rested, { "4": "ACTIVE" }).map((p: any) => `${p.name}>${p.to}`)).toEqual(["cold-C4v>PAUSED"]);
  });
});

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

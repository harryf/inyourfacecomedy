// Pure-logic unit tests for the Week Story helpers in lineup-maker-2000.js (the /week/ page):
// the eight-day window, event filtering, the seeded copy pools, the hosts' handles and the
// caption. Drawing and the panel are exercised in a real browser.
import { describe, expect, test } from "bun:test";

type Ev = { show: string; date: string; start?: string; venue?: string };
const lm = require("../lineup-maker-2000.js") as {
  weekWindow: (from: string) => { from: string; to: string };
  weekEvents: (events: Ev[], from: string) => Ev[];
  weekHeadlines: () => string[];
  weekCopy: (from: string, variant?: number, n?: number) => { headline: string };
  weekHandles: (events: Ev[], shows: unknown[], comedians: unknown[]) => string[];
  weekHandlesText: (events: Ev[], shows: unknown[], comedians: unknown[]) => string;
  weekCaption: (events: Ev[], shows: unknown[], from: string) => string;
  weekCalLink: () => string;
};

const SHOWS = [
  { slug: "comedybrew", title: "Comedy Brew - English Stand-Up", hosts: ["harryf.cks", "martinadoescomedy"], venue: "ROBIN's" },
  { slug: "jackpotcomedy", title: "Jackpot Comedy - downstairs @ OTRO", hosts: ["jack-roberts"] },
  { slug: "filippo-spreafico", title: "Filippo Spreafico", hosts: null },
];
const ROSTER = [
  { slug: "harryf.cks", name: "Harry", instagram: "https://instagram.com/harryf.cks" },
  { slug: "martinadoescomedy", name: "Martina", instagram: "https://www.instagram.com/martinadoescomedy/" },
  { slug: "jack-roberts", name: "Jack Roberts", instagram: "" },
];
const EVENTS: Ev[] = [
  { show: "comedybrew", date: "2026-09-12", start: "2026-09-12T19:30:00+02:00", venue: "ROBIN's" },   // from-1
  { show: "jackpotcomedy", date: "2026-09-13", start: "2026-09-13T20:00:00+02:00", venue: "Bar OTRO" }, // from
  { show: "comedybrew", date: "2026-09-17", start: "2026-09-17T19:30:00+02:00", venue: "ROBIN's" },
  { show: "filippo-spreafico", date: "2026-09-17", start: "2026-09-17T18:00:00+02:00", venue: "ROBIN's" },
  { show: "jackpotcomedy", date: "2026-09-20", start: "2026-09-20T20:00:00+02:00", venue: "Bar OTRO" }, // from+7
  { show: "comedybrew", date: "2026-09-21", start: "2026-09-21T19:30:00+02:00", venue: "ROBIN's" },   // from+8
];

describe("weekWindow", () => {
  test("eight calendar days inclusive: Sunday through the next Sunday", () => {
    expect(lm.weekWindow("2026-09-13")).toEqual({ from: "2026-09-13", to: "2026-09-20" });
  });
  test("crosses a month boundary", () => {
    expect(lm.weekWindow("2026-09-27")).toEqual({ from: "2026-09-27", to: "2026-10-04" });
  });
  test("an unparseable from falls back to today", () => {
    const w = lm.weekWindow("nope");
    expect(w.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(w.to > w.from).toBe(true);
  });
});

describe("weekEvents", () => {
  test("keeps the from-day and from+7, drops from-1 and from+8, sorted by start", () => {
    const got = lm.weekEvents(EVENTS, "2026-09-13").map((e) => e.date + " " + e.show);
    expect(got).toEqual([
      "2026-09-13 jackpotcomedy",
      "2026-09-17 filippo-spreafico",
      "2026-09-17 comedybrew",
      "2026-09-20 jackpotcomedy",
    ]);
  });
  test("two shows on one day stay two events", () => {
    expect(lm.weekEvents(EVENTS, "2026-09-17").filter((e) => e.date === "2026-09-17")).toHaveLength(2);
  });
  test("empty when nothing is in range", () => {
    expect(lm.weekEvents(EVENTS, "2027-01-01")).toEqual([]);
  });
});

describe("headline pool", () => {
  test("at least eight distinct headlines", () => {
    expect(new Set(lm.weekHeadlines()).size).toBeGreaterThanOrEqual(8);
  });
  test("no headline addresses the reader as you or your (Harry: sounds bossy or rude)", () => {
    for (const h of lm.weekHeadlines()) expect(/\byour?\b/i.test(h)).toBe(false);
  });
  test("same week and variant renders the same words twice", () => {
    expect(lm.weekCopy("2026-09-13", 0, 6)).toEqual(lm.weekCopy("2026-09-13", 0, 6));
  });
  test("consecutive weeks differ in at least three of four picks", () => {
    const picks = ["2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04"].map((d) => lm.weekCopy(d, 0, 5).headline);
    expect(new Set(picks).size).toBeGreaterThanOrEqual(3);
  });
  test("the variant moves the pick", () => {
    expect(lm.weekCopy("2026-09-13", 0, 5).headline).not.toBe(lm.weekCopy("2026-09-13", 1, 5).headline);
  });
  test("{n} lines carry the show count, and fall back below two shows", () => {
    for (let v = 0; v < 40; v++) {
      const c = lm.weekCopy("2026-09-13", v, 6);
      expect(c.headline).not.toContain("{n}");
      const one = lm.weekCopy("2026-09-13", v, 1);
      expect(one.headline).not.toMatch(/\d/);
    }
    const withN = Array.from({ length: 40 }, (_, v) => lm.weekCopy("2026-09-13", v, 6).headline).filter((h) => /\b6\b/.test(h));
    expect(withN.length).toBeGreaterThan(0);
  });
});

describe("handles and caption", () => {
  const evs = lm.weekEvents(EVENTS, "2026-09-13");
  test("hosts of every show in the window, in show order, de-duplicated, no blanks", () => {
    // jackpot (Jack has no instagram), filippo (no hosts), brew (Harry, Martina), jackpot again
    expect(lm.weekHandles(evs, SHOWS, ROSTER)).toEqual(["harryf.cks", "martinadoescomedy"]);
  });
  test("handles text is one @handle per line, empty when none", () => {
    expect(lm.weekHandlesText(evs, SHOWS, ROSTER)).toBe("@harryf.cks \n@martinadoescomedy \n");
    expect(lm.weekHandlesText([], SHOWS, ROSTER)).toBe("");
  });
  test("caption lists every show with weekday, date, time, name and venue, then the tagged link", () => {
    const cap = lm.weekCaption(evs, SHOWS, "2026-09-13");
    expect(cap).toContain("Sun 13 Sep · 20:00 · Jackpot Comedy · Bar OTRO");
    expect(cap).toContain("Thu 17 Sep · 19:30 · Comedy Brew · ROBIN's");
    expect(cap).toContain("Thu 17 Sep · 18:00 · Filippo Spreafico · ROBIN's");
    expect(cap.trim().endsWith(lm.weekCalLink())).toBe(true);
  });
  test("the calendar link is the tagged /calendar/ URL", () => {
    expect(lm.weekCalLink()).toBe("https://inyourfacecomedy.ch/calendar/?utm_source=instagram&utm_medium=social&utm_campaign=week");
  });
});

describe("the three later styles (lava, comic, departures board)", () => {
  const lm2 = require("../lineup-maker-2000.js") as {
    weekIsoWeek: (d: string) => number;
    weekComicLayout: (n: number) => number[];
    flapLines: (name: string) => string[];
    newStylePairs: () => { style: string; text: string; field: string; kind: string }[];
    contrastRatio: (a: string, b: string) => number;
  };
  test("weekIsoWeek is the ISO 8601 week (the comic's issue number, the board's WOCHE)", () => {
    expect(lm2.weekIsoWeek("2026-09-13")).toBe(37);   // a Sunday belongs to the week of the Monday before it
    expect(lm2.weekIsoWeek("2026-09-14")).toBe(38);
    expect(lm2.weekIsoWeek("2026-01-01")).toBe(1);
    expect(lm2.weekIsoWeek("2026-12-31")).toBe(53);
    expect(lm2.weekIsoWeek("2027-01-03")).toBe(53);   // still 2026's last week
    expect(lm2.weekIsoWeek("2027-01-04")).toBe(1);
    expect(lm2.weekIsoWeek("nope")).toBe(0);
  });
  test("weekComicLayout rows sum to n, at most three panels across, a splash panel for odd counts", () => {
    for (let n = 0; n <= 12; n++) {
      const rows = lm2.weekComicLayout(n);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(n);
      for (const r of rows) expect(r).toBeGreaterThanOrEqual(1);
      for (const r of rows) expect(r).toBeLessThanOrEqual(3);
    }
    expect(lm2.weekComicLayout(0)).toEqual([]);
    expect(lm2.weekComicLayout(3)[0]).toBe(1);
    expect(lm2.weekComicLayout(5)[0]).toBe(1);
    expect(lm2.weekComicLayout(7)).toEqual([1, 3, 3]);
    expect(lm2.weekComicLayout(6)).toEqual([2, 2, 2]);
  });
  test("flapLines keeps short names on one tile line and splits long ones at a word boundary", () => {
    expect(lm2.flapLines("Comedy Brew")).toEqual(["COMEDY BREW"]);
    expect(lm2.flapLines("Random Facts Exchange")).toEqual(["RANDOM FACTS EXCHANGE".slice(0, 12), "EXCHANGE"]);
    expect(lm2.flapLines("Gratis Comedy zum Mitnehmen")).toEqual(["GRATIS COMEDY ZUM", "MITNEHMEN"]);
    expect(lm2.flapLines("Supercalifragilisticexpialidocious")).toEqual(["SUPERCALIFRAGILISTIC", "EXPIALIDOCIOUS"]);
    expect(lm2.flapLines("")).toEqual([""]);
  });
  test("the new week styles declare contrast pairs and they clear WCAG", () => {
    const pairs = lm2.newStylePairs().filter((p) => /^week-(lava|comic|flap)$/.test(p.style));
    expect(new Set(pairs.map((p) => p.style)).size).toBe(3);
    for (const p of pairs) expect(lm2.contrastRatio(p.text, p.field), p.style + " " + p.text + " on " + p.field).toBeGreaterThanOrEqual(p.kind === "small" ? 4.5 : 3.0);
  });
});

describe("round five: weighted comic panels and the menu's prices", () => {
  const lm3 = require("../lineup-maker-2000.js") as {
    weekComicWeight: (row: { e: { show: string }; day: string }) => number;
    weekMenuPrice: (p: unknown) => string;
    newStylePairs: () => { style: string; text: string; field: string; kind: string }[];
    contrastRatio: (a: string, b: string) => number;
  };
  test("Comedy Brew is always a bit bigger, Friday and Saturday shows a little bigger", () => {
    const plain = lm3.weekComicWeight({ e: { show: "jackpotcomedy" }, day: "WED" });
    const brew = lm3.weekComicWeight({ e: { show: "comedybrew" }, day: "THU" });
    const saturday = lm3.weekComicWeight({ e: { show: "filippo-spreafico" }, day: "SAT" });
    const friday = lm3.weekComicWeight({ e: { show: "latarima" }, day: "FRI" });
    const brewSat = lm3.weekComicWeight({ e: { show: "comedybrew" }, day: "SAT" });
    expect(plain).toBe(1);
    expect(brew).toBeGreaterThan(plain);
    expect(saturday).toBeGreaterThan(plain);
    expect(friday).toBe(saturday);
    expect(brew).toBeGreaterThan(saturday);
    expect(brewSat).toBeGreaterThan(brew);
    expect(lm3.weekComicWeight({ e: { show: "" }, day: "" })).toBe(1);
  });
  test("menu prices: CHF n, FREE for zero, nothing when unknown", () => {
    expect(lm3.weekMenuPrice(10)).toBe("CHF 10");
    expect(lm3.weekMenuPrice(0)).toBe("FREE");
    expect(lm3.weekMenuPrice("13")).toBe("CHF 13");
    expect(lm3.weekMenuPrice(null)).toBe("");
    expect(lm3.weekMenuPrice(undefined)).toBe("");
    expect(lm3.weekMenuPrice("")).toBe("");
    expect(lm3.weekMenuPrice("soon")).toBe("");
  });
  test("station, chalk and menu declare contrast pairs that clear WCAG", () => {
    const pairs = lm3.newStylePairs().filter((p) => /^week-(station|chalk|menu)$/.test(p.style));
    expect(new Set(pairs.map((p) => p.style)).size).toBe(3);
    for (const p of pairs) expect(lm3.contrastRatio(p.text, p.field), p.style + " " + p.text + " on " + p.field).toBeGreaterThanOrEqual(p.kind === "small" ? 4.5 : 3.0);
  });
});

describe("round seven: the station board's taglines and dates", () => {
  const lm4 = require("../lineup-maker-2000.js") as { showTagline: (t: string) => string; weekDateBoard: (d: string) => string };
  test("showTagline is the show page's second title segment", () => {
    expect(lm4.showTagline("Comedy Brew • English Stand-Up Comedy Open Mic • EVERY Thursday at ROBINS")).toBe("English Stand-Up Comedy Open Mic");
    expect(lm4.showTagline("Jackpot Comedy - downstairs @ OTRO")).toBe("downstairs @ OTRO");
    expect(lm4.showTagline("La Tarima - Comedia en Español")).toBe("Comedia en Español");
    expect(lm4.showTagline("Filippo Spreafico")).toBe("");
    expect(lm4.showTagline("")).toBe("");
  });
  test("weekDateBoard prints the date the way the board does", () => {
    expect(lm4.weekDateBoard("2026-09-15")).toBe("15 Sept");
    expect(lm4.weekDateBoard("2026-10-01")).toBe("1 Oct");
    expect(lm4.weekDateBoard("2026-06-07")).toBe("7 June");
    expect(lm4.weekDateBoard("nope")).toBe("");
  });
});

describe("round eight: the calendar's Info lines on the week image", () => {
  const lm5 = require("../lineup-maker-2000.js") as {
    weekInfoFor: (infos: { show: string; date: string; info: string }[], e: { show: string; date: string }) => string;
    stripEmoji: (s: string) => string;
    weekCaption: (events: Ev[], shows: unknown[], from: string, infos?: { show: string; date: string; info: string }[]) => string;
    weekEvents: (events: Ev[], from: string) => Ev[];
  };
  const INFOS = [
    { show: "jackpotcomedy", date: "2026-09-13", info: "Some punchlines land, some crash. All worth it 🎲" },
    { show: "comedybrew", date: "2026-09-17", info: "Cult-free socialising powered by English comedy 😈" },
    { show: "", date: "", info: "" },
  ];
  test("weekInfoFor finds the line for the show on that date, nothing otherwise", () => {
    expect(lm5.weekInfoFor(INFOS, { show: "jackpotcomedy", date: "2026-09-13" })).toBe("Some punchlines land, some crash. All worth it 🎲");
    expect(lm5.weekInfoFor(INFOS, { show: "Jackpot-Comedy", date: "2026-09-13" })).toBe("Some punchlines land, some crash. All worth it 🎲");
    expect(lm5.weekInfoFor(INFOS, { show: "jackpotcomedy", date: "2026-09-20" })).toBe("");
    expect(lm5.weekInfoFor([], { show: "jackpotcomedy", date: "2026-09-13" })).toBe("");
    expect(lm5.weekInfoFor(INFOS, { show: "", date: "" })).toBe("");
  });
  test("stripEmoji leaves the words and trims", () => {
    expect(lm5.stripEmoji("Some punchlines land, some crash. All worth it 🎲")).toBe("Some punchlines land, some crash. All worth it");
    expect(lm5.stripEmoji("Finalmente una serata di risate in italiano 🇮🇹")).toBe("Finalmente una serata di risate in italiano");
    expect(lm5.stripEmoji("Free entry: Teddy Hall and friends 🆓")).toBe("Free entry: Teddy Hall and friends");
    expect(lm5.stripEmoji("no emoji here")).toBe("no emoji here");
    expect(lm5.stripEmoji("")).toBe("");
  });
  test("the caption carries the Info line under its show when infos are given", () => {
    const evs = lm5.weekEvents(EVENTS, "2026-09-13");
    const cap = lm5.weekCaption(evs, SHOWS, "2026-09-13", INFOS);
    expect(cap).toContain("Sun 13 Sep · 20:00 · Jackpot Comedy · Bar OTRO\n   Some punchlines land, some crash. All worth it 🎲");
    expect(cap).toContain("Thu 17 Sep · 19:30 · Comedy Brew · ROBIN's\n   Cult-free socialising powered by English comedy 😈");
    expect(lm5.weekCaption(evs, SHOWS, "2026-09-13")).not.toContain("punchlines");
  });
});

describe("round nine: the Info line wraps before it shrinks; venues print two words", () => {
  const lm6 = require("../lineup-maker-2000.js") as {
    weekInfoLines: (ctx: unknown, text: string, maxW: number, startPx: number, minPx: number, weight: string, family: string, maxLines?: number) => { px: number; lines: string[] };
    weekVenueShort: (venue: string) => string;
  };
  // a measuring context where every glyph is half the font size wide
  function fakeCtx() {
    const ctx = { font: "", measureText(s: string) { const px = parseInt((/(\d+)px/.exec(ctx.font) || ["", "0"])[1], 10); return { width: s.length * px * 0.5 }; } };
    return ctx;
  }
  test("a short line stays one line at the start size", () => {
    const r = lm6.weekInfoLines(fakeCtx(), "Fresh pint of funny", 600, 28, 16, "500", "Inter");
    expect(r).toEqual({ px: 28, lines: ["Fresh pint of funny"] });
  });
  test("a long line wraps to two lines at the start size instead of shrinking", () => {
    const text = "New material night, zero douchebags policy, pay what you like";   // 61 chars, 854 px at 28
    const r = lm6.weekInfoLines(fakeCtx(), text, 600, 28, 16, "500", "Inter");
    expect(r.px).toBe(28);
    expect(r.lines.length).toBe(2);
    expect(r.lines.join(" ")).toBe(text);
  });
  test("it shrinks only when two lines will not hold the text", () => {
    const text = "New material night, zero douchebags policy, pay what you like";
    const r = lm6.weekInfoLines(fakeCtx(), text, 300, 28, 16, "500", "Inter");
    expect(r.px).toBeLessThan(28);
    expect(r.lines.length).toBeLessThanOrEqual(2);
  });
  test("maxLines 1 keeps a single fitted line", () => {
    const text = "New material night, zero douchebags policy, pay what you like";
    const r = lm6.weekInfoLines(fakeCtx(), text, 600, 28, 16, "400", "Inter", 1);
    expect(r.lines).toEqual([text]);
    expect(r.px).toBe(18);   // 61 * 9 = 549 fits, 61 * 10 = 610 does not
  });
  test("empty text gives no lines and sets nothing", () => {
    expect(lm6.weekInfoLines(fakeCtx(), "", 600, 28, 16, "500", "Inter")).toEqual({ px: 28, lines: [] });
  });
  test("weekVenueShort keeps the first two words", () => {
    expect(lm6.weekVenueShort("Natural History Museum of the University of Zurich")).toBe("Natural History");
    expect(lm6.weekVenueShort("YAMAN Café-Bar")).toBe("YAMAN Café-Bar");
    expect(lm6.weekVenueShort("ROBIN's")).toBe("ROBIN's");
    expect(lm6.weekVenueShort("  Bar   OTRO ")).toBe("Bar OTRO");
    expect(lm6.weekVenueShort("")).toBe("");
  });
});

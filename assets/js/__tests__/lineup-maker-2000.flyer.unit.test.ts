// Pure-logic unit tests for the Flyer Maker helpers added to lineup-maker-2000.js.
// These cover the format spec, priority->size mapping, and the day-or-date label
// rule (weekday code if the show is within the coming 7 days, else the date) — the
// drawing/DOM code is exercised separately by the .dom.test and by Interceptor.
import { describe, expect, test } from "bun:test";

const lm = require("../lineup-maker-2000.js") as {
  dayLabel: (iso: string, nowMs?: number) => string;
  flyerDate: (iso: string, format: string, nowMs?: number) => string;
  faceScale: (priority: string) => number;
  flyerSpec: (format: string) => {
    w: number; h: number; safeTop: number; safeBottom: number;
    keyTop: number; keyBottom: number; keySide: number; format: string;
  };
  ticketSerial: (slug: string, iso: string) => string;
  ticketPalettes: () => Palette[];
  ticketPalette: (slug: string) => Palette;
};
type Palette = { name: string; paper: string; ink: string; accent: string; chip: string; chipText: string; host: string; hostText: string };

// WCAG 2.x relative luminance + contrast ratio, so the palette readability floors are
// pinned here rather than eyeballed.
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string): number {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Fixed "now" so the relative-date logic is deterministic: 2026-06-01T12:00:00Z.
const NOW = Date.parse("2026-06-01T12:00:00+00:00");

describe("flyer • flyerSpec", () => {
  test("post is 1080x1350 (4:5)", () => {
    const s = lm.flyerSpec("post");
    expect(s.w).toBe(1080);
    expect(s.h).toBe(1350);
    expect(s.format).toBe("post");
  });
  test("story is 1080x1920 (9:16) with a UI-safe top/bottom inset", () => {
    const s = lm.flyerSpec("story");
    expect(s.w).toBe(1080);
    expect(s.h).toBe(1920);
    expect(s.safeTop).toBeGreaterThanOrEqual(250);
    expect(s.safeBottom).toBeGreaterThanOrEqual(250);
  });
  test("unknown/empty format falls back to post dimensions", () => {
    expect(lm.flyerSpec("")).toMatchObject({ w: 1080, h: 1350 });
    expect(lm.flyerSpec("whatever")).toMatchObject({ w: 1080, h: 1350 });
  });
  // The Instagram key-content requirement (see the flyerSpec comment + FLYER_DESIGN.md §1):
  // story keeps ~250px top / ~340px bottom / ~60px sides clear; post treats the central
  // 1080x1080 as safe with ~50px side margins. New styles position against these.
  test("story key-content area is y 250..1580 with 60px side margins", () => {
    const s = lm.flyerSpec("story");
    expect(s.keyTop).toBe(250);
    expect(s.keyBottom).toBe(340);
    expect(s.keySide).toBe(60);
    expect(s.h - s.keyTop - s.keyBottom).toBe(1330);
  });
  test("post key-content area is the central 1080x1080 with 50px side margins", () => {
    const s = lm.flyerSpec("post");
    expect(s.keyTop).toBe(135);
    expect(s.keyBottom).toBe(135);
    expect(s.keySide).toBe(50);
    expect(s.h - s.keyTop - s.keyBottom).toBe(1080);
  });
  test("legacy safe insets the classic painter positions against are unchanged", () => {
    expect(lm.flyerSpec("story")).toMatchObject({ safeTop: 250, safeBottom: 320 });
    expect(lm.flyerSpec("post")).toMatchObject({ safeTop: 70, safeBottom: 70 });
  });
});

describe("flyer • ticketSerial (stable per show + date)", () => {
  test("is deterministic and formatted as 'Nº ddddd'", () => {
    const a = lm.ticketSerial("double-shot", "2026-10-02T20:00:00+02:00");
    expect(a).toMatch(/^Nº \d{5}$/);
    expect(lm.ticketSerial("double-shot", "2026-10-02T20:00:00+02:00")).toBe(a);
  });
  test("changes with the date and with the show", () => {
    const a = lm.ticketSerial("double-shot", "2026-10-02T20:00:00+02:00");
    expect(lm.ticketSerial("double-shot", "2026-11-06T20:00:00+01:00")).not.toBe(a);
    expect(lm.ticketSerial("promessi-spassi", "2026-10-02T20:00:00+02:00")).not.toBe(a);
  });
  test("tolerates a missing slug or date", () => {
    expect(lm.ticketSerial("", "")).toMatch(/^Nº \d{5}$/);
  });
});

describe("flyer • faceScale (priority -> size)", () => {
  test("High > Medium > Low, all strictly positive and visible", () => {
    const hi = lm.faceScale("High");
    const md = lm.faceScale("Medium");
    const lo = lm.faceScale("Low");
    expect(hi).toBeGreaterThan(md);
    expect(md).toBeGreaterThan(lo);
    expect(lo).toBeGreaterThan(0);
  });
  test("is case/whitespace-insensitive and defaults unknown to Medium", () => {
    expect(lm.faceScale("high")).toBe(lm.faceScale("High"));
    expect(lm.faceScale("")).toBe(lm.faceScale("Medium"));
    expect(lm.faceScale(undefined as unknown as string)).toBe(lm.faceScale("Medium"));
    expect(lm.faceScale("bogus")).toBe(lm.faceScale("Medium"));
  });
});

describe("flyer • dayLabel (weekday code if ≤7 days out, else date)", () => {
  test("a show within the coming week renders the weekday code", () => {
    // 2026-06-04 is a Thursday, 3 days after NOW
    expect(lm.dayLabel("2026-06-04T20:00:00+00:00", NOW)).toBe("THU");
    // exactly 7 days out is still inside the window
    expect(lm.dayLabel("2026-06-08T20:00:00+00:00", NOW)).toBe("MON");
  });
  test("a show further out renders the date as 'D MON'", () => {
    // 2026-10-02 is well beyond 7 days
    expect(lm.dayLabel("2026-10-02T20:00:00+00:00", NOW)).toBe("2 OCT");
  });
  test("a show happening TODAY still renders its weekday, not the date (calendar-day math)", () => {
    // Same calendar day as NOW but an evening start — a raw ms delta would call this past
    // and drop the badge; calendar-day comparison keeps it a weekday code.
    const today = lm.dayLabel("2026-06-01T20:00:00+00:00", NOW);
    expect(today).toMatch(/^[A-Z]{3}$/);
    expect(today).not.toMatch(/[0-9]/);
  });
  test("empty / unparseable input yields an empty label", () => {
    expect(lm.dayLabel("", NOW)).toBe("");
    expect(lm.dayLabel("not-a-date", NOW)).toBe("");
  });
});

describe("flyer • flyerDate (format-aware: post = history, story = ephemeral)", () => {
  // 2026-06-04 is a Thursday; use noon UTC so the weekday can't drift across timezones.
  test("post shows the full date as history: 'WD D MON'", () => {
    expect(lm.flyerDate("2026-06-04T12:00:00+00:00", "post", NOW)).toBe("THU 4 JUN");
  });
  test("story shows just the upcoming weekday", () => {
    expect(lm.flyerDate("2026-06-04T12:00:00+00:00", "story", NOW)).toBe("THU");
  });
  test("empty / unparseable input yields an empty label in both formats", () => {
    expect(lm.flyerDate("", "post", NOW)).toBe("");
    expect(lm.flyerDate("nope", "story", NOW)).toBe("");
  });
});

describe("flyer • ticketPalette (per-show paper, readable by construction)", () => {
  const all = lm.ticketPalettes();
  test("there are several palettes and each has every role filled with a hex colour", () => {
    expect(all.length).toBeGreaterThanOrEqual(7);
    for (const p of all) {
      for (const k of ["paper", "ink", "accent", "chip", "chipText", "host", "hostText"] as const) {
        expect(p[k]).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });
  test("every palette clears the contrast floors (ink 4.5, accent / chips / host 3.0)", () => {
    for (const p of all) {
      expect(contrast(p.ink, p.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.accent, p.paper)).toBeGreaterThanOrEqual(3.0);
      expect(contrast(p.chipText, p.chip)).toBeGreaterThanOrEqual(3.0);
      expect(contrast(p.hostText, p.host)).toBeGreaterThanOrEqual(3.0);
    }
  });
  test("no paper is cream or yellow: every paper is dark (relative luminance under 0.25)", () => {
    for (const p of all) expect(lum(p.paper)).toBeLessThan(0.25);
  });
  test("the papers cover the red, blue, charcoal and brown families", () => {
    const names = all.map((p) => p.name).join(" ");
    expect(names).toMatch(/red|brick|wine/);
    expect(names).toMatch(/blue/);
    expect(names).toMatch(/charcoal/);
    expect(names).toMatch(/brown/);
  });
  test("the same show always gets the same palette", () => {
    expect(lm.ticketPalette("double-shot")).toEqual(lm.ticketPalette("double-shot"));
    expect(lm.ticketPalette("double-shot").name).toBe(lm.ticketPalette("double-shot").name);
  });
  test("different shows spread across several palettes (no show names in the code)", () => {
    const slugs = ["double-shot", "gratis-zum-mitnehmen", "nerdycomedyshow", "filippo-spreafico", "promessi-spassi", "randomfactsexchange", "pulpnonfiction", "latarima", "comedybrew", "jokesjokesjokes"];
    const names = new Set(slugs.map((s) => lm.ticketPalette(s).name));
    expect(names.size).toBeGreaterThanOrEqual(3);
  });
  test("a missing slug still yields a valid palette", () => {
    expect(all).toContainEqual(lm.ticketPalette(""));
    expect(all).toContainEqual(lm.ticketPalette(undefined as unknown as string));
  });
});

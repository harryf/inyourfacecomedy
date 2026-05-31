// Pure-logic unit tests for the Flyer Maker helpers added to lineup-maker-2000.js.
// These cover the format spec, priority->size mapping, and the day-or-date label
// rule (weekday code if the show is within the coming 7 days, else the date) — the
// drawing/DOM code is exercised separately by the .dom.test and by Interceptor.
import { describe, expect, test } from "bun:test";

const lm = require("../lineup-maker-2000.js") as {
  dayLabel: (iso: string, nowMs?: number) => string;
  faceScale: (priority: string) => number;
  flyerSpec: (format: string) => { w: number; h: number; safeTop: number; safeBottom: number; format: string };
};

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

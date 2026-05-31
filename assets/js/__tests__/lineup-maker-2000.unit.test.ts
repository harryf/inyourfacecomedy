// Pure-logic unit tests for assets/js/lineup-maker-2000.js.
// Note: this file's splitTitle returns the *primary* string (not {primary,secondary}),
// and its showDate does NOT hide past dates (the organizer tool shows whatever the
// catalog holds) — both differ from comedian-lineup.js on purpose.
import { describe, expect, test } from "bun:test";

const lm = require("../lineup-maker-2000.js") as {
  norm: (s: string) => string;
  splitTitle: (t: string) => string;
  showDate: (iso: string) => string;
};

describe("lineup-maker-2000 • norm", () => {
  test("matches comedian-lineup's case/separator-insensitive contract", () => {
    expect(lm.norm("Harry F.cks")).toBe(lm.norm("harryf-cks"));
    expect(lm.norm("Pulp Non-Fiction")).toBe("pulpnonfiction");
  });
});

describe("lineup-maker-2000 • splitTitle (primary segment only)", () => {
  test("returns the first segment, normalizing ' - ' and '•'", () => {
    expect(lm.splitTitle("Brexiles - The Final Countdown")).toBe("Brexiles");
    expect(lm.splitTitle("Comedy Brew • Two Halves")).toBe("Comedy Brew");
    expect(lm.splitTitle("Jackpot Comedy")).toBe("Jackpot Comedy");
  });
});

describe("lineup-maker-2000 • showDate", () => {
  test("formats any valid date as 'Wkd · D Mon' (no stale-hiding here)", () => {
    expect(lm.showDate("2030-06-15T12:00:00+00:00")).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) · 15 Jun$/);
    // unlike comedian-lineup, a past date still formats (organizer tool lists everything)
    expect(lm.showDate("2000-01-01T00:00:00+00:00")).toMatch(/ · 1 Jan$/);
  });
  test("returns empty string for empty / unparseable input", () => {
    expect(lm.showDate("")).toBe("");
    expect(lm.showDate("nope")).toBe("");
  });
});

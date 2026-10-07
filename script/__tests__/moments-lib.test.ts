import { describe, expect, test } from "bun:test";
import { budgetPlan, csvRows, easter, holidaysFromApi, isLongWeekend, nextShow, openWindow, pickWhen, wetVerdict, windowsFor, zurichHolidays, zurichIso, type MomentsConfig } from "../lib/moments-lib";

const at = (iso: string) => new Date(iso);
const CFG: MomentsConfig = { weekly_envelope_chf: 91, cold_share: 0.7, split: { planner: 0.2, evergreen: 0.2, tomorrow: 0.2, tonight: 0.4 }, wet_boost: 1.5, long_weekend_boost: 1.5, max_boost: 1.75, floor_chf: 1, old_set_month_chf: 130, postcode_point: "800100", station_point: "71" };

describe("windows", () => {
  test("Zürich offsets follow summer and winter time", () => {
    expect(zurichIso("2026-10-08", "19:30")).toBe("2026-10-08T19:30:00+02:00");
    expect(zurichIso("2026-11-05", "19:30")).toBe("2026-11-05T19:30:00+01:00");
  });
  test("planner Saturday to Monday, tomorrow Wednesday, tonight Thursday until 18:00", () => {
    const w = windowsFor("2026-10-08");
    expect(w.map((x) => [x.phase, x.from, x.until, x.endIso])).toEqual([
      ["planner", "2026-10-03", "2026-10-05", "2026-10-05T23:59:00+02:00"],
      ["tomorrow", "2026-10-07", "2026-10-07", "2026-10-07T23:59:00+02:00"],
      ["tonight", "2026-10-08", "2026-10-08", "2026-10-08T18:00:00+02:00"],
    ]);
  });
  test("the open window at a given moment, and none on Tuesday or after doors", () => {
    expect(openWindow("2026-10-08", at("2026-10-04T08:00:00+02:00"))?.phase).toBe("planner");
    expect(openWindow("2026-10-08", at("2026-10-06T07:30:00+02:00"))).toBeNull();
    expect(openWindow("2026-10-08", at("2026-10-07T07:30:00+02:00"))?.phase).toBe("tomorrow");
    expect(openWindow("2026-10-08", at("2026-10-08T07:30:00+02:00"))?.phase).toBe("tonight");
    expect(openWindow("2026-10-08", at("2026-10-08T19:45:00+02:00"))).toBeNull();
  });
  test("next show: today's counts until 18:00, nothing further than six days", () => {
    const ev = [{ show: "comedybrew", date: "2026-10-08" }, { show: "comedybrew", date: "2026-10-15" }, { show: "other", date: "2026-10-06" }];
    expect(nextShow(ev, at("2026-10-04T09:00:00+02:00"))).toBe("2026-10-08");
    expect(nextShow(ev, at("2026-10-08T17:30:00+02:00"))).toBe("2026-10-08");
    expect(nextShow(ev, at("2026-10-08T18:00:00+02:00"))).toBeNull();     // the window has ended and the 15th is seven days out
    expect(nextShow(ev, at("2026-10-09T09:00:00+02:00"))).toBe("2026-10-15");
    expect(nextShow([{ show: "comedybrew", date: "2026-10-15" }], at("2026-10-04T09:00:00+02:00"))).toBeNull();
  });
});

describe("holidays", () => {
  test("Easter and the computed Zürich list", () => {
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
    expect(zurichHolidays(2027)).toContain("2027-03-26");     // Good Friday
    expect(zurichHolidays(2027)).toContain("2027-05-06");     // Ascension
  });
  test("API rows: nationwide and CH-ZH count, city-only ones do not", () => {
    const rows = [
      { startDate: "2026-12-25", nationwide: true },
      { startDate: "2027-03-26", nationwide: false, subdivisions: [{ code: "CH-BE" }, { code: "CH-ZH" }] },
      { startDate: "2027-04-19", nationwide: false, subdivisions: [{ code: "CH-ZH-ZH-ZH" }] },
    ];
    expect(holidaysFromApi(rows)).toEqual(["2026-12-25", "2027-03-26"]);
  });
  test("long weekend = the Friday after the show is a holiday", () => {
    expect(isLongWeekend("2026-12-31", ["2027-01-01"])).toBe(true);
    expect(isLongWeekend("2026-10-08", ["2027-01-01"])).toBe(false);
  });
});

describe("weather", () => {
  const csv = (rows: [string, string, number][]) => "point_id;point_type_id;Date;x\n" + rows.map(([p, d, v]) => `${p};2;${d};${v}`).join("\n");
  test("rows for one point only", () => {
    expect(csvRows(csv([["800100", "202610080000", 16.2], ["8001000", "202610080000", 9], ["71", "202610080000", 1]]), "800100")).toEqual([{ at: "202610080000", value: 16.2 }]);
  });
  test("this week's numbers make Thursday wet on rain and on the drop", () => {
    const v = wetVerdict("2026-10-08", {
      dailyRainMm: [{ at: "202610080000", value: 16.2 }],
      rainChance3h: [{ at: "202610081500", value: 49 }, { at: "202610081600", value: 63 }, { at: "202610081900", value: 53 }, { at: "202610082000", value: 53 }],
      dailyMaxC: [{ at: "202610060000", value: 19.6 }, { at: "202610070000", value: 20.8 }, { at: "202610080000", value: 14.1 }],
    });
    expect(v.wet).toBe(true);
    expect(v.reasons).toEqual(["rain 16.2 mm on the day", "63% chance of rain in the evening", "high 14.1 °C, 6.7 °C below the days before"]);
  });
  test("a dry, mild day is not wet; missing data is not wet", () => {
    expect(wetVerdict("2026-10-08", { dailyRainMm: [{ at: "202610080000", value: 0.4 }], rainChance3h: [{ at: "202610081600", value: 20 }], dailyMaxC: [{ at: "202610070000", value: 21 }, { at: "202610080000", value: 20 }] }).wet).toBe(false);
    expect(wetVerdict("2026-10-08", { dailyRainMm: [], rainChance3h: [], dailyMaxC: [] }).wet).toBe(false);
  });
});

describe("picking and money", () => {
  test("long weekend beats wet; the planner never goes wet", () => {
    expect(pickWhen("tonight", true, true)).toBe("long_weekend");
    expect(pickWhen("tonight", false, true)).toBe("wet");
    expect(pickWhen("planner", false, true)).toBe("any");
    expect(pickWhen("tomorrow", false, false)).toBe("any");
  });
  test("plain week: 70/30 and the curve, about the envelope", () => {
    const p = budgetPlan(CFG, false, false, 600);
    expect(p.daily).toEqual({ cold: 1.8, "cold-planner": 4.25, "cold-tomorrow": 12.75, "cold-tonight": 25.5, warm: 1, "warm-planner": 1.8, "warm-tomorrow": 5.45, "warm-tonight": 10.9 });
    expect(p.week_chf).toBeCloseTo(92.35, 2);     // the warm evergreen floor (CHF 1, not 0.78) adds 1.54
  });
  test("wet lifts tomorrow and tonight by half; both conditions cap at 1.75", () => {
    expect(budgetPlan(CFG, false, true, 600).daily["cold-tonight"]).toBe(38.2);
    const both = budgetPlan(CFG, true, true, 600);
    expect(both.boost).toEqual({ planner: 1.5, tomorrow: 1.75, tonight: 1.75 });
  });
  test("over the monthly cap the boosts go, never the base", () => {
    const p = budgetPlan(CFG, true, true, 450);
    expect(p.boost).toEqual({ planner: 1, tomorrow: 1, tonight: 1 });
    expect(p.note).toMatch(/boosts dropped/);
  });
});

describe("Harry's 2026-10-04 rule: the long weekend 'tomorrow' line runs on the Wednesday only", () => {
  test("its ad set's window is the Wednesday alone, ending 23:59, and only a holiday Friday picks it", () => {
    const tomorrow = windowsFor("2026-12-31").find((w) => w.phase === "tomorrow")!;
    expect([tomorrow.from, tomorrow.until, tomorrow.endIso]).toEqual(["2026-12-30", "2026-12-30", "2026-12-30T23:59:00+01:00"]);
    expect(openWindow("2026-12-31", at("2026-12-29T09:00:00+01:00"))).toBeNull();               // Tuesday: nothing
    expect(openWindow("2026-12-31", at("2026-12-30T07:00:00+01:00"))?.phase).toBe("tomorrow");  // Wednesday
    expect(openWindow("2026-12-31", at("2026-12-31T07:00:00+01:00"))?.phase).toBe("tonight");   // Thursday: tonight, not tomorrow
    expect(pickWhen("tomorrow", isLongWeekend("2026-12-31", ["2027-01-01"]), false)).toBe("long_weekend");
    expect(pickWhen("tomorrow", isLongWeekend("2026-10-08", ["2027-01-01"]), false)).toBe("any");
  });
});

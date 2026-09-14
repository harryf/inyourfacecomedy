import { describe, expect, test } from "bun:test";
import { DEFAULT_RULES } from "../lib/meta-api";
import { actionCount, collectRecommendations, median, rankingMetric, renderRecommendations, showsInWindow, siteClicksByContent, siteFor, verdicts, type AdRow } from "../meta-insights";
import { capAllows, desiredFor, diffFields, postBody, projectedMonthChf, showsInNext30Days } from "../meta-adsets";

const row = (p: Partial<AdRow>): AdRow => ({
  adset: "cold", adset_id: "s", ad_id: p.ad_name || "x", ad_name: "x", status: "ACTIVE", created: "2026-08-01", spend: 10, impressions: 1000, reach: 800, frequency: 1.2, link_clicks: 50, lpv: 0, ticket: 0,
  site: null, cost_per_ticket: null, cost_per_lpv: null, metric: null, verdict: "keep", note: "", ...p,
});
const withCosts = (p: Partial<AdRow>): AdRow => { const r = row(p); r.cost_per_ticket = r.ticket ? r.spend / r.ticket : null; r.cost_per_lpv = r.lpv ? r.spend / r.lpv : null; return r; };

describe("median and metric", () => {
  test("median of odd and even lists", () => { expect(median([3, 1, 2])).toBe(2); expect(median([4, 1, 3, 2])).toBe(2.5); expect(Number.isNaN(median([]))).toBe(true); });
  test("ranking metric follows the floors", () => {
    expect(rankingMetric({ ticket: 10, lpv: 0 }, DEFAULT_RULES)).toBe("ticket");
    expect(rankingMetric({ ticket: 9, lpv: 30 }, DEFAULT_RULES)).toBe("lpv");
    expect(rankingMetric({ ticket: 9, lpv: 29 }, DEFAULT_RULES)).toBeNull();
  });
  test("actionCount reads the custom conversion", () => {
    expect(actionCount([{ action_type: "offsite_conversion.custom.1", value: "7" }], "offsite_conversion.custom.1")).toBe(7);
    expect(actionCount(undefined, "x")).toBe(0);
  });
});

describe("verdicts", () => {
  test("untested below the floors, ranked on lpv when fewer than two ads clear the ticket floor", () => {
    const rows = [withCosts({ ad_name: "a", spend: 20, lpv: 40 }), withCosts({ ad_name: "b", spend: 20, lpv: 35 }), withCosts({ ad_name: "c", spend: 5, lpv: 3 })];
    const v = verdicts(rows, DEFAULT_RULES, "2026-08-10");
    expect(v.find((r) => r.ad_name === "c")!.verdict).toBe("untested");
    expect(v.find((r) => r.ad_name === "a")!.metric).toBe("lpv");
    expect(v.filter((r) => r.verdict === "keep").length).toBe(2);
  });
  test("retire when worse than 1.5 times the median, ranked on ticket clicks", () => {
    // costs 1.00, 1.33, 5.00, 6.00: median 3.17, threshold 4.75
    const rows = [withCosts({ ad_name: "good", spend: 20, ticket: 20 }), withCosts({ ad_name: "ok", spend: 20, ticket: 15 }), withCosts({ ad_name: "bad", spend: 50, ticket: 10 }), withCosts({ ad_name: "worse", spend: 60, ticket: 10 })];
    const v = verdicts(rows, DEFAULT_RULES, "2026-08-10");
    expect(v.find((r) => r.ad_name === "worse")!.verdict).toBe("retire");
    expect(v.find((r) => r.ad_name === "bad")!.verdict).toBe("retire");
    expect(v.find((r) => r.ad_name === "good")!.verdict).toBe("keep");
    expect(v.find((r) => r.ad_name === "good")!.metric).toBe("ticket");
  });
  test("at most max_retire per ad set and never the last two", () => {
    // With a 0.5 factor both b and c are over the line, but three live ads may lose only one.
    const rows = [withCosts({ ad_name: "a", spend: 10, ticket: 10 }), withCosts({ ad_name: "b", spend: 100, ticket: 10 }), withCosts({ ad_name: "c", spend: 90, ticket: 10 })];
    const v = verdicts(rows, { ...DEFAULT_RULES, retire_factor: 0.5 }, "2026-08-10");
    expect(v.filter((r) => r.verdict === "retire").length).toBe(1);
    expect(v.find((r) => r.ad_name === "b")!.verdict).toBe("retire");    // the worst goes first
    expect(v.find((r) => r.ad_name === "c")!.note).toMatch(/retire cap/);
    // Five live ads, two clear losers: both go (the max is two).
    const five = [...rows.slice(0, 1), withCosts({ ad_name: "d", spend: 10, ticket: 10 }), withCosts({ ad_name: "e", spend: 10, ticket: 10 }), ...rows.slice(1)];
    expect(verdicts(five, DEFAULT_RULES, "2026-08-10").filter((r) => r.verdict === "retire").map((r) => r.ad_name).sort()).toEqual(["b", "c"]);
  });
  test("starved after 28 days under the floor while a sibling passed; untested when young", () => {
    const rows = [withCosts({ ad_name: "ok", spend: 20, lpv: 40, created: "2026-07-01" }), withCosts({ ad_name: "old", spend: 2, lpv: 2, created: "2026-07-01" }), withCosts({ ad_name: "new", spend: 2, lpv: 2, created: "2026-08-05" })];
    const v = verdicts(rows, DEFAULT_RULES, "2026-08-10");
    expect(v.find((r) => r.ad_name === "old")!.verdict).toBe("starved");
    expect(v.find((r) => r.ad_name === "new")!.verdict).toBe("untested");
  });
  test("nobody is starved when no sibling passed the floor", () => {
    const v = verdicts([withCosts({ ad_name: "a", lpv: 1, created: "2026-01-01" })], DEFAULT_RULES, "2026-08-10");
    expect(v[0].verdict).toBe("untested");
  });
  test("paused ads keep, protected ad sets are never judged", () => {
    expect(verdicts([withCosts({ ad_name: "p", status: "PAUSED" })], DEFAULT_RULES, "2026-08-10")[0].verdict).toBe("keep");
    expect(verdicts([withCosts({ ad_name: "o", spend: 100, ticket: 10 })], DEFAULT_RULES, "2026-08-10", true)[0].verdict).toBe("protected");
  });
});

describe("site join and calendar", () => {
  const reports = [{ since: "2026-08-26", through: "2026-09-13", by_campaign: [{ source: "meta", content: [{ content: "120203748201470314", clicks: 186 }, { content: "lineup-2026-09-17", clicks: 4 }] }, { source: "instagram", content: [{ content: "lineup-2026-09-17", clicks: 99 }] }] }];
  test("sums meta content across reports and ignores other sources", () => {
    const s = siteClicksByContent([...reports, ...reports]);
    expect(s.clicks.get("120203748201470314")).toBe(372);
    expect(s.clicks.get("lineup-2026-09-17")).toBe(8);
    expect(s.window).toBe("2026-08-26 to 2026-09-13");
  });
  test("matches by ad name first, then ad id, else null", () => {
    const s = siteClicksByContent(reports).clicks;
    expect(siteFor(s, { ad_id: "120203748201470314", ad_name: "Tailored" })).toBe(186);
    expect(siteFor(s, { ad_id: "1", ad_name: "lineup-2026-09-17" })).toBe(4);
    expect(siteFor(s, { ad_id: "2", ad_name: "nothing" })).toBeNull();
  });
  const cal = "events:\n- show: comedybrew\n  date: '2026-09-17'\n- show: comedybrew\n  date: '2026-09-24'\n- show: latarima\n  date: '2026-09-18'\n";
  const past = "events:\n- show: comedybrew\n  date: '2026-09-10'\n- show: comedybrew\n  date: '2026-09-10'\n";
  test("counts distinct Comedy Brew dates inside the window", () => {
    expect(showsInWindow([cal, past], "comedybrew", "2026-09-05", "2026-09-18")).toBe(2);
    expect(showsInNext30Days(cal, ["comedybrew"], "2026-09-13")).toBe(2);
    expect(showsInNext30Days(cal, ["comedybrew"], "2026-10-13")).toBe(0);
  });
});

describe("ad set spec, diff and cap", () => {
  const audiences = { ig: "1", fb: "2", site: "3", show: "4", br: "5", bl: "6" };
  const spec = { location: { city_key: "313044", radius_km: 30, location_types: ["home", "recent"] }, ages: [21, 50] as [number, number], locales: [24, 6, 2], include: [], exclude: ["ig", "fb", "site", "show", "br", "bl"], optimization: "LANDING_PAGE_VIEWS" };
  test("desired targeting for Cold", () => {
    const d = desiredFor(spec, audiences, "px", 3);
    expect((d.targeting.geo_locations as any).cities[0]).toEqual({ key: "313044", radius: 30, distance_unit: "kilometer" });
    expect(d.targeting.locales).toEqual([2, 6, 24]);
    expect((d.targeting.excluded_custom_audiences as any[]).length).toBe(6);
    expect(d.targeting.custom_audiences).toBeUndefined();
    expect(d.daily_budget).toBe(300);
    expect(d.destination_type).toBe("WEBSITE");
  });
  test("unknown audience key fails loudly", () => { expect(() => desiredFor({ ...spec, exclude: ["nope"] }, audiences, "px", 3)).toThrow(/nope/); });
  test("diff against a shell ad set names every field, and the post body carries targeting once", () => {
    const shell = { targeting: { age_min: 18, age_max: 65, geo_locations: { countries: ["CH"], location_types: ["home", "recent"] }, targeting_automation: { advantage_audience: 1 } }, optimization_goal: "PROFILE_VISIT", billing_event: "IMPRESSIONS", destination_type: "INSTAGRAM_PROFILE_AND_FACEBOOK_PAGE", promoted_object: { page_id: "p" }, attribution_spec: [{ event_type: "CLICK_THROUGH", window_days: 1 }], daily_budget: "2000" };
    const d = desiredFor(spec, audiences, "px", 3);
    const diffs = diffFields(shell, d);
    const fields = diffs.map((x) => x.field);
    expect(fields).toContain("geo"); expect(fields).toContain("ages"); expect(fields).toContain("exclude"); expect(fields).toContain("advantage_audience"); expect(fields).toContain("optimization_goal"); expect(fields).toContain("destination_type"); expect(fields).toContain("daily_budget");
    expect(fields).not.toContain("attribution"); expect(fields).not.toContain("billing_event");
    const body = postBody(diffs, d);
    expect(body.targeting).toBe(d.targeting);
    expect(body.daily_budget).toBe(300);
    expect(body.attribution_spec).toBeUndefined();
    expect(diffFields(d, d)).toEqual([]);
  });
  test("a Meta ad set in miles reads as miles in the diff", () => {
    expect(diffFields({ targeting: { geo_locations: { cities: [{ key: "313044", radius: 21, distance_unit: "mile" }] } } }, desiredFor(spec, audiences, "px", 3)).find((x) => x.field === "geo")!.from).toBe("city 313044 r=21mi");
  });
  test("projected month adds bases and ramps", () => {
    expect(projectedMonthChf({ dailyChf: { cold: 3, warm: 3, intent: 2, buyers: 2 }, rampsChf: { warm: 7, intent: 3, buyers: 6 }, rampDays: 3, showsPerMonth: 4 })).toBe(496);
    expect(projectedMonthChf({ dailyChf: { old: 5 }, rampsChf: {}, rampDays: 3, showsPerMonth: 4 })).toBe(152);
  });
  test("cap refuses a rise over the cap and allows a fall", () => {
    expect(capAllows(1975, 496, 500).ok).toBe(true);
    expect(capAllows(1975, 648, 500).ok).toBe(true);     // over the cap, but lower than today
    expect(capAllows(300, 648, 500).ok).toBe(false);     // would raise the month over the cap
    expect(capAllows(300, 648, 500).reason).toMatch(/exceed/);
  });
});

describe("Meta recommendations", () => {
  const names = new Map([["1", "adset cold"], ["2", "adset warm"], ["3", "adset intent"], ["4", "adset old"], ["90", "ad cold-C3"]]);
  const groups = [{ recommendations: ["3", "2", "1", "4"].map((id, i) => ({ object_ids: [id], type: "REELS_PC_RECOMMENDATION", recommendation_stage: "mid_flight_recommendation", recommendation_time: "2026-09-13T18:25:0" + i + "+0000", recommendation_content: { lift_estimate: "8% lower cost per result", body: "Including a fullscreen  vertical video (9:16)\n with audio", opportunity_score_lift: "2" }, url: "https://adsmanager.facebook.com/x?recommendation_hash_string=" + id })) }];
  const langItem = { code: 1942001, title: "Targeted Languages Don't Match Text", message: "The languages you're targeting are different", importance: "HIGH", confidence: "LOW", blame_field: "creative" };
  test("account groups flatten to four named rows with date, lift and link", () => {
    const rows = collectRecommendations(groups, [], names);
    expect(rows.length).toBe(4);
    expect(rows.map((r) => r.objects[0])).toEqual(["adset intent", "adset warm", "adset cold", "adset old"]);
    expect(rows[0].since).toBe("2026-09-13");
    expect(rows[0].lift).toBe("8% lower cost per result");
    expect(rows[0].text).toBe("Including a fullscreen vertical video (9:16) with audio");
    expect(rows[0].url).toContain("recommendation_hash_string=3");
    expect(rows.every((r) => r.source === "account" && r.accepted === "")).toBe(true);
  });
  test("an object item on an ad gets source object, the ad name and the code", () => {
    const rows = collectRecommendations([], [{ id: "90", recommendations: [langItem] }, { id: "1", recommendations: [] }, { id: "2" }], names);
    expect(rows.length).toBe(1);
    expect(rows[0]).toMatchObject({ source: "object", type: "1942001", objects: ["ad cold-C3"], object_ids: ["90"], since: "", url: "", lift: "importance HIGH, confidence LOW" });
    expect(rows[0].text).toBe("Targeted Languages Don't Match Text: The languages you're targeting are different");
  });
  test("an unknown id stays raw, a unix time becomes a date", () => {
    const rows = collectRecommendations([{ recommendations: [{ object_ids: ["777"], type: "X", recommendation_time: 1757786701 }] }], [], names);
    expect(rows[0].objects).toEqual(["777"]);
    expect(rows[0].since).toBe("2025-09-13");
    expect(rows[0].lift).toBe("");
  });
  test("the same type on the same object from both surfaces is one row", () => {
    const rows = collectRecommendations(groups, [{ id: "1", recommendations: [{ code: "REELS_PC_RECOMMENDATION", title: "echo" }] }], names);
    expect(rows.length).toBe(4);
  });
  test("accepted items carry the reason and sort last", () => {
    const rows = collectRecommendations(groups, [{ id: "90", recommendations: [langItem] }], names, [
      { type: "REELS_PC_RECOMMENDATION", object: "adset cold", reason: "clips pending" },
      { type: "1942001", object: "ad cold-C3", reason: "German on purpose" },
    ]);
    expect(rows.length).toBe(5);
    expect(rows.slice(0, 3).every((r) => r.accepted === "")).toBe(true);
    expect(rows[3]).toMatchObject({ objects: ["adset cold"], accepted: "clips pending" });
    expect(rows[4]).toMatchObject({ objects: ["ad cold-C3"], accepted: "German on purpose" });
  });
  test("render distinguishes none from unavailable", () => {
    expect(renderRecommendations([]).join("\n")).toContain("none (the API exposes a subset");
    const u = renderRecommendations([], "(#100) Tried accessing nonexisting field | x").join("\n");
    expect(u).toContain("unavailable this run: (#100) Tried accessing nonexisting field \\| x");
    expect(u).not.toContain("none (");
  });
  test("render prints the coverage line, a header, one row per item, pipes escaped, decision and link", () => {
    const rows = collectRecommendations(groups, [{ id: "90", recommendations: [{ code: 1, title: "T | U", message: "M" }] }], names, [{ type: "1", object: "ad cold-C3", reason: "ok" }]);
    const L = renderRecommendations(rows);
    expect(L[2]).toBe("5 item(s) on the API; Ads Manager may show more, not every pill reaches the API.");
    const tableRows = L.filter((l) => l.startsWith("| ") && !l.startsWith("| Object"));
    expect(tableRows.length).toBe(5);
    expect(tableRows[0]).toContain("| open | [Ads Manager](");
    expect(tableRows[4]).toBe("| ad cold-C3 | 1 |  |  | T \\| U: M | accepted: ok |  |");
  });
});

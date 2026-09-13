// Tests for script/meta-lists.ts: CSV parsing, ticket dates, the buyer merge,
// the recent/lapsed split and Meta's output columns. No files, no network.
import { describe, expect, test } from "bun:test";
import {
  META_HEADER, buyersFrom, countryFor, csvField, metaRows, monthsBefore, normEmail, parseCsv, parseEventDate, parseRecords, split, ticketsFrom, toCsv,
} from "../meta-lists";

describe("parseCsv", () => {
  test("quoted commas, doubled quotes, CRLF and a BOM", () => {
    const text = '﻿a,b\r\n"x, y","he said ""hi"""\r\nplain,2\n';
    expect(parseCsv(text)).toEqual([["a", "b"], ["x, y", 'he said "hi"'], ["plain", "2"]]);
  });
  test("a newline inside quotes stays in the field", () => {
    expect(parseCsv('a\n"line1\nline2"\n')).toEqual([["a"], ["line1\nline2"]]);
  });
  test("records keyed by trimmed header", () => {
    expect(parseRecords(" E-Mail ,Price\nA@B.ch,10\n")).toEqual([{ "E-Mail": "A@B.ch", Price: "10" }]);
  });
  test("csvField quotes only when needed and toCsv ends with a newline", () => {
    expect(csvField("Zürich")).toBe("Zürich");
    expect(csvField("Ottawa, Ontario")).toBe('"Ottawa, Ontario"');
    expect(csvField('O"Brien')).toBe('"O""Brien"');
    expect(toCsv(["a"], [["1"]])).toBe("a\n1\n");
  });
});

describe("parseEventDate", () => {
  test("DD/MM/YYYY becomes ISO", () => expect(parseEventDate("17/04/2022")).toBe("2022-04-17"));
  test("single-digit day and month are padded", () => expect(parseEventDate("3/9/2026")).toBe("2026-09-03"));
  test("ISO passes through", () => expect(parseEventDate("2026-04-16")).toBe("2026-04-16"));
  test("anything else is null", () => {
    expect(parseEventDate("")).toBeNull();
    expect(parseEventDate("April 2022")).toBeNull();
  });
});

test("normEmail trims and lowercases", () => expect(normEmail("  Ann@Example.CH ")).toBe("ann@example.ch"));

test("countryFor: four digits is CH, the Liechtenstein range LI, anything else is left for Meta", () => {
  expect(countryFor("8004")).toBe("CH");
  expect(countryFor("9490")).toBe("LI");
  expect(countryFor("9484")).toBe("CH");
  expect(countryFor("9499")).toBe("CH");
  expect(countryFor("6020", "Innsbruck")).toBe("");
  expect(countryFor("6020", "Zürich")).toBe("CH");
  expect(countryFor("80469")).toBe("");
  expect(countryFor("N1 3FL")).toBe("");
  expect(countryFor("")).toBe("");
});

test("monthsBefore clamps to the end of the month", () => {
  expect(monthsBefore("2026-09-13", 12)).toBe("2025-09-13");
  expect(monthsBefore("2026-05-31", 3)).toBe("2026-02-28");
  expect(monthsBefore("2026-01-15", 1)).toBe("2025-12-15");
});

const rows = [
  { "Event Date": "17/04/2022", "First Name": "Ann ", "Last Name": "Old", "E-Mail": "Ann@Example.ch", Postcode: "8004", City: "Zürich ", Price: "10" },
  { "Event Date": "2026-05-07", "First Name": "Anna", "Last Name": "New", "E-Mail": "ann@example.ch ", Postcode: "8050", City: "Zurich", Price: "5" },
  { "Event Date": "10/09/2026", "First Name": "Bob", "Last Name": "Bern", "E-Mail": "bob@example.ch", Postcode: "80469", City: "München", Price: "17" },
  { "Event Date": "not a date", "First Name": "Cy", "Last Name": "Bad", "E-Mail": "cy@example.ch", Postcode: "8000", City: "Zürich", Price: "10" },
  { "Event Date": "01/01/2024", "First Name": "No", "Last Name": "Mail", "E-Mail": "", Postcode: "8000", City: "Zürich", Price: "10" },
  { "Event Date": "01/01/2024", "First Name": "Dee", "Last Name": "Gone", "E-Mail": "dee@example.ch", Postcode: "8001", City: "Zürich", Price: "0" },
];

describe("tickets and buyers", () => {
  const { tickets, badDates, noEmail } = ticketsFrom(rows);
  const buyers = buyersFrom(tickets);
  test("bad dates and missing emails are counted, not kept", () => {
    expect(badDates).toBe(1);
    expect(noEmail).toBe(1);
    expect(tickets.length).toBe(4);
  });
  test("one buyer per email, details from the newest ticket, value summed", () => {
    const ann = buyers.get("ann@example.ch")!;
    expect(ann.fn).toBe("Anna");
    expect(ann.ln).toBe("New");
    expect(ann.ct).toBe("Zurich");
    expect(ann.zip).toBe("8050");
    expect(ann.country).toBe("CH");
    expect(ann.value).toBe(15);
    expect(ann.last).toBe("2026-05-07");
    expect(ann.shows).toBe(2);
  });
  test("split honours the Mailchimp filter and the window", () => {
    const subscribed = new Set(["ann@example.ch", "dee@example.ch", "zed@example.ch"]);
    const s = split(buyers, subscribed, "2026-09-13", 12);
    expect(s.cutoff).toBe("2025-09-13");
    expect(s.recent.map((b) => b.email)).toEqual(["ann@example.ch"]);
    expect(s.lapsed.map((b) => b.email)).toEqual(["dee@example.ch"]);
    expect(s.neverBought).toBe(1);
    // bob bought but is not subscribed: in neither file
    expect([...s.recent, ...s.lapsed].some((b) => b.email === "bob@example.ch")).toBe(false);
  });
  test("a ticket for a show after the as-of date still counts as recent", () => {
    const { tickets: t } = ticketsFrom([{ "Event Date": "24/12/2026", "First Name": "Eve", "Last Name": "Early", "E-Mail": "eve@example.ch", Postcode: "8001", City: "Zürich", Price: "12.5" }]);
    const s = split(buyersFrom(t), new Set(["eve@example.ch"]), "2026-09-13", 12);
    expect(s.recent.map((b) => b.email)).toEqual(["eve@example.ch"]);
    expect(metaRows(s.recent)[0][6]).toBe("12.5");
  });
  test("value is rounded to cents, no float tails", () => {
    const { tickets: t } = ticketsFrom([0.1, 0.2].map((p) => ({ "Event Date": "01/01/2026", "First Name": "F", "Last Name": "L", "E-Mail": "f@example.ch", Postcode: "8001", City: "Z", Price: String(p) })));
    const s = split(buyersFrom(t), new Set(["f@example.ch"]), "2026-09-13", 12);
    expect(metaRows(s.recent)[0][6]).toBe("0.3");
  });
  test("a shorter window moves ann to lapsed", () => {
    const s = split(buyers, new Set(["ann@example.ch"]), "2026-09-13", 3);
    expect(s.recent).toEqual([]);
    expect(s.lapsed.length).toBe(1);
  });
  test("Meta rows carry the exact header and plain numbers", () => {
    expect(META_HEADER).toEqual(["email", "fn", "ln", "ct", "zip", "country", "value"]);
    const s = split(buyers, new Set(["ann@example.ch", "bob@example.ch"]), "2026-09-13", 12);
    expect(metaRows(s.recent)).toEqual([
      ["ann@example.ch", "Anna", "New", "Zurich", "8050", "CH", "15"],
      ["bob@example.ch", "Bob", "Bern", "München", "80469", "", "17"],
    ]);
  });
});

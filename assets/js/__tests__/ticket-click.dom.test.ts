// Tests for assets/js/ticket-click.js — on-site Get Tickets click tracking.
// Unit: the pure helpers (vendor host match, show slug source). DOM: run the whole
// script against a minimal page and assert exactly one ticket_click lands on
// window.dataLayer for a vendor link, and nothing for an internal button.
import { describe, expect, test, beforeEach } from "bun:test";
import { loadScript, runScript } from "./helpers";

const tc = require("../ticket-click.js") as {
  isVendor: (href: string) => boolean;
  showFor: (link: Element) => string;
  daysToShow: (showDate: string, today: string) => string;
  showParams: (link: Element, today: string) => Record<string, unknown>;
};

const SRC = loadScript("ticket-click.js");

describe("ticket-click • isVendor", () => {
  test("eventfrog / eventbrite hosts count, including subdomains", () => {
    expect(tc.isVendor("https://eventfrog.ch/en/p/groups/x-123.html")).toBe(true);
    expect(tc.isVendor("https://www.eventbrite.com/e/x-456")).toBe(true);
  });
  test("our own pages and look-alike hosts do not", () => {
    expect(tc.isVendor("/calendar/")).toBe(false);
    expect(tc.isVendor("https://eventfrog.ch.evil.com/")).toBe(false);
    expect(tc.isVendor("https://noteventfrog.ch/")).toBe(false);
  });
});

describe("ticket-click • DOM: one event per vendor click", () => {
  // The script registers ONE document-level listener; the document persists across
  // tests, so run it once here (a per-test run would stack listeners and double-count).
  document.addEventListener("click", (e) => e.preventDefault());   // swallow happy-dom navigation
  runScript(SRC);

  beforeEach(() => {
    (window as unknown as { dataLayer?: unknown[] }).dataLayer = [];
    document.body.innerHTML = `
      <a id="buy" class="btn-ticket btn-ticket--xl" href="https://eventfrog.ch/en/p/groups/brew-1.html" data-show="comedybrew" data-venue="robins" data-date="2099-12-31" data-price="10">Get Tickets</a>
      <a id="cal" class="btn-ticket btn-ticket--xl" href="/calendar/">Full Calendar</a>
      <a id="plain" href="https://eventfrog.ch/other.html">not a button</a>
      <div class="iyf-calendar"><table><tr>
        <td>Sep 2</td><td>Wed</td>
        <td><a href="https://inyourfacecomedy.ch/jackpotcomedy/">Jackpot Comedy</a></td>
        <td>blurb</td>
        <td><a id="calrow" href="https://eventfrog.ch/en/p/theatre-stage/jackpot-1.html">Get Tickets</a></td>
      </tr></table></div>`;
  });

  function events(): unknown[][] {
    const dl = (window as unknown as { dataLayer: IArguments[] }).dataLayer;
    return dl.map((a) => Array.from(a));
  }

  test("vendor ticket button → ticket_click with show + beacon transport", () => {
    (document.getElementById("buy") as HTMLElement).click();
    const evs = events().filter((e) => e[0] === "event" && e[1] === "ticket_click");
    expect(evs.length).toBe(1);
    const params = evs[0][2] as Record<string, string>;
    expect(params.show).toBe("comedybrew");
    expect(params.destination).toContain("eventfrog.ch");
    expect(params.transport_type).toBe("beacon");
    // Show context from the button's data attributes (ANALYTICS.md).
    expect(params.venue).toBe("robins");
    expect(params.show_date).toBe("2099-12-31");
    expect(params.days_to_show).toBe("31+");   // data-date is 2099-12-31
    expect(params.price_chf as unknown).toBe(10);
    expect(params.value as unknown).toBe(10);
    expect(params.currency).toBe("CHF");
  });

  test("calendar row link sends (unknown) sentinels, never inherits a sticky set value", () => {
    (document.getElementById("calrow") as HTMLElement).click();
    const params = events().filter((e) => e[1] === "ticket_click")[0][2] as Record<string, unknown>;
    expect(params.venue).toBe("(unknown)");
    expect(params.show_date).toBe("(unknown)");
    expect(params.days_to_show).toBe("(unknown)");
    expect("price_chf" in params).toBe(false);
  });

  test("calendar row link (no class, no data-show) → show read from the row's show link", () => {
    (document.getElementById("calrow") as HTMLElement).click();
    const evs = events().filter((e) => e[1] === "ticket_click");
    expect(evs.length).toBe(1);
    expect((evs[0][2] as Record<string, string>).show).toBe("jackpotcomedy");
  });

  test("internal button and non-button vendor link → nothing", () => {
    (document.getElementById("cal") as HTMLElement).click();
    (document.getElementById("plain") as HTMLElement).click();
    expect(events().filter((e) => e[1] === "ticket_click").length).toBe(0);
  });
});

describe("ticket-click • show context helpers", () => {
  test("daysToShow buckets match go-redirect.js", () => {
    const today = "2026-08-26";
    expect(tc.daysToShow("2026-08-26", today)).toBe("00");
    expect(tc.daysToShow("2026-08-27", today)).toBe("01");
    expect(tc.daysToShow("2026-08-29", today)).toBe("02-03");
    expect(tc.daysToShow("2026-09-02", today)).toBe("04-07");
    expect(tc.daysToShow("2026-09-09", today)).toBe("08-14");
    expect(tc.daysToShow("2026-09-25", today)).toBe("15-30");
    expect(tc.daysToShow("2026-09-26", today)).toBe("31+");
    expect(tc.daysToShow("2026-08-01", today)).toBe("past");
    expect(tc.daysToShow("", today)).toBe("(unknown)");
  });

  test("bucket labels sort in chronological order alphabetically (GA sorts strings)", () => {
    const labels = ["00", "01", "02-03", "04-07", "08-14", "15-30", "31+"];
    expect([...labels].sort()).toEqual(labels);
  });

  test("showParams always sends the three dimension fields and ignores a non-numeric price", () => {
    const a = document.createElement("a");
    a.setAttribute("data-date", "2026-09-03");
    a.setAttribute("data-price", "free");
    expect(tc.showParams(a, "2026-08-26")).toEqual({ venue: "(unknown)", show_date: "2026-09-03", days_to_show: "08-14" });
    a.setAttribute("data-venue", "otro");
    a.setAttribute("data-price", "0");
    expect(tc.showParams(a, "2026-08-26")).toEqual({ venue: "otro", show_date: "2026-09-03", days_to_show: "08-14", price_chf: 0, value: 0, currency: "CHF" });
  });
});

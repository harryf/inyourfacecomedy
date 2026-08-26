// Tests for assets/js/ticket-click.js — on-site Get Tickets click tracking.
// Unit: the pure helpers (vendor host match, show slug source). DOM: run the whole
// script against a minimal page and assert exactly one ticket_click lands on
// window.dataLayer for a vendor link, and nothing for an internal button.
import { describe, expect, test, beforeEach } from "bun:test";
import { loadScript, runScript } from "./helpers";

const tc = require("../ticket-click.js") as {
  isVendor: (href: string) => boolean;
  showFor: (link: Element) => string;
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
      <a id="buy" class="btn-ticket btn-ticket--xl" href="https://eventfrog.ch/en/p/groups/brew-1.html" data-show="comedybrew">Get Tickets</a>
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

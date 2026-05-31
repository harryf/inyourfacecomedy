// Pure-logic unit tests for assets/js/comedian-lineup.js.
// These import the script directly: in a CommonJS/test context its seam exports
// the stateless helpers and returns before reading location or the DOM.
import { describe, expect, test } from "bun:test";

const cl = require("../comedian-lineup.js") as {
  norm: (s: string) => string;
  splitList: (raw: string) => string[];
  safeUrl: (u: string) => string | null;
  safeImg: (u: string) => string | null;
  showDate: (iso: string) => string | null;
  splitTitle: (t: string) => { primary: string; secondary: string };
};

describe("comedian-lineup • norm (slug matching)", () => {
  test("is case- and separator-insensitive", () => {
    expect(cl.norm("Harry F.cks")).toBe(cl.norm("harryf-cks"));
    expect(cl.norm("Pulp-Non-Fiction")).toBe("pulpnonfiction");
    expect(cl.norm("PulpNonFiction")).toBe("pulpnonfiction");
  });
  test("empty / nullish collapses to empty string", () => {
    expect(cl.norm("")).toBe("");
    expect(cl.norm(undefined as unknown as string)).toBe("");
  });
});

describe("comedian-lineup • safeUrl (ticket-link validator)", () => {
  test("accepts http(s) absolute URLs", () => {
    expect(cl.safeUrl("https://tickets.example/brexiles")).toBe("https://tickets.example/brexiles");
    expect(cl.safeUrl("http://x.test/y")).toBe("http://x.test/y");
  });
  test("rejects dangerous and relative schemes", () => {
    expect(cl.safeUrl("javascript:alert(1)")).toBeNull();
    expect(cl.safeUrl("data:text/html,<script>")).toBeNull();
    expect(cl.safeUrl("//evil.example/x")).toBeNull();
    expect(cl.safeUrl("/relative/path")).toBeNull();
    expect(cl.safeUrl("")).toBeNull();
  });
});

describe("comedian-lineup • safeImg (feature-image validator)", () => {
  test("accepts only same-origin /assets image paths", () => {
    expect(cl.safeImg("/assets/img/shows/brexiles.jpg")).toBe("/assets/img/shows/brexiles.jpg");
    expect(cl.safeImg("assets/img/x.png")).toBe("/assets/img/x.png"); // leading slash added
    expect(cl.safeImg("/assets/img/y.webp")).toBe("/assets/img/y.webp");
  });
  test("rejects off-origin, scheme'd, and non-image paths", () => {
    expect(cl.safeImg("https://evil.example/x.png")).toBeNull();
    expect(cl.safeImg("//evil/x.png")).toBeNull();
    expect(cl.safeImg("javascript:x.png")).toBeNull();
    expect(cl.safeImg("/assets/logo.svg")).toBeNull(); // svg not in allowlist
    expect(cl.safeImg("/etc/passwd")).toBeNull();
    expect(cl.safeImg("")).toBeNull();
  });
});

describe("comedian-lineup • showDate (stale-date hiding + format)", () => {
  test("formats a future date as 'Wkd · D Mon'", () => {
    expect(cl.showDate("2030-06-15T12:00:00+00:00")).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) · 15 Jun$/);
  });
  test("returns null for a past date (does not advertise a finished show)", () => {
    expect(cl.showDate("2000-01-01T00:00:00+00:00")).toBeNull();
  });
  test("returns null for empty / unparseable input", () => {
    expect(cl.showDate("")).toBeNull();
    expect(cl.showDate("not-a-date")).toBeNull();
  });
});

describe("comedian-lineup • splitTitle (post.liquid title contract)", () => {
  test("normalizes ' - ' to a bullet and splits primary/secondary", () => {
    expect(cl.splitTitle("Brexiles - The Final Countdown")).toEqual({
      primary: "Brexiles",
      secondary: "The Final Countdown",
    });
  });
  test("splits on an explicit bullet, joining extra segments with ' · '", () => {
    expect(cl.splitTitle("A • B • C")).toEqual({ primary: "A", secondary: "B · C" });
  });
  test("a plain title has no secondary", () => {
    expect(cl.splitTitle("Comedy Brew")).toEqual({ primary: "Comedy Brew", secondary: "" });
  });
});

describe("comedian-lineup • safeUrl/safeImg adversarial (allowlist tightness)", () => {
  test("safeUrl rejects scheme-smuggling and whitespace tricks", () => {
    expect(cl.safeUrl("JavaScript:alert(1)")).toBeNull(); // mixed case
    expect(cl.safeUrl(" javascript:alert(1)")).toBeNull(); // leading space
    expect(cl.safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(cl.safeUrl("file:///etc/passwd")).toBeNull();
    expect(cl.safeUrl("HTTPS://ok.example/x")).toBe("https://ok.example/x"); // case-insensitive accept
  });
  test("safeImg rejects query strings, fragments, and double extensions", () => {
    expect(cl.safeImg("/assets/x.png?onerror=alert(1)")).toBeNull();
    expect(cl.safeImg("/assets/x.png#javascript:alert(1)")).toBeNull();
    expect(cl.safeImg("/assets/x.png.svg")).toBeNull(); // svg via double-ext
    expect(cl.safeImg("/assets/x.PNG")).toBe("/assets/x.PNG"); // case-insensitive ext accept
  });
});

describe("comedian-lineup • splitList", () => {
  test("trims whitespace and drops empties", () => {
    expect(cl.splitList("a, b ,,c")).toEqual(["a", "b", "c"]);
    expect(cl.splitList(" solo ")).toEqual(["solo"]);
    expect(cl.splitList("")).toEqual([]);
  });
});

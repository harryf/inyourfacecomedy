// DOM-integration tests for assets/js/comedian-lineup.js — "testing by calling the URL scheme".
// Each test builds the /comedians/ page DOM, sets window.location, runs the whole script,
// and asserts the page reshaped exactly as SHOW_PROMO_LINKS.md documents.
import { describe, expect, test, spyOn, beforeEach, afterEach } from "bun:test";
import {
  buildComediansDOM,
  runScript,
  loadScript,
  setURL,
  renderedSlugs,
  FUTURE_ISO,
  PAST_ISO,
  type ShowCat,
} from "./helpers";

const SRC = loadScript("comedian-lineup.js");

const SHOWS: ShowCat[] = [
  {
    slug: "brexiles",
    title: "Brexiles • The Final Countdown",
    desc: "An evening of exit comedy.",
    url: "/brexiles/",
    tickets: "https://tickets.example/brexiles",
    img: "/assets/img/shows/brexiles.jpg",
    next: FUTURE_ISO,
  },
];
const ROSTER = ["woocash", "joana", "nik", "omar", "zeina", "harryf.cks"];

let warnSpy: ReturnType<typeof spyOn>;
beforeEach(() => {
  warnSpy = spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe("comedian-lineup • no params (passthrough)", () => {
  test("leaves the full roster and the default hero untouched", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("");
    runScript(SRC);
    expect(renderedSlugs()).toEqual(ROSTER); // every card, original order
    expect(document.querySelector("#main h1")?.textContent).toBe("Comedians");
    expect(document.querySelector("#main")?.classList.contains("show-banner")).toBe(false);
  });
});

describe("comedian-lineup • ?show= (promo hero from catalog)", () => {
  test("turns #main into the show hero, sourced only from the catalog", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=brexiles");
    runScript(SRC);
    const hero = document.getElementById("main")!;
    expect(hero.classList.contains("show-banner")).toBe(true);
    expect(hero.classList.contains("iyf-hero--dim")).toBe(true);
    expect(hero.querySelector("h1.iyf-hero__title")?.textContent).toBe("Brexiles");
    expect(hero.querySelector(".iyf-hero__eyebrow")?.textContent).toMatch(/17 Jun/);
    const ticket = hero.querySelector("a.btn-ticket") as HTMLAnchorElement | null;
    expect(ticket?.getAttribute("href")).toBe("https://tickets.example/brexiles");
    expect(ticket?.textContent).toBe("Get Tickets");
    expect(hero.querySelector("a.btn-ghost")?.getAttribute("href")).toBe("/brexiles/");
  });

  test("unknown show slug → no hero change + console warning", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=does-not-exist");
    runScript(SRC);
    expect(document.querySelector("#main h1")?.textContent).toBe("Comedians");
    expect(document.querySelector("#main")?.classList.contains("show-banner")).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("comedian-lineup • lineup filtering", () => {
  test("?lineup=a,b,c keeps exactly those cards, in that order", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?lineup=nik,woocash,joana");
    runScript(SRC);
    expect(renderedSlugs()).toEqual(["nik", "woocash", "joana"]);
  });

  test("?host=&first=&second= renders the three labelled sections in order", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?host=harryf.cks&first=joana,nik&second=omar,zeina");
    runScript(SRC);
    const titles = Array.from(document.querySelectorAll(".iyf-lineup-section__title")).map(
      (h) => h.textContent,
    );
    expect(titles).toEqual(["Host", "First Half", "Second Half"]);
    expect(renderedSlugs()).toEqual(["harryf.cks", "joana", "nik", "omar", "zeina"]);
  });

  test("?headliner= features the comedian first in a headliner section", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?headliner=woocash&lineup=joana,nik");
    runScript(SRC);
    const headliner = document.querySelector(".iyf-lineup-section--headliner");
    expect(headliner).not.toBeNull();
    expect(headliner!.querySelector('[data-slug="woocash"]')).not.toBeNull();
    expect(headliner!.querySelector(".iyf-comedian-grid--headliner")).not.toBeNull();
    expect(renderedSlugs()[0]).toBe("woocash");
  });

  test("a lineup slug with no matching card is skipped + warned, not rendered", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?lineup=joana,ghostcomedian,nik");
    runScript(SRC);
    expect(renderedSlugs()).toEqual(["joana", "nik"]);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe("comedian-lineup • ?thankyou (after-show mode)", () => {
  test("swaps to follow/review + More Shows CTAs with the hero intact", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=brexiles&thankyou&headliner=woocash");
    runScript(SRC);
    const hero = document.getElementById("main")!;
    expect(hero.classList.contains("show-banner")).toBe(true); // hero styling unchanged
    const buttons = Array.from(hero.querySelectorAll("a")).map((a) => a.textContent);
    expect(buttons).toContain("Follow us & drop a review");
    expect(buttons).toContain("More Shows");
    const follow = Array.from(hero.querySelectorAll("a")).find(
      (a) => a.textContent === "Follow us & drop a review",
    ) as HTMLAnchorElement;
    expect(follow.getAttribute("href")).toBe("#footer");
    const more = Array.from(hero.querySelectorAll("a")).find(
      (a) => a.textContent === "More Shows",
    ) as HTMLAnchorElement;
    expect(more.getAttribute("href")).toBe("/");
    expect(document.querySelector(".iyf-lineup-leadin")?.textContent).toBe(
      "Go give your favourites a follow",
    );
  });
});

describe("comedian-lineup • anti-spam: hostile catalog data is sanitized in the rendered hero", () => {
  test("a poisoned ticket/image in the catalog never reaches the DOM", () => {
    const hostile: ShowCat[] = [
      {
        slug: "evilshow",
        title: "Evil Show",
        url: "/evilshow/",
        tickets: "javascript:alert(document.cookie)",
        img: "https://evil.example/track.png",
        next: FUTURE_ISO,
      },
    ];
    buildComediansDOM({ shows: hostile, comedians: ROSTER });
    setURL("?show=evilshow");
    runScript(SRC);
    const hero = document.getElementById("main")!;
    expect(hero.querySelector("h1.iyf-hero__title")?.textContent).toBe("Evil Show"); // hero still builds
    expect(hero.querySelector("a.btn-ticket")).toBeNull(); // javascript: ticket dropped
    expect(hero.style.backgroundImage).toBe(""); // off-origin image never set
  });
});

describe("comedian-lineup • stale-date hiding in the hero", () => {
  test("a past show renders the hero but omits the date eyebrow", () => {
    const past: ShowCat[] = [
      { slug: "oldshow", title: "Old Show", url: "/oldshow/", tickets: "https://t.example/o", next: PAST_ISO },
    ];
    buildComediansDOM({ shows: past, comedians: ROSTER });
    setURL("?show=oldshow");
    runScript(SRC);
    const hero = document.getElementById("main")!;
    expect(hero.querySelector("h1.iyf-hero__title")?.textContent).toBe("Old Show");
    expect(hero.querySelector(".iyf-hero__eyebrow")).toBeNull(); // never advertise a finished show's date
  });
});

describe("comedian-lineup • a card listed twice is placed once (first mention wins)", () => {
  test("?headliner=w&lineup=w,joana renders w exactly once", () => {
    buildComediansDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?headliner=woocash&lineup=woocash,joana");
    runScript(SRC);
    const slugs = renderedSlugs();
    expect(slugs.filter((s) => s === "woocash")).toHaveLength(1);
    expect(slugs[0]).toBe("woocash"); // in the headliner (first) group
    // and the unnamed rest of the roster is dropped, not left in a residual grid
    expect(slugs.sort()).toEqual(["joana", "woocash"]);
  });
});

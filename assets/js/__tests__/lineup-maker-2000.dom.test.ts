// DOM-integration tests for assets/js/lineup-maker-2000.js (the /lineup/ organizer wizard).
// Builds the #lineup-lab root + the two build-time catalogs, sets the URL to a wizard
// stage, runs the whole IIFE, and asserts the rendered step / share links.
import { describe, expect, test, beforeEach } from "bun:test";
import { buildLineupDOM, runScript, loadScript, setURL, FUTURE_ISO, type ShowCat } from "./helpers";

const SRC = loadScript("lineup-maker-2000.js");

const SHOWS: ShowCat[] = [
  { slug: "latershow", title: "Later Show", next: "2030-12-01T19:00:00+00:00", tickets: "https://t.example/l" },
  { slug: "soonshow", title: "Soon Show", next: "2030-06-01T19:00:00+00:00", tickets: "https://t.example/s" },
];
const ROSTER = [
  { slug: "aaa", name: "Aaa Comedian" },
  { slug: "bbb", name: "Bbb Comedian" },
  { slug: "ccc", name: "Ccc Comedian" },
];

beforeEach(() => {
  (window as unknown as { __lineupMakerLastURL?: string }).__lineupMakerLastURL = undefined;
});

describe("lineup-maker-2000 • no root element", () => {
  test("no-ops when #lineup-lab is absent", () => {
    document.body.innerHTML = "<div>unrelated page</div>";
    setURL("?show=soonshow", "/lineup/");
    expect(() => runScript(SRC)).not.toThrow();
    expect(document.querySelector(".lineup-lab__title")).toBeNull();
  });
});

describe("lineup-maker-2000 • seam is invisible in production (ISC-9/ISC-10)", () => {
  test("running with no `module` auto-executes the IIFE and only the renamed hook leaks", () => {
    // new Function runs in global scope where `module` is undefined — exactly the
    // production <script defer> path. No manual render() is called.
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("", "/lineup/");
    runScript(SRC);
    // production IIFE actually rendered (proves the seam did NOT swallow the run)
    expect(document.querySelector(".lineup-lab__title")?.textContent).toBe("🎤 Lineup Maker 2000");
    // the old hook name must never appear; only the renamed one is used
    expect("__lineupLabLastURL" in window).toBe(false);
    (document.querySelector(".lineup-lab__show-btn") as HTMLElement).click();
    expect("__lineupMakerLastURL" in window).toBe(true);
  });
});

describe("lineup-maker-2000 • header (title + manual link)", () => {
  // Regression guard. The "🎤 Lineup Maker 2000" header once vanished after the
  // title was wrapped in a flex row: the theme's `.site-header` is a full-width
  // `float: left` that is never cleared, so a flex first-child collapsed into the
  // sliver beside the float and clipped the title to ~0 width. The pixel-level
  // squeeze isn't observable in happy-dom (no float layout), so the fix lives in
  // CSS (`.lineup-lab { clear: both }`). These tests instead pin the header
  // CONTRACT: the title element renders with its exact text on every stage, and
  // the Manual link is present with a safe new-tab target.
  test("stage 1 header carries the title and a Manual link", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("", "/lineup/");
    runScript(SRC);
    const head = document.querySelector(".lineup-lab__head");
    expect(head).not.toBeNull();
    const title = head!.querySelector(".lineup-lab__title");
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe("🎤 Lineup Maker 2000");
    const manual = head!.querySelector("a.lineup-lab__manual") as HTMLAnchorElement;
    expect(manual).not.toBeNull();
    expect(manual.getAttribute("href")).toBe("/lineup-maker-2000-manual/");
    expect(manual.getAttribute("target")).toBe("_blank");
    expect(manual.getAttribute("rel")).toBe("noopener");
    expect(manual.textContent).toContain("Manual");
  });

  test("the title and Manual link also render on the order stage", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&lineup=aaa,bbb&stage=order", "/lineup/");
    runScript(SRC);
    expect(document.querySelector(".lineup-lab__title")?.textContent).toBe("🎤 Lineup Maker 2000");
    expect(document.querySelector("a.lineup-lab__manual")).not.toBeNull();
  });
});

describe("lineup-maker-2000 • show picker (stage 1)", () => {
  test("lists every catalog show, soonest first, under the Maker 2000 title", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("", "/lineup/");
    runScript(SRC);
    expect(document.querySelector(".lineup-lab__title")?.textContent).toBe("🎤 Lineup Maker 2000");
    const names = Array.from(document.querySelectorAll(".lineup-lab__show-name")).map((n) => n.textContent);
    expect(names).toEqual(["Soon Show", "Later Show"]); // soonest upcoming first
  });

  test("clicking a show advances the wizard via the renamed test hook", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("", "/lineup/");
    runScript(SRC);
    const firstShow = document.querySelector(".lineup-lab__show-btn") as HTMLElement;
    firstShow.click();
    const last = (window as unknown as { __lineupMakerLastURL?: string }).__lineupMakerLastURL;
    expect(last).toContain("show=soonshow");
    expect(last).toContain("stage=format");
  });
});

describe("lineup-maker-2000 • order stage", () => {
  test("a bill slug absent from the catalog triggers the dropped-act notice", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&lineup=aaa,ghostact,bbb&stage=order", "/lineup/");
    runScript(SRC);
    const notice = document.querySelector(".lineup-lab__notice");
    expect(notice).not.toBeNull();
    expect(notice!.textContent).toContain("1"); // exactly one act left off
  });

  test("setting a performer as host moves them out of the order and into the share link", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&lineup=aaa,bbb,ccc&stage=order", "/lineup/");
    runScript(SRC);
    // click the "set as host" control on bbb's row
    const hostBtn = document.querySelector(
      '.lineup-lab__row[data-slug="bbb"] button[aria-label="Set as host"]',
    ) as HTMLElement;
    expect(hostBtn).not.toBeNull();
    hostBtn.click();
    // bbb is now in the host slot, not the numbered running order
    expect(document.querySelector('.lineup-lab__rows [data-slug="bbb"]')).toBeNull();
    expect(document.querySelector(".lineup-lab__hostpill")?.textContent).toContain("Bbb Comedian");
    // and every share link now carries host=bbb
    const previews = Array.from(document.querySelectorAll("a.lineup-lab__preview")).map((a) =>
      a.getAttribute("href"),
    );
    expect(previews.length).toBeGreaterThan(0);
    expect(previews.some((h) => h && /host=bbb/.test(h))).toBe(true);
    // ...and bbb must NOT remain in the numbered running-order params (host has its own slot)
    expect(previews.every((h) => !!h && !/[?&](lineup|first|second)=[^&]*bbb/.test(h))).toBe(true);
  });

  test("anti-spam: the running order resolves only to canonical catalog slugs", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    // ghostact is not in the catalog; AAA is a case/separator variant of aaa (dupe)
    setURL("?show=soonshow&type=flat&lineup=aaa,ghostact,bbb,AAA&stage=order", "/lineup/");
    runScript(SRC);
    const orderSlugs = Array.from(document.querySelectorAll(".lineup-lab__rows .lineup-lab__row[data-slug]")).map(
      (el) => el.getAttribute("data-slug"),
    );
    expect(orderSlugs).toEqual(["aaa", "bbb"]); // ghost dropped, AAA de-duped to canonical aaa
  });
});

describe("lineup-maker-2000 • guest (off-catalog) acts", () => {
  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event("input"));
  }

  test("stage 3: the + add-guest button gates on ≥3 chars and on no exact catalog match", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&stage=pick", "/lineup/");
    runScript(SRC);
    const search = document.querySelector(".lineup-lab__search") as HTMLInputElement;
    const add = document.querySelector(".lineup-lab__addguest") as HTMLButtonElement;
    expect(search).not.toBeNull();
    expect(add).not.toBeNull();
    expect(add.hidden).toBe(true); // nothing typed yet
    type(search, "Zo"); // < 3 chars
    expect(add.hidden).toBe(true);
    type(search, "Zoe Newcomer"); // ≥ 3 chars, not in the catalog
    expect(add.hidden).toBe(false);
    type(search, "Aaa Comedian"); // exact existing comedian — offer the list, not a guest
    expect(add.hidden).toBe(true);
  });

  test("stage 3: clicking + adds a distinct guest chip and clears the search", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&stage=pick", "/lineup/");
    runScript(SRC);
    const search = document.querySelector(".lineup-lab__search") as HTMLInputElement;
    const add = document.querySelector(".lineup-lab__addguest") as HTMLButtonElement;
    type(search, "Zoe Newcomer");
    add.click();
    const guestChip = document.querySelector(".lineup-lab__chip--guest");
    expect(guestChip).not.toBeNull();
    expect(guestChip!.textContent).toContain("Zoe Newcomer");
    expect(guestChip!.querySelector(".lineup-lab__chip-tag")?.textContent).toBe("guest");
    expect(search.value).toBe(""); // cleared after adding
    expect(add.hidden).toBe(true); // no candidate now
  });

  test("order stage: a guest survives as a row, in the save link, and isn't counted as dropped", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&lineup=aaa,guest%3AZoe%20Newcomer,bbb&stage=order", "/lineup/");
    runScript(SRC);
    const rows = Array.from(document.querySelectorAll(".lineup-lab__rows .lineup-lab__row[data-slug]"));
    const slugs = rows.map((r) => r.getAttribute("data-slug"));
    expect(slugs).toEqual(["aaa", "guest:Zoe Newcomer", "bbb"]); // guest kept, in place
    const guestRow = rows.find((r) => r.getAttribute("data-slug") === "guest:Zoe Newcomer")!;
    expect(guestRow.querySelector(".lineup-lab__name")?.textContent).toContain("Zoe Newcomer");
    expect(guestRow.querySelector("a.lineup-lab__name")).toBeNull(); // guests have no profile link
    expect(document.querySelector(".lineup-lab__notice")).toBeNull(); // not a dropped act
    const previews = Array.from(document.querySelectorAll("a.lineup-lab__preview")).map(
      (a) => a.getAttribute("href") || "",
    );
    expect(previews.some((h) => h.includes("guest%3AZoe%20Newcomer"))).toBe(true);
  });

  test("stage 3: each result shows the slug as a new-tab link to the comedian page", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&stage=pick", "/lineup/");
    runScript(SRC);
    const firstResult = document.querySelector(".lineup-lab__result") as HTMLElement;
    expect(firstResult).not.toBeNull();
    const link = firstResult.querySelector("a.lineup-lab__result-slug") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    // bracketed slug, linking to the comedian page, opening in a new tab
    expect(link.textContent).toBe("(aaa)");
    expect(link.getAttribute("href")).toBe("/comedians/aaa/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener");
    // it must be a SIBLING of the toggle button, never nested inside it
    expect(firstResult.querySelector(".lineup-lab__result-btn a")).toBeNull();
    // clicking the slug link must NOT select the comedian (separate hit target)
    link.click();
    expect(document.querySelector(".lineup-lab__chip")).toBeNull(); // nothing added to the tray
  });

  test("order stage: the copied running order text includes the guest by name", () => {
    buildLineupDOM({ shows: SHOWS, comedians: ROSTER });
    setURL("?show=soonshow&type=flat&lineup=aaa,guest%3AZoe%20Newcomer,bbb&stage=order", "/lineup/");
    runScript(SRC);
    let copied = "";
    const spy = (t: string) => {
      copied = t;
      return Promise.resolve();
    };
    const clip = (navigator as unknown as { clipboard?: { writeText?: (t: string) => Promise<void> } }).clipboard;
    if (clip) clip.writeText = spy;
    else (navigator as unknown as { clipboard: { writeText: (t: string) => Promise<void> } }).clipboard = { writeText: spy };
    const copyBtn = Array.from(document.querySelectorAll(".lineup-lab__copy--primary")).find((b) =>
      /running order/i.test(b.textContent || ""),
    ) as HTMLElement;
    expect(copyBtn).not.toBeNull();
    copyBtn.click();
    expect(copied).toContain("Zoe Newcomer");
  });
});

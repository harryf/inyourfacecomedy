// DOM-integration tests for assets/js/moments-lightbox.js.
// Builds a minimal /moments/ DOM (one comedian frame wrapped in a profile link, one
// plain audience frame, plus the lightbox container), runs the whole script, and
// asserts the progressive-enhancement behaviour: a comedian frame opens the lightbox
// (and does NOT navigate), the name links to the profile, Escape / backdrop close it,
// and a plain audience frame is left alone.
import { describe, expect, test, beforeEach } from "bun:test";
import { loadScript, runScript } from "./helpers";

const SRC = loadScript("moments-lightbox.js");

const COMEDIAN_IMG = "/assets/img/gallery/IMG_3349.JPG";
const PROFILE = "/comedians/ben-fcks/";
const NAME = "Ben Fücks";

function buildMomentsDOM(): void {
  document.body.innerHTML = `
    <div class="iyf-moments">
      <section class="iyf-moments__era"><div class="iyf-moments__grid">
        <figure class="iyf-moment iyf-moment--comedian" data-type="performer">
          <a class="iyf-moment__link" href="${PROFILE}"
             data-lightbox
             data-full="${COMEDIAN_IMG}"
             data-name="${NAME}"
             data-profile="${PROFILE}">
            <img id="com-img" src="${COMEDIAN_IMG}" alt="${NAME} performing stand-up">
          </a>
        </figure>
        <figure class="iyf-moment" data-type="audience">
          <img id="aud-img" src="/assets/img/gallery/crowd.jpg" alt="the audience">
        </figure>
      </div></section>
    </div>
    <div class="iyf-lightbox" hidden role="dialog" aria-modal="true">
      <button type="button" class="iyf-lightbox__close" aria-label="Close">&times;</button>
      <figure class="iyf-lightbox__frame">
        <img class="iyf-lightbox__img" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" alt="">
        <figcaption class="iyf-lightbox__caption">
          <a class="iyf-lightbox__name" href="">Visit profile</a>
        </figcaption>
      </figure>
    </div>`;
}

const box = () => document.querySelector(".iyf-lightbox") as HTMLElement;
const lbImg = () => document.querySelector(".iyf-lightbox__img") as HTMLImageElement;
const lbName = () => document.querySelector(".iyf-lightbox__name") as HTMLAnchorElement;

function clickEl(el: Element): MouseEvent {
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
}

beforeEach(() => {
  buildMomentsDOM();
  document.documentElement.classList.remove("iyf-lightbox-open");
  runScript(SRC);
});

describe("moments-lightbox • open", () => {
  test("clicking a comedian frame opens the lightbox instead of navigating", () => {
    expect(box().hidden).toBe(true);
    const ev = clickEl(document.getElementById("com-img")!);
    expect(ev.defaultPrevented).toBe(true); // intercepted — crawlers still see the href
    expect(box().hidden).toBe(false);
    expect(document.documentElement.classList.contains("iyf-lightbox-open")).toBe(true);
  });

  test("the lightbox shows the full image, the comedian name, and links to the profile", () => {
    clickEl(document.getElementById("com-img")!);
    expect(lbImg().getAttribute("src")).toBe(COMEDIAN_IMG);
    expect(lbName().textContent).toBe(NAME);
    expect(lbName().getAttribute("href")).toBe(PROFILE);
  });

  test("a plain audience frame is NOT interactive (no lightbox)", () => {
    const ev = clickEl(document.getElementById("aud-img")!);
    expect(ev.defaultPrevented).toBe(false);
    expect(box().hidden).toBe(true);
  });
});

describe("moments-lightbox • close", () => {
  test("Escape closes the lightbox and unlocks the page", () => {
    clickEl(document.getElementById("com-img")!);
    expect(box().hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(box().hidden).toBe(true);
    expect(document.documentElement.classList.contains("iyf-lightbox-open")).toBe(false);
  });

  test("a click on the backdrop closes it; a click on the image does not", () => {
    clickEl(document.getElementById("com-img")!);
    clickEl(lbImg()); // inside the figure — should stay open
    expect(box().hidden).toBe(false);
    clickEl(box()); // the backdrop itself — closes
    expect(box().hidden).toBe(true);
  });

  test("the close button closes it", () => {
    clickEl(document.getElementById("com-img")!);
    clickEl(document.querySelector(".iyf-lightbox__close")!);
    expect(box().hidden).toBe(true);
  });
});

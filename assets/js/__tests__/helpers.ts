// Shared helpers for the DOM-integration tests.
//
// Strategy: read a client-side script's source and run it with `new Function(src)()`.
// new Function executes in global scope where `module` is undefined, so the script's
// test seam is skipped and the FULL IIFE runs — exactly like a browser <script defer>.
// This gives a fresh evaluation per call (no module cache), so each test can set a
// different URL / DOM and observe the real transform.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const JS_DIR = join(import.meta.dir, "..");

export type ShowCat = {
  slug: string;
  title: string;
  desc?: string;
  url?: string;
  tickets?: string;
  img?: string;
  next?: string;
};

/** Read a script from assets/js once; the returned source is re-runnable. */
export function loadScript(file: string): string {
  return readFileSync(join(JS_DIR, file), "utf8");
}

/** Run a client-side script fresh against the current DOM + location. */
export function runScript(src: string): void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(src)();
}

/** Point window.location at a URL so the scripts read the intended query string. */
export function setURL(search: string, path = "/comedians/"): void {
  const url = "https://inyourfacecomedy.ch" + path + (search || "");
  (window as unknown as { happyDOM: { setURL: (u: string) => void } }).happyDOM.setURL(url);
}

/** A future ISO timestamp so showDate() treats catalog dates as upcoming, not stale. */
export const FUTURE_ISO = "2030-06-17T19:30:00+00:00";
export const PAST_ISO = "2000-01-01T00:00:00+00:00";

/** Serialize shows exactly as pages/7_comedians.md emits the #iyf-shows catalog. */
function showsCatalogJSON(shows: ShowCat[]): string {
  return JSON.stringify(
    shows.map((s) => ({
      slug: s.slug,
      title: s.title,
      desc: s.desc ?? "",
      url: s.url ?? "/" + s.slug + "/",
      tickets: s.tickets ?? "",
      img: s.img ?? "",
      next: s.next ?? "",
    })),
  );
}

/** Build the /comedians/ page DOM: hero (#main), card grid, show catalog, footer. */
export function buildComediansDOM(opts: { shows?: ShowCat[]; comedians?: string[] } = {}): void {
  const shows = opts.shows ?? [];
  const comedians = opts.comedians ?? [];
  const cards = comedians
    .map(
      (slug) =>
        `<li class="iyf-comedian-grid__item" data-slug="${slug}">` +
        `<a class="iyf-comedian-card" href="/comedians/${slug}/">` +
        `<span class="iyf-comedian-card__name">${slug}</span></a></li>`,
    )
    .join("");
  document.body.innerHTML =
    `<header id="main" class="iyf-hero iyf-hero--compact">` +
    `<h1 class="iyf-hero__title">Comedians</h1>` +
    `<p class="iyf-hero__subtitle">The performers you'll see at IN YOUR FACE shows.</p>` +
    `</header>` +
    `<div class="page-content">` +
    `<ul class="iyf-comedian-grid" role="list">${cards}</ul>` +
    `</div>` +
    `<footer id="footer">footer</footer>` +
    `<script type="application/json" id="iyf-shows">${showsCatalogJSON(shows)}</script>`;
}

/** Build the /lineup/ page DOM: #lineup-lab root + shows catalog + comedians catalog. */
export function buildLineupDOM(opts: {
  shows?: ShowCat[];
  comedians?: { slug: string; name: string; url?: string }[];
  origin?: string;
} = {}): void {
  const shows = opts.shows ?? [];
  const comedians = opts.comedians ?? [];
  const origin = opts.origin ?? "https://inyourfacecomedy.ch";
  const comediansJSON = JSON.stringify(
    comedians.map((c) => ({ slug: c.slug, name: c.name, url: c.url ?? "/comedians/" + c.slug + "/" })),
  );
  document.body.innerHTML =
    `<div id="lineup-lab" class="lineup-lab" data-origin="${origin}"></div>` +
    `<script type="application/json" id="iyf-shows">${showsCatalogJSON(shows)}</script>` +
    `<script type="application/json" id="iyf-comedians">${comediansJSON}</script>`;
}

/** Convenience: the data-slug values present in the (possibly reshaped) grid, in DOM order. */
export function renderedSlugs(): string[] {
  return Array.from(document.querySelectorAll("[data-slug]")).map(
    (el) => el.getAttribute("data-slug") || "",
  );
}

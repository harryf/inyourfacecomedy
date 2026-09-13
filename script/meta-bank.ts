// The creative bank: render the Cold, Warm and Intent concepts in meta-ads/bank/*.yml to
// images through the site's own /adcard/ and /week/ pages (plan: meta-ads/creative-bank-plan.md).
//
//   bun script/meta-bank.ts --render --local                 # every group, post and story, from _site/ (run jekyll build first)
//   bun script/meta-bank.ts --render --group cold --only C1,C3
//   bun script/meta-bank.ts --render --base https://inyourfacecomedy.ch   # from the live site instead of _site/
//
// Output: meta-ads/creative/bank/<group>/<id>-post.png and -story.png (gitignored) and a
// contact sheet meta-ads/creative/bank/index.html to look at them all in one page.
// Ad creation (upload, creative, ad) is the next step and lives behind flags not yet built.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { REPO_ROOT } from "./lib/meta-api";
import { evaluate, navigate, openBrowser, pngBytes } from "./lib/headless";

const USAGE = `usage: bun script/meta-bank.ts --render [--local | --base URL] [--group cold|warm|intent] [--only C1,C2]

  --render       render the bank's images (the only action so far)
  --local        serve _site/ on a local port for the render (build the site first)
  --base URL     render against this origin instead (default https://inyourfacecomedy.ch)
  --group KEY    one group (default all three)
  --only IDS     comma-separated concept ids
`;

export const GROUPS = ["cold", "warm", "intent"] as const;
export type Group = typeof GROUPS[number];
export const BANK_DIR = join(REPO_ROOT, "meta-ads", "bank");
export const CREATIVE_DIR = join(REPO_ROOT, "meta-ads", "creative", "bank");   // gitignored

export interface Concept {
  id: string; person: string; body: string; title: string; description?: string;
  image: { style: string; photo?: string; bg?: string; headline?: string; sub?: string; week_style?: string; note?: string };
  status: "live" | "bench" | "retired";
}
export interface Bank { adset: Group; link: { show: string; utm_campaign: string }; description: string; concepts: Concept[] }

export function loadBank(group: Group, dir = BANK_DIR): Bank {
  const p = join(dir, `${group}.yml`);
  if (!existsSync(p)) throw new Error(`missing ${p}`);
  const b = Bun.YAML.parse(readFileSync(p, "utf8")) as Bank;
  for (const c of b.concepts) {
    if ([...c.body].length > 125) throw new Error(`${group} ${c.id}: body is ${[...c.body].length} characters (125 max)`);
    if (!c.image?.style) throw new Error(`${group} ${c.id}: image.style missing`);
  }
  return b;
}

// The card's URL on the page (the page reads these fields; state lives in the URL).
export function adcardUrl(base: string, c: Concept, format: "post" | "story"): string {
  const q = new URLSearchParams({ headline: c.image.headline || c.title, sub: c.image.sub || "", style: c.image.style, photo: c.image.photo || "", format });
  if (c.image.bg !== undefined) q.set("bg", c.image.bg);
  return `${base}/adcard/?${q}`;
}

// Runs inside the page: wait for the draw hook, draw the card off screen, return a PNG.
function adcardExpression(c: Concept, format: "post" | "story"): string {
  const ad: Record<string, string> = { headline: c.image.headline || c.title, sub: c.image.sub || "", style: c.image.style, photo: c.image.photo || "" };
  if (c.image.bg !== undefined) ad.bg = c.image.bg;   // absent: the page's default per style (the station board's show photo)
  return `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 60 && typeof window.__iyfDrawAdCard !== "function"; i++) await wait(500);
    if (typeof window.__iyfDrawAdCard !== "function") throw new Error("page did not expose __iyfDrawAdCard");
    const c = document.createElement("canvas");
    await new Promise((res, rej) => window.__iyfDrawAdCard(c, ${JSON.stringify(ad)}, ${JSON.stringify(format)}, (e) => e ? rej(e) : res()));
    return c.toDataURL("image/png");
  })()`;
}

function weekExpression(style: string, format: "post" | "story"): string {
  return `(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 60 && typeof window.__iyfDrawWeek !== "function"; i++) await wait(500);
    if (typeof window.__iyfDrawWeek !== "function") throw new Error("page did not expose __iyfDrawWeek");
    const c = document.createElement("canvas");
    const from = new Date().toISOString().slice(0, 10);
    await new Promise((res, rej) => window.__iyfDrawWeek(c, { from, v: 7 }, ${JSON.stringify(format)}, ${JSON.stringify(style)}, (e) => e ? rej(e) : res()));
    return c.toDataURL("image/png");
  })()`;
}

// A static server over _site/ so the gallery photos and fonts load same-origin.
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".yml": "text/yaml" };
export function serveSite(root: string): { base: string; stop: () => void } {
  if (!existsSync(join(root, "index.html"))) throw new Error(`${root} has no index.html; run bundle exec jekyll build --future first`);
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      let p = decodeURIComponent(new URL(req.url).pathname);
      let file = join(root, p);
      if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
      if (!existsSync(file)) return new Response("not found", { status: 404 });
      return new Response(Bun.file(file), { headers: { "Content-Type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" } });
    },
  });
  return { base: `http://127.0.0.1:${server.port}`, stop: () => server.stop(true) };
}

// Every concept whose images exist on disk, across all groups, so a partial render (--only)
// never shrinks the sheet.
export function sheetRows(dir = CREATIVE_DIR, bankDir = BANK_DIR): { group: string; id: string; person: string; body: string; title: string; post: string; story: string }[] {
  const rows = [];
  for (const group of GROUPS) {
    if (!existsSync(join(bankDir, `${group}.yml`))) continue;
    for (const c of loadBank(group, bankDir).concepts) {
      const post = `${group}/${c.id}-post.png`, story = `${group}/${c.id}-story.png`;
      if (existsSync(join(dir, post)) && existsSync(join(dir, story))) rows.push({ group, id: c.id, person: c.person, body: c.body, title: c.title, post, story });
    }
  }
  return rows;
}

export function contactSheet(rows: { group: string; id: string; person: string; body: string; title: string; post: string; story: string }[]): string {
  const card = (r: typeof rows[number]) => `<figure><img src="${r.post}" alt=""><img src="${r.story}" alt="" class="story"><figcaption><b>${r.group} ${r.id}</b> ${r.person}<br><i>${r.title}</i><br>${r.body}</figcaption></figure>`;
  return `<!doctype html><meta charset="utf-8"><title>IYF ads bank</title><style>body{font:14px/1.4 system-ui;margin:20px;background:#eee}figure{display:inline-block;vertical-align:top;width:440px;margin:0 16px 24px 0;background:#fff;padding:8px}img{width:260px;display:inline-block;vertical-align:top;margin-right:6px}img.story{width:150px}figcaption{margin-top:6px}</style><h1>IYF ads bank, rendered ${new Date().toISOString().slice(0, 16)}</h1>${rows.map(card).join("\n")}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help") || !flagBool(args, "render")) { console.log(USAGE); return; }
  const onlyGroup = flagString(args, "group") as Group | undefined;
  if (onlyGroup && !GROUPS.includes(onlyGroup)) fail(`--group must be one of ${GROUPS.join(", ")}`);
  const only = (flagString(args, "only") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const local = flagBool(args, "local") ? serveSite(join(REPO_ROOT, "_site")) : null;
  const base = local ? local.base : (flagString(args, "base") || "https://inyourfacecomedy.ch").replace(/\/$/, "");
  log(`rendering from ${base}`);
  const { cdp, kill } = await openBrowser("iyf-meta-bank");
  let rendered = 0, skipped = 0;
  try {
    for (const group of onlyGroup ? [onlyGroup] : GROUPS) {
      const bank = loadBank(group);
      const dir = join(CREATIVE_DIR, group);
      mkdirSync(dir, { recursive: true });
      for (const c of bank.concepts) {
        if (only.length && !only.includes(c.id)) continue;
        if (c.image.style === "clip") { warn(`${group} ${c.id}: a phone clip (${c.image.note || ""}); nothing to render`); skipped++; continue; }
        const out: Record<string, string> = {};
        for (const format of ["post", "story"] as const) {
          let png: string;
          if (c.image.style === "week") {
            await navigate(cdp, `${base}/week/?style=${encodeURIComponent(c.image.week_style || "station")}&format=${format}&v=7`);
            png = await evaluate<string>(cdp, weekExpression(c.image.week_style || "station", format));
          } else {
            await navigate(cdp, adcardUrl(base, c, format));
            png = await evaluate<string>(cdp, adcardExpression(c, format));
          }
          const file = join(dir, `${c.id}-${format}.png`);
          writeFileSync(file, pngBytes(png));
          out[format] = file;
        }
        log(`${group} ${c.id}: ${c.image.style} -> ${out.post} and -story.png`);
        rendered++;
      }
    }
    mkdirSync(CREATIVE_DIR, { recursive: true });
    const sheet = join(CREATIVE_DIR, "index.html");
    const rows = sheetRows();
    writeFileSync(sheet, contactSheet(rows));
    log(`\n${rendered} concept(s) rendered, ${skipped} skipped; contact sheet ${sheet} lists ${rows.length}`);
  } finally { kill(); local?.stop(); }
}

if (import.meta.main) main().catch((e) => fail(String(e?.message || e)));

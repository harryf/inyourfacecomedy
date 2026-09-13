// The creative bank: render the Cold, Warm and Intent concepts in meta-ads/bank/*.yml to
// images through the site's own /adcard/ and /week/ pages (plan: meta-ads/creative-bank-plan.md).
//
//   bun script/meta-bank.ts --render --local                 # every group, post and story, from _site/ (run jekyll build first)
//   bun script/meta-bank.ts --render --group cold --only C1,C3
//   bun script/meta-bank.ts --render --base https://inyourfacecomedy.ch   # from the live site instead of _site/
//   bun script/meta-bank.ts --push --dry-run                 # what would be created for every `status: live` concept
//   bun script/meta-bank.ts --push --activate                # upload, one single-text creative and one ad per concept, on
//
// Output: meta-ads/creative/bank/<group>/<id>-post.png and -story.png (gitignored) and a
// contact sheet meta-ads/creative/bank/index.html to look at them all in one page. --push
// records what it made in meta-ads/creative/bank/state.json (gitignored) and never creates
// the same concept twice; the bank files' `status` is the human intent (live, bench, retired).

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname } from "node:path";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { REPO_ROOT, loadConfig, metaFromEnv, type MetaConfig } from "./lib/meta-api";
import { evaluate, navigate, openBrowser, pngBytes } from "./lib/headless";

const USAGE = `usage: bun script/meta-bank.ts (--render | --push) [options]

  --render       render the bank's images
    --local        serve _site/ on a local port for the render (build the site first)
    --base URL     render against this origin instead (default https://inyourfacecomedy.ch)
  --push         create the ads for every concept with status: live that has no ad yet
    --activate     switch the created ads on (default: left PAUSED)
    --dry-run      print what would be uploaded and created, write nothing
  --group KEY    one group (default all three)
  --only IDS     comma-separated concept ids (with --push: pushed even when status is bench)
`;

export const SITE = "https://inyourfacecomedy.ch";
export const MAX_ADS_PER_ADSET = 6;   // Meta's own guidance; the readout retires before it adds

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

// ---------- push: one single-text ad per concept ----------

// The bank link: the series link through /go/ with the ad set as the campaign; utm_content is
// filled by Meta with the ad's name at click time (url_tags), so the site report lists per ad.
export function bankLink(bank: Pick<Bank, "link">): string {
  return `${SITE}/go/?show=${bank.link.show}&utm_source=meta&utm_medium=paid_social&utm_campaign=${bank.link.utm_campaign}`;
}
export const URL_TAGS = "utm_content={{ad.name}}";
export function adName(group: Group, c: Pick<Concept, "id">): string { return `${group}-${c.id}`; }

export interface PushState { [adName: string]: { ad_id: string; creative_id: string; image_hash: string; pushed: string } }
const STATE_FILE = join(CREATIVE_DIR, "state.json");
export function readState(file = STATE_FILE): PushState { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; } }

// Which concepts a push touches: status live, or the ids named with --only whatever their status.
export function pushList(bank: Bank, only: string[]): Concept[] {
  return bank.concepts.filter((c) => (only.length ? only.includes(c.id) : c.status === "live"));
}

// The single-text creative (link_data, one image): a second text on the same ad would turn the
// ad set dynamic-creative, which allows one ad, and the bank needs six side by side.
export function creativeSpec(config: Pick<MetaConfig, "page_id" | "instagram_account_id">, group: Group, bank: Bank, c: Concept, imageHash: string) {
  const link = bankLink(bank);
  return {
    name: `${adName(group, c)} creative`,
    url_tags: URL_TAGS,
    object_story_spec: {
      page_id: config.page_id,
      instagram_user_id: config.instagram_account_id || undefined,
      link_data: {
        link,
        message: c.body,
        name: c.title,
        description: c.description || bank.description,
        image_hash: imageHash,
        call_to_action: { type: "BOOK_TRAVEL", value: { link } },
      },
    },
  };
}

// Meta's per-account request limit (code 17) trips after about ten creations in a row; wait
// and try again rather than leaving the run half done.
async function patient<T>(what: string, fn: () => Promise<T>, waits = [60, 120, 180]): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e: any) {
      if (e?.detail?.code !== 17 || i >= waits.length) throw e;
      warn(`${what}: Meta's request limit, waiting ${waits[i]} s`);
      await new Promise((r) => setTimeout(r, waits[i] * 1000));
    }
  }
}

async function push(args: ReturnType<typeof parseArgs>, onlyGroup: Group | undefined, only: string[]) {
  const dryRun = flagBool(args, "dry-run");
  const activate = flagBool(args, "activate");
  const config = loadConfig();
  const meta = metaFromEnv(config);
  const act = config.ad_account_id;
  const state = readState();
  const clipsSkipped: string[] = [];
  let created = 0;
  for (const group of onlyGroup ? [onlyGroup] : GROUPS) {
    const bank = loadBank(group);
    const adsetId = config.adsets[group];
    if (!adsetId) fail(`config.adsets.${group} is empty`);
    const list = pushList(bank, only);
    if (!list.length) { log(`${group}: nothing marked live`); continue; }
    const existing = await patient(`${group} ads`, () => meta.getAll(`${adsetId}/ads`, { fields: "id,name,status,effective_status" }));
    const byName = new Map(existing.map((a: any) => [a.name, a]));
    let active = existing.filter((a: any) => a.effective_status !== "PAUSED" && a.effective_status !== "DELETED" && a.effective_status !== "ARCHIVED").length;
    log(`\n${group}: ad set ${adsetId}, ${existing.length} ad(s) already (${active} live); ${list.length} concept(s) to push: ${list.map((c) => c.id).join(", ")}`);
    for (const c of list) {
      const name = adName(group, c);
      if (c.image.style === "clip") { clipsSkipped.push(name); warn(`${name}: a phone clip, create it by hand in Ads Manager (${c.image.note || ""})`); continue; }
      if (byName.has(name)) { log(`${name}: exists (${byName.get(name).id}, ${byName.get(name).effective_status}), skipped`); continue; }
      if (state[name]?.ad_id) { log(`${name}: in state.json as ${state[name].ad_id}, skipped`); continue; }
      const file = join(CREATIVE_DIR, group, `${c.id}-post.png`);
      if (!existsSync(file)) { warn(`${name}: no image at ${file}; run --render first`); continue; }
      if (active >= MAX_ADS_PER_ADSET) { warn(`${name}: ${group} already has ${active} live ads (max ${MAX_ADS_PER_ADSET}); retire one first`); continue; }
      const png = readFileSync(file);
      const key = createHash("sha256").update(png).digest("hex").slice(0, 16);
      const spec = creativeSpec(config, group, bank, c, `<hash of ${c.id}-post.png ${key}>`);
      if (dryRun) { log(`${name}: would upload ${file} (${(png.length / 1024).toFixed(0)} KB), create creative ${JSON.stringify(spec.object_story_spec.link_data).slice(0, 200)}..., ad ${activate ? "ACTIVE" : "PAUSED"}`); active++; continue; }
      const up = await patient(`${name} image`, () => meta.post(`${act}/adimages`, { bytes: png.toString("base64"), name: `${name}-${key}.png` }));
      const hash = (Object.values(up.images || {})[0] as any)?.hash;
      if (!hash) fail(`${name}: image upload returned no hash: ${JSON.stringify(up).slice(0, 300)}`);
      const creative = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, creativeSpec(config, group, bank, c, hash)));
      const ad = await patient(`${name} ad`, () => meta.post(`${act}/ads`, { name, adset_id: adsetId, creative: { creative_id: creative.id }, status: activate ? "ACTIVE" : "PAUSED" }));
      state[name] = { ad_id: String(ad.id), creative_id: String(creative.id), image_hash: hash, pushed: new Date().toISOString() };
      mkdirSync(CREATIVE_DIR, { recursive: true });
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
      const back = await meta.get(ad.id, { fields: "status,effective_status" });
      log(`${name}: image ${hash}, creative ${creative.id}, ad ${ad.id} ${back.status}/${back.effective_status}`);
      created++; active++;
    }
  }
  log(`\n${dryRun ? "dry run, nothing written" : `${created} ad(s) created${activate ? " and switched on (Meta reviews new ads, usually under a day)" : ", left PAUSED; --activate to switch them on"}`}${clipsSkipped.length ? `; clips to make by hand: ${clipsSkipped.join(", ")}` : ""}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const onlyGroup = flagString(args, "group") as Group | undefined;
  if (onlyGroup && !GROUPS.includes(onlyGroup)) fail(`--group must be one of ${GROUPS.join(", ")}`);
  const only = (flagString(args, "only") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (flagBool(args, "push")) return push(args, onlyGroup, only);
  if (flagBool(args, "help") || !flagBool(args, "render")) { console.log(USAGE); return; }
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

// The creative bank: render the Cold, Warm and Intent concepts in meta-ads/bank/*.yml to
// images through the site's own /adcard/ and /week/ pages (plan: meta-ads/creative-bank-plan.md).
//
//   bun script/meta-bank.ts --render --local                 # every group, post and story, from _site/ (run jekyll build first)
//   bun script/meta-bank.ts --render --group cold --only C1,C3
//   bun script/meta-bank.ts --render --base https://inyourfacecomedy.ch   # from the live site instead of _site/
//   bun script/meta-bank.ts --push --dry-run                 # what would be created for every `status: live` concept
//   bun script/meta-bank.ts --push --activate                # upload, one single-text creative and one ad per concept, on
//   bun script/meta-bank.ts --restory --validate             # Meta checks the two-image creative for ads pushed with one image
//   bun script/meta-bank.ts --restory                        # and moves them onto it
//   bun script/meta-bank.ts --push-video --dry-run           # the video ads that would be made (concepts with a `video:` block)
//   bun script/meta-bank.ts --push-video --validate          # upload the video, have Meta check the creative, make no ad
//   bun script/meta-bank.ts --push-video --activate          # upload, creative, one ad per concept named <group>-<id>v, on
//   bun script/meta-bank.ts --sync                           # diff: ads whose on/off state differs from the bank files' status
//   bun script/meta-bank.ts --sync --apply                   # pause the resting and retired ones, switch the live ones back on (asks first)
//
// Output: meta-ads/creative/bank/<group>/<id>-post.png and -story.png (gitignored) and a
// contact sheet meta-ads/creative/bank/index.html to look at them all in one page. --push
// records what it made in meta-ads/creative/bank/state.json (gitignored) and never creates
// the same concept twice; the bank files' `status` is the human intent (live, resting, bench,
// retired). Meta feeds one or two ads per ad set and starves the rest, so at small budgets only
// two or three run at a time: `resting` is an ad that exists, is paused on purpose and comes
// back in a later round; --sync makes Meta match.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, extname } from "node:path";
import { confirm, fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";
import { REPO_ROOT, loadConfig, metaFromEnv, type MetaConfig } from "./lib/meta-api";
import { evaluate, navigate, openBrowser, pngBytes } from "./lib/headless";

const USAGE = `usage: bun script/meta-bank.ts (--render | --push | --push-video | --restory | --sync) [options]

  --render       render the bank's images
    --local        serve _site/ on a local port for the render (build the site first)
    --base URL     render against this origin instead (default https://inyourfacecomedy.ch)
  --push         create the ads for every concept with status: live that has no ad yet
    --activate     switch the created ads on (default: left PAUSED)
    --dry-run      print what would be uploaded and created, write nothing
  --push-video   for every live concept with a \`video:\` block: upload video/out/<composition>.mp4 and create
                 the ad <group>-<id>v (the video on Stories and Reels, the 4:5 image on feeds)
    --validate     upload, let Meta check the creative (validate_only), create no creative and no ad
    --activate, --dry-run   as for --push
  --restory      move ads pushed with one image onto the two-image creative (post for feeds, story for Stories and Reels)
    --validate     ask Meta to check each new creative (validate_only), write nothing
    --dry-run      list the ads that would move
  --sync         compare each pushed ad's on/off state with its concept's status (live = on, anything else = off)
    --apply        write the differences (asks first; --yes skips the question)
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
  // A Remotion composition in video/ (rendered to video/out/<composition>.mp4). `twin: true`
  // (the default): the still ad <group>-<id> runs beside the video ad <group>-<id>v with the
  // same words, so the two can be compared. `twin: false`: the video ad only.
  video?: { composition: string; twin?: boolean };
  status: "live" | "resting" | "bench" | "retired";
}
export const VIDEO_OUT = join(REPO_ROOT, "video", "out");   // gitignored
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

export interface PushState { [adName: string]: { video_id?: string; video_sha?: string; ad_id: string; creative_id: string; image_hash: string; pushed: string; story_hash?: string; previous_creative_id?: string; pending_creative_id?: string; restoried?: string } }
const STATE_FILE = join(CREATIVE_DIR, "state.json");
export function readState(file = STATE_FILE): PushState { try { return JSON.parse(readFileSync(file, "utf8")); } catch { return {}; } }

// Which concepts a push touches: status live, or the ids named with --only whatever their status.
export function pushList(bank: Bank, only: string[]): Concept[] {
  return bank.concepts.filter((c) => c.video?.twin !== false && (only.length ? only.includes(c.id) : c.status === "live"));
}
// The video ads: every concept with a `video:` block, named <group>-<id>v.
export function videoAdName(group: Group, c: Pick<Concept, "id">): string { return `${adName(group, c)}v`; }
export function videoList(bank: Bank, only: string[]): Concept[] {
  return bank.concepts.filter((c) => c.video && (only.length ? only.includes(c.id) : c.status === "live"));
}
// An ad name's id part back to its concept: <id>, or <id>v for a concept with a video.
export function conceptFor(bank: Bank | undefined, id: string): Concept | undefined {
  return bank?.concepts.find((c) => c.id === id) || bank?.concepts.find((c) => c.video && `${c.id}v` === id);
}

// Where each image goes: the 9:16 story image on Stories and Reels (Meta's "Reels format"
// recommendation, 2026-09-13), the 4:5 post image everywhere else. Rules apply lowest priority
// first; the feed rule names platforms only, so it catches every position the ad sets can
// deliver to (a position no rule covers gets no ad).
export const STORY_PLACEMENTS = {
  publisher_platforms: ["facebook", "instagram"],
  facebook_positions: ["story", "facebook_reels"],
  instagram_positions: ["story", "reels"],
};
export const FEED_PLACEMENTS = {
  publisher_platforms: ["facebook", "instagram", "messenger", "audience_network", "threads"],
};

// Every Advantage+ creative feature off, as Meta stored it on the first push's creatives (read
// back 2026-09-13): text variations or image changes would put words and pictures in the ads
// that nobody wrote, and a text variation is a second text, which the six-ad rule forbids.
export const CREATIVE_FEATURES_OFF = ["adapt_to_placement", "add_text_overlay", "ads_with_benefits", "advantage_plus_creative", "app_highlights", "audio", "auto_promotion_tag", "biz_ai", "carousel_to_video", "catalog_feed_tag", "creative_stickers", "customize_product_recommendation", "cv_transformation", "description_automation", "dha_optimization", "dynamic_cta_text", "dynamic_partner_content", "enable_ncs_testimonials", "enhance_cta", "fb_feed_tag", "fb_reels_tag", "fb_story_tag", "feed_caption_optimization", "generate_cta", "hide_price", "hyperlink_formatting", "ig_feed_tag", "ig_glados_feed", "ig_reels_tag", "ig_stream_tag", "ig_video_native_subtitle", "image_animation", "image_auto_crop", "image_background_gen", "image_banner", "image_brightness_and_contrast", "image_end_card", "image_enhancement", "image_templates", "image_text_translation", "image_touchups", "image_uncrop", "inline_comment", "local_store_extension", "media_liquidity_animated_image", "media_order", "media_type_automation", "multi_creative_post_carousel", "multi_photo_to_video", "music_generation", "pac_genai_recomposition", "pac_recomposition", "pac_relaxation", "product_browsing", "product_extensions", "product_metadata_automation", "product_tags", "profile_card", "profile_extension", "replace_media_text", "reveal_details_over_time", "show_destination_blurbs", "show_summary", "site_extensions", "standard_enhancements_catalog", "text_extraction_for_headline", "text_extraction_for_tap_target", "text_formatting_optimization", "text_generation", "text_optimizations", "text_overlay_translation", "text_translation", "translate_voiceover", "video_auto_crop", "video_filtering", "video_highlight", "video_highlights", "video_to_image", "video_uncrop", "video_voiceover", "wa_mm_image_filtering", "wa_mm_text_truncation_length"];
export function degreesOfFreedomOff() {
  return { creative_features_spec: Object.fromEntries(CREATIVE_FEATURES_OFF.map((f) => [f, { enroll_status: "OPT_OUT" }])) };
}

// The single-text creative with two images: asset_feed_spec with ONE body, ONE title and ONE
// description (a second text on the same ad would turn the ad set dynamic-creative, which
// allows one ad, and the bank needs six side by side) and placement rules picking the post or
// the story image. url_tags fills utm_content with the ad's name at click time.
export function creativeSpec(config: Pick<MetaConfig, "page_id" | "instagram_account_id">, group: Group, bank: Bank, c: Concept, images: { post: string; story: string }) {
  const link = bankLink(bank);
  return {
    name: `${adName(group, c)} creative`,
    url_tags: URL_TAGS,
    degrees_of_freedom_spec: degreesOfFreedomOff(),
    object_story_spec: {
      page_id: config.page_id,
      instagram_user_id: config.instagram_account_id || undefined,
    },
    asset_feed_spec: {
      images: [
        { hash: images.post, adlabels: [{ name: "feed" }] },
        { hash: images.story, adlabels: [{ name: "story" }] },
      ],
      bodies: [{ text: c.body }],
      titles: [{ text: c.title }],
      descriptions: [{ text: c.description || bank.description }],
      link_urls: [{ website_url: link, display_url: "inyourfacecomedy.ch" }],
      call_to_action_types: ["BOOK_TRAVEL"],
      ad_formats: ["SINGLE_IMAGE"],
      asset_customization_rules: [
        { customization_spec: STORY_PLACEMENTS, image_label: { name: "story" }, priority: 1 },
        { customization_spec: FEED_PLACEMENTS, image_label: { name: "feed" }, priority: 2 },
      ],
    },
  };
}

// The video ad's creative: the same single text, the 4:5 image on feeds, the video on Stories
// and Reels with the 9:16 still as its thumbnail. Image and video in one asset feed need
// AUTOMATIC_FORMAT.
export function videoCreativeSpec(config: Pick<MetaConfig, "page_id" | "instagram_account_id">, group: Group, bank: Bank, c: Concept, assets: { post: string; story: string; video_id: string }) {
  const still = creativeSpec(config, group, bank, c, { post: assets.post, story: assets.story });
  return {
    ...still,
    name: `${videoAdName(group, c)} creative`,
    asset_feed_spec: {
      ...still.asset_feed_spec,
      images: [{ hash: assets.post, adlabels: [{ name: "feed" }] }],
      videos: [{ video_id: assets.video_id, thumbnail_hash: assets.story, adlabels: [{ name: "story" }] }],
      ad_formats: ["AUTOMATIC_FORMAT"],
      asset_customization_rules: [
        { customization_spec: STORY_PLACEMENTS, video_label: { name: "story" }, priority: 1 },
        { customization_spec: FEED_PLACEMENTS, image_label: { name: "feed" }, priority: 2 },
      ],
    },
  };
}

// The live ads that still carry the one-image creative: in state.json, no story_hash yet, and
// their concept still in the bank (a concept dropped from the bank is left alone).
export function restoryList(state: PushState, banks: Partial<Record<Group, Bank>>, onlyGroup?: Group, only: string[] = []): { name: string; group: Group; concept: Concept; entry: PushState[string] }[] {
  const out = [];
  for (const [name, entry] of Object.entries(state)) {
    const [group, id] = name.split("-") as [Group, string];
    if (onlyGroup && group !== onlyGroup) continue;
    if (only.length && !only.includes(id)) continue;
    if (entry.story_hash || !entry.ad_id) continue;
    const concept = banks[group]?.concepts.find((c) => c.id === id);
    if (!concept) continue;
    out.push({ name, group, concept, entry });
  }
  return out;
}

// --sync, pure part: which pushed ads are on when their concept is not live, or off when it
// is. `statuses` is each ad's configured status on Meta (ACTIVE or PAUSED); an ad missing from
// it (deleted on Meta) and a concept dropped from the bank are left alone.
export function syncPlan(state: PushState, banks: Partial<Record<Group, Bank>>, statuses: Record<string, string>, onlyGroup?: Group, only: string[] = []): { name: string; ad_id: string; concept_status: Concept["status"]; from: string; to: "ACTIVE" | "PAUSED" }[] {
  const out = [];
  for (const [name, entry] of Object.entries(state)) {
    const [group, id] = name.split("-") as [Group, string];
    if (onlyGroup && group !== onlyGroup) continue;
    if (only.length && !only.includes(id)) continue;
    const concept = conceptFor(banks[group], id);
    const from = statuses[entry.ad_id];
    if (!concept || !from) continue;
    const to = concept.status === "live" ? "ACTIVE" : "PAUSED";
    if (from !== to) out.push({ name, ad_id: entry.ad_id, concept_status: concept.status, from, to } as const);
  }
  return out;
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

function imageFiles(group: Group, c: Pick<Concept, "id">): { post: string; story: string } {
  return { post: join(CREATIVE_DIR, group, `${c.id}-post.png`), story: join(CREATIVE_DIR, group, `${c.id}-story.png`) };
}
function saveState(state: PushState) {
  mkdirSync(CREATIVE_DIR, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}
async function uploadImage(meta: ReturnType<typeof metaFromEnv>, act: string, name: string, file: string): Promise<string> {
  const png = readFileSync(file);
  const key = createHash("sha256").update(png).digest("hex").slice(0, 16);
  const up = await patient(`${name} image`, () => meta.post(`${act}/adimages`, { bytes: png.toString("base64"), name: `${name}-${key}.png` }));
  const hash = (Object.values(up.images || {})[0] as any)?.hash;
  if (!hash) fail(`${name}: image upload returned no hash: ${JSON.stringify(up).slice(0, 300)}`);
  return hash;
}

// --restory: move the ads pushed with the one-image creative onto the two-image one. The ad
// keeps its id, name and url_tags (only its creative changes), Meta reviews it again, and the
// old creative id stays in state.json so the swap can be undone.
async function restory(args: ReturnType<typeof parseArgs>, onlyGroup: Group | undefined, only: string[]) {
  const dryRun = flagBool(args, "dry-run");
  const validate = flagBool(args, "validate");
  const config = loadConfig();
  const act = config.ad_account_id;
  const state = readState();
  const banks: Partial<Record<Group, Bank>> = {};
  for (const g of GROUPS) banks[g] = loadBank(g);
  const list = restoryList(state, banks, onlyGroup, only);
  if (!list.length) { log("nothing to do: every ad in state.json already has a story image"); return; }
  log(`${list.length} ad(s) still on the one-image creative: ${list.map((r) => `${r.name} (ad ${r.entry.ad_id}, creative ${r.entry.creative_id})`).join(", ")}`);
  if (dryRun) { log("dry run, nothing written"); return; }
  const meta = metaFromEnv(config);
  let done = 0, accepted = 0;
  for (const { name, group, concept, entry } of list) {
    const files = imageFiles(group, concept);
    if (!existsSync(files.story)) { warn(`${name}: no story image at ${files.story}; run --render first`); continue; }
    if (validate) {
      // The story hash is needed for the check, so the upload is real (an image in the library costs nothing); the creative is not.
      const story = await uploadImage(meta, act, name, files.story);
      const spec = creativeSpec(config, group, banks[group]!, concept, { post: entry.image_hash, story });
      try { const r = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, { ...spec, execution_options: ["validate_only"] })); log(`${name}: validate_only accepted (${JSON.stringify(r)})`); accepted++; }
      catch (e: any) { warn(`${name}: validate_only REJECTED: ${e.message}`); }
      continue;
    }
    const story = await uploadImage(meta, act, name, files.story);
    // The creative id is saved before the ad update, so a crash between the two is picked up
    // on the next run instead of making a second creative.
    let creativeId = entry.pending_creative_id;
    if (creativeId) log(`${name}: creative ${creativeId} from an earlier run, attaching it`);
    else {
      const creative = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, creativeSpec(config, group, banks[group]!, concept, { post: entry.image_hash, story })));
      creativeId = String(creative.id);
      state[name] = { ...entry, pending_creative_id: creativeId };
      saveState(state);
    }
    await patient(`${name} ad`, () => meta.post(entry.ad_id, { creative: { creative_id: creativeId } }));
    state[name] = { ...entry, previous_creative_id: entry.creative_id, creative_id: creativeId, story_hash: story, restoried: new Date().toISOString() };
    delete state[name].pending_creative_id;
    saveState(state);
    const back = await meta.get(entry.ad_id, { fields: "status,effective_status,creative{id}" });
    log(`${name}: story ${story}, creative ${entry.creative_id} -> ${creativeId}, ad ${entry.ad_id} ${back.status}/${back.effective_status} on creative ${back.creative?.id}`);
    done++;
  }
  log(validate ? `\n${accepted}/${list.length} accepted by Meta, nothing written` : `\n${done} ad(s) moved onto the two-image creative (Meta reviews them again)`);
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
      const files = imageFiles(group, c);
      const missing = (["post", "story"] as const).filter((f) => !existsSync(files[f]));
      if (missing.length) { warn(`${name}: no image at ${missing.map((f) => files[f]).join(" and ")}; run --render first`); continue; }
      if (active >= MAX_ADS_PER_ADSET) { warn(`${name}: ${group} already has ${active} live ads (max ${MAX_ADS_PER_ADSET}); retire one first`); continue; }
      if (dryRun) {
        const sizes = (["post", "story"] as const).map((f) => `${files[f]} (${(statSync(files[f]).size / 1024).toFixed(0)} KB)`).join(" and ");
        const spec = creativeSpec(config, group, bank, c, { post: `<hash of ${c.id}-post.png>`, story: `<hash of ${c.id}-story.png>` });
        log(`${name}: would upload ${sizes}, create creative ${JSON.stringify({ bodies: spec.asset_feed_spec.bodies, titles: spec.asset_feed_spec.titles }).slice(0, 200)} with feed and story rules, ad ${activate ? "ACTIVE" : "PAUSED"}`);
        active++; continue;
      }
      const post = await uploadImage(meta, act, name, files.post);
      const story = await uploadImage(meta, act, name, files.story);
      const creative = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, creativeSpec(config, group, bank, c, { post, story })));
      const ad = await patient(`${name} ad`, () => meta.post(`${act}/ads`, { name, adset_id: adsetId, creative: { creative_id: creative.id }, status: activate ? "ACTIVE" : "PAUSED" }));
      state[name] = { ad_id: String(ad.id), creative_id: String(creative.id), image_hash: post, story_hash: story, pushed: new Date().toISOString() };
      saveState(state);
      const back = await meta.get(ad.id, { fields: "status,effective_status" });
      log(`${name}: images ${post} and ${story}, creative ${creative.id}, ad ${ad.id} ${back.status}/${back.effective_status}`);
      created++; active++;
    }
  }
  log(`\n${dryRun ? "dry run, nothing written" : `${created} ad(s) created${activate ? " and switched on (Meta reviews new ads, usually under a day)" : ", left PAUSED; --activate to switch them on"}`}${clipsSkipped.length ? `; clips to make by hand: ${clipsSkipped.join(", ")}` : ""}`);
}

// Upload a rendered video once (cached by content hash in state.json) and wait until Meta has
// processed it; a creative made before that is refused.
async function uploadVideo(meta: ReturnType<typeof metaFromEnv>, act: string, name: string, file: string, state: PushState): Promise<string> {
  const bytes = readFileSync(file);
  const sha = createHash("sha256").update(bytes).digest("hex").slice(0, 16);
  const cached = state[name];
  let id = cached?.video_sha === sha ? cached.video_id : undefined;
  if (id) log(`${name}: video ${id} already uploaded for this render`);
  else {
    const form = new FormData();
    form.set("name", `${name}-${sha}`);
    form.set("source", new Blob([bytes], { type: "video/mp4" }), `${name}-${sha}.mp4`);
    const up = await patient(`${name} video`, () => meta.postForm(`${act}/advideos`, form));
    id = String(up.id);
    state[name] = { ...(cached || { ad_id: "", creative_id: "", image_hash: "", pushed: "" }), video_id: id, video_sha: sha };
    saveState(state);
    log(`${name}: uploaded ${(bytes.length / 1e6).toFixed(1)} MB as video ${id}`);
  }
  for (let i = 0; i < 40; i++) {
    const v = await meta.get(id, { fields: "status" });
    const s = v.status?.video_status;
    if (s === "ready") return id;
    if (s === "error") fail(`${name}: Meta could not process the video: ${JSON.stringify(v.status).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
  return fail(`${name}: video ${id} still processing after 200 s; run again`);
}

// --push-video: one ad per live concept with a `video:` block, named <group>-<id>v.
async function pushVideo(args: ReturnType<typeof parseArgs>, onlyGroup: Group | undefined, only: string[]) {
  const dryRun = flagBool(args, "dry-run"), validate = flagBool(args, "validate"), activate = flagBool(args, "activate");
  const config = loadConfig();
  const meta = metaFromEnv(config);
  const act = config.ad_account_id;
  const state = readState();
  let created = 0;
  for (const group of onlyGroup ? [onlyGroup] : GROUPS) {
    const bank = loadBank(group);
    const list = videoList(bank, only);
    if (!list.length) continue;
    const adsetId = config.adsets[group];
    const existing = await patient(`${group} ads`, () => meta.getAll(`${adsetId}/ads`, { fields: "id,name,status,effective_status" }));
    const byName = new Map(existing.map((a: any) => [a.name, a]));
    let active = existing.filter((a: any) => a.effective_status !== "PAUSED" && a.effective_status !== "DELETED" && a.effective_status !== "ARCHIVED").length;
    for (const c of list) {
      const name = videoAdName(group, c);
      if (byName.has(name)) { log(`${name}: exists (${byName.get(name).id}, ${byName.get(name).effective_status}), skipped`); continue; }
      if (state[name]?.ad_id) { log(`${name}: in state.json as ${state[name].ad_id}, skipped`); continue; }
      const files = imageFiles(group, c), video = join(VIDEO_OUT, `${c.video!.composition}.mp4`);
      const missing = [files.post, files.story, video].filter((f) => !existsSync(f));
      if (missing.length) { warn(`${name}: missing ${missing.join(" and ")} (--render for the images, bun scripts/Render.ts in video/ for the video)`); continue; }
      if (!validate && active >= MAX_ADS_PER_ADSET) { warn(`${name}: ${group} already has ${active} live ads (max ${MAX_ADS_PER_ADSET})`); continue; }
      if (dryRun) { log(`${name}: would upload ${video} (${(statSync(video).size / 1e6).toFixed(1)} MB), the 4:5 image for feeds and the 9:16 still as thumbnail, create the creative and the ad ${activate ? "ACTIVE" : "PAUSED"}`); active++; continue; }
      const post = await uploadImage(meta, act, name, files.post);
      const story = await uploadImage(meta, act, name, files.story);
      const videoId = await uploadVideo(meta, act, name, video, state);
      const spec = videoCreativeSpec(config, group, bank, c, { post, story, video_id: videoId });
      if (validate) {
        try { const r = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, { ...spec, execution_options: ["validate_only"] })); log(`${name}: validate_only accepted (${JSON.stringify(r)})`); }
        catch (e: any) { warn(`${name}: validate_only REJECTED: ${e.message}`); }
        continue;
      }
      const creative = await patient(`${name} creative`, () => meta.post(`${act}/adcreatives`, spec));
      const ad = await patient(`${name} ad`, () => meta.post(`${act}/ads`, { name, adset_id: adsetId, creative: { creative_id: creative.id }, status: activate ? "ACTIVE" : "PAUSED" }));
      state[name] = { ...state[name], ad_id: String(ad.id), creative_id: String(creative.id), image_hash: post, story_hash: story, pushed: new Date().toISOString() };
      saveState(state);
      const back = await meta.get(ad.id, { fields: "status,effective_status" });
      log(`${name}: video ${videoId}, creative ${creative.id}, ad ${ad.id} ${back.status}/${back.effective_status}`);
      created++; active++;
    }
  }
  log(`\n${dryRun ? "dry run, nothing written" : validate ? "validate only: the videos and images are in the library, no creative and no ad made" : `${created} video ad(s) created${activate ? " and switched on (Meta reviews new ads, usually under a day)" : ", left PAUSED; --sync --apply switches the live ones on"}`}`);
}

// --sync: make each pushed ad's on/off state match its concept's status. Diff by default.
async function sync(args: ReturnType<typeof parseArgs>, onlyGroup: Group | undefined, only: string[]) {
  const apply = flagBool(args, "apply") && !flagBool(args, "dry-run");
  const config = loadConfig();
  const meta = metaFromEnv(config);
  const state = readState();
  const banks: Partial<Record<Group, Bank>> = {};
  for (const g of GROUPS) banks[g] = loadBank(g);
  const statuses: Record<string, string> = {};
  for (const g of GROUPS) {
    if (onlyGroup && g !== onlyGroup) continue;
    const ads = await patient(`${g} ads`, () => meta.getAll(`${config.adsets[g]}/ads`, { fields: "id,name,status" }));
    for (const a of ads) statuses[a.id] = a.status;
  }
  const plan = syncPlan(state, banks, statuses, onlyGroup, only);
  if (!plan.length) { log("in sync: every pushed ad's on/off state matches its concept's status"); return; }
  for (const p of plan) log(`${p.name}: concept is ${p.concept_status}, ad ${p.ad_id} is ${p.from} -> ${p.to}`);
  if (!apply) { log("diff only; --apply to write"); return; }
  if (!flagBool(args, "yes") && !(await confirm(`write ${plan.length} status change(s) to Meta?`))) { log("nothing written"); return; }
  for (const p of plan) {
    await patient(p.name, () => meta.post(p.ad_id, { status: p.to }));
    const back = await meta.get(p.ad_id, { fields: "status,effective_status" });
    log(`${p.name}: now ${back.status}/${back.effective_status}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const onlyGroup = flagString(args, "group") as Group | undefined;
  if (onlyGroup && !GROUPS.includes(onlyGroup)) fail(`--group must be one of ${GROUPS.join(", ")}`);
  const only = (flagString(args, "only") || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (flagBool(args, "push-video")) return pushVideo(args, onlyGroup, only);
  if (flagBool(args, "push")) return push(args, onlyGroup, only);
  if (flagBool(args, "restory")) return restory(args, onlyGroup, only);
  if (flagBool(args, "sync")) return sync(args, onlyGroup, only);
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

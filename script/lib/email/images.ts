// Images for email: resize with macOS `sips` (no npm dependency), upload once to
// Mailchimp's File Manager, remember the hosted URL in a local cache so later
// runs reuse it. Emails must stay light: faces are 216px squares (shown at
// 108px, sharp on retina), a hero is 1200px wide at most. See docs/emails.md.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { CACHE_DIR, warn } from "./cli";
import type { Mailchimp } from "./mailchimp";

export const MAX_IMAGE_BYTES = 60_000;   // faces, logo
export const MAX_HERO_BYTES = 90_000;    // one wide photo per email at most

// The source's size and mtime are part of the name, so a replaced headshot
// with the same filename gets a new cut and a new hosted URL.
export function sourceStamp(src: string): string {
  const s = statSync(src);
  return (Math.round(s.mtimeMs / 1000).toString(36) + s.size.toString(36)).slice(-8);
}

function cacheName(src: string, suffix: string, format: "jpeg" | "png" = "jpeg"): string {
  return basename(src, extname(src)).replace(/[^A-Za-z0-9._-]+/g, "_") + suffix + "-" + sourceStamp(src) + (format === "png" ? ".png" : ".jpg");
}

function sips(args: string[]): void {
  const r = spawnSync("sips", args, { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status !== 0) throw new Error(`sips failed (${r.status}): ${r.stderr?.toString().trim()}`);
}

// Square thumbnail (comedian photos are 1024x1024; non-square sources get
// scaled then cropped to the centre). JPEG quality steps down until under budget.
export function resizeSquare(src: string, size: number, format: "jpeg" | "png" = "jpeg", crop = true): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  const out = join(CACHE_DIR, cacheName(src, `-sq${size}${crop ? "" : "-fit"}`, format));
  if (existsSync(out) && statSync(out).size <= MAX_IMAGE_BYTES) return out;
  // Faces are cropped to the centre; the logo must not be (its ring touches
  // the edges), so it is fitted to the square instead. PNG keeps transparency
  // (the logo on the dark header band) and gets one pass.
  const geometry = crop ? ["-Z", String(Math.round(size * 1.15)), "-c", String(size), String(size)] : ["-z", String(size), String(size)];
  for (const q of format === "png" ? [0] : [82, 70, 58]) {
    sips(["-s", "format", format, ...(q ? ["-s", "formatOptions", String(q)] : []), ...geometry, src, "--out", out]);
    if (statSync(out).size <= MAX_IMAGE_BYTES) return out;
  }
  warn(`${basename(src)} is still over ${MAX_IMAGE_BYTES} bytes after resizing`);
  return out;
}

// Width-constrained (hero / mood photo).
export function resizeWidth(src: string, width: number): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  const out = join(CACHE_DIR, cacheName(src, `-w${width}`));
  if (existsSync(out) && statSync(out).size <= MAX_HERO_BYTES) return out;
  // Text-heavy flyers (PNG posters) compress badly; step the width down too.
  for (const [w, q] of [[width, 72], [width, 58], [width, 45], [Math.round(width * 0.75), 55], [Math.round(width * 0.75), 40], [Math.round(width * 0.6), 40]]) {
    sips(["-s", "format", "jpeg", "-s", "formatOptions", String(q), "--resampleWidth", String(w), src, "--out", out]);
    if (statSync(out).size <= MAX_HERO_BYTES) return out;
  }
  warn(`${basename(src)} is still over ${MAX_HERO_BYTES} bytes after resizing`);
  return out;
}

export function imageDimensions(path: string): { width: number; height: number } {
  const r = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", path], { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`sips could not read ${basename(path)}: ${r.error?.message || r.stderr?.trim()}`);
  const w = Number(r.stdout.match(/pixelWidth:\s*(\d+)/)?.[1] ?? 0);
  const h = Number(r.stdout.match(/pixelHeight:\s*(\d+)/)?.[1] ?? 0);
  if (!w || !h) throw new Error(`sips returned no dimensions for ${basename(path)}`);
  return { width: w, height: h };
}

// ---------- hero with baked-in title ----------
// Email clients cannot layer text over an image (no background-image in Gmail
// or Outlook), so the title is rendered onto the photo itself: a local Chromium
// (Brave or Chrome) screenshots a small HTML page with the photo and outlined
// Anton text, then sips turns it into a JPEG under the hero budget. The result
// is cached by photo + text, so a re-run does not re-render or re-upload.
export interface HeroText { title: string; kicker?: string }

export function chromiumBinary(): string {
  for (const p of [
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]) if (existsSync(p)) return p;
  return "";
}

export function heroPageHtml(imageDataUrl: string, width: number, height: number, text: HeroText): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fontFace = existsSync(join(process.env.HOME || "", "Library/Fonts/Anton-Regular.ttf"))
    ? `@font-face{font-family:Anton;src:url("file://${join(process.env.HOME || "", "Library/Fonts/Anton-Regular.ttf")}");}` : "";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
${fontFace}
html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#0F0F10;}
.wrap{position:relative;width:${width}px;height:${height}px;}
img{position:absolute;inset:0;width:${width}px;height:${height}px;object-fit:cover;display:block;}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(15,15,16,0) 35%,rgba(15,15,16,0.72) 100%);}
.text{position:absolute;left:${Math.round(width * 0.05)}px;right:${Math.round(width * 0.05)}px;bottom:${Math.round(height * 0.08)}px;font-family:Anton,'Arial Black',Impact,sans-serif;text-transform:uppercase;color:#FFF3E0;}
.kicker{font-size:${Math.round(width * 0.028)}px;letter-spacing:0.18em;color:#FFD54F;margin:0 0 ${Math.round(width * 0.01)}px;-webkit-text-stroke:${Math.max(1, Math.round(width * 0.0015))}px #0F0F10;paint-order:stroke fill;}
.title{font-size:${Math.round(width * 0.11)}px;line-height:0.95;letter-spacing:0.01em;margin:0;-webkit-text-stroke:${Math.max(2, Math.round(width * 0.004))}px #0F0F10;paint-order:stroke fill;text-shadow:0 ${Math.round(width * 0.004)}px ${Math.round(width * 0.012)}px rgba(0,0,0,0.55);}
</style></head><body><div class="wrap"><img src="${imageDataUrl}" alt=""><div class="shade"></div><div class="text">${text.kicker ? `<p class="kicker">${esc(text.kicker)}</p>` : ""}<p class="title">${esc(text.title)}</p></div></div></body></html>`;
}

export function heroWithText(src: string, width: number, text: HeroText): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  const key = createHash("md5").update(`${sourceStamp(src)}|${width}|${text.kicker ?? ""}|${text.title}`).digest("hex").slice(0, 10);
  const png = join(CACHE_DIR, cacheName(src, `-hero-${key}`, "png"));
  if (existsSync(png) && statSync(png).size > 0) return png;
  const bin = chromiumBinary();
  if (!bin) throw new Error("no Brave or Chrome found to render the hero title; use --no-hero-text");
  const dim = imageDimensions(src);
  const height = Math.round((dim.height / dim.width) * width);
  const mime = /\.png$/i.test(src) ? "image/png" : "image/jpeg";
  const html = heroPageHtml(`data:${mime};base64,${readFileSync(src).toString("base64")}`, width, height, text);
  const page = png.replace(/\.png$/, ".html");
  writeFileSync(page, html);
  // Plain flags on purpose: a separate --user-data-dir or --virtual-time-budget
  // makes the new headless mode hang on this page; the plain call takes ~3s.
  const r = spawnSync(bin, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
    `--window-size=${width},${height}`, `--screenshot=${png}`, `file://${page}`,
  ], { stdio: ["ignore", "ignore", "pipe"], timeout: 60_000 });
  if (r.status !== 0 || !existsSync(png)) throw new Error(`hero render failed (${r.status ?? r.signal}): ${r.stderr?.toString().trim().slice(-300)}`);
  return png;
}

// ---------- upload cache ----------
const CACHE_FILE = join(CACHE_DIR, "uploads.json");

function readCache(): Record<string, string> {
  try { return JSON.parse(readFileSync(CACHE_FILE, "utf8")); } catch { return {}; }
}
function writeCache(c: Record<string, string>): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 2) + "\n");
}

// Hosted URL for a local file, uploading at most once per (name). The name
// carries the size so a re-cut photo gets a new entry; the cache is local
// only, and a missing cache falls back to a File Manager lookup by name.
export async function ensureUploaded(mc: Mailchimp, localPath: string, name = "iyf-email-" + basename(localPath)): Promise<string> {
  const cache = readCache();
  if (cache[name]) return cache[name];
  const existing = await mc.findFile(name);
  if (existing) { cache[name] = existing.full_size_url; writeCache(cache); return existing.full_size_url; }
  const f = await mc.uploadFile(name, readFileSync(localPath));
  cache[name] = f.full_size_url;
  writeCache(cache);
  return f.full_size_url;
}

// In --dry-run there is no upload; point at the local file so the preview
// still shows the picture.
export function localFileUrl(path: string): string {
  return "file://" + path;
}

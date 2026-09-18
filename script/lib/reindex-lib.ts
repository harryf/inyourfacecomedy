// Pure helpers for script/reindex.ts (no network, no git, no filesystem writes):
// changed source files to sitemap URLs, the last_modified_at bump rule and its
// front-matter rewrite, sitemap parsing, and the IndexNow request body.
// Design: docs/search-console.md, "Re-indexing after a change".

import { SITE_URL, frontMatterOf, sourcePath } from "./gsc-report-lib";

// Source files that render to a page of their own. Layouts, includes and Sass
// change every page at once; the caller is told to use --all for those.
export const PAGE_SOURCE_RE = /^(index\.html|_posts\/[^/]+\.md|_comedians\/[^/]+\.md|pages\/[^/]+\.md)$/;
export const TEMPLATE_SOURCE_RE = /^(_layouts\/|_includes\/|_sass\/|_config\.yml$|_data\/)/;

export interface ChangedPage { file: string; url: string }

// Map changed files to full URLs, keeping only URLs the sitemap lists (so tool pages
// with sitemap: false, redirects and deleted pages are never submitted).
export function changedPages(files: string[], readFile: (f: string) => string | undefined, sitemap: Map<string, string>): ChangedPage[] {
  const out: ChangedPage[] = [];
  for (const file of files) {
    if (!PAGE_SOURCE_RE.test(file)) continue;
    const text = readFile(file);
    if (text === undefined) continue;           // deleted in this range
    const path = sourcePath(file, frontMatterOf(text));
    if (!path) continue;
    const url = SITE_URL + path;
    if (sitemap.has(url)) out.push({ file, url });
  }
  return out;
}

export function templateChanged(files: string[]): string[] {
  return files.filter((f) => TEMPLATE_SOURCE_RE.test(f));
}

// ---------- sitemap ----------

export function parseSitemap(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const m of xml.matchAll(/<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]*)<\/lastmod>)?/g)) map.set(m[1].trim(), (m[2] ?? "").trim());
  return map;
}

// ---------- last_modified_at ----------

export const BUMP_TOLERANCE_MS = 10 * 60 * 1000;

// A page needs its stamp bumped when its last commit is clearly later than the
// stamp it carries: the generated pages stamp themselves in the same commit
// (seconds apart), a hand edit does not.
export function needsBump(lastModifiedAt: string | undefined, lastCommitIso: string): boolean {
  if (!lastModifiedAt) return true;
  const stamp = Date.parse(lastModifiedAt);
  const commit = Date.parse(lastCommitIso);
  if (Number.isNaN(stamp) || Number.isNaN(commit)) return true;
  return commit - stamp > BUMP_TOLERANCE_MS;
}

// Rewrite (or insert) the last_modified_at line in the front matter. Keeps the
// site's own format, UTC with +00:00, and the quoting style already on the line.
export function bumpFrontMatter(text: string, iso: string): string {
  const stamp = iso.replace(/\.\d{3}Z$/, "+00:00").replace(/Z$/, "+00:00");
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) throw new Error("no front matter");
  const fm = m[1];
  const lineRe = /^last_modified_at:\s*(["']?).*$/m;
  let newFm: string;
  if (lineRe.test(fm)) newFm = fm.replace(lineRe, (_all, q) => `last_modified_at: ${q}${stamp}${q}`);
  else if (/^description:.*$/m.test(fm)) newFm = fm.replace(/^(description:.*)$/m, `$1\nlast_modified_at: ${stamp}`);
  else newFm = `${fm}\nlast_modified_at: ${stamp}`;
  return text.replace(fm, newFm);
}

// ---------- IndexNow ----------

export function indexNowBody(urls: string[], key: string): { host: string; key: string; keyLocation: string; urlList: string[] } {
  const host = new URL(SITE_URL).host;
  return { host, key, keyLocation: `${SITE_URL}/${key}.txt`, urlList: [...new Set(urls)].slice(0, 10000) };
}

// ---------- Google URL inspection ----------

export interface Inspection { url: string; verdict: string; coverage: string; lastCrawl: string; indexing: string }

export function shapeInspection(url: string, result: any): Inspection {
  const r = result?.inspectionResult?.indexStatusResult ?? {};
  return { url, verdict: r.verdict ?? "UNKNOWN", coverage: r.coverageState ?? "", lastCrawl: r.lastCrawlTime ?? "", indexing: r.indexingState ?? "" };
}

export function inspectionLines(list: Inspection[]): string[] {
  return list.map((i) => `${i.url.replace(SITE_URL, "").padEnd(34)} ${i.verdict.padEnd(8)} ${i.coverage}${i.lastCrawl ? `, last crawled ${i.lastCrawl.slice(0, 16).replace("T", " ")}` : ""}`);
}

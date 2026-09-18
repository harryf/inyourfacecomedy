// Tests for script/lib/reindex-lib.ts. No network, no git.
import { describe, expect, test } from "bun:test";
import { bumpFrontMatter, changedPages, indexNowBody, inspectionLines, needsBump, parseSitemap, shapeInspection, templateChanged } from "../lib/reindex-lib";

const SITEMAP = `<?xml version="1.0"?><urlset>
<url><loc>https://inyourfacecomedy.ch/</loc><lastmod>2026-09-18T14:15:53+02:00</lastmod></url>
<url><loc>https://inyourfacecomedy.ch/comedybrew/</loc><lastmod>2026-09-18T09:00:01+02:00</lastmod></url>
<url><loc>https://inyourfacecomedy.ch/comedians/emir-tonbul/</loc><lastmod>2026-09-18T21:28:24+02:00</lastmod></url>
<url><loc>https://inyourfacecomedy.ch/assets/x.png</loc></url>
</urlset>`;

describe("sitemap", () => {
  test("parseSitemap maps loc to lastmod", () => {
    const m = parseSitemap(SITEMAP);
    expect(m.size).toBe(4);
    expect(m.get("https://inyourfacecomedy.ch/comedybrew/")).toBe("2026-09-18T09:00:01+02:00");
    expect(m.get("https://inyourfacecomedy.ch/assets/x.png")).toBe("");
  });
});

describe("changed pages", () => {
  const files: Record<string, string> = {
    "index.html": `---\ntitle: Home\n---\n`,
    "_posts/2024-01-18-comedybrew.md": `---\ntitle: Brew\npermalink: /comedybrew/\n---\n`,
    "_comedians/emir-tonbul.md": `---\ntitle: Emir\n---\n`,
    "pages/lineup.md": `---\ntitle: Lineup\npermalink: /lineup/\nsitemap: false\n---\n`,
    "_posts/2020-01-01-nolink.md": `---\ntitle: x\n---\n`,
  };
  const read = (f: string) => files[f];
  const sitemap = parseSitemap(SITEMAP);
  test("keeps page sources that the sitemap lists, drops tool pages, unmapped posts, deleted and non-page files", () => {
    const out = changedPages([...Object.keys(files), "_layouts/home.liquid", "_comedians/gone.md", "docs/x.md"], read, sitemap);
    expect(out).toEqual([
      { file: "index.html", url: "https://inyourfacecomedy.ch/" },
      { file: "_posts/2024-01-18-comedybrew.md", url: "https://inyourfacecomedy.ch/comedybrew/" },
      { file: "_comedians/emir-tonbul.md", url: "https://inyourfacecomedy.ch/comedians/emir-tonbul/" },
    ]);
  });
  test("templateChanged flags layouts, includes, sass, config and data", () => {
    expect(templateChanged(["_layouts/home.liquid", "_includes/default/head.liquid", "_sass/a.scss", "_config.yml", "_data/calendar.yml", "index.html", "script/x.ts"]))
      .toEqual(["_layouts/home.liquid", "_includes/default/head.liquid", "_sass/a.scss", "_config.yml", "_data/calendar.yml"]);
  });
});

describe("last_modified_at", () => {
  test("needsBump when the last commit is more than ten minutes after the stamp, or the stamp is missing", () => {
    expect(needsBump("2026-09-18T12:15:53+00:00", "2026-09-18T21:30:00+02:00")).toBe(true);
    expect(needsBump("2026-09-18T19:28:24+00:00", "2026-09-18T21:29:10+02:00")).toBe(false);   // generated page, seconds apart
    expect(needsBump(undefined, "2026-09-18T21:29:10+02:00")).toBe(true);
    expect(needsBump("garbage", "2026-09-18T21:29:10+02:00")).toBe(true);
  });
  test("bumpFrontMatter rewrites the stamp keeping the quoting, or inserts it after description", () => {
    const quoted = `---\ntitle: "Emir"\nlast_modified_at: "2026-05-30T13:30:04+00:00"\nslug: "emir"\n---\nbody`;
    expect(bumpFrontMatter(quoted, "2026-09-18T19:40:00.123Z")).toBe(`---\ntitle: "Emir"\nlast_modified_at: "2026-09-18T19:40:00+00:00"\nslug: "emir"\n---\nbody`);
    const bare = `---\ntitle: x\nlast_modified_at: 2026-05-25T12:00:00+00:00\npermalink: /switzerland/\n---\n# body`;
    expect(bumpFrontMatter(bare, "2026-09-18T19:40:00Z")).toContain("last_modified_at: 2026-09-18T19:40:00+00:00\npermalink");
    const none = `---\nlayout: page\ntitle: x\ndescription: "d"\npermalink: /y/\n---\n`;
    expect(bumpFrontMatter(none, "2026-09-18T19:40:00Z")).toBe(`---\nlayout: page\ntitle: x\ndescription: "d"\nlast_modified_at: 2026-09-18T19:40:00+00:00\npermalink: /y/\n---\n`);
    expect(() => bumpFrontMatter("no front matter", "2026-09-18T19:40:00Z")).toThrow(/front matter/);
  });
});

describe("indexnow and inspection", () => {
  test("indexNowBody carries host, key, key location and a deduplicated list", () => {
    const b = indexNowBody(["https://inyourfacecomedy.ch/", "https://inyourfacecomedy.ch/", "https://inyourfacecomedy.ch/comedybrew/"], "abc");
    expect(b).toEqual({ host: "inyourfacecomedy.ch", key: "abc", keyLocation: "https://inyourfacecomedy.ch/abc.txt", urlList: ["https://inyourfacecomedy.ch/", "https://inyourfacecomedy.ch/comedybrew/"] });
  });
  test("shapeInspection reads the index status and inspectionLines prints one line per url", () => {
    const i = shapeInspection("https://inyourfacecomedy.ch/comedybrew/", { inspectionResult: { indexStatusResult: { verdict: "PASS", coverageState: "Submitted and indexed", lastCrawlTime: "2026-09-17T03:12:00Z", indexingState: "INDEXING_ALLOWED" } } });
    expect(i.verdict).toBe("PASS");
    expect(inspectionLines([i])[0]).toBe("/comedybrew/                       PASS     Submitted and indexed, last crawled 2026-09-17 03:12");
    expect(shapeInspection("u", {}).verdict).toBe("UNKNOWN");
  });
});

// Pure helpers for script/ga-report.ts (no network, no filesystem writes): show
// discovery from _posts front matter, GA row shaping, aggregation, CSV. Kept
// separate so `bun test` can pin the behaviour without touching Google.
// Design: docs/campaign-links.md, "Show reports".

export interface Show {
  slug: string;
  title: string;
  ticketUrl: string;
  eventType: string;
}

// One GA row after flattening: a minute bucket of identical-dimension events.
export interface ClickRow {
  datetime: string;   // "YYYY-MM-DD HH:MM" in the property's timezone
  date: string;       // "YYYY-MM-DD"
  event: "ticket_redirect" | "ticket_click";
  source: string;
  medium: string;
  campaign: string;
  content: string;
  page: string;
  query: string;      // query string of the page the event fired on, no leading "?"
  link: string;       // customEvent:link — "source|medium|campaign|content" of the clicked /go/ link; "(not set)" / "" when absent
  count: number;
}

// Clicks that arrive without UTM tags still carry an ad-network click id in the
// URL. GA cannot attribute those (it only auto-tags gclid), so a Meta ad using the
// bare /go/ link shows up as direct. Infer what we can and label it honestly, so
// the runner sees "meta / untagged" rather than a mysterious direct spike, and
// the organiser sees which ad needs its link swapped for a tagged one.
const CLICK_IDS: [RegExp, string][] = [
  [/(^|&)fbclid=/, "meta"],
  [/(^|&)ttclid=/, "tiktok"],
  [/(^|&)gclid=/, "google"],
];
export interface Attribution { source: string; medium: string; campaign: string; content: string }

// Attribute a click by the link that was actually clicked, not by GA's session.
// GA's session* dimensions carry the campaign that OPENED the session to every
// later event in it, so a bare /go/?show=comedybrew loaded in a session that began
// from a Nerdy ad link came out as "nerdycomedyshow" on the Comedy Brew report.
// GA strips utm_* from its page-URL dimensions, so /go/ sends the clicked link's tags
// itself as the `link` event parameter ("source|medium|campaign|content"), registered as
// an event-scoped custom dimension on LINK_SINCE. Order: the `link` dimension wins;
// else utm_* in the query (kept in case GA ever stops stripping them); else a network
// click id means an untagged ad; else a /go/ redirect from LINK_SINCE on with nothing
// on it is direct (never inherit a session campaign); else (site buttons, whose URL
// carries no tags, and redirects older than the dimension) the session values.
export const LINK_SINCE = "2026-08-30";
export function attribute(row: Pick<ClickRow, "event" | "date" | "source" | "medium" | "campaign" | "content" | "query" | "link">): Attribution {
  const link = clean(row.link ?? "");
  if (link) {
    const [source, medium, campaign, content] = link.split("|").map((s) => s.trim());
    return { source: source || "(direct)", medium: medium || "(none)", campaign: campaign || "", content: content || "" };
  }
  const q = new URLSearchParams(row.query);
  const utm = (k: string) => clean(q.get(`utm_${k}`) ?? "");
  if (utm("source") || utm("campaign")) {
    return { source: utm("source") || "(direct)", medium: utm("medium") || "(none)", campaign: utm("campaign"), content: utm("content") };
  }
  const clickId = CLICK_IDS.find(([re]) => re.test(row.query))?.[1];
  if (row.event === "ticket_redirect" && row.date >= LINK_SINCE) {
    // The link dimension exists and is empty: the link really had no tags.
    return clickId ? { source: clickId, medium: "untagged", campaign: "", content: "" } : { source: "(direct)", medium: "(none)", campaign: "", content: "" };
  }
  // Older redirects and site buttons: GA stripped the tags from the URL, so a tagged
  // Meta click (fbclid + session campaign) and an untagged one (fbclid + no session
  // source) are only told apart by whether GA managed to attribute the session.
  const source = clean(row.source);
  if (source) return { source, medium: clean(row.medium) || "(none)", campaign: clean(row.campaign), content: clean(row.content) };
  return clickId ? { source: clickId, medium: "untagged", campaign: "", content: "" } : { source: "(direct)", medium: "(none)", campaign: "", content: "" };
}

export interface PageRow {
  date: string;
  source: string;
  medium: string;
  campaign: string;
  sessions: number;
  views: number;
}

export interface DayStat { date: string; redirect: number; click: number; views: number; provisional: boolean; clicks_tracked: boolean }
export interface SourceStat { source: string; medium: string; clicks: number; views: number; sessions: number }
export interface CampaignStat { campaign: string; source: string; medium: string; clicks: number; first: string; last: string; content: { content: string; clicks: number }[] }

export interface Report {
  slug: string;
  title: string;
  ticket_url: string;
  event_type: string;
  generated_at: string;        // ISO, UTC
  since: string;               // first date with ticket click data
  pages_since: string;         // first date with show page visits (30-day backfill)
  through: string;             // last date covered (partial)
  complete_through: string;    // last date GA has fully processed
  totals: {
    clicks: number; redirect: number; click: number;
    clicks_30d: number; redirect_30d: number; click_30d: number;
    views: number; views_30d: number; sessions: number; sessions_30d: number;
    broken_links: number;
    untagged: number;          // ticket clicks whose link carried a click id but no UTM tags
  };
  by_day: DayStat[];
  by_source: SourceStat[];
  by_campaign: CampaignStat[];
  csv: string;                 // site path to the CSV download
}

// Local dev and preview-build hosts that leak into GA as referrers. Filtered at
// the source so a show runner's "where did my traffic come from" table never
// lists localhost. Matches the sessionSource dimension value.
export const NOISE_SOURCE_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$|\.pages\.dev$|^inyourfacecomedy\.ch$/i;

export function isNoiseSource(source: string): boolean {
  return NOISE_SOURCE_RE.test(source.trim());
}

// ---------------------------------------------------------------------------
// Show discovery: any _posts file with a ticket_url is a show, slug from permalink.
// Front matter is read line-by-line (the fields we need are all single-line
// scalars) rather than pulling in a YAML dependency.
export function parseShow(frontMatter: string): Show | null {
  const get = (key: string): string | undefined => {
    const m = frontMatter.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m"));
    if (!m) return undefined;
    return m[1].replace(/^["']|["']$/g, "");
  };
  const ticketUrl = get("ticket_url");
  const permalink = get("permalink");
  if (!ticketUrl || !permalink) return null;
  const slug = permalink.replace(/^\/|\/$/g, "");
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  return {
    slug,
    title: primaryTitle(get("title") ?? slug),
    ticketUrl: get("ticket_url_resolved") ?? ticketUrl,
    eventType: get("event_type") ?? "one-off",
  };
}

// Post titles are SEO-length ("Comedy Brew • English Stand-Up ... Zürich"); the
// report wants the show's name. Same split the link builder uses.
export function primaryTitle(title: string): string {
  return title.split(/\s*[•|]\s*|:\s+|\s+-\s+/)[0].trim() || title;
}

export function frontMatterOf(fileText: string): string {
  const m = fileText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : "";
}

// ---------------------------------------------------------------------------
// Date helpers. GA returns yyyymmdd / yyyymmddhhmm strings in the property timezone.
export function gaDate(d: string): string {
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
export function gaDateTime(d: string): string {
  return `${gaDate(d)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
}
export function addDays(iso: string, n: number): string {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation.
// GA placeholder values mean "nothing known": "(not set)", "(none)", "(direct)",
// "(organic)", "(referral)", "(data not available)", "(cross-network)"... every
// one of them is parenthesised, and no real UTM value from the link builder is.
const clean = (v: string): string => (/^\(.*\)$/.test(v.trim()) ? "" : v);

export function aggregate(opts: {
  show: Show;
  clicks: ClickRow[];
  pages: PageRow[];
  brokenLinks: number;
  since: string;              // first date with click events (launch of /go/ + ticket_click)
  pagesSince?: string;        // first date with page visits; may be earlier than `since`
  today: string;              // property-local date of the run
  generatedAt: string;
  csvPath: string;
}): Report {
  const { show, since, today } = opts;
  const pagesSince = opts.pagesSince && opts.pagesSince < since ? opts.pagesSince : since;
  const clicks = opts.clicks.filter((r) => !isNoiseSource(r.source));
  const pages = opts.pages.filter((r) => !isNoiseSource(r.source));
  const completeThrough = addDays(today, -2);
  const cutoff30 = addDays(today, -29);

  const days = new Map<string, DayStat>();
  // Days before `since` have visits but no click counts (the events did not exist yet).
  for (const d of dateRange(pagesSince, today)) days.set(d, { date: d, redirect: 0, click: 0, views: 0, provisional: d > completeThrough, clicks_tracked: d >= since });
  const src = new Map<string, SourceStat>();
  const camp = new Map<string, CampaignStat>();
  const keyS = (s: string, m: string) => `${s} ${m}`;

  let redirect = 0, click = 0, redirect30 = 0, click30 = 0, untagged = 0;
  for (const r of clicks) {
    const day = days.get(r.date);
    if (day) { if (r.event === "ticket_redirect") day.redirect += r.count; else day.click += r.count; }
    if (r.event === "ticket_redirect") { redirect += r.count; if (r.date >= cutoff30) redirect30 += r.count; }
    else { click += r.count; if (r.date >= cutoff30) click30 += r.count; }

    const { source, medium, campaign, content } = attribute(r);
    if (medium === "untagged") untagged += r.count;
    const s = src.get(keyS(source, medium)) ?? { source, medium, clicks: 0, views: 0, sessions: 0 };
    s.clicks += r.count; src.set(keyS(source, medium), s);

    if (campaign && r.event === "ticket_redirect") {
      const k = `${campaign} ${source} ${medium}`;
      const c = camp.get(k) ?? { campaign, source, medium, clicks: 0, first: r.date, last: r.date, content: [] };
      c.clicks += r.count;
      if (r.date < c.first) c.first = r.date;
      if (r.date > c.last) c.last = r.date;
      if (content) {
        const cc = c.content.find((x) => x.content === content);
        if (cc) cc.clicks += r.count; else c.content.push({ content, clicks: r.count });
      }
      camp.set(k, c);
    }
  }

  let views = 0, views30 = 0, sessions = 0, sessions30 = 0;
  for (const p of pages) {
    const day = days.get(p.date);
    if (day) day.views += p.views;
    views += p.views; sessions += p.sessions;
    if (p.date >= cutoff30) { views30 += p.views; sessions30 += p.sessions; }
    const source = clean(p.source) || "(direct)";
    const medium = clean(p.medium) || "(none)";
    const s = src.get(keyS(source, medium)) ?? { source, medium, clicks: 0, views: 0, sessions: 0 };
    s.views += p.views; s.sessions += p.sessions; src.set(keyS(source, medium), s);
  }

  const by_source = [...src.values()].sort((a, b) => b.clicks - a.clicks || b.sessions - a.sessions || a.source.localeCompare(b.source));
  const by_campaign = [...camp.values()].map((c) => ({ ...c, content: c.content.sort((a, b) => b.clicks - a.clicks) }))
    .sort((a, b) => b.clicks - a.clicks || a.campaign.localeCompare(b.campaign));

  return {
    slug: show.slug,
    title: show.title,
    ticket_url: show.ticketUrl,
    event_type: show.eventType,
    generated_at: opts.generatedAt,
    since,
    pages_since: pagesSince,
    through: today,
    complete_through: completeThrough,
    totals: {
      clicks: redirect + click, redirect, click,
      clicks_30d: redirect30 + click30, redirect_30d: redirect30, click_30d: click30,
      views, views_30d: views30, sessions, sessions_30d: sessions30,
      broken_links: opts.brokenLinks,
      untagged,
    },
    by_day: [...days.values()],
    by_source,
    by_campaign,
    csv: opts.csvPath,
  };
}

// ---------------------------------------------------------------------------
// CSV: one row per click, oldest first, for reconciliation against the Eventfrog
// sales report. GA hands us minute buckets (count per identical-dimension row);
// a bucket of n becomes n identical rows so the runner never has to multiply.
// "page" is where the click happened: "Ticket Redirect" for the /go/ campaign
// hop, else the full page URL. RFC 4180 quoting.
export const CSV_HEADER = ["datetime", "event", "source", "medium", "campaign", "content", "page"];

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function pageLabel(path: string, siteUrl: string): string {
  return path === "/go/" ? "Ticket Redirect" : siteUrl.replace(/\/$/, "") + path;
}

export function toCsv(rows: ClickRow[], siteUrl: string): string {
  const sorted = rows.filter((r) => !isNoiseSource(r.source))
    .sort((a, b) => a.datetime.localeCompare(b.datetime) || a.event.localeCompare(b.event));
  const lines = [CSV_HEADER.join(",")];
  for (const r of sorted) {
    const { source, medium, campaign, content } = attribute(r);
    const line = [r.datetime, r.event, source, medium, campaign, content, pageLabel(r.page, siteUrl)].map(csvCell).join(",");
    for (let i = 0; i < r.count; i++) lines.push(line);
  }
  return lines.join("\n") + "\n";
}

// Stub page content for pages/reports/<slug>.md. Regenerated every run; stable
// text so an unchanged show produces no diff.
export function reportPage(show: Show): string {
  return [
    "---",
    "layout: report",
    `title: "${show.title.replace(/"/g, '\\"')}"`,
    `subtitle: "Traffic report"`,
    `permalink: /reports/${show.slug}/`,
    `report: ${show.slug}`,
    "# Generated by script/ga-report.ts. Unlisted: no index, no sitemap, no nav.",
    "noindex: true",
    "sitemap: false",
    "hide: true",
    "---",
    "",
  ].join("\n");
}

// Tests for script/lib/email/*: link parsing, slug resolution, copy validation,
// calendar grouping and date lines, the rendered HTML's email-client rules, the
// plain-text twin, tag parsing. No network, no Mailchimp, no filesystem writes.
import { describe, expect, test } from "bun:test";
import { parseArgs } from "../lib/email/cli";
import { parseEventTag } from "../lib/email/mailchimp";
import {
  GMAIL_CLIP_BYTES, GREETING_MERGE, MAX_HTML_BYTES, checkHtml, extractLinks, inline, previewHtml, renderHtml, renderText, type EmailDoc,
} from "../lib/email/render";
import {
  calendarEvents, calendarStale, comedianFromFrontMatter, datesFor, datesLine, findComedian, findShow, fmtDate, frontMatterOf, groupByShow,
  instagramHandle, norm, shortName, showFromFrontMatter, weekdayOf, type CalendarEvent,
} from "../lib/email/site";
import { cleanText, extractJson, placeholderCopy, renderPrompt, validateCopy, wordCount } from "../lib/email/copy";
import { isGuest, guestName, parseThankyouLink, resolvePeople, tagMatchesShow, whenPhrase } from "../email-thankyou";
import { heroTitleFor, keepForMonthly, pickHero, windowFor } from "../email-monthly";
import { emailsFrom, segmentNameFor } from "../email-promo";
import { heroPageHtml } from "../lib/email/images";

const LINK = "https://inyourfacecomedy.ch/comedians/?show=comedybrew&host=martinadoescomedy&first=coopernik,milad,guest%3AGina%20Greco,ludovica,mateo-gudenrath&second=sussmancomedy,guest%3AF%C3%A4be,valerie-mirindi,woocash,pouya&thankyou";

const comedian = (slug: string, name = slug, ig = `https://instagram.com/${slug}`) =>
  comedianFromFrontMatter({ title: name, slug, photo: `/assets/img/comedians/${slug}.jpg`, instagram: ig }, slug);
const ROSTER = ["martinadoescomedy", "coopernik", "milad", "ludovica", "mateo-gudenrath", "sussmancomedy", "valerie-mirindi", "woocash", "pouya"].map((s) => comedian(s));

const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({
  show: "comedybrew", name: "Comedy Brew", title: "Comedy Brew", url: "https://inyourfacecomedy.ch/comedybrew/", date: "2026-09-10",
  start: "2026-09-10T19:30:00+02:00", end: "", venue: "robins", venueName: "ROBIN's", location: "ROBIN's Coffee", priceChf: 10, ticketUrl: "https://eventfrog.ch/x", eventfrogName: "IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic", ...o,
});

const doc = (blocks: EmailDoc["blocks"], extra: Partial<EmailDoc> = {}): EmailDoc => ({
  subject: "Thanks for coming", preheader: "You were brilliant", lang: "en", greeting: GREETING_MERGE, logoUrl: "https://mcusercontent.com/x/logo.png",
  siteUrl: "https://inyourfacecomedy.ch", calendarUrl: "https://inyourfacecomedy.ch/calendar/", blocks, ...extra,
});

describe("thank-you link", () => {
  test("parses show, host, halves and guest tokens", () => {
    const l = parseThankyouLink(LINK);
    expect(l.show).toBe("comedybrew");
    expect(l.host).toEqual(["martinadoescomedy"]);
    expect(l.first).toEqual(["coopernik", "milad", "guest:Gina Greco", "ludovica", "mateo-gudenrath"]);
    expect(l.second[1]).toBe("guest:Fäbe");
    expect(l.thankyou).toBe(true);
  });
  test("thankyou=0 is off; relative links resolve against the site", () => {
    expect(parseThankyouLink("/comedians/?show=brexiles&thankyou=0").thankyou).toBe(false);
    expect(parseThankyouLink("/comedians/?show=brexiles&thankyou").show).toBe("brexiles");
  });
  test("guest tokens", () => {
    expect(isGuest("guest:Gina Greco")).toBe(true);
    expect(guestName("guest: Fäbe ")).toBe("Fäbe");
    expect(isGuest("woocash")).toBe(false);
  });
  test("resolvePeople keeps order, places each once, keeps guests, reports unknowns", () => {
    const seen = new Set<string>();
    const misses: string[] = [];
    const a = resolvePeople(["martinadoescomedy"], ROSTER, seen, misses);
    const b = resolvePeople(["CooperNik", "guest:Gina Greco", "nobody-here", "martinadoescomedy", "guest:gina greco"], ROSTER, seen, misses);
    expect(a.map((p) => p.name)).toEqual(["martinadoescomedy"]);
    expect(b.map((p) => [p.name, p.guest])).toEqual([["coopernik", false], ["Gina Greco", true]]);
    expect(misses).toEqual(["nobody-here"]);
  });
  test("whenPhrase", () => {
    expect(whenPhrase("2026-09-03", "2026-09-04")).toBe("last night");
    expect(whenPhrase("2026-09-03", "2026-09-06")).toBe("on Thursday");
    expect(whenPhrase("2026-08-20", "2026-09-06")).toBe("on Thu 20 Aug");
    expect(whenPhrase("2026-09-06", "2026-09-06")).toBe("tonight");
  });
  test("tag matches the show by name or Eventfrog name", () => {
    const show = showFromFrontMatter({ title: "Comedy Brew • English Stand-Up", permalink: "/comedybrew/", ticket_url: "x" })!;
    expect(tagMatchesShow("IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic 3.9.2026 19:30, ROBIN's Coffee", show, [])).toBe(true);
    expect(tagMatchesShow("Offside Comedy - Comedy for people who hate balls 28.7.2026 19:30, ROBIN's", show, [])).toBe(false);
    const promessi = showFromFrontMatter({ title: "PROMESSI SPASSI - Stand-up comedy italiana", permalink: "/promessi-spassi/", ticket_url: "x" })!;
    expect(tagMatchesShow("Promessi Spassi Stand-up comedy italiana a Zurigo 16.9.2026 20:00, ROBIN's", promessi, ["Promessi Spassi Stand-up comedy italiana a Zurigo"])).toBe(true);
  });
});

describe("mailchimp tag names", () => {
  test("parseEventTag", () => {
    expect(parseEventTag("IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic 3.9.2026 19:30, ROBIN's Coffee"))
      .toEqual({ eventName: "IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic", date: "2026-09-03", time: "19:30", location: "ROBIN's Coffee" });
    expect(parseEventTag("basel")).toBeNull();
  });
});

describe("site data", () => {
  test("front matter and show shaping", () => {
    const fm = frontMatterOf(`---\ntitle: "Comedy Brew • English Stand-Up • EVERY Thursday"\npermalink: /comedybrew/\nticket_url: https://eventfrog.ch/x\nevent_type: series\nrecurrence_day: Thursday\nvenue_slug: robins\nprice_chf: 10\nthumbnail: "assets/img/thumbs/comedybrew.png"\n---\nbody`);
    const s = showFromFrontMatter(fm)!;
    expect(s.slug).toBe("comedybrew");
    expect(s.name).toBe("Comedy Brew");
    expect(s.url).toBe("https://inyourfacecomedy.ch/comedybrew/");
    expect(s.thumbnail).toBe("https://inyourfacecomedy.ch/assets/img/thumbs/comedybrew.png");
    expect(s.priceChf).toBe(10);
    expect(showFromFrontMatter({ title: "no tickets" })).toBeNull();
  });
  test("names, slugs, handles", () => {
    expect(shortName("PROMESSI SPASSI - Stand-up comedy italiana a Zurigo")).toBe("PROMESSI SPASSI");
    expect(norm("Pulp-Non-Fiction")).toBe("pulpnonfiction");
    expect(instagramHandle("https://instagram.com/cooper_nik")).toBe("@cooper_nik");
    expect(instagramHandle("")).toBe("");
    expect(findComedian(ROSTER, "mateo_gudenrath")?.slug).toBe("mateo-gudenrath");
    expect(findShow([showFromFrontMatter({ title: "Jackpot Comedy", permalink: "/jackpotcomedy/", ticket_url: "x" })!], "jackpot-comedy")?.slug).toBe("jackpotcomedy");
  });
  test("calendar parsing, dates, grouping", () => {
    const events = calendarEvents({ events: [
      { show: "comedybrew", name: "Comedy Brew", url: "/comedybrew/", date: "2026-09-10", start: "2026-09-10T19:30:00+02:00", venue: "robins", venue_name: "ROBIN's", price_chf: 10 },
      { show: "comedybrew", name: "Comedy Brew", url: "/comedybrew/", date: new Date("2026-09-17"), start: "2026-09-17T19:30:00+02:00", venue: "robins", venue_name: "ROBIN's" },
      { show: "latarima", name: "La Tarima", url: "/latarima/", date: "2026-10-01", start: "2026-10-01T19:30:00+02:00", venue: "goldfisch-club", venue_name: "Goldfisch Club" },
      { show: "comedybrew", name: "Comedy Brew", url: "/comedybrew/", date: "2026-10-01", start: "2026-10-01T19:30:00+02:00", venue: "robins", venue_name: "ROBIN's" },
    ] });
    expect(events[1].date).toBe("2026-09-17");
    expect(events[0].url).toBe("https://inyourfacecomedy.ch/comedybrew/");
    expect(datesFor(events, "comedy-brew", "2026-09-11").map((e) => e.date)).toEqual(["2026-09-17", "2026-10-01"]);
    const g = groupByShow(events, "2026-09-01", "2026-10-05");
    expect(g.map((x) => [x.show, x.events.length])).toEqual([["comedybrew", 3], ["latarima", 1]]);
    expect(datesLine(g[0].events)).toBe("Thu 10, 17 Sep, 1 Oct");
    expect(datesLine([ev({ date: "2026-09-06" }), ev({ date: "2026-09-09" })])).toBe("6, 9 Sep");
    expect(fmtDate("2026-09-10")).toBe("Thu 10 Sep");
    expect(fmtDate("2026-09-10", { weekday: false, year: true, month: "long" })).toBe("10 September 2026");
    expect(weekdayOf("2026-09-10")).toBe("Thursday");
  });
  test("calendarStale", () => {
    const now = Date.parse("2026-09-06T12:00:00Z");
    expect(calendarStale("2026-09-05T09:25:31+00:00", 36, now)).toBe(false);
    expect(calendarStale("2026-09-03T09:25:31+00:00", 36, now)).toBe(true);
    expect(calendarStale("", 36, now)).toBe(true);
  });
});

describe("monthly window and hero", () => {
  test("windowFor", () => {
    expect(windowFor({ month: "2026-10" }, "2026-09-06")).toEqual({ from: "2026-10-01", to: "2026-10-31", label: "October 2026", month: true });
    expect(windowFor({ month: "2026-09" }, "2026-09-06").from).toBe("2026-09-06");
    expect(windowFor({ weeks: "2" }, "2026-09-06")).toEqual({ from: "2026-09-06", to: "2026-09-19", label: "September 2026", month: false });
    expect(() => windowFor({ month: "Oct" }, "2026-09-06")).toThrow();
  });
  test("keepForMonthly: English anywhere, other languages only at ROBIN's", () => {
    const show = (language: string) => showFromFrontMatter({ title: "x", permalink: "/x/", ticket_url: "x", language })!;
    expect(keepForMonthly(show("en"), "goldfisch-club")).toBe(true);
    expect(keepForMonthly(show("es"), "goldfisch-club")).toBe(false);
    expect(keepForMonthly(show("it"), "robins")).toBe(true);
    expect(keepForMonthly(undefined, "otro")).toBe(true);
    expect(showFromFrontMatter({ title: "x", permalink: "/x/", ticket_url: "x" })!.language).toBe("en");
  });
  test("heroTitleFor", () => {
    expect(heroTitleFor({ from: "2026-10-01", label: "October 2026", month: true })).toEqual({ title: "October Comedy", kicker: "Shows this month" });
    expect(heroTitleFor({ from: "2026-09-06", label: "September 2026", month: false }, "Autumn Comedy")).toEqual({ title: "Autumn Comedy", kicker: "What's on next" });
  });
  test("heroPageHtml carries the text with an outline and the photo", () => {
    const h = heroPageHtml("data:image/jpeg;base64,AAAA", 1200, 800, { title: "October Comedy", kicker: "Shows this month" });
    expect(h).toContain("October Comedy");
    expect(h).toContain("-webkit-text-stroke");
    expect(h).toContain("text-transform:uppercase");
    expect(h).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(h).toContain("<p class=\"kicker\">Shows this month</p>");
  });
  test("pickHero prefers featured audience shots by aesthetic", () => {
    const g = [
      { src: "a", path: "a", type: "performer", featured: true, aesthetic: 0.9, date: "2026-01-01", alt: "" },
      { src: "b", path: "b", type: "audience", featured: true, aesthetic: 0.4, date: "2026-01-01", alt: "" },
      { src: "c", path: "c", type: "audience", featured: true, aesthetic: 0.7, date: "2025-01-01", alt: "" },
      { src: "d", path: "d", type: "audience", featured: false, aesthetic: 0.95, date: "2026-01-01", alt: "" },
    ];
    expect(pickHero(g)?.src).toBe("c");
    expect(pickHero([])).toBeUndefined();
  });
});

describe("promo inputs", () => {
  test("emailsFrom finds addresses anywhere in a CSV, lowercased, deduped", () => {
    expect(emailsFrom("Name,Email\nGina,Gina@Example.com\nx, gina@example.com ;other@test.ch\n")).toEqual(["gina@example.com", "other@test.ch"]);
  });
  test("segmentNameFor", () => {
    expect(segmentNameFor(["promessi-spassi"], "2026-09-06")).toBe("promo-promessi-spassi-2026-09-06");
  });
});

describe("copy validation", () => {
  test("accepts a good thank-you and fixes dashes", () => {
    const { copy, fixes } = validateCopy("thankyou", { subject: "Thanks for coming to Comedy Brew", preheader: "You were brilliant", paragraphs: ["Nice room \u2014 really.", "Go say hi."], ps: "" });
    expect((copy as { paragraphs: string[] }).paragraphs[0]).toBe("Nice room, really.");
    expect(fixes.length).toBe(1);
    expect("ps" in copy).toBe(false);
  });
  test("rejects a four-word preheader, a long subject, missing pieces", () => {
    expect(() => validateCopy("thankyou", { subject: "x", preheader: "one two three four", paragraphs: ["a"] })).toThrow(/three words/);
    expect(() => validateCopy("thankyou", { subject: "x".repeat(51), preheader: "one two three", paragraphs: ["a"] })).toThrow(/51 chars/);
    expect(() => validateCopy("promo", { subject: "x", preheader: "one two three", paragraphs: ["a"] })).toThrow(/cta missing/);
    expect(() => validateCopy("monthly", { subject: "x", preheader: "one two three", opener: ["a"], lead: "b", closing: "c", shows: [] })).toThrow(/shows/);
  });
  test("monthly blurbs are capped and keyed by slug", () => {
    const { copy } = validateCopy("monthly", { subject: "October", preheader: "Dates inside now", opener: ["Hi"], lead: "Lead", closing: "Bye", shows: [{ slug: "comedybrew", emoji: "🎤", blurb: "Short blurb at ROBIN's." }] });
    expect((copy as { shows: Array<{ slug: string }> }).shows[0].slug).toBe("comedybrew");
    expect(() => validateCopy("monthly", { subject: "x", preheader: "one two three", opener: ["a"], lead: "b", closing: "c", shows: [{ slug: "s", emoji: "", blurb: "w ".repeat(40) }] })).toThrow(/words/);
  });
  test("helpers", () => {
    expect(wordCount("  You were   brilliant ")).toBe(3);
    expect(cleanText("a \u2013 b \u2014 c")).toBe("a, b, c");
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(() => extractJson("no json here")).toThrow();
    const p = renderPrompt("## System\nBe brief.\n\n## User\nShow: ${show}\n", { show: "Brew" });
    expect(p.system).toBe("Be brief.");
    expect(p.user).toBe("Show: Brew");
    expect(() => renderPrompt("## System\na\n## User\n${missing}", {})).toThrow(/missing/);
  });
  test("placeholder copy passes validation for all three types", () => {
    for (const t of ["thankyou", "monthly", "promo"] as const) {
      expect(() => validateCopy(t, placeholderCopy(t, { show_name: "Comedy Brew", show_slugs: "comedybrew,latarima", month_label: "October 2026" }))).not.toThrow();
    }
  });
});

describe("render", () => {
  const faces = { kind: "faces" as const, groups: [
    { label: "Host", people: [{ name: "Martina", handle: "@martinadoescomedy", href: "https://instagram.com/martinadoescomedy", img: "https://mcusercontent.com/x/m.jpg" }] },
    { label: "First half", people: [{ name: "Gina Greco", handle: "", href: "", img: "", label: "guest" }] },
  ] };
  const full = doc([
    { kind: "paragraph", text: "Thanks for coming to **Comedy Brew** [last night](https://inyourfacecomedy.ch/comedybrew/)." },
    { kind: "showCard", emoji: "🎤", name: "Comedy Brew", href: "https://inyourfacecomedy.ch/comedybrew/", date: "2026-09-10", eyebrow: "Thu · 19:30 · ROBIN's", datesLine: "Thu 10, 17 Sep", blurb: "Cold beer, hot takes." },
    { kind: "button", label: "See all our shows", href: "https://inyourfacecomedy.ch/calendar/" },
    { kind: "heading", text: "Who you saw" },
    faces,
    { kind: "signoff", lines: ["See you at the next one,", "Harry & the IN YOUR FACE Comedy Crew"] },
  ]);
  const html = renderHtml(full);

  test("passes the email-client rules and stays small", () => {
    expect(checkHtml(html)).toEqual([]);
    expect(Buffer.byteLength(html)).toBeLessThan(GMAIL_CLIP_BYTES / 4);
  });
  test("shell: tables, 600px, colour-scheme meta, one flat media query, no web fonts", () => {
    expect(html).toContain('<table role="presentation"');
    expect(html).toContain('width="600"');
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect((html.match(/@media/g) || []).length).toBe(1);
    expect(html).not.toMatch(/fonts\.googleapis|@font-face|display:\s*flex|display:\s*grid|background-image/);
  });
  test("footer: unsubscribe and preferences only, no address tags", () => {
    expect(html).toContain('href="*|UNSUB|*"');
    expect(html).toContain('href="*|UPDATE_PROFILE|*"');
    expect(html).toContain("*|LIST:COMPANY|*");
    expect(html).not.toContain("LIST:ADDRESS");
    expect(html).not.toContain("HTML:LIST_ADDRESS");
  });
  test("greeting merge tag and preview text", () => {
    expect(html).toContain("*|IF:FNAME|*Hi *|FNAME|*,*|ELSE:|*Hi there,*|END:IF|*");
    expect(html).toContain("*|MC_PREVIEW_TEXT|*");
  });
  test("faces: photo links to Instagram with the handle under it, guests get initials and no link, and they come after the body", () => {
    expect(html).toMatch(/<a href="https:\/\/instagram\.com\/martinadoescomedy"[^>]*><img[^>]*alt="Martina"/);
    expect(html.indexOf("@martinadoescomedy")).toBeGreaterThan(html.indexOf('alt="Martina"'));
    expect(html).toContain(">GG<");
    expect(html).toContain(">guest<");
    expect(html.indexOf("Who you saw")).toBeGreaterThan(html.indexOf("See all our shows"));
    expect(html.indexOf('alt="Martina"')).toBeGreaterThan(html.indexOf("Who you saw"));
  });
  test("button: red padded td, cream text, min height from padding + line height", () => {
    expect(html).toMatch(/<td[^>]*bgcolor="#E53935"[^>]*>\s*<a href="https:\/\/inyourfacecomedy\.ch\/calendar\/"[^>]*padding:14px 24px;[^>]*line-height:20px;[^>]*color:#FFF3E0/);
  });
  test("show card carries the date badge, eyebrow, dates and link", () => {
    expect(html).toContain(">10<");
    expect(html).toContain(">SEP<");
    expect(html).toContain("Thu · 19:30 · ROBIN&#39;s".replace("&#39;", "'"));
    expect(html).toContain("Thu 10, 17 Sep");
    expect(html).toContain("Tickets &amp; info");
  });
  test("inline markdown is escaped except bold, italics and safe links", () => {
    expect(inline("**b** *i* [t](https://x.y) <script>")).toBe(`<strong>b</strong> <em>i</em> <a href="https://x.y" style="color:#E53935;text-decoration:underline;">t</a> &lt;script&gt;`);
    expect(inline("[t](javascript:alert(1))")).toBe("[t](javascript:alert(1))");
  });
  test("images always have alt; every img in the doc is sized", () => {
    expect(html).not.toMatch(/<img(?![^>]*\balt=)/);
    for (const m of html.matchAll(/<img[^>]*>/g)) expect(m[0]).toMatch(/width="\d+"/);
  });
  test("checkHtml flags the things that must never ship", () => {
    expect(checkHtml("<p>no unsub \u2014 here</p>")).toEqual(expect.arrayContaining([expect.stringContaining("dash"), expect.stringContaining("UNSUB")]));
    expect(checkHtml('*|UNSUB|* <div style="display:flex"></div> *|LIST:ADDRESS|* <img src="x">')).toEqual(expect.arrayContaining([
      expect.stringContaining("display:flex"), expect.stringContaining("LIST:ADDRESS"), expect.stringContaining("alt"),
    ]));
    expect(checkHtml("*|UNSUB|*" + "x".repeat(MAX_HTML_BYTES))).toEqual([expect.stringContaining("limit")]);
    expect(checkHtml('*|UNSUB|* <a href="http://inyourfacecomedy.ch/">x</a>')).toEqual([expect.stringContaining("not https")]);
    expect(checkHtml('*|UNSUB|* <a href="">x</a> <p>undefined</p> ${show}')).toEqual(expect.arrayContaining([
      expect.stringContaining("empty href"), expect.stringContaining("undefined"), expect.stringContaining("placeholder"),
    ]));
  });
  test("extractLinks: hrefs and image srcs, http(s) only, deduped, entities decoded", () => {
    expect(extractLinks(`<a href="https://a.b/?x=1&amp;y=2">1</a><a href="https://a.b/?x=1&amp;y=2">2</a><a href="*|UNSUB|*">u</a><a href="mailto:x@y.z">m</a><img src="https://mcusercontent.com/f.jpg" alt="">`))
      .toEqual(["https://a.b/?x=1&y=2", "https://mcusercontent.com/f.jpg"]);
  });
  test("show card with a flyer renders the image above the text, sized to the card", () => {
    const h = renderHtml(doc([{ kind: "showCard", name: "Italian Rhapsody", href: "https://inyourfacecomedy.ch/filippo-spreafico/", date: "2026-09-19", eyebrow: "Sat · 20:00 · ROBIN's", img: { src: "https://mcusercontent.com/x/f.jpg", alt: "Filippo flyer", width: 1072, height: 536 } }]));
    expect(h).toMatch(/<img src="https:\/\/mcusercontent\.com\/x\/f\.jpg" width="536" height="268" alt="Filippo flyer"/);
    expect(h.indexOf("Filippo flyer")).toBeLessThan(h.indexOf("Italian Rhapsody"));
    expect(checkHtml(h)).toEqual([]);
  });
  test("promo copy accepts per-show blurbs and rejects half-filled ones", () => {
    const { copy } = validateCopy("promo", { subject: "Due serate", preheader: "Filippo e Promessi", paragraphs: ["a"], cta: "Prendi i biglietti", shows: [{ slug: "promessi-spassi", blurb: "Corto." }] });
    expect((copy as { shows?: unknown }).shows).toEqual([{ slug: "promessi-spassi", blurb: "Corto." }]);
    expect(() => validateCopy("promo", { subject: "x", preheader: "one two three", paragraphs: ["a"], cta: "Go", shows: [{ slug: "x" }] })).toThrow(/slug and blurb/);
  });
  test("subject with two exclamation marks is rejected", () => {
    expect(() => validateCopy("promo", { subject: "Wow!! Tickets", preheader: "one two three", paragraphs: ["a"], cta: "Go" })).toThrow(/exclamation/);
  });
  test("plain text twin carries the same content and merge tags", () => {
    const text = renderText(full);
    expect(text).toContain(GREETING_MERGE);
    expect(text).toContain("Thanks for coming to Comedy Brew last night (https://inyourfacecomedy.ch/comedybrew/).");
    expect(text).toContain("🎤 Comedy Brew (https://inyourfacecomedy.ch/comedybrew/)");
    expect(text).toContain("- Martina @martinadoescomedy (https://instagram.com/martinadoescomedy)");
    expect(text).toContain("- Gina Greco");
    expect(text).toContain("Unsubscribe: *|UNSUB|*");
    expect(text).not.toContain("<");
  });
  test("no greeting when greeting is null; hero renders sized", () => {
    const h = renderHtml(doc([{ kind: "hero", src: "https://mcusercontent.com/x/h.jpg", alt: "Crowd", width: 1200, height: 800 }], { greeting: null }));
    expect(h).not.toContain("*|IF:FNAME|*");
    expect(h).toContain('width="600" height="400" alt="Crowd"');
  });
  test("previewHtml resolves merge tags for the local preview only", () => {
    const p = previewHtml(html);
    expect(p).toContain("Hi Harry,");
    expect(p).not.toContain("*|");
    expect(html).toContain("*|UNSUB|*");
  });
  test("no em dash anywhere in the rendered output", () => {
    expect(html).not.toMatch(/[\u2014\u2013]/);
    expect(renderText(full)).not.toMatch(/[\u2014\u2013]/);
  });
});

describe("cli args", () => {
  test("parseArgs handles values, equals, booleans and positionals", () => {
    const a = parseArgs(["https://x/?show=a", "--segment", "Tag name", "--dry-run", "--lang=it", "--show", "a,b", "--yes", "--update", "8350024"]);
    expect(a.positional).toEqual(["https://x/?show=a"]);
    expect(a.flags).toEqual({ segment: "Tag name", "dry-run": true, lang: "it", show: "a,b", yes: true, update: "8350024" });
  });
});

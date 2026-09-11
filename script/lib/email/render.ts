// Email renderer: a small content model rendered to table-based HTML that
// survives Gmail, Apple Mail and Outlook, plus a plain-text twin. Every colour
// and size is a design-system token flattened to a literal (the design system's
// guidelines/email.md documents the mapping). Rules baked in from caniemail:
// nested tables, padding on <td>, inline styles everywhere, one flat @media,
// no flex/grid/background-image/web fonts, images with alt and explicit size.
// Pure: no filesystem, no network. Tested in script/__tests__/email-render.test.ts.

// ---------- tokens (design-system colours, flattened) ----------
export const T = {
  red: "#E53935",
  redDeep: "#B71C1C",
  yellow: "#FFD54F",
  cream: "#FFF3E0",
  ink: "#0F0F10",
  inkSoft: "#2A2A2D",
  surface: "#FFFFFF",
  surfaceElev: "#FFF8EE",
  muted: "#6B6B70",
  bg: "#F4F4F4",
  border: "#E6DFD3",
  bodyFont: "Inter, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  displayFont: "'Arial Black', Impact, 'Helvetica Neue', Helvetica, Arial, sans-serif",
  width: 600,
};

export const SOCIAL = {
  instagram: "https://instagram.com/inyourfacecomedy",
  facebook: "https://www.facebook.com/inyourfacecomedy.ch/",
  tiktok: "https://tiktok.com/@inyourfacecomedy",
};

// ---------- content model ----------
export interface Face {
  name: string;
  handle: string;      // "@x" or ""
  href: string;        // instagram URL or profile URL or ""
  img: string;         // hosted image URL or "" (guests)
  label?: string;      // "Host"
}

export type Block =
  | { kind: "hero"; src: string; alt: string; href?: string; width: number; height: number }
  | { kind: "paragraph"; text: string }                       // light markdown: **bold**, [text](url)
  | { kind: "lead"; text: string }                            // bigger opening line
  | { kind: "heading"; text: string }
  | { kind: "button"; label: string; href: string }
  | { kind: "showCard"; emoji?: string; name: string; href: string; date: string; eyebrow: string; datesLine?: string; blurb?: string; linkLabel?: string; img?: { src: string; alt: string; width: number; height: number } }
  | { kind: "faces"; groups: Array<{ label?: string; people: Face[] }> }
  | { kind: "signoff"; lines: string[] }
  | { kind: "note"; text: string }                            // small muted line
  | { kind: "spacer"; px?: number };

export interface EmailDoc {
  subject: string;
  preheader: string;
  lang: string;                 // en | it | es | de
  greeting: string | null;      // null = no greeting line; default FNAME conditional
  logoUrl: string;              // hosted logo or "" (falls back to a wordmark)
  siteUrl: string;
  calendarUrl: string;
  blocks: Block[];
}

export const GREETING_MERGE = "*|IF:FNAME|*Hi *|FNAME|*,*|ELSE:|*Hi there,*|END:IF|*";

// ---------- helpers ----------
export function esc(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Inline markup for copy: **bold**, *italic*, [text](https://...), line breaks.
// Everything else is escaped. Links outside http(s) or merge tags are dropped to text.
export function inline(md: string): string {
  let s = esc(md);
  s = s.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\*\|)[^)\s]+)\)/g, (_m, t, u) => `<a href="${u}" style="color:${T.red};text-decoration:underline;">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/\n/g, "<br>");
  return s;
}

const p = (style: string, html: string) => `<p style="margin:0;${style}">${html}</p>`;
const bodyText = `font-family:${T.bodyFont};font-size:16px;line-height:24px;color:${T.ink};`;
const muted = `font-family:${T.bodyFont};font-size:13px;line-height:20px;color:${T.muted};`;
const display = `font-family:${T.displayFont};text-transform:uppercase;letter-spacing:0.02em;`;
const table = (attrs: string, inner: string) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${attrs}>${inner}</table>`;

// ---------- components ----------
export function preheaderHtml(): string {
  // Hidden preview text from the campaign settings, then padding so clients
  // do not pull the first body line into the inbox preview.
  return `*|IF:MC_PREVIEW_TEXT|*<span class="mcnPreviewText" style="display:none;font-size:0px;line-height:0px;max-height:0px;overflow:hidden;color:transparent;mso-hide:all;">*|MC_PREVIEW_TEXT|*</span>*|END:IF|*` +
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0px;overflow:hidden;mso-hide:all;">${"&#847;&zwnj;&nbsp;".repeat(60)}</div>`;
}

export function headerHtml(doc: EmailDoc): string {
  const inner = doc.logoUrl
    ? `<a href="${esc(doc.siteUrl)}" style="text-decoration:none;"><img src="${esc(doc.logoUrl)}" width="96" height="96" alt="IN YOUR FACE Comedy" style="display:block;width:96px;height:96px;border:0;margin:0 auto;"></a>`
    : `<a href="${esc(doc.siteUrl)}" style="${display}font-size:28px;line-height:32px;color:${T.yellow};text-decoration:none;">IN YOUR FACE <span style="color:${T.cream};">Comedy</span></a>`;
  return `<tr><td align="center" bgcolor="${T.ink}" style="background-color:${T.ink};padding:20px 24px;">${inner}</td></tr>`;
}

export function heroHtml(b: Extract<Block, { kind: "hero" }>): string {
  const h = Math.round((b.height / b.width) * T.width) || 338;
  const img = `<img src="${esc(b.src)}" width="${T.width}" height="${h}" alt="${esc(b.alt)}" style="display:block;width:100%;max-width:${T.width}px;height:auto;border:0;">`;
  return `<tr><td style="padding:0;">${b.href ? `<a href="${esc(b.href)}" style="text-decoration:none;">${img}</a>` : img}</td></tr>`;
}

export function greetingHtml(g: string): string {
  return `<tr><td class="iyf-pad" style="padding:28px 32px 0;">${p(bodyText + "font-weight:600;", g)}</td></tr>`;
}

export function paragraphHtml(text: string, lead = false): string {
  const style = lead ? `font-family:${T.bodyFont};font-size:19px;line-height:28px;color:${T.ink};font-weight:500;` : bodyText;
  return `<tr><td class="iyf-pad" style="padding:14px 32px 0;">${p(style, inline(text))}</td></tr>`;
}

export function noteHtml(text: string): string {
  return `<tr><td class="iyf-pad" style="padding:12px 32px 0;">${p(muted, inline(text))}</td></tr>`;
}

export function headingHtml(text: string): string {
  return `<tr><td class="iyf-pad" style="padding:30px 32px 0;"><h2 style="margin:0;${display}font-size:22px;line-height:26px;color:${T.ink};">${esc(text)}</h2></td></tr>`;
}

// The ticket button: padded <td> with the colour, <a> inside. Bulletproof
// enough for Outlook (no border-radius there, which is fine).
export function buttonHtml(label: string, href: string, opts: { align?: "left" | "center" } = {}): string {
  return `<tr><td class="iyf-pad" align="${opts.align ?? "center"}" style="padding:22px 32px 0;">` +
    table(`style="margin:0 auto;"`, `<tr><td align="center" bgcolor="${T.red}" style="background-color:${T.red};border-radius:6px;mso-padding-alt:14px 24px;">` +
      `<a href="${esc(href)}" style="display:inline-block;padding:14px 24px;${display}font-size:16px;line-height:20px;color:${T.cream};text-decoration:none;min-width:120px;">${esc(label)} &rarr;</a></td></tr>`) +
    `</td></tr>`;
}

export function showCardHtml(b: Extract<Block, { kind: "showCard" }>): string {
  const d = b.date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const day = d ? String(Number(d[3])) : "";
  const mon = d ? ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(d[2]) - 1] : "";
  const badge = table(`width="56" style="width:56px;"`, `<tr><td align="center" bgcolor="${T.red}" style="background-color:${T.red};border-radius:8px;width:56px;height:56px;padding:6px 0;">` +
    `<div style="${display}font-size:24px;line-height:26px;color:${T.cream};">${day}</div><div style="font-family:${T.bodyFont};font-size:10px;line-height:12px;letter-spacing:0.1em;color:${T.cream};">${mon}</div></td></tr>`);
  const title = `<a href="${esc(b.href)}" style="${display}font-size:20px;line-height:24px;color:${T.ink};text-decoration:none;">${b.emoji ? esc(b.emoji) + " " : ""}${esc(b.name)}</a>`;
  const rows = [
    p(`font-family:${T.bodyFont};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${T.muted};`, esc(b.eyebrow)),
    p("margin:4px 0 0;", title),
    b.datesLine ? p(`margin:6px 0 0;font-family:${T.bodyFont};font-size:15px;line-height:22px;font-weight:600;color:${T.inkSoft};`, esc(b.datesLine)) : "",
    b.blurb ? p(`margin:6px 0 0;font-family:${T.bodyFont};font-size:15px;line-height:22px;color:${T.inkSoft};`, inline(b.blurb)) : "",
    p(`margin:10px 0 0;font-family:${T.bodyFont};font-size:14px;line-height:20px;`, `<a href="${esc(b.href)}" style="color:${T.red};font-weight:700;text-decoration:none;">${esc(b.linkLabel ?? "Tickets & info")} &rarr;</a>`),
  ].join("");
  // Optional flyer across the top of the card (536px inside the column padding).
  const flyerW = T.width - 64;
  const flyer = b.img
    ? `<tr><td style="padding:0;"><a href="${esc(b.href)}" style="text-decoration:none;"><img src="${esc(b.img.src)}" width="${flyerW}" height="${Math.round((b.img.height / b.img.width) * flyerW)}" alt="${esc(b.img.alt)}" style="display:block;width:100%;max-width:${flyerW}px;height:auto;border:0;border-radius:10px 10px 0 0;"></a></td></tr>`
    : "";
  return `<tr><td class="iyf-pad" style="padding:14px 32px 0;">` +
    table(`width="100%" style="width:100%;background-color:${T.surfaceElev};border-radius:10px;"`, flyer + `<tr><td style="padding:16px;">` +
      table(`width="100%"`, `<tr><td valign="top" width="56" style="width:56px;">${badge}</td><td valign="top" style="padding-left:14px;">${rows}</td></tr>`) +
      `</td></tr>`) +
    `</td></tr>`;
}

// Faces: three per row on desktop; the flat media query shrinks the picture
// on phones so three still fit at 375px. Guests get an initials disc.
export function facesHtml(b: Extract<Block, { kind: "faces" }>): string {
  const cell = (f: Face) => {
    const initials = f.name.split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
    const pic = f.img
      ? `<img class="iyf-face" src="${esc(f.img)}" width="108" height="108" alt="${esc(f.name)}" style="display:block;width:108px;height:108px;border-radius:54px;border:0;margin:0 auto;">`
      : table(`class="iyf-face" width="108" height="108" style="width:108px;height:108px;margin:0 auto;"`, `<tr><td align="center" valign="middle" bgcolor="${T.surfaceElev}" style="background-color:${T.surfaceElev};border-radius:54px;width:108px;height:108px;${display}font-size:30px;color:${T.red};">${esc(initials)}</td></tr>`);
    const linked = f.href ? `<a href="${esc(f.href)}" style="text-decoration:none;">${pic}</a>` : pic;
    const handle = f.handle
      ? `<a href="${esc(f.href)}" style="${muted}color:${T.red};text-decoration:none;">${esc(f.handle)}</a>`
      : `<span style="${muted}">${esc(f.label ?? "guest")}</span>`;
    return `<td class="iyf-face-cell" align="center" valign="top" width="33%" style="width:33%;padding:12px 4px 0;">${linked}` +
      p(`margin:8px 0 0;font-family:${T.bodyFont};font-size:14px;line-height:18px;font-weight:700;color:${T.ink};`, esc(f.name)) +
      p("margin:2px 0 0;", handle) + `</td>`;
  };
  const rowsOf = (people: Face[]) => {
    const rows: string[] = [];
    for (let i = 0; i < people.length; i += 3) {
      const slice = people.slice(i, i + 3);
      while (slice.length < 3) slice.push(null as unknown as Face);
      rows.push(`<tr>${slice.map((f) => (f ? cell(f) : `<td width="33%" style="width:33%;"></td>`)).join("")}</tr>`);
    }
    return rows.join("");
  };
  const groups = b.groups.filter((g) => g.people.length).map((g) =>
    (g.label ? `<tr><td colspan="3" style="padding:18px 4px 0;">${p(`font-family:${T.bodyFont};font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${T.muted};`, esc(g.label))}</td></tr>` : "") + rowsOf(g.people),
  ).join("");
  return `<tr><td class="iyf-pad" style="padding:6px 28px 0;">${table(`width="100%" style="width:100%;"`, groups)}</td></tr>`;
}

export function signoffHtml(lines: string[]): string {
  return `<tr><td class="iyf-pad" style="padding:26px 32px 0;">${lines.map((l, i) => p(bodyText + (i === lines.length - 1 ? "font-weight:700;" : ""), inline(l))).join("")}</td></tr>`;
}

// Footer: only the unsubscribe / preferences merge tags and the company name.
// Deliberately no *|LIST:ADDRESS|* or other template terms (private data).
export function footerHtml(doc: EmailDoc): string {
  const link = (h: string, t: string) => `<a href="${h}" style="color:${T.muted};text-decoration:underline;">${t}</a>`;
  return `<tr><td class="iyf-pad" align="center" style="padding:28px 32px 28px;border-top:1px solid ${T.border};">` +
    p(muted, `${link(esc(doc.calendarUrl), "All shows")} &nbsp;&middot;&nbsp; ${link(SOCIAL.instagram, "Instagram")} &nbsp;&middot;&nbsp; ${link(SOCIAL.facebook, "Facebook")} &nbsp;&middot;&nbsp; ${link(SOCIAL.tiktok, "TikTok")}`) +
    p(muted + "margin-top:10px;", `You get this because you joined the IN YOUR FACE list or bought a ticket to one of our shows.`) +
    p(muted + "margin-top:6px;", `${link("*|UNSUB|*", "Unsubscribe")} &nbsp;&middot;&nbsp; ${link("*|UPDATE_PROFILE|*", "Update preferences")}`) +
    p(muted + "margin-top:6px;", `&copy; *|CURRENT_YEAR|* *|LIST:COMPANY|*`) +
    `</td></tr>`;
}

export function blockHtml(b: Block): string {
  switch (b.kind) {
    case "hero": return heroHtml(b);
    case "paragraph": return paragraphHtml(b.text);
    case "lead": return paragraphHtml(b.text, true);
    case "heading": return headingHtml(b.text);
    case "button": return buttonHtml(b.label, b.href);
    case "showCard": return showCardHtml(b);
    case "faces": return facesHtml(b);
    case "signoff": return signoffHtml(b.lines);
    case "note": return noteHtml(b.text);
    case "spacer": return `<tr><td style="padding:0;height:${b.px ?? 12}px;line-height:${b.px ?? 12}px;font-size:0;">&nbsp;</td></tr>`;
  }
}

// ---------- document ----------
export function renderHtml(doc: EmailDoc): string {
  const greeting = doc.greeting === null ? "" : greetingHtml(doc.greeting || GREETING_MERGE);
  const body = doc.blocks.map(blockHtml).join("\n");
  return `<!DOCTYPE html>
<html lang="${esc(doc.lang || "en")}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(doc.subject)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style type="text/css">
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}
img{-ms-interpolation-mode:bicubic;}
p,a,td{mso-line-height-rule:exactly;}
@media only screen and (max-width:620px){
.iyf-container{width:100% !important;}
.iyf-pad{padding-left:18px !important;padding-right:18px !important;}
.iyf-face{width:88px !important;height:88px !important;}
}
</style>
</head>
<body style="margin:0;padding:0;background-color:${T.bg};">
${preheaderHtml()}
${table(`width="100%" style="width:100%;background-color:${T.bg};"`, `<tr><td align="center" style="padding:16px 8px;">` +
    table(`class="iyf-container" width="${T.width}" style="width:${T.width}px;max-width:${T.width}px;background-color:${T.surface};"`, headerHtml(doc) + greeting + body + `<tr><td style="height:12px;font-size:0;line-height:12px;">&nbsp;</td></tr>` + footerHtml(doc)) +
    `</td></tr>`)}
</body>
</html>
`;
}

// Plain-text twin from the same model. Merge tags work in text too.
export function renderText(doc: EmailDoc): string {
  const strip = (md: string) => md.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2");
  const out: string[] = ["IN YOUR FACE Comedy", ""];
  if (doc.greeting !== null) out.push(doc.greeting || GREETING_MERGE, "");
  for (const b of doc.blocks) {
    switch (b.kind) {
      case "hero": break;
      case "paragraph": case "lead": out.push(strip(b.text), ""); break;
      case "note": out.push(strip(b.text), ""); break;
      case "heading": out.push(b.text.toUpperCase(), ""); break;
      case "button": out.push(`${b.label}: ${b.href}`, ""); break;
      case "showCard": out.push(`${b.emoji ? b.emoji + " " : ""}${b.name} (${b.href})`, b.datesLine ? b.datesLine : b.eyebrow, ...(b.blurb ? [strip(b.blurb)] : []), ""); break;
      case "faces":
        for (const g of b.groups) {
          if (!g.people.length) continue;
          if (g.label) out.push(g.label + ":");
          for (const f of g.people) out.push(`- ${f.name}${f.handle ? ` ${f.handle} (${f.href})` : ""}`);
          out.push("");
        }
        break;
      case "signoff": out.push(...b.lines.map(strip), ""); break;
      case "spacer": break;
    }
  }
  out.push("---", `All shows: ${doc.calendarUrl}`, `Instagram: ${SOCIAL.instagram}`, "", "Unsubscribe: *|UNSUB|*", "Update preferences: *|UPDATE_PROFILE|*", "", "*|LIST:COMPANY|*");
  return out.join("\n");
}

// ---------- checks ----------
export const GMAIL_CLIP_BYTES = 102 * 1024;
// Mailchimp's click tracking rewrites every link at send time and adds bytes,
// so the stored HTML has to sit well under the clip.
export const MAX_HTML_BYTES = 90 * 1024;

// Problems that must block a campaign. Empty array means clean.
export function checkHtml(html: string): string[] {
  const problems: string[] = [];
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_HTML_BYTES) problems.push(`HTML is ${bytes} bytes; the limit is ${MAX_HTML_BYTES} (Gmail clips at ${GMAIL_CLIP_BYTES} after link tracking)`);
  for (const u of extractLinks(html)) if (!/^https:\/\//i.test(u)) problems.push(`link is not https: ${u}`);
  if (/[\u2014\u2013]/.test(html)) problems.push("contains an em or en dash");
  if (!html.includes("*|UNSUB|*")) problems.push("missing *|UNSUB|* unsubscribe merge tag");
  for (const bad of ["*|LIST:ADDRESS|*", "*|HTML:LIST_ADDRESS_HTML|*", "*|LIST:ADDRESSLINE|*"]) if (html.includes(bad)) problems.push(`footer contains ${bad}`);
  for (const [re, label] of [
    [/display\s*:\s*flex/i, "display:flex"], [/display\s*:\s*grid/i, "display:grid"], [/background-image/i, "background-image"],
    [/@import/i, "@import"], [/@font-face/i, "@font-face"], [/fonts\.googleapis\.com/i, "web font link"], [/<script/i, "<script>"],
  ] as Array<[RegExp, string]>) if (re.test(html)) problems.push(`uses ${label}`);
  if (/<img(?![^>]*\balt=)/i.test(html)) problems.push("an <img> has no alt attribute");
  if (/href=""|src=""/.test(html)) problems.push("an empty href or src");
  if (/\$\{[a-zA-Z0-9_]+\}/.test(html)) problems.push("an unfilled ${placeholder}");
  if (/>\s*(undefined|NaN|null)\s*</.test(html) || /(undefined|NaN)(?=["\s<])/.test(html.replace(/https?:\/\/[^\s"<]+/g, ""))) problems.push("a literal undefined/NaN in the output");
  return problems;
}

// Local preview only: merge tags resolved with sample values so the dry-run
// file reads like a delivered email. Never what gets uploaded.
export function previewHtml(html: string): string {
  return html
    .replace(/\*\|IF:FNAME\|\*([\s\S]*?)\*\|ELSE:\|\*[\s\S]*?\*\|END:IF\|\*/g, "$1")
    .replace(/\*\|IF:MC_PREVIEW_TEXT\|\*([\s\S]*?)\*\|END:IF\|\*/g, "$1")
    .replace(/\*\|FNAME\|\*/g, "Harry")
    .replace(/\*\|MC_PREVIEW_TEXT\|\*/g, "")
    .replace(/\*\|UNSUB\|\*/g, "#unsubscribe")
    .replace(/\*\|UPDATE_PROFILE\|\*/g, "#preferences")
    .replace(/\*\|CURRENT_YEAR\|\*/g, String(new Date().getFullYear()))
    .replace(/\*\|LIST:COMPANY\|\*/g, "IN YOUR FACE Comedy");
}

// All http(s) hrefs and image srcs, deduped, merge tags and mailto excluded.
// Images count: a deleted File Manager entry ships as a broken face.
export function extractLinks(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1].replace(/&amp;/g, "&");
    if (/^https?:\/\//i.test(u)) out.add(u);
  }
  return [...out];
}

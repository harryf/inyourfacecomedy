// The last mile shared by the three scripts: write the HTML and text locally,
// run the hard checks, probe every link, then create (or --update) the
// Mailchimp draft, read it back, and open it in the browser. Nothing here
// sends; Mailchimp's own checklist is the send gate. See docs/emails.md.

import { join } from "node:path";
import { OUT_DIR, confirm, fail, log, openInBrowser, warn, writeOut } from "./cli";
import { checkHtml, extractLinks, previewHtml } from "./render";
import { FROM_EMAIL, LIST_ID, type Mailchimp } from "./mailchimp";

export interface PublishOptions {
  mc: Mailchimp | null;          // null in --dry-run
  baseName: string;              // e.g. 2026-09-06-0915-thankyou-comedybrew
  title: string;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  segmentId?: number;
  expectedCount?: number;        // the segment's member count, for a sanity warning
  update?: string;               // web id or API id of an existing draft
  dryRun: boolean;
  noOpen: boolean;
  yes?: boolean;
}

export interface PublishResult { htmlPath: string; textPath: string; webId?: number; apiId?: string; url?: string }

// Social networks answer bots with 4xx/redirect loops; a failure there is a
// warning, everything else must be 2xx/3xx.
const WARN_ONLY_HOSTS = /(^|\.)(instagram\.com|facebook\.com|tiktok\.com|x\.com|twitter\.com)$/i;

export async function probeLinks(urls: string[]): Promise<{ failed: string[]; warned: string[] }> {
  const failed: string[] = [];
  const warned: string[] = [];
  const probe = async (u: string) => {
    let status = 0;
    try {
      let r = await fetch(u, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(15_000) });
      if (r.status === 405 || r.status === 403) r = await fetch(u, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15_000) });
      status = r.status;
    } catch { status = 0; }
    if (status >= 200 && status < 400) return;
    const host = new URL(u).hostname;
    (WARN_ONLY_HOSTS.test(host) ? warned : failed).push(`${status || "no response"} ${u}`);
  };
  // Five at a time keeps this quick without hammering the site.
  for (let i = 0; i < urls.length; i += 5) await Promise.all(urls.slice(i, i + 5).map(probe));
  return { failed, warned };
}

export async function publish(o: PublishOptions): Promise<PublishResult> {
  const htmlPath = writeOut(`${o.baseName}.html`, o.html);
  const textPath = writeOut(`${o.baseName}.txt`, o.text);
  log(`  html  ${htmlPath}`);
  log(`  text  ${textPath}`);

  const problems = checkHtml(o.html);
  if (problems.length) fail("HTML checks failed:\n  - " + problems.join("\n  - "));
  log(`  checks ok (${Buffer.byteLength(o.html, "utf8")} bytes, ${extractLinks(o.html).length} links)`);

  const { failed, warned } = await probeLinks(extractLinks(o.html).filter((u) => !u.startsWith("file://")));
  for (const w of warned) warn(`link not confirmable (social site): ${w}`);
  if (failed.length) fail("broken links:\n  - " + failed.join("\n  - "));
  log(`  links ok`);

  if (o.dryRun || !o.mc) {
    const previewPath = writeOut(`${o.baseName}.preview.html`, previewHtml(o.html));
    log(`\nDry run: no Mailchimp writes. Preview (merge tags filled in): ${previewPath}`);
    if (!o.noOpen) openInBrowser(previewPath);
    return { htmlPath, textPath };
  }

  const mc = o.mc;
  let apiId: string;
  let webId: number;
  // A second run for the same show updates the existing draft rather than
  // leaving two in the list (unless --update already names one).
  if (!o.update) {
    const dup = await mc.findDraftByTitle(o.title);
    if (dup) {
      const reuse = await confirm(`A draft "${dup.settings.title}" already exists (${dup.web_id}). Update it instead of creating another?`, { yes: o.yes });
      if (reuse) o.update = dup.id;
      else if (!process.stdin.isTTY) fail(`draft ${dup.web_id} already exists; pass --update ${dup.web_id} or rename`);
    }
  }
  if (o.update) {
    const c = await mc.resolveCampaign(o.update);
    if (c.status !== "save") fail(`campaign ${c.web_id} has status "${c.status}"; only drafts (status save) can be updated`);
    if (c.recipients.list_id && c.recipients.list_id !== LIST_ID) fail(`campaign ${c.web_id} belongs to another audience`);
    // Same kind of email? Titles start with "Thanks:", "Promo:" or "<Month> Calendar".
    const kind = (t: string) => (t.match(/^(Thanks|Promo):/)?.[1] ?? (/Calendar$/.test(t) ? "Calendar" : "?"));
    if (kind(c.settings.title) !== kind(o.title)) {
      const ok = await confirm(`Draft ${c.web_id} is "${c.settings.title}"; overwrite it with "${o.title}"?`, { yes: o.yes, defaultYes: false });
      if (!ok) fail("stopped");
    }
    await mc.updateSettings(c.id, { title: o.title, subject: o.subject, preview: o.preheader, segmentId: o.segmentId });
    apiId = c.id; webId = c.web_id;
    log(`  updated settings on draft ${webId}`);
  } else {
    const c = await mc.createCampaign({ title: o.title, subject: o.subject, preview: o.preheader, segmentId: o.segmentId });
    apiId = c.id; webId = c.web_id;
    log(`  created draft ${webId} (${apiId})`);
  }

  try {
    await mc.setContent(apiId, o.html, o.text);
  } catch (e) {
    fail(`content upload failed on draft ${webId}: ${(e as Error).message}\n  Fix and re-run with --update ${webId}`);
  }

  // Read back: what Mailchimp stored is what will be sent.
  const stored = await mc.getContent(apiId);
  const back = checkHtml(stored.html || "");
  if (back.length) fail(`stored HTML failed checks on draft ${webId}: ${back.join("; ")}`);
  if (!stored.plain_text || !stored.plain_text.includes("*|UNSUB|*")) fail(`stored plain text on draft ${webId} lost its unsubscribe tag`);
  // Fresh GET after the content upload: settings can be reset by it, and a
  // template attachment is what triggers the builder migration.
  const c = await mc.getCampaign(apiId);
  if (c.status !== "save") fail(`draft ${webId} is not in status save (${c.status})`);
  if (c.settings.reply_to !== FROM_EMAIL) fail(`draft ${webId} reply-to is ${c.settings.reply_to}`);
  if (c.content_type !== "html") fail(`draft ${webId} content_type is ${c.content_type}, expected html`);
  const templateId = (c.settings as { template_id?: number }).template_id;
  if (templateId) fail(`draft ${webId} has template_id ${templateId} attached`);
  if ((c.tracking as { google_analytics?: string } | undefined)?.google_analytics) fail(`draft ${webId} still has Google Analytics tagging "${c.tracking?.google_analytics}"`);
  // Recipients: the segment we asked for, or the whole audience, nothing else.
  const gotSegment = (c.recipients.segment_opts as { saved_segment_id?: number } | undefined)?.saved_segment_id;
  if (o.segmentId && gotSegment !== o.segmentId) fail(`draft ${webId} targets segment ${gotSegment ?? "none"}, expected ${o.segmentId}`);
  if (!o.segmentId && gotSegment) fail(`draft ${webId} targets segment ${gotSegment}, expected the whole audience`);
  if (o.expectedCount !== undefined && c.recipients.recipient_count !== o.expectedCount) warn(`recipient count ${c.recipients.recipient_count} differs from the segment's ${o.expectedCount} (unsubscribed or cleaned contacts are excluded)`);

  const url = mc.adminUrl(webId);
  log(`\nDraft ready: ${c.settings.title}`);
  log(`  subject   ${c.settings.subject_line}`);
  log(`  preview   ${c.settings.preview_text}`);
  log(`  from      ${c.settings.from_name} <${c.settings.reply_to}>`);
  log(`  to        ${c.recipients.recipient_count} recipients${c.recipients.segment_text ? " (segment)" : " (whole audience)"}`);
  log(`  content   ${c.content_type}, ${Buffer.byteLength(stored.html, "utf8")} bytes stored`);
  log(`  ${url}`);
  log(`\nIn Mailchimp: Preview, Send a test email, then Send. Do not click Edit design (it migrates the`);
  log(`campaign into the builder and drops this HTML). To change the words: edit`);
  log(`${join(OUT_DIR, o.baseName + ".copy.json")} and re-run with --copy <that file> --update ${webId}`);
  if (!o.noOpen) openInBrowser(url);
  return { htmlPath, textPath, webId, apiId, url };
}

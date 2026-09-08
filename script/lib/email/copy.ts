// Copy generation for the three emails: subject, three-word preheader, body
// pieces. The words come from the `claude` CLI (your subscription, no API key)
// driven by an editable prompt in script/email-prompts/<type>.md. The result is
// validated hard (teaser exactly three words, subject <= 50 chars, no dashes)
// and saved next to the HTML so it can be edited and replayed with --copy.
// Pure validation lives here too so `bun test` can pin it.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { PROMPT_DIR, warn } from "./cli";

export type EmailType = "thankyou" | "monthly" | "promo";

export interface ThankyouCopy { subject: string; preheader: string; paragraphs: string[]; ps?: string }
export interface MonthlyCopy { subject: string; preheader: string; opener: string[]; lead: string; shows: Array<{ slug: string; emoji: string; blurb: string }>; closing: string }
// `shows` is optional: a per-show blurb (any language) that replaces the
// tagline on that show's card, for bills that mix languages or need a bio.
export interface PromoCopy { subject: string; preheader: string; paragraphs: string[]; cta: string; shows?: Array<{ slug: string; blurb: string }> }
export type Copy = ThankyouCopy | MonthlyCopy | PromoCopy;

export const SUBJECT_MAX = 50;
export const CLAUDE_TIMEOUT_MS = 240_000;

// ---------- prompt files ----------
export interface Prompt { system: string; user: string; source: string }

// Markdown with two H2 sections, `## System` and `## User`, and ${var}
// placeholders. Missing placeholders are an error: a silent blank would ship.
export function loadPrompt(type: EmailType, vars: Record<string, string>): Prompt {
  const source = join(PROMPT_DIR, `${type}.md`);
  if (!existsSync(source)) throw new Error(`prompt file missing: ${source}`);
  return renderPrompt(readFileSync(source, "utf8"), vars, source);
}

export function renderPrompt(text: string, vars: Record<string, string>, source = "(inline)"): Prompt {
  const sys = text.match(/^## System\s*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  const usr = text.match(/^## User\s*\n([\s\S]*?)(?=^## |\s*$(?![\s\S]))/m);
  if (!sys || !usr) throw new Error(`${source}: needs "## System" and "## User" sections`);
  const sub = (s: string) => s.replace(/\$\{([a-zA-Z0-9_]+)\}/g, (_m, k) => {
    if (!(k in vars)) throw new Error(`${source}: no value for \${${k}}`);
    return vars[k];
  });
  return { system: sub(sys[1]).trim(), user: sub(usr[1]).trim(), source };
}

// ---------- claude CLI ----------
// Mirrors the flag pattern PAI uses for subscription-billed calls: print mode,
// no tools, no settings, explicit system prompt. Both API-key variables are
// removed so the call bills the subscription, never a key.
export function runClaude(prompt: Prompt, model = process.env.EMAIL_CLAUDE_MODEL || "sonnet"): string {
  if (process.env.CLAUDECODE) {
    throw new Error("running inside a Claude Code session: nested claude calls are blocked. Run from a normal terminal, or pass --copy <file> / --no-ai.");
  }
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  const r = spawnSync("claude", [
    "--print", "--model", model, "--tools", "", "--output-format", "text", "--setting-sources", "", "--system-prompt", prompt.system, prompt.user,
  ], { env, encoding: "utf8", timeout: CLAUDE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024 });
  if (r.error) throw new Error(`claude CLI failed to start: ${r.error.message} (is \`claude\` on PATH?)`);
  if (r.status !== 0) throw new Error(`claude exited ${r.status}: ${(r.stderr || "").trim().slice(0, 500)}`);
  return r.stdout;
}

// The model is told to answer with JSON only; this tolerates fences and chatter.
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in the model's answer");
  return JSON.parse(candidate.slice(start, end + 1));
}

// ---------- validation ----------
export function wordCount(s: string): number {
  return String(s ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// Dashes are replaced mechanically (a comma reads fine); everything else that
// is wrong is an error, because the fix needs a human or a re-run.
export function cleanText(s: string): string {
  return String(s ?? "").replace(/\s*[\u2014\u2013]\s*/g, ", ").replace(/\s+,/g, ",").replace(/[ \t]+/g, " ").trim();
}

export function validateCopy(type: EmailType, raw: unknown): { copy: Copy; fixes: string[] } {
  const fixes: string[] = [];
  const o = (raw ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const str = (k: string): string => {
    const v = o[k];
    if (typeof v !== "string" || !v.trim()) { errors.push(`${k} missing`); return ""; }
    const c = cleanText(v);
    if (c !== v.trim()) fixes.push(`${k}: dash replaced`);
    return c;
  };
  const list = (k: string): string[] => {
    const v = o[k];
    if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === "string")) { errors.push(`${k} must be a non-empty list of strings`); return []; }
    return (v as string[]).map((x) => { const c = cleanText(x); if (c !== x.trim()) fixes.push(`${k}: dash replaced`); return c; }).filter(Boolean);
  };

  const subject = str("subject");
  const preheader = str("preheader");
  if (subject.length > SUBJECT_MAX) errors.push(`subject is ${subject.length} chars (max ${SUBJECT_MAX})`);
  if ((subject.match(/!/g) || []).length > 1) errors.push("subject has more than one exclamation mark");
  if (wordCount(preheader) !== 3) errors.push(`preheader must be exactly three words, got "${preheader}"`);

  let copy: Copy;
  if (type === "thankyou") {
    const paragraphs = list("paragraphs");
    if (paragraphs.length > 4) errors.push("thank-you needs at most 4 paragraphs");
    const ps = typeof o.ps === "string" && o.ps.trim() ? cleanText(o.ps) : undefined;
    copy = { subject, preheader, paragraphs, ...(ps ? { ps } : {}) };
  } else if (type === "monthly") {
    const opener = list("opener");
    const lead = str("lead");
    const closing = str("closing");
    const showsRaw = Array.isArray(o.shows) ? (o.shows as Array<Record<string, unknown>>) : [];
    if (!showsRaw.length) errors.push("shows list missing");
    const shows = showsRaw.map((s) => ({ slug: String(s.slug ?? ""), emoji: String(s.emoji ?? "").trim(), blurb: cleanText(String(s.blurb ?? "")) }));
    for (const s of shows) {
      if (!s.slug) errors.push("a show entry has no slug");
      if (!s.blurb) errors.push(`blurb missing for ${s.slug}`);
      if (wordCount(s.blurb) > 32) errors.push(`blurb for ${s.slug} is ${wordCount(s.blurb)} words (max 32)`);
    }
    copy = { subject, preheader, opener, lead, shows, closing };
  } else {
    const paragraphs = list("paragraphs");
    const cta = str("cta");
    const showsRaw = Array.isArray(o.shows) ? (o.shows as Array<Record<string, unknown>>) : [];
    const shows = showsRaw.map((s) => ({ slug: String(s.slug ?? ""), blurb: cleanText(String(s.blurb ?? "")) }));
    for (const s of shows) if (!s.slug || !s.blurb) errors.push("a promo show entry needs slug and blurb");
    copy = { subject, preheader, paragraphs, cta, ...(shows.length ? { shows } : {}) };
  }
  if (errors.length) throw new Error("copy rejected: " + errors.join("; "));
  return { copy, fixes };
}

// ---------- generate / save / load ----------
export function generateCopy(type: EmailType, vars: Record<string, string>, opts: { model?: string; retries?: number } = {}): { copy: Copy; fixes: string[]; raw: string } {
  const prompt = loadPrompt(type, vars);
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= (opts.retries ?? 1); attempt++) {
    const raw = runClaude(attempt === 0 ? prompt : { ...prompt, user: prompt.user + `\n\nYour previous answer was rejected: ${lastErr?.message}. Answer again with valid JSON only.` }, opts.model);
    try {
      const { copy, fixes } = validateCopy(type, extractJson(raw));
      return { copy, fixes, raw };
    } catch (e) {
      lastErr = e as Error;
      warn(`copy attempt ${attempt + 1} rejected: ${lastErr.message}`);
    }
  }
  throw lastErr ?? new Error("copy generation failed");
}

// The file remembers what it was written for (`_for`), so a comedybrew
// thank-you cannot be replayed onto another show by mistake.
export function saveCopy(path: string, copy: Copy, forKey: string): void {
  writeFileSync(path, JSON.stringify({ _for: forKey, ...copy }, null, 2) + "\n");
}

export function loadCopy(type: EmailType, path: string, forKey: string): Copy {
  if (!existsSync(path)) throw new Error(`copy file not found: ${path}`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  if (typeof raw._for === "string" && raw._for !== forKey) throw new Error(`${path} was written for "${raw._for}", this run is "${forKey}"`);
  const { copy, fixes } = validateCopy(type, raw);
  for (const f of fixes) warn(`${path}: ${f}`);
  return copy;
}

// Deterministic stand-in for --no-ai and for tests: never sent as-is.
export function placeholderCopy(type: EmailType, vars: Record<string, string>): Copy {
  const show = vars.show_name || "the show";
  if (type === "thankyou") {
    return {
      subject: `Thanks for coming to ${show}`.slice(0, SUBJECT_MAX),
      preheader: "You were brilliant",
      paragraphs: [
        `Thanks for coming out to ${show} ${vars.when || "last night"}. A good room makes the show, and you were a good room.`,
        `Every comedian you saw is below. They love a follow, so go say hi.`,
      ],
    };
  }
  if (type === "monthly") {
    const slugs = (vars.show_slugs || "").split(",").filter(Boolean);
    return {
      subject: `${vars.month_label || "This month"} at IN YOUR FACE`.slice(0, SUBJECT_MAX),
      preheader: "Comedy dates inside",
      opener: [`Here is what is on this month. Short version: a lot.`],
      lead: `Pick a night, bring a friend who thinks they are funnier than you.`,
      shows: slugs.map((slug) => ({ slug, emoji: "🎤", blurb: `Stand-up comedy in English. Doors open early, jokes start on time.` })),
      closing: `See you out there.`,
    };
  }
  return {
    subject: `${show}: tickets are live`.slice(0, SUBJECT_MAX),
    preheader: "Tickets are live",
    paragraphs: [`${show} is coming up and you are exactly who it is for.`, `Tickets go fast for this one, so grab yours now.`],
    cta: "Get tickets",
  };
}

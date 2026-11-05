// Shared plumbing for the three email scripts: .env loading, argument parsing,
// confirmation prompts, output directory, browser opening, logging.
// No Mailchimp or site knowledge here. See docs/emails.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const ROOT = resolve(import.meta.dir, "..", "..", "..");
export const OUT_DIR = join(ROOT, "script", "email-out");           // gitignored
export const PROMPT_DIR = join(ROOT, "script", "email-prompts");    // tracked, editable
export const CACHE_DIR = join(OUT_DIR, "cache");

// ---------- .env ----------
// Same convention as ga-report.ts. The Mailchimp key may also live in the old
// exporter's .env; that path is a fallback so nothing has to be copied around.
const ENV_FILES = [
  join(ROOT, ".env"),
  join(homedir(), "Code", "personal", "eventfrog_exporter", ".env"),
];

export function loadEnv(): void {
  for (const p of ENV_FILES) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

// ---------- args ----------
export interface Args {
  positional: string[];
  flags: Record<string, string | boolean>;
}

// `--name value`, `--name=value`, `--flag`, and bare positionals. A value that
// starts with `--` is treated as the next flag, so `--dry-run --show x` works.
export function parseArgs(argv: string[]): Args {
  const out: Args = { positional: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { out.positional.push(a); continue; }
    const eq = a.indexOf("=");
    if (eq > 0) { out.flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const name = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(name)) { out.flags[name] = next; i++; }
    else out.flags[name] = true;
  }
  return out;
}

// Flags that never take a value, so a following positional is not swallowed.
const BOOLEAN_FLAGS = new Set([
  "help", "dry-run", "no-open", "yes", "no-ai", "hero", "no-hero", "no-hero-text", "no-flyers", "thumbs", "all", "open", "verbose", "allow-stale", "allow-undated",
]);
// Flags that always take a value; `--copy --update 1` must not quietly mean "no copy file".
const VALUE_FLAGS = new Set(["copy", "update", "segment", "csv", "tag", "show", "brief", "lang", "month", "weeks", "from", "date", "model", "hero-title", "notes", "next"]);

export function flagString(args: Args, name: string): string | undefined {
  const v = args.flags[name];
  if (v === true && VALUE_FLAGS.has(name)) fail(`--${name} needs a value`);
  return typeof v === "string" ? v : undefined;
}
export function flagBool(args: Args, name: string): boolean {
  return args.flags[name] === true || args.flags[name] === "true" || args.flags[name] === "1";
}

// ---------- output ----------
export function log(msg: string): void { console.log(msg); }
export function warn(msg: string): void { console.error(`! ${msg}`); }
export function fail(msg: string, code = 1): never {
  console.error(`\nERROR: ${msg}`);
  process.exit(code);
}

export function ensureOutDir(): string {
  mkdirSync(CACHE_DIR, { recursive: true });
  return OUT_DIR;
}

export function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function writeOut(name: string, content: string): string {
  ensureOutDir();
  const p = join(OUT_DIR, name);
  writeFileSync(p, content);
  return p;
}

// ---------- prompts ----------
// `yes` short-circuits every question. Non-interactive stdin (cron, CI) answers
// no, so a script never hangs and never writes to Mailchimp unattended.
export async function confirm(question: string, opts: { yes?: boolean; defaultYes?: boolean } = {}): Promise<boolean> {
  if (opts.yes) return true;
  if (!process.stdin.isTTY) { warn(`no TTY, answering no to: ${question}`); return false; }
  const hint = opts.defaultYes === false ? "[y/N]" : "[Y/n]";
  process.stdout.write(`${question} ${hint} `);
  const line = await readLine();
  const a = line.trim().toLowerCase();
  if (a === "") return opts.defaultYes !== false;
  return a === "y" || a === "yes";
}

export async function ask(question: string): Promise<string> {
  if (!process.stdin.isTTY) return "";
  process.stdout.write(`${question} `);
  return (await readLine()).trim();
}

function readLine(): Promise<string> {
  return new Promise((res) => {
    const onData = (buf: Buffer) => { process.stdin.off("data", onData); process.stdin.pause(); res(buf.toString()); };
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

// ---------- re-run line ----------
// After a run, the exact command to replay it with the edited copy file:
// the original arguments minus the ones that only matter for a first run
// (`drop`), plus `add` (e.g. --copy, --update, a resolved --segment).
// Paths are relative to the current directory when they sit under it.
const SAFE_ARG = /^[A-Za-z0-9_./:=,@%+-]+$/;
export function shellQuote(s: string): string {
  return SAFE_ARG.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

export function shortPath(p: string, cwd = process.cwd()): string {
  const r = relative(cwd, p);
  return r && !r.startsWith("..") ? r : p;
}

export function rerunCommand(argv: string[], script: string, opts: { drop: string[]; add: string[] }, cwd = process.cwd()): string {
  const drop = new Set(opts.drop);
  const kept: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { kept.push(a); continue; }
    const eq = a.indexOf("=");
    const name = eq > 0 ? a.slice(2, eq) : a.slice(2);
    const next = argv[i + 1];
    const takesNext = eq < 0 && next !== undefined && !next.startsWith("--") && !BOOLEAN_FLAGS.has(name);
    if (!drop.has(name)) kept.push(a, ...(takesNext ? [next] : []));
    if (takesNext) i++;
  }
  return ["bun", shortPath(script, cwd), ...kept, ...opts.add].map(shellQuote).join(" ");
}

// Offers to open a file in VS Code. Asks only on a terminal; a missing `code`
// command is a warning with the hint to install it, never a failure.
export async function offerToEdit(path: string): Promise<void> {
  if (!process.stdin.isTTY) return;
  if (!(await confirm(`Open it in VS Code? code ${shellQuote(shortPath(path))}`))) return;
  const r = spawnSync("code", [path], { stdio: "ignore" });
  if (r.error || r.status !== 0) warn("could not run `code` (VS Code: Shell Command: Install 'code' command in PATH)");
}

// ---------- browser ----------
// Brave is the personal browser (Chrome is for work), so Brave gets the draft
// when it is installed. EMAIL_BROWSER="Google Chrome" or "" (system default)
// overrides. Falls back to the default browser if the named app is missing.
export function browserApp(): string {
  if (process.env.EMAIL_BROWSER !== undefined) return process.env.EMAIL_BROWSER;
  return existsSync("/Applications/Brave Browser.app") ? "Brave Browser" : "";
}

export function openInBrowser(target: string): boolean {
  const app = browserApp();
  let r = app ? spawnSync("open", ["-a", app, target], { stdio: "ignore" }) : spawnSync("open", [target], { stdio: "ignore" });
  if (r.status !== 0 && app) { warn(`could not open in ${app}; using the default browser`); r = spawnSync("open", [target], { stdio: "ignore" }); }
  if (r.status !== 0) { warn(`could not open ${target} (open exited ${r.status})`); return false; }
  return true;
}

// Local date "YYYY-MM-DD" (Zürich is the only timezone that matters here; the
// scripts run on Harry's Mac, whose clock is local).
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const USAGE_FOOTER = `
Common flags:
  --dry-run        render to script/email-out/ and open the HTML locally; no Mailchimp writes
  --notes "<text>" facts and ideas for the writer (what happened at the show, what to
                   mention); asked for on a terminal when Claude writes the copy
  --copy <file>    reuse a saved copy JSON instead of asking Claude (edit it, re-run)
  --no-ai          skip Claude and use the built-in placeholder copy
  --update <id>    update an existing draft (web id from the URL, or API id) instead of creating one
  --no-open        do not open the browser at the end
  --yes            answer yes to every confirmation
`;

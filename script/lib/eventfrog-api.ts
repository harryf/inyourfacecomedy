// Eventfrog Organizer API, read-only by construction (strategy: ~/Documents/2026-09-13-comedy-brew-sales-tracking-strategy.md, section 4).
//
// The key in .env (EVENTFROG_ORGANIZER) may have write and delete rights; this client cannot use them.
// There is one verb. `fetch` is called with `method: "GET"` and nothing else, the path has to match
// the whitelist below, the key travels only in the Authorization header, and an error message never
// carries it. Rate headers are read on every call; a 429 waits once for the stated seconds and then
// gives up until the next cron slot. 401 and 403 raise EventfrogAuthError so the caller can ping
// Healthchecks with "key rejected".
//
// Limits (help page): 30 requests a minute, 2,000 a day, per account.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dir, "..", "..");
export const EVENTFROG_BASE = "https://api.eventfrog.net";

// The only paths this system reads. Anything else is refused before a request is built.
export const READ_PATHS: RegExp[] = [
  /^\/organizer\/v1\/events$/,
  /^\/organizer\/v1\/events\/\d+$/,
  /^\/organizer\/v1\/events\/\d+\/ticketcategories$/,
  /^\/organizer\/v1\/events\/\d+\/tickettransactions$/,
  /^\/organizer\/v1\/events\/\d+\/checkins$/,
  /^\/organizer\/v1\/events\/\d+\/payouts$/,
];

export class EventfrogAuthError extends Error {
  constructor(public readonly status: number, public readonly path: string) { super(`Eventfrog key rejected (http ${status}) on ${path}`); }
}
export class EventfrogRateLimitError extends Error {
  constructor(public readonly retryAfter: number, public readonly path: string) { super(`Eventfrog rate limit on ${path}; retry after ${retryAfter}s`); }
}
export class EventfrogApiError extends Error {
  constructor(public readonly status: number, public readonly path: string, detail: string) { super(`Eventfrog API ${path}: http ${status} ${detail}`); }
}

export type Query = Record<string, string | number | undefined>;
export interface Page<T> { totalNumberOfResources: number; data: T[] }

// .env at the repo root, never overriding a real environment variable.
export function loadEnv(): void {
  const p = join(REPO_ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export interface ClientOptions {
  fetchFn?: typeof fetch;               // tests stub it
  sleep?: (ms: number) => Promise<void>;
  minRemaining?: number;                // stop early under this many calls left in the minute (default 5)
  maxCalls?: number;                    // hard cap per client instance (default 40): a run can never loop away the day
}

export class Eventfrog {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly minRemaining: number;
  private readonly maxCalls: number;
  remaining: number | null = null;      // X-RateLimit-Remaining after the last call
  calls = 0;

  constructor(private readonly key: string, opts: ClientOptions = {}) {
    if (!key) throw new Error("EVENTFROG_ORGANIZER is not set in .env");
    this.fetchFn = opts.fetchFn || fetch;
    this.sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.minRemaining = opts.minRemaining ?? 5;
    this.maxCalls = opts.maxCalls ?? 40;
  }

  // The one verb. Refuses unknown paths, sends the key in the header only, reads the rate headers,
  // waits once on 429, raises on 401/403.
  async get<T = any>(path: string, query: Query = {}): Promise<T> {
    if (!READ_PATHS.some((re) => re.test(path))) throw new Error(`Eventfrog client: path not in the read whitelist: ${path}`);
    if (this.calls >= this.maxCalls) throw new Error(`Eventfrog client: ${this.maxCalls} calls in one run is the cap; stopping`);
    if (this.remaining !== null && this.remaining < this.minRemaining) {
      // Wait for the minute to roll over rather than eat the last calls.
      await this.sleep(61_000);
      this.remaining = null;
    }
    const url = new URL(EVENTFROG_BASE + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    for (let attempt = 0; ; attempt++) {
      this.calls++;
      const res = await this.fetchFn(url, { method: "GET", headers: { Authorization: `Bearer ${this.key}`, Accept: "application/json" } });
      const rem = res.headers.get("x-ratelimit-remaining");
      if (rem !== null) this.remaining = Number(rem);
      if (res.status === 401 || res.status === 403) throw new EventfrogAuthError(res.status, path);
      if (res.status === 429) {
        const retry = Number(res.headers.get("x-ratelimit-retry-after-seconds") || 60);
        if (attempt === 0) { await this.sleep(retry * 1000); continue; }
        throw new EventfrogRateLimitError(retry, path);
      }
      const text = await res.text();
      if (!res.ok) throw new EventfrogApiError(res.status, path, text.slice(0, 200).replace(this.key, "<key>"));
      try { return JSON.parse(text) as T; } catch { throw new EventfrogApiError(res.status, path, "non-JSON response"); }
    }
  }

  // Every row of a paged list (perPage 1000 is the maximum; a Comedy Brew night has tens of orders).
  async getAll<T = any>(path: string, query: Query = {}): Promise<{ total: number; data: T[] }> {
    const out: T[] = [];
    let page = 1, total = 0;
    for (;;) {
      const p = await this.get<Page<T>>(path, { ...query, page, perPage: 1000 });
      total = p.totalNumberOfResources ?? out.length;
      out.push(...(p.data || []));
      if (!p.data?.length || out.length >= total) break;
      page++;
    }
    return { total, data: out };
  }
}

export function eventfrogFromEnv(opts: ClientOptions = {}): Eventfrog {
  loadEnv();
  return new Eventfrog(process.env.EVENTFROG_ORGANIZER || "", opts);
}

// Healthchecks.io with the three endpoints this system uses: success, /fail (alarms), /log (a line, no alarm).
export async function healthcheckPing(envName: string, kind: "ok" | "fail" | "log", detail = ""): Promise<void> {
  const url = process.env[envName];
  if (!url) return;
  try { await fetch(kind === "ok" ? url : `${url}/${kind}`, { method: "POST", body: detail.slice(0, 2000) }); } catch { /* the run matters more than the ping */ }
}

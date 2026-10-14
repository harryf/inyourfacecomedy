// The one place this repo writes to Eventfrog, and it writes copy only.
//
// `lib/eventfrog-api.ts` is read-only by construction and its tests pin that; this file is the
// deliberately separate write path for `eventfrog-content.ts`. It has one verb, PATCH, two
// allowed paths (an event, an event group), and a body check that admits nothing but the
// localized copy fields: title, shortDescription, description. Ticketing, visibility, dates,
// tracking and everything else on an event cannot be reached from here, whatever the caller
// passes. The key travels in the Authorization header only and never appears in an error.
import { EVENTFROG_BASE, EventfrogApiError, EventfrogAuthError, EventfrogRateLimitError, loadEnv } from "./eventfrog-api";

export const WRITE_PATHS: RegExp[] = [
  /^\/organizer\/v1\/events\/\d+$/,        // body key: localizedInfos (plural, the PatchEventRequest shape)
  /^\/organizer\/v1\/eventgroups\/\d+$/,   // body key: localizedInfo (singular, the group patch shape)
];

export const COPY_FIELDS = ["title", "shortDescription", "description"] as const;
export type CopyField = (typeof COPY_FIELDS)[number];
export type Copy = Partial<Record<CopyField, string>>;

// The spec says 255 for both; the API answered "exceeds the maximum length of 60 characters"
// on a title (events and groups alike, 2026-10-14), so 60 is the real limit.
export const TITLE_MAX = 60;
export const SHORT_MAX = 255;

export interface WriterOptions {
  fetchFn?: typeof fetch;   // tests stub it
  maxWrites?: number;       // hard cap per writer instance (default 20): a run can never rewrite the account
}

/** The body for an event or a group patch: one localized entry under the object's existing
 *  locale key. Throws on anything outside the three copy fields or outside their limits. */
export function copyBody(path: string, locale: string, copy: Copy): Record<string, unknown> {
  if (!/^[a-z]{2}[_-][A-Z]{2}$/.test(locale)) throw new Error(`Eventfrog writer: bad locale ${JSON.stringify(locale)}`);
  const entry: Record<string, string> = {};
  for (const k of Object.keys(copy)) {
    if (!(COPY_FIELDS as readonly string[]).includes(k)) throw new Error(`Eventfrog writer: field not allowed: ${k}`);
    const v = (copy as Record<string, unknown>)[k];
    if (typeof v !== "string") throw new Error(`Eventfrog writer: ${k} must be a string`);
    entry[k] = v;
  }
  if (!Object.keys(entry).length) throw new Error("Eventfrog writer: empty copy");
  if (entry.title !== undefined && (entry.title.trim().length < 3 || entry.title.length > TITLE_MAX)) throw new Error(`Eventfrog writer: title must be 3 to ${TITLE_MAX} characters`);
  if (entry.shortDescription !== undefined && (entry.shortDescription.trim().length < 3 || entry.shortDescription.length > SHORT_MAX)) throw new Error(`Eventfrog writer: shortDescription must be 3 to ${SHORT_MAX} characters`);
  if (/—/.test(Object.values(entry).join(""))) throw new Error("Eventfrog writer: em dash in copy");
  const key = /eventgroups/.test(path) ? "localizedInfo" : "localizedInfos";
  return { [key]: { [locale]: entry } };
}

export class EventfrogWriter {
  private readonly fetchFn: typeof fetch;
  private readonly maxWrites: number;
  writes = 0;

  constructor(private readonly key: string, opts: WriterOptions = {}) {
    if (!key) throw new Error("EVENTFROG_ORGANIZER is not set in .env");
    this.fetchFn = opts.fetchFn || fetch;
    this.maxWrites = opts.maxWrites ?? 20;
  }

  /** PATCH one object's copy. Refuses unknown paths and any body that `copyBody` would not
   *  build; the body is rebuilt here from (locale, copy), so a caller cannot smuggle a field. */
  async patchCopy<T = any>(path: string, locale: string, copy: Copy): Promise<T> {
    if (!WRITE_PATHS.some((re) => re.test(path))) throw new Error(`Eventfrog writer: path not in the write whitelist: ${path}`);
    const body = copyBody(path, locale, copy);
    if (this.writes >= this.maxWrites) throw new Error(`Eventfrog writer: write cap of ${this.maxWrites} reached in this run`);
    this.writes++;
    const res = await this.fetchFn(EVENTFROG_BASE + path, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) throw new EventfrogAuthError(res.status, path);
    if (res.status === 429) throw new EventfrogRateLimitError(Number(res.headers.get("x-ratelimit-retry-after-seconds") || 60), path);
    const text = await res.text();
    if (!res.ok) throw new EventfrogApiError(res.status, path, text.slice(0, 300).replace(this.key, "<key>"));
    try { return JSON.parse(text) as T; } catch { throw new EventfrogApiError(res.status, path, "non-JSON response"); }
  }
}

/** The write key is its own variable: `EVENTFROG_ORGANIZER` is Eventfrog's read-only key type
 *  (the sales job, the staff calendar) and a PATCH with it answers 403 "keyAccessType READ".
 *  `EVENTFROG_ORGANIZER_WRITE` is an Organiser key of the read/write type, created in the
 *  Cockpit under Settings, API keys, and used by eventfrog-content.ts alone. */
export const WRITE_KEY_ENV = "EVENTFROG_ORGANIZER_WRITE";

export function eventfrogWriterFromEnv(opts: WriterOptions = {}): EventfrogWriter {
  loadEnv();
  const key = process.env[WRITE_KEY_ENV] || "";
  if (!key) throw new Error(`${WRITE_KEY_ENV} is not set in .env: a read/write Organiser API key is needed to write copy (the read-only EVENTFROG_ORGANIZER key answers 403)`);
  return new EventfrogWriter(key, opts);
}

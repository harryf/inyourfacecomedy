// The one place this repo writes to Eventfrog, and it writes copy only.
//
// `lib/eventfrog-api.ts` is read-only by construction and its tests pin that; this file is the
// deliberately separate write path. Three verbs, each with its own path whitelist and body
// check: `patchCopy` (eventfrog-content.ts: an event or a group, the localized copy fields
// title, shortDescription, description and nothing else), `copyEvent` (eventfrog-dates.ts: a
// new date as a copy of an existing one, with its times and title) and `patchPlacement`
// (eventfrog-dates.ts: a copied event's group and times). Ticketing, visibility, tracking and
// everything else on an event cannot be reached from here, whatever the caller passes; there
// is no delete. The key travels in the Authorization header only and never appears in an error.
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
    const { text } = await this.send("PATCH", path, body);
    try { return JSON.parse(text) as T; } catch { throw new EventfrogApiError(200, path, "non-JSON response"); }
  }

  /** POST a copy of an existing event as a new one (eventfrog-dates.ts). The source id must be
   *  a snowflake, the body is rebuilt from the five fields of `CopyRequest`, and the new
   *  event's id comes from the 201 Location header (or an id in the body). */
  async copyEvent(sourceId: string, req: CopyRequest): Promise<{ id: string; location: string }> {
    if (!/^\d+$/.test(sourceId)) throw new Error(`Eventfrog writer: bad source id ${JSON.stringify(sourceId)}`);
    const path = `/organizer/v1/events/${sourceId}/copy`;
    if (!COPY_PATHS.some((re) => re.test(path))) throw new Error(`Eventfrog writer: path not in the copy whitelist: ${path}`);
    const body = copyEventBody(req);
    const { res, text } = await this.send("POST", path, body);
    const location = res.headers.get("location") || "";
    let id = (location.match(/\/events\/(\d+)\/?$/) || [])[1] || "";
    if (!id) { try { const j = JSON.parse(text); if (typeof j?.id === "string" && /^\d+$/.test(j.id)) id = j.id; } catch { /* no body */ } }
    if (!id) throw new EventfrogApiError(res.status, path, "copied but no event id in Location or body");
    return { id, location };
  }

  /** PATCH where a copied event sits: its group and its times, nothing else. Events only. */
  async patchPlacement(path: string, placement: Placement): Promise<void> {
    if (!PLACEMENT_PATHS.some((re) => re.test(path))) throw new Error(`Eventfrog writer: path not in the placement whitelist: ${path}`);
    const body = placementBody(placement);
    await this.send("PATCH", path, body);
  }

  private async send(method: "PATCH" | "POST", path: string, body: Record<string, unknown>): Promise<{ res: Response; text: string }> {
    if (this.writes >= this.maxWrites) throw new Error(`Eventfrog writer: write cap of ${this.maxWrites} reached in this run`);
    this.writes++;
    const res = await this.fetchFn(EVENTFROG_BASE + path, {
      method,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) throw new EventfrogAuthError(res.status, path);
    if (res.status === 429) throw new EventfrogRateLimitError(Number(res.headers.get("x-ratelimit-retry-after-seconds") || 60), path);
    const text = await res.text();
    if (!res.ok) throw new EventfrogApiError(res.status, path, text.slice(0, 300).replace(this.key, "<key>"));
    return { res, text };
  }
}

// ---------- the copy verb (eventfrog-dates.ts) ----------

export const COPY_PATHS: RegExp[] = [/^\/organizer\/v1\/events\/\d+\/copy$/];
export const PLACEMENT_PATHS: RegExp[] = [/^\/organizer\/v1\/events\/\d+$/];

const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;   // the spec's date-time-local, no offset
const LOCALE = /^[a-z]{2}[_-][A-Z]{2}$/;
const IANA_ZONE = /^[A-Za-z]+\/[A-Za-z_]+$/;

/** What a copy may set: the spec's CopyEventRequest, one locale, one title. */
export interface CopyRequest { beginDate: string; endDate: string; timeZone: string; locale: string; title: string }

export function copyEventBody(req: CopyRequest): Record<string, unknown> {
  for (const k of ["beginDate", "endDate", "timeZone", "locale", "title"] as const) {
    if (typeof req[k] !== "string" || !req[k]) throw new Error(`Eventfrog writer: copy needs ${k}`);
  }
  for (const k of Object.keys(req)) if (!["beginDate", "endDate", "timeZone", "locale", "title"].includes(k)) throw new Error(`Eventfrog writer: copy field not allowed: ${k}`);
  if (!LOCAL_DATETIME.test(req.beginDate)) throw new Error(`Eventfrog writer: beginDate must be local ISO without offset: ${req.beginDate}`);
  if (!LOCAL_DATETIME.test(req.endDate)) throw new Error(`Eventfrog writer: endDate must be local ISO without offset: ${req.endDate}`);
  if (req.endDate <= req.beginDate) throw new Error("Eventfrog writer: endDate must be after beginDate");
  if (!IANA_ZONE.test(req.timeZone)) throw new Error(`Eventfrog writer: bad timeZone ${JSON.stringify(req.timeZone)}`);
  if (!LOCALE.test(req.locale)) throw new Error(`Eventfrog writer: bad locale ${JSON.stringify(req.locale)}`);
  if (req.title.trim().length < 3 || req.title.length > TITLE_MAX) throw new Error(`Eventfrog writer: title must be 3 to ${TITLE_MAX} characters`);
  if (/—/.test(req.title)) throw new Error("Eventfrog writer: em dash in copy");
  return { beginDate: req.beginDate, endDate: req.endDate, timeZone: req.timeZone, localizedInfos: [{ locale: req.locale, title: req.title }] };
}

export const PLACEMENT_FIELDS = ["groupId", "beginDate", "endDate", "timeZone"] as const;
export type Placement = Partial<Record<(typeof PLACEMENT_FIELDS)[number], string>>;

export function placementBody(p: Placement): Record<string, unknown> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(p)) {
    if (!(PLACEMENT_FIELDS as readonly string[]).includes(k)) throw new Error(`Eventfrog writer: placement field not allowed: ${k}`);
    if (typeof v !== "string" || !v) throw new Error(`Eventfrog writer: placement ${k} must be a string`);
    if (k === "groupId" && !/^\d+$/.test(v)) throw new Error(`Eventfrog writer: bad groupId ${JSON.stringify(v)}`);
    if ((k === "beginDate" || k === "endDate") && !LOCAL_DATETIME.test(v)) throw new Error(`Eventfrog writer: ${k} must be local ISO without offset: ${v}`);
    if (k === "timeZone" && !IANA_ZONE.test(v)) throw new Error(`Eventfrog writer: bad timeZone ${JSON.stringify(v)}`);
    out[k] = v;
  }
  if (!Object.keys(out).length) throw new Error("Eventfrog writer: empty placement");
  return out;
}

/** The write key is its own variable: `EVENTFROG_ORGANIZER` is Eventfrog's read-only key type
 *  (the sales job, the staff calendar) and a PATCH with it answers 403 "keyAccessType READ".
 *  `EVENTFROG_ORGANIZER_WRITE` is an Organiser key of the read/write type, created in the
 *  Cockpit under Settings, API keys, used by eventfrog-content.ts and eventfrog-dates.ts. */
export const WRITE_KEY_ENV = "EVENTFROG_ORGANIZER_WRITE";

export function eventfrogWriterFromEnv(opts: WriterOptions = {}): EventfrogWriter {
  loadEnv();
  const key = process.env[WRITE_KEY_ENV] || "";
  if (!key) throw new Error(`${WRITE_KEY_ENV} is not set in .env: a read/write Organiser API key is needed to write copy (the read-only EVENTFROG_ORGANIZER key answers 403)`);
  return new EventfrogWriter(key, opts);
}

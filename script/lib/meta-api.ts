// Shared Meta Marketing API helper for the script/meta-*.ts jobs (docs/meta-ads.md phase 7).
// Token from .env (META_ACCESS_TOKEN), api_version and ids from meta-ads/config.yml.
// The same one-shared-lib exception the GA report and the emails already use.

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const REPO_ROOT = resolve(import.meta.dir, "..", "..");
export const CONFIG_PATH = join(REPO_ROOT, "meta-ads", "config.yml");
export const OUT_DIR = join(REPO_ROOT, "script", "meta-out");     // gitignored

export interface MetaConfig {
  api_version: string;
  ad_account_id: string;            // act_...
  pixel_id: string;
  page_id: string;
  instagram_account_id: string;
  app_id: string;
  campaign_id: string;
  adsets: Record<"cold" | "warm" | "intent" | "buyers", string>;
  audiences: Record<string, string>;
  custom_conversion_id: string;
  budgets: Record<string, { base: number; ramp?: number }>;
  monthly_cap_chf: number;
  ramp_shows: string[];
  lineup: { grist_table: string; default_style: string; fallback: string; ends_at?: string };
  old_adset_id?: string;            // the 2024 carousel ad set: reported, never written
  targeting?: Partial<Record<"cold" | "warm" | "intent", AdsetSpec>>;
  insights?: Partial<InsightsRules>;
}

// One bank ad set's targeting as written by script/meta-adsets.ts.
export interface AdsetSpec {
  location: { city_key?: string; radius_km?: number; countries?: string[]; location_types?: string[] };
  ages: [number, number];
  locales?: number[];
  include: string[];                // audience keys from config.audiences
  exclude: string[];
  optimization: string;             // LANDING_PAGE_VIEWS, LINK_CLICKS, ...
}

export interface InsightsRules {
  ticket_floor: number; lpv_floor: number; retire_factor: number; max_retire_per_adset: number; starved_after_days: number; frequency_flag: number;
  // Meta recommendations the Saturday review has decided on: matched by type and the object's
  // readout name ("adset cold", "ad cold-C3"); they print with the reason and sort last.
  accepted_recommendations?: { type: string; object: string; reason: string }[];
}
export const DEFAULT_RULES: InsightsRules = { ticket_floor: 10, lpv_floor: 30, retire_factor: 1.5, max_retire_per_adset: 2, starved_after_days: 28, frequency_flag: 3.5 };

// .env at the repo root, KEY=value lines, never overriding a real environment variable.
export function loadEnv(): void {
  const p = join(REPO_ROOT, ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

export function loadConfig(): MetaConfig {
  if (!existsSync(CONFIG_PATH)) throw new Error(`missing ${CONFIG_PATH}: copy meta-ads/config.example.yml and fill the ids (docs/meta-ads.md phase 1)`);
  const c = Bun.YAML.parse(readFileSync(CONFIG_PATH, "utf8")) as MetaConfig;
  if (!c.ad_account_id?.startsWith("act_")) throw new Error(`config ad_account_id must start with act_ (got ${c.ad_account_id})`);
  return c;
}

export interface MetaError { message: string; type?: string; code?: number; error_subcode?: number; error_user_title?: string; error_user_msg?: string; fbtrace_id?: string }

export class MetaApiError extends Error {
  constructor(public readonly path: string, public readonly status: number, public readonly detail: MetaError) {
    super(`Meta API ${path}: ${detail.message}${detail.error_user_msg ? ` (${detail.error_user_msg})` : ""} [code ${detail.code ?? "?"}${detail.error_subcode ? `/${detail.error_subcode}` : ""}, http ${status}]`);
  }
}

type Params = Record<string, string | number | boolean | object | undefined>;

// Nested values (targeting, object_story_spec, ...) go over as JSON strings in a form body,
// which is what the Graph API expects for POST.
function formBody(params: Params): URLSearchParams {
  const b = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    b.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return b;
}

export class Meta {
  readonly base: string;
  constructor(private readonly token: string, version: string) {
    if (!token) throw new Error("META_ACCESS_TOKEN is not set (see docs/meta-ads.md phase 7 prelude)");
    this.base = `https://graph.facebook.com/${version}`;
  }

  private async call<T>(method: "GET" | "POST", path: string, params: Params): Promise<T> {
    const url = new URL(`${this.base}/${path.replace(/^\//, "")}`);
    let init: RequestInit = { method };
    if (method === "GET") {
      for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      url.searchParams.set("access_token", this.token);
    } else {
      const body = formBody(params);
      body.set("access_token", this.token);
      init = { method, body, headers: { "Content-Type": "application/x-www-form-urlencoded" } };
    }
    const res = await fetch(url, init);
    const text = await res.text();
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error(`Meta API ${path}: non-JSON response (http ${res.status}): ${text.slice(0, 200)}`); }
    if (!res.ok || json?.error) throw new MetaApiError(path, res.status, json?.error || { message: text.slice(0, 200) });
    return json as T;
  }

  get<T = any>(path: string, params: Params = {}): Promise<T> { return this.call<T>("GET", path, params); }
  post<T = any>(path: string, params: Params = {}): Promise<T> { return this.call<T>("POST", path, params); }

  // Follow `paging.next` until done or `max` rows.
  async getAll<T = any>(path: string, params: Params = {}, max = 1000): Promise<T[]> {
    const out: T[] = [];
    let page = await this.get<{ data: T[]; paging?: { next?: string } }>(path, { limit: 100, ...params });
    for (;;) {
      out.push(...(page.data || []));
      const next = page.paging?.next;
      if (!next || out.length >= max) break;
      const res = await fetch(next);
      page = await res.json();
      if ((page as any).error) throw new MetaApiError(path, res.status, (page as any).error);
    }
    return out;
  }
}

export function metaFromEnv(config: MetaConfig): Meta {
  loadEnv();
  return new Meta(process.env.META_ACCESS_TOKEN || "", config.api_version);
}

// Healthchecks.io: success or /fail ping when the env name is set, silently skipped otherwise.
export async function healthcheck(envName: string, ok: boolean, detail = ""): Promise<void> {
  const url = process.env[envName];
  if (!url) return;
  try { await fetch(ok ? url : `${url}/fail`, { method: "POST", body: detail.slice(0, 2000) }); } catch { /* the job result matters more than the ping */ }
}

// CHF to the API's minor units and back.
export const chfToMinor = (chf: number) => Math.round(chf * 100);
export const minorToChf = (minor: string | number) => Number(minor) / 100;

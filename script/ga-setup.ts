#!/usr/bin/env bun
// GA4 property configuration as code. Idempotent: every run reads the property,
// creates what is missing and patches what differs, so the setup documented in
// ANALYTICS.md is also the setup that is live. Nothing is ever deleted or archived.
//
//   bun script/ga-setup.ts --dry-run   # print the diff, change nothing
//   bun script/ga-setup.ts             # apply
//
// What it ensures (see ANALYTICS.md for the why):
//   - event data retention 14 months (GA default is 2, which makes explorations
//     forget everything older than 60 days)
//   - key events: ticket_click, ticket_redirect
//   - event-scoped custom dimensions: show, link (both pre-existing), venue,
//     show_date, days_to_show, content_group is built in and needs no registration
//   - event-scoped custom metric: price_chf (CHF)
//   - custom channel group "IN YOUR FACE channels" (Admin API v1alpha)
//
// Auth: GA_REPORTS_CREDENTIALS in .env (service-account key). The account needs
// the Editor role on the property; ga-report.ts only needs Viewer. Falls back to
// gcloud Application Default Credentials like ga-report.ts.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createSign } from "node:crypto";

const ROOT = resolve(import.meta.dir, "..");
export const PROPERTY = "properties/336856557";
const ADMIN = "https://analyticsadmin.googleapis.com";
const DRY = process.argv.includes("--dry-run");

// ---------- .env ----------
const envPath = join(ROOT, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// ---------- auth (same shape as ga-report.ts, edit scope) ----------
export async function accessToken(scope = "https://www.googleapis.com/auth/analytics.edit"): Promise<string> {
  const keyFile = process.env.GA_REPORTS_CREDENTIALS;
  if (keyFile) {
    const key = JSON.parse(readFileSync(resolve(ROOT, keyFile), "utf8"));
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ iss: key.client_email, scope, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 })}`;
    const sig = createSign("RSA-SHA256").update(unsigned).sign(key.private_key, "base64url");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
    });
    const j = await r.json();
    if (!j.access_token) throw new Error(`service-account token failed: ${JSON.stringify(j).slice(0, 200)}`);
    return j.access_token;
  }
  const adcPath = join(homedir(), ".config", "gcloud", "application_default_credentials.json");
  if (!existsSync(adcPath)) throw new Error("no credentials: set GA_REPORTS_CREDENTIALS or run gcloud auth application-default login");
  const adc = JSON.parse(readFileSync(adcPath, "utf8"));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: adc.client_id, client_secret: adc.client_secret, refresh_token: adc.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`ADC token failed (${j.error}): re-run gcloud auth application-default login`);
  return j.access_token;
}

export async function api<T = any>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${ADMIN}/${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j: any = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status}: ${(j.error?.message ?? text).slice(0, 300)}`);
  return j as T;
}

// ---------- desired state ----------
const RETENTION = "FOURTEEN_MONTHS";
const KEY_EVENTS = ["ticket_click", "ticket_redirect"];

const DIMENSIONS: { parameterName: string; displayName: string; description: string }[] = [
  { parameterName: "show", displayName: "Show", description: "Show slug on page_view (show pages), ticket_redirect and ticket_click (see CAMPAIGN_LINKS.md)" },
  { parameterName: "link", displayName: "Campaign link tags", description: "utm_source|utm_medium|utm_campaign|utm_content of the clicked /go/ link (ticket_redirect)" },
  { parameterName: "venue", displayName: "Venue", description: "Venue slug from _data/venues.yml (robins, otro, ...) on show page views and ticket events" },
  { parameterName: "show_date", displayName: "Show date", description: "YYYY-MM-DD of the show the visitor looked at or clicked for; the next date for series shows" },
  { parameterName: "days_to_show", displayName: "Days to show", description: "Days between the visit or click and the show date, bucketed like the Eventfrog sales export: 00, 01, 02-03, 04-07, 08-14, 15-30, 31+, past" },
];

const METRICS: { parameterName: string; displayName: string; description: string; measurementUnit: string }[] = [
  { parameterName: "price_chf", displayName: "Ticket price CHF", description: "price_chf from the show's front matter, on show page views and ticket events", measurementUnit: "CURRENCY" },
];

// Custom channel group. Rules are evaluated top to bottom; first match wins.
// Sources are lower-cased by the link builder, so exact/contains matches are safe.
const CHANNEL_GROUP_NAME = "IN YOUR FACE channels";
// ChannelGroupFilter.StringFilter takes matchType + value only (no caseSensitive field;
// channel-group matching is case-insensitive). Field names carry an `eachScope` prefix
// (`eachScopeSource`, `eachScopeMedium`; the default group uses `eachScopeDefaultChannelGroup`);
// bare `source` / `medium` are rejected with "Request contains an invalid argument".
const FIELD: Record<string, string> = { source: "eachScopeSource", medium: "eachScopeMedium" };
const contains = (field: string, value: string) => ({ filter: { fieldName: FIELD[field] ?? field, stringFilter: { matchType: "CONTAINS", value } } });
const eq = (field: string, value: string) => ({ filter: { fieldName: FIELD[field] ?? field, stringFilter: { matchType: "EXACT", value } } });
const anyOf = (...exprs: unknown[]) => ({ orGroup: { filterExpressions: exprs } });
const allOf = (...exprs: unknown[]) => ({ andGroup: { filterExpressions: exprs } });
// The API insists on the shape andGroup > orGroup > filter (an and_group may only
// contain or_groups); normalise whatever the rule table says into that.
function normalise(expr: any): any {
  if (expr.andGroup) return { andGroup: { filterExpressions: expr.andGroup.filterExpressions.map((e: any) => (e.orGroup ? e : { orGroup: { filterExpressions: [e] } })) } };
  if (expr.orGroup) return { andGroup: { filterExpressions: [expr] } };
  return { andGroup: { filterExpressions: [{ orGroup: { filterExpressions: [expr] } }] } };
}
const CHANNEL_RULES: { displayName: string; expression: unknown }[] = [
  { displayName: "Meta ads", expression: allOf(contains("source", "meta"), eq("medium", "paid_social")) },
  { displayName: "Instagram", expression: anyOf(contains("source", "instagram"), contains("source", "l.instagram")) },
  { displayName: "Facebook", expression: anyOf(contains("source", "facebook"), contains("source", "fb.com"), contains("source", "m.facebook")) },
  { displayName: "Guidle syndication", expression: anyOf(contains("source", "guidle"), contains("source", "hellozurich"), contains("source", "myswitzerland"), contains("source", "zuerich.com")) },
  { displayName: "Meetup", expression: contains("source", "meetup") },
  { displayName: "Eventfrog", expression: contains("source", "eventfrog") },
  { displayName: "Google Business", expression: anyOf(contains("source", "google-business"), contains("source", "business.google")) },
  { displayName: "Reddit", expression: contains("source", "reddit") },
  { displayName: "Email", expression: anyOf(eq("medium", "email"), contains("source", "mailchimp")) },
  { displayName: "AI assistants", expression: anyOf(eq("medium", "ai-assistant"), contains("source", "chatgpt"), contains("source", "perplexity"), contains("source", "copilot"), contains("source", "gemini.google")) },
  { displayName: "Search", expression: anyOf(eq("medium", "organic"), eq("medium", "cpc"), eq("medium", "paid_search")) },
  { displayName: "Other social", expression: anyOf(eq("medium", "social"), contains("source", "tiktok"), contains("source", "telegram"), contains("source", "whatsapp"), contains("source", "linkedin")) },
  { displayName: "Direct", expression: allOf(eq("source", "(direct)"), anyOf(eq("medium", "(none)"), eq("medium", "(not set)"))) },
];

// ---------- run ----------
type Change = { kind: string; detail: string; apply: () => Promise<unknown> };

async function plan(token: string): Promise<Change[]> {
  const changes: Change[] = [];

  const ret = await api(token, "GET", `v1beta/${PROPERTY}/dataRetentionSettings`);
  if (ret.eventDataRetention !== RETENTION) {
    changes.push({ kind: "retention", detail: `${ret.eventDataRetention} -> ${RETENTION}`, apply: () =>
      api(token, "PATCH", `v1beta/${PROPERTY}/dataRetentionSettings?updateMask=eventDataRetention`, { eventDataRetention: RETENTION }) });
  }

  const ke = await api(token, "GET", `v1beta/${PROPERTY}/keyEvents?pageSize=200`);
  const have = new Set((ke.keyEvents ?? []).map((k: any) => k.eventName));
  for (const name of KEY_EVENTS) if (!have.has(name)) {
    changes.push({ kind: "key event", detail: name, apply: () =>
      api(token, "POST", `v1beta/${PROPERTY}/keyEvents`, { eventName: name, countingMethod: "ONCE_PER_EVENT" }) });
  }

  const cd = await api(token, "GET", `v1beta/${PROPERTY}/customDimensions?pageSize=200`);
  const dims = new Map<string, any>((cd.customDimensions ?? []).map((d: any) => [d.parameterName, d]));
  for (const d of DIMENSIONS) {
    const cur = dims.get(d.parameterName);
    if (!cur) {
      changes.push({ kind: "dimension", detail: `create ${d.parameterName}`, apply: () =>
        api(token, "POST", `v1beta/${PROPERTY}/customDimensions`, { ...d, scope: "EVENT" }) });
    } else if (cur.displayName !== d.displayName || cur.description !== d.description) {
      changes.push({ kind: "dimension", detail: `update ${d.parameterName} name/description`, apply: () =>
        api(token, "PATCH", `v1beta/${cur.name}?updateMask=displayName,description`, { displayName: d.displayName, description: d.description }) });
    }
  }

  const cm = await api(token, "GET", `v1beta/${PROPERTY}/customMetrics?pageSize=200`);
  const mets = new Map<string, any>((cm.customMetrics ?? []).map((m: any) => [m.parameterName, m]));
  for (const m of METRICS) if (!mets.has(m.parameterName)) {
    changes.push({ kind: "metric", detail: `create ${m.parameterName}`, apply: () =>
      api(token, "POST", `v1beta/${PROPERTY}/customMetrics`, { ...m, scope: "EVENT" }) });
  }

  const cg = await api(token, "GET", `v1alpha/${PROPERTY}/channelGroups?pageSize=50`);
  const group = (cg.channelGroups ?? []).find((g: any) => g.displayName === CHANNEL_GROUP_NAME);
  const body = { displayName: CHANNEL_GROUP_NAME, description: "Promo channels as IN YOUR FACE runs them (see ANALYTICS.md). Managed by script/ga-setup.ts", groupingRule: CHANNEL_RULES.map((r) => ({ displayName: r.displayName, expression: normalise(r.expression) })) };
  if (!group) {
    changes.push({ kind: "channel group", detail: `create "${CHANNEL_GROUP_NAME}" with ${CHANNEL_RULES.length} rules`, apply: () =>
      api(token, "POST", `v1alpha/${PROPERTY}/channelGroups`, body) });
  } else if (JSON.stringify(group.groupingRule?.map((r: any) => r.displayName)) !== JSON.stringify(CHANNEL_RULES.map((r) => r.displayName))) {
    changes.push({ kind: "channel group", detail: `update rules of "${CHANNEL_GROUP_NAME}"`, apply: () =>
      api(token, "PATCH", `v1alpha/${group.name}?updateMask=groupingRule,description`, body) });
  }
  return changes;
}

if (import.meta.main) {
  const token = await accessToken();
  const changes = await plan(token);
  if (changes.length === 0) { console.log("ga-setup: property already matches the desired state"); process.exit(0); }
  for (const c of changes) console.log(`${DRY ? "would" : "will"} ${c.kind}: ${c.detail}`);
  if (DRY) process.exit(0);
  let failed = 0;
  for (const c of changes) {
    try { await c.apply(); console.log(`ok   ${c.kind}: ${c.detail}`); }
    catch (e) { failed++; console.log(`FAIL ${c.kind}: ${c.detail}: ${(e as Error).message}`); }
  }
  process.exit(failed ? 1 : 0);
}

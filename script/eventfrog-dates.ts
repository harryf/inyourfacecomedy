// Creates the missing Comedy Brew Thursdays on Eventfrog up to the `horizon` in
// `_data/eventfrog-copy.json`: each one a copy of the latest published date through the
// Organizer API's copy endpoint, then given the date's own title, short description and
// description straight away (the daily content job cannot see it until it is published).
// Idempotent: a date that exists is never copied again, nothing is ever deleted, and a run
// that finds every Thursday present only repairs copy that drifted. Hand-run, not scheduled.
//
//   bun script/eventfrog-dates.ts                             # dry run: the Thursdays missing to the horizon
//   bun script/eventfrog-dates.ts --apply --only 2027-01-07   # one date: copy, read back, compare with the source
//   bun script/eventfrog-dates.ts --apply                     # every missing Thursday, paced under the 30-a-minute limit
//
// Copies come out UNPUBLISHED and the API cannot publish (the spec has no operation for it),
// so after a run Harry publishes each new date in the Cockpit. Until then the organiser
// listing does not return them at all, which is why every created id is kept in the
// gitignored `script/eventfrog-out/dates-state.json`: a later run reads those events by id,
// treats them as existing, and repairs their copy if it drifted. Delete a date in the
// Cockpit and the next run notices the 404 and creates it again.
//
// What a copy carries is Eventfrog's choice ("all basic data"): every copy is read back and
// compared with the source on the group, the times, the ticket categories, the emblem, the
// location and the ticketing setup. Group and times are repaired with a PATCH; anything else
// that differs stops the run before the next copy.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Eventfrog, EventfrogApiError, EventfrogAuthError, REPO_ROOT, eventfrogFromEnv } from "./lib/eventfrog-api";
import { EventfrogWriter, eventfrogWriterFromEnv, type Copy, type CopyRequest, type Placement } from "./lib/eventfrog-write";
import { COMEDY_BREW, type CopyPool, type Reviews, type ShowConfig, changedFields, currentCopy, eventCopy, eventTitle, groupIdFromPost, loadCopyPool, loadReviews, pickHook, zurichDate } from "./eventfrog-content";
import { fail, flagBool, flagString, log, parseArgs, warn } from "./lib/email/cli";

export const SHOW_START = "19:30:00";
export const SHOW_END = "22:00:00";
export const TIME_ZONE = "Europe/Zurich";
export const MAX_COPIES = 40;
// A created date costs about six calls (copy, read, categories, copy-fields patch, read-back,
// sometimes a placement patch); the account allows 30 a minute. Ten seconds between dates
// keeps a batch under that with room for the daily jobs.
export const PAUSE_AFTER_CREATE_MS = 10_000;
export const PAUSE_AFTER_CHECK_MS = 4_000;
export const STATE_PATH = join(REPO_ROOT, "script", "eventfrog-out", "dates-state.json");

// ---------- pure: which Thursdays ----------

export function isThursday(date: string): boolean { return new Date(date + "T00:00:00Z").getUTCDay() === 4; }
export function addDays(date: string, n: number): string { return new Date(Date.parse(date + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10); }

/** The Thursdays after the latest existing date, up to and including the horizon, that have no
 *  event. Gaps before the latest date are left alone: a skipped week there was a decision.
 *  `existing` is what the listing shows (published dates); `known` the dates this script made
 *  and still has to look after (unpublished until Harry clicks). Pure. */
export function missingThursdays(existing: string[], horizon: string, known: string[] = []): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(horizon)) throw new Error(`horizon must be YYYY-MM-DD: ${horizon}`);
  const latest = [...existing].sort().pop();
  if (!latest) throw new Error("no existing date to copy from");
  const have = new Set(existing);
  const out: string[] = [];
  for (let d = addDays(latest, 1); d <= horizon; d = addDays(d, 1)) if (isThursday(d) && !have.has(d)) out.push(d);
  // Known dates after the horizon or before the latest published one still need their check.
  for (const k of known) if (!have.has(k) && !out.includes(k)) out.push(k);
  return out.sort();
}

// ---------- pure: the copy request ----------

export interface CopyPlan { date: string; hook: string; title: string; request: CopyRequest }

export function planCopies(dates: string[], pool: CopyPool, locale: string, show: ShowConfig = COMEDY_BREW): CopyPlan[] {
  return dates.map((date) => {
    const hook = pickHook(date, pool.hooks, pool.dates);
    const title = eventTitle(hook, show);
    return { date, hook, title, request: { beginDate: `${date}T${SHOW_START}`, endDate: `${date}T${SHOW_END}`, timeZone: TIME_ZONE, locale, title } };
  });
}

// ---------- pure: the state file ----------

export interface CreatedEntry { id: string; source: string; createdAt: string }
export interface DatesState { created: Record<string, CreatedEntry> }

export function loadState(path = STATE_PATH): DatesState {
  if (!existsSync(path)) return { created: {} };
  const j = JSON.parse(readFileSync(path, "utf8")) as Partial<DatesState>;
  const created: Record<string, CreatedEntry> = {};
  for (const [d, e] of Object.entries(j.created || {})) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && e && typeof e.id === "string" && /^\d+$/.test(e.id)) created[d] = { id: e.id, source: String(e.source || ""), createdAt: String(e.createdAt || "") };
  }
  return { created };
}

export function saveState(state: DatesState, path = STATE_PATH): void {
  mkdirSync(dirname(path), { recursive: true });
  const sorted: Record<string, CreatedEntry> = {};
  for (const d of Object.keys(state.created).sort()) sorted[d] = state.created[d];
  writeFileSync(path, JSON.stringify({ created: sorted }, null, 2) + "\n");
}

// ---------- pure: did the copy carry what the source has ----------

export interface EventShape {
  id: string;
  groupId?: string;
  locationId?: string;
  model?: string;
  beginDate: string;
  endDate?: string;
  timeZone?: string;
  cancelled?: boolean;
  cashlessEnabled?: boolean;
  visibility?: { published?: boolean; showInEventListing?: boolean };
  localizedInfo?: { locale: string; title?: string; shortDescription?: string; description?: string | null; emblem?: { url?: string } }[];
  ticketing?: { currency?: string; paymentOccasions?: { online?: { serviceFeePayer?: string }; onsiteEnabled?: boolean } };
  embedSettings?: { color?: string };
}

export interface Category { id?: number; parentId?: number; localizedInfo?: { title?: string }[]; priceStrategy?: { fixed?: { price?: number } }; totalNumberOfTickets?: number; visibility?: { type?: string }; saleStopMode?: string }

export interface Comparison { fix: Placement; problems: string[]; notes: string[] }

/** Zürich wall-clock "HH:MM" of an ISO instant. */
export function zurichTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export function compareCopy(source: EventShape, copy: EventShape, plan: CopyPlan): Comparison {
  const fix: Placement = {};
  const problems: string[] = [];
  const notes: string[] = [];
  if (copy.groupId !== source.groupId) { if (source.groupId) fix.groupId = source.groupId; else problems.push("source has no group"); }
  const wantBegin = plan.request.beginDate.replace("T", " ").slice(0, 16);
  const gotBegin = `${zurichDate(copy.beginDate)} ${zurichTime(copy.beginDate)}`;
  if (gotBegin !== wantBegin) { fix.beginDate = plan.request.beginDate; fix.timeZone = TIME_ZONE; notes.push(`begin ${gotBegin}, wanted ${wantBegin}`); }
  const gotEnd = copy.endDate ? `${zurichDate(copy.endDate)} ${zurichTime(copy.endDate)}` : "";
  const wantEnd = plan.request.endDate.replace("T", " ").slice(0, 16);
  if (gotEnd !== wantEnd) { fix.endDate = plan.request.endDate; fix.timeZone = TIME_ZONE; notes.push(`end ${gotEnd || "none"}, wanted ${wantEnd}`); }
  if (copy.visibility?.published !== true) notes.push("unpublished: publish in the Cockpit");
  if (copy.cancelled) problems.push("copy is cancelled");
  const sLi = source.localizedInfo?.[0];
  const cLi = copy.localizedInfo?.[0];
  if (!cLi) problems.push("copy has no localized info");
  else {
    if (cLi.locale !== sLi?.locale) problems.push(`locale ${cLi.locale}, source ${sLi?.locale}`);
    if (sLi?.emblem?.url && !cLi.emblem?.url) problems.push("emblem image missing");
  }
  if (copy.locationId !== source.locationId) problems.push(`location ${copy.locationId}, source ${source.locationId}`);
  if (copy.model !== source.model) notes.push(`model ${copy.model}, source ${source.model}`);
  if (!!copy.cashlessEnabled !== !!source.cashlessEnabled) notes.push(`cashless ${copy.cashlessEnabled}, source ${source.cashlessEnabled}`);
  if (copy.ticketing?.currency !== source.ticketing?.currency) problems.push(`currency ${copy.ticketing?.currency}, source ${source.ticketing?.currency}`);
  if (copy.ticketing?.paymentOccasions?.online?.serviceFeePayer !== source.ticketing?.paymentOccasions?.online?.serviceFeePayer) problems.push("online payment setup differs");
  if (copy.embedSettings?.color !== source.embedSettings?.color) notes.push(`embed colour ${copy.embedSettings?.color}, source ${source.embedSettings?.color}`);
  return { fix, problems, notes };
}

export function catKey(c: Category): string {
  return [c.localizedInfo?.[0]?.title ?? "", c.priceStrategy?.fixed?.price ?? "", c.totalNumberOfTickets ?? "", c.parentId ? "sub" : "main", c.visibility?.type ?? "", c.saleStopMode ?? ""].join("|");
}

/** The ticket categories of the copy against the source's: same titles, prices, seat counts,
 *  main/sub shape, visibility and stop mode. Pure. */
export function compareCategories(source: Category[], copy: Category[]): string[] {
  const want = source.map(catKey).sort();
  const got = copy.map(catKey).sort();
  if (want.length !== got.length) return [`ticket categories: ${got.length}, source ${want.length}`];
  const out: string[] = [];
  for (let i = 0; i < want.length; i++) if (want[i] !== got[i]) out.push(`ticket category differs: ${got[i]} (source ${want[i]})`);
  return out;
}

// ---------- the run ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (flagBool(args, "help")) { console.log(readFileSync(import.meta.path, "utf8").split("\n").slice(0, 22).join("\n")); return; }
  const apply = flagBool(args, "apply");
  const only = flagString(args, "only");
  const verbose = flagBool(args, "verbose");
  if (only && !/^\d{4}-\d{2}-\d{2}$/.test(only)) fail("--only wants YYYY-MM-DD");
  const show = COMEDY_BREW;
  const pool = loadCopyPool();
  if (!pool.horizon) fail("_data/eventfrog-copy.json has no horizon");
  const reviews: Reviews = loadReviews();
  const groupId = groupIdFromPost(show.slug);
  const state = loadState();

  const ef: Eventfrog = eventfrogFromEnv({ maxCalls: 250 });
  let inGroup: EventShape[];
  try {
    inGroup = (await ef.getAll<EventShape>("/organizer/v1/events", { groupId })).data;
  } catch (e) {
    if (e instanceof EventfrogAuthError) fail("Eventfrog key rejected");
    throw e;
  }
  const live = inGroup.filter((e) => !e.cancelled);
  const existing = live.map((e) => zurichDate(e.beginDate));
  const source = live.slice().sort((a, b) => a.beginDate.localeCompare(b.beginDate)).pop();
  if (!source) fail(`group ${groupId} has no live event to copy from`);
  const locale = source.localizedInfo?.[0]?.locale || "";
  if (!locale) fail(`source event ${source.id} has no localized info`);
  const known = Object.keys(state.created).filter((d) => !existing.includes(d));
  log(`${show.slug}: group ${groupId}, ${live.length} published events, latest ${zurichDate(source.beginDate)} (${source.id}), horizon ${pool.horizon}, ${known.length} created earlier and not yet published`);

  let dates = missingThursdays(existing, pool.horizon, known);
  if (only) {
    if (!dates.includes(only)) fail(`${only} is not a missing Thursday (missing: ${dates.join(", ") || "none"})`);
    dates = [only];
  }
  const plans = planCopies(dates, pool, locale, show);
  if (!plans.length) { log("nothing to do: every Thursday to the horizon is published"); return; }
  for (const p of plans) log(`  ${p.date}  ${p.title}${pool.dates[p.date] ? "  (pinned)" : ""}${state.created[p.date] ? `  [created earlier: ${state.created[p.date].id}]` : ""}`);
  const toCreate = plans.filter((p) => !state.created[p.date]).length;
  if (!apply) { log(`\nDry run: ${toCreate} date(s) would be copied from ${zurichDate(source.beginDate)}, ${plans.length - toCreate} checked. Add --apply.`); return; }
  if (toCreate > MAX_COPIES) fail(`${toCreate} copies is over the cap of ${MAX_COPIES}; move the horizon`);

  const writer: EventfrogWriter = eventfrogWriterFromEnv({ maxWrites: MAX_COPIES * 3 });
  const src = await ef.get<EventShape>(`/organizer/v1/events/${source.id}`);
  const srcCats = (await ef.get<{ data: Category[] }>(`/organizer/v1/events/${source.id}/ticketcategories`)).data || [];
  log(`source ${src.id}: group ${src.groupId}, ${srcCats.length} ticket categories, published ${src.visibility?.published}`);

  let created = 0, checked = 0, stopped = false;
  const unpublished: string[] = [];
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    const path = (id: string) => `/organizer/v1/events/${id}`;
    let madeNow = false;
    try {
      // 1. The event: one we made earlier (read by id, the listing hides it) or a fresh copy.
      let copy: EventShape | null = null;
      let id = state.created[p.date]?.id;
      if (id) {
        try { copy = await ef.get<EventShape>(path(id)); }
        catch (e) {
          if (e instanceof EventfrogApiError && e.status === 404) { warn(`${p.date}: event ${id} from the state file is gone (deleted in the Cockpit?); creating it again`); delete state.created[p.date]; saveState(state); id = undefined; }
          else throw e;
        }
      }
      if (!copy) {
        const made = await writer.copyEvent(src.id, p.request);
        id = made.id;
        madeNow = true;
        created++;
        state.created[p.date] = { id, source: src.id, createdAt: new Date().toISOString() };
        saveState(state);
        copy = await ef.get<EventShape>(path(id));
      } else checked++;

      // 2. Where it sits: group and times, patched when off.
      let cmp = compareCopy(src, copy, p);
      if (Object.keys(cmp.fix).length) {
        log(`  ${p.date}  ${id}: patching ${Object.keys(cmp.fix).join(",")}`);
        await writer.patchPlacement(path(id!), cmp.fix);
        copy = await ef.get<EventShape>(path(id!));
        cmp = compareCopy(src, copy, p);
        if (Object.keys(cmp.fix).length) cmp.problems.push(`still off after the patch: ${Object.keys(cmp.fix).join(",")}`);
      }
      if (madeNow) {
        const cats = (await ef.get<{ data: Category[] }>(`${path(id!)}/ticketcategories`)).data || [];
        cmp.problems.push(...compareCategories(srcCats, cats));
        if (verbose) log(`      ${JSON.stringify({ groupId: copy.groupId, begin: copy.beginDate, end: copy.endDate, published: copy.visibility?.published, cats: cats.map(catKey) })}`);
      }

      // 3. Its own copy: title, short description, description for this date, not the source's.
      const wanted: Copy = eventCopy(copy, p.hook, reviews, show);
      const cur = currentCopy(copy.localizedInfo);
      const changed = changedFields(cur.copy, wanted);
      let copyNote = "copy in sync";
      if (changed.length) {
        await writer.patchCopy(path(id!), cur.locale, wanted);
        const back = await ef.get<EventShape>(path(id!));
        const still = changedFields(currentCopy(back.localizedInfo).copy, wanted);
        if (still.length) cmp.problems.push(`copy fields still differ after the write: ${still.join(",")}`);
        copyNote = `wrote ${changed.join(",")}`;
      }

      if (copy.visibility?.published !== true) unpublished.push(p.date);
      log(`  ${p.date}  ${madeNow ? "created" : "checked"} ${id}  ${cmp.problems.length ? "PROBLEM" : "ok"}  ${copyNote}${cmp.notes.length ? "  " + cmp.notes.join("; ") : ""}`);
      if (cmp.problems.length) { for (const x of cmp.problems) warn(`${p.date}: ${x}`); warn("stopping before the next date; check the Cockpit"); stopped = true; break; }
    } catch (e) {
      warn(`${p.date}: ${(e as Error).message}`);
      warn("stopping before the next date; check the Cockpit");
      stopped = true;
      break;
    }
    if (i < plans.length - 1) await sleep(madeNow ? PAUSE_AFTER_CREATE_MS : PAUSE_AFTER_CHECK_MS);
  }
  log(`${created} created, ${checked} checked, ${plans.length - created - checked} not attempted${stopped ? " (stopped on a problem)" : ""}; ${ef.calls} reads, ${writer.writes} writes; state in ${STATE_PATH.replace(REPO_ROOT + "/", "")}`);
  if (unpublished.length) log(`unpublished, publish in the Cockpit: ${unpublished.join(", ")}`);
  if (stopped) process.exit(1);
}

if (import.meta.main) {
  main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
}

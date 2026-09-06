// Minimal Mailchimp Marketing API client for the email scripts. Only what the
// three scripts need: campaigns (create, patch, content, read back), static and
// saved segments, member lookup, File Manager uploads. Auth is a Basic header,
// never a URL parameter. Datacenter comes from the key suffix (`...-us9`).
// Playbook and gotchas: EMAILS.md.

import { createHash } from "node:crypto";

export const LIST_ID = "b3e1ac9105";                 // audience "IN YOUR FACE Comedy"
export const FROM_NAME = "Harry";
export const FROM_EMAIL = "harry@inyourfacecomedy.ch";

export interface Campaign {
  id: string;
  web_id: number;
  type: string;
  status: string;
  content_type: string;
  emails_sent: number;
  create_time: string;
  settings: { title: string; subject_line: string; preview_text: string; from_name: string; reply_to: string };
  recipients: { list_id: string; recipient_count: number; segment_text?: string; segment_opts?: unknown };
  tracking?: Record<string, unknown>;
}

export interface Segment {
  id: number;
  name: string;
  member_count: number;
  type: "static" | "saved" | "fuzzy";
  created_at: string;
}

export interface FileEntry { id: number; name: string; full_size_url: string; size: number }

export class MailchimpError extends Error {
  constructor(public status: number, public detail: string, public body: unknown) {
    super(`Mailchimp ${status}: ${detail}`);
  }
}

export class Mailchimp {
  private readonly base: string;
  private readonly auth: string;
  readonly dc: string;

  constructor(apiKey: string) {
    const dc = apiKey.split("-").pop();
    if (!dc || dc === apiKey) throw new Error("MC_API_KEY has no datacenter suffix (expected <key>-usN)");
    this.dc = dc;
    this.base = `https://${dc}.api.mailchimp.com/3.0`;
    this.auth = "Basic " + Buffer.from("anystring:" + apiKey).toString("base64");
  }

  static fromEnv(): Mailchimp {
    const key = process.env.MC_API_KEY;
    if (!key) throw new Error("MC_API_KEY not set (put it in .env; the exporter's .env is read as a fallback)");
    return new Mailchimp(key);
  }

  adminUrl(webId: number): string {
    return `https://${this.dc}.admin.mailchimp.com/campaigns/edit?id=${webId}`;
  }

  // ---------- transport ----------
  async request<T>(method: string, path: string, body?: unknown, attempt = 0): Promise<T> {
    const r = await fetch(this.base + path, {
      method,
      headers: { Authorization: this.auth, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await r.text();
    // Retry rate limits and server errors, but never a POST: a retried create
    // would leave an orphan draft or a duplicate segment.
    if ((r.status === 429 || r.status >= 500) && attempt < 3 && method !== "POST") {
      await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt));
      return this.request<T>(method, path, body, attempt + 1);
    }
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!r.ok) {
      const j = json as { detail?: string; title?: string; errors?: Array<{ field: string; message: string }> } | null;
      const errs = j?.errors?.map((e) => `${e.field}: ${e.message}`).join("; ");
      throw new MailchimpError(r.status, [j?.title, j?.detail, errs].filter(Boolean).join(" | ") || text.slice(0, 200), json);
    }
    return json as T;
  }
  get<T>(path: string) { return this.request<T>("GET", path); }
  post<T>(path: string, body: unknown) { return this.request<T>("POST", path, body); }
  patch<T>(path: string, body: unknown) { return this.request<T>("PATCH", path, body); }
  put<T>(path: string, body: unknown) { return this.request<T>("PUT", path, body); }

  async ping(): Promise<void> { await this.get<{ health_status: string }>("/ping"); }

  // ---------- campaigns ----------
  async listCampaigns(count = 20): Promise<Campaign[]> {
    const r = await this.get<{ campaigns: Campaign[] }>(
      `/campaigns?count=${count}&sort_field=create_time&sort_dir=DESC&fields=campaigns.id,campaigns.web_id,campaigns.type,campaigns.status,campaigns.content_type,campaigns.emails_sent,campaigns.create_time,campaigns.settings,campaigns.recipients`,
    );
    return r.campaigns;
  }

  async getCampaign(id: string): Promise<Campaign> { return this.get<Campaign>(`/campaigns/${id}`); }

  // An unsent draft with exactly this title, so a second run updates instead
  // of leaving two drafts for the same show.
  async findDraftByTitle(title: string): Promise<Campaign | undefined> {
    const want = title.trim().toLowerCase();
    return (await this.listCampaigns(100)).find((c) => c.status === "save" && c.settings.title.trim().toLowerCase() === want);
  }

  // The admin URL carries the web id; the API only knows the hex id. Resolve
  // either by scanning recent campaigns (the API cannot look up by web_id).
  async resolveCampaign(idOrWebId: string): Promise<Campaign> {
    if (/^\d+$/.test(idOrWebId)) {
      const all = await this.listCampaigns(100);
      const c = all.find((x) => String(x.web_id) === idOrWebId);
      if (!c) throw new Error(`no campaign with web id ${idOrWebId} among the last 100`);
      return c;
    }
    return this.getCampaign(idOrWebId);
  }

  async createCampaign(o: {
    title: string; subject: string; preview: string; segmentId?: number;
  }): Promise<Campaign> {
    const body = {
      type: "regular",
      recipients: {
        list_id: LIST_ID,
        ...(o.segmentId ? { segment_opts: { saved_segment_id: o.segmentId } } : {}),
      },
      settings: {
        title: o.title,
        subject_line: o.subject,
        preview_text: o.preview,
        from_name: FROM_NAME,
        reply_to: FROM_EMAIL,
        auto_footer: false,
        inline_css: false,
      },
      tracking: TRACKING,
    };
    const c = await this.post<Campaign>("/campaigns", body);
    // POST ignores google_analytics: ""; PATCH honours it (learned in the exporter).
    await this.patch(`/campaigns/${c.id}`, { tracking: TRACKING });
    return c;
  }

  async updateSettings(id: string, o: { title: string; subject: string; preview: string; segmentId?: number }): Promise<Campaign> {
    return this.patch<Campaign>(`/campaigns/${id}`, {
      settings: { title: o.title, subject_line: o.subject, preview_text: o.preview, from_name: FROM_NAME, reply_to: FROM_EMAIL, auto_footer: false },
      recipients: { list_id: LIST_ID, ...(o.segmentId ? { segment_opts: { saved_segment_id: o.segmentId } } : {}) },
      tracking: TRACKING,
    });
  }

  async setContent(id: string, html: string, plainText: string): Promise<void> {
    await this.put(`/campaigns/${id}/content`, { html, plain_text: plainText });
  }

  async getContent(id: string): Promise<{ html: string; plain_text: string }> {
    return this.get<{ html: string; plain_text: string }>(`/campaigns/${id}/content?fields=html,plain_text`);
  }

  // ---------- segments ----------
  async listSegments(type: "static" | "saved", count = 50): Promise<Segment[]> {
    const r = await this.get<{ segments: Segment[] }>(
      `/lists/${LIST_ID}/segments?type=${type}&count=${count}&sort_field=created_at&sort_dir=DESC&fields=segments.id,segments.name,segments.member_count,segments.type,segments.created_at`,
    );
    return r.segments;
  }

  async findSegment(name: string): Promise<Segment | undefined> {
    const want = name.trim().toLowerCase();
    for (const type of ["static", "saved"] as const) {
      const s = (await this.listSegments(type, 1000)).find((x) => x.name.trim().toLowerCase() === want);
      if (s) return s;
    }
    return undefined;
  }

  async getSegment(id: number): Promise<Segment> {
    return this.get<Segment>(`/lists/${LIST_ID}/segments/${id}?fields=id,name,member_count,type,created_at`);
  }

  // Static segments (tags under the hood) only accept existing audience members.
  async createStaticSegment(name: string, emails: string[]): Promise<Segment> {
    return this.post<Segment>(`/lists/${LIST_ID}/segments`, { name, static_segment: emails });
  }

  async memberStatus(email: string): Promise<string | null> {
    const hash = createHash("md5").update(email.trim().toLowerCase()).digest("hex");
    try {
      const m = await this.get<{ status: string }>(`/lists/${LIST_ID}/members/${hash}?fields=status`);
      return m.status;
    } catch (e) {
      if (e instanceof MailchimpError && e.status === 404) return null;
      throw e;
    }
  }

  async audienceCount(): Promise<number> {
    const r = await this.get<{ stats: { member_count: number } }>(`/lists/${LIST_ID}?fields=stats.member_count`);
    return r.stats.member_count;
  }

  // ---------- file manager ----------
  async findFile(name: string): Promise<FileEntry | undefined> {
    let offset = 0;
    for (;;) {
      const r = await this.get<{ files: FileEntry[]; total_items: number }>(
        `/file-manager/files?count=1000&offset=${offset}&fields=files.id,files.name,files.full_size_url,files.size,total_items`,
      );
      const f = r.files.find((x) => x.name === name);
      if (f) return f;
      offset += 1000;
      if (offset >= r.total_items) return undefined;
    }
  }

  async uploadFile(name: string, data: Buffer): Promise<FileEntry> {
    return this.post<FileEntry>("/file-manager/files", { name, file_data: data.toString("base64") });
  }
}

// Opens and clicks on (they are how we learn what works); Google Analytics
// auto-tagging off, so links arrive clean. The GA toggle in the wizard is a
// separate UI-only switch: EMAILS.md says to untick it before sending.
export const TRACKING = {
  opens: true,
  html_clicks: true,
  text_clicks: false,
  goal_tracking: false,
  ecomm360: false,
  google_analytics: "",
  clicktale: "",
};

// Tag names written by the ticket importer look like
//   "IN YOUR FACE Comedy Brew - English Stand-Up Comedy Open Mic 3.9.2026 19:30, ROBIN's Coffee"
// i.e. <Eventfrog event name> <D.M.YYYY> <HH:MM>, <location>.
export interface ParsedTag { eventName: string; date: string; time: string; location: string }

export function parseEventTag(name: string): ParsedTag | null {
  const m = name.match(/^(.*?)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}:\d{2}),\s*(.*)$/);
  if (!m) return null;
  const [, eventName, d, mo, y, time, location] = m;
  return { eventName: eventName.trim(), date: `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`, time, location: location.trim() };
}

# Posting Comedy Events & Photos to Google via API — Setup Guide

**For:** IN YOUR FACE Comedy (Google Business Profile)
**Goal:** Be able to publish events (and upload photos) to the Google Maps / Google Search business listing programmatically, from the `inyourfacecomedy` project.
**Written:** 2026-06-05
**Status of facts:** Verified against Google's developer docs and current (2026) behaviour — see Sources at the end. Where Google's process is known to drift, I've flagged it.

---

## 0. The headline (read this first)

Three things you probably want to know before sinking an afternoon into Google Cloud Console:

1. **Yes, it still works.** Posting **events** to your listing via API is still supported in 2026 (the "Local Posts" API), and so is **uploading photos** (the "Media" API). Both live on Google's *legacy* `mybusiness.googleapis.com/v4` endpoint, which Google kept alive specifically because posts + media were never migrated to the newer split APIs. Don't be alarmed when you see "v4" and deprecation notices elsewhere — posts and media are the survivors.

2. **There is an approval gate, and it is the slow part.** You can't just enable the API and go. You must submit a one-time **"Application for Basic API Access"** to Google and wait for a human to approve it. Approval takes **a few days to a few weeks**. Everything else (project, OAuth) takes an hour. So: **apply early**, then do the rest while you wait.

3. **There's an OAuth gotcha that breaks unattended automation if you get it wrong.** The scope you need (`business.manage`) is a "sensitive" scope. If you leave your OAuth app in **"Testing"** mode, Google expires your login token **every 7 days** — fine for a manual run, fatal for a daily cron. The fix is a specific, safe setting (publish to "Production", accept the unverified-app warning). Covered in Step 5. Get this right once and the cron just works.

This is very achievable. There are just two waiting-room moments (API access approval; profile must be 60+ days old — yours easily is).

---

## 1. What "Google Console" actually means here (plain-English orientation)

You'll touch **two different Google web consoles**, and it's easy to confuse them:

| Console | URL | What it's for | Which Google account |
|---|---|---|---|
| **Google Cloud Console** | console.cloud.google.com | Where you create a "project", turn on APIs, and make login credentials. This is the "developer" side. | See Step 2 — recommend signing in as **hfuecks@gmail.com** |
| **Business Profile Manager** | business.google.com | Where you (already) manage the actual listing — name, hours, posts you do by hand today. The API will act *on your behalf* here. | **hfuecks@gmail.com** (owns the listing) |

A **Google Cloud "project"** is just a container. It holds: which APIs you've switched on, your credentials, and your quota. You already have one of these — `inyourface-ga-mcp` — which I set up for Google Analytics access. We'll decide below whether to reuse it or make a fresh one.

**Your identifiers (for reference, you'll need these):**

- **Business Profile ID:** `18390205646696162099` — this is the one that matters for the API (it's the *location*). *(Note: `11341273250391398264`, which you first gave me, is the Shop ID — not used here.)*
- **Owner email of the listing:** `hfuecks@gmail.com`
- **Existing GA Cloud project:** `inyourface-ga-mcp`
- In API calls, your listing is addressed as `accounts/{accountId}/locations/{locationId}`. You have the location number; the **account** number you'll fetch with one API call after approval (Step 7).

---

## 2. Decision: new Cloud project, or reuse the GA one?

**My recommendation: create a NEW project, signed in as `hfuecks@gmail.com`.**

Why:

- The listing is owned by `hfuecks@gmail.com`. Google's API-access reviewer wants the application to come from an email that is an **owner/manager of the business profile**. Keeping the project under that same account removes all cross-account friction.
- The existing `inyourface-ga-mcp` project sits under a *different* Google account (the one I use for the Analytics MCP). Mixing the comedy-listing automation into it means juggling permissions across accounts.
- Clean separation: "this project is the comedy business's Google automation" is a tidy mental model, and you can hand it off or revoke it without touching Analytics.

Reusing `inyourface-ga-mcp` is *technically* possible (enable the APIs there, add a second credential), but you'd have to add `hfuecks@gmail.com` as an owner of that project and submit the access form from it — more moving parts for no real gain. **Go new.**

The rest of this guide assumes a **new project under `hfuecks@gmail.com`**.

---

## 3. Step-by-step: create the Cloud project (~10 min)

1. Open **console.cloud.google.com** in a browser. **Sign in as `hfuecks@gmail.com`** (check the avatar top-right — this trips everyone up).
2. If it's your first time, accept the Terms of Service. You do **not** need to enter a credit card / enable billing — the Business Profile API is free and works on a project with no billing account.
3. Top bar: click the **project dropdown** (says "Select a project") → **New Project**.
   - **Name:** `inyourface-comedy-gbp` (or anything; this is just a label)
   - **Organization / Location:** leave as "No organization".
   - Click **Create**. Wait ~20 seconds, then select the new project from the dropdown so it's the active one.
4. Note your **Project Number**. Find it at: **☰ menu → Cloud overview → Dashboard**, in the "Project info" card. It's a long number (different from the project *name*). **You'll paste this into the access-request form in Step 4.** Copy it somewhere.

PROJECT NUMBER: 128295252974

Support Case: 2-1874000041707 ( https://support.google.com/business/workflow/16726127?sjid=9242209853792350185-EU&authuser=1 )

https://console.cloud.google.com/home/dashboard?authuser=1&project=inyourface-comedy-gbp

---

## 4. Step-by-step: apply for API access (~10 min to submit, then DAYS to weeks to wait)

**Do this as early as possible** — it's the long pole. You can do Steps 5–6 while waiting.

1. Make sure you're still signed in as `hfuecks@gmail.com` (must be an owner/manager of the listing).
2. Go to the **GBP API contact form**: **https://support.google.com/business/contact/api_default**
3. From the dropdown, choose **"Application for Basic API Access"**.
4. Fill it in:
   - **Project Number:** the number from Step 3.4.
   - **Use case:** describe it plainly and truthfully, e.g. *"Automatically publish our recurring stand-up comedy event listings and event photos from our website (inyourfacecomedy.ch) to our Google Business Profile, to keep show dates and images current on Google Maps and Search."*
   - **Website:** `https://inyourfacecomedy.ch`
   - Confirm the profile is verified and has been active 60+ days (yours is).
5. Submit. You'll get a **follow-up email** when it's reviewed.

**How to know you're approved** (besides the email): in Cloud Console go to **APIs & Services → Enabled APIs → (the Business Profile API) → Quotas**. A quota of **0 QPM** means *not yet approved*; **300 QPM** means *approved*. Check here if the email is slow.

> Tip: Approvals are routinely granted for legitimate businesses with a real website and a matching use case. A `@gmail.com` address is accepted (it's the listing owner), though a domain email can read as more "business-legitimate". Yours should be fine — your website clearly backs the use case.

---

## 5. Step-by-step: configure OAuth (the login mechanism) (~20 min)

This is what lets your script act as you on the listing. **You can do this before approval comes through.**

### 5a. Configure the consent screen

1. Cloud Console (signed in as `hfuecks@gmail.com`) → **APIs & Services → OAuth consent screen**.
2. **User type:** choose **External**. (There is no "Internal" option unless you have a Google Workspace org; External is correct for a gmail account.) Click Create.
3. App information:
   - **App name:** `IN YOUR FACE Comedy automation`
   - **User support email:** `hfuecks@gmail.com`
   - **Developer contact email:** `hfuecks@gmail.com`
   - Logo/links optional — skip.
4. **Scopes:** click **Add or Remove Scopes**, then in the filter box paste:
   `https://www.googleapis.com/auth/business.manage`
   Tick it, click Update. (This single scope covers reading the profile, posting events, AND uploading photos.)
5. **Test users:** add `hfuecks@gmail.com` as a test user. Save.

### 5b. THE IMPORTANT BIT — publish to Production (so tokens don't die every 7 days)

By default the app is in **"Testing"** status. With a sensitive scope like `business.manage`, Testing mode **expires your refresh token after 7 days** — meaning a daily cron would silently break every week.

- On the **OAuth consent screen** overview, find **Publishing status** → click **"Publish app"** → set status to **"In production"**.
- Google will say the app is **unverified**. **That's fine for your case.** You qualify for the **personal-use / self-use exception**: the only person using the app is you, accessing your own business's data. You do **not** need to complete Google's full app-verification review (no privacy-policy review, no security assessment) as long as it stays personal/self-use.
- Practical effect: when you do the one-time authorization in Step 6, you'll see a **"Google hasn't verified this app"** warning. Click **Advanced → "Go to IN YOUR FACE Comedy automation (unsafe)"**. This is safe — it's *your* app accessing *your* data. After this, your refresh token is **long-lived** and the cron keeps working.

### 5c. Create the credential (OAuth client)

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. **Application type:** **Desktop app** (matches how the GA-MCP credential is set up — `redirect_uris: ["http://localhost"]`, runs from your Mac, no web server needed).
3. Name it `comedy-gbp-desktop`. Create.
4. **Download JSON.** This is the secret. Save it into the project as something like `gbp-oauth-client.json`.

> ⚠️ **Secrets hygiene — matches the project's existing rules.** The repo already git-ignores `ga-mcp-oauth-client.json`. **Add `gbp-oauth-client.json` (and the token file you'll generate) to `.gitignore` too, and never commit them.** Same discipline as the GA credential. The first OAuth run produces a *token* file (the long-lived refresh token from 5b) — that's even more sensitive than the client JSON; keep it out of git as well.

---

## 6. Enable the API in the project (~2 min)

1. Cloud Console → **APIs & Services → Library**.
2. Search and **Enable** these (enable all; they're free and you'll likely want them):
   - **Google My Business API** (this is the legacy `mybusiness.googleapis.com` — **carries Local Posts/events + Media/photos**)
   - **My Business Account Management API** (to look up your account ID)
   - **My Business Business Information API** (read/update listing details — handy later)
3. (You can enable these before approval; calls just won't succeed until the quota flips to 300 QPM.)

---

## 7. First successful call: find your account ID (after approval)

Once approved, the very first call you make is to get the **account** number that pairs with your location:

- **Account Management API:** `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts`
- This returns your account, e.g. `accounts/123456789`. Combine with your location `18390205646696162099` to get the full resource name used everywhere else:
  `accounts/123456789/locations/18390205646696162099`

(If `accounts.locations.list` shows the location under that account, you're wired up correctly.)

---

## 8. What the two things you want actually look like in the API

So you know what we're building toward in the `inyourfacecomedy` project. Both use the **v4** host: `https://mybusiness.googleapis.com/v4`.

### A. Post an event (your main goal)

`POST .../accounts/{acct}/locations/{loc}/localPosts`

```jsonc
{
  "languageCode": "en",
  "summary": "This Friday: IN YOUR FACE English Stand-Up @ <venue>",
  "topicType": "EVENT",
  "event": {
    "title": "IN YOUR FACE Comedy — English Stand-Up",
    "schedule": {
      "startDate": { "year": 2026, "month": 6, "day": 13 },
      "startTime": { "hours": 20, "minutes": 0 },
      "endDate":   { "year": 2026, "month": 6, "day": 13 },
      "endTime":   { "hours": 22, "minutes": 0 }
    }
  },
  "callToAction": {
    "actionType": "BOOK",
    "url": "https://inyourfacecomedy.ch/<the-show>/"
  },
  "media": [
    { "mediaFormat": "PHOTO", "sourceUrl": "https://inyourfacecomedy.ch/assets/img/<poster>.jpg" }
  ]
}
```

**This is a beautiful fit for your site's data model.** Your shows are already data-led (each `_posts` entry has the ticket URL, venue, date, price). A script can read the same source of truth the website and JSON-LD already build from, and emit one of these per upcoming show. The CTA `url` maps to the show page; the event `schedule` maps to the next event date that `refresh-next-event-dates.rb` already maintains from Eventfrog.

> Note on events vs. recurrence: each Local Post event is a single dated post. For a weekly night you create one per date (or refresh them on the same cadence as the Eventfrog date refresh). Posts also naturally expire, so a regular cron that re-posts the next show keeps the listing fresh — which is exactly the behaviour you want.

### B. Upload a photo (your second ask)

Two-step, on the same v4 host, via the **Media** resource:

1. `POST .../media:startUpload` → returns a `MediaItemDataRef` (an upload handle).
2. Upload the image bytes to that handle.
3. `POST .../media` with the data ref + `locationAssociation` (e.g. category `ADDITIONAL`) to actually attach it to the listing.

Constraints worth knowing: min **250px on the short edge**, min **~10 KB** file size, JPG/PNG. You can also attach a photo directly to an event post via the `media[].sourceUrl` field shown above (simpler — Google fetches it from your site), so for *event posters* you may not even need the separate upload flow. Use the Media API for general gallery photos (crowd shots, venue, comedians) you want on the profile itself.

---

## 9. How this should live in the `inyourfacecomedy` project

Fitting the project's conventions (from its CLAUDE.md / README):

- **Language:** the existing helper scripts are **Ruby** under `script/` (`refresh-next-event-dates.rb`, `sync-comedians.rb`). A new `script/post-events-to-google.rb` would sit naturally alongside them and reuse the same show-discovery logic (a show = a `_posts` file with a `ticket_url`).
- **Cron:** these scripts already run from a daily cron on your Mac, ping Healthchecks.io, and report failures over Telegram/email. The Google poster should do the same — and the **Production-mode OAuth from Step 5b is what makes a daily cron viable** (no 7-day token death).
  - ⚠️ The project's CLAUDE.md flags two cron foot-guns the GBP script must also respect: force **UTF-8** (`Encoding.default_external = Encoding::UTF_8`) because show files contain `Zürich`/`—`/emoji, and spawn any child Ruby with `RbConfig.ruby`, never bare `"ruby"` (cron's PATH finds macOS system Ruby 2.6). Copy the pattern from `sync-comedians.rb`.
- **Secrets:** `gbp-oauth-client.json` + the token file → `.gitignore`, staged-by-name commits only, exactly like `ga-mcp-oauth-client.json` and the campaigns `.xlsx`.
- **Truth source:** Eventfrog is the truth for dates; the script should read the post's refreshed `next_event_date` rather than inventing dates.

*(Note: there's no official Google Ruby client library for the v4 Business Profile API — it's plain authenticated REST over HTTPS, which Ruby's `net/http` + the `googleauth` gem handle fine. The OAuth dance is the only fiddly part, and it's a one-time browser authorization that yields the reusable refresh token.)*

---

## 10. Your checklist, in order

- [ ] **Now:** Sign into console.cloud.google.com as `hfuecks@gmail.com`, create project `inyourface-comedy-gbp`, note the **Project Number** (Step 3).
- [ ] **Now (the long pole):** Submit "Application for Basic API Access" at https://support.google.com/business/contact/api_default with the project number + use case (Step 4). **Then wait — but keep going below.**
- [ ] **While waiting:** OAuth consent screen → add `business.manage` scope → **Publish to Production** (the 7-day-token fix) → create a **Desktop** OAuth client → download JSON, gitignore it (Step 5).
- [ ] **While waiting:** Enable the three APIs in the Library (Step 6).
- [ ] **When approved** (quota shows 300 QPM / email arrives): do the one-time OAuth authorization (click through the unverified warning), get your long-lived token.
- [ ] **When approved:** call `accounts.list` to get your account ID; pair with location `18390205646696162099` (Step 7).
- [ ] **Then build:** `script/post-events-to-google.rb` reusing show data; add to cron with UTF-8 + `RbConfig.ruby` + Healthchecks ping (Steps 8–9).

When you're approved and ready to build the script, come back to me — I can write `post-events-to-google.rb` against your existing `_posts` data and wire it into the cron the same way the other helpers are set up.

---

## Sources

- [Prerequisites — Google Business Profile APIs](https://developers.google.com/my-business/content/prereqs) — access request, 60-day rule, project number, quota = approval signal
- [Applying for Google Business Profile API access (Help)](https://support.google.com/business/workflow/16726127?hl=en) — the contact form is now the route; old Google Form is closed
- [GBP API contact form](https://support.google.com/business/contact/api_default) — "Application for Basic API Access"
- [REST: accounts.locations.localPosts (v4)](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts) — events still supported
- [Create Posts on Google](https://developers.google.com/my-business/content/posts-data) — event/offer/what's-new post structure
- [REST: accounts.locations.media (v4)](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.media) — photo upload (startUpload → create)
- [Restricted/sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) and [OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies) — Testing-mode 7-day refresh-token expiry; personal-use verification exception
- [Google Business Profile API 2026 — what still works](https://slashpost.ai/blogs/google-business-profile/google-business-profile-api-documentation-2026) — current-state confirmation that posts + media survive on v4

# Email campaigns: the Mailchimp playbook

Internal doc, excluded from the published site in `_config.yml`. How the mailing-list emails get made, learned the hard way while building the September 2026 season opener. For copy style, [WRITING_GUIDE.md](WRITING_GUIDE.md) applies to every word a subscriber reads; this file covers the rest.

## The plumbing

- Account: Mailchimp `us9`. Audience: "IN YOUR FACE Comedy" (list id `b3e1ac9105`, ~1,660 subscribers).
- API key: `MC_API_KEY` in `~/Code/personal/eventfrog_exporter/.env` (never in this repo). Datacenter derives from the key suffix. Auth is a Basic header, never a URL parameter.
- The `eventfrog_exporter` repo also owns the post-show thank-you flow (`eventfrog email-draft`); its README documents that separately.
- A campaign has two ids: the `web_id` (the number in admin URLs, e.g. `8349858`) and the API id (hex, e.g. `7ea6a7d246`). The API cannot look up by `web_id`; list recent campaigns and match.

## The one rule that matters

**Never author campaign content by PUTting raw HTML via the API.** It silently converts the campaign to the legacy code editor (`content_type: template`). The moment anyone clicks Edit design, Mailchimp migrates the legacy campaign into the current builder and destroys the content. This killed the first September 2026 draft (web id 8349857, left as a dead shell in the campaign list).

The safe path, since the current builder has no public content API:

1. **Replicate** the most recent good campaign: `POST /3.0/campaigns/{api_id}/actions/replicate`. This inherits the design, the text blocks, and the footer, and stays `content_type: multichannel` (the current builder).
2. **PATCH settings only** via the API: internal title, subject line, preview text. Settings changes never touch content.
3. **Edit the text blocks inside the builder UI** (Edit design). Pasting rich HTML replaces a block's content with links and bold intact; retyping plain text loses the links.
4. Leave the footer blocks alone entirely.

## Template lineage

- May 2026 Calendar: web id `8348275` (the original hand-built one)
- September 2026 Season Opener: web id `8349858`, API id `7ea6a7d246`

Next campaign: replicate the newest entry in this list, then add the result here.

## The email shape (keep it)

1. Opener: two or three short sentences, one joke, seasonal hook.
2. Intro: bolded show count linking to <https://inyourfacecomedy.ch/calendar/> ("18 shows between now and October"), verified against `_data/calendar.yml`, plus one line pointing at the lead show.
3. One block per show: emoji, show name linked to its **inyourfacecomedy.ch permalink** (never Eventfrog: the site page carries the ticket link and stays current), weekday plus dates, then a one-line blurb.
4. Closing gag, "See you out there" with a seasonal emoji, bold "Harry & the IN YOUR FACE Comedy Crew".
5. Inherited footer: site link, social icons, logo, copyright and unsubscribe merge tags. Untouched.

## Copy rules on top of WRITING_GUIDE.md

- Subject line: setup and punch, under ~45 characters ("Summer's over. Here's the good news.").
- Preview text: exactly three words ("Comedy is back").
- Body under ~300 words. Subscribers skim on phones.
- Each show blurb: 25 words or fewer, exactly one joke, venue and doors time.
- Blurbs match the show's language: La Tarima in Spanish, PROMESSI SPASSI in Italian.
- Dates come from `_data/calendar.yml`, nothing else. Recurring shows list their actual dates ("Wed Sep 2, 9, 16, 23").
- Date-relative copy ("THIS Saturday") puts a fuse on the email. Note the send-by date when handing over the draft.
- No em dashes anywhere, including subject and preview.

## Verification before handover

All of this is checkable via `GET /3.0/campaigns/{api_id}/content` and cheap probes:

- Every show present with the right dates, every link a real `<a href>` to inyourfacecomedy.ch, calendar link present, zero `eventfrog` strings in the body.
- `curl` every linked URL for a 200.
- Footer merge tags literally present in the stored HTML: `*|UNSUB|*`, `*|UPDATE_PROFILE|*`, `*|CURRENT_YEAR|*`, `*|LIST:COMPANY|*`. The wizard preview resolves merge tags, so a pretty preview proves nothing.
- **Plain text**: builder edits leave the stored `plain_text` stale (the replicate keeps the old campaign's snapshot). In the wizard: Content, Edit plain-text, Regenerate From HTML, Save. Then re-check via the API.
- **Round-trip test**: hash the content, open Edit design, change nothing, exit, hash again. Byte-identical or something is wrong. This is the test that retires the raw-HTML failure mode.
- `status` is `save` and `emails_sent` is 0.

## Sending notes

- The draft link is `https://us9.admin.mailchimp.com/campaigns/edit?id={web_id}`. Sending happens in the wizard; its recipient-count confirmation screen is the gate.
- Untick "Track campaign with Google Analytics" in Settings & Tracking before sending. That toggle is UI-only; the API's `google_analytics` field is a slug, not the switch. Left on, every link arrives wrapped in utm parameters.
- Test sends: "Send a Test Email" in the wizard.

## Gotchas

- Browser automation shares the Mac's clipboard with whoever is at the keyboard. Copy and paste in adjacent steps, and eyeball the result of every paste (two stray pastes hit the September draft mid-build).
- A replicated campaign is named "Copy of ..." until the title PATCH lands.
- Deleting a campaign is permanent. Dead drafts (like 8349857) stay until a human decides.

# Email campaigns: the Mailchimp playbook

Internal doc; `docs/` is excluded from the published site in `_config.yml`. Three scripts under `script/` build the three emails IN YOUR FACE sends, create a Mailchimp draft from harry@inyourfacecomedy.ch, check it, and open it in your browser. You review and press Send in Mailchimp. Copy style: [writing-guide.md](writing-guide.md) applies to every word a subscriber reads.

## The three scripts

| Email | Script | When | Goes to |
|---|---|---|---|
| Monthly what's on | `bun script/email-monthly.ts` | start of the month (Tuesday morning is the best-performing slot) | whole audience |
| Post-show thank-you | `bun script/email-thankyou.ts "<thank-you link>"` | the morning after, once the ticket import has created the show's tag | that show's tag |
| Targeted promo | `bun script/email-promo.ts --show <slug> (--csv f \| --segment name \| --all) --brief "..." --lang it` | when a show needs a push to one group | a segment, a new segment from a CSV, or everyone |

All three share `script/lib/email/` (renderer, Mailchimp client, copy generator, site data) and the same flags:

```
--dry-run        render to script/email-out/ and open the preview locally; nothing touches Mailchimp
--copy <file>    reuse a saved .copy.json instead of asking Claude (edit the file, re-run)
--no-ai          placeholder words (for testing the layout)
--update <id>    update an existing draft (the number in the Mailchimp URL) instead of creating a new one
--no-open        do not open the browser
--yes            skip the confirmations
```

Every run writes `script/email-out/<stamp>-<type>-<slug>.html`, `.txt`, `.copy.json` and (dry runs) `.preview.html`. The directory is gitignored. `MC_API_KEY` is read from `.env` here, or from the old exporter's `.env` as a fallback; it never enters the repo.

### What a run does

1. Reads the site: `_data/calendar.yml` for dates, `_posts` for show pages, `_comedians` for faces and Instagram handles, `_data/gallery.yml` for the monthly hero photo. Nothing is typed in by hand.
2. Asks Claude for the words (subject, exactly-three-word preview text, body pieces) using the prompt in `script/email-prompts/<type>.md`, then validates: subject 50 characters or fewer, preview text three words, no em dashes (they are replaced with commas), every show present. Rejected answers are retried once with the reason. The result is saved as `.copy.json`.
3. Renders HTML and plain text, resizes any photos with `sips` and uploads them once to Mailchimp's File Manager (cached in `script/email-out/cache/uploads.json`).
4. Checks the HTML (under Gmail's 102KB clip, unsubscribe tag present, no address tags, no flex/grid/background images/web fonts, every image has alt text) and probes every link for a 2xx/3xx. Social sites only warn (they block bots).
5. Creates the draft (`from_name` Harry, reply-to harry@inyourfacecomedy.ch, no auto footer, opens and clicks tracked, Google Analytics tagging off), uploads the content, reads it back and re-checks, then prints the edit URL and opens it in Brave (Chrome is the work browser); `EMAIL_BROWSER="Google Chrome"` or `EMAIL_BROWSER=""` (system default) in `.env` overrides.

### Thank-you specifics

Input is the thank-you link Lineup Maker 2000 produces (`/comedians/?show=…&host=…&first=…&second=…&thankyou`). `guest:Name` entries become name-only tiles. The script lists the newest tags in Mailchimp, marks the ones that match the show, proposes the newest match with its member count, and asks before using it. The show date comes from the tag name (`… 3.9.2026 19:30, ROBIN's Coffee`). Pass `--segment "<tag name>"` to choose another, `--date` to override the date.

The email: greeting, two or three short paragraphs, a "next one" card (series shows say the regular slot, e.g. every Thursday at ROBIN's; one-offs get the next date if there is one), a calendar button, then the faces: photo linking to Instagram with the handle underneath, grouped Host / First half / Second half in running order.

### Monthly specifics

Default window is the next five weeks from today; `--month 2026-10` does one calendar month. One card per show with its real dates ("Thu 10, 17, 24 Sep, 1, 8 Oct"), venue and time from the calendar, the bolded show count linking to `/calendar/`, one featured audience photo from the gallery as the hero (`--no-hero` to skip). Cards link to the show's page on inyourfacecomedy.ch, never to Eventfrog; the script refuses to upload if an Eventfrog link sneaks in.

The hero carries the title baked into the photo ("October Comedy" over "Shows this month"), because email clients cannot layer text on an image: a local Brave or Chrome renders the photo plus outlined Anton text headlessly, `sips` makes the JPEG, and the result is cached by photo and text. `--hero-title "Autumn Comedy"` changes the words, `--no-hero-text` leaves the photo plain.

Shows in another language are listed only when they happen at ROBIN's: Promessi Spassi (Italian, ROBIN's) is in, La Tarima (Spanish, Goldfisch Club) is out. The language comes from `language: it` / `es` on the show's post in `_posts` (English when absent); the run prints what it skipped.

### Promo specifics

`--csv` takes any file with email addresses in it (a Mailchimp export, a spreadsheet column, one per line). Only subscribed audience members can be targeted; the others are listed and skipped, and the subscribed ones become a static segment named `promo-<show>-<date>`. Keep those files outside the repo. `--lang it|es|de` switches greeting, sign-off and the prompt; `--brief` tells Claude who is reading and why the show is for them. The first show's flyer is the hero.

## Mailchimp and the builders

Mailchimp's current email builder has no content API, and custom-coded HTML is a legacy-builder feature (Mailchimp help, "Paste in HTML" and "Use code content blocks", read 2026-09). So a script-built email is a **code-your-own campaign** (`content_type: html`): Preview, test sends, scheduling and Send all work from the campaign page, and the checklist shows the rendered email.

**Never click Edit design on one of these drafts.** Mailchimp migrates the campaign into the builder and the HTML is gone (this killed the first September 2026 draft, web id 8349857, still in the list as a dead shell). To change anything:

- Words: edit the `.copy.json` the run printed, then re-run the same command with `--copy <file> --update <web id>`.
- Layout: change the renderer (`script/lib/email/render.ts`), re-run with `--update`.
- Subject or preview text: also in the `.copy.json`, same re-run.

If you want to hand-build something in the new builder, `script/email-out/*.html` is still the reference: paste the `<body>` contents into a Code content block. That block sits inside Mailchimp's own wrapper, so the footer would be theirs.

### Ids

A campaign has two ids: the `web_id` in admin URLs (`8350060`) and the API id (`76abc03a37`). `--update` accepts either; the API cannot look up by web id, so the script scans the last 100 campaigns.

## What the 2026 numbers say (and what the scripts do about it)

- Phones show about 33 characters of a subject; the scripts cap subjects at 50 and the prompts ask for the show name early. Preview text is exactly three words by your rule; that fits every client.
- Send times: weekday mornings 8 to 11 local perform best, Tuesday first. Thank-yous within 24 hours, ideally the next morning 9 to 11: they are the best-read email an event sends, which is why the next date and the calendar button sit in it.
- Apple Mail Privacy Protection pre-fetches images, so roughly half of "opens" are machines. Read clicks (the ticket clicks land in the `/reports/` pages via the site's tracking), not opens.
- Gmail clips above 102KB; a thank-you is about 21KB, the monthly about 31KB.
- Text-to-image ratio still matters to spam filters: every email has real text, the faces and hero are extras with alt text, and a plain-text version goes with every send.
- Deliverability rules (Google/Yahoo bulk sender requirements): the domain is authenticated in Mailchimp (SPF, DKIM), Mailchimp adds one-click unsubscribe headers, the footer carries `*|UNSUB|*`. Keep spam complaints under 0.1%: do not resend to non-openers.

## Footer

The footer is one component (`footerHtml` in the renderer): calendar and social links, one sentence on why they get the email, Unsubscribe and Update preferences merge tags, `© *|CURRENT_YEAR|* *|LIST:COMPANY|*`. No `*|LIST:ADDRESS|*` or other template terms; those carry private details. `checkHtml` fails the run if an address tag appears.

## Copy rules the prompts enforce

- Subject under 50 characters, setup and punch. Preview text exactly three words.
- Thank-you body 60 to 110 words; monthly blurbs 25 words or fewer, one joke, venue named; promo 50 to 100 words in the chosen language.
- Blurbs match the show's language: La Tarima in Spanish, Promessi Spassi in Italian.
- Dates come from `_data/calendar.yml`, nothing else. The prompt never sees a date it is allowed to retype; the cards render them.
- No em dashes anywhere, including subject and preview. The validator replaces any that slip through.

Edit the prompts in `script/email-prompts/` freely; they are markdown with `${var}` placeholders and a `## System` / `## User` split.

## Before you press Send

The script has already checked the stored HTML, the plain text and every link. In Mailchimp:

1. Preview, and Send a test email to yourself.
2. Settings & Tracking: untick "Track campaign with Google Analytics" if it is on. That toggle is UI-only; the API field the script clears is a different thing.
3. Check the recipient count on the confirm screen. That screen is the send gate; the scripts never send.

## Gotchas

- Claude cannot be called from inside a Claude Code session (`CLAUDECODE` is set); the script says so and points at `--copy` or `--no-ai`.
- `sips` is macOS only. The scripts run on Harry's Mac like the cron jobs.
- Dry runs never talk to Mailchimp, so the segment step is skipped and the show date falls back to the last past date in `calendar_past.yml`.
- A tag with 0 members means the ticket import has not run; the thank-you refuses unless you force a segment.
- Deleting a campaign is permanent. Dead drafts stay until a human decides. Test drafts from building this: web ids 8350059 (raw API test) and 8350060 (placeholder thank-you); delete them from the campaign list.
- The old `eventfrog_exporter` still owns the ticket import and the tags; its `email-draft` verb is superseded by `email-thankyou.ts`.

## Template lineage (historical)

- May 2026 Calendar: web id `8348275` (hand-built in the builder)
- September 2026 Season Opener: web id `8349858`, API id `7ea6a7d246` (builder, replicate-and-edit flow, now retired)

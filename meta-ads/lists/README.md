# Email lists for customer audiences

People's data. Everything here except this file and `.gitkeep` is gitignored and must stay
that way: never `git add` a file from this folder, never paste an address into a tracked file.

What goes here:

- `tickets-YYYY-MM-DD.csv`: the ticket sales sheet ("Customer Analyser - Tickets Sold"), one
  row per ticket. Never uploaded as is.
- `mailchimp-YYYY-MM-DD.csv`: the Mailchimp audience export, Subscribed only. The opt-in is the
  consent (META_ADS.md phase 0); only emails in this file reach Meta.
- `buyers-recent-YYYY-MM-DD.csv`, `buyers-lapsed-YYYY-MM-DD.csv` and `buyers-all-YYYY-MM-DD.csv`:
  written by `bun script/meta-lists.ts` from the two above. Recent and lapsed are uploaded as
  customer-list audiences; all is the seed for the value-based lookalike (or the one upload
  if recent or lapsed is under 100 people).

Columns Meta maps automatically (header row exactly): `email`, `fn`, `ln`, `ct`, `zip`,
`country`, `value`. Only `email` is required; the rest raise the match rate. Country is `CH`
for four-digit postcodes and blank otherwise; value is CHF spent over all tickets (for a
value-based lookalike). Meta hashes the file in the browser on upload; `script/meta-audiences.ts`
will hash with SHA-256 before sending.

Keep only the newest export; delete older ones.

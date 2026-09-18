# script/

The maintenance and automation scripts for inyourfacecomedy.ch. The documentation lives in `docs/`:

- `docs/automation.md`: every script at a glance, what needs installing, how to run them from the
  terminal, the cron and launchd schedules, Healthchecks.
- `docs/scripts.md`: the detailed reference per script.

Quick orientation: `*.rb` run under Ruby 3.2.4 (stdlib only), `*.ts` under bun; `lib/` holds shared
TypeScript helpers and the Swift calendar bridge, `__tests__/` the bun tests, `launchd/` the tracked
copy of the launchd agent, `email-prompts/` the editable prompts for the email scripts. Every script
that writes has `--dry-run`. Logs (`*.log`) and output folders (`*-out/`) are gitignored.

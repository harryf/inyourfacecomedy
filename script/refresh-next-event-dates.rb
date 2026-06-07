#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — cron defaults Ruby to US-ASCII, and calendar.yml / posts hold
# non-ASCII bytes (Zürich, Español). See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# refresh-next-event-dates.rb
#
# For each _posts/*.md whose front-matter contains a `ticket_url` that points
# at an Eventfrog page, this script:
#
#   1. Skips the post if `next_event_date` is already in the future.
#   2. Otherwise curls the Eventfrog page (single-event or group/series page)
#      and parses out the next upcoming start datetime.
#   3. Rewrites `next_event_date`, `next_event_end_date`, and `last_modified_at`
#      in the post's YAML front-matter — preserving everything else verbatim.
#
# Eventfrog — not internal recurrence math — is the source of truth. Shows with
# erratic schedules (bi-weekly, 3-of-4-weeks, one-offs, postponed dates) all work
# from the same parsing path.
#
# Non-Eventfrog ticket URLs (e.g. eventbrite) are skipped with a clear message.
#
# Usage:
#   ruby script/refresh-next-event-dates.rb
#   ruby script/refresh-next-event-dates.rb --dry-run     # don't write
#   ruby script/refresh-next-event-dates.rb --verbose     # show parse details
#
# See ./README.md for cron install instructions.

require "net/http"
require "uri"
require "time"
require "date"
require "yaml"
require "json"
require "open3"
require "optparse"
require "rbconfig"

POSTS_DIR = File.expand_path("../_posts", __dir__)
PROJECT_ROOT = File.expand_path("..", __dir__)
HOMEPAGE = File.expand_path("../index.html", __dir__)
DEFAULT_DURATION_MIN = 150             # fallback show length when EventFrog omits endDate

# IndexNow — push-notify Bing/Yandex/Seznam (NOT Google, which doesn't consume it)
# when a show page's date changes, instead of waiting for the next sitemap crawl.
# The key file is public at the site root and its content equals the key (that IS
# IndexNow's ownership proof — no secret). Kept self-contained here on purpose:
# these cron scripts each duplicate their small helpers (load_dotenv, git_run)
# rather than share, so any one stays a single runnable file. Must match the key
# in sync-comedians.rb and the file served at /<key>.txt.
SITE_URL          = "https://inyourfacecomedy.ch"
INDEXNOW_KEY      = "4b04fa2d03884c6794d4ece40fb41a29"
INDEXNOW_ENDPOINT = URI("https://api.indexnow.org/indexnow")

options = { dry_run: false, verbose: false }
OptionParser.new do |opts|
  opts.on("--dry-run") { options[:dry_run] = true }
  opts.on("--verbose") { options[:verbose] = true }
end.parse!

# ---------- .env loader (stdlib only — no dotenv gem) ----------
# Loads KEY=VALUE pairs from <project_root>/.env if present. Lets cron point at
# this script without needing `set -a; source .env;` shell incantations.
def load_dotenv
  env_file = File.join(PROJECT_ROOT, ".env")
  return unless File.exist?(env_file)
  File.foreach(env_file, encoding: "UTF-8") do |line|
    line = line.strip
    next if line.empty? || line.start_with?("#")
    key, _, value = line.partition("=")
    value = value.strip.gsub(/\A["']|["']\z/, "")
    ENV[key.strip] ||= value unless key.strip.empty?
  end
end
load_dotenv

HEALTHCHECKS_URL = ENV["HEALTHCHECKS_URL"]
SCRIPT_NAME      = File.basename(__FILE__)

# Frame every Healthchecks body so the FIRST and LAST lines name this script — the
# Telegram alert then says which cron job broke without opening any log. All three
# cron scripts share this exact shape so the bot messages read uniformly.
def hc_body(label, detail)
  "[#{SCRIPT_NAME}] #{label}\n\n#{detail.to_s.strip}\n\n— end of [#{SCRIPT_NAME}] report —"
end

# ---------- Git ----------

# Run git with the project root pinned via `-C`. Returns [stdout+stderr, success?].
# Uses Open3 so no shell escaping concerns.
def git_run(*args)
  out, status = Open3.capture2e("git", "-C", PROJECT_ROOT, *args)
  [out.strip, status.success?]
end

# Discard a generated data file whose ONLY diff is its `generated_at:` timestamp, so
# a daily run that changed nothing real doesn't push a no-op site rebuild. Both
# calendar.yml and calendar_past.yml re-stamp generated_at on every run.
def discard_if_only_timestamp(rel)
  diff, _ = git_run("diff", "--unified=0", "--", rel)
  return if diff.empty?
  body = diff.lines.select { |l| l =~ /\A[+-]/ && l !~ /\A(\+\+\+|---)/ }
  git_run("checkout", "--", rel) if body.any? && body.all? { |l| l =~ /\A[+-]generated_at:/ }
end

# Stage, commit, and push refreshed posts + regenerated calendar/venue data.
# Retries once on non-fast-forward rejection by pulling --rebase against
# origin/master. Raises on unrecoverable failure; the top-level rescue then pings
# HC fail. Dry-run is implicit: nothing is written, so nothing stages and we
# return early via `no_staged`. Commits only when something actually changed.
def commit_and_push!
  # Avoid daily churn from the generated_at re-stamp on the calendar data files.
  discard_if_only_timestamp("_data/calendar.yml")
  discard_if_only_timestamp("_data/calendar_past.yml")

  out, ok = git_run("add", "-A", "_posts", "index.html",
                    "_data/calendar.yml", "_data/calendar_past.yml", "_data/venues.yml")
  raise "git add failed: #{out}" unless ok

  _, no_staged = git_run("diff", "--quiet", "--staged")
  return :no_changes if no_staged   # files identical to HEAD — nothing to commit

  out, ok = git_run("commit", "-m", "chore: refresh calendar data + next_event_date from Eventfrog")
  raise "git commit failed: #{out}" unless ok

  # First push attempt.
  out, ok = git_run("push", "origin", "master")
  return :pushed if ok

  # If rejected for being behind origin, rebase and retry once.
  if out =~ /non-fast-forward|fetch first|rejected.*Updates were rejected/im
    puts "  push rejected (branch behind origin), pulling --rebase..."
    out, ok = git_run("pull", "--rebase", "origin", "master")
    raise "git pull --rebase failed: #{out}" unless ok

    out, ok = git_run("push", "origin", "master")
    raise "git push (after rebase) failed: #{out}" unless ok
    return :pushed_after_rebase
  end

  raise "git push failed: #{out}"
end

# ---------- IndexNow ----------

# Best-effort push-index a batch of changed URLs. Never raises and never affects
# the script's exit status — a failure just warns. Only indexable (200) URLs
# should be passed in; we only ever pass show pages that actually rolled (+ the
# homepage, whose lastmod we bump). Mirrors sync-comedians.rb's submit_indexnow.
def submit_indexnow(urls)
  urls = urls.compact.uniq
  return if urls.empty?

  payload = {
    "host"        => URI(SITE_URL).host,
    "key"         => INDEXNOW_KEY,
    "keyLocation" => "#{SITE_URL}/#{INDEXNOW_KEY}.txt",
    "urlList"     => urls
  }

  http = Net::HTTP.new(INDEXNOW_ENDPOINT.host, INDEXNOW_ENDPOINT.port)
  http.use_ssl = true
  http.read_timeout = 30
  req = Net::HTTP::Post.new(INDEXNOW_ENDPOINT.request_uri)
  req["Content-Type"] = "application/json; charset=utf-8"
  req.body = JSON.generate(payload)

  resp = http.request(req)
  code = resp.code.to_i
  if code == 200 || code == 202
    puts "indexnow: submitted #{urls.size} url(s) → HTTP #{code}"
  else
    warn "  ! indexnow non-2xx (HTTP #{code}: #{resp.message}) — ignored (non-fatal)"
  end
rescue => e
  warn "  ! indexnow ping failed (#{e.message}) — ignored (non-fatal)"
end

# ---------- Notifications ----------

# Ping Healthchecks.io. Pass status: :start at the beginning, :success when clean,
# :fail with the run summary when anything went wrong. Best-effort — Telegram
# routing is configured on the Healthchecks side, not in this script.
def healthcheck_ping(status, body = nil)
  return unless HEALTHCHECKS_URL && !HEALTHCHECKS_URL.empty?
  suffix = case status
           when :start   then "/start"
           when :success then ""
           when :fail    then "/fail"
           end
  uri = URI("#{HEALTHCHECKS_URL}#{suffix}")
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 5, read_timeout: 10) do |http|
    req = Net::HTTP::Post.new(uri.request_uri)
    req.body = body if body
    http.request(req)
  end
rescue => e
  warn "healthcheck_ping(#{status}) failed: #{e.message}"
end

# ---------- Calendar data (single source of truth) ----------
#
# This script no longer scrapes EventFrog directly. script/refresh-calendar-data.rb
# is the one EventFrog extractor: it resolves every show, parses each event's
# JSON-LD (date, end, price, per-event venue) and writes _data/calendar.yml. Here
# we regenerate that file and derive each show's NEXT event from it — so the
# homepage / show-page dates and the /calendar/ page are built from one source and
# can never disagree.

CALENDAR_DATA = File.expand_path("../_data/calendar.yml", __dir__)
EXTRACTOR     = File.expand_path("refresh-calendar-data.rb", __dir__)
# Spawn child ruby with the SAME interpreter running this script — never a bare
# "ruby", which under cron's minimal PATH resolves to /usr/bin/ruby (macOS system
# 2.6) and can't parse the extractor's 3.0+ endless `def foo = …` defs. cron
# launches us via the absolute rbenv 3.2.4 path, so RbConfig.ruby is that 3.2.4.
RUBY = RbConfig.ruby

# Regenerate _data/calendar.yml (and append any new venues to _data/venues.yml).
# Raises on failure so we never derive dates from a stale or partial file.
def regenerate_calendar_data!(options)
  cmd = [RUBY, EXTRACTOR]
  cmd << "--quiet" unless options[:verbose]
  out, status = Open3.capture2e(*cmd, chdir: PROJECT_ROOT)
  puts out if options[:verbose]
  return if status.success?

  raise "refresh-calendar-data.rb failed (exit #{status.exitstatus}):\n#{out.lines.last(12).join}"
end

# {show_slug => earliest upcoming event} parsed from _data/calendar.yml. Events are
# already sorted ascending, but we take the min defensively.
def next_event_by_show
  doc = YAML.safe_load(File.read(CALENDAR_DATA), permitted_classes: [Date, Time], aliases: true) || {}
  (doc["events"] || []).each_with_object({}) do |e, h|
    slug = e["show"].to_s
    h[slug] = e if h[slug].nil? || e["start"].to_s < h[slug]["start"].to_s
  end
end

# ---------- Front-matter handling (line-level rewrite, no full YAML reformat) ----------

def split_post(content)
  m = content.match(/\A---\n(.*?)\n---\n(.*)\z/m)
  return nil unless m
  { raw_fm: m[1], body: m[2] }
end

# Returns scalar value for a top-level YAML key, or nil. Handles plain, "double",
# and 'single' quoted forms. Does not handle multi-line values — none of our
# scalar fields use them.
def yaml_get(raw_fm, key)
  m = raw_fm.match(/^#{Regexp.escape(key)}:\s*(.*?)\s*$/)
  return nil unless m
  v = m[1]
  v = v[1..-2] if (v.start_with?('"') && v.end_with?('"')) || (v.start_with?("'") && v.end_with?("'"))
  v.empty? ? nil : v
end

def yaml_set(raw_fm, key, value)
  re = /^#{Regexp.escape(key)}:.*$/
  if raw_fm =~ re
    raw_fm.sub(re, "#{key}: #{value}")
  else
    "#{raw_fm}\n#{key}: #{value}"
  end
end

# ---------- Per-post processing ----------

def process_post(path, next_by_show, now, options)
  content = File.read(path, encoding: "UTF-8")
  parsed = split_post(content)
  return [:skip, "no frontmatter"] unless parsed

  raw_fm = parsed[:raw_fm]
  ticket_url = yaml_get(raw_fm, "ticket_url")
  return [:skip, "no ticket_url"] unless ticket_url
  return [:skip, "not eventfrog (#{URI(ticket_url).host rescue 'unknown'})"] unless ticket_url.include?("eventfrog")

  # The next event comes from _data/calendar.yml (keyed on the post's permalink slug),
  # which carries the per-event venue — so variable-venue shows (La Tarima, Random
  # Facts) get the RIGHT venue for the upcoming date, not a stale static one.
  slug = yaml_get(raw_fm, "permalink").to_s.gsub(%r{^/|/$}, "")
  ev = next_by_show[slug]
  return [:skip, "no upcoming event in calendar.yml"] unless ev

  start_iso = ev["start"].to_s
  end_iso   = ev["end"].to_s
  if end_iso.empty?
    duration_min = (yaml_get(raw_fm, "default_duration_minutes") || DEFAULT_DURATION_MIN).to_i
    end_iso = ((Time.iso8601(start_iso) + duration_min * 60).iso8601 rescue "")
  end

  # Set substantive fields first (no timestamp) so a show whose next event is
  # unchanged isn't churned with a new last_modified_at every single day.
  new_fm = raw_fm
  new_fm = yaml_set(new_fm, "next_event_date", start_iso)
  new_fm = yaml_set(new_fm, "next_event_end_date", end_iso) unless end_iso.empty?
  new_fm = yaml_set(new_fm, "price_chf", ev["price_chf"]) if ev["price_chf"]
  new_fm = yaml_set(new_fm, "venue_slug", ev["venue"])    if ev["venue"]

  return [:skip, "unchanged (next #{start_iso})"] if new_fm == raw_fm

  modified_at = now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")
  new_fm = yaml_set(new_fm, "last_modified_at", modified_at)

  if options[:dry_run]
    puts "    [would-write] next=#{start_iso} end=#{end_iso} venue=#{ev["venue"]} price=#{ev["price_chf"]}" if options[:verbose]
  else
    File.write(path, "---\n#{new_fm}\n---\n#{parsed[:body]}")
  end

  msg = "rolled to #{start_iso} @ #{ev["venue"]}"
  msg += " (CHF #{ev["price_chf"]})" if ev["price_chf"]
  # Third element: the live show URL, collected by main to ping IndexNow on push.
  [:updated, msg, "#{SITE_URL}/#{slug}/"]
end

# Bump the homepage's `last_modified_at` so its sitemap <lastmod> reflects the
# fact that the front page now shows refreshed event dates. Called only when at
# least one post actually rolled. Returns true if the file was changed.
def update_homepage_timestamp(modified_at, options)
  return false unless File.exist?(HOMEPAGE)
  content = File.read(HOMEPAGE, encoding: "UTF-8")
  parsed = split_post(content)
  return false unless parsed

  new_fm = yaml_set(parsed[:raw_fm], "last_modified_at", modified_at)
  return false if new_fm == parsed[:raw_fm]

  if options[:dry_run]
    puts "    [would-write] homepage last_modified_at=#{modified_at}" if options[:verbose]
  else
    File.write(HOMEPAGE, "---\n#{new_fm}\n---\n#{parsed[:body]}")
  end
  true
end

# ---------- Main ----------

begin
  healthcheck_ping(:start)

  now = Time.now
  updated = 0
  errors = 0
  error_lines = []
  rolled_urls = []   # live URLs of pages that changed this run — pushed to IndexNow

  # Regenerate _data/calendar.yml from EventFrog (the single extractor), then derive
  # each show's next event from it. In --dry-run we use the existing file untouched.
  if options[:dry_run]
    puts "(dry-run: using existing _data/calendar.yml, not regenerating)"
  else
    regenerate_calendar_data!(options)
  end
  next_by_show = next_event_by_show

  Dir[File.join(POSTS_DIR, "*.md")].sort.each do |path|
    status, reason, url = process_post(path, next_by_show, now, options)
    name = File.basename(path)
    tag = case status
          when :updated then "ROLLED"
          when :error   then "ERROR "
          else "skip  "
          end
    line = "[#{tag}] #{name} — #{reason}"
    puts line
    if status == :updated
      updated += 1
      rolled_urls << url if url
    end
    if status == :error
      errors += 1
      error_lines << "#{name} — #{reason}"
    end
  end

  puts
  summary = "#{updated} post(s) updated. #{errors} error(s)."
  puts summary

  # If any post rolled, the homepage now displays new event dates — bump its
  # last_modified_at so the sitemap <lastmod> for "/" advances too.
  if updated > 0 && errors == 0
    modified_at = now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")
    if update_homepage_timestamp(modified_at, options)
      puts "homepage: bumped to #{modified_at}"
      rolled_urls << "#{SITE_URL}/"   # homepage now shows the new dates — ping it too
    else
      puts "homepage: unchanged"
    end
  end

  # Run git ONLY if file refresh was clean AND this is a real run. A parse error
  # means we don't trust the tree; --dry-run must NEVER stage, commit, or push.
  git_result = nil
  git_error  = nil
  if options[:dry_run]
    puts "git: skipped (--dry-run)"
  elsif errors == 0
    begin
      git_result = commit_and_push!
      puts "git: #{git_result}"
      # Push-index the changed show pages (+ homepage) so Bing/Yandex pick up the
      # new dates fast instead of waiting for a sitemap re-crawl. Only after a real
      # push (not :no_changes), and never fatal.
      if [:pushed, :pushed_after_rebase].include?(git_result)
        submit_indexnow(rolled_urls)
      end
    rescue => e
      git_error = e.message
      puts "git: ERROR — #{git_error}"
    end
  end

  if errors > 0 || git_error
    detail_lines = []
    detail_lines << "Parse errors: #{errors}" if errors > 0
    detail_lines.concat(error_lines.map { |l| "  - #{l}" })
    detail_lines << "Git: #{git_error}" if git_error
    healthcheck_ping(:fail, hc_body("FAILED", detail_lines.join("\n")))
    exit 1
  else
    healthcheck_ping(:success, hc_body("OK", "#{summary} git: #{git_result}"))
    exit 0
  end
rescue => e
  # Catastrophic crash (ruby exception, missing file, etc.). Ping HC with the
  # trace before re-raising so cron stderr still gets the trace.
  begin
    healthcheck_ping(:fail, hc_body("CRASHED", "#{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"))
  rescue
    # If the HC ping itself fails, swallow — primary error propagates next.
  end
  raise
end

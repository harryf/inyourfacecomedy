#!/usr/bin/env ruby
# frozen_string_literal: true
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
require "open3"
require "optparse"

POSTS_DIR = File.expand_path("../_posts", __dir__)
PROJECT_ROOT = File.expand_path("..", __dir__)
DEFAULT_DURATION_MIN = 150
ZURICH_TZ_OFFSET = "+02:00"            # CEST. Wrong by 1h Oct-Mar; acceptable for now.
USER_AGENT = "Mozilla/5.0 (compatible; IYF schema refresh)"

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
  File.foreach(env_file) do |line|
    line = line.strip
    next if line.empty? || line.start_with?("#")
    key, _, value = line.partition("=")
    value = value.strip.gsub(/\A["']|["']\z/, "")
    ENV[key.strip] ||= value unless key.strip.empty?
  end
end
load_dotenv

HEALTHCHECKS_URL = ENV["HEALTHCHECKS_URL"]

# ---------- Git ----------

# Run git with the project root pinned via `-C`. Returns [stdout+stderr, success?].
# Uses Open3 so no shell escaping concerns.
def git_run(*args)
  out, status = Open3.capture2e("git", "-C", PROJECT_ROOT, *args)
  [out.strip, status.success?]
end

# Stage, commit, and push refreshed posts. Retries once on non-fast-forward
# rejection by pulling --rebase against origin/master.
# Raises on unrecoverable failure; the top-level rescue then pings HC fail.
# Dry-run is implicit: process_post skips writes in --dry-run, so there's
# nothing for `git add` to stage, and we return early via `no_staged`.
def commit_and_push!(updated_count)
  return :no_changes if updated_count == 0

  out, ok = git_run("add", "-A", "_posts")
  raise "git add failed: #{out}" unless ok

  _, no_staged = git_run("diff", "--quiet", "--staged")
  return :no_changes if no_staged   # files identical to HEAD — nothing to commit

  out, ok = git_run("commit", "-m", "chore: refresh next_event_date from Eventfrog")
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

# ---------- Eventfrog parsing ----------

# Returns Time of next future event start, or nil if not parseable / no future event found.
def next_start_from_eventfrog(html, now)
  # Primary signal: <time itemprop="startDate" datetime="2026-05-28T19:30TZD">
  # Eventfrog uses the literal "TZD" placeholder, so we strip the timezone suffix
  # and apply Zurich offset ourselves.
  start_match = html.match(/<time[^>]+itemprop="startDate"[^>]+datetime="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  default_time = start_match ? start_match[2] : "20:00"

  if start_match
    iso = "#{start_match[1]}T#{start_match[2]}:00#{ZURICH_TZ_OFFSET}"
    t = Time.iso8601(iso)
    return t if t > now
  end

  # Fallback: extract all DD.MM.YYYY occurrences, dedupe, pick soonest future.
  # Use default_time from itemprop=startDate (or 20:00 if absent).
  dates = html.scan(/(\d{2})\.(\d{2})\.(\d{4})/).map { |dd, mm, yyyy| "#{yyyy}-#{mm}-#{dd}" }.uniq.sort
  dates.each do |d|
    iso = "#{d}T#{default_time}:00#{ZURICH_TZ_OFFSET}"
    t = Time.iso8601(iso)
    return t if t > now
  end

  nil
end

def fetch_url(url, limit = 5)
  raise "Too many redirects" if limit <= 0

  uri = URI(url)
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", open_timeout: 10, read_timeout: 15) do |http|
    req = Net::HTTP::Get.new(uri.request_uri)
    req["User-Agent"] = USER_AGENT
    res = http.request(req)
    case res
    when Net::HTTPSuccess
      res.body
    when Net::HTTPRedirection
      next_uri = URI.join(url, res["location"]).to_s   # handles both absolute + relative redirects
      fetch_url(next_uri, limit - 1)
    else
      raise "HTTP #{res.code} #{res.message}"
    end
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

def process_post(path, now, options)
  content = File.read(path)
  parsed = split_post(content)
  return [:skip, "no frontmatter"] unless parsed

  raw_fm = parsed[:raw_fm]
  ticket_url = yaml_get(raw_fm, "ticket_url")
  return [:skip, "no ticket_url"] unless ticket_url
  return [:skip, "not eventfrog (#{URI(ticket_url).host rescue 'unknown'})"] unless ticket_url.include?("eventfrog")

  # Opt-out: posts without a venue can't emit valid Event schema (location is required by Google),
  # so refreshing their next_event_date would only produce a half-baked block. La Tarima, for example,
  # has variable venues (Basel + Monroe) — see Roadmap/Sprint-1/01-schema-event-and-calendar/decisions/.
  unless yaml_get(raw_fm, "venue_slug")
    return [:skip, "no venue_slug — Event schema can't be complete, refusing to roll"]
  end

  existing_iso = yaml_get(raw_fm, "next_event_date")
  if existing_iso
    existing = Time.iso8601(existing_iso) rescue nil
    if existing && existing > now
      return [:skip, "already future (#{existing.iso8601})"]
    end
  end

  begin
    html = fetch_url(ticket_url)
  rescue => e
    return [:error, "fetch failed: #{e.message}"]
  end

  start_t = next_start_from_eventfrog(html, now)
  return [:skip, "no future event found on Eventfrog page"] unless start_t

  duration_min = (yaml_get(raw_fm, "default_duration_minutes") || DEFAULT_DURATION_MIN).to_i
  end_t = start_t + (duration_min * 60)
  modified_at = now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")

  new_fm = raw_fm
  new_fm = yaml_set(new_fm, "next_event_date", start_t.iso8601)
  new_fm = yaml_set(new_fm, "next_event_end_date", end_t.iso8601)
  new_fm = yaml_set(new_fm, "last_modified_at", modified_at)

  if options[:dry_run]
    puts "    [would-write] next_event_date: #{start_t.iso8601}" if options[:verbose]
  else
    File.write(path, "---\n#{new_fm}\n---\n#{parsed[:body]}")
  end

  [:updated, "rolled to #{start_t.iso8601}"]
end

# ---------- Main ----------

begin
  healthcheck_ping(:start)

  now = Time.now
  updated = 0
  errors = 0
  error_lines = []

  Dir[File.join(POSTS_DIR, "*.md")].sort.each do |path|
    status, reason = process_post(path, now, options)
    name = File.basename(path)
    tag = case status
          when :updated then "ROLLED"
          when :error   then "ERROR "
          else "skip  "
          end
    line = "[#{tag}] #{name} — #{reason}"
    puts line
    updated += 1 if status == :updated
    if status == :error
      errors += 1
      error_lines << "#{name} — #{reason}"
    end
  end

  puts
  summary = "#{updated} post(s) updated. #{errors} error(s)."
  puts summary

  # Run git ONLY if file refresh was clean. A parse error means we don't trust
  # the resulting tree and shouldn't push half-correct dates.
  git_result = nil
  git_error  = nil
  if errors == 0
    begin
      git_result = commit_and_push!(updated)
      puts "git: #{git_result}"
    rescue => e
      git_error = e.message
      puts "git: ERROR — #{git_error}"
    end
  end

  if errors > 0 || git_error
    body_lines = ["IYF refresh script failed"]
    body_lines << "Parse errors: #{errors}" if errors > 0
    body_lines.concat(error_lines.map { |l| "  - #{l}" })
    body_lines << "Git: #{git_error}" if git_error
    healthcheck_ping(:fail, body_lines.join("\n"))
    exit 1
  else
    healthcheck_ping(:success, "#{summary} git: #{git_result}")
    exit 0
  end
rescue => e
  # Catastrophic crash (ruby exception, missing file, etc.). Ping HC with the
  # trace before re-raising so cron stderr still gets the trace.
  begin
    healthcheck_ping(:fail, "Crash: #{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}")
  rescue
    # If the HC ping itself fails, swallow — primary error propagates next.
  end
  raise
end

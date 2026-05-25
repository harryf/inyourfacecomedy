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
#
# Eventfrog ticket URLs land on one of two page shapes:
#
#   GROUP PAGE (e.g. /comedybrew → /de/p/gruppen/...html)
#     - Multiple <td class="datecol"> rows, one per upcoming instance
#     - Each row has its own <a itemprop="offers" href="...individual..."> link
#     - The page's own <time itemprop="startDate"> reflects the next future instance
#
#   INDIVIDUAL EVENT PAGE (e.g. /de/p/theater-buehne/.../{slug}-{id}.html)
#     - One <time itemprop="startDate" datetime="YYYY-MM-DDTHH:MM…">
#     - Two <time itemprop="doorTime"> entries: door-open (= start) and door-close (= end)
#     - Inline JSON-like "price": "10.0" + "priceCurrency": "CHF"
#
# Strategy: if the URL lands on a GROUP page, find the next future row's
# individual ticket page, fetch THAT, and parse the richer per-instance data
# (start, end, price). If the URL lands directly on an INDIVIDUAL page, parse
# that page in place. Either path returns { start:, end_at:, price_chf: } where
# end_at and price_chf may be nil if the page doesn't expose them.

EventDetails = Struct.new(:start, :end_at, :price_chf, keyword_init: true)

def is_group_page?(html)
  html.scan(/<td class="datecol"/).length > 1
end

# Walk <tr> rows on a group page, returning the offers URL of the first row
# whose datecol date is in the future. Returns nil if no future row exists.
def next_future_individual_url(group_html, now)
  group_html.scan(/<tr[^>]*>(.*?)<\/tr>/m).each do |row_match|
    row = row_match[0]
    date_m = row.match(/(\d{2})\.(\d{2})\.(\d{4})/)
    time_m = row.match(/(\d{1,2}):(\d{2})\s+Uhr/)
    href_m = row.match(/<a[^>]+itemprop="offers"[^>]+href="([^"]+)"/)
    next unless date_m && href_m

    dd, mm, yyyy = date_m[1], date_m[2], date_m[3]
    hh = (time_m ? time_m[1] : "20").rjust(2, "0")
    mn = time_m ? time_m[2] : "00"
    iso = "#{yyyy}-#{mm}-#{dd}T#{hh}:#{mn}:00#{ZURICH_TZ_OFFSET}"
    t = (Time.iso8601(iso) rescue nil)
    next unless t && t > now

    return href_m[1]
  end
  nil
end

# Parse an individual event page. Returns EventDetails or nil.
def parse_individual_page(html, now)
  start_m = html.match(/<time[^>]+itemprop="startDate"[^>]+datetime="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  return nil unless start_m
  start_iso = "#{start_m[1]}T#{start_m[2]}:00#{ZURICH_TZ_OFFSET}"
  start_t = (Time.iso8601(start_iso) rescue nil)
  return nil unless start_t && start_t > now

  # Two <time itemprop="doorTime"> entries: [door-open, door-close].
  # door-close is the de-facto end time. If only one entry exists, return nil end.
  door_times = html.scan(/<time[^>]+itemprop="doorTime"[^>]+datetime="(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)
  end_t = nil
  if door_times.length >= 2
    end_iso = "#{door_times[1][0]}T#{door_times[1][1]}:00#{ZURICH_TZ_OFFSET}"
    end_t = (Time.iso8601(end_iso) rescue nil)
  end

  # Price: inline JSON "price": "10.0", "priceCurrency": "CHF"
  price = nil
  if (m = html.match(/"price":\s*"([0-9.]+)".{0,100}?"priceCurrency":\s*"CHF"/m))
    price = m[1].to_f
  elsif (m = html.match(/"price":\s*"([0-9.]+)"/))
    price = m[1].to_f
  end
  price_int = price ? price.round : nil

  EventDetails.new(start: start_t, end_at: end_t, price_chf: price_int)
end

# Top-level: from a ticket_url, return EventDetails for the next future event,
# or nil. Handles both group and individual page shapes.
def fetch_event_details(ticket_url, now)
  html = fetch_url(ticket_url)

  if is_group_page?(html)
    href = next_future_individual_url(html, now)
    return nil unless href
    individual_url = URI.join(ticket_url, href).to_s
    html = fetch_url(individual_url)
  end

  parse_individual_page(html, now)
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
    details = fetch_event_details(ticket_url, now)
  rescue => e
    return [:error, "fetch failed: #{e.message}"]
  end

  return [:skip, "no future event found on Eventfrog"] unless details

  start_t = details.start
  duration_min = (yaml_get(raw_fm, "default_duration_minutes") || DEFAULT_DURATION_MIN).to_i
  end_t = details.end_at || (start_t + duration_min * 60)
  modified_at = now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")

  new_fm = raw_fm
  new_fm = yaml_set(new_fm, "next_event_date", start_t.iso8601)
  new_fm = yaml_set(new_fm, "next_event_end_date", end_t.iso8601)
  new_fm = yaml_set(new_fm, "price_chf", details.price_chf) if details.price_chf
  new_fm = yaml_set(new_fm, "last_modified_at", modified_at)

  if options[:dry_run]
    puts "    [would-write] start=#{start_t.iso8601} end=#{end_t.iso8601} price=#{details.price_chf}" if options[:verbose]
  else
    File.write(path, "---\n#{new_fm}\n---\n#{parsed[:body]}")
  end

  msg = "rolled to #{start_t.iso8601}"
  msg += " (end #{end_t.iso8601 == (start_t + duration_min * 60).iso8601 ? 'default' : 'from Eventfrog'}"
  msg += ", price CHF #{details.price_chf})" if details.price_chf
  msg += ")" unless details.price_chf
  [:updated, msg]
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

#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads: cron defaults Ruby to US-ASCII and calendar.yml holds Zürich and
# Español. See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# hours-to-google.rb
#
# Keeps the opening hours on the IN YOUR FACE Comedy Google Business Profile listing in
# step with the ROBIN's show calendar. The listing's address is ROBIN's, so a show there
# is when the "business" is open; shows at other venues never count.
#
# Source of truth: _data/calendar.yml (every upcoming instance of every show, written by
# refresh-calendar-data.rb from Eventfrog at 09:00). Every period is padded: doors open
# PAD_MINUTES before the show starts and close PAD_MINUTES after it ends.
#
# What gets written (Business Information API, PATCH locations/{id}):
#   * regularHours: the weekly pattern. A weekday is regular when it has a ROBIN's show
#     in at least REGULAR_SHARE of the weeks the data covers, up to REGULAR_WEEKS ahead (six of
#     eight; Tuesday and Thursday at the
#     time of writing). Its period is the envelope of that weekday's shows in the window:
#     earliest padded open to latest padded close. Alternating shows with different start
#     times (Jokes at 19:30, Tall Order at 20:00) therefore share one Tuesday period and
#     produce no per-date exceptions.
#   * specialHours: per-date overrides for the next SPECIAL_DAYS days. A date on a
#     non-regular weekday with a show is an open period (a Friday one-off, a monthly
#     Sunday); a regular weekday date with no show is closed (a skipped week).
#     Google requires regular hours before special hours may be set.
#
# Every run GETs the live hours first and compares them with the plan (special periods
# before today are ignored on both sides). Equal means no write, so a normal day makes no
# request beyond the read. Different means one validateOnly PATCH, then the real PATCH,
# then a read-back that must equal the plan.
#
# Usage:
#   ruby script/hours-to-google.rb --dry-run       # read-only: prints the plan and the diff
#   ruby script/hours-to-google.rb --dry-run -v    # plus every show that fed the plan
#   ruby script/hours-to-google.rb                 # live (what cron runs)
#   ruby script/hours-to-google.rb --from 2026-12-21 --dry-run   # plan as if today were that date
#
# Secrets (gitignored, shared with post-events-to-google.rb): client_secret_*.json (OAuth
# client), gbp-token.json (refresh token). The OAuth consent is done once with
# `ruby script/post-events-to-google.rb --authorize`; the business.manage scope covers this too.

require "net/http"
require "uri"
require "time"
require "date"
require "json"
require "yaml"
require "optparse"

# Wall clock in Zurich whatever the cron environment says. Every time goes through the
# zone, never through the digits in the string (calendar.yml carried a fixed +02:00
# offset all year until 2026-10-05; it now carries the real Zürich offset per date).
ENV["TZ"] = "Europe/Zurich"

# ---------- Paths & constants ----------

PROJECT_ROOT  = File.expand_path("..", __dir__)
CALENDAR_FILE = File.join(PROJECT_ROOT, "_data", "calendar.yml")
TOKEN_FILE    = ENV["GBP_TOKEN_FILE"] || File.join(PROJECT_ROOT, "gbp-token.json")

ROBINS_SLUG   = "robins"
LOCATION_ID   = "18390205646696162099"   # the GBP location (docs/google-business-profile-api-setup.md)
BI_HOST       = "https://mybusinessbusinessinformation.googleapis.com/v1"
LOCATION_URL  = "#{BI_HOST}/locations/#{LOCATION_ID}"
READ_MASK     = "regularHours,specialHours"

PAD_MINUTES   = (ENV["GBP_HOURS_PAD"] || "30").to_i     # doors before the start, lights after the end
REGULAR_WEEKS = (ENV["GBP_REGULAR_WEEKS"] || "8").to_i    # look-ahead for the weekly pattern
REGULAR_SHARE = (ENV["GBP_REGULAR_SHARE"] || "0.75").to_f # share of covered weeks with a show (6 of 8)
REGULAR_MIN_WEEKS = 2                                     # never call a weekday regular on less data
SPECIAL_DAYS  = (ENV["GBP_SPECIAL_DAYS"] || "42").to_i    # per-date overrides this far ahead
DEFAULT_DURATION = 2 * 3600                              # when an event has no end

DAY_NAMES = %w[SUNDAY MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY].freeze   # Date#wday order
DAY_ORDER = %w[MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY].freeze   # display order

SCRIPT_NAME = File.basename(__FILE__)

options = { dry_run: false, verbose: false, from: nil }
OptionParser.new do |o|
  o.on("--dry-run")        { options[:dry_run] = true }
  o.on("-v", "--verbose")  { options[:verbose] = true }
  o.on("--from DATE", "plan as if today were DATE (YYYY-MM-DD); implies --dry-run") do |d|
    options[:from] = Date.iso8601(d)
    options[:dry_run] = true
  end
end.parse!
VERBOSE = options[:verbose]
DRY_RUN = options[:dry_run]
TODAY   = options[:from] || Date.today

def log(msg) = puts(msg)
def vlog(msg) = (puts(msg) if VERBOSE)

# ---------- .env loader (stdlib only; copied from post-events-to-google.rb) ----------

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

HEALTHCHECKS_URL = ENV["GBP_HEALTHCHECKS_URL"] || ENV["HEALTHCHECKS_URL"]

# ---------- Healthchecks (copied from post-events-to-google.rb) ----------

def hc_body(label, detail)
  "[#{SCRIPT_NAME}] #{label}\n\n#{detail.to_s.strip}\n\n(end of [#{SCRIPT_NAME}] report)"
end

def healthcheck_ping(status, body = nil)
  return if DRY_RUN   # dry-run must not touch the alert channel
  return unless HEALTHCHECKS_URL && !HEALTHCHECKS_URL.empty?
  suffix = { start: "/start", success: "", fail: "/fail" }[status]
  uri = URI("#{HEALTHCHECKS_URL}#{suffix}")
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                  open_timeout: 5, read_timeout: 10) do |http|
    req = Net::HTTP::Post.new(uri.request_uri)
    req.body = body if body
    http.request(req)
  end
rescue => e
  warn "healthcheck_ping(#{status}) failed: #{e.message}"
end

# ---------- OAuth (copied from post-events-to-google.rb) ----------

def client_config
  path = Dir[File.join(PROJECT_ROOT, "client_secret_*.json")].first
  raise "No client_secret_*.json found in #{PROJECT_ROOT}" unless path
  j = JSON.parse(File.read(path))
  j["installed"] || j["web"] || raise("Unexpected client secret shape in #{File.basename(path)}")
end

def access_token
  raise "No #{TOKEN_FILE}: run ruby script/post-events-to-google.rb --authorize" unless File.exist?(TOKEN_FILE)
  cfg = client_config
  saved = JSON.parse(File.read(TOKEN_FILE))
  resp = http_form(cfg["token_uri"], {
    "client_id"     => cfg["client_id"],
    "client_secret" => cfg["client_secret"],
    "refresh_token" => saved["refresh_token"],
    "grant_type"    => "refresh_token"
  })
  resp["access_token"] || raise("Failed to refresh access token: #{resp.inspect}")
end

# ---------- HTTP helpers ----------

def http_form(url, form)
  uri = URI(url)
  req = Net::HTTP::Post.new(uri)
  req.set_form_data(form)
  do_request(uri, req)
end

def api_request(method, url, token, body = nil)
  # In dry-run only reads may reach the network, whatever a future call site forgets.
  raise "BLOCKED: #{method.to_s.upcase} attempted in --dry-run" if DRY_RUN && method != :get
  uri = URI(url)
  klass = { get: Net::HTTP::Get, patch: Net::HTTP::Patch }[method]
  req = klass.new(uri)
  req["Authorization"] = "Bearer #{token}"
  if body
    req["Content-Type"] = "application/json"
    req.body = JSON.generate(body)
  end
  do_request(uri, req, raw_code: true)
end

def do_request(uri, req, raw_code: false)
  resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true,
                         open_timeout: 15, read_timeout: 30) { |h| h.request(req) }
  parsed = (JSON.parse(resp.body) rescue resp.body)
  raw_code ? [resp.code.to_i, parsed] : parsed
end

def api_error(resp)
  (resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 400]
end

# ---------- Shows from calendar.yml ----------

Slot = Struct.new(:date, :open_min, :close_min, :title, keyword_init: true)
# open_min / close_min: minutes since midnight of `date`, padded; close_min may pass 1440
# when the padded end lands after midnight.

def robins_slots
  data = YAML.safe_load(File.read(CALENDAR_FILE, encoding: "UTF-8"),
                        permitted_classes: [Date, Time], aliases: true)
  events = (data && data["events"]) || []
  events.filter_map do |ev|
    next unless ev["venue"] == ROBINS_SLUG
    start_t = (Time.iso8601(ev["start"].to_s) rescue nil) or next
    end_t   = (Time.iso8601(ev["end"].to_s) rescue nil) || (start_t + DEFAULT_DURATION)
    end_t   = start_t + DEFAULT_DURATION if end_t <= start_t
    start_l = start_t.localtime
    end_l   = end_t.localtime
    date    = start_l.to_date
    open_min  = start_l.hour * 60 + start_l.min - PAD_MINUTES
    close_min = (end_l.to_date - date).to_i * 1440 + end_l.hour * 60 + end_l.min + PAD_MINUTES
    open_min = 0 if open_min.negative?
    Slot.new(date: date, open_min: open_min, close_min: close_min, title: ev["title"].to_s)
  end.sort_by { |s| [s.date, s.open_min] }
end

# ---------- The plan ----------

def envelope(slots)
  [slots.map(&:open_min).min, slots.map(&:close_min).max]
end

def hhmm(min)
  format("%02d:%02d", (min % 1440) / 60, min % 60)
end

# Google TimeOfDay. 24:00 is expressed as hours 24; anything past that rolls into the next
# day through closeDay / endDate (handled by the callers).
def time_of_day(min)
  return { "hours" => 24 } if min == 1440
  t = { "hours" => (min % 1440) / 60 }
  t["minutes"] = min % 60 unless (min % 60).zero?
  t
end

def gdate(date)
  { "year" => date.year, "month" => date.month, "day" => date.day }
end

def next_day_name(day)
  DAY_ORDER[(DAY_ORDER.index(day) + 1) % 7]
end

# The calendar data ends where Eventfrog's published dates end (Comedy Brew is published
# in batches), so every look-ahead is capped at the last ROBIN's date on record: a
# Thursday past that point is unknown, not closed.
def data_horizon(slots)
  slots.map(&:date).max
end

# Weekdays with a show in at least REGULAR_SHARE of the weeks the data covers (up to
# REGULAR_WEEKS ahead), each with its envelope over that window.
# Returns { "TUESDAY" => [open_min, close_min], ... }.
def regular_pattern(slots)
  horizon = [TODAY + REGULAR_WEEKS * 7 - 1, data_horizon(slots)].min
  in_window = slots.select { |s| s.date >= TODAY && s.date <= horizon }
  pattern = {}
  DAY_ORDER.each do |day|
    covered = (TODAY..horizon).count { |d| DAY_NAMES[d.wday] == day }
    next if covered < REGULAR_MIN_WEEKS
    day_slots = in_window.select { |s| DAY_NAMES[s.date.wday] == day }
    hits = day_slots.map(&:date).uniq.size
    next if hits < (covered * REGULAR_SHARE).ceil
    pattern[day] = envelope(day_slots)
  end
  pattern
end

# Per-date overrides for the next SPECIAL_DAYS days (capped at the data horizon), sorted
# by date. Each is { date:, open_min:, close_min: } or { date:, closed: true }.
def special_overrides(slots, pattern)
  by_date = slots.group_by(&:date)
  last = [TODAY + SPECIAL_DAYS - 1, data_horizon(slots)].min
  (TODAY..last).filter_map do |date|
    day  = DAY_NAMES[date.wday]
    shows = by_date[date] || []
    if pattern.key?(day)
      shows.empty? ? { date: date, closed: true } : nil
    elsif shows.any?
      o, c = envelope(shows)
      { date: date, open_min: o, close_min: c }
    end
  end
end

def build_regular(pattern)
  periods = pattern.map do |day, (o, c)|
    close_day = c > 1440 ? next_day_name(day) : day
    { "openDay" => day, "openTime" => time_of_day(o), "closeDay" => close_day, "closeTime" => time_of_day(c) }
  end
  { "periods" => periods }
end

def build_special(overrides)
  periods = overrides.map do |ov|
    if ov[:closed]
      { "startDate" => gdate(ov[:date]), "endDate" => gdate(ov[:date]), "closed" => true }
    else
      end_date = ov[:close_min] > 1440 ? ov[:date] + 1 : ov[:date]
      { "startDate" => gdate(ov[:date]), "openTime" => time_of_day(ov[:open_min]),
        "endDate" => gdate(end_date), "closeTime" => time_of_day(ov[:close_min]) }
    end
  end
  { "specialHourPeriods" => periods }
end

# ---------- Canonical form (for comparing plan and live) ----------

def tod_min(t)
  return nil unless t.is_a?(Hash)
  t.fetch("hours", 0) * 60 + t.fetch("minutes", 0)
end

def canon_regular(rh)
  ((rh || {})["periods"] || []).map do |p|
    "#{p["openDay"]} #{hhmm(tod_min(p["openTime"]))} #{p["closeDay"] || p["openDay"]} #{hhmm(tod_min(p["closeTime"]))}"
  end.sort
end

def canon_date(d)
  return nil unless d.is_a?(Hash)
  Date.new(d["year"], d["month"], d["day"])
end

# Periods before today are dropped on both sides: Google keeps stale past dates around
# and they must not force a write on their own.
def canon_special(sh)
  ((sh || {})["specialHourPeriods"] || []).filter_map do |p|
    start = canon_date(p["startDate"]) or next
    next if start < TODAY
    if p["closed"]
      "#{start} closed"
    else
      "#{start} #{hhmm(tod_min(p["openTime"]))} #{canon_date(p["endDate"]) || start} #{hhmm(tod_min(p["closeTime"]))}"
    end
  end.sort
end

def canon(location)
  { regular: canon_regular(location["regularHours"]), special: canon_special(location["specialHours"]) }
end

def print_lines(label, lines)
  log "#{label} (#{lines.size}):"
  lines.each { |l| log "  #{l}" }
end

# ---------- Main ----------

begin
  healthcheck_ping(:start)
  log "#{SCRIPT_NAME} #{DRY_RUN ? '(dry-run) ' : ''}#{Time.now.strftime('%Y-%m-%d %H:%M %Z')}, today #{TODAY}, pad #{PAD_MINUTES} min"

  slots = robins_slots
  raise "No ROBIN's events in #{CALENDAR_FILE}: refusing to write empty hours" if slots.none? { |s| s.date >= TODAY }
  if VERBOSE
    slots.select { |s| s.date >= TODAY && s.date < TODAY + SPECIAL_DAYS }.each do |s|
      vlog "  #{s.date} #{DAY_NAMES[s.date.wday][0, 3]} #{hhmm(s.open_min)} to #{hhmm(s.close_min)}#{s.close_min >= 1440 ? ' (+1)' : ''}  #{s.title}"
    end
  end

  pattern = regular_pattern(slots)
  if pattern.empty?
    # Google needs regular hours before special hours, and a listing with stale hours
    # beats one with none: keep whatever is live and say so.
    msg = "No regular weekday in the data through #{data_horizon(slots)}; keeping the live hours untouched"
    log msg
    healthcheck_ping(:success, hc_body("kept", msg))
    exit 0
  end
  overrides = special_overrides(slots, pattern)
  plan = { "regularHours" => build_regular(pattern), "specialHours" => build_special(overrides) }
  plan_c = canon(plan)

  print_lines "Regular hours", plan_c[:regular]
  print_lines "Special hours, next #{SPECIAL_DAYS} days", plan_c[:special]

  token = access_token
  code, live = api_request(:get, "#{LOCATION_URL}?readMask=#{READ_MASK}", token)
  raise "GET location HTTP #{code}: #{api_error(live)}" unless code == 200
  live_c = canon(live)

  if live_c == plan_c
    log "Live listing: in sync, nothing to write."
    healthcheck_ping(:success, hc_body("in sync", "regular #{plan_c[:regular].size}, special #{plan_c[:special].size}"))
    exit 0
  end

  log "Live listing differs:"
  %i[regular special].each do |k|
    (live_c[k] - plan_c[k]).each { |l| log "  - #{l}" }
    (plan_c[k] - live_c[k]).each { |l| log "  + #{l}" }
  end

  if DRY_RUN
    log "Dry run: would PATCH updateMask=#{READ_MASK}."
    exit 0
  end

  patch_url = "#{LOCATION_URL}?updateMask=#{READ_MASK}"
  code, resp = api_request(:patch, "#{patch_url}&validateOnly=true", token, plan)
  raise "validateOnly PATCH HTTP #{code}: #{api_error(resp)}" unless code == 200
  log "validateOnly: ok"

  code, resp = api_request(:patch, patch_url, token, plan)
  raise "PATCH HTTP #{code}: #{api_error(resp)}" unless code == 200
  log "PATCH: ok"

  code, back = api_request(:get, "#{LOCATION_URL}?readMask=#{READ_MASK}", token)
  raise "read-back GET HTTP #{code}: #{api_error(back)}" unless code == 200
  back_c = canon(back)
  if back_c == plan_c
    log "Read-back: matches the plan."
    healthcheck_ping(:success, hc_body("hours written", "regular #{plan_c[:regular].size}, special #{plan_c[:special].size}"))
  else
    detail = "regular live #{back_c[:regular].inspect}\nregular plan #{plan_c[:regular].inspect}\n" \
             "special live #{back_c[:special].inspect}\nspecial plan #{plan_c[:special].inspect}"
    log "Read-back DIFFERS from the plan:\n#{detail}"
    healthcheck_ping(:fail, hc_body("read-back differs", detail))
    exit 1
  end
rescue SystemExit
  raise
rescue => e
  warn "ERROR: #{e.class}: #{e.message}"
  warn e.backtrace.first(5).join("\n") if VERBOSE
  healthcheck_ping(:fail, hc_body("failed", "#{e.class}: #{e.message}"))
  exit 1
end

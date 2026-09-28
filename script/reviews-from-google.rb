#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads: cron defaults Ruby to US-ASCII and reviews hold Zürich, Ż and emoji.
# See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# reviews-from-google.rb
#
# Copies the five-star Google reviews of the IN YOUR FACE Comedy Business Profile into
# _data/reviews.yml, which the site reads for the "What people are saying" quote
# (_includes/review-quote.liquid on the home page, the calendar and matching show
# pages) and the /reviews/ page.
#
# Which reviews are kept (Harry, 2026-09-28):
#   * FIVE stars only, and only with text.
#   * Never a review by a performer: the author's first and last name match a comedian
#     profile in _comedians/, or the text says they perform ("perform", "performing").
#     A visitor who reads a glowing review and then sees its author on stage stops
#     trusting the rest.
#   * Never a review id listed in script/reviews-exclude.txt (one id per line, # comments).
#
# What is stored per review (the repo is public): the review id, the author as first
# name plus last initial, the month, the text as paragraphs, a short excerpt for the
# quote card, and show tags (`comedybrew` when the text is about the open mic or
# Thursdays). No surname, no profile photo, no reply. The file also carries the true
# average and count over ALL reviews, and the Google links, for the /reviews/ header.
#
# No Review or AggregateRating structured data is ever built from this file: Google calls
# a business's own reviews "self-serving" and asks sites not to aggregate reviews from
# other websites (docs/scripts.md, reviews-from-google.rb).
#
# The file is rewritten only when its content changes (the stamp alone never counts);
# then the job commits that one file, pushes, and pings IndexNow for /reviews/.
#
# Usage:
#   ruby script/reviews-from-google.rb --dry-run    # read-only: kept and dropped reviews, no write
#   ruby script/reviews-from-google.rb --no-git     # write the file, no commit, no push
#   ruby script/reviews-from-google.rb              # live (what cron runs)
#
# Secrets (gitignored, shared with post-events-to-google.rb): client_secret_*.json,
# gbp-token.json. Reviews live on the legacy v4 host, which the posts job already uses.

require "net/http"
require "uri"
require "time"
require "json"
require "yaml"
require "optparse"
require "open3"

# ---------- Paths & constants ----------

PROJECT_ROOT  = File.expand_path("..", __dir__)
DATA_FILE     = File.join(PROJECT_ROOT, "_data", "reviews.yml")
DATA_REL      = "_data/reviews.yml"
COMEDIANS_DIR = File.join(PROJECT_ROOT, "_comedians")
EXCLUDE_FILE  = File.join(__dir__, "reviews-exclude.txt")
TOKEN_FILE    = ENV["GBP_TOKEN_FILE"] || File.join(PROJECT_ROOT, "gbp-token.json")
STATE_FILE    = File.join(ENV["GBP_DIR"] || File.join(PROJECT_ROOT, "gbp"), "gbp-state.json")

LOCATION_ID   = "18390205646696162099"   # the GBP location (docs/google-business-profile-api-setup.md)
V4_HOST       = "https://mybusiness.googleapis.com/v4"
BI_LOCATION   = "https://mybusinessbusinessinformation.googleapis.com/v1/locations/#{LOCATION_ID}?readMask=metadata"
ACCOUNTS_URL  = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"
SITE_URL      = "https://inyourfacecomedy.ch"

EXCERPT_MAX   = 170   # characters on the quote card; the full text is on /reviews/
PERFORMER_RE  = /\bperform(?:s|ed|ing|er|ers)?\b/i
SHOW_TAGS     = {
  "comedybrew" => /\bopen[\s-]?mics?\b|\bthursdays?\b|\bcomedy brew\b/i
}.freeze
MONTHS        = %w[January February March April May June July August September October November December].freeze

SCRIPT_NAME = File.basename(__FILE__)

options = { dry_run: false, no_git: false, verbose: false }
OptionParser.new do |o|
  o.on("--dry-run")       { options[:dry_run] = true }
  o.on("--no-git")        { options[:no_git]  = true }
  o.on("-v", "--verbose") { options[:verbose] = true }
end.parse!
DRY_RUN = options[:dry_run]
NO_GIT  = options[:no_git]
VERBOSE = options[:verbose]

def log(msg) = puts(msg)

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
  return if DRY_RUN
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

# ---------- OAuth + HTTP (copied from post-events-to-google.rb; GET only) ----------

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
  uri = URI(cfg["token_uri"])
  req = Net::HTTP::Post.new(uri)
  req.set_form_data("client_id" => cfg["client_id"], "client_secret" => cfg["client_secret"],
                    "refresh_token" => saved["refresh_token"], "grant_type" => "refresh_token")
  resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 15, read_timeout: 30) { |h| h.request(req) }
  JSON.parse(resp.body)["access_token"] || raise("Failed to refresh access token: #{resp.body[0, 300]}")
end

# The only verb this script sends to Google is GET.
def api_get(url, token)
  uri = URI(url)
  req = Net::HTTP::Get.new(uri)
  req["Authorization"] = "Bearer #{token}"
  resp = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 15, read_timeout: 30) { |h| h.request(req) }
  body = (JSON.parse(resp.body) rescue resp.body)
  raise "GET #{uri.host}#{uri.path} HTTP #{resp.code}: #{(body.is_a?(Hash) ? body.dig("error", "message") : body).to_s[0, 300]}" unless resp.code == "200"
  body
end

def account_name(token)
  return ENV["GBP_ACCOUNT"] if ENV["GBP_ACCOUNT"]
  cached = (JSON.parse(File.read(STATE_FILE)).dig("_meta", "account") rescue nil)
  return cached if cached
  acct = (api_get(ACCOUNTS_URL, token)["accounts"] || []).first
  acct ? acct["name"] : raise("accounts.list returned no accounts")
end

def fetch_reviews(token)
  base = "#{V4_HOST}/#{account_name(token)}/locations/#{LOCATION_ID}/reviews?pageSize=50"
  reviews = []
  summary = nil
  page = nil
  loop do
    j = api_get(page ? "#{base}&pageToken=#{URI.encode_www_form_component(page)}" : base, token)
    summary ||= { average: j["averageRating"], total: j["totalReviewCount"] }
    reviews.concat(j["reviews"] || [])
    page = j["nextPageToken"]
    break unless page
  end
  [reviews, summary]
end

# ---------- Shaping one review ----------

def fold(s)
  s.to_s.unicode_normalize(:nfd).gsub(/\p{Mn}/, "").downcase
end

def name_tokens(name)
  name.to_s.gsub(/\(.*?\)/, " ").split(/\s+/).reject(&:empty?)
end

# Comedians on the site as [first, last] folded pairs, from each profile's title.
def comedian_names
  Dir[File.join(COMEDIANS_DIR, "*.md")].filter_map do |path|
    m = File.read(path, encoding: "UTF-8").match(/^title:\s*"?(.*?)"?\s*$/)
    t = m && name_tokens(m[1]).map { |x| fold(x) }
    t && t.size >= 2 ? [t.first, t.last] : nil
  end
end

def excluded_ids
  return [] unless File.exist?(EXCLUDE_FILE)
  File.readlines(EXCLUDE_FILE, chomp: true).map { |l| l.sub(/#.*/, "").strip }.reject(&:empty?)
end

# Google appends a machine translation; keep only what the reviewer wrote.
def original_text(comment)
  c = comment.to_s
  c = c.split("(Original)", 2).last.to_s if c.include?("(Original)")
  c = c.split("(Translated by Google)", 2).first.to_s if c.include?("(Translated by Google)")
  c.strip
end

def paragraphs(text)
  text.split(/\n\s*\n|\n/).map { |p| p.gsub(/\s+/, " ").strip }.reject(&:empty?)
end

# Whole sentences up to EXCERPT_MAX; a first sentence longer than that is cut at a word.
def excerpt(paras)
  flat = paras.join(" ")
  return [flat, false] if flat.length <= EXCERPT_MAX + 20
  out = +""
  flat.scan(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+\z/).each do |sentence|
    break if (out + sentence).strip.length > EXCERPT_MAX
    out << sentence
  end
  out = flat[0, EXCERPT_MAX].sub(/\s+\S*\z/, "").sub(/[,;:]\z/, "") if out.strip.empty?
  [out.strip.sub(/[,;:]\z/, "") + (out.strip =~ /[.!?]["”’)]*\z/ ? "" : "…"), true]
end

def display_author(name)
  t = name_tokens(name)
  return "A Google reviewer" if t.empty?
  first = t.first
  first = first.capitalize if first == first.upcase || first == first.downcase
  return first if t.size == 1
  "#{first} #{t.last[0].upcase}."
end

def month_label(iso)
  time = Time.iso8601(iso)
  "#{MONTHS[time.month - 1]} #{time.year}"
end

def shape(review)
  paras = paragraphs(original_text(review["comment"]))
  ex, cut = excerpt(paras)
  flat = paras.join(" ")
  {
    "id"         => review["reviewId"],
    "author"     => display_author(review.dig("reviewer", "displayName")),
    "date"       => review["createTime"][0, 10],
    "month"      => month_label(review["createTime"]),
    "paragraphs" => paras,
    "excerpt"    => ex,
    "truncated"  => cut,
    "shows"      => SHOW_TAGS.select { |_, re| flat.match?(re) }.keys
  }
end

# Returns [kept_shaped, dropped] where dropped is [[review, reason], ...].
def select_reviews(reviews)
  performers = comedian_names
  excluded = excluded_ids
  kept = []
  dropped = []
  reviews.each do |r|
    text = original_text(r["comment"])
    tokens = name_tokens(r.dig("reviewer", "displayName")).map { |x| fold(x) }
    reason =
      if r["starRating"] != "FIVE" then "rated #{r["starRating"].to_s.downcase}"
      elsif text.empty? then "no text"
      elsif excluded.include?(r["reviewId"]) then "in reviews-exclude.txt"
      elsif tokens.size >= 2 && performers.include?([tokens.first, tokens.last]) then "author has a comedian profile"
      elsif text.match?(PERFORMER_RE) then "author says they perform"
      end
    reason ? dropped << [r, reason] : kept << shape(r)
  end
  [kept.sort_by { |k| k["date"] }.reverse, dropped]
end

# ---------- Git + IndexNow (copied from refresh-calendar-page.rb) ----------

def git_run(*args)
  out, status = Open3.capture2e("git", "-C", PROJECT_ROOT, *args)
  [out.strip, status.success?]
end

def commit_and_push!
  out, ok = git_run("add", "--", DATA_REL)
  raise "git add failed: #{out}" unless ok
  _, no_staged = git_run("diff", "--quiet", "--staged", "--", DATA_REL)
  return :no_changes if no_staged
  out, ok = git_run("commit", "-m", "chore: refresh Google reviews", "--", DATA_REL)
  raise "git commit failed: #{out}" unless ok
  out, ok = git_run("push", "origin", "master")
  return :pushed if ok
  if out =~ /non-fast-forward|fetch first|rejected.*Updates were rejected/im
    out, ok = git_run("pull", "--rebase", "origin", "master")
    raise "git pull --rebase failed: #{out}" unless ok
    out, ok = git_run("push", "origin", "master")
    raise "git push (after rebase) failed: #{out}" unless ok
    return :pushed_after_rebase
  end
  raise "git push failed: #{out}"
end

INDEXNOW_KEY      = "4b04fa2d03884c6794d4ece40fb41a29"
INDEXNOW_ENDPOINT = URI("https://api.indexnow.org/indexnow")

def submit_indexnow(urls)
  req = Net::HTTP::Post.new(INDEXNOW_ENDPOINT.request_uri)
  req["Content-Type"] = "application/json; charset=utf-8"
  req.body = JSON.generate("host" => URI(SITE_URL).host, "key" => INDEXNOW_KEY,
                           "keyLocation" => "#{SITE_URL}/#{INDEXNOW_KEY}.txt", "urlList" => urls)
  resp = Net::HTTP.start(INDEXNOW_ENDPOINT.host, 443, use_ssl: true, read_timeout: 30) { |h| h.request(req) }
  log "indexnow: #{urls.size} url(s), HTTP #{resp.code}"
rescue => e
  warn "indexnow ping failed (#{e.message}), ignored"
end

# ---------- Main ----------

def without_stamp(data)
  data.reject { |k, _| k == "updated_at" }
end

begin
  healthcheck_ping(:start)
  log "#{SCRIPT_NAME} #{DRY_RUN ? '(dry-run) ' : ''}#{Time.now.strftime('%Y-%m-%d %H:%M %Z')}"

  token = access_token
  reviews, summary = fetch_reviews(token)
  meta = api_get(BI_LOCATION, token)["metadata"] || {}
  place_id = meta["placeId"] or raise "location metadata has no placeId"
  raise "Google returned no reviews: refusing to empty #{DATA_REL}" if reviews.empty?

  kept, dropped = select_reviews(reviews)
  raise "No five-star review survived the filters: refusing to empty #{DATA_REL}" if kept.empty?

  log "Google: #{reviews.size} reviews, average #{summary[:average].to_f.round(1)}, total #{summary[:total]}"
  log "Kept #{kept.size}:"
  kept.each { |k| log "  #{k["id"][0, 12]}  #{k["month"].ljust(14)} #{k["author"].ljust(14)} #{k["shows"].join(",").ljust(10)} #{k["excerpt"][0, 60]}" }
  log "Dropped #{dropped.size}:"
  dropped.each { |r, why| log "  #{r["reviewId"][0, 12]}  #{why}" }

  data = {
    "average"    => summary[:average].to_f.round(1),
    "total"      => summary[:total].to_i,
    "google_url" => "https://search.google.com/local/reviews?placeid=#{place_id}",
    "write_url"  => meta["newReviewUri"] || "https://search.google.com/local/writereview?placeid=#{place_id}",
    "maps_url"   => meta["mapsUri"],
    "updated_at" => Time.now.utc.iso8601,
    "reviews"    => kept
  }

  old = (YAML.safe_load(File.read(DATA_FILE), permitted_classes: [Date, Time]) rescue nil)
  if old && without_stamp(old) == without_stamp(data)
    log "#{DATA_REL}: unchanged, nothing to write."
    healthcheck_ping(:success, hc_body("unchanged", "#{kept.size} reviews kept"))
    exit 0
  end

  if DRY_RUN
    log "Dry run: would write #{DATA_REL} (#{kept.size} reviews)#{NO_GIT ? '' : ', commit and push'}."
    exit 0
  end

  header = "# AUTO-GENERATED by script/reviews-from-google.rb from the Google Business Profile. DO NOT EDIT BY HAND.\n" \
           "# Five-star reviews with text only, performers left out. Hide one: add its id to script/reviews-exclude.txt.\n" \
           "# Read by _includes/review-quote.liquid and pages/reviews.md. Never build review structured data from it.\n"
  File.write(DATA_FILE, header + data.to_yaml(line_width: -1).sub(/\A---\n/, ""))
  log "Wrote #{DATA_REL} (#{kept.size} reviews)."

  result = NO_GIT ? :no_git : commit_and_push!
  log "git: #{result}"
  submit_indexnow(["#{SITE_URL}/reviews/"]) if %i[pushed pushed_after_rebase].include?(result)
  healthcheck_ping(:success, hc_body("written", "#{kept.size} reviews kept, git #{result}"))
rescue SystemExit
  raise
rescue => e
  warn "ERROR: #{e.class}: #{e.message}"
  warn e.backtrace.first(5).join("\n") if VERBOSE
  healthcheck_ping(:fail, hc_body("failed", "#{e.class}: #{e.message}"))
  exit 1
end

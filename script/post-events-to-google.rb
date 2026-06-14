#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — cron defaults Ruby to US-ASCII, and posts hold non-ASCII
# bytes (Zürich, Łukasz, —). See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# post-events-to-google.rb
#
# Keeps the IN YOUR FACE Comedy Google Business Profile listing current by posting
# one EVENT "Local Post" per upcoming ROBIN's show, with its next date, poster image
# and a BOOK button to the show page. See gbp/google-business-profile-api-setup.md
# for the full API/OAuth background.
#
# Strategy (see ISA / setup guide):
#   * Only shows whose NEXT event is at ROBIN's (front-matter venue_slug == "robins").
#   * One post per show, always reflecting the NEXT date (from next_event_date, which
#     refresh-next-event-dates.rb sets from Eventfrog). Comedy Brew included — a fresh
#     post each week beats a static "recurring" entry for Google freshness/attention.
#   * Date rolled  -> PATCH the existing post (no duplicate). Gone/expired -> recreate.
#   * Nothing changed -> no API write (idempotent; avoids spam-looking re-posting).
#   * Brand-new ROBIN's show with no saved description -> draft one with the `claude`
#     CLI in tourist voice, save it for review, post it, and flag it on Healthchecks.
#
# The post summary text for each show lives in gbp/<slug>.txt (slug = the post's
# permalink). Edit those by hand any time; the next run PATCHes the live post to match.
# An optional first line "TITLE: ..." overrides the auto-derived short event title.
#
# Usage:
#   ruby script/post-events-to-google.rb --authorize   # one-time: browser OAuth consent
#   ruby script/post-events-to-google.rb --dry-run      # show intended actions, no writes
#   ruby script/post-events-to-google.rb --dry-run -v   # + per-show detail
#   ruby script/post-events-to-google.rb                # live (what cron runs)
#
# Secrets (gitignored): client_secret_*.json (OAuth client), gbp-token.json (refresh token).

require "net/http"
require "uri"
require "time"
require "date"
require "json"
require "open3"
require "optparse"
require "rbconfig"
require "digest"
require "timeout"
require "socket"
require "cgi"

# ---------- Paths & constants ----------

PROJECT_ROOT = File.expand_path("..", __dir__)
POSTS_DIR    = File.join(PROJECT_ROOT, "_posts")
# Descriptions + state live in gbp/ inside the repo (excluded from the Jekyll build via
# _config.yml `exclude`, so they ship with the project but never appear on the website).
GBP_DIR      = ENV["GBP_DIR"] || File.join(PROJECT_ROOT, "gbp")
STATE_FILE   = File.join(GBP_DIR, "gbp-state.json")
TOKEN_FILE   = ENV["GBP_TOKEN_FILE"] || File.join(PROJECT_ROOT, "gbp-token.json")

SITE_URL      = "https://inyourfacecomedy.ch"
ROBINS_SLUG   = "robins"
LOCATION_ID   = "18390205646696162099"   # the GBP location (from the setup guide)
OAUTH_SCOPE   = "https://www.googleapis.com/auth/business.manage"
V4_HOST       = "https://mybusiness.googleapis.com/v4"
ACCOUNTS_URL  = "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"

SUMMARY_MAX   = 1500   # GBP Local Post summary hard limit
TITLE_MAX     = 58     # GBP event title hard limit
GEN_SUMMARY_BUDGET = 1450   # leave headroom when asking Claude to write a new one
GEN_TITLE_BUDGET   = 55

# Default Claude CLI location (cron PATH won't have ~/.local/bin). Override with CLAUDE_BIN.
CLAUDE_BIN = ENV["CLAUDE_BIN"] || File.join(Dir.home, ".local", "bin", "claude")

SCRIPT_NAME = File.basename(__FILE__)

options = { dry_run: false, verbose: false, authorize: false }
OptionParser.new do |o|
  o.on("--authorize") { options[:authorize] = true }
  o.on("--dry-run")   { options[:dry_run]   = true }
  o.on("-v", "--verbose") { options[:verbose] = true }
end.parse!
VERBOSE = options[:verbose]

def log(msg) = puts(msg)
def vlog(msg) = (puts(msg) if VERBOSE)

# ---------- .env loader (stdlib only) ----------

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

# ---------- Healthchecks ----------

def hc_body(label, detail)
  "[#{SCRIPT_NAME}] #{label}\n\n#{detail.to_s.strip}\n\n— end of [#{SCRIPT_NAME}] report —"
end

def healthcheck_ping(status, body = nil)
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

# ---------- Front-matter parsing (line-level, mirrors refresh-next-event-dates.rb) ----------

def split_post(content)
  m = content.match(/\A---\n(.*?)\n---\n(.*)\z/m)
  m && { raw_fm: m[1], body: m[2] }
end

def yaml_get(raw_fm, key)
  m = raw_fm.match(/^#{Regexp.escape(key)}:\s*(.*?)\s*$/)
  return nil unless m
  v = m[1]
  v = v[1..-2] if (v.start_with?('"') && v.end_with?('"')) || (v.start_with?("'") && v.end_with?("'"))
  v.empty? ? nil : v
end

# ---------- Secrets / OAuth client ----------

def client_config
  path = Dir[File.join(PROJECT_ROOT, "client_secret_*.json")].first
  raise "No client_secret_*.json found in #{PROJECT_ROOT} (download the OAuth Desktop client JSON)" unless path
  j = JSON.parse(File.read(path))
  j["installed"] || j["web"] || raise("Unexpected client secret shape in #{File.basename(path)}")
end

# One-time browser consent. Spins a localhost loopback server, opens the consent URL,
# captures the ?code, exchanges it for a long-lived refresh token, writes gbp-token.json.
def authorize!
  cfg = client_config
  server = TCPServer.new("127.0.0.1", 0)
  port = server.addr[1]
  redirect_uri = "http://127.0.0.1:#{port}"

  params = {
    "client_id"     => cfg["client_id"],
    "redirect_uri"  => redirect_uri,
    "response_type" => "code",
    "scope"         => OAUTH_SCOPE,
    "access_type"   => "offline",
    "prompt"        => "consent"
  }
  auth_url = "#{cfg["auth_uri"]}?#{URI.encode_www_form(params)}"

  log "\nOpen this URL in a browser signed in as the listing owner (hfuecks@gmail.com):"
  log "  (Click Advanced -> \"Go to ... (unsafe)\" past the unverified-app warning — it's your own app.)\n\n#{auth_url}\n"
  system("open", auth_url) rescue nil   # macOS convenience; ignored if it fails

  # Wait for Google to redirect back to the loopback with ?code=...
  code = nil
  Timeout.timeout(300) do
    client = server.accept
    request_line = client.gets.to_s
    if (m = request_line.match(/GET \/\?([^ ]*) /))
      q = CGI.parse(m[1])
      code = q["code"]&.first
      err  = q["error"]&.first
      body = code ? "Authorized. You can close this tab and return to the terminal." \
                  : "Authorization failed: #{err}. Check the terminal."
      client.print "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<h2>#{body}</h2>"
    end
    client.close
  end
  server.close
  raise "No authorization code received" unless code

  token = http_form(cfg["token_uri"], {
    "code"          => code,
    "client_id"     => cfg["client_id"],
    "client_secret" => cfg["client_secret"],
    "redirect_uri"  => redirect_uri,
    "grant_type"    => "authorization_code"
  })
  refresh = token["refresh_token"]
  raise "Token response had no refresh_token: #{token.inspect}" unless refresh

  File.write(TOKEN_FILE, JSON.pretty_generate(
    "refresh_token" => refresh,
    "scope"         => OAUTH_SCOPE,
    "obtained_at"   => Time.now.utc.iso8601
  ))
  File.chmod(0o600, TOKEN_FILE)
  log "\nSaved refresh token to #{TOKEN_FILE} (gitignored). You're set — cron will just work."
end

# Mint a short-lived access token from the saved refresh token.
def access_token
  raise "No #{TOKEN_FILE} — run: ruby script/#{SCRIPT_NAME} --authorize" unless File.exist?(TOKEN_FILE)
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
  uri = URI(url)
  klass = { get: Net::HTTP::Get, post: Net::HTTP::Post, patch: Net::HTTP::Patch }[method]
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

# ---------- State (gbp-state.json) ----------

def load_state
  File.exist?(STATE_FILE) ? JSON.parse(File.read(STATE_FILE)) : { "_meta" => {}, "shows" => {} }
rescue
  { "_meta" => {}, "shows" => {} }
end

def save_state(state)
  File.write(STATE_FILE, JSON.pretty_generate(state))
end

# Account resource name ("accounts/123"), cached in state. ENV GBP_ACCOUNT overrides.
def account_name(token, state)
  return ENV["GBP_ACCOUNT"] if ENV["GBP_ACCOUNT"]
  return state["_meta"]["account"] if state.dig("_meta", "account")
  code, resp = api_request(:get, ACCOUNTS_URL, token)
  raise "accounts.list HTTP #{code}: #{(resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 300]}" unless code == 200
  acct = (resp["accounts"] || []).first
  raise "accounts.list returned no accounts: #{resp.inspect}" unless acct
  state["_meta"]["account"] = acct["name"]
  acct["name"]
end

# ---------- Show selection + post building ----------

Show = Struct.new(:slug, :title, :image, :start, :finish, keyword_init: true)

# All ROBIN's shows with a future next_event_date, read from post front-matter.
def upcoming_robins_shows(now)
  shows = []
  Dir[File.join(POSTS_DIR, "*.md")].sort.each do |path|
    parsed = split_post(File.read(path, encoding: "UTF-8")) or next
    fm = parsed[:raw_fm]
    next unless yaml_get(fm, "venue_slug") == ROBINS_SLUG
    start_s = yaml_get(fm, "next_event_date") or next
    start = (Time.iso8601(start_s) rescue next)
    next if start < now   # past — nothing upcoming
    end_s = yaml_get(fm, "next_event_end_date")
    finish = (Time.iso8601(end_s) rescue start + 2 * 3600)
    slug = yaml_get(fm, "permalink").to_s.gsub(%r{^/|/$}, "")
    shows << Show.new(slug: slug, title: yaml_get(fm, "title").to_s,
                      image: yaml_get(fm, "image").to_s, start: start, finish: finish)
  end
  shows
end

# Short event title (<= TITLE_MAX): explicit TITLE: line, else the post title up to the
# first separator (• - —), else a hard truncation.
def event_title(show, txt_title)
  t = txt_title
  t ||= show.title.split(/\s[•\-—]\s/).first.to_s.strip
  t = show.title.strip if t.empty?
  t = t[0, TITLE_MAX].strip if t.length > TITLE_MAX
  t
end

# Absolute poster image URL from the front-matter `image` path.
def image_url(show)
  img = show.image.strip
  return nil if img.empty?
  img = "/#{img}" unless img.start_with?("/")
  "#{SITE_URL}#{img}"
end

def desc_path(slug) = File.join(GBP_DIR, "#{slug}.txt")

# Returns [title_override_or_nil, summary] from gbp/<slug>.txt, or nil if absent.
def load_description(slug)
  path = desc_path(slug)
  return nil unless File.exist?(path)
  raw = File.read(path, encoding: "UTF-8")
  title = nil
  if raw =~ /\ATITLE:\s*(.+)\s*\n/
    title = $1.strip
    raw = raw.sub(/\ATITLE:.*\n\s*\n?/, "")
  end
  [title, raw.strip]
end

# Build the localPost JSON for a show.
def build_post(show, summary, title)
  s, e = show.start, show.finish
  post = {
    "languageCode" => "en",
    "summary"      => summary,
    "topicType"    => "EVENT",
    "event" => {
      "title" => title,
      "schedule" => {
        "startDate" => { "year" => s.year, "month" => s.month, "day" => s.day },
        "startTime" => { "hours" => s.hour, "minutes" => s.min },
        "endDate"   => { "year" => e.year, "month" => e.month, "day" => e.day },
        "endTime"   => { "hours" => e.hour, "minutes" => e.min }
      }
    },
    "callToAction" => { "actionType" => "BOOK", "url" => "#{SITE_URL}/#{show.slug}/" }
  }
  if (img = image_url(show))
    post["media"] = [{ "mediaFormat" => "PHOTO", "sourceUrl" => img }]
  end
  post
end

# Change signature — if unchanged from last run, we skip the API entirely.
def signature(post)
  Digest::SHA256.hexdigest(JSON.generate(post))
end

# ---------- New-event description generation via the Claude CLI ----------

# Plain-text-ish version of the post body (drop front-matter, liquid, html, md syntax).
def plain_body(slug)
  path = Dir[File.join(POSTS_DIR, "*.md")].find { |p| split_post(File.read(p, encoding: "UTF-8"))&.dig(:raw_fm)&.then { |fm| yaml_get(fm, "permalink").to_s.gsub(%r{^/|/$}, "") == slug } }
  return "" unless path
  parsed = split_post(File.read(path, encoding: "UTF-8"))
  body = parsed[:body].dup
  body.gsub!(/<!--more-->/, "")
  body.gsub!(/<\/?[^>]+>/, "")          # html tags
  body.gsub!(/\{%.*?%\}|\{\{.*?\}\}/m, "")  # liquid
  body.gsub!(/[*_`#>]/, "")             # md emphasis/headers
  body.gsub!(/\[([^\]]+)\]\([^)]+\)/, '\1')  # md links -> text
  body.squeeze(" ").gsub(/\n{3,}/, "\n\n").strip
end

# Ask `claude` (headless) to draft a GBP description in house tourist voice. Returns
# [title, summary]. Saves the result to gbp/<slug>.txt with a TITLE: line.
def generate_description(show)
  raise "claude CLI not found at #{CLAUDE_BIN} (set CLAUDE_BIN)" unless File.exist?(CLAUDE_BIN)
  body = plain_body(show.slug)
  example = (load_description("comedybrew") || [nil, ""])[1]

  prompt = <<~PROMPT
    You are writing the Google Business Profile event description for an IN YOUR FACE Comedy
    show in Zürich. The audience is mostly tourists and people new to the city.

    HOUSE STYLE (match it closely):
    - Open with a tourist hook, e.g. "New in town or just visiting?".
    - Make clear it is live English-language stand-up, no Swiss German needed.
    - Warm, plain, specific. No hype, no em dashes (use a comma or full stop).
    - Mention the practical details that appear in the source: doors/show times, the venue
      (ROBIN's, Zähringerstrasse 33, 8001 Zürich, in Niederdorf), price (or free + donations),
      and "best bought in advance online".
    - End with: "Part of IN YOUR FACE Comedy, running English-language live shows in Zürich since 2018."

    HARD LIMITS:
    - The description body MUST be plain text, no markdown, at most #{GEN_SUMMARY_BUDGET} characters.
    - Provide a short event title, at most #{GEN_TITLE_BUDGET} characters.

    OUTPUT EXACTLY this format and nothing else:
    TITLE: <short title>
    <blank line>
    <description body>

    --- EXAMPLE (Comedy Brew, for tone only — do not copy facts) ---
    #{example}

    --- THIS SHOW: #{show.title} ---
    #{body}
  PROMPT

  out = nil
  Timeout.timeout(180) do
    stdout, status = Open3.capture2e(CLAUDE_BIN, "-p", prompt)
    raise "claude exited #{status.exitstatus}: #{stdout.lines.last(5).join}" unless status.success?
    out = stdout
  end

  title = nil
  text = out.strip
  if text =~ /\ATITLE:\s*(.+)\s*\n/
    title = $1.strip
    text = text.sub(/\ATITLE:.*\n\s*\n?/, "").strip
  end
  raise "claude output had no usable body" if text.empty?

  File.write(desc_path(show.slug),
             "TITLE: #{title || event_title(show, nil)}\n\n#{text}\n")
  [title, text]
end

# ---------- Process one show ----------

def process_show(show, token, account, state, options)
  desc = load_description(show.slug)
  newly_generated = false
  if desc.nil?
    if options[:dry_run]
      return [:skip, "NEW show, no gbp/#{show.slug}.txt — live run would draft via claude"]
    end
    log "  [#{show.slug}] new ROBIN's show — drafting description with claude…"
    desc = generate_description(show)
    newly_generated = true
  end
  txt_title, summary = desc
  title = event_title(show, txt_title)

  # Hard length gates — never post over-limit (ISC-13).
  return [:error, "summary #{summary.length} > #{SUMMARY_MAX} chars — fix gbp/#{show.slug}.txt"] if summary.length > SUMMARY_MAX
  return [:error, "title #{title.length} > #{TITLE_MAX} chars — shorten TITLE in gbp/#{show.slug}.txt"] if title.length > TITLE_MAX

  post = build_post(show, summary, title)
  sig  = signature(post)
  rec  = state["shows"][show.slug] || {}
  detail = "next #{show.start.strftime("%Y-%m-%d %H:%M")} | title #{title.length}c | summary #{summary.length}c"

  if rec["post_name"] && rec["signature"] == sig && !newly_generated
    return [:skip, "unchanged (#{detail})"]
  end

  if options[:dry_run]
    action = rec["post_name"] ? "PATCH" : "CREATE"
    return [:would, "#{action} — #{detail}"]
  end

  if rec["post_name"]
    url = "#{V4_HOST}/#{rec["post_name"]}?updateMask=summary,event,callToAction,media"
    code, resp = api_request(:patch, url, token, post)
    if code == 200
      state["shows"][show.slug] = rec.merge("signature" => sig, "title" => title)
      return [newly_generated ? :new : :patched, "PATCH ok — #{detail}"]
    elsif code == 404 || (resp.is_a?(Hash) && resp.dig("error", "status") == "NOT_FOUND")
      vlog "    existing post gone (#{code}); recreating"
    else
      return [:error, "PATCH HTTP #{code}: #{(resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 200]}"]
    end
  end

  # CREATE (first time, or recreate after expiry).
  url = "#{V4_HOST}/#{account}/locations/#{LOCATION_ID}/localPosts"
  code, resp = api_request(:post, url, token, post)
  if (200..201).include?(code) && resp.is_a?(Hash) && resp["name"]
    state["shows"][show.slug] = { "post_name" => resp["name"], "signature" => sig, "title" => title }
    [newly_generated ? :new : :created, "CREATE ok — #{detail}"]
  else
    [:error, "CREATE HTTP #{code}: #{(resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 200]}"]
  end
end

# ---------- Main ----------

if options[:authorize]
  authorize!
  exit 0
end

begin
  healthcheck_ping(:start)
  now = Time.now
  shows = upcoming_robins_shows(now)
  log "Found #{shows.size} upcoming ROBIN's show(s): #{shows.map(&:slug).join(", ")}"

  state = load_state
  token = nil
  account = nil
  unless options[:dry_run]
    token = access_token
    account = account_name(token, state)
    vlog "account: #{account}"
  end

  created = patched = skipped = newposts = errors = 0
  error_lines = []
  review_lines = []

  shows.each do |show|
    status, msg = process_show(show, token, account, state, options)
    tag = { created: "CREATE", patched: "PATCH ", new: "NEW   ", would: "would ",
            skip: "skip  ", error: "ERROR " }[status] || status.to_s
    log "  [#{tag}] #{show.slug} — #{msg}"
    case status
    when :created then created += 1
    when :patched then patched += 1
    when :new
      newposts += 1
      review_lines << "#{show.slug}: AI-drafted description posted — review gbp/#{show.slug}.txt"
    when :error
      errors += 1
      error_lines << "#{show.slug} — #{msg}"
    else skipped += 1
    end
  end

  save_state(state) unless options[:dry_run]

  summary = "created #{created}, patched #{patched}, new #{newposts}, skipped #{skipped}, errors #{errors}"
  log "\n#{summary}"
  log "(dry-run: no API writes, no state saved)" if options[:dry_run]

  if errors > 0
    healthcheck_ping(:fail, hc_body("FAILED", ([summary] + error_lines).join("\n")))
    exit 1
  else
    body = [summary]
    body.concat(review_lines) unless review_lines.empty?
    healthcheck_ping(:success, hc_body("OK", body.join("\n")))
    exit 0
  end
rescue => e
  begin
    healthcheck_ping(:fail, hc_body("CRASHED", "#{e.class}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"))
  rescue
  end
  raise
end

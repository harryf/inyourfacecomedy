#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — cron defaults Ruby to US-ASCII, and posts hold non-ASCII
# bytes (Zürich, Łukasz, —). See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# post-events-to-google.rb
#
# Keeps the IN YOUR FACE Comedy Google Business Profile listing in sync: one EVENT
# "Local Post" per ROBIN's show happening in the NEXT 7 DAYS, with its date, poster
# image and a BOOK button to the show page. See gbp/google-business-profile-api-setup.md
# for the full API/OAuth background.
#
# Strategy (see ISA / setup guide):
#   * Only shows whose NEXT event is at ROBIN's (front-matter venue_slug == "robins")
#     AND happening within WINDOW_DAYS (7). Google Maps surfaces what's happening now,
#     not next month — the listing is a rolling one-week view of the calendar.
#   * Google Maps displays event posts newest-POSTED first (confirmed by observation
#     2026-07-05), so the listing is managed as a STACK: post the furthest-future show
#     first and the next show LAST, and the next show lands on top.
#   * Every run LISTS the live localPosts. If the stack already shows exactly the
#     in-window shows, soonest on top, with current content -> no-op (no churn, no
#     needless re-moderation). Anything off (date rolled, txt edited, new show, stray
#     or duplicate post) -> full rebuild: the new stack is created FIRST
#     (create-before-delete; rolled back on failure so the listing is never left
#     degraded), then every pre-rebuild post is retired.
#     Safety boundary: only posts with topicType EVENT, a CTA URL on our own domain,
#     AND a slug we manage are ever deleted. Hand-made non-EVENT posts (offers,
#     announcements) and EVENT posts on slugs we don't manage survive; a hand-made
#     EVENT post on a managed show slug is treated as ours (superseded on rebuild).
#   * REJECTED by Google's moderation (the API gives no reason, only the state) ->
#     quarantined: alerted once via Healthchecks, never PATCHed or re-submitted
#     unchanged (repeat violations risk profile restrictions). Editing gbp/<slug>.txt
#     changes the signature; the next run deletes the rejected post and re-CREATEs,
#     which triggers a fresh review.
#   * Brand-new ROBIN's show with no saved description -> draft one with the `claude`
#     CLI in tourist voice, save it for review, post it, and flag it on Healthchecks.
#
# The post summary text for each show lives in gbp/<slug>.txt (slug = the post's
# permalink). Edit those by hand any time; the next run PATCHes the live post to match.
# An optional first line "TITLE: ..." overrides the auto-derived short event title.
#
# Usage:
#   ruby script/post-events-to-google.rb --authorize   # one-time: browser OAuth consent
#   ruby script/post-events-to-google.rb --dry-run      # read-only: lists live posts, shows
#                                                       #   intended actions, zero writes
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
SITE_HOST     = "inyourfacecomedy.ch"
ROBINS_SLUG   = "robins"
# Rolling sync window: only events within the next N days stay on the listing.
WINDOW_DAYS   = (ENV["GBP_WINDOW_DAYS"] || "7").to_i
# Assumed show length when next_event_end_date is absent (drives the window filter's
# "still in progress" grace).
DEFAULT_DURATION = 2 * 3600
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
DRY_RUN = options[:dry_run]

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
  return if DRY_RUN   # dry-run must not touch the alert channel (no spurious fail/reset)
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
  # Belt-and-suspenders: in dry-run mode only reads may reach the network, whatever
  # a future call site forgets. Reads are allowed so dry-run can show real actions.
  raise "BLOCKED: #{method.to_s.upcase} attempted in --dry-run" if DRY_RUN && method != :get
  uri = URI(url)
  klass = { get: Net::HTTP::Get, post: Net::HTTP::Post,
            patch: Net::HTTP::Patch, delete: Net::HTTP::Delete }[method]
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

# All ROBIN's shows read from post front-matter, dated or not. Returns
# [shows, slugs]: Show structs for every robins post with a parseable
# next_event_date, plus the slug set of ALL robins posts (the "managed" universe —
# deletion safety is scoped to these).
def robins_shows
  shows = []
  slugs = []
  Dir[File.join(POSTS_DIR, "*.md")].sort.each do |path|
    parsed = split_post(File.read(path, encoding: "UTF-8")) or next
    fm = parsed[:raw_fm]
    next unless yaml_get(fm, "venue_slug") == ROBINS_SLUG
    slug = yaml_get(fm, "permalink").to_s.gsub(%r{^/|/$}, "")
    next if slug.empty?   # un-slugged post can't round-trip through the CTA URL — skip entirely
    slugs << slug
    start_s = yaml_get(fm, "next_event_date") or next
    start = (Time.iso8601(start_s) rescue next)
    end_s = yaml_get(fm, "next_event_end_date")
    finish = (Time.iso8601(end_s) rescue start + DEFAULT_DURATION)
    shows << Show.new(slug: slug, title: yaml_get(fm, "title").to_s,
                      image: yaml_get(fm, "image").to_s, start: start, finish: finish)
  end
  [shows, slugs]
end

# The rolling window: a show belongs on the listing while its event hasn't ended
# AND it starts within WINDOW_DAYS. "Hasn't ended" (not "hasn't started") so a cron
# run during a show never drops it mid-event.
def in_window?(show, now)
  show.finish >= now && show.start <= now + WINDOW_DAYS * 86_400
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

# ---------- Live listing, reconciliation & deletion ----------

# Every live local post on the location, paginated. Raises on any bad page: a partial
# list would make live posts look absent and drive wrong create/delete decisions.
def list_local_posts(token, account)
  posts = []
  page_token = nil
  loop do
    url = "#{V4_HOST}/#{account}/locations/#{LOCATION_ID}/localPosts?pageSize=100"
    url += "&pageToken=#{CGI.escape(page_token)}" if page_token
    code, resp = api_request(:get, url, token)
    unless code == 200 && resp.is_a?(Hash)
      raise "localPosts.list HTTP #{code}: #{(resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 300]}"
    end
    posts.concat(resp["localPosts"] || [])
    page_token = resp["nextPageToken"]
    break if page_token.nil? || page_token.empty?
  end
  posts
end

# Slug of OUR event post, or nil if the post is not ours to touch. Ours means:
# topicType EVENT and a callToAction URL whose parsed host is our domain (exact or
# subdomain — no substring matching, which would pass evil hosts like
# "inyourfacecomedy.ch.evil.com").
def our_post_slug(post)
  return nil unless post["topicType"] == "EVENT"
  uri = (URI.parse(post.dig("callToAction", "url").to_s) rescue nil)
  host = uri&.host&.downcase
  return nil unless host == SITE_HOST || host&.end_with?(".#{SITE_HOST}")
  slug = uri.path.to_s.gsub(%r{^/|/$}, "")
  slug.empty? ? nil : slug
end

# DELETE a live post. :ok on 2xx or 404 (already gone — the desired state holds
# either way). Anything else (403/429/5xx) is an error and the caller must NOT clear
# state, or the post would be orphaned live.
def delete_post(token, post_name)
  code, resp = api_request(:delete, "#{V4_HOST}/#{post_name}", token)
  return :ok if (200..299).include?(code) || code == 404
  [:error, "DELETE HTTP #{code}: #{(resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 200]}"]
end

# The signature the show's canonical post WOULD have right now, or nil when the
# description is missing or over-limit. Pure recomputation, no network — used by the
# in-sync check and the quarantine hold.
def canonical_signature(show)
  desc = load_description(show.slug) or return nil
  txt_title, summary = desc
  title = event_title(show, txt_title)
  return nil if summary.length > SUMMARY_MAX || title.length > TITLE_MAX
  signature(build_post(show, summary, title))
end

# Rejection quarantine: Google moderates posts (state REJECTED = "content policy
# violation"; the v4 API exposes NO reason) and repeat re-submission of rejected
# content risks profile-level restrictions. A desired show is HELD while its
# canonical content still matches the signature Google rejected ("" = unknown
# baseline from a pre-existing post: capture the current canonical signature and hold
# this cycle). Editing gbp/<slug>.txt moves the signature off the baseline; the next
# rebuild re-submits it as a fresh post.
def quarantine_hold?(show, rec)
  rejected_sig = rec && rec["rejected_signature"] or return false
  sig = canonical_signature(show)
  if rejected_sig == ""
    rec["rejected_signature"] = sig || ""
    return true
  end
  rejected_sig == sig
end

# Flag desired posts newly REJECTED by moderation. Fires (and logs) once per
# rejection, on the transition — the caller alerts on these.
def detect_rejections!(live_ours, desired_slugs, shows_state)
  newly = []
  live_ours.each do |p|
    slug = our_post_slug(p)
    next unless p["state"] == "REJECTED" && desired_slugs.include?(slug)
    rec = (shows_state[slug] ||= {})
    next if rec["rejected_signature"]
    rec["rejected_signature"] = rec["signature"] || ""
    newly << slug
    log "  [REJECT] #{slug} — post REJECTED by Google (content policy; API gives no reason)"
  end
  newly
end

# True when the listing already shows exactly the postable shows, soonest on top,
# each with the content we last posted — then the whole run is a no-op. Google
# displays newest-posted first, so the live stack in createTime DESC order must
# pairwise match the shows in start ASC order. live_active must already exclude
# REJECTED posts (they are invisible on the listing).
def in_sync?(live_active, postable, shows_state)
  return false unless live_active.size == postable.size
  stack = live_active.sort_by { |p| [p["createTime"].to_s, p["name"].to_s] }.reverse
  stack.zip(postable).all? do |post, show|
    rec = shows_state[show.slug] || {}
    our_post_slug(post) == show.slug &&
      rec["post_name"] == post["name"] &&
      rec["signature"] && rec["signature"] == canonical_signature(show)
  end
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
      (ROBIN's, in the Niederdorf old town, near the Central tram stop), price (or free +
      donations), and "best bought in advance online".
    - End with: "Part of IN YOUR FACE Comedy, running English-language live shows in Zürich since 2018."

    DATES AND TIMES — the description is reused across many event dates, and readers may
    see it on ANY day, so every date reference must make sense regardless of when it is read:
    - NEVER use relative day words: "tonight", "this Saturday", "this week", "tomorrow".
    - Never name a specific calendar date. The event's date is shown by Google next to the
      post; the text must not compete with it.
    - Name a weekday ONLY for a genuinely recurring pattern stated in the source ("every
      Thursday", "every Tuesday in July"). A one-off show gets "an evening" or "one night only".
    - Clock times (doors, show start and end) are fine — they are stable for every date.

    GOOGLE MODERATION SAFETY — violations get the post auto-rejected, so these are HARD rules:
    - NEVER put a street address or phone number in the body. Name the neighbourhood and
      nearby transport instead ("in the Niederdorf, two minutes from the Central tram stop").
    - Refer to people by FIRST NAME only (surnames can trip automated profanity filters).
    - Never name trademarked events or bodies (World Cup, FIFA, UEFA, Olympics, Euro);
      write "the football", "the big match", "the games" instead.
    - Alcohol stays incidental ("grab a drink" is fine); never make drinking the pitch.
    - No prices framed as resale, no urgency/scarcity pressure ("selling fast", "last chance").

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

# ---------- Create one show's post ----------

def create_show(show, token, account, state, options)
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
  detail = "next #{show.start.strftime("%Y-%m-%d %H:%M")} | title #{title.length}c | summary #{summary.length}c"
  return [:would, "CREATE — #{detail}"] if options[:dry_run]

  url = "#{V4_HOST}/#{account}/locations/#{LOCATION_ID}/localPosts"
  code, resp = api_request(:post, url, token, post)
  unless (200..201).include?(code) && resp.is_a?(Hash) && resp["name"]
    return [:error, "CREATE HTTP #{code}: #{(resp.is_a?(Hash) ? resp.dig("error", "message") : resp).to_s[0, 200]}"]
  end
  state["shows"][show.slug] = { "post_name" => resp["name"], "signature" => sig, "title" => title }
  if resp["state"] == "REJECTED"   # moderation can reject synchronously
    state["shows"][show.slug]["rejected_signature"] = sig
    return [:rejected, "created but immediately REJECTED — edit gbp/#{show.slug}.txt (#{detail})"]
  end
  [newly_generated ? :new : :created, "CREATE ok — #{detail}"]
end

# ---------- Main ----------

# Guarded so the pure helpers above can be load()ed by test snippets without running a sync.
if __FILE__ == $PROGRAM_NAME
  if options[:authorize]
    authorize!
    exit 0
  end

  begin
    healthcheck_ping(:start)
    now = Time.now
    all_shows, robins_slugs = robins_shows
    desired, outside = all_shows.partition { |s| in_window?(s, now) }
    log "ROBIN's shows in the next #{WINDOW_DAYS} days: #{desired.size} (#{desired.map(&:slug).join(", ")})"
    outside.each { |s| log "  [window] #{s.slug} — next #{s.start.strftime("%Y-%m-%d")} is outside the window" }

    state = load_state
    token = account = nil
    offline_dry_run = DRY_RUN && !File.exist?(TOKEN_FILE)
    if offline_dry_run
      log "(dry-run without #{File.basename(TOKEN_FILE)} — offline: live listing NOT reconciled)"
    else
      token = access_token
      account = account_name(token, state)
      vlog "account: #{account}"
    end

    created = newposts = deleted = held = skipped = errors = 0
    error_lines = []
    newly_rejected = []
    review_lines = []
    attention_lines = []
    # The display order we want: soonest on top. Slug tiebreaker keeps equal start
    # times deterministic across runs (Ruby sort_by is not guaranteed stable).
    desired = desired.sort_by { |s| [s.start, s.slug] }

    if offline_dry_run
      desired.reverse_each { |s| log "  [would ] CREATE #{s.slug} (offline view — live listing unknown)" }
    else
      live = list_local_posts(token, account)
      managed = (robins_slugs + state["shows"].keys).uniq
      live_ours, live_other = live.partition { |p| (slug = our_post_slug(p)) && managed.include?(slug) }
      live_other.each { |p| vlog "    [leave ] #{our_post_slug(p) || "(not ours)"} — not managed, never touched" }
      vlog "live managed posts: #{live_ours.size} of #{live.size}"

      newly_rejected = detect_rejections!(live_ours, desired.map(&:slug), state["shows"])

      # Quarantined shows are excluded from posting until their txt changes.
      postable = desired.reject do |s|
        next false unless quarantine_hold?(s, state["shows"][s.slug])
        held += 1
        msg = "held in quarantine (REJECTED content unchanged) — edit gbp/#{s.slug}.txt to re-submit"
        log "  [HELD  ] #{s.slug} — #{msg}"
        attention_lines << "#{s.slug}: #{msg}"
        true
      end

      # A show whose saved description is over-limit would abort the whole rebuild
      # mid-flight; exclude it up front (loud error) so the other shows still post.
      # Shows with NO description stay in — the rebuild drafts one via claude.
      postable = postable.reject do |s|
        next false if load_description(s.slug).nil? || canonical_signature(s)
        errors += 1
        error_lines << "#{s.slug} — description invalid (over-limit) — fix gbp/#{s.slug}.txt"
        log "  [ERROR ] #{s.slug} — description over-limit; excluded from stack"
        true
      end

      live_active = live_ours.reject { |p| p["state"] == "REJECTED" }
      if in_sync?(live_active, postable, state["shows"]) && newly_rejected.empty?
        skipped = postable.size
        log "listing in sync (#{postable.map(&:slug).join(" > ")}, soonest on top) — nothing to do"
      else
        log "listing out of sync — rebuilding stack (furthest first, next show last)"
        snapshot = JSON.parse(JSON.generate(state["shows"]))
        made = []
        failed = false
        postable.reverse_each do |show|
          status, msg = create_show(show, token, account, state, options)
          tag = { created: "CREATE", new: "NEW   ", would: "would ", skip: "skip  ",
                  error: "ERROR ", rejected: "REJECT" }[status] || status.to_s
          log "  [#{tag}] #{show.slug} — #{msg}"
          case status
          when :created then created += 1
          when :new
            created += 1
            newposts += 1
            review_lines << "#{show.slug}: AI-drafted description posted — review gbp/#{show.slug}.txt"
          when :rejected
            created += 1
            newly_rejected << show.slug
            attention_lines << "#{show.slug}: #{msg}"
          when :error
            errors += 1
            error_lines << "#{show.slug} — #{msg}"
            failed = true
          end
          break if failed
          made << [show.slug, state["shows"][show.slug]["post_name"]] unless options[:dry_run] || status == :skip
          # Distinct createTimes make the display order deterministic (Google sorts
          # newest-posted first; near-simultaneous creates could tie).
          sleep 1.5 unless DRY_RUN
        end

        if failed
          # Create-before-delete: the old stack is untouched, so the listing is never
          # left degraded. Roll back the partial new stack and restore state.
          made.each do |slug, name|
            if (st = delete_post(token, name)) == :ok
              log "  [ROLLBK] #{slug} — removed partial-rebuild post"
            else
              errors += 1
              error_lines << "#{slug} — rollback delete failed, post orphaned live: #{st[1]}"
              log "  [ROLLBK-FAIL] #{slug} — #{st[1]}"
            end
          end
          state["shows"] = snapshot
          created = newposts = 0
        else
          # New stack is up and correctly ordered; retire every pre-rebuild post
          # (old versions, rejected posts, duplicates, past/out-of-window strays).
          live_ours.each do |p|
            slug = our_post_slug(p)
            if DRY_RUN
              log "  [would ] DELETE #{slug} (superseded by rebuild)"
              deleted += 1
            elsif (st = delete_post(token, p["name"])) == :ok
              log "  [DELETE] #{slug} (superseded by rebuild)"
              deleted += 1
            else
              errors += 1
              error_lines << "#{slug} — #{st[1]}"
            end
          end
          # Prune state entries that are neither desired nor quarantined.
          keep = desired.map(&:slug)
          state["shows"].to_a.each do |slug, rec|
            state["shows"].delete(slug) unless keep.include?(slug) || rec["rejected_signature"]
          end
        end
      end
    end

    save_state(state) unless DRY_RUN

    summary = "created #{created}, new #{newposts}, deleted #{deleted}, held #{held}, " \
              "skipped #{skipped}, errors #{errors}"
    log "\n#{summary}"
    log "(dry-run: no API writes, no state saved)" if DRY_RUN

    # Alert (fail ping) on hard errors or a NEW rejection — but a post that is still
    # rejected from a previous run only rides along in the OK body, so the alert
    # channel stays clean for real failures while the dark show stays visible.
    if errors > 0 || !newly_rejected.empty?
      body = [summary] + error_lines
      newly_rejected.each do |slug|
        body << "NEW REJECTION: #{slug} — Google content policy (no reason via API). " \
                "Edit gbp/#{slug}.txt; the next run re-submits it as a fresh post."
      end
      # attention_lines for slugs already covered by a NEW REJECTION line are redundant
      body.concat(attention_lines.reject { |l| newly_rejected.any? { |s| l.start_with?("#{s}:") } })
      body.concat(review_lines)   # a drafted-then-rolled-back txt still needs human review
      healthcheck_ping(:fail, hc_body("FAILED", body.join("\n")))
      exit 1
    else
      body = [summary]
      body.concat(review_lines) unless review_lines.empty?
      body.concat(attention_lines) unless attention_lines.empty?
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
end

#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — the repo is full of non-ASCII bytes (Zürich, Español, "—",
# emoji) and Ruby defaults to US-ASCII under a bare cron/launchd environment.
# See repo CLAUDE.md "Rules that bite". Kept even though this script is meant to be
# run by hand: it costs one line and removes a whole class of 3am-only failures.
Encoding.default_external = Encoding::UTF_8

#
# add-event.rb
#
# Add a BRAND NEW show to the site from its Eventfrog link, in one command.
#
#   ruby script/add-event.rb https://eventfrog.ch/de/p/.../my-show-123456.html \
#     --host martinadoescomedy --host harryf.cks \
#     --feature-img ~/Desktop/flyer-wide.png \
#     --image       ~/Desktop/flyer-1200x630.png \
#     --thumbnail   ~/Desktop/flyer-square.png
#
# WHAT IT DOES
#   1. Fetches the Eventfrog page (group/series page or single event page) and
#      parses its schema.org JSON-LD for name, description, dates, price, venue
#      and flyer image.
#   2. Writes _posts/<first-event-date>-<slug>.md — the ONLY non-derived artifact
#      that defines a show on this site (a show is any _posts file with a
#      ticket_url; see check-site.rb and refresh-calendar-data.rb).
#   3. Copies the images you passed into assets/img/uploads/ (+ assets/img/thumbs/)
#      under lowercase slug-derived names, or downloads Eventfrog's own flyer when
#      you passed none.
#   4. Runs script/refresh-calendar-data.rb, which now sees the new post and
#      rebuilds _data/calendar.yml + calendar_past.yml AND appends any unseen
#      venue to _data/venues.yml for free.
#   5. Back-fills next_event_date / next_event_end_date / venue_slug / price_chf
#      into the new post FROM _data/calendar.yml — so the new show is correct for
#      exactly the same reason every existing show is correct.
#   6. Runs script/refresh-calendar-page.rb --no-refresh --no-push to regenerate
#      pages/1_calendar.md (that page is materialized markdown, not a live query).
#   7. Bumps index.html last_modified_at so the sitemap <lastmod> for "/" advances.
#      The homepage LISTING itself needs no edit: _layouts/home.liquid recomputes
#      from site.posts on every build.
#
# WHAT IT DELIBERATELY DOES NOT DO
#   - No git. No add, no commit, no push. You review the description and metadata
#     by hand, then commit yourself. (Push to master goes live — see CLAUDE.md.)
#   - No IndexNow submission and no Healthchecks.io ping. Those belong to the cron
#     jobs, not to an interactive tool. The child refresh-calendar-page.rb is
#     spawned with HEALTHCHECKS_URL cleared so it cannot fake a cron success ping.
#   - No writes to _comedians/*.md. That collection is generated from Grist by
#     script/sync-comedians.rb and would be overwritten. Unknown --host slugs are
#     reported, never invented.
#   - No Google Business Profile post. script/post-events-to-google.rb owns that.
#
# CODE REUSE NOTE
#   The sibling scripts in script/ deliberately duplicate their small helpers
#   rather than share a lib, so that any one of them stays a single runnable file
#   (see the comment at refresh-next-event-dates.rb). This script follows the same
#   convention: every borrowed block carries a comment naming its source.
#
# Usage:
#   ruby script/add-event.rb URL [options]
#   ruby script/add-event.rb URL --dry-run --verbose     # preview, write nothing
#   ruby script/add-event.rb --help
#
# Stdlib only, matching the rest of script/ — no bundler, no gems.

require "fileutils"
require "json"
require "net/http"
require "open3"
require "optparse"
require "rbconfig"
require "time"
require "date"
require "uri"
require "yaml"

ROOT        = File.expand_path("..", __dir__)
SCRIPT_DIR  = __dir__
POSTS_DIR   = File.join(ROOT, "_posts")
COMEDIANS   = File.join(ROOT, "_comedians")
CALENDAR    = File.join(ROOT, "_data", "calendar.yml")
VENUES_FILE = File.join(ROOT, "_data", "venues.yml")
HOMEPAGE    = File.join(ROOT, "index.html")
UPLOADS     = File.join(ROOT, "assets", "img", "uploads")
THUMBS      = File.join(ROOT, "assets", "img", "thumbs")
EXTRACTOR   = File.join(SCRIPT_DIR, "refresh-calendar-data.rb")
PAGE_SCRIPT = File.join(SCRIPT_DIR, "refresh-calendar-page.rb")

# Spawn child ruby with the SAME interpreter running this script — never a bare
# "ruby", which under a minimal PATH resolves to /usr/bin/ruby (macOS system 2.6)
# and can't parse the 3.0+ endless `def foo = …` defs in refresh-calendar-data.rb
# and validate-calendar.rb. Copied from refresh-next-event-dates.rb.
RUBY = RbConfig.ruby

# Fallback show length when Eventfrog omits endDate. Same default as
# refresh-next-event-dates.rb, so a post seeded here and later rolled by cron
# keeps the same duration.
DEFAULT_DURATION_MIN = 150

# Copied from refresh-calendar-data.rb — Eventfrog serves a client-rendered SPA to
# unknown agents; a browser UA gets the server-rendered DOM with the JSON-LD in it.
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " \
             "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
GROUP_PATH_RE = %r{/p/(?:groups|gruppen|groupes)/}i
EVENT_LINK_RE = %r{/[a-z]{2}/p/[a-z0-9-]+/[^"'<>]*-\d{10,}\.html}i

# Fixed English names — NEVER rely on strftime locale, which is C/ASCII under a
# minimal environment. Copied from refresh-calendar-page.rb.
MONTHS_FULL = %w[January February March April May June
                 July August September October November December].freeze
DOW_FULL    = %w[Sunday Monday Tuesday Wednesday Thursday Friday Saturday].freeze

# The standard recording/consent notice carried by our show pages. Kept verbatim so
# every new show page starts legally consistent with the existing ones.
LEGAL_DISCLAIMER = <<~LEGAL.strip
  Please be aware that comedians may record their performances during the show, and audience members may also appear in these recordings. By purchasing a ticket and attending the event, you consent to being filmed or photographed in this public setting.

  If any content featuring you is later published online and you are uncomfortable with it, please don't hesitate to reach out to us. We're happy to review the material and will gladly remove it upon request. Thank you for your understanding and support!
LEGAL

# ---------- options ----------

options = {
  hosts: [], hosts_label: nil, image: nil, feature_img: nil, thumbnail: nil,
  permalink: nil, title: nil, description: nil, tagline: nil,
  dry_run: false, force: false, no_refresh: false, verbose: false
}

parser = OptionParser.new do |o|
  o.banner = "Usage: ruby script/add-event.rb EVENTFROG_URL [options]"
  o.separator ""
  o.separator "Content:"
  o.on("--host SLUG",       "Regular host / resident cast (repeatable, or comma-separated).",
                            "Must match a `slug:` in _comedians/. Drives the host cards",
                            "and the Event JSON-LD performer[].") { |v| options[:hosts].concat(v.split(",").map(&:strip)) }
  o.on("--hosts-label TEXT", "Override the 'Hosted by' label (e.g. 'Starring').") { |v| options[:hosts_label] = v }
  o.on("--title TEXT",       "Override the Eventfrog event name.")        { |v| options[:title]       = v }
  o.on("--description TEXT", "Override the SEO description (~160 chars).") { |v| options[:description] = v }
  o.on("--tagline TEXT",     "Short subtitle shown under the hero title.") { |v| options[:tagline]     = v }
  o.on("--permalink SLUG",   "Override the derived permalink (e.g. 'double-shot').") { |v| options[:permalink] = v.gsub(%r{^/|/$}, "") }
  o.separator ""
  o.separator "Images (three distinct roles — see admin/config.yml):"
  o.on("--feature-img PATH", "Hero/banner across the top of the page. ~1920x1005.",
                             "Also becomes the Event JSON-LD image[].")   { |v| options[:feature_img] = v }
  o.on("--image PATH",       "SEO image: og:image / twitter:image, i.e. the",
                             "Twitter/X card picture. 1200x630 minimum.")  { |v| options[:image] = v }
  o.on("--thumbnail PATH",   "Square share image (WhatsApp etc). ~1080x1080.") { |v| options[:thumbnail] = v }
  o.separator ""
  o.separator "Behaviour:"
  o.on("--dry-run",    "Print what would happen; write nothing, run nothing.") { options[:dry_run]    = true }
  o.on("--force",      "Overwrite an existing post with the same permalink.")  { options[:force]      = true }
  o.on("--no-refresh", "Skip the calendar data + calendar page regeneration.")  { options[:no_refresh] = true }
  o.on("--verbose",    "Show parse detail and child-script output.")            { options[:verbose]    = true }
  o.on("-h", "--help", "Show this message.") { puts o; exit 0 }
end
parser.parse!

# Unbuffered stdout so the progress lines and the `warn` lines interleave in the
# order they actually happen. Without this, Ruby buffers stdout but not stderr and
# a warning about host slugs surfaces above the banner that preceded it.
$stdout.sync = true

def say(msg)            = puts(msg)
def vsay(msg, options)  = (puts msg if options[:verbose])

def abort!(msg)
  warn "add-event: #{msg}"
  exit 1
end

TICKET_URL = ARGV.shift
abort!("no Eventfrog URL given.\n\n#{parser}") if TICKET_URL.nil? || TICKET_URL.strip.empty?
abort!("not an Eventfrog URL: #{TICKET_URL}") unless TICKET_URL.include?("eventfrog")

# ---------- small helpers ----------

# Lowercase ASCII slug. Accents are folded rather than dropped so "Café" → "cafe"
# instead of "caf". Mirrors admin/config.yml's `clean_accents: true`.
ACCENTS = { "à"=>"a","á"=>"a","â"=>"a","ä"=>"a","ã"=>"a","å"=>"a","è"=>"e","é"=>"e","ê"=>"e","ë"=>"e",
            "ì"=>"i","í"=>"i","î"=>"i","ï"=>"i","ò"=>"o","ó"=>"o","ô"=>"o","ö"=>"o","õ"=>"o",
            "ù"=>"u","ú"=>"u","û"=>"u","ü"=>"u","ñ"=>"n","ç"=>"c","ß"=>"ss" }.freeze

def slugify(text)
  s = text.to_s.downcase
  ACCENTS.each { |from, to| s = s.gsub(from, to) }
  s.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
end

# Venue slugs use the EXACT transform from refresh-calendar-data.rb#venue_slugify
# (no accent folding) rather than slugify() above, so the placeholder this script
# writes for an unseen venue matches the key the extractor will mint in
# _data/venues.yml. Copied verbatim — divergence here would silently orphan the
# post's venue_slug from its venues.yml entry under --no-refresh.
def venue_slugify(name)
  name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
end

# A human-short label: the title up to the first separator. Copied from
# refresh-calendar-data.rb#short_name — used here to derive a SHORT permalink
# ("DOUBLE SHOT - English Comedy with…" → "double-shot") rather than a 60-character URL.
def short_name(title)
  n = title.split(/\s[•|‣·]\s|\s[—–-]\s|:/).first.to_s.strip
  n.empty? ? title.strip : n
end

# Eventfrog descriptions arrive as one long blob with layout artifacts ("__" used
# as a separator, doubled spaces, stray newlines). Normalize without rewriting the
# prose — this text is a DRAFT the human edits before committing.
def clean_description(text)
  text.to_s
      .gsub(/_{2,}/, "\n\n")
      .gsub(/\r\n?/, "\n")
      .gsub(/[ \t]+/, " ")
      .gsub(/\n{3,}/, "\n\n")
      .strip
end

# Eventfrog organisers almost always open the description with the event name,
# which the body then renders directly under an `## <event name>` heading — the
# title twice in a row. Strip a leading repetition, matching loosely so punctuation
# and spacing differences ("PROMESSI SPASSI - Stand-up…" vs "PROMESSI SPASSI –
# Stand up…") don't defeat it. Unicode-aware so accented titles still match.
def strip_leading_title(text, title)
  words = title.to_s.split(/[^[:alnum:]]+/).reject(&:empty?)
  return text if words.size < 2   # too short to be a confident match
  pattern = words.map { |w| Regexp.escape(w) }.join("[^[:alnum:]]+")
  text.sub(/\A#{pattern}[^[:alnum:]]*/i, "").lstrip
end

# First ~limit characters of prose, cut on a sentence boundary where possible.
# Feeds the `description:` front matter (SEO/meta description, ~160 chars).
def summarize(text, limit = 180)
  flat = text.to_s.gsub(/\s+/, " ").strip
  return flat if flat.length <= limit
  cut = flat[0, limit]
  if (idx = cut.rindex(/[.!?] /))
    cut[0..idx]
  else
    "#{cut[0, cut.rindex(" ") || limit]}…"
  end.strip
end

def yq(s) = '"' + s.to_s.gsub("\\", "\\\\\\\\").gsub('"', '\\"') + '"'

def fmt_date(t)  = "#{DOW_FULL[t.wday]}, #{t.day} #{MONTHS_FULL[t.month - 1]} #{t.year}"
def fmt_time(t)  = format("%02d:%02d", t.hour, t.min)

# ---------- HTTP (copied from refresh-calendar-data.rb#http_get) ----------

# GET a URL following redirects. Returns [final_uri_string, http_code_int, body].
# Never raises on HTTP status — the caller decides what a 404 means.
def http_get(url, limit = 6)
  raise "too many redirects" if limit <= 0
  uri = URI(url)
  Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https",
                  open_timeout: 10, read_timeout: 20) do |http|
    req = Net::HTTP::Get.new(uri.request_uri)
    req["User-Agent"] = USER_AGENT
    req["Accept-Language"] = "en"
    res = http.request(req)
    case res
    when Net::HTTPRedirection
      http_get(URI.join(url, res["location"]).to_s, limit - 1)
    else
      [url, res.code.to_i, res.body.to_s]
    end
  end
end

# ---------- Eventfrog parsing (copied from refresh-calendar-data.rb) ----------

# Parse the first JSON-LD <script> block on an event page and return the Event
# object (handles bare object, array, and @graph), or nil.
def event_jsonld(html)
  html.scan(%r{<script[^>]*application/ld\+json[^>]*>(.*?)</script>}m).each do |m|
    doc = JSON.parse(m[0]) rescue next
    candidates = doc.is_a?(Array) ? doc : (doc["@graph"] || [doc])
    candidates = [candidates] unless candidates.is_a?(Array)
    ev = candidates.find { |o| o.is_a?(Hash) && o["@type"].to_s == "Event" }
    return ev if ev
  end
  nil
end

# FIRST CHF price across schema.org offers → rounded int or nil. Deliberately the
# FIRST, not the cheapest: `.min` would pick a concession tier (Students CHF 5)
# over the actual entry price. Copied from refresh-calendar-data.rb.
def first_chf_price(offers)
  list = offers.is_a?(Array) ? offers : [offers]
  prices = list.filter_map do |o|
    next unless o.is_a?(Hash) && o["priceCurrency"].to_s.upcase == "CHF"
    p = o["price"]
    Float(p) rescue nil
  end
  prices.empty? ? nil : prices.first.round
end

# Given a resolved ticket page, return the list of individual event URLs to parse.
# Classification is by CONTENT, not URL path: a group page carries NO JSON-LD at all
# (verified — it renders its instance table client-side), only links to the
# individual pages that do. Copied verbatim from refresh-calendar-data.rb#event_urls_from.
def event_urls_from(final_url, html)
  own_id = final_url[/-(\d{10,})\.html/, 1]
  stem   = final_url[%r{/([^/]+?)-\d{10,}\.html\z}, 1]
  is_group = (final_url =~ GROUP_PATH_RE)

  kids = html.scan(EVENT_LINK_RE).map(&:strip).uniq
             .reject { |l| l =~ GROUP_PATH_RE }
             .reject { |l| own_id && l.include?(own_id) }
  kids = kids.select { |l| stem && l =~ %r{/#{Regexp.escape(stem)}[-/]} } unless is_group

  kids.empty? ? [final_url] : kids.map { |l| URI.join(final_url, l).to_s }
end

# Normalize one Eventfrog Event JSON-LD into the fields this script seeds a post
# with. Wider than refresh-calendar-data.rb#parse_event on purpose: it also keeps
# `description` and `image`, which _data/calendar.yml does NOT store and which we
# need for the page body and the flyer.
def parse_event(ev, url)
  start_t = (Time.parse(ev["startDate"].to_s) rescue nil)
  return nil unless start_t
  loc = ev["location"]
  loc = loc.first if loc.is_a?(Array)
  addr = loc.is_a?(Hash) ? loc["address"] : nil
  addr = addr.first if addr.is_a?(Array)
  img = ev["image"]
  img = img.first if img.is_a?(Array)
  {
    "name"        => ev["name"].to_s,
    "description" => ev["description"].to_s,
    "start"       => start_t,
    "end"         => (Time.parse(ev["endDate"].to_s) rescue nil),
    "status"      => ev["eventStatus"].to_s.split("/").last,
    "location"    => (loc.is_a?(Hash) ? loc["name"].to_s : nil),
    "street"      => (addr.is_a?(Hash) ? addr["streetAddress"].to_s   : nil),
    "city"        => (addr.is_a?(Hash) ? addr["addressLocality"].to_s : nil),
    "postal_code" => (addr.is_a?(Hash) ? addr["postalCode"].to_s      : nil),
    "price_chf"   => first_chf_price(ev["offers"]),
    "image"       => (img.is_a?(String) ? img : nil),
    "url"         => url
  }
end

# Resolve the ticket URL to its future, non-cancelled instances, soonest first.
def fetch_events(url, options)
  final_url, code, html = http_get(url)
  abort!("Eventfrog returned HTTP #{code} for #{final_url}") unless code == 200
  # A dead Eventfrog link does NOT 404 — it 302s to their error page, which answers
  # 200. Without this check the run falls through to a vague "no upcoming events"
  # instead of "that URL does not exist". Same trap as a dead vanity slug, which
  # refresh-calendar-data.rb records under `unresolved:`.
  if final_url =~ %r{/error404\.html\z}i
    abort!("that Eventfrog URL does not exist — it redirected to Eventfrog's error page. " \
           "Check the link, or use the canonical /p/groups/ URL for a recurring show.")
  end
  vsay("  resolved to #{final_url}", options)

  event_urls = event_urls_from(final_url, html)
  abort!("resolved #{final_url} but found no event pages on it") if event_urls.empty?
  vsay("  #{event_urls.size} candidate event page(s)", options)

  now = Time.now
  events = event_urls.filter_map do |ev_url|
    _f, ev_code, ev_html = http_get(ev_url)
    next unless ev_code == 200
    ev = event_jsonld(ev_html)
    next unless ev
    inst = parse_event(ev, ev_url)
    next unless inst && inst["start"] > now
    next if inst["status"] == "EventCancelled"
    vsay("    + #{inst["start"]} @ #{inst["location"]}", options)
    inst
  rescue => e
    vsay("    ! #{ev_url} — #{e.class}: #{e.message}", options)
    nil
  end

  abort!("no upcoming events found at #{final_url}. Is the show in the past, or is " \
         "this a group URL whose instances have not been published yet?") if events.empty?
  events.sort_by { |e| e["start"] }
end

# ---------- hosts ----------

# {slug => title} for every comedian page. A comedian is any file under _comedians/
# (the repo's own definition); its `slug:` front matter is what post `hosts:` entries
# are matched against in show-row.liquid / post.liquid / jsonld-event.html.
def known_comedians
  Dir[File.join(COMEDIANS, "*.md")].each_with_object({}) do |path, h|
    raw = File.read(path, encoding: "UTF-8")
    next unless raw.start_with?("---")
    fm = (YAML.safe_load(raw.split(/^---\s*$/, 3)[1].to_s, permitted_classes: [Date, Time], aliases: true) rescue nil)
    next unless fm.is_a?(Hash)
    slug = fm["slug"].to_s
    slug = File.basename(path, ".md") if slug.empty?
    h[slug] = fm["title"].to_s
  end
end

# Split the requested hosts into [known, unknown]. Unknown slugs are NEVER written
# into the post: an unresolvable slug renders nothing in the host grid and silently
# drops a Person from the Event JSON-LD, which is worse than a loud warning here.
def partition_hosts(requested, catalogue)
  requested.uniq.partition { |s| catalogue.key?(s) }
end

def suggest_slugs(bad, catalogue)
  needle = bad.downcase.gsub(/[^a-z0-9]/, "")
  return [] if needle.empty?
  catalogue.keys.select do |k|
    hay = k.downcase.gsub(/[^a-z0-9]/, "")
    hay.include?(needle) || needle.include?(hay) || hay[0, 4] == needle[0, 4]
  end.first(3)
end

# ---------- images ----------

def ext_for(path_or_url)
  e = File.extname(URI(path_or_url.to_s).path.to_s).downcase rescue File.extname(path_or_url.to_s).downcase
  e = File.extname(path_or_url.to_s).downcase if e.empty?
  e.empty? ? ".png" : e
end

# Copy a local image into the site under a lowercase, slug-derived name and return
# the site-absolute path to write into front matter. Lowercase matters: macOS hides
# case but the Linux build does not, so a mixed-case filename works locally and
# 404s once live (see CLAUDE.md "Case matters on the live build").
def install_image(src, dest_dir, basename, options)
  ext  = ext_for(src)
  name = "#{basename}#{ext}"
  dest = File.join(dest_dir, name)
  rel  = "/#{dest.sub("#{ROOT}/", "")}"
  if options[:dry_run]
    say("  [would copy] #{src} → #{rel}")
  else
    FileUtils.mkdir_p(dest_dir)
    FileUtils.cp(File.expand_path(src), dest)
    say("  image: #{rel}")
  end
  rel
end

# Download Eventfrog's own flyer as the feature image when the user passed none.
# Best-effort: a failure just means the post ships without a hero image, which is a
# thing the human can fix by hand, not a reason to abandon the run.
def download_image(url, dest_dir, basename, options)
  return nil if url.to_s.empty?
  ext  = ext_for(url)
  name = "#{basename}#{ext}"
  dest = File.join(dest_dir, name)
  rel  = "/#{dest.sub("#{ROOT}/", "")}"
  if options[:dry_run]
    say("  [would download] #{url} → #{rel}")
    return rel
  end
  _f, code, body = http_get(url)
  if code != 200 || body.empty?
    warn "  ! could not download Eventfrog flyer (HTTP #{code}) — post ships without a hero image"
    return nil
  end
  FileUtils.mkdir_p(dest_dir)
  File.binwrite(dest, body)
  say("  image: #{rel} (downloaded from Eventfrog)")
  rel
rescue => e
  warn "  ! flyer download failed (#{e.message}) — post ships without a hero image"
  nil
end

# ---------- front matter handling (copied from refresh-next-event-dates.rb) ----------

def split_post(content)
  m = content.match(/\A---\n(.*?)\n---\n(.*)\z/m)
  return nil unless m
  { raw_fm: m[1], body: m[2] }
end

def yaml_set(raw_fm, key, value)
  re = /^#{Regexp.escape(key)}:.*$/
  if raw_fm =~ re
    raw_fm.sub(re, "#{key}: #{value}")
  else
    "#{raw_fm}\n#{key}: #{value}"
  end
end

# ---------- post rendering ----------

def render_front_matter(f)
  lines = []
  lines << "layout: post"
  # Quoted "true", not bare true: admin/config.yml filters the Shows collection on
  # {field: editable, value: "true"} (a STRING), so a boolean here hides the new
  # show from the Decap CMS editor.
  lines << 'editable: "true"'
  lines << "title: #{yq(f[:title])}"
  lines << "tagline: #{yq(f[:tagline])}" if f[:tagline]
  lines << "description: #{yq(f[:description])}"
  lines << "last_modified_at: #{f[:last_modified_at]}"
  lines << "feature-img: #{yq(f[:feature_img])}" if f[:feature_img]
  lines << "image: #{yq(f[:image])}"             if f[:image]
  lines << "thumbnail: #{yq(f[:thumbnail])}"     if f[:thumbnail]
  lines << "excerpt_separator: <!--more-->"
  lines << "ticket_url: #{yq(f[:ticket_url])}"
  lines << "permalink: /#{f[:permalink]}/"
  lines << "hosts_label: #{yq(f[:hosts_label])}" if f[:hosts_label]
  if f[:hosts].any?
    lines << "hosts:"
    f[:hosts].each { |h| lines << "  - #{yq(h)}" }
  end
  lines << "event_type: #{f[:event_type]}"
  lines << "venue: #{yq(f[:venue_name])}"   if f[:venue_name]
  lines << "venue_slug: #{f[:venue_slug]}"  if f[:venue_slug]
  lines << "default_duration_minutes: #{f[:duration_min]}"
  lines << "next_event_date: #{f[:start_iso]}"
  lines << "next_event_end_date: #{f[:end_iso]}"
  lines << "price_chf: #{f[:price_chf]}" if f[:price_chf]
  lines.join("\n")
end

# The body is a SCAFFOLD, deliberately. Eventfrog's own copy is dropped in as the
# intro so the page is never empty, but the whole point of not pushing is that you
# rewrite this in the house voice (WRITING_GUIDE.md — no em dashes) before commit.
def render_body(f, events)
  first = events.first
  out = []
  out << "## #{f[:title]}"
  out << ""
  intro = f[:body_intro].to_s.split(/\n\n+/).map(&:strip).reject(&:empty?)
  out << (intro.first || "")
  out << ""
  out << "<!--more-->"
  out << ""
  intro.drop(1).each { |p| out << p << "" }

  out << "## When and Where"
  out << ""
  out << "- **Date:** #{fmt_date(first["start"])}"
  show_line = "- **Show:** #{fmt_time(first["start"])}"
  show_line += " to #{fmt_time(first["end"])}" if first["end"]
  out << show_line
  where = [f[:venue_name], f[:venue_street], [f[:venue_postal], f[:venue_city]].compact.reject(&:empty?).join(" ")]
          .compact.map(&:to_s).reject(&:empty?).join(", ")
  out << "- **Where:** #{where}" unless where.empty?
  out << "- **Tickets:** CHF #{f[:price_chf]}" if f[:price_chf]
  out << ""

  # Recurring shows can carry 20+ future instances. The body lists only the next
  # few and points at /calendar/, which is the page that exists to hold them all.
  if events.size > 1
    out << "## Upcoming dates"
    out << ""
    events.first(6).each { |e| out << "- #{fmt_date(e["start"])}, #{fmt_time(e["start"])}" }
    out << ""
    if events.size > 6
      out << "See the [full calendar](/calendar/) for all #{events.size} upcoming dates."
      out << ""
    end
  end

  if f[:venue_name] && f[:venue_street]
    out << "## Getting there"
    out << ""
    link = f[:venue_maps] ? %(<a href="#{f[:venue_maps]}">#{f[:venue_street]}</a>) : f[:venue_street]
    out << "#{f[:venue_name]} is on #{link}#{f[:venue_city] ? " in #{f[:venue_city]}" : ""}."
    out << ""
  end

  out << "## Legal Disclaimer"
  out << ""
  out << LEGAL_DISCLAIMER
  out << ""
  out.join("\n").gsub(/\n{3,}/, "\n\n")
end

# ---------- child scripts ----------

# Spawn a sibling script with the SAME ruby, from the project root, with
# HEALTHCHECKS_URL cleared. That last part matters: refresh-calendar-page.rb pings
# Healthchecks.io from an at_exit handler, and an interactive run must not report a
# green "the cron job succeeded" to the monitor. Empty string (not delete) because
# that script's load_dotenv does `ENV[key] ||= value` and would re-read .env.
def run_child(cmd, label, options)
  env = { "HEALTHCHECKS_URL" => "" }
  say("  → #{label}")
  out, status = Open3.capture2e(env, *cmd, chdir: ROOT)
  puts out.lines.map { |l| "     #{l}" }.join if options[:verbose]
  return true if status.success?
  warn "  ! #{label} failed (exit #{status.exitstatus}):"
  warn out.lines.last(15).map { |l| "     #{l}" }.join
  false
end

# {show_slug => earliest upcoming event} from _data/calendar.yml.
# Copied from refresh-next-event-dates.rb#next_event_by_show.
def next_event_by_show
  return {} unless File.exist?(CALENDAR)
  doc = YAML.safe_load(File.read(CALENDAR, encoding: "UTF-8"), permitted_classes: [Date, Time], aliases: true) || {}
  (doc["events"] || []).each_with_object({}) do |e, h|
    slug = e["show"].to_s
    h[slug] = e if h[slug].nil? || e["start"].to_s < h[slug]["start"].to_s
  end
end

def venues
  @venues ||= (YAML.safe_load(File.read(VENUES_FILE, encoding: "UTF-8")) || {} rescue {})
end

# {show_slug => number_of_upcoming_instances} from _data/calendar.yml.
def instance_counts
  return {} unless File.exist?(CALENDAR)
  doc = YAML.safe_load(File.read(CALENDAR, encoding: "UTF-8"), permitted_classes: [Date, Time], aliases: true) || {}
  (doc["events"] || []).each_with_object(Hash.new(0)) { |e, h| h[e["show"].to_s] += 1 }
end

# refresh-calendar-data.rb re-fetches EVERY show, not just the new one, and a show
# whose Eventfrog page fails to resolve is recorded as `unresolved` and simply drops
# out of calendar.yml. Cron tolerates that (tomorrow's run repairs it); an
# interactive run does NOT, because a human is about to commit the diff and a
# vanished show looks exactly like a normal calendar refresh. So: compare instance
# counts across the child and shout if any PRE-EXISTING show lost everything.
def warn_on_dropped_shows(before, after, new_slug)
  dropped = before.keys.reject { |s| s == new_slug }.select { |s| after[s].to_i.zero? }
  return true if dropped.empty?
  warn ""
  warn "  !! #{dropped.size} previously-listed show(s) vanished from _data/calendar.yml:"
  dropped.each { |s| warn "  !!   #{s} (had #{before[s]} upcoming instance(s))" }
  warn "  !! This is almost always a transient Eventfrog fetch failure, NOT a real change."
  warn "  !! DO NOT COMMIT the _data/ or pages/1_calendar.md changes. Re-run:"
  warn "  !!   ruby script/refresh-calendar-data.rb --verbose"
  warn "  !! and check the `unresolved:` block at the end of _data/calendar.yml."
  warn ""
  false
end

# Re-parse the front matter we just wrote. The back-fill patches it line-by-line
# with a regex (copied from refresh-next-event-dates.rb), so this is the assertion
# that the file is still valid YAML AFTER the second write, not just after the first.
def assert_front_matter_parses!(path)
  parsed = split_post(File.read(path, encoding: "UTF-8"))
  abort!("wrote #{path} but it has no parseable front matter — this is a bug in add-event.rb") unless parsed
  YAML.safe_load(parsed[:raw_fm], permitted_classes: [Date, Time], aliases: true)
rescue Psych::Exception => e
  abort!("wrote #{path} but its front matter is not valid YAML (#{e.message}). " \
         "Delete it and re-run, or fix it by hand.")
end

# Bump the homepage's last_modified_at so its sitemap <lastmod> reflects the fact
# that the front page now lists a new show. The LISTING itself is recomputed from
# site.posts by _layouts/home.liquid on every build, so there is nothing else to
# edit here. Copied from refresh-next-event-dates.rb#update_homepage_timestamp.
def update_homepage_timestamp(modified_at, options)
  return false unless File.exist?(HOMEPAGE)
  content = File.read(HOMEPAGE, encoding: "UTF-8")
  parsed = split_post(content)
  return false unless parsed
  new_fm = yaml_set(parsed[:raw_fm], "last_modified_at", modified_at)
  return false if new_fm == parsed[:raw_fm]
  File.write(HOMEPAGE, "---\n#{new_fm}\n---\n#{parsed[:body]}") unless options[:dry_run]
  true
end

# ---------- main ----------

now = Time.now
say("Adding a new show from Eventfrog…")
say("")

# --- validate every input BEFORE the first write, so a bad run leaves no partial show ---

[[options[:image], "--image"], [options[:feature_img], "--feature-img"], [options[:thumbnail], "--thumbnail"]].each do |path, flag|
  next if path.nil?
  abort!("#{flag}: no such file — #{path}") unless File.file?(File.expand_path(path))
end

catalogue = known_comedians
good_hosts, bad_hosts = partition_hosts(options[:hosts], catalogue)
bad_hosts.each do |slug|
  hint = suggest_slugs(slug, catalogue)
  warn "  ! unknown host slug '#{slug}' — not written to the post." \
       "#{hint.empty? ? " No similar slug in _comedians/." : " Did you mean: #{hint.join(", ")}?"}"
end
unless bad_hosts.empty?
  warn "    (_comedians/ is generated from Grist by script/sync-comedians.rb —"
  warn "     add the comedian there and re-run the sync, then add the slug by hand.)"
end
good_hosts.each { |s| say("  host: #{s} (#{catalogue[s]})") }

# --- fetch and parse Eventfrog ---

say("  fetching #{TICKET_URL}")
events = fetch_events(TICKET_URL, options)
first  = events.first
say("  #{events.size} upcoming event(s); next #{first["start"]} @ #{first["location"]}")

title       = options[:title] || first["name"]
permalink   = options[:permalink] || slugify(short_name(title))
abort!("could not derive a permalink from #{title.inspect} — pass --permalink") if permalink.empty?
body_intro  = strip_leading_title(clean_description(first["description"]), title)
description = options[:description] || summarize(body_intro)
# Filename follows an explicit --permalink when one is given, so deliberately
# choosing a distinct URL never collides on disk with a same-titled show; otherwise
# it is the full slugified title (the descriptive form the existing _posts use).
file_slug   = options[:permalink] ? permalink : slugify(title)
file_slug   = permalink if file_slug.empty?
post_path   = File.join(POSTS_DIR, "#{first["start"].strftime("%Y-%m-%d")}-#{file_slug}.md")

# Refuse to clobber an existing show. The two collisions are distinct and get
# distinct messages: the URL is already taken, versus the file is already there.
existing = Dir[File.join(POSTS_DIR, "*.md")].find do |p|
  File.read(p, encoding: "UTF-8") =~ /^permalink:\s*["']?\/#{Regexp.escape(permalink)}\/?["']?\s*$/
end
unless options[:force]
  if existing
    abort!("a post for /#{permalink}/ already exists (#{File.basename(existing)}). " \
           "Pass --force to overwrite, or --permalink to pick a different URL.")
  elsif File.exist?(post_path)
    abort!("the post file _posts/#{File.basename(post_path)} already exists (same date and title, " \
           "different permalink). Pass --force to overwrite, or --title to differentiate.")
  end
end

say("  title:     #{title}")
say("  permalink: /#{permalink}/")
say("  post:      _posts/#{File.basename(post_path)}")

# --- images: three distinct roles (see admin/config.yml) ---

feature_rel = options[:feature_img] ? install_image(options[:feature_img], UPLOADS, "#{permalink}_feature", options) : nil
image_rel   = options[:image]       ? install_image(options[:image],       UPLOADS, "#{permalink}_card",    options) : nil
thumb_rel   = options[:thumbnail]   ? install_image(options[:thumbnail],   THUMBS,  permalink,              options) : nil
# No hero supplied → borrow Eventfrog's own flyer so the page is never bannerless.
feature_rel ||= download_image(first["image"], UPLOADS, "#{permalink}_feature", options)
# jekyll-seo-tag reads page.image for og:image / twitter:image. Falling back to the
# hero keeps the Twitter/X card from silently inheriting the site-wide default.
image_rel   ||= feature_rel

# --- venue (best effort now; authoritatively back-filled from calendar.yml below) ---

venue_slug = venues.keys.find do |s|
  key = first["location"].to_s.downcase.gsub(/[^a-z0-9]/, "")
  name = venues.dig(s, "name").to_s.downcase.gsub(/[^a-z0-9]/, "")
  bare = s.gsub(/[^a-z0-9]/, "")
  (bare.length >= 4 && key.include?(bare)) || (name.length >= 4 && (key.include?(name) || name.include?(key)))
end
venue = venue_slug ? venues[venue_slug] : nil

duration_min = DEFAULT_DURATION_MIN
end_time = first["end"] || (first["start"] + duration_min * 60)

fields = {
  title: title, tagline: options[:tagline], description: description,
  last_modified_at: now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
  feature_img: feature_rel, image: image_rel, thumbnail: thumb_rel,
  ticket_url: TICKET_URL, permalink: permalink,
  hosts: good_hosts, hosts_label: options[:hosts_label],
  event_type: (events.size > 1 ? "series" : "one-off"),
  venue_name: (venue && venue["name"]) || first["location"],
  # Unknown venue → write the slug the extractor is about to mint, so the key sits
  # in its natural place in the front matter instead of being appended at the end
  # by the back-fill, and so --no-refresh still leaves a usable venue_slug.
  venue_slug: venue_slug || (first["location"] && venue_slugify(first["location"])),
  venue_street: (venue && venue["street"]) || first["street"],
  venue_city:   (venue && venue["city"])   || first["city"],
  venue_postal: (venue && venue["postal_code"]) || first["postal_code"],
  venue_maps:   venue && venue["google_maps_url"],
  duration_min: duration_min,
  start_iso: first["start"].strftime("%Y-%m-%dT%H:%M:%S%:z"),
  end_iso:   end_time.strftime("%Y-%m-%dT%H:%M:%S%:z"),
  price_chf: first["price_chf"],
  body_intro: body_intro
}

post_content = "---\n#{render_front_matter(fields)}\n---\n#{render_body(fields, events)}"

if options[:dry_run]
  say("")
  say("--- would write #{post_path} ---")
  puts post_content
  say("")
  say("(dry run: nothing written, no child scripts run, no git touched)")
  exit 0
end

FileUtils.mkdir_p(POSTS_DIR)
File.write(post_path, post_content)
assert_front_matter_parses!(post_path)
say("  wrote _posts/#{File.basename(post_path)}")

# --- re-derive everything downstream ---

if options[:no_refresh]
  say("")
  say("Skipped calendar refresh (--no-refresh).")
else
  say("")
  say("Refreshing derived data…")

  # The post now exists, so the extractor treats the new show exactly like every
  # other one: it rebuilds _data/calendar.yml + calendar_past.yml and appends any
  # unseen venue to _data/venues.yml on its own. That is why this script has no
  # venue-append logic of its own.
  counts_before = instance_counts
  say("     (this re-fetches every show from Eventfrog — takes ~15-30s)")
  ok = run_child([RUBY, EXTRACTOR, options[:verbose] ? "--verbose" : "--quiet"],
                 "refresh-calendar-data.rb (Eventfrog → _data/calendar.yml)", options)
  unless ok
    warn ""
    warn "  The post WAS written: _posts/#{File.basename(post_path)}"
    warn "  Nothing else was changed. To resume without rewriting your edits to the body:"
    warn "    ruby script/refresh-calendar-data.rb --verbose"
    warn "    ruby script/refresh-calendar-page.rb --no-refresh --no-push"
    warn "  Or abandon this show entirely:"
    warn "    rm _posts/#{File.basename(post_path)}"
    abort!("calendar data refresh failed (see above).")
  end
  # A failed fetch for an UNRELATED show silently removes it from calendar.yml.
  # Cron self-heals; a human about to commit does not. Shout before they commit.
  warn_on_dropped_shows(counts_before, instance_counts, permalink)

  # Back-fill the authoritative date/venue/price from calendar.yml, so the new post
  # says exactly what the calendar says. Same field set and same precedence as
  # refresh-next-event-dates.rb#process_post — which is what will maintain this post
  # from tomorrow onward.
  ev = next_event_by_show[permalink]
  if ev
    parsed = split_post(File.read(post_path, encoding: "UTF-8"))
    fm = parsed[:raw_fm]
    fm = yaml_set(fm, "next_event_date", ev["start"].to_s)
    fm = yaml_set(fm, "next_event_end_date", ev["end"].to_s) unless ev["end"].to_s.empty?
    fm = yaml_set(fm, "price_chf",  ev["price_chf"]) if ev["price_chf"]
    fm = yaml_set(fm, "venue_slug", ev["venue"])     if ev["venue"]
    fm = yaml_set(fm, "venue", yq(ev["venue_name"])) if ev["venue_name"]
    File.write(post_path, "---\n#{fm}\n---\n#{parsed[:body]}")
    assert_front_matter_parses!(post_path)   # the back-fill patches YAML by regex
    say("  back-filled from calendar.yml: #{ev["start"]} @ #{ev["venue"]} " \
        "#{ev["price_chf"] ? "(CHF #{ev["price_chf"]})" : ""}")
  else
    warn "  ! /#{permalink}/ did not appear in _data/calendar.yml — check the ticket_url. " \
         "The post keeps the dates parsed directly from Eventfrog."
  end

  # pages/1_calendar.md is materialized markdown, not a live query over calendar.yml,
  # so it has to be regenerated. --no-refresh because we just ran the extractor;
  # --no-push because this script never touches git.
  ok = run_child([RUBY, PAGE_SCRIPT, "--no-refresh", "--no-push"] + (options[:verbose] ? ["--verbose"] : []),
                 "refresh-calendar-page.rb (→ pages/1_calendar.md)", options)
  warn "  ! calendar page regeneration failed — run it by hand before committing." unless ok
end

if update_homepage_timestamp(now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00"), options)
  say("  bumped index.html last_modified_at (sitemap <lastmod> for \"/\")")
end

# --- report: what the human still has to do ---

say("")
say("Done. NOTHING has been committed or pushed — that is yours.")
say("")
say("Next steps:")
say("  1. Edit _posts/#{File.basename(post_path)} — the body is Eventfrog's copy verbatim.")
say("     House style is WRITING_GUIDE.md (no em dashes). Check the `description:` too.")
say("  2. The /calendar/ Info line for this show falls back to a generic teaser until")
say("     its copy pool exists. Fill it with:")
say("        ruby script/refresh-calendar-page.rb --init --only #{permalink} --no-push")
unless bad_hosts.empty?
  say("  3. Unresolved host slug(s): #{bad_hosts.join(", ")}. Add them in Grist, run")
  say("        ruby script/sync-comedians.rb")
  say("     then add the slug to `hosts:` in the post by hand.")
end
say("  #{bad_hosts.empty? ? 3 : 4}. Verify, then commit:")
say("        bundle exec jekyll build --future && ruby script/check-site.rb --no-build")
say("        git add _posts _data assets/img pages/1_calendar.md index.html script/calendar-copy.json")
say("")
say("Optional: give the show its own palette in _sass/components/_show-override.scss")
say("          with a .show-banner[data-show=\"#{permalink}\"] block.")

exit 0

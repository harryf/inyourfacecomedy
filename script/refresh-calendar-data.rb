#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — cron defaults Ruby to US-ASCII, and venues.yml / posts hold
# non-ASCII bytes (Zürich, Español). See repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

#
# refresh-calendar-data.rb
#
# Builds _data/calendar.yml — the local, EventFrog-derived list of EVERY upcoming
# show instance — so the /calendar/ page can be generated accurately instead of
# hand-maintained.
#
# Why this exists separately from refresh-next-event-dates.rb:
#   - that script rolls each show's *next* date into its _posts front matter.
#   - this one captures *all* upcoming instances of *all* shows into one data file.
#
# How it works (EventFrog is now a client-rendered SPA, so the old `datecol`
# group-table scraping is dead — this uses the still-server-rendered pages):
#
#   1. For each _posts/*.md with an EventFrog `ticket_url`:
#   2. Resolve the URL (follow redirects, browser UA). EventFrog lands on either
#      a GROUP listing page (/p/{groups|gruppen|groupes}/…-{id}.html) or a single
#      INDIVIDUAL event page (/p/{category}/…-{id}.html with JSON-LD).
#   3. From a group page, collect every individual event page link.
#   4. Fetch each individual event page and parse its <script type=ld+json> Event
#      block: startDate, endDate, eventStatus, location, and first CHF price.
#   5. Keep future, non-cancelled events; attach the local show identity (slug,
#      title, on-site URL, venue) and write a sorted _data/calendar.yml.
#
# Non-EventFrog ticket URLs (eventbrite, etc.) are skipped on purpose.
# Ticket URLs that no longer resolve (dead vanity slugs) are recorded under
# `unresolved:` so they are visible, not silently dropped.
#
# Usage:
#   ruby script/refresh-calendar-data.rb              # fetch + write _data/calendar.yml
#   ruby script/refresh-calendar-data.rb --dry-run    # fetch + print, write nothing
#   ruby script/refresh-calendar-data.rb --verbose    # per-event detail
#   ruby script/refresh-calendar-data.rb --quiet       # errors + summary only

require "net/http"
require "uri"
require "time"
require "date"
require "json"
require "yaml"
require "optparse"

ROOT       = File.expand_path("..", __dir__)
POSTS_DIR  = File.join(ROOT, "_posts")
DATA_FILE  = File.join(ROOT, "_data", "calendar.yml")
PAST_FILE  = File.join(ROOT, "_data", "calendar_past.yml")
VENUES     = File.join(ROOT, "_data", "venues.yml")
# EventFrog group pages only list UPCOMING instances, so a show that has happened
# can't be re-fetched. We accumulate recent-past events from our own daily
# snapshots instead: every run, events that have rolled into the past are carried
# into calendar_past.yml (kept separate so calendar.yml stays lean). Consumed by
# the crowdwork tool's `thanks` workflow to find the just-finished show.
PAST_WINDOW_DAYS = 35
ZURICH_OFFSET = "+02:00"   # CEST. Off by 1h in winter; cosmetic — sorting/dates unaffected.
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " \
             "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
GROUP_PATH_RE = %r{/p/(?:groups|gruppen|groupes|groupes)/}i
# Individual EventFrog event page: /{lang}/p/{category}/…-{long-id}.html
EVENT_LINK_RE = %r{/[a-z]{2}/p/[a-z0-9-]+/[^"'<>]*-\d{10,}\.html}i

options = { dry_run: false, verbose: false, quiet: false }
OptionParser.new do |o|
  o.on("--dry-run") { options[:dry_run] = true }
  o.on("--verbose") { options[:verbose] = true }
  o.on("--quiet")   { options[:quiet]   = true }
end.parse!

def say(msg, options)  = (puts msg unless options[:quiet])
def vsay(msg, options) = (puts msg if options[:verbose] && !options[:quiet])

# ---------- HTTP ----------

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

# ---------- Front matter ----------

def front_matter(path)
  raw = File.read(path, encoding: "UTF-8")
  return {} unless raw.start_with?("---")
  fm = raw.split(/^---\s*$/, 3)[1]
  fm ? (YAML.safe_load(fm, permitted_classes: [Date, Time], aliases: true) || {}) : {}
rescue Psych::Exception
  {}
end

def venues
  @venues ||= (YAML.safe_load(File.read(VENUES)) || {} rescue {})
end

# ---------- Venue resolution (per-event, from EventFrog JSON-LD location) ----------
# Shows like La Tarima and Random Facts Exchange move venue per event, so the venue
# can't come from the post's static venue_slug — it's read from each event's
# schema.org Place. We map that Place back to a venues.yml slug (matching curated
# venues by name so "ROBIN's Coffee" → robins, "Amboss Rampe" → ambossrampe), and
# mint + queue a new slug for any venue we've never seen. Curated venues are never
# overwritten; new ones are appended with the address EventFrog gives us (website /
# google_maps_url left blank for a human to fill).

def new_venues = (@new_venues ||= {})

def alnum(s) = s.to_s.downcase.gsub(/[^a-z0-9]/, "")

CH_NAMES = %w[switzerland schweiz suisse svizzera ch].freeze
def normalize_country(c)
  CH_NAMES.include?(c.to_s.downcase.strip) ? "CH" : c.to_s.strip
end

def venue_slugify(name)
  name.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
end

def resolve_venue(loc_name, addr)
  return nil if loc_name.to_s.empty?
  key = alnum(loc_name)
  venues.merge(new_venues).each do |slug, v|
    s = slug.to_s.gsub(/[^a-z0-9]/, "")
    n = alnum(v && v["name"])
    return slug if (s.length >= 4 && key.include?(s)) ||
                   (n.length >= 4 && (key.include?(n) || n.include?(key)))
  end
  slug = venue_slugify(loc_name)
  return nil if slug.empty?
  new_venues[slug] = {
    "name"        => loc_name,
    "street"      => (addr && addr["street"].to_s.empty? ? nil : addr&.dig("street")),
    "postal_code" => (addr && addr["postal_code"].to_s.empty? ? nil : addr&.dig("postal_code")),
    "city"        => (addr && addr["city"].to_s.empty? ? nil : addr&.dig("city")),
    "country"     => (addr && normalize_country(addr["country"]).then { |c| c.empty? ? nil : c })
  }.compact
  slug
end

def venue_name_for(slug)
  v = venues[slug] || new_venues[slug]
  v && v["name"]
end

# Non-destructively append any newly-discovered venues to _data/venues.yml,
# preserving the existing curated file verbatim. Only slugs not already present
# are appended. Returns the slugs actually written.
def append_new_venues
  return [] if new_venues.empty?
  existing = File.read(VENUES)
  yq = ->(s) { '"' + s.to_s.gsub("\\", "\\\\").gsub('"', '\\"') + '"' }
  added = []
  blocks = new_venues.filter_map do |slug, v|
    next if existing =~ /^#{Regexp.escape(slug)}:\s*$/
    added << slug
    lines = ["", "#{slug}:", "  name: #{yq.call(v["name"])}"]
    lines << "  street: #{yq.call(v["street"])}"           if v["street"]
    lines << "  postal_code: #{yq.call(v["postal_code"])}" if v["postal_code"]
    lines << "  city: #{yq.call(v["city"])}"               if v["city"]
    lines << "  country: #{yq.call(v["country"])}"         if v["country"]
    lines << "  # website + google_maps_url: add by hand (not in EventFrog data)"
    lines.join("\n")
  end
  return [] if blocks.empty?
  File.write(VENUES, existing.rstrip + "\n" + blocks.join("\n") + "\n")
  added
end

# Every _posts show with a ticket_url → identity hash the calendar can link to.
def shows
  Dir[File.join(POSTS_DIR, "*.md")].sort.filter_map do |path|
    fm = front_matter(path)
    url = fm["ticket_url"].to_s
    next if url.empty?
    permalink = fm["permalink"].to_s
    slug = permalink.gsub(%r{^/|/$}, "")
    slug = File.basename(path, ".md").sub(/\A\d{4}-\d{2}-\d{2}-/, "") if slug.empty?
    {
      file: File.basename(path),
      slug: slug,
      title: fm["title"].to_s,
      name: short_name(fm["title"].to_s),
      url: permalink.empty? ? "/#{slug}/" : permalink,
      venue: fm["venue_slug"],
      ticket_url: url
    }
  end
end

# A human-short label for the calendar: the title up to the first separator.
def short_name(title)
  n = title.split(/\s[•|‣·]\s|\s[—–-]\s|:/).first.to_s.strip
  n.empty? ? title.strip : n
end

# ---------- EventFrog parsing ----------

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

# FIRST CHF price across schema.org offers (Offer | array | nil) → rounded int or nil.
# EventFrog lists offers in display order — the first CHF offer is the headline
# ticket type (e.g. "FREE SEATING"). We deliberately take the FIRST, not the
# cheapest: a `.min` would pick concession tiers like "Students" (CHF 5) or a
# "Flex" cancellation tier over the actual entry price (CHF 10). Order is
# preserved through JSON.parse → filter_map, so `.first` is the page's first price.
def first_chf_price(offers)
  list = offers.is_a?(Array) ? offers : [offers]
  prices = list.filter_map do |o|
    next unless o.is_a?(Hash) && o["priceCurrency"].to_s.upcase == "CHF"
    p = o["price"]
    Float(p) rescue nil
  end
  prices.empty? ? nil : prices.first.round
end

# Parse an EventFrog Event JSON-LD into a normalized instance hash, or nil if it
# has no valid start. Times are normalized to ISO-8601 with the Zurich offset.
def parse_event(ev, ticket_url)
  start_t = (Time.parse(ev["startDate"].to_s) rescue nil)
  return nil unless start_t
  end_t = (Time.parse(ev["endDate"].to_s) rescue nil)
  loc = ev["location"]
  loc = loc.first if loc.is_a?(Array)
  addr = loc.is_a?(Hash) ? loc["address"] : nil
  addr = addr.first if addr.is_a?(Array)
  {
    "start"     => start_t,
    "end"       => end_t,
    "status"    => ev["eventStatus"].to_s.split("/").last,   # e.g. EventScheduled
    "location"  => (loc.is_a?(Hash) ? loc["name"].to_s : nil),
    "address"   => (addr.is_a?(Hash) ? {
      "street"      => addr["streetAddress"].to_s,
      "city"        => addr["addressLocality"].to_s,
      "postal_code" => addr["postalCode"].to_s,
      "country"     => addr["addressCountry"].to_s
    } : nil),
    "price_chf" => first_chf_price(ev["offers"]),
    "eventfrog_name" => ev["name"].to_s,
    "ticket_url"     => ticket_url
  }
end

# Given a resolved ticket page, return the list of individual event URLs to parse.
# Classification is by CONTENT, not URL path: EventFrog serves a recurring show's
# group id under BOTH /p/groups/{id} and /p/{category}/{id}, and a vanity slug may
# land on (or get redirected to) the category path — but either way the page's body
# lists the upcoming instances. So:
#   - if the page links to sibling event pages → return those instances
#   - else (a true one-off) → return just the page itself
# The page's own {id} self-links are excluded. For a non-group landing page we keep
# only siblings sharing the landing page's slug stem, so an unrelated "more events"
# link can't pull a different show in.
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

# ---------- Per-show extraction ----------

# Returns [events_array, error_string_or_nil, final_url]. events may be empty (no
# future instances). A non-nil error means the show could not be resolved at all.
def extract_show(show, now, options)
  url = show[:ticket_url]
  unless url.include?("eventfrog")
    return [[], "skipped — not EventFrog (#{URI(url).host rescue url})", nil]
  end

  final_url, code, html = http_get(url)
  unless code == 200
    return [[], "unresolved — HTTP #{code} at #{final_url} (vanity slug dead? update ticket_url to the canonical /p/groups/ URL)", final_url]
  end

  event_urls = event_urls_from(final_url, html)
  return [[], "resolved but no event links found at #{final_url}", final_url] if event_urls.empty?
  vsay("    #{show[:slug]}: #{event_urls.size} candidate event page(s)", options)

  events = []
  event_urls.each do |ev_url|
    _f, ev_code, ev_html = http_get(ev_url)
    next unless ev_code == 200
    ev = event_jsonld(ev_html)
    next unless ev
    inst = parse_event(ev, ev_url)
    next unless inst && inst["start"] > now             # ISC-9 / ISC-18: future only
    next if inst["status"] == "EventCancelled"
    events << inst
  rescue => e
    vsay("      ! #{ev_url} — #{e.class}: #{e.message}", options)
  end

  [events, nil, final_url]
end

# ---------- Serialization ----------

def iso(t) = t.is_a?(Time) ? t.getlocal(ZURICH_OFFSET).strftime("%Y-%m-%dT%H:%M:%S%:z") : nil

def to_record(show, inst)
  vslug = resolve_venue(inst["location"], inst["address"]) || show[:venue]
  {
    "show"           => show[:slug],
    "name"           => show[:name],
    "title"          => show[:title],
    "url"            => show[:url],
    "date"           => inst["start"].getlocal(ZURICH_OFFSET).strftime("%Y-%m-%d"),
    "start"          => iso(inst["start"]),
    "end"            => iso(inst["end"]),
    "venue"          => vslug,
    "venue_name"     => (venue_name_for(vslug) || (show[:venue] && venues.dig(show[:venue], "name"))),
    "location"       => inst["location"],
    "price_chf"      => inst["price_chf"],
    "status"         => inst["status"],
    "ticket_url"     => inst["ticket_url"],
    "eventfrog_name" => inst["eventfrog_name"]
  }.compact
end

def build_yaml(records, unresolved, no_upcoming, now)
  header = <<~HDR
    # AUTO-GENERATED by script/refresh-calendar-data.rb — DO NOT EDIT BY HAND.
    # Source of truth: EventFrog. Regenerate: ruby script/refresh-calendar-data.rb
    # Consumed by the /calendar/ page as site.data.calendar.events.
    #   events:      upcoming shows, sorted ascending by start.
    #   unresolved:  ticket_urls that 404 — fix the post's ticket_url.
    #   no_upcoming: ticket_url resolved but found 0 future events (often a
    #                ticket_url pointing at one past event instead of the series).
  HDR
  doc = {
    "generated_at" => now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
    "event_count"  => records.size,
    "events"       => records,
    "unresolved"   => unresolved,
    "no_upcoming"  => no_upcoming
  }
  header + doc.to_yaml.sub(/\A---\n/, "")
end

# ---------- Past events (accumulated from snapshots) ----------

# Load the `events:` array out of a previously-written calendar*.yml, or [] if
# the file is absent/unreadable. `start`/`date` come back as quoted strings.
def load_records_from(file)
  return [] unless File.exist?(file)
  doc = YAML.safe_load(File.read(file, encoding: "UTF-8"),
                       permitted_classes: [Date, Time], aliases: true) || {}
  doc["events"] || []
rescue Psych::Exception
  []
end

# Pure: given this run's upcoming records and the union of prior snapshot records
# (yesterday's calendar.yml + calendar_past.yml), return the records whose start
# has passed but is still inside the window, newest-first, deduped by ticket_url.
def build_past_records(upcoming, prior, now, window_days)
  cutoff = now - (window_days * 86_400)
  by_url = {}
  (prior + upcoming).each { |r| by_url[r["ticket_url"]] = r }   # fresher wins
  by_url.values.select do |r|
    st = (Time.parse(r["start"].to_s) rescue nil)
    st && st <= now && st >= cutoff
  end.sort_by { |r| r["start"].to_s }.reverse
end

def build_past_yaml(records, now)
  header = <<~HDR
    # AUTO-GENERATED by script/refresh-calendar-data.rb — DO NOT EDIT BY HAND.
    # Recent PAST events, accumulated from daily snapshots (window: #{PAST_WINDOW_DAYS} days).
    # EventFrog group pages only list upcoming instances, so past shows can't be
    # re-fetched — they are carried here as they roll out of calendar.yml.
    # Consumed by the crowdwork tool's `thanks` workflow (most-recent-past show).
  HDR
  doc = {
    "generated_at" => now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
    "past_count"   => records.size,
    "events"       => records
  }
  header + doc.to_yaml.sub(/\A---\n/, "")
end

# ---------- Main ----------

now = Time.now
all_records = []
unresolved  = []
no_upcoming = []
errors = 0

say("Fetching upcoming shows from EventFrog…\n", options)

shows.each do |show|
  events, err, final_url = extract_show(show, now, options)
  if err && err.start_with?("unresolved")
    unresolved << { "show" => show[:slug], "ticket_url" => show[:ticket_url], "reason" => err.sub("unresolved — ", "") }
    say("  [UNRESOLVED] #{show[:slug]} — #{err}", options)
    next
  elsif err && err.start_with?("skipped")
    say("  [skip]       #{show[:slug]} — #{err}", options)
    next
  elsif err
    # Resolved but no event links — flag for attention, don't drop silently.
    no_upcoming << { "show" => show[:slug], "ticket_url" => show[:ticket_url], "resolved_to" => final_url, "reason" => err }
    say("  [no-upcoming] #{show[:slug]} — #{err}", options)
    next
  end

  if events.empty?
    no_upcoming << { "show" => show[:slug], "ticket_url" => show[:ticket_url], "resolved_to" => final_url,
                     "reason" => "resolved but 0 future events — ticket_url may point at one past event instead of the series" }
    say("  [no-upcoming] #{show[:slug]} — resolved (#{final_url}) but 0 future events", options)
    next
  end

  events.each { |inst| all_records << to_record(show, inst) }
  say("  [ok]         #{show[:slug]} — #{events.size} upcoming", options)
rescue => e
  errors += 1
  say("  [ERROR]      #{show[:slug]} — #{e.class}: #{e.message}", options)
end

# dedupe by ticket URL, sort ascending by start
all_records.uniq! { |r| r["ticket_url"] }
all_records.sort_by! { |r| r["start"].to_s }

say("", options)
say("#{all_records.size} upcoming event(s) across #{shows.size} show(s); " \
    "#{unresolved.size} unresolved; #{no_upcoming.size} with no upcoming; #{errors} error(s).", options)

yaml = build_yaml(all_records, unresolved, no_upcoming, now)

# Read prior snapshots BEFORE calendar.yml is overwritten, then roll passed
# events into calendar_past.yml.
prior_records = load_records_from(DATA_FILE) + load_records_from(PAST_FILE)
past_records  = build_past_records(all_records, prior_records, now, PAST_WINDOW_DAYS)
past_yaml     = build_past_yaml(past_records, now)

if options[:dry_run]
  say("\n--- would write #{DATA_FILE} ---", options)
  puts yaml unless options[:quiet]
  say("\n--- would write #{PAST_FILE} (#{past_records.size} past event(s), #{PAST_WINDOW_DAYS}d window) ---", options)
  puts past_yaml unless options[:quiet]
  unless new_venues.empty?
    missing = new_venues.reject { |slug, _| File.read(VENUES) =~ /^#{Regexp.escape(slug)}:\s*$/ }
    say("\n[would append #{missing.size} new venue(s) to _data/venues.yml]:", options)
    missing.each { |slug, v| say("  + #{slug}: #{v["name"]} (#{[v["street"], v["postal_code"], v["city"]].compact.join(", ")})", options) }
  end
else
  File.write(DATA_FILE, yaml)
  say("Wrote #{DATA_FILE}", options)
  File.write(PAST_FILE, past_yaml)
  say("Wrote #{PAST_FILE} (#{past_records.size} past event(s))", options)
  added = append_new_venues
  say("Added #{added.size} new venue(s) to _data/venues.yml: #{added.join(", ")}", options) unless added.empty?
end

exit(errors.zero? ? 0 : 1)

#!/usr/bin/env ruby
# frozen_string_literal: true
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
#      block: startDate, endDate, eventStatus, location, and lowest CHF price.
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
VENUES     = File.join(ROOT, "_data", "venues.yml")
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

# Lowest CHF price across schema.org offers (Offer | array | nil) → rounded int or nil.
def lowest_chf_price(offers)
  list = offers.is_a?(Array) ? offers : [offers]
  prices = list.filter_map do |o|
    next unless o.is_a?(Hash) && o["priceCurrency"].to_s.upcase == "CHF"
    p = o["price"]
    Float(p) rescue nil
  end
  prices.empty? ? nil : prices.min.round
end

# Parse an EventFrog Event JSON-LD into a normalized instance hash, or nil if it
# has no valid start. Times are normalized to ISO-8601 with the Zurich offset.
def parse_event(ev, ticket_url)
  start_t = (Time.parse(ev["startDate"].to_s) rescue nil)
  return nil unless start_t
  end_t = (Time.parse(ev["endDate"].to_s) rescue nil)
  loc = ev["location"]
  loc = loc.first if loc.is_a?(Array)
  {
    "start"     => start_t,
    "end"       => end_t,
    "status"    => ev["eventStatus"].to_s.split("/").last,   # e.g. EventScheduled
    "location"  => (loc.is_a?(Hash) ? loc["name"].to_s : nil),
    "price_chf" => lowest_chf_price(ev["offers"]),
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
  {
    "show"           => show[:slug],
    "name"           => show[:name],
    "title"          => show[:title],
    "url"            => show[:url],
    "date"           => inst["start"].getlocal(ZURICH_OFFSET).strftime("%Y-%m-%d"),
    "start"          => iso(inst["start"]),
    "end"            => iso(inst["end"]),
    "venue"          => show[:venue],
    "venue_name"     => (show[:venue] && venues.dig(show[:venue], "name")),
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

if options[:dry_run]
  say("\n--- would write #{DATA_FILE} ---", options)
  puts yaml unless options[:quiet]
else
  File.write(DATA_FILE, yaml)
  say("Wrote #{DATA_FILE}", options)
end

exit(errors.zero? ? 0 : 1)

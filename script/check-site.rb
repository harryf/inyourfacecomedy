#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads — cron/CI may default Ruby to US-ASCII, and the pages, posts,
# and built HTML hold non-ASCII bytes (Zürich, Español, "•", emoji). See CLAUDE.md.
Encoding.default_external = Encoding::UTF_8

# check-site.rb — post-build health smoke test for inyourfacecomedy.ch
#
# One command to assert the invariants that keep the site working as its surface
# area grows: build integrity, every show + comedian page present, sitemap
# correctness, SEO/analytics tags, Event JSON-LD, the /comedians/ promo feature,
# the Lineup Maker 2000, script + data health, date staleness, and (via
# html-proofer) internal link + image integrity.
#
# Usage:
#   ruby script/check-site.rb              # build, then run all checks
#   ruby script/check-site.rb --no-build   # check the existing _site/ as-is
#   ruby script/check-site.rb --no-proofer # skip the html-proofer pass (faster)
#
# Exit 0 = all checks passed. Exit 1 = at least one failure.
#
# Sources of truth are DERIVED, never hardcoded:
#   shows     = _posts/*.md whose front-matter has a ticket_url
#   comedians = _comedians/*.md (slug from front-matter, fallback to filename)
# so adding a show or comedian needs no edit here — the harness expands itself.

require "json"
require "yaml"
require "date"
require "rexml/document"
require "open3"

ROOT  = File.expand_path("..", __dir__)
SITE  = File.join(ROOT, "_site")
POSTS = File.join(ROOT, "_posts")
COMS  = File.join(ROOT, "_comedians")

NO_BUILD   = ARGV.include?("--no-build")
NO_PROOFER = ARGV.include?("--no-proofer")

# ── tiny test harness ──────────────────────────────────────────────────────
$pass = 0
$fail = 0
$failed_names = []

def check(name)
  ok, detail =
    begin
      yield
    rescue => e
      [false, "raised #{e.class}: #{e.message}"]
    end
  if ok
    $pass += 1
    puts "  \e[32mPASS\e[0m  #{name}"
  else
    $fail += 1
    $failed_names << name
    puts "  \e[31mFAIL\e[0m  #{name}#{detail ? " — #{detail}" : ""}"
  end
end

def section(title)
  puts "\n\e[1m#{title}\e[0m"
end

# ── helpers ────────────────────────────────────────────────────────────────

# Front-matter (YAML between the first two `---` lines) of a markdown file.
def front_matter(path)
  raw = File.read(path)
  return {} unless raw.start_with?("---")

  fm = raw.split(/^---\s*$/, 3)[1]
  return {} unless fm

  YAML.safe_load(fm, permitted_classes: [Date, Time], aliases: true) || {}
rescue Psych::Exception
  {}
end

# Every _posts entry with a ticket_url → {file, fm, dir}. dir is the built output
# directory derived from the post's permalink front-matter.
def shows
  @shows ||= Dir[File.join(POSTS, "*.md")].filter_map do |f|
    fm = front_matter(f)
    next unless fm["ticket_url"] && !fm["ticket_url"].to_s.empty?

    permalink = fm["permalink"].to_s
    dir = permalink.empty? ? nil : permalink.gsub(%r{^/|/$}, "")
    { file: f, fm: fm, dir: dir, permalink: permalink }
  end
end

# Jekyll's default slugify: lowercase, every non-alphanumeric run → single "-",
# trim leading/trailing "-". This is what the `:name` permalink placeholder applies,
# so the built dir for `slug: "harryf.cks"` is `/comedians/harryf-cks/`.
def jekyll_slugify(str)
  str.to_s.downcase.gsub(/[^a-z0-9]+/, "-").gsub(/\A-+|-+\z/, "")
end

# Every comedian → built-page slug (front-matter slug, fallback to filename),
# slugified the way Jekyll's permalink does it.
def comedian_slugs
  @comedian_slugs ||= Dir[File.join(COMS, "*.md")].map do |f|
    slug = front_matter(f)["slug"].to_s
    jekyll_slugify(slug.empty? ? File.basename(f, ".md") : slug)
  end
end

def read_site(rel)
  File.read(File.join(SITE, rel))
end

# All <script type="application/ld+json"> payloads parsed as JSON, in an HTML string.
def ld_json_blocks(html)
  html.scan(%r{<script[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>}m)
      .filter_map { |m| JSON.parse(m[0]) rescue nil }
end

# Find the Event object inside a parsed ld+json doc (handles bare object,
# @graph arrays, and arrays of objects).
def find_event(blocks)
  blocks.each do |b|
    candidates = b.is_a?(Array) ? b : (b["@graph"] || [b])
    candidates = [candidates] unless candidates.is_a?(Array)
    ev = candidates.find { |o| o.is_a?(Hash) && o["@type"].to_s == "Event" }
    return ev if ev
  end
  nil
end

# Extract a <script type="application/json" id="..."> payload as parsed JSON.
def inline_json(html, id)
  m = html.match(%r{<script[^>]*id=["']#{Regexp.escape(id)}["'][^>]*>(.*?)</script>}m)
  m && JSON.parse(m[1])
end

def sitemap_text
  @sitemap_text ||= read_site("sitemap.xml")
end

# ── build ──────────────────────────────────────────────────────────────────
section "Build"
if NO_BUILD
  puts "  (skipped — checking existing _site/)"
  check("_site/ exists") { [Dir.exist?(SITE), "run a build first or drop --no-build"] }
else
  out, status = Open3.capture2e("bundle", "exec", "jekyll", "build", "--quiet", chdir: ROOT)
  check("jekyll build exits 0") { [status.success?, status.success? ? nil : out.lines.last(8).join.strip] }
  check("build is clean (no Liquid/template errors)") do
    # Sass @import / slash-div DEPRECATION warnings are pre-existing theme debt — they
    # don't change the generated HTML, so they're not a build-output failure. Flag only
    # genuine Liquid/Jekyll errors that mean a page rendered wrong or a layout is missing.
    issues = out.lines.grep(/liquid (exception|warning|error|syntax)|build warning|conversion error|requested .* (does not|doesn't) exist/i)
    [issues.empty?, issues.first&.strip]
  end
end

# ── page presence ─────────────────────────────────────────────────────────
section "Page presence"
%w[index.html calendar/index.html comedians/index.html follow/index.html
   perform/index.html host/index.html switzerland/index.html 404.html].each do |p|
  check("page exists: #{p}") { [File.exist?(File.join(SITE, p)), "missing"] }
end

check("every show with a ticket_url has a built page") do
  missing = shows.reject { |s| s[:dir] && File.exist?(File.join(SITE, s[:dir], "index.html")) }
  [missing.empty?, missing.map { |s| File.basename(s[:file]) }.join(", ")]
end

check("every comedian has a built page") do
  missing = comedian_slugs.reject { |slug| File.exist?(File.join(SITE, "comedians", slug, "index.html")) }
  [missing.empty?, "missing: #{missing.join(", ")}"]
end

check("Lineup Maker 2000 page exists (/lineup/)") do
  [File.exist?(File.join(SITE, "lineup/index.html")), "missing"]
end

# ── sitemap ─────────────────────────────────────────────────────────────────
section "Sitemap"
check("sitemap.xml exists and is well-formed XML") do
  REXML::Document.new(sitemap_text)
  [true, nil]
end
check("sitemap lists /comedians/") { [sitemap_text.include?("/comedians/</loc>") || sitemap_text.include?("/comedians/<"), nil] }
check("sitemap lists every show page") do
  missing = shows.select { |s| s[:dir] }.reject { |s| sitemap_text.include?("/#{s[:dir]}/") }
  [missing.empty?, missing.map { |s| s[:dir] }.join(", ")]
end
check("sitemap lists every comedian page") do
  missing = comedian_slugs.reject { |slug| sitemap_text.include?("/comedians/#{slug}/") }
  [missing.empty?, "missing: #{missing.join(", ")}"]
end
check("Anti: sitemap does NOT list /lineup/") { [!sitemap_text.include?("/lineup/"), "leaked into sitemap"] }
check("Anti: sitemap does NOT list ski-resort-comedy-tour") { [!sitemap_text.include?("ski-resort"), "leaked into sitemap"] }

# ── SEO / analytics / robots ─────────────────────────────────────────────────
section "SEO / analytics / robots"
home = read_site("index.html")
check("robots.txt exists with Sitemap + Disallows") do
  r = read_site("robots.txt")
  [r.include?("Sitemap:") && r.include?("/lineup/") && r.include?("ski-resort"), r.gsub("\n", " ")]
end
check("homepage has GA tag G-JZBDD4CQWV")        { [home.include?("G-JZBDD4CQWV"), "missing GA"] }
check("homepage has GTM container GTM-M7Z9D4Z")  { [home.include?("GTM-M7Z9D4Z"), "missing GTM"] }
check("homepage has Clarity id qbtk7v2ls4")      { [home.include?("qbtk7v2ls4"), "missing Clarity"] }
check("homepage has Meta Pixel 5349931195130820"){ [home.include?("5349931195130820"), "missing Pixel"] }
check("homepage emits Organization JSON-LD with sameAs") do
  org = ld_json_blocks(home).flat_map { |b| b.is_a?(Array) ? b : (b["@graph"] || [b]) }
                            .find { |o| o.is_a?(Hash) && o["@type"].to_s == "Organization" }
  [org && org.key?("sameAs"), org ? "no sameAs" : "no Organization block"]
end
check("IndexNow key file lands in _site (and the stale key is gone)") do
  valid = "4b04fa2d03884c6794d4ece40fb41a29.txt"
  stale = "4428d17dabee4ceb92c215e99a3dec6e.txt"
  present = File.exist?(File.join(SITE, valid))
  stale_gone = !File.exist?(File.join(SITE, stale))
  msg = []
  msg << "missing #{valid}" unless present
  msg << "stale key #{stale} still present" unless stale_gone
  [present && stale_gone, msg.join("; ")]
end
check("Anti: ski page carries noindex robots meta") do
  ski = read_site("ski-resort-comedy-tour.html")
  [ski =~ /name=["']robots["']\s+content=["']noindex/i ? true : false, "no noindex meta"]
end

# ── catastrophic-failure guards ───────────────────────────────────────────────
# The mirror of the positive checks above: a single bad layout default could
# deindex the whole site or block crawlers while every positive check stays green.
section "Catastrophic-failure guards"
check("Anti: no money page carries noindex (homepage / shows / comedians / core)") do
  money = %w[index.html comedians/index.html calendar/index.html]
  money += shows.select { |s| s[:dir] }.map { |s| File.join(s[:dir], "index.html") }
  money += comedian_slugs.map { |slug| File.join("comedians", slug, "index.html") }
  bad = money.select do |p|
    f = File.join(SITE, p)
    File.exist?(f) && File.read(f) =~ /name=["']robots["'][^>]*content=["'][^"']*noindex/i
  end
  [bad.empty?, "NOINDEXED: #{bad.first(5).join(", ")}#{bad.size > 5 ? " (+#{bad.size - 5} more)" : ""}"]
end
check("Anti: robots.txt has no site-wide 'Disallow: /'") do
  r = read_site("robots.txt")
  [r !~ %r{^\s*Disallow:\s*/\s*$}, "GLOBAL DISALLOW present — whole site blocked from crawlers"]
end
check("homepage has canonical + og:title + og:image") do
  miss = %w[rel="canonical" property="og:title" property="og:image"].reject { |t| home.include?(t) }
  [miss.empty?, "missing: #{miss.join(", ")}"]
end
check("a show page has canonical + og:title + og:image") do
  s = shows.find { |x| x[:dir] }
  h = s ? read_site(File.join(s[:dir], "index.html")) : ""
  miss = %w[rel="canonical" property="og:title" property="og:image"].reject { |t| h.include?(t) }
  [miss.empty?, "missing on #{s && s[:dir]}: #{miss.join(", ")}"]
end
check("every show has a well-formed https ticket_url that renders into its page") do
  bad = shows.filter_map do |s|
    url = s[:fm]["ticket_url"].to_s
    name = File.basename(s[:file])
    next "#{name} (empty/non-https)" unless url =~ %r{\Ahttps://\S+\z}

    page = s[:dir] && (read_site(File.join(s[:dir], "index.html")) rescue nil)
    page&.include?(url) ? nil : "#{name} (not rendered into page)"
  end
  [bad.empty?, bad.join(", ")]
end

# ── Event JSON-LD ─────────────────────────────────────────────────────────────
section "Event JSON-LD (rich results)"
check("all show pages: every ld+json block is valid JSON") do
  bad = shows.select { |s| s[:dir] }.flat_map do |s|
    h = (read_site(File.join(s[:dir], "index.html")) rescue "")
    h.scan(%r{<script[^>]*application/ld\+json[^>]*>(.*?)</script>}m).map { |m| [s[:dir], m[0]] }
  end.reject { |(_d, b)| (JSON.parse(b); true) rescue false }
  [bad.empty?, "invalid ld+json on: #{bad.map(&:first).uniq.join(", ")}"]
end
check("all active shows: Event startDate parses as ISO-8601") do
  bad = shows.select { |s| s[:dir] }.filter_map do |s|
    h = (read_site(File.join(s[:dir], "index.html")) rescue nil)
    ev = h && find_event(ld_json_blocks(h))
    next unless ev

    (DateTime.iso8601(ev["startDate"].to_s); nil) rescue "#{s[:dir]} (#{ev["startDate"].inspect})"
  end
  [bad.empty?, bad.join(", ")]
end
shows.select { |s| s[:dir] }.each do |s|
  name = s[:dir]
  html = (read_site(File.join(name, "index.html")) rescue nil)
  ev   = html && find_event(ld_json_blocks(html))
  check("#{name}: emits Event JSON-LD")        { [!ev.nil?, "no Event block"] }
  next unless ev

  check("#{name}: Event has startDate")        { [!ev["startDate"].to_s.empty?, "no startDate"] }
  check("#{name}: Event has offers")           { [!(ev["offers"].nil?), "no offers"] }
  if s[:fm]["venue_slug"] && !s[:fm]["venue_slug"].to_s.empty?
    check("#{name}: Event has location (has venue)") { [!(ev["location"].nil?), "venue set but no location"] }
  end
end

# ── /comedians/ show-promo feature ────────────────────────────────────────────
section "Show-promo feature (/comedians/)"
com_html = read_site("comedians/index.html")
check("/comedians/ contains #iyf-shows catalog") { [com_html.include?('id="iyf-shows"'), "missing catalog"] }
check("/comedians/ #iyf-shows is valid JSON, one entry per show") do
  data = inline_json(com_html, "iyf-shows")
  [data.is_a?(Array) && data.length == shows.length, "got #{data&.length.inspect} vs #{shows.length} shows"]
end
check("comedian-lineup.js asset present") { [File.exist?(File.join(SITE, "assets/js/comedian-lineup.js")), "missing"] }

# ── Lineup Maker 2000 ─────────────────────────────────────────────────────────
section "Lineup Maker 2000"
lin_html = read_site("lineup/index.html")
check("/lineup/ contains #iyf-shows + #iyf-comedians") do
  [lin_html.include?('id="iyf-shows"') && lin_html.include?('id="iyf-comedians"'), "missing a catalog"]
end
check("/lineup/ #iyf-shows is valid JSON") { [inline_json(lin_html, "iyf-shows").is_a?(Array), "bad JSON"] }
check("/lineup/ #iyf-comedians valid JSON, count == roster") do
  data = inline_json(lin_html, "iyf-comedians")
  [data.is_a?(Array) && data.length == comedian_slugs.length, "got #{data&.length.inspect} vs #{comedian_slugs.length}"]
end
check("lineup-maker-2000.js asset present") { [File.exist?(File.join(SITE, "assets/js/lineup-maker-2000.js")), "missing"] }
check("Anti: /lineup/ carries noindex robots meta") do
  [lin_html =~ /name=["']robots["']\s+content=["']noindex/i ? true : false, "no noindex meta"]
end

# ── script + data health ──────────────────────────────────────────────────────
section "Script + data health"
%w[sync-comedians.rb refresh-next-event-dates.rb validate-calendar.rb refresh-calendar-data.rb].each do |s|
  check("ruby -c clean: #{s}") do
    out, st = Open3.capture2e("ruby", "-c", File.join(ROOT, "script", s))
    [st.success?, out.strip]
  end
end
check("comedians-state.json is valid JSON") do
  JSON.parse(File.read(File.join(ROOT, "script", "comedians-state.json")))
  [true, nil]
end

# ── data integrity / staleness ────────────────────────────────────────────────
section "Data integrity"
check("no active show advertises a past next_event_date (cron health)") do
  today = Date.today
  stale = shows.filter_map do |s|
    d = s[:fm]["next_event_date"]
    next unless d

    date = (d.respond_to?(:to_date) ? d.to_date : Date.parse(d.to_s)) rescue nil
    (date && date < today) ? "#{File.basename(s[:file])} (#{date})" : nil
  end
  [stale.empty?, "stale: #{stale.join(", ")}"]
end

# _data/calendar.yml is the EventFrog-derived list of upcoming shows the /calendar/
# page builds from (script/refresh-calendar-data.rb writes it). We validate the
# COMMITTED artifact here — we do NOT fetch from EventFrog (network + side effects
# don't belong in a health check; the cron that regenerates it does the fetching).
CALENDAR_DATA = File.join(ROOT, "_data", "calendar.yml")
cal = (YAML.safe_load(File.read(CALENDAR_DATA), permitted_classes: [Date, Time], aliases: true) rescue nil) if File.exist?(CALENDAR_DATA)
cal_events = cal.is_a?(Hash) && cal["events"].is_a?(Array) ? cal["events"] : []

check("_data/calendar.yml is valid YAML with upcoming events") do
  [cal.is_a?(Hash) && !cal_events.empty?,
   File.exist?(CALENDAR_DATA) ? "bad shape / no events — run script/refresh-calendar-data.rb" : "missing — run script/refresh-calendar-data.rb"]
end
check("_data/calendar.yml: event_count matches events length") do
  [cal && cal["event_count"] == cal_events.length, "count=#{cal && cal["event_count"]} vs #{cal_events.length}"]
end
check("_data/calendar.yml: every event has an EventFrog individual (non-group) ticket link") do
  bad = cal_events.reject do |e|
    u = e["ticket_url"].to_s
    u.include?("eventfrog") && u !~ %r{/p/(?:groups|gruppen|groupes)/}
  end
  [bad.empty?, bad.first(3).map { |e| "#{e["show"]} → #{e["ticket_url"]}" }.join(", ")]
end
check("_data/calendar.yml: events sorted ascending by start") do
  starts = cal_events.map { |e| e["start"].to_s }
  [starts == starts.sort, "out of order"]
end
check("_data/calendar.yml: no past-dated events (refresh cron health)") do
  today = Date.today
  past = cal_events.select { |e| (Date.parse(e["date"].to_s) < today rescue false) }
  [past.empty?, "stale: #{past.first(3).map { |e| "#{e["show"]} #{e["date"]}" }.join(", ")} — re-run script/refresh-calendar-data.rb"]
end

# ── calendar structure ──────────────────────────────────────────────────────
# The /calendar/ page's CSS and "Jump to Next Show" JS are coupled to the exact
# markdown structure of pages/1_calendar.md (column order, wrapper divs, heading
# markup, date string format). validate-calendar.rb enforces that contract —
# see CALENDAR_STRUCTURE.md. Source-level, so it runs even with --no-build.
# Its rule 12 is advisory (warning, exit 0), so it won't fail this harness.
section "Calendar structure"
check("pages/1_calendar.md passes validate-calendar.rb") do
  out, st = Open3.capture2e("ruby", File.join(ROOT, "script", "validate-calendar.rb"),
                            "--no-color", "--quiet", chdir: ROOT)
  detail = out.lines.grep(/(^\s*•)|FAIL/).first(6).join(" ").gsub(/\s+/, " ").strip
  [st.success?, st.success? ? nil : (detail.empty? ? out.strip[0, 200] : detail)]
end

# ── html-proofer ──────────────────────────────────────────────────────────────
section "Link + image integrity (html-proofer)"
if NO_PROOFER
  puts "  (skipped — --no-proofer)"
else
  check("html-proofer: internal links + image refs resolve") do
    # --disable-external: don't hit the network. Ignore the third-party analytics/
    # tracking endpoints (their pixel/script markup is theirs, not ours to lint).
    # What remains is real: broken INTERNAL links, missing local images, bad <img>/<script>.
    cmd = ["bundle", "exec", "htmlproofer", SITE,
           "--disable-external",
           "--allow-missing-href",
           "--ignore-empty-alt",
           "--no-enforce-https",
           "--ignore-urls",
           '/facebook\.com/,/googletagmanager\.com/,/google-analytics\.com/,/clarity\.ms/,/connect\.facebook\.net/']
    out, st = Open3.capture2e(*cmd, chdir: ROOT)
    detail = out.lines.grep(/^\s*\*|does not exist|protocol-relative|no src/i).first(8).join(" ").gsub(/\s+/, " ").strip
    [st.success?, st.success? ? nil : detail]
  end
end

# ── summary ───────────────────────────────────────────────────────────────────
total = $pass + $fail
puts "\n" + ("─" * 60)
if $fail.zero?
  puts "\e[32m✓ #{$pass}/#{total} checks passed — site is healthy.\e[0m"
  exit 0
else
  puts "\e[31m✗ #{$fail}/#{total} checks FAILED:\e[0m"
  $failed_names.each { |n| puts "    - #{n}" }
  exit 1
end

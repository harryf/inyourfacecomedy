#!/usr/bin/env ruby
# frozen_string_literal: true

# Force UTF-8 reads. cron starts Ruby with Encoding.default_external = US-ASCII
# (no LANG/LC_ALL), and this script reads files full of non-ASCII bytes — Zürich,
# Español, emoji, "—", "•". Without this, the first regex/YAML op against that
# text raises Encoding::CompatibilityError at 3am even though it works in a UTF-8
# terminal. See ./README.md and the repo CLAUDE.md "Rules that bite".
Encoding.default_external = Encoding::UTF_8

# refresh-calendar-page.rb
#
# Regenerates the month blocks of pages/2_calendar.md from _data/calendar.yml so
# the public /calendar/ page is a pure projection of the EventFrog-derived data
# instead of hand-maintained markdown. Run weekly from cron.
#
# COPY IS POOLED, NOT GENERATED ON THE FLY. The calendar should feel fresh: the
# same recurring show (Comedy Brew runs ~52×/year) must get a DIFFERENT Info line
# each time it appears, and each month needs its own flavor sentence. To make that
# possible WITHOUT calling an LLM every week, copy lives in a pre-generated pool:
#
#   script/calendar-copy.json
#   {
#     "month_flavor": {
#       "pool":     { "06": ["June line A", "June line B", ...], "12": [...] },
#       "assigned": { "2026-06": "June line A" }
#     },
#     "show_info": {
#       "comedybrew": {
#         "pool":     ["funny line 1 🎤", "funny line 2 🍺", ... up to ~30],
#         "assigned": { "2026-06-04": "funny line 1 🎤", "2026-06-11": "funny line 2 🍺" }
#       }
#     }
#   }
#
#   - `pool`     = the permanent, hand-editable set of distinct lines. Grows on --init.
#   - `assigned` = which line each visible date currently shows. Stable run-to-run
#                  (no flicker, respects manual edits), pruned when a date passes —
#                  which frees its pool line for reuse, so the pool is self-sustaining.
#
# TWO MODES:
#   --init  : call `claude` ONCE to (re)fill the pools from each show's page
#             description (and one batch of seasonal variants per month), then build.
#             This is the only mode that ever runs an LLM.
#   default : NO LLM. Assign each visible occurrence a distinct unused pool line,
#             rebuild the page, validate, commit + push.
#
# On a show or month with an empty/too-small pool the script WARNS ("run --init")
# and falls back / rotates — it never calls `claude` outside --init.
#
# The page front matter, intro prose, and closing CTA + <script> tail are preserved
# verbatim; only the month region between them is rewritten. After writing, the page
# is validated with script/validate-calendar.rb (which enforces CALENDAR_STRUCTURE.md
# section 11); a failure reverts the page and exits non-zero. _data/calendar.yml is
# already future-only, so past events and emptied months simply don't reappear.
#
# `claude` (only under --init) is invoked exactly like PAI's Inference.ts:
# subscription OAuth (ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN deleted from the
# child env), no tools, empty system prompt, never --bare. Set CLAUDE_BIN to
# override the binary and --model to change the model.
#
# Usage:
#   ruby script/refresh-calendar-page.rb                 # weekly: no LLM, assign + build + push
#   ruby script/refresh-calendar-page.rb --init          # fill copy pools via claude, then build + push
#   ruby script/refresh-calendar-page.rb --no-push       # build + validate, no git
#   ruby script/refresh-calendar-page.rb --dry-run       # preview only, no writes / no claude / no git
#   ruby script/refresh-calendar-page.rb --no-refresh    # don't re-scrape EventFrog first
#   ruby script/refresh-calendar-page.rb --init --pool-size 40 --month-variants 6
#
# Stdlib only, matching the rest of script/ — no bundler, no gems.

require "json"
require "open3"
require "optparse"
require "time"
require "timeout"
require "yaml"

ROOT        = File.expand_path("..", __dir__)
SCRIPT_DIR  = __dir__
PAGE        = File.join(ROOT, "pages", "2_calendar.md")
CALENDAR    = File.join(ROOT, "_data", "calendar.yml")
EXTRACTOR   = File.join(SCRIPT_DIR, "refresh-calendar-data.rb")
VALIDATOR   = File.join(SCRIPT_DIR, "validate-calendar.rb")
CACHE_FILE  = File.join(SCRIPT_DIR, "calendar-copy.json")
POSTS_DIR   = File.join(ROOT, "_posts")
SITE_URL    = "https://inyourfacecomedy.ch"

# Fixed English names — NEVER rely on strftime locale, which is C/ASCII under cron.
MONTHS_FULL = %w[January February March April May June
                 July August September October November December].freeze
MONTHS_ABBR = %w[Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec].freeze
DOW_ABBR    = %w[Sun Mon Tue Wed Thu Fri Sat].freeze

# Mirror assets/js/jump-to-next-show.js + script/validate-calendar.rb.
HEADING_RE  = /\b(#{MONTHS_FULL.join("|")})\s+(\d{4})\b/i
ROW_DATE_RE = /\A(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\z/i

FALLBACK_INFO = "English stand-up comedy you won't want to miss 🎤"
def fallback_flavor(month_name, year) = "Live English stand-up comedy in Zürich — #{month_name} #{year}."

options = { init: false, dry_run: false, no_push: false, no_refresh: false, verbose: false,
            pool_size: (ENV["CALENDAR_POOL_SIZE"] || 30).to_i,
            month_variants: (ENV["CALENDAR_MONTH_VARIANTS"] || 4).to_i,
            model: ENV["CALENDAR_CLAUDE_MODEL"] || "claude-sonnet-4-6" }
OptionParser.new do |o|
  o.on("--init")               { options[:init]           = true }
  o.on("--dry-run")            { options[:dry_run]        = true }
  o.on("--no-push")            { options[:no_push]        = true }
  o.on("--no-refresh")         { options[:no_refresh]     = true }
  o.on("--verbose")            { options[:verbose]        = true }
  o.on("--pool-size N", Integer)      { |n| options[:pool_size]      = n }
  o.on("--month-variants K", Integer) { |k| options[:month_variants] = k }
  o.on("--model MODEL")        { |m| options[:model]      = m }
end.parse!

def say(msg)  = puts(msg)
def vsay(msg, options) = (puts msg if options[:verbose])

# ---------- small helpers ----------

# Sanitize copy so it can never break the 5-cell pipe table: no "|", no newlines.
def one_line(text)
  text.to_s.gsub(/[|\r\n]+/, " ").gsub(/\s+/, " ").strip
end

def split_cells(line)
  s = line.strip
  s = s[1..] if s.start_with?("|")
  s = s[0..-2] if s.end_with?("|")
  s.split("|").map(&:strip)
end

def month_key(year, month) = format("%04d-%02d", year, month)
def date_key(t)            = format("%04d-%02d-%02d", t.year, t.month, t.day)

# ---------- step 1: refresh _data/calendar.yml ----------

def regenerate_calendar_data!(options)
  cmd = ["ruby", EXTRACTOR]
  cmd << "--quiet" unless options[:verbose]
  out, status = Open3.capture2e(*cmd, chdir: ROOT)
  puts out if options[:verbose]
  return if status.success?

  raise "refresh-calendar-data.rb failed (exit #{status.exitstatus}):\n#{out.lines.last(12).join}"
end

# ---------- load events + show metadata ----------

def load_events
  doc = YAML.safe_load(File.read(CALENDAR), permitted_classes: [Date, Time], aliases: true) || {}
  Array(doc["events"]).map do |e|
    {
      show:       e["show"].to_s,
      name:       e["name"].to_s,
      url:        e["url"].to_s,
      start:      (Time.iso8601(e["start"].to_s) rescue nil),
      ticket_url: e["ticket_url"].to_s
    }
  end.select { |e| e[:start] && !e[:show].empty? }.sort_by { |e| e[:start] }
end

# slug => {title, description, about} for the Info prompt, built from the show's
# _posts page. A "show" is any post with a ticket_url (the repo's own definition).
def show_descriptions
  @show_descriptions ||= Dir[File.join(POSTS_DIR, "*.md")].each_with_object({}) do |path, h|
    raw = File.read(path, encoding: "UTF-8")
    next unless raw.start_with?("---")
    parts = raw.split(/^---\s*$/, 3)
    front = (YAML.safe_load(parts[1].to_s, permitted_classes: [Date, Time], aliases: true) rescue nil)
    next unless front.is_a?(Hash) && front["ticket_url"]
    slug = front["permalink"].to_s.gsub(%r{^/|/$}, "")
    slug = File.basename(path, ".md").sub(/\A\d{4}-\d{2}-\d{2}-/, "") if slug.empty?
    next if slug.empty?
    body = parts[2].to_s
                  .gsub(/!\[.*?\]\(.*?\)/, " ")     # drop images
                  .gsub(/\[(.*?)\]\(.*?\)/, '\1')   # links → text
                  .gsub(/[#*_>`]/, " ")             # markdown punctuation
                  .gsub(/\s+/, " ").strip
    hosts = Array(front["hosts"]).map { |s| s.to_s.split("-").map(&:capitalize).join(" ") }
    h[slug] = { "title" => front["title"].to_s, "description" => front["description"].to_s,
                "host" => hosts.join(", "), "about" => body[0, 800] }
  end
end

# ---------- page split: [intro, outro] ----------

def split_page(raw)
  raise "calendar page has no YAML front matter: #{PAGE}" unless raw.start_with?("---\n")
  head_idx = raw.index(%(<h2 class="iyf-month-heading"))
  raise "no <h2 class=\"iyf-month-heading\"> found in #{PAGE}" unless head_idx
  last_div = raw.rindex("</div>")
  raise "no closing </div> found in #{PAGE}" unless last_div
  [raw[0...head_idx], raw[(last_div + "</div>".length)..]]
end

def bump_last_modified(text, now)
  stamp = now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")
  text.sub(/^last_modified_at:.*$/, "last_modified_at: #{stamp}")
end

# ---------- cache (copy pools) ----------

def blank_cache
  { "month_flavor" => { "pool" => {}, "assigned" => {} },
    "show_info"    => {} }
end

def load_cache
  return blank_cache unless File.exist?(CACHE_FILE)
  doc = (JSON.parse(File.read(CACHE_FILE)) rescue nil)
  return blank_cache unless doc.is_a?(Hash)
  mf = doc["month_flavor"].is_a?(Hash) ? doc["month_flavor"] : {}
  cache = blank_cache
  cache["month_flavor"]["pool"]     = mf["pool"].is_a?(Hash) ? mf["pool"] : {}
  cache["month_flavor"]["assigned"] = mf["assigned"].is_a?(Hash) ? mf["assigned"] : {}
  si = doc["show_info"].is_a?(Hash) ? doc["show_info"] : {}
  si.each do |slug, v|
    next unless v.is_a?(Hash)            # ignore the old flat "slug => string" shape
    cache["show_info"][slug] = {
      "pool"     => Array(v["pool"]).map { |s| one_line(s) }.reject(&:empty?).uniq,
      "assigned" => (v["assigned"].is_a?(Hash) ? v["assigned"] : {})
    }
  end
  cache
end

def save_cache(cache)
  # stable, human-friendly ordering
  out = {
    "month_flavor" => {
      "pool"     => cache["month_flavor"]["pool"].sort.to_h,
      "assigned" => cache["month_flavor"]["assigned"].sort.to_h
    },
    "show_info" => cache["show_info"].sort.to_h.transform_values do |v|
      { "pool" => v["pool"], "assigned" => v["assigned"].sort.to_h }
    end
  }
  File.write(CACHE_FILE, JSON.pretty_generate(out) + "\n")
end

# Seed MONTH-FLAVOR copy from the hand-written headings already on the page, so the
# existing (location-free) month lines carry over. Show Info is deliberately NOT
# seeded from the page: those hand-written lines name venues/cities (e.g. La Tarima's
# "…in Basel"), which is exactly what we must NOT do — the venue moves, so a Basel
# line lands on a Zürich ticket. Info pools come only from --init's venue-free prompt.
def seed_month_flavor_from_page(raw, cache)
  cur_year = nil
  cur_month = nil
  raw.each_line do |line|
    if (m = line.match(%r{<h2 class="iyf-month-heading">\s*(.*?)\s*</h2>}))
      if (hm = m[1].match(HEADING_RE))
        idx = MONTHS_FULL.index { |n| n.casecmp?(hm[1]) }
        cur_month = idx ? idx + 1 : nil
        cur_year  = hm[2].to_i
      end
      next
    end
    next unless (fm = line.match(%r{<p class="iyf-month-flavor">\s*(.*?)\s*</p>})) && cur_month
    mm   = format("%02d", cur_month)
    text = one_line(fm[1])
    pool = (cache["month_flavor"]["pool"][mm] ||= [])
    pool << text unless pool.include?(text)
    cache["month_flavor"]["assigned"][month_key(cur_year, cur_month)] ||= text
  end
end

# Drop copy for shows that are no longer on the site (no current _posts page). This
# is what removes a finished one-off like "nicholas-de-santo" from the cache.
def prune_stale_shows(cache, valid_slugs)
  cache["show_info"].select! { |slug, _| valid_slugs.include?(slug) }
end

# ---------- claude (ONLY under --init) ----------

def claude_bin = ENV["CLAUDE_BIN"] || "claude"

def claude_available?
  system("command -v #{claude_bin} > /dev/null 2>&1")
end

# Run `claude` like PAI's Inference.ts: subscription OAuth (API keys deleted, OAuth
# kept), no tools, no settings, empty system prompt, never --bare. CLAUDECODE is
# deleted from the child env so this works identically whether launched from cron
# (no CLAUDECODE), a plain shell, or inside a Claude Code session (which sets it and
# would otherwise block a nested `claude`). Prompt on stdin. Returns raw text or nil.
def claude_say(prompt, model)
  env = ENV.to_h
  env.delete("ANTHROPIC_API_KEY")
  env.delete("ANTHROPIC_AUTH_TOKEN")
  env.delete("CLAUDECODE")
  env.delete("CLAUDE_CODE_ENTRYPOINT")
  cmd = [claude_bin, "--print", "--model", model,
         "--tools", "", "--output-format", "text",
         "--setting-sources", "", "--system-prompt", ""]
  out = +""
  ok = false
  begin
    Open3.popen2e(env, *cmd) do |stdin, stdout_err, wait_thr|
      stdin.write(prompt) rescue nil
      stdin.close rescue nil
      begin
        Timeout.timeout(120) { out = stdout_err.read }
        ok = wait_thr.value.success?
      rescue Timeout::Error
        Process.kill("TERM", wait_thr.pid) rescue nil
        ok = false
      end
    end
  rescue
    return nil
  end
  ok ? out : nil
end

# Split a multi-line claude reply into clean, distinct copy lines.
def parse_lines(out, max)
  out.to_s.lines.map(&:strip).reject(&:empty?)
     .map { |l| l.sub(/\A[-*•\d]+[.)]?\s*/, "") }          # strip bullets / numbering
     .map { |l| one_line(l).gsub(/\A["'`]+|["'`]+\z/, "").strip }
     .reject(&:empty?).uniq.first(max)
end

SEASONS = {
  12 => "the festive Christmas season", 1 => "deep winter", 2 => "late winter",
  3 => "early spring", 4 => "spring", 5 => "late spring",
  6 => "early summer", 7 => "high summer", 8 => "late summer",
  9 => "early autumn", 10 => "autumn", 11 => "late autumn"
}.freeze

def info_pool_prompt(n, meta)
  host = meta["host"].to_s.empty? ? "" : "Host(s): #{meta["host"]}. "
  src  = [meta["title"], meta["description"], meta["about"]].reject { |s| s.to_s.empty? }.join(" — ")
  <<~PROMPT
    Below is one recurring stand-up comedy show. Write #{n} DISTINCT one-line TEASERS for
    the "Info" column of a calendar — cute, playful hooks that make someone want to come,
    each a different angle so the calendar stays fresh when this same show repeats week
    after week. Ground them in the show's own theme, vibe and host(s):

    #{host}#{one_line(src)[0, 900]}

    STRICT RULES for EVERY line:
    - Do NOT mention any location, city, venue, country, neighbourhood or address (no
      "Zürich", "Basel", bar names, etc.). The venue changes between dates, so naming it
      would be wrong. Tease the SHOW and its host(s), never the place.
    - Make it a cute, inviting teaser — playful, not a dry description.
    - If the show is clearly performed in a language other than English (evident from the
      text above — e.g. Spanish), write the lines in that language to match its voice.
    - Max ~60 characters before a SINGLE trailing emoji that fits the line; plain text;
      no quotation marks; no markdown; it must NOT contain the "|" character.
    Output EXACTLY #{n} lines, one per row, nothing else (no numbering).
  PROMPT
end

def month_pool_prompt(k, month_name, month_num)
  <<~PROMPT
    Write #{k} DISTINCT one-sentence "flavor" lines for the heading of an English
    stand-up comedy calendar, all for the month of #{month_name} in Zürich, Switzerland
    (it is #{SEASONS[month_num]}). Each line a different angle, tied lightly to the time
    of year and to comedy — warm and funny, not corny.
    Rules for EACH line: a single sentence, max ~140 characters, plain text, no emoji,
    no quotation marks, no markdown, and do NOT name a venue or specific address.
    Output EXACTLY #{k} lines, one per row, nothing else.
  PROMPT
end

# Fill the pools via claude. Merges (never destroys existing lines / human edits).
def init_pools!(cache, events, options)
  unless claude_available?
    raise "--init needs `claude`, but the binary was not found. " \
          "Put it on PATH (cron has a minimal PATH) or set CLAUDE_BIN to its full path."
  end
  say("Initializing copy pools via claude (#{options[:model]})…")

  shows = events.map { |e| e[:show] }.uniq
  shows.each do |slug|
    meta = show_descriptions[slug]
    unless meta
      say("  [skip] #{slug} — no _posts page to describe")
      next
    end
    out = claude_say(info_pool_prompt(options[:pool_size], meta), options[:model])
    lines = parse_lines(out, options[:pool_size])
    if lines.empty?
      say("  [warn] #{slug} — claude returned no usable lines")
      next
    end
    pool = (cache["show_info"][slug] ||= { "pool" => [], "assigned" => {} })["pool"]
    added = lines.reject { |l| pool.include?(l) }
    pool.concat(added)
    say("  [info] #{slug} — pool now #{pool.size} (+#{added.size})")
  end

  months = events.map { |e| e[:start].month }.uniq.sort
  months.each do |m|
    mm  = format("%02d", m)
    out = claude_say(month_pool_prompt(options[:month_variants], MONTHS_FULL[m - 1], m), options[:model])
    lines = parse_lines(out, options[:month_variants])
    if lines.empty?
      say("  [warn] month #{MONTHS_FULL[m - 1]} — claude returned no usable lines")
      next
    end
    pool  = (cache["month_flavor"]["pool"][mm] ||= [])
    added = lines.reject { |l| pool.include?(l) }
    pool.concat(added)
    say("  [flavor] #{MONTHS_FULL[m - 1]} — pool now #{pool.size} (+#{added.size})")
  end
end

# ---------- assignment (NO LLM) ----------

# Returns { "slug|YYYY-MM-DD" => line } and rewrites cache["show_info"][slug]["assigned"]
# (pruned to visible dates). Each visible occurrence gets a DISTINCT unused pool line;
# existing assignments are kept (stable + respects manual edits).
def assign_show_info(cache, events)
  out = {}
  events.group_by { |e| e[:show] }.each do |slug, evs|
    entry = (cache["show_info"][slug] ||= { "pool" => [], "assigned" => {} })
    pool  = entry["pool"]
    prev  = entry["assigned"]
    dates = evs.map { |e| date_key(e[:start]) }.uniq.sort
    result = {}
    used   = []

    dates.each do |d|                                   # keep existing (stable / manual)
      if prev[d] && !prev[d].to_s.empty?
        result[d] = prev[d]
        used << prev[d]
      end
    end
    dates.each do |d|                                   # assign new dates a distinct line
      next if result[d]
      cand = pool.find { |l| !used.include?(l) }
      if cand.nil?
        if pool.empty?
          cand = FALLBACK_INFO
          warn "  ! no Info pool for #{slug} — run --init (using fallback)"
        else
          cand = pool[used.size % pool.size]
          warn "  ! Info pool for #{slug} too small (#{pool.size} lines for #{dates.size} dates) — run --init; reusing a line"
        end
      end
      result[d] = cand
      used << cand
    end

    entry["assigned"] = result                          # prune stale dates
    dates.each { |d| out["#{slug}|#{d}"] = result[d] }
  end
  out
end

# Returns { "YYYY-MM" => flavor } and rewrites cache["month_flavor"]["assigned"].
def assign_month_flavor(cache, year_months)
  pool     = cache["month_flavor"]["pool"]
  prev     = cache["month_flavor"]["assigned"]
  result   = {}
  year_months.each do |ym|
    if prev[ym] && !prev[ym].to_s.empty?
      result[ym] = prev[ym]
      next
    end
    y, m = ym.split("-").map(&:to_i)
    variants = pool[format("%02d", m)] || []
    if variants.empty?
      result[ym] = fallback_flavor(MONTHS_FULL[m - 1], y)
      warn "  ! no month-flavor pool for #{MONTHS_FULL[m - 1]} — run --init (using fallback for #{ym})"
    else
      result[ym] = variants[y % variants.size]          # rotate by year so 2026 ≠ 2027
    end
  end
  cache["month_flavor"]["assigned"] = result            # prune stale
  result
end

# ---------- git ----------

def git_run(*args)
  out, status = Open3.capture2e("git", "-C", ROOT, *args)
  [out.strip, status.success?]
end

def commit_and_push!
  out, ok = git_run("add", "--", "pages/2_calendar.md", "script/calendar-copy.json",
                    "_data/calendar.yml", "_data/venues.yml")
  raise "git add failed: #{out}" unless ok

  _, no_staged = git_run("diff", "--quiet", "--staged")
  return :no_changes if no_staged

  out, ok = git_run("commit", "-m", "chore: regenerate calendar page from EventFrog data")
  raise "git commit failed: #{out}" unless ok

  out, ok = git_run("push", "origin", "master")
  return :pushed if ok

  if out =~ /non-fast-forward|fetch first|rejected.*Updates were rejected/im
    say("  push rejected (branch behind origin), pulling --rebase...")
    out, ok = git_run("pull", "--rebase", "origin", "master")
    raise "git pull --rebase failed: #{out}" unless ok
    out, ok = git_run("push", "origin", "master")
    raise "git push (after rebase) failed: #{out}" unless ok
    return :pushed_after_rebase
  end

  raise "git push failed: #{out}"
end

# ---------- build one month block ----------

def build_block(month_name, year, flavor, events, event_info)
  rows = events.map do |e|
    t      = e[:start]
    info   = one_line(event_info["#{e[:show]}|#{date_key(t)}"] || FALLBACK_INFO)
    name   = one_line(e[:name])
    link   = "#{SITE_URL}#{e[:url]}"
    "| #{MONTHS_ABBR[t.month - 1]} #{t.day} | #{DOW_ABBR[t.wday]} | [#{name}](#{link}) | #{info} | [Get Tickets](#{e[:ticket_url]}) |"
  end

  lines = []
  lines << %(<h2 class="iyf-month-heading">#{month_name} #{year}</h2>)
  lines << %(<p class="iyf-month-flavor">#{one_line(flavor)}</p>)
  lines << ""
  lines << %(<div class="iyf-calendar" markdown="1">)
  lines << ""
  lines << "| Date | Day | Show | Info | Tickets |"
  lines << "|------|-----|------|------|---------|"
  rows.each { |r| lines << r }
  lines << ""
  lines << "</div>"
  lines.join("\n")
end

# ---------- main ----------

now = Time.now

# Step 1 — refresh the data file (unless told not to / dry-run).
if options[:dry_run] || options[:no_refresh]
  say("(using existing _data/calendar.yml — #{options[:dry_run] ? 'dry-run' : '--no-refresh'})")
else
  say("Refreshing _data/calendar.yml from EventFrog…")
  regenerate_calendar_data!(options)
end

events = load_events
if events.empty?
  warn "refresh-calendar-page: _data/calendar.yml has 0 future events — leaving the page untouched."
  exit 0
end

original = File.read(PAGE)
intro, outro = split_page(original)

# Build the copy pools: durable cache, topped up by the page's hand-written copy,
# pruned to shows still on the site.
cache = load_cache
seed_month_flavor_from_page(original, cache)
prune_stale_shows(cache, show_descriptions.keys)

# Only --init ever runs the LLM.
init_pools!(cache, events, options) if options[:init] && !options[:dry_run]

# Assign copy (no LLM) — distinct line per occurrence, stable across runs.
groups = events.group_by { |e| [e[:start].year, e[:start].month] }
                .sort_by { |(y, m), _| [y, m] }
event_info     = assign_show_info(cache, events)
month_flavor   = assign_month_flavor(cache, groups.map { |(y, m), _| month_key(y, m) })

blocks = groups.map do |(year, month), evs|
  build_block(MONTHS_FULL[month - 1], year, month_flavor[month_key(year, month)], evs, event_info)
end
new_body = bump_last_modified(intro, now) + blocks.join("\n\n") + outro

say("\n#{events.size} event(s) across #{groups.size} month(s).")

if options[:dry_run]
  say("\n--- would write #{PAGE} ---")
  puts new_body
  exit 0
end

# Write the page, then gate on the validator. Restore the original on failure.
File.write(PAGE, new_body)
say("Wrote #{PAGE}")

vout, vok = Open3.capture2e("ruby", VALIDATOR, PAGE, "--no-color", chdir: ROOT)
unless vok
  File.write(PAGE, original)
  warn "refresh-calendar-page: validate-calendar.rb FAILED — page reverted, nothing written.\n\n#{vout}"
  exit 1
end
say("validate-calendar.rb: passed")

save_cache(cache)
say("Wrote #{CACHE_FILE}")

if options[:no_push]
  say("git: skipped (--no-push)")
else
  say("git: #{commit_and_push!}")
end

exit 0

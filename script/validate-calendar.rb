#!/usr/bin/env ruby
# frozen_string_literal: true

# validate-calendar.rb — structural validator for pages/2_calendar.md
#
# The calendar page looks like plain markdown but is a CONTRACT: its CSS
# (_sass/components/_calendar-table.scss) targets table columns by position, and
# its JS (assets/js/jump-to-next-show.js) parses month headings and date cells by
# string format. Break the structure and the page silently mis-renders or the
# "Jump to Next Show" button dies — the Jekyll build still passes, so nobody
# notices until it is live.
#
# This script enforces the machine-checkable invariants written in
# CALENDAR_STRUCTURE.md section 11. Rules 1-11 are ERRORS (structural breakage);
# rule 12 is an advisory WARNING (visible/structured-data divergence).
#
# Usage:
#   ruby script/validate-calendar.rb                 # validate pages/2_calendar.md
#   ruby script/validate-calendar.rb path/to/file.md # validate another file
#   ruby script/validate-calendar.rb --no-color      # plain output (CI logs)
#   ruby script/validate-calendar.rb --quiet         # only show failures + summary
#
# Exit 0 = no errors (warnings allowed). Exit 1 = at least one error.
#
# Stdlib only, matching script/check-site.rb — no bundler, no gems.

require "yaml"
require "date"

ROOT     = File.expand_path("..", __dir__)
POSTS    = File.join(ROOT, "_posts")
DEFAULT  = File.join(ROOT, "pages", "2_calendar.md")

# ── regexes mirrored verbatim from assets/js/jump-to-next-show.js ───────────
# Heading must contain a month name + 4-digit year (HEADING_RE in the JS).
HEADING_RE  = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{4})\b/i
# Date cell must be "Mon D" / "Month D" with nothing else (ROW_DATE_RE in the JS).
ROW_DATE_RE = /\A(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\z/i
MONTH_INDEX = {
  "jan" => 1, "feb" => 2, "mar" => 3, "apr" => 4, "may" => 5, "jun" => 6,
  "jul" => 7, "aug" => 8, "sep" => 9, "oct" => 10, "nov" => 11, "dec" => 12
}.freeze

EXPECTED_HEADER = %w[Date Day Show Info Tickets].freeze
SCRIPT_RE       = %r{<script[^>]+jump-to-next-show\.js}i
ARROW_RE        = /→|➡|➔|➜|->/  # → and common arrow glyphs

# ── tiny harness, same shape as check-site.rb ──────────────────────────────
NO_COLOR = ARGV.delete("--no-color") || !$stdout.tty?
QUIET    = ARGV.delete("--quiet")
TARGET   = ARGV.find { |a| !a.start_with?("-") } || DEFAULT

$errors   = []
$warnings = []

def color(str, code)
  NO_COLOR ? str : "\e[#{code}m#{str}\e[0m"
end

def green(s) = color(s, 32)
def red(s)   = color(s, 31)
def yellow(s) = color(s, 33)
def dim(s)   = color(s, 90)

# Run one rule. The block returns nil/true for pass, or a String/Array of
# failure detail(s). Errors go to $errors; with warn: true they go to $warnings.
def rule(id, name, warn: false)
  detail = yield
  failures = Array(detail).compact.reject { |d| d == true }
  if failures.empty?
    puts "  #{green('PASS')}  #{id} #{name}" unless QUIET
  elsif warn
    failures.each { |f| $warnings << "#{id} #{name}: #{f}" }
    puts "  #{yellow('WARN')}  #{id} #{name}" unless QUIET
    failures.each { |f| puts "        #{dim(f)}" } unless QUIET
  else
    failures.each { |f| $errors << "#{id} #{name}: #{f}" }
    puts "  #{red('FAIL')}  #{id} #{name}"
    failures.each { |f| puts "        #{dim(f)}" }
  end
end

# ── load + split front matter / body ───────────────────────────────────────
abort red("validate-calendar: file not found: #{TARGET}") unless File.file?(TARGET)
raw = File.read(TARGET)

unless raw.start_with?("---\n")
  abort red("validate-calendar: #{TARGET} has no YAML front matter")
end
_, fm_text, body = raw.split(/^---\s*$\n/, 3)
body ||= ""
body_lines = body.lines.map(&:chomp)
# Body line N (1-based) maps to file line N + LINE_OFFSET. The offset is the
# number of front-matter lines (both --- fences + YAML), derived exactly so the
# reported line numbers are clickable file locations.
LINE_OFFSET = raw.lines.count - body.lines.count

front = begin
  YAML.safe_load(fm_text, permitted_classes: [Date, Time], aliases: true) || {}
rescue Psych::Exception => e
  abort red("validate-calendar: cannot parse front matter: #{e.message}")
end

# ── parse the body into headings and calendar blocks, in document order ─────
# Each element: {type: :heading, line:, text:, mon:, year:} or
#               {type: :calendar, line:, header:, rows: [{line:, cells:}]}
def split_cells(line)
  s = line.strip
  s = s[1..] if s.start_with?("|")
  s = s[0..-2] if s.end_with?("|")
  s.split("|").map(&:strip)
end

elements = []
i = 0
while i < body_lines.length
  line = body_lines[i]

  if (m = line.match(%r{<h2\s+class="iyf-month-heading"\s*>(.*?)</h2>}i))
    text = m[1].strip
    hm   = text.match(HEADING_RE)
    elements << {
      type: :heading, line: i + 1 + LINE_OFFSET, text: text,
      mon: hm && MONTH_INDEX[hm[1].downcase[0, 3]], year: hm && hm[2].to_i
    }
    i += 1
    next
  end

  # Misused markdown month heading: "## May 2026" (loses the class -> invisible
  # to the CSS and the JS heading selector).
  if line =~ /\A##\s+/ && line =~ HEADING_RE
    elements << { type: :bad_md_heading, line: i + 1 + LINE_OFFSET, text: line.strip }
    i += 1
    next
  end

  if (dm = line.match(/\A<div\s+class="iyf-calendar"(.*?)>/i))
    open_line   = i + 1 + LINE_OFFSET
    has_md_attr = dm[1] =~ /\bmarkdown\s*=\s*"1"/i ? true : false
    # capture until closing </div>
    block = []
    i += 1
    i += 1 while i < body_lines.length && body_lines[i].strip.empty? # skip blanks
    while i < body_lines.length && body_lines[i].strip !~ %r{\A</div>}i
      block << { line: i + 1 + LINE_OFFSET, text: body_lines[i] }
      i += 1
    end
    i += 1 # consume </div>

    # table rows = lines that look like pipe rows
    pipe = block.select { |b| b[:text].strip.start_with?("|") }
    header_cells = pipe.empty? ? nil : split_cells(pipe.first[:text])
    data = pipe.drop(1).reject { |b| b[:text] =~ /\A\s*\|?[\s:|-]+\|?\s*\z/ } # drop separator
    rows = data.map { |b| { line: b[:line], cells: split_cells(b[:text]) } }

    elements << {
      type: :calendar, line: open_line, has_md_attr: has_md_attr,
      header: header_cells, rows: rows, had_pipe: !pipe.empty?
    }
    next
  end

  i += 1
end

headings   = elements.select { |e| e[:type] == :heading }
calendars  = elements.select { |e| e[:type] == :calendar }
bad_md     = elements.select { |e| e[:type] == :bad_md_heading }

puts "Validating #{File.basename(TARGET)} — #{headings.size} month(s), #{calendars.size} table(s)\n\n" unless QUIET

# ── Rule 1 — front matter keys ─────────────────────────────────────────────
rule("R1", "front matter keys present and correct") do
  f = []
  f << "layout must be 'page' (got #{front['layout'].inspect})"        unless front["layout"] == "page"
  f << "permalink must be '/calendar/' (got #{front['permalink'].inspect})" unless front["permalink"] == "/calendar/"
  f << "schema_type must be 'ItemList' (got #{front['schema_type'].inspect})" unless front["schema_type"] == "ItemList"
  f << "hero_jump_button must be true (got #{front['hero_jump_button'].inspect})" unless front["hero_jump_button"] == true
  lm = front["last_modified_at"]
  ok_date = lm.is_a?(Time) || lm.is_a?(Date) || (lm.is_a?(String) && (DateTime.parse(lm) rescue false))
  f << "last_modified_at missing or unparseable (got #{lm.inspect})" unless ok_date
  f
end

# ── Rule 2 — month headings are raw h2 with parseable Month YYYY ────────────
rule("R2", "month headings are <h2 class=\"iyf-month-heading\">Month YYYY</h2>") do
  f = []
  bad_md.each do |b|
    f << "line #{b[:line]}: markdown heading '#{b[:text]}' — use raw <h2 class=\"iyf-month-heading\"> or the class (and the JS) is lost"
  end
  headings.each do |h|
    f << "line #{h[:line]}: heading '#{h[:text]}' lacks a month name + 4-digit year (HEADING_RE)" unless h[:mon] && h[:year]
  end
  f << "no month headings found" if headings.empty? && bad_md.empty?
  f
end

# ── Rule 3 — each heading followed by >=1 iyf-calendar div before next heading
rule("R3", "each month heading is followed by a calendar table") do
  f = []
  positions = elements.each_index.to_a
  headings.each do |h|
    idx = elements.index(h)
    nxt = elements[(idx + 1)..].find { |e| e[:type] == :heading }
    nxt_idx = nxt ? elements.index(nxt) : elements.length
    has_cal = elements[(idx + 1)...nxt_idx].any? { |e| e[:type] == :calendar }
    f << "line #{h[:line]}: heading '#{h[:text]}' has no iyf-calendar table before the next heading" unless has_cal
  end
  f
end

# ── Rule 4 — table header row is exactly Date|Day|Show|Info|Tickets ─────────
rule("R4", "table header row is exactly Date | Day | Show | Info | Tickets") do
  calendars.map do |c|
    if !c[:had_pipe]
      "line #{c[:line]}: iyf-calendar div contains no markdown table"
    elsif c[:header] != EXPECTED_HEADER
      "line #{c[:line]}: header is #{c[:header].inspect}, expected #{EXPECTED_HEADER.inspect}"
    end
  end
end

# ── Rule 5 — markdown="1" on every iyf-calendar div ────────────────────────
rule("R5", "every iyf-calendar div has markdown=\"1\"") do
  calendars.reject { |c| c[:has_md_attr] }
           .map { |c| "line #{c[:line]}: <div class=\"iyf-calendar\"> is missing markdown=\"1\" (table will render as literal text)" }
end

# ── Rule 6 — every data row has exactly 5 cells ────────────────────────────
rule("R6", "every data row has exactly 5 cells") do
  f = []
  calendars.each do |c|
    c[:rows].each do |r|
      f << "line #{r[:line]}: #{r[:cells].size} cells (#{r[:cells].inspect}), expected 5" unless r[:cells].size == 5
    end
  end
  f
end

# ── Rule 7 — column 1 matches the JS date format ───────────────────────────
rule("R7", "column 1 (Date) matches 'Mon D' / 'Month D' (ROW_DATE_RE)") do
  f = []
  calendars.each do |c|
    c[:rows].each do |r|
      next if r[:cells].empty?
      d = r[:cells][0].to_s
      f << "line #{r[:line]}: date cell #{d.inspect} fails ROW_DATE_RE (no suffixes, no weekday, 'Month Day' only)" unless d =~ ROW_DATE_RE
    end
  end
  f
end

# ── Rule 8 — dates ascending within a table; headings ascending ────────────
rule("R8", "rows sorted ascending by date; month headings in chronological order") do
  f = []

  # headings chronological (non-decreasing by year, month)
  dated = headings.select { |h| h[:mon] && h[:year] }
  dated.each_cons(2) do |a, b|
    if ([b[:year], b[:mon]] <=> [a[:year], a[:mon]]) < 0
      f << "line #{b[:line]}: heading '#{b[:text]}' is earlier than the previous heading '#{a[:text]}'"
    end
  end

  # rows within each table non-decreasing, using the governing heading's year
  calendars.each do |c|
    idx = elements.index(c)
    gov = elements[0...idx].reverse.find { |e| e[:type] == :heading && e[:year] }
    year = gov ? gov[:year] : nil
    prev = nil
    c[:rows].each do |r|
      m = r[:cells][0].to_s.match(ROW_DATE_RE)
      next unless m && year
      cur = [MONTH_INDEX[m[1].downcase[0, 3]], m[2].to_i]
      if prev && (cur <=> prev) < 0
        f << "line #{r[:line]}: date #{r[:cells][0].inspect} is out of order (earlier than the previous row)"
      end
      prev = cur
    end
  end
  f
end

# ── Rule 9 — column 3 (Show) contains a markdown link ──────────────────────
rule("R9", "column 3 (Show) contains a markdown link") do
  f = []
  calendars.each do |c|
    c[:rows].each do |r|
      next if r[:cells].size < 3
      f << "line #{r[:line]}: Show cell #{r[:cells][2].inspect} is not a markdown link" unless r[:cells][2] =~ /\[.+\]\(.+\)/
    end
  end
  f
end

# ── Rule 10 — column 5 (Tickets) text is 'Get Tickets', no arrow ───────────
rule("R10", "column 5 (Tickets) is a 'Get Tickets' link with no hand-typed arrow") do
  f = []
  calendars.each do |c|
    c[:rows].each do |r|
      next if r[:cells].size < 5
      cell = r[:cells][4].to_s
      lm = cell.match(/\[(.*?)\]\((.+?)\)/)
      if lm.nil?
        f << "line #{r[:line]}: Tickets cell #{cell.inspect} is not a markdown link"
      else
        f << "line #{r[:line]}: Tickets link text is #{lm[1].inspect}, expected \"Get Tickets\"" unless lm[1].strip == "Get Tickets"
      end
      f << "line #{r[:line]}: Tickets cell contains an arrow — CSS adds the → automatically, remove it" if cell =~ ARROW_RE
    end
  end
  f
end

# ── Rule 11 — body ends with the jump-to-next-show.js script include ───────
rule("R11", "page body ends with the jump-to-next-show.js script include") do
  meaningful = body_lines.reject { |l| l.strip.empty? }
  last = meaningful.last.to_s
  if body !~ SCRIPT_RE
    "jump-to-next-show.js <script> include is missing from the page"
  elsif last !~ SCRIPT_RE
    "the script include is present but not the last element (found #{last.inspect} after it)"
  end
end

# ── Rule 12 — ADVISORY: show links should map to a real _posts page ─────────
rule("R12", "(advisory) every Show link maps to an existing show post", warn: true) do
  next "no _posts directory found — skipping advisory cross-check" unless Dir.exist?(POSTS)

  permalinks = []
  Dir.glob(File.join(POSTS, "*.md")).each do |p|
    head = File.read(p)[/\A---\s*\n(.*?)\n---\s*\n/m, 1]
    next unless head
    fmp = (YAML.safe_load(head, permitted_classes: [Date, Time], aliases: true) rescue nil)
    next unless fmp.is_a?(Hash)
    next unless fmp["ticket_url"]          # a "show" is a post with a ticket_url
    slug = fmp["permalink"].to_s.gsub("/", "")
    slug = File.basename(p, ".md").sub(/\A\d{4}-\d\d-\d\d-/, "") if slug.empty?
    permalinks << slug unless slug.empty?
  end

  f = []
  seen = {}
  calendars.each do |c|
    c[:rows].each do |r|
      next if r[:cells].size < 3
      url = r[:cells][2][/\]\((.+?)\)/, 1].to_s
      m = url.match(%r{inyourfacecomedy\.ch/([^/)?#]+)/?})
      next unless m
      slug = m[1]
      next if seen[slug]
      seen[slug] = true
      f << "Show link /#{slug}/ (line #{r[:line]}) has no matching show post — it will be invisible to the JSON-LD ItemList" unless permalinks.include?(slug)
    end
  end
  f
end

# ── summary + exit ─────────────────────────────────────────────────────────
puts
unless $warnings.empty?
  puts yellow("⚠ #{$warnings.size} advisory warning(s) (do not block):")
  $warnings.each { |w| puts "  #{dim(w)}" }
  puts
end

if $errors.empty?
  puts green("✓ #{File.basename(TARGET)} is structurally valid — all error rules passed.")
  exit 0
else
  puts red("✗ #{$errors.size} structural error(s) — the calendar will mis-render or the jump button will break:")
  $errors.each { |e| puts "  #{red('•')} #{e}" }
  exit 1
end

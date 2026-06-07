#!/usr/bin/env ruby
# frozen_string_literal: true

# build-gallery-data.rb — manage the /moments/ gallery and its metadata.
#
# Two commands:
#
#   build            Incrementally scan assets/img/gallery/, analyse any NEW images
#                    with Apple Vision (auge), drop entries whose files are gone,
#                    and rewrite _data/gallery.yml (newest-first timeline). Already
#                    analysed images are reused as-is (auge is not re-run), and any
#                    comedian slug you've tagged is preserved. Pings IndexNow for
#                    /moments/ (and affected comedian pages) when the data changes.
#
#   tag              Walk the performer images that don't yet have a comedian slug,
#                    open each in Preview, and prompt for the comedian's slug
#                    (validated against _comedians/). The slug is saved to
#                    _data/gallery.yml; the comedian's profile page then shows that
#                    photo (see _layouts/comedian.liquid). Pings IndexNow for
#                    /moments/ and each tagged comedian's page.
#
# Per-image metadata:
#   date     — first git-add of the file (the honest "when it appeared" signal;
#              EXIF on these is just the resize date). See CLAUDE.md.
#   type     — performer | audience | moment. Led by what someone is *doing*:
#              a microphone / performance / singer label or a standing body-pose
#              => performer; people without a performer cue => audience; nobody
#              => moment. Face count alone misreads seated pairs as "performers".
#   featured — the ~22% shown large (2x2) in the mosaic: audience reactions plus
#              the strongest comedian frames.
#   alt      — SEO alt text, anchored on IN YOUR FACE Comedy + Zürich + the year.
#   comedian — (optional) a comedian slug, set by `tag`.
#
# auge is Apple Vision: macOS only. This runs locally and commits the YAML; the
# Jekyll build (Linux CI / Netlify) only ever reads it. Same split as
# sync-comedians.rb, whose IndexNow helper this mirrors.
#
# Usage:
#   ruby script/build-gallery-data.rb [build] [--rebuild] [--no-ping] [--quiet]
#   ruby script/build-gallery-data.rb tag [--all] [--no-open] [--no-ping]

Encoding.default_external = Encoding::UTF_8 # cron/US-ASCII guard (Zürich, ü)

require "json"
require "yaml"
require "date"
require "open3"
require "time"
require "set"
require "net/http"
require "uri"
require "readline" # tab-completion for comedian slugs in `tag`

REPO_ROOT     = File.expand_path("..", __dir__)
GALLERY_DIR   = File.join(REPO_ROOT, "assets", "img", "gallery")
COMEDIANS_DIR = File.join(REPO_ROOT, "_comedians")
WEB_PREFIX    = "/assets/img/gallery"
OUT_FILE      = File.join(REPO_ROOT, "_data", "gallery.yml")
IMAGE_EXTS    = %w[.jpg .jpeg .png .webp .gif].freeze
RECENT_DAYS   = 120 # "the last few months" — the rolling "Recent" era

# IndexNow — push-notify Bing/Yandex/Seznam/Naver (not Google) when a page
# changes. Mirrors sync-comedians.rb; the key file lives at the site root.
SITE_URL          = "https://inyourfacecomedy.ch"
INDEXNOW_KEY      = "4b04fa2d03884c6794d4ece40fb41a29"
INDEXNOW_ENDPOINT = URI("https://api.indexnow.org/indexnow")

# --- date: when did this image first appear in git history? -------------------
def git_added_date(abs_path)
  rel = abs_path.sub("#{REPO_ROOT}/", "")
  out, _ = Open3.capture2("git", "-C", REPO_ROOT, "log", "--diff-filter=A",
                          "--format=%aI", "--", rel)
  iso = out.lines.map(&:strip).reject(&:empty?).last
  if iso.nil? # renamed / odd-history files
    out, _ = Open3.capture2("git", "-C", REPO_ROOT, "log", "--format=%aI", "--", rel)
    iso = out.lines.map(&:strip).reject(&:empty?).last
  end
  return Date.iso8601(iso) if iso
  File.mtime(abs_path).to_date # untracked: best we have
rescue ArgumentError
  File.mtime(abs_path).to_date
end

# --- Apple Vision via auge ----------------------------------------------------
def auge(mode, abs_path)
  out, status = Open3.capture2("auge", "--#{mode}", abs_path, "--json")
  return {} unless status.success?
  JSON.parse(out)["results"] || {}
rescue StandardError
  {}
end

# What marks a comedian's frame vs the audience. Face count alone misleads: two
# people seated in the audience look like "two performers", and plenty of
# audience frames hold a single person. So we lead with what someone is *doing*.
# Apple Vision reliably tags a comedian's frame with microphone / performance /
# entertainer / singer (28+ of our images carry a "microphone" label), and a
# comedian is standing on stage while the audience is seated (body-pose resolves
# leg/foot joints for the standing figure, none for seated rows).
PERFORMER_LABELS = %w[microphone performance entertainer singer karaoke
                      musician singing stage concert].freeze
CROWD_LABELS     = %w[crowd audience].freeze
PERF_CONF        = 0.25 # min confidence for a performer label to count
MIC_CONF         = 0.20 # a detected microphone is a strong solo signal on its own
LEG_JOINTS       = %w[left_leg_joint right_leg_joint left_foot_joint right_foot_joint].freeze

FEATURED_FRACTION = 0.22 # share of the wall that renders as large 2x2 mosaic tiles

def analyze(abs_path)
  faces  = auge("faces",  abs_path)["count"].to_i
  humans = auge("humans", abs_path)["count"].to_i
  aest   = auge("aesthetics", abs_path)["aesthetics"] || {}

  conf = {} # Vision classifier: label => confidence
  (auge("classify", abs_path)["classifications"] || []).each do |c|
    conf[c["label"]] = c["confidence"].to_f
  end

  # Standing? Seated audience shots resolve no leg/foot joints; a comedian does.
  standing = (auge("body-pose", abs_path)["bodies"] || []).any? do |b|
    (b["joints"] || []).any? { |j| LEG_JOINTS.include?(j["name"]) && j["confidence"].to_f >= 0.30 }
  end

  {
    faces: faces, humans: humans, standing: standing,
    aesthetic: (aest["overall"] || 0).to_f,
    utility:   aest["isUtility"] == true,
    labels:    conf.select { |_, v| v >= 0.30 }.keys,      # alt-text scene words
    perf:      PERFORMER_LABELS.map { |l| conf[l] || 0 }.max,
    mic:       conf["microphone"] || 0,
    crowd:     CROWD_LABELS.map { |l| conf[l] || 0 }.max
  }
end

# --- interpretation: what is this a picture of? ------------------------------
def performer?(m)
  m[:perf] >= PERF_CONF || m[:mic] >= MIC_CONF ||
    (m[:standing] && m[:faces] <= 1 && m[:crowd] < 0.30) # lone standing figure, no mic label
end

def classify_type(m)
  if performer?(m)
    "performer"                                 # comedian on stage, mic in hand
  elsif m[:crowd] >= 0.30 || m[:faces] >= 1 || m[:humans] >= 1
    "audience"                                  # people watching the show
  else
    "moment"                                    # venue, details, in-between
  end
end

# How much a frame deserves to headline. Audience shots rank by laughing faces,
# tie-broken on aesthetics; performer/moment frames rank on the Vision aesthetics
# score. Utility frames (screenshots, flyers) are floored out. The reused-entry
# path (build, no re-analysis) recreates this from stored fields — utility images
# never survive in a curated gallery, so the missing utility flag is moot.
def headline_score(type, m)
  return -999.0 if m[:utility]
  type == "audience" ? (m[:faces] + m[:aesthetic] * 0.1) : m[:aesthetic]
end

def score_from(type, faces, aesthetic)
  type == "audience" ? (faces + aesthetic * 0.1) : aesthetic
end

# Featured tiles render large (2x2). We want a mix — the audience reactions that
# sell the room AND the best comedian frames — so we feature each pool separately
# rather than letting one type dominate one global ranking.
def assign_featured!(entries)
  live = entries.reject { |e| e["_score"] <= -900 }
  target = (entries.size * FEATURED_FRACTION).round

  reactions  = live.select { |e| e["type"] == "audience" }.sort_by { |e| -e["_score"] }
  performers = live.select { |e| e["type"] == "performer" }.sort_by { |e| -e["_score"] }
  moments    = live.select { |e| e["type"] == "moment" }.sort_by { |e| -e["_score"] }

  featured = (reactions.first((target * 0.55).round) +
              performers.first((target * 0.40).round) +
              moments.first((target * 0.05).ceil)).to_set

  entries.each { |e| e["featured"] = featured.include?(e) }
end

# --- SEO alt text: honest, distinct, brand- + place- + year-anchored ----------
SCENE = {
  "audience"  => "the audience at a live English stand-up comedy show",
  "performer" => "a comedian performing stand-up on stage",
  "moment"    => "a moment from an English stand-up comedy night"
}.freeze

def alt_text(type, year, m)
  scene = SCENE.fetch(type)
  scene = "a live music and comedy moment" if type == "moment" && (m[:labels] & %w[music concert]).any?
  "IN YOUR FACE Comedy, #{scene} in Zürich (#{year})"
end

# --- era bucketing (timeline sections) ----------------------------------------
def era_for(date, today)
  ((today - date).to_i <= RECENT_DAYS) ? "recent" : date.year.to_s
end

def era_label(era)
  era == "recent" ? "Recent" : era
end

# --- gallery files + persisted data -------------------------------------------
def gallery_files
  Dir.children(GALLERY_DIR)
     .reject { |f| f.start_with?(".") }
     .select { |f| IMAGE_EXTS.include?(File.extname(f).downcase) }
     .sort
end

def load_entries
  return [] unless File.exist?(OUT_FILE)
  YAML.load_file(OUT_FILE) || []
rescue StandardError
  []
end

# Known comedian slugs, from the Grist-generated _comedians/*.md front matter.
def known_slugs
  Dir.glob(File.join(COMEDIANS_DIR, "*.md")).filter_map do |f|
    File.foreach(f, encoding: "UTF-8") { |line| break Regexp.last_match(1) if line =~ /^slug:\s*"?([^"\n]+)"?/ }
  end.to_set
end

# Canonical key order + the rule that a blank comedian slug is simply omitted.
def canon(e)
  h = {}
  %w[src date year era era_label type faces humans aesthetic].each { |k| h[k] = e[k] }
  h["utility"] = true if e["utility"] == true # only persisted when a screenshot/flyer
  c = e["comedian"].to_s.strip
  h["comedian"] = c unless c.empty?
  h["alt"]      = e["alt"]
  h["featured"] = e["featured"]
  h
end

HEADER = <<~YAML
  # _data/gallery.yml — GENERATED by script/build-gallery-data.rb. Do not hand-edit.
  # Drives the /moments/ timeline gallery (newest first). On macOS, after adding or
  # removing photos in assets/img/gallery/:  ruby script/build-gallery-data.rb
  # Tag comedians into their photos:          ruby script/build-gallery-data.rb tag
  # auge (Apple Vision) is macOS-only; CI/Netlify only read this committed file.
YAML

def write_entries(entries)
  body = entries.map { |e| canon(e) }.to_yaml.sub(/\A---\n/, "")
  File.write(OUT_FILE, HEADER + body)
end

def comedian_url(slug) = "#{SITE_URL}/comedians/#{slug}/"

# Submit URLs to IndexNow. Best-effort: never raises, never aborts the caller.
def submit_indexnow(urls)
  urls = urls.compact.uniq
  return if urls.empty?
  payload = {
    "host" => URI(SITE_URL).host, "key" => INDEXNOW_KEY,
    "keyLocation" => "#{SITE_URL}/#{INDEXNOW_KEY}.txt", "urlList" => urls
  }
  http = Net::HTTP.new(INDEXNOW_ENDPOINT.host, INDEXNOW_ENDPOINT.port)
  http.use_ssl = true
  http.read_timeout = 30
  req = Net::HTTP::Post.new(INDEXNOW_ENDPOINT.request_uri)
  req["Content-Type"] = "application/json; charset=utf-8"
  req.body = JSON.generate(payload)
  code = http.request(req).code.to_i
  if [200, 202].include?(code)
    puts "indexnow: submitted #{urls.size} url(s) → HTTP #{code}"
  else
    warn "  ! indexnow non-2xx (HTTP #{code}) — ignored (non-fatal)"
  end
rescue => e
  warn "  ! indexnow ping failed (#{e.message}) — ignored (non-fatal)"
end

# Stage the given paths, commit if anything changed, and push. Best-effort: a git
# failure warns but never aborts. Stages ONLY the named paths (never `add -A`), so
# unrelated working-tree changes are left alone. Mirrors sync-comedians.rb, which
# commits its generated data + images straight to master.
def git_commit_push(paths, message, push:)
  system("git", "-C", REPO_ROOT, "add", "--", *paths)
  if system("git", "-C", REPO_ROOT, "diff", "--cached", "--quiet", "--", *paths)
    puts "git: nothing to commit"
    return
  end
  # Commit ONLY these paths (pathspec) so any other staged change is left untouched.
  unless system("git", "-C", REPO_ROOT, "commit", "--quiet", "-m", message, "--", *paths)
    warn "  ! git commit failed — leaving changes staged"
    return
  end
  puts "git: committed — #{message}"
  return unless push

  if system("git", "-C", REPO_ROOT, "push", "--quiet")
    puts "git: pushed"
  else
    warn "  ! git push failed — committed locally, push manually"
  end
end

# =============================================================================
# build — incremental analyse + rewrite + commit + ping
# =============================================================================
def cmd_build(rebuild:, ping:, git:, quiet:)
  today    = Date.today
  existing = load_entries.each_with_object({}) { |e, h| h[e["src"]] = e }
  files    = gallery_files
  present  = files.map { |n| "#{WEB_PREFIX}/#{n}" }
  before   = File.exist?(OUT_FILE) ? File.read(OUT_FILE) : ""

  warn "Scanning #{files.size} gallery images (#{existing.size} already known)…" unless quiet
  added = []
  entries = files.map do |name|
    src  = "#{WEB_PREFIX}/#{name}"
    abs  = File.join(GALLERY_DIR, name)
    date = git_added_date(abs)
    prev = existing[src]

    if prev && !rebuild
      type, faces, humans = prev["type"], prev["faces"], prev["humans"]
      aes, alt, comedian  = prev["aesthetic"], prev["alt"], prev["comedian"]
      util  = prev["utility"] == true
      score = util ? -999.0 : score_from(type, faces, aes)
    else
      m = analyze(abs)
      type, faces, humans = classify_type(m), m[:faces], m[:humans]
      aes  = m[:aesthetic].round(3)
      util = m[:utility]
      alt  = alt_text(type, date.year, m)
      comedian = prev && prev["comedian"] # keep any slug even on a forced rebuild
      score = headline_score(type, m)
      added << src unless prev
      warn format("  + analysed %-34s %s  %-9s faces=%d", name, date, type, faces) unless quiet
    end

    era = era_for(date, today)
    { "src" => src, "date" => date.iso8601, "year" => date.year,
      "era" => era, "era_label" => era_label(era), "type" => type,
      "faces" => faces, "humans" => humans, "aesthetic" => aes,
      "utility" => util, "comedian" => comedian, "alt" => alt, "_score" => score }
  end

  removed = existing.values.reject { |e| present.include?(e["src"]) }

  assign_featured!(entries)
  entries.each { |e| e.delete("_score") }
  entries.sort_by! { |e| [e["date"], e["src"]] }.reverse!
  write_entries(entries)

  feat = entries.count { |e| e["featured"] }
  warn "" unless quiet
  warn "Wrote #{entries.size} entries → _data/gallery.yml" unless quiet
  warn "  +#{added.size} new, -#{removed.size} removed, #{feat} featured" unless quiet
  warn "  types: #{entries.group_by { |e| e['type'] }.transform_values(&:size)}" unless quiet

  changed = File.read(OUT_FILE) != before

  # Commit the data + any new/removed gallery images together, so the committed
  # YAML never references an image that isn't in git (which would 404 live).
  if git
    msg = if added.empty? && removed.empty?
            "gallery: refresh _data/gallery.yml"
          else
            "gallery: +#{added.size}/-#{removed.size} image(s)"
          end
    git_commit_push(["_data/gallery.yml", "assets/img/gallery"], msg, push: true)
  end

  if ping && changed
    # Comedian pages whose photo set changed = those tagged on removed images.
    affected = removed.map { |e| e["comedian"] }.compact.reject { |s| s.empty? || s == "none" }.uniq
    submit_indexnow(["#{SITE_URL}/moments/"] + affected.map { |s| comedian_url(s) })
  elsif ping
    puts "indexnow: no change, nothing to submit"
  end
end

# =============================================================================
# tag — interactive comedian-slug assignment for performer images
# =============================================================================
def cmd_tag(all:, open_preview:, ping:, git:)
  entries = load_entries
  abort "No _data/gallery.yml yet — run `build` first." if entries.empty?
  slugs = known_slugs

  queue = entries.select do |e|
    e["type"] == "performer" && (all || e["comedian"].to_s.strip.empty?)
  end
  total_perf = entries.count { |e| e["type"] == "performer" }
  if queue.empty?
    puts "Nothing to tag — every performer image already has a slug (#{total_perf} performers)."
    return
  end

  # Tab-completion over the known comedian slugs: prefix matches first, then a
  # substring fallback so you can type any memorable part of the slug.
  slug_list = slugs.to_a.sort
  Readline.completion_append_character = " "
  Readline.completion_proc = proc do |s|
    pre = slug_list.grep(/^#{Regexp.escape(s)}/i)
    pre.empty? ? slug_list.grep(/#{Regexp.escape(s)}/i) : pre
  end

  puts "#{queue.size} performer image(s) to tag (of #{total_perf}). For each, type the"
  puts "comedian's slug (Tab to autocomplete), or:  [enter]=skip   n=not a comedian   l=list   q=save & quit"
  touched = Set.new
  quit = false

  queue.each_with_index do |e, i|
    break if quit
    abs = File.join(REPO_ROOT, e["src"].sub(%r{^/}, ""))
    system("open", abs) if open_preview # preview in Preview.app (non-blocking)

    loop do
      prompt = "\n[#{i + 1}/#{queue.size}] #{File.basename(e['src'])} (#{e['date']})  slug> "
      input = Readline.readline(prompt, true) # nil on Ctrl-D
      if input.nil? then quit = true; break end
      input = input.strip
      case input
      when ""  then break                                   # skip, ask again next run
      when "q" then quit = true; break
      when "n" then e["comedian"] = "none"; break           # mark, stop asking
      when "l" then puts "  " + slugs.to_a.sort.join(", "); next
      else
        if slugs.include?(input)
          e["comedian"] = input; touched << input; break
        else
          print "  '#{input}' isn't a known comedian slug. Use it anyway? [y/N] "
          ans = $stdin.gets&.strip&.downcase
          if ans == "y" then e["comedian"] = input; touched << input; break end
          # otherwise re-prompt
        end
      end
    end
  end

  write_entries(entries)
  if touched.empty?
    puts "\nNo new tags."
    return
  end
  puts "\nSaved. Tagged #{touched.size} comedian(s): #{touched.to_a.sort.join(', ')}"

  git_commit_push(["_data/gallery.yml"],
                  "gallery: tag #{touched.size} comedian photo(s) — #{touched.to_a.sort.join(', ')}",
                  push: true) if git

  submit_indexnow(["#{SITE_URL}/moments/"] + touched.map { |s| comedian_url(s) }) if ping
end

# --- dispatch -----------------------------------------------------------------
USAGE = <<~TXT
  build-gallery-data.rb — manage the /moments/ gallery and its metadata.

  USAGE
    ./script/build-gallery-data.rb [build] [options]
    ./script/build-gallery-data.rb tag [options]

  COMMANDS
    build         (default) Incrementally scan assets/img/gallery/: analyse NEW
                  images with Apple Vision (auge), drop deleted ones, reuse the rest
                  (and any comedian slug), and rewrite _data/gallery.yml. Commits
                  the data + new/removed images and pushes, then pings IndexNow for
                  /moments/ (+ affected comedian pages) when data changes.
    tag           Walk performer images with no comedian slug, open each in Preview,
                  and prompt for the comedian's slug (validated against _comedians/).
                  Saves it, commits + pushes _data/gallery.yml, and pings IndexNow
                  for /moments/ and the tagged comedian pages.

  OPTIONS
    build:
      --rebuild   Re-analyse every image (ignore cached entries); slugs are kept.
      --no-git    Don't commit/push; leave changes in the working tree.
      --no-ping   Don't submit to IndexNow.
      --quiet     Suppress per-image logging.
    tag:
      --all       Include performers that already have a slug (re-tag them).
      --no-open   Don't open Preview (scripted / headless tagging).
      --no-git    Don't commit/push; leave changes in the working tree.
      --no-ping   Don't submit to IndexNow.
    -h, --help    Show this help.

  EXAMPLES
    ./script/build-gallery-data.rb                  # rebuild, commit+push, ping
    ./script/build-gallery-data.rb build --rebuild  # full re-analysis
    ./script/build-gallery-data.rb tag              # attribute comedian photos
    ./script/build-gallery-data.rb build --no-git   # update data only, no commit

  auge (Apple Vision) is macOS-only; the committed _data/gallery.yml is what
  CI/Netlify read. See CLAUDE.md § "The gallery is generated too".
TXT

if ARGV.include?("-h") || ARGV.include?("--help") || ARGV.first == "help"
  puts USAGE
  exit 0
end

command = ARGV.first && !ARGV.first.start_with?("-") ? ARGV.shift : "build"
quiet   = ARGV.include?("--quiet")
ping    = !ARGV.include?("--no-ping")
git     = !ARGV.include?("--no-git")

case command
when "build"
  cmd_build(rebuild: ARGV.include?("--rebuild"), ping: ping, git: git, quiet: quiet)
when "tag"
  cmd_tag(all: ARGV.include?("--all"), open_preview: !ARGV.include?("--no-open"), ping: ping, git: git)
else
  warn "Unknown command '#{command}'.\n\n"
  abort USAGE
end

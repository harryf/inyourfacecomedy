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
#   date     — the original capture date when we can trust one (EXIF embedded in the
#              file, or a date stamped in the filename by WhatsApp / most cameras),
#              otherwise the first git-add of the file. A capture date is used only
#              when it predates the git-add (a real capture always precedes the
#              commit; a resize date sits at or after it), which keeps the existing
#              resized wall — those carry no embedded date — on its git-add dates.
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
# Manual date overrides: basename => "YYYY-MM-DD". For photos whose metadata lies —
# WhatsApp shots carry only the receive day, EXIF stripped — a hand-set date here wins
# over EXIF/filename/git-add. Hand-maintained; survives rebuilds; preserves tags.
OVERRIDE_FILE = File.join(REPO_ROOT, "_data", "gallery_date_overrides.yml")
IMAGE_EXTS    = %w[.jpg .jpeg .png .webp .gif].freeze
HEIC_EXTS     = %w[.heic .heif].freeze # iPhone formats: converted to JPEG on import

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

# Reject bogus clocks (1970 epoch, a camera stuck at 2001) — nothing here predates
# the venue. Comfortably before the oldest real frame (2022) yet above the junk.
SITE_EPOCH = Date.new(2018, 1, 1)

# A date stamped into the filename. WhatsApp ("IMG-20250615-WA0001",
# "WhatsApp Image 2025-06-15 at …"), and most phones/cameras ("20250615_143022",
# "PXL_20250615_…", "IMG_20250615") all write the capture day into the name. This
# is immune to a later resize, so it is the most reliable signal we have for a
# forwarded photo. Returns nil when there's no plausible YYYY-MM-DD in the name.
def filename_date(name)
  return nil unless name =~ /(20\d{2})[-_. ]?(\d{2})[-_. ]?(\d{2})/
  y, m, d = Regexp.last_match.captures.map(&:to_i)
  Date.new(y, m, d) if (1..12).cover?(m) && (1..31).cover?(d)
rescue ArgumentError
  nil # e.g. 2025-02-31
end

# The EXIF capture date, via macOS Spotlight. kMDItemContentCreationDate is the
# embedded capture date when the file carries one — but on a stripped/resized file
# it just mirrors the filesystem date. So we trust it only when it differs from
# kMDItemFSCreationDate; equal means there is no real embedded date.
def exif_capture_date(abs_path)
  out, status = Open3.capture2("mdls", "-name", "kMDItemContentCreationDate",
                               "-name", "kMDItemFSCreationDate", abs_path)
  return nil unless status.success?
  content = out[/kMDItemContentCreationDate\s*=\s*(\d{4}-\d{2}-\d{2})/, 1]
  fs      = out[/kMDItemFSCreationDate\s*=\s*(\d{4}-\d{2}-\d{2})/, 1]
  return nil if content.nil? || content == fs
  Date.iso8601(content)
rescue StandardError
  nil
end

# A hand-maintained basename => Date map for photos whose automatic date is wrong.
def load_date_overrides
  return {} unless File.exist?(OVERRIDE_FILE)
  (YAML.load_file(OVERRIDE_FILE) || {}).each_with_object({}) do |(k, v), h|
    h[k] = (v.is_a?(Date) ? v : Date.iso8601(v.to_s))
  rescue ArgumentError
    next # skip a malformed entry rather than abort the build
  end
rescue StandardError
  {}
end

# The date we file an image under. A manual override wins outright (human authority).
# Otherwise prefer a real capture date (filename stamp, then embedded EXIF) but ONLY
# when it is sane (>= site epoch, not in the future) AND earlier than the git-add date.
# That last guard is the whole game: a true capture precedes the commit, while a resize
# date lands at or after it — so the existing wall (no embedded date, no dated names)
# falls straight through to git-add.
def capture_or_git_date(abs_path, name, overrides = {})
  ov = overrides[name]
  return ov if ov && ov <= Date.today # never file a photo in the future
  git_date = git_added_date(abs_path)
  cap = filename_date(name) || exif_capture_date(abs_path)
  return git_date unless cap && cap >= SITE_EPOCH && cap <= Date.today && cap < git_date
  cap
end

# --- HEIC import: iPhone photos -> web JPEG, dated, originals removed -----------
# iPhone HEICs carry an accurate EXIF capture date, but mdls reports it in BOTH the
# content and FS fields, so the content!=FS discriminator (used to spot a stripped
# JPEG's resize date) would miss it. For HEIC we trust the content date directly,
# falling back to a dated filename, then mtime.
def heic_capture_date(abs_path, name)
  out, st = Open3.capture2("mdls", "-name", "kMDItemContentCreationDate", abs_path)
  iso = out[/(\d{4}-\d{2}-\d{2})/, 1] if st.success?
  cap = (Date.iso8601(iso) rescue nil) if iso
  cap = nil unless cap && cap >= SITE_EPOCH && cap <= Date.today
  cap || filename_date(name) || File.mtime(abs_path).to_date
end

def unique_jpg(base)
  return "#{base}.jpg" unless File.exist?(File.join(GALLERY_DIR, "#{base}.jpg"))
  i = 2
  i += 1 while File.exist?(File.join(GALLERY_DIR, "#{base}_#{i}.jpg"))
  "#{base}_#{i}.jpg"
end

# Convert every HEIC dropped into the gallery to a web JPEG before the scan: resize to
# a sane max (HEICs are ~4000px / 1MB+), keep the EXIF, and stamp the capture date into
# the filename so dating stays correct even if sips drops metadata; then delete the
# HEIC. macOS-only (sips), same as auge. Returns the new JPEG names.
def convert_heics!(quiet:)
  heics = Dir.children(GALLERY_DIR).select { |f| HEIC_EXTS.include?(File.extname(f).downcase) }.sort
  return [] if heics.empty?
  warn "Converting #{heics.size} HEIC file(s) to JPEG…" unless quiet
  heics.filter_map do |name|
    abs  = File.join(GALLERY_DIR, name)
    date = heic_capture_date(abs, name)
    jpg  = unique_jpg("#{File.basename(name, File.extname(name))}_#{date.strftime('%Y%m%d')}")
    out  = File.join(GALLERY_DIR, jpg)
    ok = system("sips", "-s", "format", "jpeg", "-s", "formatOptions", "82",
                "-Z", "1600", abs, "--out", out, out: File::NULL, err: File::NULL)
    if ok && File.exist?(out)
      File.delete(abs)
      warn format("  ⤳ %-24s → %s  (%s)", name, jpg, date) unless quiet
      jpg
    else
      warn "  ! sips could not convert #{name} — left in place"
      nil
    end
  end
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

def alt_text(type, year, m, name = nil)
  if type == "performer" && name && !name.empty?
    return "IN YOUR FACE Comedy, #{name} performing stand-up in Zürich (#{year})"
  end
  scene = SCENE.fetch(type)
  scene = "a live music and comedy moment" if type == "moment" && (m[:labels] & %w[music concert]).any?
  "IN YOUR FACE Comedy, #{scene} in Zürich (#{year})"
end

# slug => display name, read from the Grist-generated _comedians/*.md `title:`.
# Read-only: we never write those files. Used to name a comedian in their alt text.
def comedian_names
  Dir.glob(File.join(COMEDIANS_DIR, "*.md")).each_with_object({}) do |f, h|
    slug = name = nil
    File.foreach(f, encoding: "UTF-8") do |line|
      slug ||= Regexp.last_match(1) if line =~ /^slug:\s*"?([^"\n]+?)"?\s*$/
      name ||= Regexp.last_match(1) if line =~ /^title:\s*"?([^"\n]+?)"?\s*$/
      break if slug && name
    end
    h[slug] = name if slug && name
  end
end

# Once a performer frame is tagged with a comedian, name them in the alt text
# ("…, Jane Doe performing stand-up in Zürich (2025)"). Run after entries are
# assembled (build) and after tagging, so both paths agree and it stays idempotent
# — re-deriving the same alt from the slug each time. Untagged / "none" frames and
# unknown slugs keep the generic alt.
def apply_comedian_alt!(entries, names)
  entries.each do |e|
    next unless e["type"] == "performer"
    slug = e["comedian"].to_s.strip
    next if slug.empty? || slug == "none"
    nm = names[slug]
    e["alt"] = "IN YOUR FACE Comedy, #{nm} performing stand-up in Zürich (#{e['year']})" if nm
  end
end

# --- era bucketing (timeline sections) ----------------------------------------
# "Recent" is the whole current calendar year; every earlier year gets its own
# section. (Was a rolling 120-day window, which split the current year into a
# "Recent" block plus a redundant current-year heading.)
def era_for(date, today)
  (date.year == today.year) ? "recent" : date.year.to_s
end

def era_label(era)
  era == "recent" ? "Recent" : era
end

# Within "Recent" we trade strict chronology for a lively type-mix: moments, audience
# and comedian frames are interleaved instead of arriving in same-type blocks. A
# largest-remaining draw (jittered) spreads the dominant type evenly; a fixed seed keeps
# the order stable across rebuilds so the build stays idempotent. Older year sections
# stay in date order — only Recent is shuffled.
RECENT_SHUFFLE_SEED = 0x1FACE

def interleave_recent(list)
  rng = Random.new(RECENT_SHUFFLE_SEED)
  buckets = list.group_by { |e| e["type"] }
  buckets.each_value { |v| v.sort_by! { |e| e["src"] }; v.shuffle!(random: rng) }
  # Give each frame a position in [0,1) spread evenly *within its type*, then order the
  # whole set by that position. Even per-type spacing makes the dominant type land at
  # regular intervals (no opening block); small jitter avoids a rigid A-B-C pattern.
  buckets.flat_map { |_type, items|
    n = items.size
    items.each_with_index.map { |e, i| [(i + 0.5) / n + (rng.rand - 0.5) / (2.0 * n), e] }
  }.sort_by { |pos, _| pos }.map { |_, e| e }
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

# True when HEAD points at a branch (not detached). `symbolic-ref -q HEAD` exits
# non-zero on a detached HEAD; we silence its stdout (the ref name) either way.
def on_a_branch?
  system("git", "-C", REPO_ROOT, "symbolic-ref", "-q", "HEAD",
         out: File::NULL, err: File::NULL)
end

# Stage the given paths, commit if anything changed, and push. Best-effort: a git
# failure warns but never aborts. Stages ONLY the named paths (never `add -A`), so
# unrelated working-tree changes are left alone. Mirrors sync-comedians.rb, which
# commits its generated data + images straight to master.
def git_commit_push(paths, message, push:)
  # Detached HEAD guard: a commit here would strand on no branch and can't be pushed
  # (the raw git error is cryptic). Bail before committing — the generated data is
  # already saved in the working tree, so reattaching and re-running loses nothing.
  unless on_a_branch?
    warn "  ! git: HEAD is detached (not on a branch) — skipping commit + push."
    warn "    Your changes are saved in the working tree. Reattach, then re-run:"
    warn "      git -C #{REPO_ROOT} checkout master"
    return
  end
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
  today     = Date.today
  convert_heics!(quiet: quiet) # iPhone HEIC -> dated web JPEG, originals removed, pre-scan
  overrides = load_date_overrides
  existing  = load_entries.each_with_object({}) { |e, h| h[e["src"]] = e }
  files     = gallery_files
  present  = files.map { |n| "#{WEB_PREFIX}/#{n}" }
  before   = File.exist?(OUT_FILE) ? File.read(OUT_FILE) : ""

  warn "Scanning #{files.size} gallery images (#{existing.size} already known)…" unless quiet
  added = []
  entries = files.map do |name|
    src  = "#{WEB_PREFIX}/#{name}"
    abs  = File.join(GALLERY_DIR, name)
    prev = existing[src]

    if prev && !rebuild
      # Keep the stored date so rebuilds are idempotent (git-add date drifts once a file
      # is committed; recomputing it would re-date the wall every run). A manual override
      # still wins, so dates can be corrected without a full --rebuild.
      date = overrides[name] || (Date.iso8601(prev["date"]) rescue capture_or_git_date(abs, name, overrides))
      type, faces, humans = prev["type"], prev["faces"], prev["humans"]
      aes, alt, comedian  = prev["aesthetic"], prev["alt"], prev["comedian"]
      util  = prev["utility"] == true
      score = util ? -999.0 : score_from(type, faces, aes)
    else
      date = capture_or_git_date(abs, name, overrides)
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

    # A human comedian tag is authoritative: that frame is a performer, even if auge
    # filed it as audience/moment — and this survives a --rebuild re-analysis. Set via
    # the `reclassify` command. Recompute the headline score for the corrected type.
    if comedian.to_s.strip != "" && comedian.to_s.strip != "none" && type != "performer"
      type  = "performer"
      score = util ? -999.0 : score_from(type, faces, aes)
    end

    era = era_for(date, today)
    { "src" => src, "date" => date.iso8601, "year" => date.year,
      "era" => era, "era_label" => era_label(era), "type" => type,
      "faces" => faces, "humans" => humans, "aesthetic" => aes,
      "utility" => util, "comedian" => comedian, "alt" => alt, "_score" => score }
  end

  removed = existing.values.reject { |e| present.include?(e["src"]) }

  apply_comedian_alt!(entries, comedian_names) # name the comedian in tagged alt text
  assign_featured!(entries)
  entries.each { |e| e.delete("_score") }

  # Recent (current year) first as a type-mixed block; older years newest-first and
  # chronological within each section.
  recent = entries.select { |e| e["era"] == "recent" }
  older  = entries.reject { |e| e["era"] == "recent" }
  older.sort_by! { |e| [e["date"], e["src"]] }.reverse!
  entries.replace(interleave_recent(recent) + older)
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

  apply_comedian_alt!(entries, comedian_names) # name freshly-tagged comedians in alt
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

# =============================================================================
# reclassify — rescue comedian frames that auge filed as audience/moment
# =============================================================================
# auge sometimes reads a comedian shot as audience or moment (a lone figure taken
# for a face in a crowd, a wide stage read as a venue moment). Walk those frames
# NEWEST FIRST, preview each, and on a slug the frame becomes a performer tagged to
# that comedian. The build then treats the comedian tag as authoritative, so the
# correction sticks even through a --rebuild.
def cmd_reclassify(open_preview:, ping:, git:)
  entries = load_entries
  abort "No _data/gallery.yml yet — run `build` first." if entries.empty?
  slugs = known_slugs

  queue = entries.select { |e| %w[audience moment].include?(e["type"]) }
                 .sort_by { |e| [e["date"], e["src"]] }.reverse # newest first
  if queue.empty?
    puts "Nothing to review — no audience/moment frames."
    return
  end

  # Same tab-completion as `tag`: prefix matches first, then a substring fallback.
  slug_list = slugs.to_a.sort
  Readline.completion_append_character = " "
  Readline.completion_proc = proc do |s|
    pre = slug_list.grep(/^#{Regexp.escape(s)}/i)
    pre.empty? ? slug_list.grep(/#{Regexp.escape(s)}/i) : pre
  end

  puts "#{queue.size} audience/moment frame(s) to review, newest first. If a frame is"
  puts "really a comedian on stage, type their slug (Tab to autocomplete) to reclassify it"
  puts "as a performer. Otherwise:  [enter]=leave as-is   l=list   q=save & quit"
  touched = Set.new
  count   = 0
  quit    = false

  queue.each_with_index do |e, i|
    break if quit
    abs = File.join(REPO_ROOT, e["src"].sub(%r{^/}, ""))
    system("open", abs) if open_preview # preview in Preview.app (non-blocking)

    loop do
      prompt = "\n[#{i + 1}/#{queue.size}] #{File.basename(e['src'])} (#{e['date']}, now #{e['type']})  comedian slug> "
      input = Readline.readline(prompt, true) # nil on Ctrl-D
      if input.nil? then quit = true; break end
      input = input.strip
      case input
      when ""  then break                                   # leave as audience/moment
      when "q" then quit = true; break
      when "l" then puts "  " + slug_list.join(", "); next
      else
        assign = lambda do |slug|
          e["type"] = "performer"; e["comedian"] = slug
          touched << slug; count += 1
        end
        if slugs.include?(input)
          assign.call(input); break
        else
          print "  '#{input}' isn't a known comedian slug. Use it anyway? [y/N] "
          ans = $stdin.gets&.strip&.downcase
          if ans == "y" then assign.call(input); break end
          # otherwise re-prompt
        end
      end
    end
  end

  apply_comedian_alt!(entries, comedian_names) # name the reclassified comedians in alt
  write_entries(entries)
  if count.zero?
    puts "\nNo reclassifications."
    return
  end
  puts "\nSaved. Reclassified #{count} frame(s) to comedian(s): #{touched.to_a.sort.join(', ')}"

  git_commit_push(["_data/gallery.yml"],
                  "gallery: reclassify #{count} photo(s) to comedians — #{touched.to_a.sort.join(', ')}",
                  push: true) if git

  submit_indexnow(["#{SITE_URL}/moments/"] + touched.map { |s| comedian_url(s) }) if ping
end

# --- dispatch -----------------------------------------------------------------
USAGE = <<~TXT
  build-gallery-data.rb — manage the /moments/ gallery and its metadata.

  USAGE
    ./script/build-gallery-data.rb [build] [options]
    ./script/build-gallery-data.rb tag [options]
    ./script/build-gallery-data.rb reclassify [options]

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
    reclassify    Walk audience/moment frames NEWEST FIRST, open each in Preview, and
                  for any that are really a comedian on stage, type the slug to flip it
                  to a performer tagged to that comedian. The build treats the comedian
                  tag as authoritative, so the fix survives a --rebuild. Commits +
                  pushes and pings the same as tag.

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
    reclassify:
      --no-open   Don't open Preview (scripted / headless review).
      --no-git    Don't commit/push; leave changes in the working tree.
      --no-ping   Don't submit to IndexNow.
    -h, --help    Show this help.

  EXAMPLES
    ./script/build-gallery-data.rb                  # rebuild, commit+push, ping
    ./script/build-gallery-data.rb build --rebuild  # full re-analysis
    ./script/build-gallery-data.rb tag              # attribute comedian photos
    ./script/build-gallery-data.rb reclassify       # rescue misclassified comedian shots
    ./script/build-gallery-data.rb build --no-git   # update data only, no commit

  auge (Apple Vision) is macOS-only; the committed _data/gallery.yml is what
  CI/Netlify read. See CLAUDE.md § "The gallery is generated too".
TXT

# Only dispatch when run directly. Required so tests can `require` this file to
# exercise the pure helpers (filename_date, capture_or_git_date, …) without a build.
if __FILE__ == $PROGRAM_NAME
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
  when "reclassify"
    cmd_reclassify(open_preview: !ARGV.include?("--no-open"), ping: ping, git: git)
  else
    warn "Unknown command '#{command}'.\n\n"
    abort USAGE
  end
end

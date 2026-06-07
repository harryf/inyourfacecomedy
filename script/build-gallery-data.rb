#!/usr/bin/env ruby
# frozen_string_literal: true

# build-gallery-data.rb — generate _data/gallery.yml for the /moments/ timeline.
#
# For every image in assets/img/gallery/ this computes, once, the metadata the
# gallery template needs to feel like a timeline rather than a random wall:
#
#   * date     — when the image first entered git history (the "moment" it
#                appeared). Falls back to file mtime for anything not yet
#                committed. EXIF on these files is just the resize date, so git
#                is the honest signal — see CLAUDE.md, "look in Git history".
#   * faces /
#     humans   — Apple Vision counts (via `auge`). Many faces => the audience
#                reacting; one or two => a performer on stage. Harry's heuristic:
#                "more than three faces, probably the audience reacting" — those
#                are the photos that sell the experience, so we surface them.
#   * type     — audience | performers | performer | moment
#   * featured — the shots worth showing large (audience reactions + strong
#                single-performer frames). Drives the 2x2 mosaic tiles.
#   * alt      — SEO alt text, always anchored on "IN YOUR FACE Comedy" + Zürich
#                + the year, so every image carries a distinct, honest caption.
#
# auge is Apple Vision: macOS only. So this runs locally and commits the YAML.
# The Jekyll build (Linux CI / Netlify) only ever reads the committed _data file.
# Same division of labour as sync-comedians.rb.
#
# Usage:
#   ruby script/build-gallery-data.rb           # rebuild _data/gallery.yml
#   ruby script/build-gallery-data.rb --quiet    # no per-file logging

Encoding.default_external = Encoding::UTF_8 # cron/US-ASCII guard (Zürich, ü)

require "json"
require "yaml"
require "date"
require "open3"
require "time"
require "set"

REPO_ROOT    = File.expand_path("..", __dir__)
GALLERY_DIR  = File.join(REPO_ROOT, "assets", "img", "gallery")
WEB_PREFIX   = "/assets/img/gallery"
OUT_FILE     = File.join(REPO_ROOT, "_data", "gallery.yml")
IMAGE_EXTS   = %w[.jpg .jpeg .png .webp .gif].freeze
RECENT_DAYS  = 120 # "the last few months" — the rolling "Recent" era

QUIET = ARGV.include?("--quiet")
def log(msg) = QUIET ? nil : warn(msg)

# --- date: when did this image first appear in git history? -------------------
def git_added_date(abs_path)
  rel = abs_path.sub("#{REPO_ROOT}/", "")
  # Oldest "Added" commit touching the file = the moment it entered the repo.
  out, _ = Open3.capture2("git", "-C", REPO_ROOT, "log", "--diff-filter=A",
                          "--format=%aI", "--", rel)
  iso = out.lines.map(&:strip).reject(&:empty?).last
  # Fallback: any commit touching it (renamed/odd-history files).
  if iso.nil?
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

def analyze(abs_path)
  faces  = auge("faces",  abs_path)["count"].to_i
  humans = auge("humans", abs_path)["count"].to_i
  aest   = auge("aesthetics", abs_path)["aesthetics"] || {}
  labels = (auge("classify", abs_path)["classifications"] || [])
           .select { |c| c["confidence"].to_f >= 0.5 }
           .map { |c| c["label"] }
  {
    faces: faces, humans: humans, labels: labels,
    aesthetic: (aest["overall"] || 0).to_f,
    utility:   aest["isUtility"] == true
  }
end

# --- interpretation: what is this a picture of, and is it a keeper? -----------
STAGE_LABELS = %w[performance stage music musical_instrument microphone concert
                  entertainment singing dance].freeze

FEATURED_FRACTION = 0.22 # share of the wall that renders as large 2x2 mosaic tiles

def classify_type(m)
  if m[:faces] >= 3 || m[:humans] >= 5
    "audience"        # the room reacting — Harry's "more than three faces"
  elsif m[:faces] == 2
    "performers"      # a duo / two on stage
  elsif m[:faces] == 1 || (m[:labels] & STAGE_LABELS).any?
    "performer"       # one comedian, mic in hand
  else
    "moment"          # venue, details, in-between
  end
end

# Within its category, how much this frame deserves to headline. Audience shots
# rank by the number of laughing faces (Harry's metric), tie-broken on aesthetics;
# performer and "moment" frames rank on the Vision aesthetics score. Utility frames
# (screenshots, flyers) are floored out entirely.
def headline_score(type, m)
  return -999.0 if m[:utility]
  type == "audience" ? (m[:faces] + m[:aesthetic] * 0.1) : m[:aesthetic]
end

# Featured tiles render large (2x2) in the mosaic. We want a *mix* — the audience
# reactions that sell the room AND the best comedian frames — so we feature each
# pool separately rather than letting one type dominate one global ranking. The
# split is biased toward reactions but keeps comedians well represented, and the
# whole featured set stays near FEATURED_FRACTION of the wall.
def assign_featured!(entries)
  live = entries.reject { |e| e["_score"] <= -900 }
  target = (entries.size * FEATURED_FRACTION).round

  reactions = live.select { |e| e["type"] == "audience" }
                  .sort_by { |e| -e["_score"] }
  performers = live.select { |e| %w[performer performers].include?(e["type"]) }
                   .sort_by { |e| -e["_score"] }
  moments = live.select { |e| e["type"] == "moment" }
                .sort_by { |e| -e["_score"] }

  featured = (reactions.first((target * 0.55).round) +
              performers.first((target * 0.40).round) +
              moments.first((target * 0.05).ceil)).to_set

  entries.each { |e| e["featured"] = featured.include?(e) }
end

# --- SEO alt text: honest, distinct, brand- + place- + year-anchored ----------
SCENE = {
  "audience"   => "the audience laughing during a live English stand-up comedy show",
  "performers" => "comedians on stage during a live English stand-up comedy show",
  "performer"  => "a comedian performing stand-up on stage",
  "moment"     => "a moment from an English stand-up comedy night"
}.freeze

def alt_text(type, year, m)
  scene = SCENE.fetch(type)
  scene = "a live music and comedy moment" if type == "moment" && (m[:labels] & %w[music concert]).any?
  "IN YOUR FACE Comedy — #{scene} in Zürich (#{year})"
end

# --- era bucketing (timeline sections) ----------------------------------------
def era_for(date, today)
  ((today - date).to_i <= RECENT_DAYS) ? "recent" : date.year.to_s
end

def era_label(era)
  era == "recent" ? "Right now" : era
end

# --- main ---------------------------------------------------------------------
today = Date.today
files = Dir.children(GALLERY_DIR)
           .reject { |f| f.start_with?(".") }
           .select { |f| IMAGE_EXTS.include?(File.extname(f).downcase) }
           .sort

log "Scanning #{files.size} gallery images with auge…"

entries = files.map.with_index do |name, i|
  abs  = File.join(GALLERY_DIR, name)
  date = git_added_date(abs)
  m    = analyze(abs)
  type = classify_type(m)
  era  = era_for(date, today)
  log format("  [%3d/%d] %-32s %s  %-10s faces=%d hum=%d aes=%.2f",
             i + 1, files.size, name, date, type, m[:faces], m[:humans],
             m[:aesthetic]) unless QUIET

  {
    "src"      => "#{WEB_PREFIX}/#{name}",
    "date"     => date.iso8601,
    "year"     => date.year,
    "era"      => era,
    "era_label" => era_label(era),
    "type"     => type,
    "faces"    => m[:faces],
    "humans"   => m[:humans],
    "aesthetic" => m[:aesthetic].round(3),
    "alt"      => alt_text(type, date.year, m),
    "_score"   => headline_score(type, m)
  }
end

assign_featured!(entries)
entries.each { |e| e.delete("_score") }

# Newest first; stable tiebreak so the file (and the page) is deterministic.
entries.sort_by! { |e| [e["date"], e["src"]] }
entries.reverse!

header = <<~YAML
  # _data/gallery.yml — GENERATED by script/build-gallery-data.rb. Do not hand-edit.
  # Drives the /moments/ timeline gallery (newest first). Regenerate on macOS after
  # adding photos to assets/img/gallery/:  ruby script/build-gallery-data.rb
  # auge (Apple Vision) is macOS-only; CI/Netlify only read this committed file.
YAML

File.write(OUT_FILE, header + entries.to_yaml.sub(/\A---\n/, ""))

feat = entries.count { |e| e["featured"] }
byt  = entries.group_by { |e| e["type"] }.transform_values(&:size)
log ""
log "Wrote #{entries.size} entries → #{OUT_FILE.sub("#{REPO_ROOT}/", '')}"
log "Featured: #{feat}/#{entries.size}   Types: #{byt}"
log "Eras: #{entries.group_by { |e| e['era'] }.transform_values(&:size)}"

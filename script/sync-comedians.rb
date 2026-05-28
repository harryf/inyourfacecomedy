#!/usr/bin/env ruby
# frozen_string_literal: true

# Sync the Comedians table from Grist into the Jekyll `_comedians/` collection.
# Designed for a local cron job on Harry's Mac — uses macOS `sips` for photo
# resize so it has no gem dependencies beyond Ruby stdlib.
#
# Behaviour:
#   - Reads GRIST_API_KEY from environment (never read from a file in-repo).
#   - For every row with Live=true and a Slug:
#       * Whitelist-projects the public fields (Phone/Email never written).
#       * Downloads the photo attachment, resizes via `sips` until ≤95KB.
#       * Writes _comedians/<slug>.md with the layout: comedian frontmatter.
#   - For every existing _comedians/<slug>.md whose comedian is NOT Live (or
#     missing from the table), DELETES the file AND the matching photo.
#   - Idempotent: re-running with no source change produces no filesystem diff.
#
# Usage:
#   GRIST_API_KEY=xxxx ruby script/sync-comedians.rb            # do the work
#   GRIST_API_KEY=xxxx ruby script/sync-comedians.rb --dry-run  # don't write
#   ruby script/sync-comedians.rb --help

require "net/http"
require "uri"
require "json"
require "fileutils"
require "tempfile"
require "open3"
require "time"   # Time#iso8601

# -----------------------------------------------------------------------------
# Configuration — keep in sync with grist_api_example.py
# -----------------------------------------------------------------------------
TEAM   = "inyourfacecomedy"
DOC_ID = "6idWaHUKEeZN"
TABLE  = "Comedians"

# Public-field allowlist. Phone and Email are intentionally absent so they
# can never reach the public site even by accident.
# Grist exposes columns via snake_case IDs (Stage_Name, not "Stage Name") —
# this list MUST use those IDs or the projection silently drops to "".
PUBLIC_FIELDS = [
  "Stage_Name", "Slug", "Bio",
  "Instagram", "TikTok", "Facebook_Page", "X", "Website", "YouTube_Channel"
].freeze

# Photo size budget: Harry asked for <100KB, we target ≤95KB to leave headroom.
PHOTO_MAX_BYTES = 95 * 1024
# Iterative resize knobs — walk dimension down first; if still too big at the
# min dimension, walk JPEG quality down through the ladder before giving up.
PHOTO_START_DIMENSION = 800
PHOTO_MIN_DIMENSION   = 300
PHOTO_DIM_STEP        = 100
PHOTO_QUALITY_LADDER  = [75, 60, 45, 30].freeze

# Repo paths — script assumes it lives at <repo>/script/.
REPO_ROOT     = File.expand_path("..", __dir__)
COMEDIANS_DIR = File.join(REPO_ROOT, "_comedians")
PHOTO_DIR     = File.join(REPO_ROOT, "assets/img/comedians")
# Index page that renders /comedians/ — its frontmatter `last_modified_at` is the
# freshness signal crawlers (Google, sitemap consumers) use to decide when to
# reindex the listing. Bumped only when a real comedian-page change happened
# this run (added, removed, content-modified); a no-op re-run leaves it alone.
INDEX_PAGE    = File.join(REPO_ROOT, "pages/7_comedians.md")

# Content-Type → file extension. Anything else falls back to jpg.
CONTENT_TYPE_EXT = {
  "image/jpeg" => "jpg",
  "image/jpg"  => "jpg",
  "image/png"  => "png",
  "image/webp" => "webp",
  "image/gif"  => "gif"
}.freeze

# Front-matter key mapping: Grist column ID → Jekyll key. Lowercased so Liquid
# templates can read e.g. `page.facebook_page` cleanly.
FIELD_TO_KEY = {
  "Instagram"       => "instagram",
  "TikTok"          => "tiktok",
  "Facebook_Page"   => "facebook_page",
  "X"               => "x",
  "YouTube_Channel" => "youtube_channel",
  "Website"         => "website"
}.freeze

# -----------------------------------------------------------------------------
# CLI
# -----------------------------------------------------------------------------
DRY_RUN   = ARGV.include?("--dry-run")
VERBOSE   = ARGV.include?("--verbose") || DRY_RUN
NO_COMMIT = ARGV.include?("--no-commit")

if ARGV.include?("--help") || ARGV.include?("-h")
  puts <<~USAGE
    Usage: GRIST_API_KEY=xxxx ruby script/sync-comedians.rb [options]
           # or drop a `.env` file at the repo root with `GRIST_API_KEY=...`

      --dry-run    Print what would change; write nothing, commit nothing, push nothing.
      --no-commit  Sync files but don't `git add/commit/push` afterwards.
      --verbose    Verbose logging (implied by --dry-run).
      --help       Show this message.

    Default behaviour: after a successful sync that changed files under
    `_comedians/` or `assets/img/comedians/`, the script runs
    `git pull --ff-only`, stages those two directories, commits with a
    message naming the counts, and pushes the current branch.
  USAGE
  exit 0
end

# Load GRIST_API_KEY from a repo-root `.env` if it isn't already in the environment.
# Minimal parser: KEY=VALUE per line, optional surrounding quotes, # comments, blank
# lines ignored. Existing ENV always wins (so cron-set vars override the file).
def load_dotenv(path)
  return unless File.exist?(path)
  File.foreach(path) do |raw|
    line = raw.strip
    next if line.empty? || line.start_with?("#")
    key, _, value = line.partition("=")
    key.strip!
    value = value.strip.sub(/\A(['"])(.*)\1\z/, '\2')
    ENV[key] ||= value unless key.empty?
  end
end

load_dotenv(File.join(REPO_ROOT, ".env"))

API_KEY = ENV["GRIST_API_KEY"]
if API_KEY.nil? || API_KEY.strip.empty?
  warn "ERROR: GRIST_API_KEY is not set. Export it, or add it to #{File.join(REPO_ROOT, '.env')}."
  exit 1
end

BASE_URI    = URI("https://#{TEAM}.getgrist.com/api/docs/#{DOC_ID}")
AUTH_HEADER = { "Authorization" => "Bearer #{API_KEY}" }.freeze

# -----------------------------------------------------------------------------
# HTTP helpers
# -----------------------------------------------------------------------------
def http_get(path)
  uri = URI.join("#{BASE_URI}/", path)
  Net::HTTP.start(uri.host, uri.port, use_ssl: true, read_timeout: 60) do |http|
    req = Net::HTTP::Get.new(uri.request_uri)
    AUTH_HEADER.each { |k, v| req[k] = v }
    http.request(req)
  end
end

def fetch_records
  resp = http_get("tables/#{TABLE}/records")
  unless resp.is_a?(Net::HTTPSuccess)
    raise "Grist fetch_records failed: HTTP #{resp.code} #{resp.message}"
  end
  JSON.parse(resp.body).fetch("records")
end

def download_attachment(attachment_id)
  resp = http_get("attachments/#{attachment_id}/download")
  unless resp.is_a?(Net::HTTPSuccess)
    raise "Grist attachment #{attachment_id} download failed: HTTP #{resp.code}"
  end
  ctype = (resp["Content-Type"] || "image/jpeg").split(";").first.to_s.strip.downcase
  ext   = CONTENT_TYPE_EXT[ctype] || "jpg"
  [resp.body, ext]
end

# -----------------------------------------------------------------------------
# Photo pipeline — uses macOS sips. No gem deps. Iteratively resamples until
# the file is ≤PHOTO_MAX_BYTES, or fails loudly after exhausting the budget.
# -----------------------------------------------------------------------------
def shell_out(*cmd)
  out, status = Open3.capture2e(*cmd)
  raise "command failed (#{cmd.inspect}): #{out}" unless status.success?
  out
end

def resize_photo(raw_bytes, source_ext, dest_path)
  # Always normalise to JPEG. PNG and WebP are lossless / variably supported by
  # sips, so the quality ladder only meaningfully bites when the output format
  # is JPEG. Comedian headshots don't need transparency; the size win is worth
  # more than the format match.
  target_ext    = "jpg"
  target_format = "jpeg"
  final_path    = dest_path.sub(/\.[a-z]+\z/i, ".#{target_ext}")

  # Stage the raw download in a tempfile with its source extension so sips
  # reads the format correctly.
  Tempfile.create(["comedian-src", ".#{source_ext}"]) do |src|
    src.binmode
    src.write(raw_bytes)
    src.flush

    FileUtils.mkdir_p(File.dirname(final_path))

    converged = false

    # Pass 1 — walk dimension down at the default (highest) quality.
    quality = PHOTO_QUALITY_LADDER.first
    dimension = PHOTO_START_DIMENSION
    while dimension >= PHOTO_MIN_DIMENSION
      shell_out(
        "sips",
        "-s", "format", target_format,
        "-s", "formatOptions", quality.to_s,
        "--resampleHeightWidthMax", dimension.to_s,
        src.path,
        "--out", final_path
      )
      size = File.size(final_path)
      log "    sips pass: dim=#{dimension} q=#{quality} → #{(size / 1024.0).round(1)}KB"
      if size <= PHOTO_MAX_BYTES
        converged = true
        break
      end
      dimension -= PHOTO_DIM_STEP
    end

    # Pass 2 — at the min dimension, walk quality down the ladder.
    unless converged
      PHOTO_QUALITY_LADDER.drop(1).each do |q|
        shell_out(
          "sips",
          "-s", "format", target_format,
          "-s", "formatOptions", q.to_s,
          "--resampleHeightWidthMax", PHOTO_MIN_DIMENSION.to_s,
          src.path,
          "--out", final_path
        )
        size = File.size(final_path)
        log "    sips pass: dim=#{PHOTO_MIN_DIMENSION} q=#{q} → #{(size / 1024.0).round(1)}KB"
        if size <= PHOTO_MAX_BYTES
          converged = true
          break
        end
      end
    end

    unless converged
      File.delete(final_path) if File.exist?(final_path)
      raise "could not shrink photo below #{PHOTO_MAX_BYTES} bytes " \
            "(min dim=#{PHOTO_MIN_DIMENSION}, min quality=#{PHOTO_QUALITY_LADDER.last})"
    end
  end

  final_path
end

# -----------------------------------------------------------------------------
# Markdown frontmatter writer
# -----------------------------------------------------------------------------
def yaml_escape(value)
  return '""' if value.nil? || value.to_s.empty?
  # Always double-quote and escape \ and " — safe for all single-line strings.
  '"' + value.to_s.gsub('\\', '\\\\').gsub('"', '\\"') + '"'
end

# Meta-description budget. Google truncates SERP snippets around 155-160 chars,
# but og:description / Slack / Twitter cards happily render up to ~300 — 200
# is the negotiated middle so longer bios survive (verified: Martina's 221-char
# bio now needs only ~30 chars of trim).
META_DESCRIPTION_MAX = 200

# Build the `<meta name="description">` text for one comedian. Uses the bio if
# present (collapsed to one line, word-boundary truncated with ellipsis), else
# falls back to a brand-voiced one-liner so the SERP snippet stays useful.
def description_for(name, bio)
  cleaned = bio.to_s.gsub(/\s+/, " ").strip
  if cleaned.empty?
    "#{name} performs English stand-up comedy with IN YOUR FACE in Zürich, Switzerland."
  elsif cleaned.length <= META_DESCRIPTION_MAX
    cleaned
  else
    trimmed = cleaned[0, META_DESCRIPTION_MAX]
    last_space = trimmed.rindex(" ") || META_DESCRIPTION_MAX
    # Drop trailing sentence/clause punctuation so the appended ellipsis doesn't
    # render as e.g. "strategy.…" — keep words, lose dangling marks.
    base = trimmed[0, last_space].rstrip.sub(/[\.,;:!?…]+\z/, "")
    base + "…"
  end
end

# Strip the `last_modified_at: ...` line from a file's text so the rest of the
# content can be compared for "data unchanged" semantics. Idempotent re-runs
# must preserve the existing timestamp; only real data changes bump it.
LAST_MODIFIED_RE = /^last_modified_at:\s*.*\R?/.freeze

def existing_last_modified_at(page_path)
  return nil unless File.exist?(page_path)
  File.read(page_path)[/^last_modified_at:\s*(.+)$/, 1]&.strip&.gsub(/\A["']|["']\z/, "")
end

def write_comedian_page(slug, fields, photo_web_path)
  page_path = File.join(COMEDIANS_DIR, "#{slug}.md")
  FileUtils.mkdir_p(COMEDIANS_DIR)

  # Bio is a paragraph — write it as a YAML block scalar so multi-line bios
  # stay intact for `| markdownify`.
  bio = fields["Bio"].to_s
  bio_block = if bio.empty?
                'bio: ""'
              else
                "bio: |\n" + bio.lines.map { |ln| "  #{ln.chomp}" }.join("\n")
              end

  name        = fields["Stage_Name"].to_s
  description = description_for(name, bio)

  # Build the data-bearing frontmatter first — last_modified_at gets injected
  # AFTER the change-detection comparison so we can keep the timestamp stable
  # across no-op re-runs.
  data_lines = [
    "---",
    "layout: comedian",
    "title: #{yaml_escape(name)}",
    "description: #{yaml_escape(description)}",
    "slug: #{yaml_escape(slug)}",
    "photo: #{yaml_escape(photo_web_path)}"
  ]

  FIELD_TO_KEY.each do |grist_field, fm_key|
    data_lines << "#{fm_key}: #{yaml_escape(fields[grist_field])}"
  end

  data_lines << "image: #{yaml_escape(photo_web_path)}" unless photo_web_path.to_s.empty?
  data_lines << bio_block
  data_lines << "---"
  data_lines << ""

  data_only_content = data_lines.join("\n") + "\n"

  # Decide the timestamp: preserve existing if data didn't change, else now.
  existing_lm    = existing_last_modified_at(page_path)
  existing_data  = File.exist?(page_path) ? File.read(page_path).sub(LAST_MODIFIED_RE, "") : nil
  data_unchanged = existing_data == data_only_content && !existing_lm.nil?

  # Status surfaced to the caller — drives the index-page last_modified_at bump.
  # :unchanged contributes nothing; :created or :updated marks the listing as
  # needing a reindex signal for crawlers.
  status = if existing_data.nil?
             :created
           elsif data_unchanged
             :unchanged
           else
             :updated
           end

  timestamp = data_unchanged ? existing_lm : Time.now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")

  # Inject last_modified_at right after `description:` so SEO-relevant lines
  # cluster at the top of the frontmatter.
  final_lines = data_lines.dup
  insertion_idx = final_lines.index { |ln| ln.start_with?("description:") } || 2
  final_lines.insert(insertion_idx + 1, "last_modified_at: #{yaml_escape(timestamp)}")
  contents = final_lines.join("\n") + "\n"

  if DRY_RUN
    log "  [dry-run] would write #{page_path} (#{contents.bytesize} bytes, timestamp #{data_unchanged ? 'preserved' : 'updated'}, status=#{status})"
  else
    File.write(page_path, contents)
  end
  [page_path, status]
end

def delete_comedian(slug)
  page_path = File.join(COMEDIANS_DIR, "#{slug}.md")
  photo_glob = File.join(PHOTO_DIR, "#{slug}.*")

  removed_anything = false
  if File.exist?(page_path)
    if DRY_RUN
      log "  [dry-run] would delete #{page_path}"
    else
      File.delete(page_path)
    end
    removed_anything = true
  end

  Dir.glob(photo_glob).each do |photo_path|
    if DRY_RUN
      log "  [dry-run] would delete #{photo_path}"
    else
      File.delete(photo_path)
    end
    removed_anything = true
  end

  removed_anything
end

# -----------------------------------------------------------------------------
# Index page bump — refresh `last_modified_at` on the listing page that renders
# /comedians/, so Google (and other sitemap consumers) get a reindex signal when
# a new comedian appears or an existing one is removed/modified. The bump only
# fires when a real change happened this run; identical re-runs leave the page
# alone, which keeps the auto-commit from churning the index timestamp.
# -----------------------------------------------------------------------------
INDEX_LAST_MODIFIED_RE = /^last_modified_at:[^\n]*$/.freeze

def bump_index_last_modified_at
  unless File.exist?(INDEX_PAGE)
    warn "  ! index page #{INDEX_PAGE} missing — skipping last_modified_at bump"
    return
  end

  content   = File.read(INDEX_PAGE)
  timestamp = Time.now.utc.strftime("%Y-%m-%dT%H:%M:%S+00:00")
  new_line  = "last_modified_at: #{timestamp}"

  unless content =~ INDEX_LAST_MODIFIED_RE
    raise "no `last_modified_at:` line in #{INDEX_PAGE} — refusing to inject blindly"
  end

  new_content = content.sub(INDEX_LAST_MODIFIED_RE, new_line)

  if DRY_RUN
    log "  [dry-run] would bump #{File.basename(INDEX_PAGE)} last_modified_at → #{timestamp}"
  else
    File.write(INDEX_PAGE, new_content)
    log "index: bumped #{File.basename(INDEX_PAGE)} last_modified_at → #{timestamp}"
  end
end

# -----------------------------------------------------------------------------
# Logging
# -----------------------------------------------------------------------------
def log(msg)
  puts msg if VERBOSE
end

# -----------------------------------------------------------------------------
# Git auto-commit + push. Operates inside REPO_ROOT via `-C`, stages exactly
# two paths (`_comedians/`, `assets/img/comedians/`), never force-pushes, never
# bypasses hooks. ff-only pull before commit so a cron run during a manual
# edit aborts cleanly instead of creating a merge.
# -----------------------------------------------------------------------------
GIT_PATHS = ["_comedians/", "assets/img/comedians/", "pages/7_comedians.md"].freeze

def git_capture(*args)
  out, status = Open3.capture2e("git", "-C", REPO_ROOT, *args)
  [out.strip, status]
end

def git_run!(*args)
  out, status = git_capture(*args)
  unless status.success?
    raise "git #{args.join(' ')} failed: #{out}"
  end
  out
end

def has_git_changes?
  # Use `status --porcelain` rather than `diff HEAD`: `git diff` only sees TRACKED
  # files, so a sync that ONLY adds new comedians (untracked .md + photo) looked
  # "clean" and we returned without committing. `status --porcelain` reports
  # untracked, modified, and deleted paths alike — non-empty output means work to do.
  out, _ = git_capture("status", "--porcelain", "--", *GIT_PATHS)
  !out.empty?
end

def current_branch
  out, status = git_capture("rev-parse", "--abbrev-ref", "HEAD")
  raise "git could not resolve current branch: #{out}" unless status.success?
  out
end

def commit_and_push(written:, removed:)
  unless has_git_changes?
    log "git: no changes under #{GIT_PATHS.join(' or ')}, nothing to commit"
    return
  end

  if DRY_RUN
    log "  [dry-run] would git add #{GIT_PATHS.join(' ')}"
    log "  [dry-run] would git commit + push on branch #{current_branch}"
    return
  end

  branch = current_branch
  log "git: pulling --ff-only origin #{branch}"
  pull_out, pull_status = git_capture("pull", "--ff-only", "origin", branch)
  unless pull_status.success?
    raise "git pull --ff-only aborted (working tree diverged from origin): #{pull_out}"
  end

  log "git: adding #{GIT_PATHS.join(' ')}"
  git_run!("add", "--", *GIT_PATHS)

  message = "chore(comedians): sync from Grist (#{written} written, #{removed} removed)\n\n" \
            "Auto-generated by script/sync-comedians.rb on #{Time.now.utc.iso8601}."
  log "git: committing"
  git_run!("commit", "-m", message)

  log "git: pushing origin #{branch}"
  push_out, push_status = git_capture("push", "origin", branch)
  unless push_status.success?
    raise "git push failed: #{push_out}"
  end
  puts "git: pushed to origin/#{branch}"
end

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def attachment_id_from(value)
  # Grist returns either a bare int or ["L", id, ...]. Mirror the Python normalisation.
  return nil if value.nil?
  return value if value.is_a?(Integer)
  if value.is_a?(Array) && value.size > 1
    candidate = value[1]
    return candidate if candidate.is_a?(Integer)
  end
  nil
end

def main
  log "Fetching Comedians from Grist (doc=#{DOC_ID}, table=#{TABLE})..."
  records = fetch_records

  seen_slugs = []
  written = 0
  pages_changed = 0  # comedian pages actually created or modified this run

  records.each do |rec|
    fields = rec["fields"] || {}
    slug   = fields["Slug"].to_s.strip
    name   = fields["Stage_Name"].to_s.strip

    unless fields["Live"]
      log "  · skipping non-live: #{name.empty? ? '(unnamed)' : name}"
      next
    end

    if slug.empty?
      warn "  ! skipping row #{rec['id']} — no Slug"
      next
    end

    seen_slugs << slug
    log "  + processing: #{name} (#{slug})"

    # Project public-field allowlist; Phone/Email never enter this hash.
    public_fields = PUBLIC_FIELDS.each_with_object({}) { |k, h| h[k] = fields[k] }

    photo_web_path = nil
    attachment_id  = attachment_id_from(fields["Photo"])

    if attachment_id
      begin
        bytes, source_ext = download_attachment(attachment_id)
        if DRY_RUN
          log "  [dry-run] would resize #{name} photo (source #{source_ext}, #{bytes.bytesize} bytes)"
          photo_web_path = "/assets/img/comedians/#{slug}.jpg"
        else
          dest = File.join(PHOTO_DIR, "#{slug}.#{source_ext}")
          final_path = resize_photo(bytes, source_ext, dest)
          # Drop any sibling photos with a different extension (so a JPG→PNG
          # source-change doesn't leave a stale jpg around).
          Dir.glob(File.join(PHOTO_DIR, "#{slug}.*")).each do |existing|
            File.delete(existing) unless existing == final_path
          end
          photo_web_path = "/" + final_path.sub("#{REPO_ROOT}/", "")
        end
      rescue => e
        warn "  ! photo failed for #{slug}: #{e.message}"
      end
    else
      log "  · no photo attachment for #{name}"
    end

    _, status = write_comedian_page(slug, public_fields, photo_web_path)
    pages_changed += 1 unless status == :unchanged
    written += 1
  end

  # Removal pass: anything on disk that isn't in seen_slugs gets deleted.
  removed = 0
  if Dir.exist?(COMEDIANS_DIR)
    Dir.glob(File.join(COMEDIANS_DIR, "*.md")).each do |path|
      existing_slug = File.basename(path, ".md")
      next if seen_slugs.include?(existing_slug)
      log "  - removing: #{existing_slug} (no longer live)"
      removed += 1 if delete_comedian(existing_slug)
    end
  end

  # Orphan-photo sweep: catches the case where a comedian's slug changes in
  # Grist (old .md is removed, but the old photo would otherwise linger because
  # nothing in the page-iteration loop knows about it).
  if Dir.exist?(PHOTO_DIR)
    Dir.glob(File.join(PHOTO_DIR, "*.*")).each do |path|
      photo_slug = File.basename(path).sub(/\.[a-z]+\z/i, "")
      next if seen_slugs.include?(photo_slug)
      log "  - removing orphan photo: #{File.basename(path)}"
      if DRY_RUN
        log "  [dry-run] would delete #{path}"
      else
        File.delete(path)
      end
      removed += 1
    end
  end

  puts "comedians: #{written} written, #{removed} removed#{DRY_RUN ? ' (dry run)' : ''}"

  # Refresh the listing page's freshness signal only when a real comedian-page
  # change actually happened — a no-op re-run leaves the index alone, which
  # keeps the auto-commit gate quiet.
  if pages_changed > 0 || removed > 0
    bump_index_last_modified_at
  else
    log "index: #{pages_changed} page changes, #{removed} removals — #{File.basename(INDEX_PAGE)} last_modified_at unchanged"
  end

  commit_and_push(written: written, removed: removed) unless NO_COMMIT
end

begin
  main
rescue => e
  warn "FATAL: #{e.class}: #{e.message}"
  warn e.backtrace.first(8).join("\n") if VERBOSE
  exit 2
end

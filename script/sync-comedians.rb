#!/usr/bin/env ruby
# frozen_string_literal: true

# Sync the Comedians table from Grist into the Jekyll `_comedians/` collection.
# Designed for a local cron job on Harry's Mac — uses macOS `sips` for photo
# resize so it has no gem dependencies beyond Ruby stdlib.
#
# Behaviour:
#   - Reads GRIST_API_KEY from environment (never read from a file in-repo).
#   - For every row with Live=true, a Slug, AND a photo attachment in Grist:
#       * Whitelist-projects the public fields (Phone/Email never written).
#       * Downloads the photo attachment, resizes via `sips` until ≤95KB.
#       * Writes _comedians/<slug>.md with the layout: comedian frontmatter.
#   - A Live comedian with NO photo on Grist is treated as unpublished: skipped
#     and (if previously published) removed, exactly like a non-live row.
#   - INCREMENTAL: keeps a per-slug fingerprint snapshot in script/comedians-state.json.
#     A re-run skips any comedian whose text data AND photo (attachment-id list)
#     are unchanged — no download, no resize, no page rewrite. Only changed
#     comedians do work, so a quiet run is one API call and exits.
#   - For every existing _comedians/<slug>.md whose comedian is NOT Live (or
#     missing from the table, or now photoless), DELETES the file AND the photo.
#   - Idempotent: re-running with no source change produces no filesystem diff.
#
# Usage:
#   GRIST_API_KEY=xxxx ruby script/sync-comedians.rb            # do the work
#   GRIST_API_KEY=xxxx ruby script/sync-comedians.rb --dry-run  # don't write
#   ruby script/sync-comedians.rb --help

require "net/http"
require "uri"
require "json"
require "digest"  # SHA256 fingerprint for incremental change detection
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
  "Stage_Name", "Slug", "Bio", "Priority",
  "Instagram", "TikTok", "Facebook_Page", "X", "Website", "YouTube_Channel"
].freeze

# Priority tiers, lowest number = highest priority. Drives the /comedians/ page
# ordering (High first). Anything not in this map sorts to the end of the page.
PRIORITY_RANK = { "High" => 0, "Medium" => 1, "Low" => 2 }.freeze

# Photo size budget. Output is a fixed 1024×1024 JPEG, so the budget is roomier
# than the old sips-pipeline 95KB target — 200KB still keeps the gallery light
# while letting q:v=2 land cleanly on most headshots.
PHOTO_MAX_BYTES = 200 * 1024

# ffmpeg JPEG quality ladder: ascending = worse quality / smaller file.
# We walk from q=2 upward and stop at the first pass that fits the budget.
# Beyond q=20 the image is visibly mushy; if 20 still overruns we raise.
PHOTO_QUALITY_LADDER = [2, 4, 6, 10, 15, 20].freeze

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
  # Force UTF-8: cron runs with a US-ASCII default external encoding, so reading
  # a .env containing any non-ASCII byte raises Encoding::CompatibilityError on
  # the first String op (e.g. #strip). Same fix as refresh-next-event-dates.rb.
  File.foreach(path, encoding: "UTF-8") do |raw|
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

# Read pixel dimensions via macOS `sips` in a single call. sips outputs both
# dimensions on separate lines after the file path; we regex rather than split
# by position so field order can change without breaking us.
def image_dimensions(path)
  out = shell_out("sips", "-g", "pixelWidth", "-g", "pixelHeight", path)
  w = out[/pixelWidth:\s*(\d+)/, 1]
  h = out[/pixelHeight:\s*(\d+)/, 1]
  raise "sips could not read dimensions for #{path}: #{out}" if w.nil? || h.nil?
  [w.to_i, h.to_i]
end

# Detect the subject face via Apple Vision (`auge --faces`) and return the
# FULL bounding box in IMAGE PIXEL coords with TOP-LEFT origin: [x, y, w, h].
# The crop calculator needs the bbox extents (not just the center) so it can
# guarantee the face fits ENTIRELY inside the crop — without that, big faces
# get their forehead/chin clipped at the rule-of-thirds line.
#
# Two coordinate gotchas, both handled here:
#   1. Auge returns normalized 0..1 with a BOTTOM-LEFT origin (Apple Vision
#      convention). A bbox at (x, y, w, h) in BL coords becomes
#      (x*W, (1 - y - h)*H, w*W, h*H) in pixel TL coords — the y-flip applies
#      to the TOP of the bbox, which in BL is `y + h`.
#   2. Multi-face images: we pick the LARGEST face by area. For headshots
#      this is the standard "subject" heuristic — `--faces` doesn't expose
#      per-face confidence, so area is the cheapest reliable proxy.
#
# We trust Apple Vision's own threshold rather than imposing an absolute area
# floor — real headshot faces can be as small as ~0.5% of the frame (verified
# against the live comedians table), and adding an arbitrary floor would
# silently drop them. Returns nil on no faces / parse failure / auge crash,
# letting the caller fall back to saliency then center.
def detect_face_bbox(path)
  image_w, image_h = image_dimensions(path)
  out = shell_out("auge", "--faces", path, "--json")
  data = JSON.parse(out)

  faces = data.dig("results", "faces") || []
  return nil if faces.empty?

  chosen = faces.max_by { |f| f["width"].to_f * f["height"].to_f }

  x_norm = chosen["x"].to_f
  y_norm = chosen["y"].to_f
  w_norm = chosen["width"].to_f
  h_norm = chosen["height"].to_f

  bbox_x = x_norm * image_w
  bbox_y = (1.0 - (y_norm + h_norm)) * image_h  # TOP of bbox in TL coords
  bbox_w = w_norm * image_w
  bbox_h = h_norm * image_h

  [bbox_x, bbox_y, bbox_w, bbox_h]
rescue JSON::ParserError => e
  warn "auge --faces returned invalid JSON for #{path}: #{e.message}"
  nil
rescue => e
  warn "auge --faces failed for #{path}: #{e.message}"
  nil
end

# Fallback when no face is detected. Returns the salient region's full bbox
# in pixel TL coords [x, y, w, h]. Apple Vision's attention-based saliency
# surfaces the region a human eye would land on. Tiebreak across regions is
# highest `confidence` (which --saliency-attention DOES include, unlike
# --faces).
def detect_saliency_bbox(path)
  image_w, image_h = image_dimensions(path)
  out = shell_out("auge", "--saliency-attention", path, "--json")
  data = JSON.parse(out)

  regions = data.dig("results", "regions") || []
  return nil if regions.empty?

  chosen = regions.max_by { |r| r["confidence"].to_f }

  x_norm = chosen["x"].to_f
  y_norm = chosen["y"].to_f
  w_norm = chosen["width"].to_f
  h_norm = chosen["height"].to_f

  bbox_x = x_norm * image_w
  bbox_y = (1.0 - (y_norm + h_norm)) * image_h  # TOP of bbox in TL coords
  bbox_w = w_norm * image_w
  bbox_h = h_norm * image_h

  [bbox_x, bbox_y, bbox_w, bbox_h]
rescue JSON::ParserError => e
  warn "auge --saliency-attention returned invalid JSON for #{path}: #{e.message}"
  nil
rescue => e
  warn "auge --saliency-attention failed for #{path}: #{e.message}"
  nil
end

# Minimum crop side we're willing to ship. Final output is always 1024×1024,
# so this caps the upscale factor at ~3× (1024 / 341 ≈ 3). Below that the
# bilinear interpolation gets visibly soft; we'd rather compromise on
# composition than ship a mushy headshot.
MIN_CROP_SIDE = 341

# Solve: "Place the subject (defined by its full bbox) at fractional position
# `preferred_offsets = [ofx, ofy]` of the final square crop, with the bbox
# entirely INSIDE the crop." Returns `[crop_x, crop_y, side]` in image pixel
# TL coords.
#
# Why the bbox and not just the center: a center-only algorithm can place a
# big face on the upper-third line and then clip the forehead off, because
# the bbox extends past the crop's top edge. The clipping is invisible in
# the math but obvious in the resulting photo. Carrying the full bbox lets
# us check feasibility AND choose the largest square that still contains it.
#
# Per the user spec — "rule of thirds (if possible, bearing in mind the edge
# of the original photo)" — we try the preferred placement first and only
# compromise when geometry forbids it. Search order:
#
#   1. `preferred_offsets` (usually upper-third for faces).
#   2. `[0.5, 0.5]` (center) — always feasible whenever side ≥ max(bw, bh)
#      and the centered crop fits in the image.
#   3. Last-resort clamp: largest possible square, anchor at preferred offset
#      then clamped — bbox MAY be partially out of frame in extreme cases.
#
# Geometry for a given (ofx, ofy):
#
#   max_side (crop fits in image):
#     min(image_w, image_h, cx/ofx, (image_w-cx)/(1-ofx),
#         cy/ofy, (image_h-cy)/(1-ofy))
#     where (cx, cy) is the bbox center.
#
#   min_side (bbox fits in crop):
#     max(bw/(2*ofx), bw/(2*(1-ofx)), bh/(2*ofy), bh/(2*(1-ofy)))
#
# Feasible iff `max_side ≥ max(min_side, MIN_CROP_SIDE)`. We pick `max_side`
# (largest crop, least upscaling), `.floor` to integer for ffmpeg.
def compute_crop_origin(image_w, image_h, subject_bbox, preferred_offsets)
  bx, by, bw, bh = subject_bbox
  cx = bx + bw / 2.0
  cy = by + bh / 2.0

  # Try preferred, then center as a fallback. `uniq` collapses the second
  # pass when preferred IS [0.5, 0.5] (saliency / center cases).
  [preferred_offsets, [0.5, 0.5]].uniq.each do |ofx, ofy|
    max_side = [
      image_w.to_f, image_h.to_f,
      cx / ofx, (image_w - cx) / (1.0 - ofx),
      cy / ofy, (image_h - cy) / (1.0 - ofy)
    ].min

    min_side = [
      bw / (2.0 * ofx), bw / (2.0 * (1.0 - ofx)),
      bh / (2.0 * ofy), bh / (2.0 * (1.0 - ofy))
    ].max

    next if max_side < [min_side, MIN_CROP_SIDE.to_f].max

    side   = max_side.floor
    crop_x = (cx - ofx * side).floor
    crop_y = (cy - ofy * side).floor
    return [crop_x, crop_y, side]
  end

  # Both placements infeasible — keep the largest square anchored at the
  # preferred offset, clamped into the image. Bbox may be partially clipped;
  # better than failing the whole sync over one stubborn image.
  ofx, ofy = preferred_offsets
  side  = [image_w, image_h].min.to_i
  max_x = image_w - side
  max_y = image_h - side
  crop_x = (cx - ofx * side).clamp(0, max_x).floor
  crop_y = (cy - ofy * side).clamp(0, max_y).floor
  [crop_x, crop_y, side]
end

# Single ffmpeg pass: crop a `side`×`side` square at (crop_x, crop_y), then
# scale to 1024×1024. `-q:v` is JPEG quality on the ffmpeg 2..31 scale
# (2 = best). `-y` overwrites previous attempts so the quality ladder can
# render multiple times into the same dest path before converging.
# `-loglevel error` keeps stderr quiet on success.
def render_square(src_path, crop_x, crop_y, side, dest_path, quality:)
  vf = "crop=#{side}:#{side}:#{crop_x}:#{crop_y},scale=1024:1024"
  shell_out(
    "ffmpeg",
    "-y",
    "-loglevel", "error",
    "-i", src_path,
    "-vf", vf,
    "-q:v", quality.to_s,
    dest_path
  )
  File.size(dest_path)
end

# Replaces the previous sips-based pipeline. Pipeline:
#   1. Stage raw_bytes into a tempfile with its source extension (auge and
#      ffmpeg both sniff format from the path's extension).
#   2. Read pixel dimensions.
#   3. Try face → saliency → center anchor selection.
#   4. Pick a `target_offset` matched to anchor type:
#        face     → (side/2, side/3) — rule-of-thirds eye line for portraits
#        saliency → (side/2, side/2) — center the salient region (no eye
#                   semantics, so eye-line bias would be wrong)
#        center   → (side/2, side/2) — degenerate symmetric case
#   5. Compute crop origin (clamped to image bounds).
#   6. Walk PHOTO_QUALITY_LADDER until size ≤ PHOTO_MAX_BYTES.
#   7. Raise if even the worst quality overruns the budget — better to fail
#      loudly than ship an oversized image.
#
# Output is always 1024×1024 JPEG with `.jpg` extension regardless of source.
def resize_photo(raw_bytes, source_ext, dest_path)
  target_ext = "jpg"
  final_path = dest_path.sub(/\.[a-z]+\z/i, ".#{target_ext}")
  FileUtils.mkdir_p(File.dirname(final_path))

  Tempfile.create(["comedian-src", ".#{source_ext}"]) do |src|
    src.binmode
    src.write(raw_bytes)
    src.flush

    image_w, image_h = image_dimensions(src.path)

    # Anchor selection: face → saliency → synthetic-center-bbox. The third
    # is a zero-extent bbox at the image center so the same crop calculator
    # handles all three cases uniformly.
    subject_bbox = detect_face_bbox(src.path)
    anchor_kind  = :face

    if subject_bbox.nil?
      subject_bbox = detect_saliency_bbox(src.path)
      anchor_kind  = :saliency
    end

    if subject_bbox.nil?
      subject_bbox = [image_w / 2.0, image_h / 2.0, 0.0, 0.0]
      anchor_kind  = :center
    end

    bx, by, bw, bh = subject_bbox
    log "    anchor: #{anchor_kind} bbox=(#{bx.round(1)},#{by.round(1)} #{bw.round(1)}×#{bh.round(1)}) " \
        "in #{image_w}×#{image_h}"

    # Face gets upper-third (classic portrait composition); saliency and
    # center fallback get dead-center. compute_crop_origin will fall back to
    # center automatically when the face is too big to fit at upper-third.
    preferred_offsets =
      case anchor_kind
      when :face              then [0.5, 1.0 / 3.0]
      when :saliency, :center then [0.5, 0.5]
      end

    crop_x, crop_y, side_actual = compute_crop_origin(image_w, image_h, subject_bbox, preferred_offsets)
    log "    crop: side=#{side_actual} origin=(#{crop_x},#{crop_y})"

    converged = false
    PHOTO_QUALITY_LADDER.each do |q|
      size = render_square(src.path, crop_x, crop_y, side_actual, final_path, quality: q)
      log "    ffmpeg pass: q=#{q} → #{(size / 1024.0).round(1)}KB"
      if size <= PHOTO_MAX_BYTES
        converged = true
        break
      end
    end

    unless converged
      File.delete(final_path) if File.exist?(final_path)
      raise "could not shrink photo below #{PHOTO_MAX_BYTES} bytes " \
            "(min quality=#{PHOTO_QUALITY_LADDER.last})"
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
  File.read(page_path, encoding: "UTF-8")[/^last_modified_at:\s*(.+)$/, 1]&.strip&.gsub(/\A["']|["']\z/, "")
end

# Grist encodes a Choice List cell as ["L", "High", ...]; a single Choice is a
# bare string. Return the SINGLE highest-priority recognized label (High beats
# Medium beats Low) so a multi-tagged comedian still surfaces at their best tier,
# or nil when unset/unrecognized — nil lets the page sort drop them to the end.
def extract_priority(cell)
  values =
    case cell
    when Array  then cell.first == "L" ? cell.drop(1) : cell
    when String then [cell]
    else []
    end
  values
    .map { |v| v.to_s.strip }
    .select { |v| PRIORITY_RANK.key?(v) }
    .min_by { |v| PRIORITY_RANK[v] }
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

  # Priority drives /comedians/ ordering. Only emit the key when set so unranked
  # comedians have no `priority` frontmatter (the page sorts them last). Part of
  # data_lines, so a priority change participates in last_modified_at bumping.
  priority = extract_priority(fields["Priority"])
  data_lines << "priority: #{yaml_escape(priority)}" if priority

  data_lines << "image: #{yaml_escape(photo_web_path)}" unless photo_web_path.to_s.empty?
  data_lines << bio_block
  data_lines << "---"
  data_lines << ""

  data_only_content = data_lines.join("\n") + "\n"

  # Decide the timestamp: preserve existing if data didn't change, else now.
  existing_lm    = existing_last_modified_at(page_path)
  existing_data  = File.exist?(page_path) ? File.read(page_path, encoding: "UTF-8").sub(LAST_MODIFIED_RE, "") : nil
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

  content   = File.read(INDEX_PAGE, encoding: "UTF-8")
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
GIT_PATHS = ["_comedians/", "assets/img/comedians/", "pages/7_comedians.md", "script/comedians-state.json"].freeze

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
# Grist encodes a multi-value attachment cell as ["L", id1, id2, ...] and appends
# new uploads to the end of that list. Returning the FIRST id (what the previous
# implementation did) meant we kept pulling the OLDEST headshot forever — so when
# a comedian uploads a fresh photo, the site never picked it up.
#
# The reliable signal for "most recent" is each attachment's `timeUploaded`
# metadata from /attachments/:id. ISO 8601 UTC strings sort chronologically as
# plain strings (lexical max == chronological max), so we keep them raw.
def extract_attachment_ids(cell)
  # Tolerate a bare int "just in case", matching the Python helper.
  return [cell] if cell.is_a?(Integer)
  return [] unless cell.is_a?(Array) && cell.size > 1 && cell.first == "L"
  cell.drop(1).select { |i| i.is_a?(Integer) }
end

def attachment_uploaded_at(attachment_id)
  # Return "" on ANY failure so the id sorts oldest — a transient metadata hiccup
  # must never wrongly promote an attachment to "newest". The all-empty fallback
  # in newest_attachment_id covers the case where every call failed.
  resp = http_get("attachments/#{attachment_id}")
  return "" unless resp.is_a?(Net::HTTPSuccess)
  JSON.parse(resp.body)["timeUploaded"].to_s
rescue => e
  warn "  ! attachment #{attachment_id} metadata failed: #{e.message}"
  ""
end

def newest_attachment_id(cell)
  ids = extract_attachment_ids(cell)
  return nil if ids.empty?
  return ids.first if ids.size == 1  # single-attachment short-circuit, zero HTTP
  timed = ids.map { |id| [attachment_uploaded_at(id), id] }
  # If every timestamp came back empty, trust list order (newest appended last).
  return ids.last if timed.all? { |t, _| t.empty? }
  timed.max_by(&:first).last
end

# -----------------------------------------------------------------------------
# Incremental-sync snapshot. Grist has no change-history API, so we store our
# own per-slug fingerprint of the last successful sync and diff against it each
# run. Committed to the repo (a fresh clone just reprocesses everyone once); a
# missing OR corrupt file is treated as "no prior state" — never fatal.
#
#   { "<slug>": { "data": "<sha256 of text fields>", "photo": "<attachment ids>" }, ... }
#
# `data` covers everything that renders into the .md except the photo; `photo`
# is the Grist attachment-id list, which changes iff a new headshot is uploaded
# (Grist appends a fresh id per upload). So a steady-state run detects "nothing
# changed" from the already-fetched record with ZERO extra HTTP.
# -----------------------------------------------------------------------------
STATE_FILE = File.join(__dir__, "comedians-state.json")

def load_state
  return {} unless File.exist?(STATE_FILE)
  parsed = JSON.parse(File.read(STATE_FILE, encoding: "UTF-8"))
  parsed.is_a?(Hash) ? parsed : {}
rescue JSON::ParserError => e
  warn "  ! state file unreadable (#{e.message}) — treating as empty, reprocessing all"
  {}
end

def save_state(state)
  # Sorted keys → stable, reviewable git diffs run-to-run.
  File.write(STATE_FILE, JSON.pretty_generate(state.sort.to_h) + "\n")
end

# Fingerprint every Grist field that affects the rendered .md (everything but
# the photo, tracked separately). `inspect` canonicalizes strings, nil and
# booleans deterministically within a run. Priority is fingerprinted by its
# RENDERED value (single highest label via extract_priority), not the raw
# Choice-List cell — so reordering a multi-tag Priority in Grist doesn't force
# a needless rewrite when the emitted `priority:` line is unchanged.
def comedian_data_sig(fields)
  payload = PUBLIC_FIELDS.map do |k|
    value = (k == "Priority") ? extract_priority(fields[k]) : fields[k]
    value = "" if value.nil?  # treat absent (nil) and empty ("") identically — both render as ""
    "#{k}=#{value.inspect}"
  end.join("\n")
  Digest::SHA256.hexdigest(payload)
end

def main
  log "Fetching Comedians from Grist (doc=#{DOC_ID}, table=#{TABLE})..."
  records = fetch_records

  state     = load_state   # last-synced fingerprints, keyed by slug
  new_state = {}           # rebuilt this run; published comedians only
  seen_slugs = []
  written = 0
  skipped = 0              # unchanged comedians skipped without any work
  pages_changed = 0        # comedian pages actually created or modified this run

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

    # A comedian with NO photo on Grist is not published. Leaving them out of
    # seen_slugs means the removal sweep below deletes any page+photo they had
    # before — they disappear from the site exactly like a non-live row.
    photo_ids = extract_attachment_ids(fields["Photo"])
    if photo_ids.empty?
      log "  · skipping photoless: #{name.empty? ? slug : name}"
      next
    end

    seen_slugs << slug

    page_path  = File.join(COMEDIANS_DIR, "#{slug}.md")
    photo_file = Dir.glob(File.join(PHOTO_DIR, "#{slug}.*")).first
    cur_data   = comedian_data_sig(fields)
    # Sort ids for the signature so a nondeterministic Grist ordering can't
    # produce a spurious "photo changed". (newest_attachment_id still uses the
    # real upload order/timestamps when it actually needs the newest.)
    cur_photo  = photo_ids.sort.join(",")
    prev       = state[slug]

    # "current" means the snapshot matches AND the artifact is actually on disk
    # (a hand-deleted file must still be regenerated even if the sig matches).
    photo_current = prev && prev["photo"] == cur_photo && photo_file
    data_current  = prev && prev["data"]  == cur_data  && File.exist?(page_path)

    # Fast path: nothing changed since last sync — skip download, resize, write.
    if photo_current && data_current
      log "  = unchanged, skipping: #{name} (#{slug})"
      new_state[slug] = { "data" => cur_data, "photo" => cur_photo }
      skipped += 1
      next
    end

    log "  + processing: #{name} (#{slug})"

    # Project public-field allowlist; Phone/Email never enter this hash.
    public_fields = PUBLIC_FIELDS.each_with_object({}) { |k, h| h[k] = fields[k] }

    photo_web_path = nil
    photo_fresh    = false  # true iff the on-disk photo matches cur_photo this run
    if photo_current
      # Only the text data changed — reuse the existing headshot, no download.
      photo_web_path = "/" + photo_file.sub("#{REPO_ROOT}/", "")
      photo_fresh    = true
      log "    photo unchanged — reusing #{File.basename(photo_file)}"
    else
      # Photo is new or missing — fetch the newest attachment and resize.
      attachment_id = newest_attachment_id(fields["Photo"])
      begin
        bytes, source_ext = download_attachment(attachment_id)
        if DRY_RUN
          log "  [dry-run] would resize #{name} photo (source #{source_ext}, #{bytes.bytesize} bytes)"
          photo_web_path = "/assets/img/comedians/#{slug}.jpg"
          photo_fresh    = true
        else
          dest = File.join(PHOTO_DIR, "#{slug}.#{source_ext}")
          final_path = resize_photo(bytes, source_ext, dest)
          # Drop any sibling photos with a different extension (so a JPG→PNG
          # source-change doesn't leave a stale jpg around).
          Dir.glob(File.join(PHOTO_DIR, "#{slug}.*")).each do |existing|
            File.delete(existing) unless existing == final_path
          end
          photo_web_path = "/" + final_path.sub("#{REPO_ROOT}/", "")
          photo_fresh    = true
        end
      rescue => e
        warn "  ! photo failed for #{slug}: #{e.message}"
        # Transient download/resize failure — preserve the existing on-disk
        # headshot rather than blanking it. A hiccup must never wipe a photo
        # (this silently wiped every photo on the site once, 2026-05-30).
        # photo_fresh stays false: we're serving the OLD photo, so we must NOT
        # record cur_photo in state below — else next run sees a sig-match and
        # never retries the new upload.
        photo_web_path = "/" + photo_file.sub("#{REPO_ROOT}/", "") if photo_file
      end
    end

    # Grist has a photo but we have neither a fresh download nor a prior on-disk
    # copy (brand-new comedian whose first download failed). Don't write a
    # photoless page and don't record state — retry on the next run. Kept in
    # seen_slugs so the (nonexistent) page isn't mistaken for an orphan.
    if photo_web_path.nil?
      warn "  ! no photo available yet for #{slug} — deferring to next run"
      next
    end

    _, status = write_comedian_page(slug, public_fields, photo_web_path)
    pages_changed += 1 unless status == :unchanged
    written += 1
    # Only record state when the on-disk photo is the CURRENT one. After a
    # failed download we keep serving the stale photo, so we leave this slug
    # out of new_state and reprocess it next run until the fresh photo lands.
    new_state[slug] = { "data" => cur_data, "photo" => cur_photo } if photo_fresh
  end

  # Safety valve: if this run found ZERO publishable comedians but pages exist
  # on disk, a bad/empty Grist fetch is far more likely than every comedian
  # genuinely vanishing at once. Abort before the destructive sweep rather than
  # mass-deleting the whole collection. (fetch_records already raises on a
  # non-2xx response; this guards a 2xx that returned an empty/garbled body.)
  if seen_slugs.empty? && Dir.exist?(COMEDIANS_DIR) &&
     !Dir.glob(File.join(COMEDIANS_DIR, "*.md")).empty?
    raise "refusing removal sweep: 0 publishable comedians from Grist but " \
          "#{Dir.glob(File.join(COMEDIANS_DIR, '*.md')).size} pages on disk — " \
          "likely a bad fetch; aborting to avoid mass deletion"
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

  # Persist this run's fingerprints. new_state holds ONLY the comedians we
  # published (skipped + written), so removed/photoless/deferred slugs drop out
  # automatically — the state file self-cleans. Never write under --dry-run.
  save_state(new_state) unless DRY_RUN

  puts "comedians: #{written} written, #{skipped} unchanged, #{removed} removed#{DRY_RUN ? ' (dry run)' : ''}"

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

# Guard so the file can be `require`d (e.g. for unit-testing the helpers)
# without kicking off a live sync. Cron runs `ruby script/sync-comedians.rb`,
# where __FILE__ == $PROGRAM_NAME, so production behaviour is unchanged.
if __FILE__ == $PROGRAM_NAME
  begin
    main
  rescue => e
    warn "FATAL: #{e.class}: #{e.message}"
    warn e.backtrace.first(8).join("\n") if VERBOSE
    exit 2
  end
end

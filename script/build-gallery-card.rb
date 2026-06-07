#!/usr/bin/env ruby
# frozen_string_literal: true

# build-gallery-card.rb — branded social-share card for the /moments/ gallery.
#
# Sibling to build-gallery-data.rb: reads the SAME _data/gallery.yml and builds a
# 1080x1080 share card (5x5 photo mosaic + dark scrim + Anton headline + subtitle +
# logo roundel) at assets/img/thumbs/gallery_card.png. It mirrors the /comedians/
# card (comedians_card.png) so the two read as a set — but that card's generator was
# never committed, so this one is. Re-run it any time the gallery grows:
#
#   ruby script/build-gallery-card.rb
#
# macOS-only authoring tool (renders via headless Google Chrome, downscales via sips).
# The Linux CI/Netlify build only reads the committed PNG. No ImageMagick needed.

require "yaml"
require "erb"
require "fileutils"
require "tmpdir"
require "set"

REPO_ROOT  = File.expand_path("..", __dir__)
GALLERY_YML = File.join(REPO_ROOT, "_data", "gallery.yml")
LOGO        = File.join(REPO_ROOT, "assets", "img", "inyourface.png")
OUT_PNG     = File.join(REPO_ROOT, "assets", "img", "thumbs", "gallery_card.png")
TMP_HTML    = File.join(REPO_ROOT, "script", ".gallery-card.tmp.html")
TMP_PNG     = File.join(Dir.tmpdir, "gallery_card_render.png")

# --- Card copy (edit here) -------------------------------------------------
# Headline is a social-media pun parallel to the comedians card's "IN YOUR FACEBOOK"
# (a photo gallery is your feed). No em dashes per WRITING_GUIDE.md.
HEADLINE_L1 = "IN YOUR"
HEADLINE_L2 = "FEED"
SUBTITLE    = "Moments from IN YOUR FACE comedy nights in Zürich"

# --- Grid + selection ------------------------------------------------------
# This is a MOOD card: it should read as a packed, current, appealing comedy scene that
# makes someone want to click in. So we lead with the best-looking shots, skew performers
# and moments recent (2024+), let audience photos come from any night as long as the shot
# is strong, keep only a few (best) moments, and drop the genuinely bad frames.
GRID        = 5                 # 5x5
CELLS       = GRID * GRID       # 25
RECENT_YEAR = 2024              # performers + moments skew to this year or newer
AES_FLOOR   = 0.35             # drop weak frames (some score negative); pin is exempt
TARGETS     = { "performer" => 13, "audience" => 10, "moment" => 2 }
AUDIENCE_PER_DATE = 2           # avoid same-night clustering so it reads as many nights
PLACE_SEED  = 0x1FACE           # deterministic placement so the mosaic is a stable type-mix

# Pinned by owner request: this exact shot is force-included into a top/side cell,
# regardless of era, aesthetic score, or the floor below.
PIN_SRC     = "/assets/img/gallery/robins3.jpeg"
PIN_CELL    = 0                 # top-left corner: both top row AND side column, stays light under the scrim

# Never use these, matched by EXACT basename (so the good primepunch_12..16.png survive).
BLOCKLIST   = %w[
  canape_0855.jpeg
  primepunch_8.png
  canape_0837.jpeg
  primepunch_1.png
].freeze

CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
].freeze

def aes(row)  = (row["aesthetic"] || 0).to_f
def feat(row) = row["featured"] ? 0 : 1
def tagged?(row)
  c = row["comedian"].to_s
  !c.empty? && c != "none"
end

def basename(row) = File.basename(row["src"].to_s)
def blocked?(row) = BLOCKLIST.include?(basename(row))
def pinned?(row)  = row["src"] == PIN_SRC
def recent?(row)  = (row["year"] || 0) >= RECENT_YEAR

# file:// URL with each path segment percent-encoded, so names with spaces / parens
# (the WhatsApp photos) resolve. ERB::Util.url_encode escapes spaces -> %20, ( -> %28.
def file_url(abs)
  encoded = abs.split("/").map { |seg| seg.empty? ? seg : ERB::Util.url_encode(seg) }.join("/")
  "file://#{encoded}"
end

def src_to_abs(src)
  File.join(REPO_ROOT, src.sub(%r{\A/}, ""))
end

# The candidate pool: everything except the blocklisted files, the pinned shot (added
# back separately), and frames below the aesthetic floor. Mood-first.
def usable(rows)
  rows.reject { |r| blocked?(r) || pinned?(r) }
      .select  { |r| aes(r) >= AES_FLOOR }
end

# Pick up to n performers, one photo per comedian (face variety), restricted to recent
# (2024+) nights, best-looking first. Tagged + featured break ties.
def pick_performers(rows, n)
  sorted = rows.select { |r| r["type"] == "performer" && recent?(r) }
               .sort_by { |r| [-aes(r), feat(r), tagged?(r) ? 0 : 1] }
  seen = {}
  out  = []
  sorted.each do |r|
    key = tagged?(r) ? r["comedian"].to_s : "anon-#{out.size}"
    next if seen[key]

    seen[key] = true
    out << r
    break if out.size >= n
  end
  out
end

# Audience photos from ANY era, best-looking first, but capped per date so the mosaic
# reads as many different nights rather than one room.
def pick_audience(rows, n)
  per_date = Hash.new(0)
  rows.select { |r| r["type"] == "audience" }
      .sort_by { |r| [-aes(r), feat(r)] }
      .each_with_object([]) do |r, out|
        d = r["date"].to_s
        next if per_date[d] >= AUDIENCE_PER_DATE

        per_date[d] += 1
        out << r
        break out if out.size >= n
      end
end

# Only a few moments, the best ones, preferring recent (2024+) shots.
def pick_moments(rows, n)
  rows.select { |r| r["type"] == "moment" }
      .sort_by { |r| [recent?(r) ? 0 : 1, -aes(r)] }
      .first(n)
end

def select_photos(rows)
  pool = usable(rows)
  pin  = rows.find { |r| pinned?(r) }   # force-included regardless of floor/era/blocklist
  slots = CELLS - (pin ? 1 : 0)         # the pin takes one cell

  picks = {
    "performer" => pick_performers(pool, TARGETS["performer"]),
    "audience"  => pick_audience(pool, TARGETS["audience"]),
    "moment"    => pick_moments(pool, TARGETS["moment"] - (pin ? 1 : 0)),
  }

  chosen = picks.values.flatten
  # Backfill any deficit from the richest remaining usable shots (mood-first, any type),
  # so we always land exactly the right count without duplicates.
  if chosen.size < slots
    used = chosen.map { |r| r["src"] }.to_set
    extra = pool.reject { |r| used.include?(r["src"]) }
                .sort_by { |r| [-aes(r), feat(r)] }
    chosen.concat(extra.first(slots - chosen.size))
  end
  chosen = chosen.first(slots)

  # Deterministic placement so the mosaic is a stable mix, then force the pin into its
  # top/side cell.
  placed = chosen.shuffle(random: Random.new(PLACE_SEED))
  placed.insert([PIN_CELL, placed.size].min, pin) if pin
  placed.first(CELLS)
end

def build_html(photos)
  cells = photos.map do |r|
    %(<img src="#{file_url(src_to_abs(r["src"]))}" alt="">)
  end.join("\n      ")

  logo_url = file_url(LOGO)

  <<~HTML
    <!doctype html>
    <html lang="en">
    <head>
    <meta charset="utf-8">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      :root {
        --brand-red: #E53935;
        --brand-ink: #0F0F10;
        --brand-cream: #FFF3E0;
      }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: 1080px; height: 1080px; overflow: hidden; }
      .card { position: relative; width: 1080px; height: 1080px; background: var(--brand-ink); font-family: 'Inter', sans-serif; }

      .grid {
        position: absolute; inset: 0;
        display: grid;
        grid-template-columns: repeat(#{GRID}, 1fr);
        grid-template-rows: repeat(#{GRID}, 1fr);
      }
      .grid img { width: 100%; height: 100%; object-fit: cover; display: block; }

      /* Darken for headline legibility: heavier in the centre + a vignette at the edges,
         while the corners stay light enough to read as photos. */
      .scrim {
        position: absolute; inset: 0;
        background:
          radial-gradient(125% 95% at 50% 46%,
            rgba(15,15,16,0.82) 0%,
            rgba(15,15,16,0.55) 34%,
            rgba(15,15,16,0.30) 58%,
            rgba(15,15,16,0.22) 74%,
            rgba(15,15,16,0.62) 100%);
      }

      .content {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        text-align: center; padding: 0 70px;
      }
      .headline {
        font-family: 'Anton', 'Oswald', Impact, sans-serif;
        font-weight: 400;
        color: var(--brand-cream);
        font-size: 184px;
        line-height: 0.90;
        letter-spacing: 0.01em;
        text-transform: uppercase;
        text-shadow: 0 8px 36px rgba(0,0,0,0.55);
      }
      .accent { width: 132px; height: 9px; background: var(--brand-red); border-radius: 5px; margin: 30px 0 26px; }
      .subtitle {
        color: var(--brand-cream);
        font-size: 35px; font-weight: 600; line-height: 1.3;
        max-width: 740px;
        text-shadow: 0 2px 14px rgba(0,0,0,0.75);
      }

      .logo {
        position: absolute; right: 40px; bottom: 36px;
        width: 156px; height: auto;
        filter: drop-shadow(0 5px 16px rgba(0,0,0,0.55));
      }
    </style>
    </head>
    <body>
      <div class="card">
        <div class="grid">
          #{cells}
        </div>
        <div class="scrim"></div>
        <div class="content">
          <h1 class="headline">#{ERB::Util.html_escape(HEADLINE_L1)}<br>#{ERB::Util.html_escape(HEADLINE_L2)}</h1>
          <div class="accent"></div>
          <p class="subtitle">#{ERB::Util.html_escape(SUBTITLE)}</p>
        </div>
        <img class="logo" src="#{logo_url}" alt="">
      </div>
    </body>
    </html>
  HTML
end

def chrome_bin
  CHROME_CANDIDATES.find { |c| File.executable?(c) } or
    abort("No Chrome/Brave found at expected paths; install Google Chrome to render the card.")
end

def render!(html)
  File.write(TMP_HTML, html)

  # Render at 2x (2160px) then downscale to 1080 with sips for crisp text (supersampling).
  ok = system(
    chrome_bin,
    "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
    "--force-device-scale-factor=2", "--window-size=1080,1080",
    "--virtual-time-budget=6000",
    "--allow-file-access-from-files",
    "--default-background-color=00000000",
    "--screenshot=#{TMP_PNG}",
    file_url(TMP_HTML),
    out: File::NULL, err: File::NULL
  )
  abort("Chrome render failed.") unless ok && File.exist?(TMP_PNG)

  FileUtils.mkdir_p(File.dirname(OUT_PNG))
  unless system("sips", "-Z", "1080", TMP_PNG, "--out", OUT_PNG, out: File::NULL, err: File::NULL)
    abort("sips downscale failed.")
  end
ensure
  File.delete(TMP_HTML) if File.exist?(TMP_HTML)
  File.delete(TMP_PNG) if File.exist?(TMP_PNG)
end

# --- main ------------------------------------------------------------------
rows = YAML.load_file(GALLERY_YML)
photos = select_photos(rows)

counts = photos.group_by { |r| r["type"] }.transform_values(&:size)
puts "Selected #{photos.size} photos: #{counts.inspect}"

render!(build_html(photos))

dims = `sips -g pixelWidth -g pixelHeight #{OUT_PNG.inspect} 2>/dev/null`.scan(/\d+/).last(2).join("x")
size_kb = (File.size(OUT_PNG) / 1024.0).round
puts "Wrote #{OUT_PNG.sub(REPO_ROOT + '/', '')} (#{dims}, #{size_kb} KB)"

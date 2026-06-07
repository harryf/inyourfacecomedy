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
GRID        = 5                 # 5x5
CELLS       = GRID * GRID       # 25
TARGETS     = { "performer" => 13, "audience" => 9, "moment" => 3 }
PLACE_SEED  = 0x1FACE           # deterministic placement so the mosaic is a stable type-mix

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

# file:// URL with each path segment percent-encoded, so names with spaces / parens
# (the WhatsApp photos) resolve. ERB::Util.url_encode escapes spaces -> %20, ( -> %28.
def file_url(abs)
  encoded = abs.split("/").map { |seg| seg.empty? ? seg : ERB::Util.url_encode(seg) }.join("/")
  "file://#{encoded}"
end

def src_to_abs(src)
  File.join(REPO_ROOT, src.sub(%r{\A/}, ""))
end

# Pick up to n performers, one photo per comedian (face variety), tagged + featured +
# high-aesthetic first. Falls back to untagged performers to fill the count.
def pick_performers(rows, n)
  sorted = rows.select { |r| r["type"] == "performer" }
               .sort_by { |r| [tagged?(r) ? 0 : 1, feat(r), -aes(r)] }
  seen = {}
  out  = []
  sorted.each do |r|
    c = r["comedian"].to_s
    key = tagged?(r) ? c : "anon-#{out.size}"
    next if seen[key]

    seen[key] = true
    out << r
    break if out.size >= n
  end
  out
end

def pick_simple(rows, type, n)
  rows.select { |r| r["type"] == type }
      .sort_by { |r| [feat(r), -aes(r)] }
      .first(n)
end

def select_photos(rows)
  picks = {
    "performer" => pick_performers(rows, TARGETS["performer"]),
    "audience"  => pick_simple(rows, "audience", TARGETS["audience"]),
    "moment"    => pick_simple(rows, "moment", TARGETS["moment"]),
  }

  chosen = picks.values.flatten
  # Backfill any deficit (e.g. too few moments) from the richest remaining pools,
  # so we always land exactly CELLS photos without duplicates.
  if chosen.size < CELLS
    used = chosen.map { |r| r["src"] }.to_set
    extra = rows.reject { |r| used.include?(r["src"]) }
                .sort_by { |r| [feat(r), -aes(r)] }
    chosen.concat(extra.first(CELLS - chosen.size))
  end
  chosen = chosen.first(CELLS)

  # Deterministic placement so the mosaic is a stable mix, not blocks by type.
  chosen.shuffle(random: Random.new(PLACE_SEED))
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

# Videos for the Meta ads: plan

Written 14 September 2026. The creative bank rules (`meta-ads/creative-bank-plan.md`) and the runbook (`docs/meta-ads.md`) apply unchanged.

State on 18 September 2026: the `video/` folder exists (see its README) and two concepts render with sound, Departures (2) and Fifth language (3). The laughter comes from Harry's own set recording, not from a Thursday show; that recording has no applause, so the closing logo carries a big laugh. Not built yet: the upload and the video twin ads in `meta-bank.ts` (the spike's step 3 and the bank integration below), concepts 1 and 4 to 8. Open before anything goes live: the flap sound's licence, and a word with the venue about the room recording.

## What exists already

You built most of the pipeline on 30 August without calling it that: `~/Code/personal/inyourface_story_video/` is a Remotion 4.0.518 project running under bun on this machine. It rendered a 58.9 second 9:16 story (1080 x 1920, H.264, AAC) and has:

- `public/logo.png` (1613 px square), the three fonts as local files (Anton, Permanent Marker, Inter), and `src/theme.ts` with the site's palette (red, deep red, glow, yellow, hot yellow, cream, ink) and the Instagram safe zone.
- A bouncing, breathing logo component with a yellow glow, a drifting colour-field background, flyer entrance animations, TikTok-style captions, an outro.
- A voice pipeline: `scripts/PrepareVoice.ts` (loudness, gap trim, tempo), local whisper word timestamps, `BuildCaptions.ts`.
- `scripts/Finalize.ts`: the Instagram post-pass (yuv420p tv range, true-peak limiter at minus 1 dB, faststart).
- `public/bed.mp3`, 62 seconds, licence unknown (see the questions).

The project is not under git. The site has `/adcard/` with the six looks (photo, swiss, type, chalk, station, logo) in the same fonts and palette, 165 audience photos typed in `_data/gallery.yml`, and `script/meta-bank.ts`, which already builds two-image creatives with per-placement rules and pushes one ad per concept. ffmpeg and ffprobe are installed. Remotion is free for a for-profit with up to three employees, which IN YOUR FACE is; check the licence page once before the first push.

## Verdict

Yes, worth doing, for a different reason than Meta gives. Meta's "8 percent lower cost per result" on the Reels nudge is about CHF 12 a week at the current spend, and Meta's estimate. The real case is this: Stories and Reels are the placements where a still image with a headline is the weakest thing on the screen, they are a large share of where Cold and Warm impressions land, and a comedy night has one asset no library can fake, the sound of a room laughing. A video from stills earns its place only through sound and motion that a still cannot carry; if it only animates a poster it is a poster and will not move the numbers. So the plan puts the audio first and treats the visuals as typography in motion, which is what the six looks already are.

Three honest limits. Generated video with no people in it can look like a template; the concepts below lean on real audio and on the looks that are already distinctive (the station board, the chalk, the Swiss type) to avoid that. Most Reels and Stories are watched with the sound off at first, so every concept has to work silent in its first two seconds, with the laughter as the reward for turning the sound on, not the whole idea. And the sample is small: at CHF 3 a day per ad set a video versus still comparison needs two to three weeks and a rule written down before launch, or Friday turns into a story.

Launch small: the control and two concepts, the other five stay on the bench until the first pair has spoken. Every creative swap resets the ad set's learning.

## Pipeline

Home: a `video/` folder inside the site repo, its own `package.json` and `bun.lock`, excluded from the Jekyll build in `_config.yml`, with `fonts.ts`, `theme.ts`, `Logo.tsx` and `Finalize.ts` copied from the August project (that project stays as it is). Reason: the bank yml is the source of truth for concepts and lives here, so the render can be driven by concept id and the output lands beside the images.

Concept to video. A bank concept gets a `video:` block:

```yaml
- id: I2
  person: The one who needs proof
  body: "This is what it sounds like."
  title: "Thursday, ROBIN's"
  image: { style: type, headline: "This is what it sounds like." }     # the 4:5 feed image, as today
  video: { composition: HearTheRoom, audio: laughs/2026-09-17-take2.wav, seconds: 8 }
  status: live
```

Render: `bun script/meta-bank.ts --render --video` calls `bunx remotion render video/src/index.ts <composition> ...` with the concept as input props (headline, body, look, photo, audio file), then the Finalize post-pass, writing `meta-ads/creative/bank/<group>/<id>-story.mp4` (9:16). Feeds keep the 4:5 image in step one; a 4:5 video composition is step two if the 9:16 earns it.

Push: `meta-bank.ts --push` uploads the mp4 to `act_<id>/advideos` (the video id comes back after Meta processes it), then builds the creative's `asset_feed_spec` with `videos: [{ video_id, adlabels: [story] }]` beside the existing `images`, and the placement rules send the video to Facebook and Instagram Stories and Reels and the image everywhere else. Video uploads need a thumbnail: the first frame or the story PNG. The rest of the push is unchanged (one single-text ad per concept, utm_content, url_tags, all Advantage+ creative features off, six-live cap).

Audio and renders never enter git: `meta-ads/creative/audio/` for takes with a `SOURCES.md` beside them (file, where recorded or bought, licence, who consented), renders under `meta-ads/creative/bank/`.

Advantage+ creative features stay off on the video creatives exactly as on the images (the bank sends every one of the 83 features as OPT_OUT); otherwise Meta may add its own music or animate the still twin and spoil the comparison. Uploads are slow and asynchronous, so the bank caches the video id by content hash the way it caches image hashes, and a re-run never uploads the same file twice.

## Meta specs and safe zones

Reels and Stories video ads: 1080 x 1920 (9:16), MP4, H.264, AAC, 30 fps, under 4 GB, sound on by default. Keep the top about 14 percent (250 px) and the bottom about 35 percent (670 px) clear of text and logo; Meta's own UI (profile row, caption, CTA button) sits there. The August project's `SAFE` box (left 120, right 960, top 250, bottom 1620) is close; tighten the bottom to about 1250 for Reels. Length: 6 to 15 seconds. Stories are skippable after a tap, Reels loop, and the bank's bodies are one thought; a 15 second cap keeps the file small and the loop tight. The Meta CTA button carries the ticket link, so the video never needs a "buy" frame; it can end on the logo. Confirm the numbers on Meta's ads guide before the first render; they move. Output settings pinned in the post-pass: H.264, yuv420p, AAC 48 kHz, 1080 x 1920, 30 fps, faststart, and loudness normalised to about minus 14 LUFS so a laugh never clips. The six looks were drawn for 4:5 and 9:16 stills; each composition is checked against the Reels safe zone, not the story one.

## Collect: the Thursday list

Take this to the next Comedy Brew. Everything below is done with a phone.

Laughter, the asset that matters:

- Phone in flight mode, do not disturb, the built-in voice recorder or a camera app with the lens covered, held still or propped at the back of the room, not at the bar.
- Five to eight takes of the room laughing, 5 to 10 seconds each, starting a beat before the laugh and ending after it fades. Note the time of each so the take can be matched to the act (for consent, below).
- Twenty seconds of room tone (the room between acts, murmur, glasses) for fades and beds.
- The applause at the end of the night, 15 seconds.
- One take of the host saying "Comedy Brew" or "welcome" in front of the room, if the host agrees; a real voice in the room beats any studio line.

Before you press record: tell ROBIN's you are recording the room for the ads (a yes from the venue, noted in `SOURCES.md`), tell the acts before the show that laughter is being recorded for ads and that none of their words will be used without asking, and record while the house music is off (music bleeding into room tone trips Meta's rights matching and gets a video muted or rejected).

Consent rule for audio: crowd laughter, applause and room tone are ambient and need no consent. A comedian's words are their material: a punchline is usually audible under the laugh, so every take is cut to start after the last word, and nothing an act said goes into an ad without asking that act. A host line used in an ad is a yes from the host, written down in `SOURCES.md`. Tag every take with the show date and use a show's laughter for that show's series; laughter from one night in an ad for another is a small dishonesty we do not need.

Music: not the Meta Sound Collection (not licensed for ads placed through the API), not Spotify, not a track "everyone uses". Either no music (laughter and room tone carry a comedy ad better) or one royalty-free track with an ad licence, downloaded with its licence text into `meta-ads/creative/audio/`. `bed.mp3` from the August project is used only once its source and licence are known.

Voice: three options, in order of preference: your own voice through the existing PrepareVoice pipeline (one line per intent ad at most), an act's voice with a written yes, no text-to-speech by default (Meta's review is harder on synthetic voice and the ads already fight the "template" look).

Photos: a paid ad is not the gallery page. An identifiable person in an advert needs their consent under Swiss personality rights, and the venue's photo notice does not carry that. So: audience shots where nobody is identifiable (backs of heads, the room from behind, dark wide shots, a blur or a crop that keeps faces below recognisable size), or people who have said yes in writing. No posed performer photos, no Harry, no crop that lands on one face. Ken Burns moves are slow (scale 1.0 to 1.08 over the whole clip) so faces never become the subject. Write the rule into `meta-ads/creative/README.md` when the build starts.

Small sounds, optional, for two concepts: split-flap clicks for the departures board and footsteps for the "two minutes" concept, either recorded or CC0 from freesound with the licence saved.

## Eight concepts

All 9:16, 6 to 15 seconds, text inside the Reels safe zone, logo as the last frame, Meta's button as the CTA. Bodies are the ad text under the video, not on it; the beats are what appears on screen. Every concept is readable with the sound off: the first line of text lands inside two seconds and says what this is.

1. **Hear the room** (intent, from I2). First second: black, a real waveform of the laughter take drawing itself left to right in yellow. Audio: eight seconds of one laugh, no music. Beats: 0.0 waveform; 1.0 "This is what it sounds like."; 4.0 the room photo fades up behind the wave, slow push; 7.0 logo. Why: sound-on Reels with nothing but a laugh is rare; the wave tells you to turn the sound up before you think about it.

2. **Departures** (cold, station look). First second: the board's rows flip in with clicks. Audio: split-flap clicks, then a laugh under the last row. Beats: 0.0 board rows flip: "ENGLISH STAND-UP", "THURSDAY 19:30", "ROBIN'S, 2 MIN FROM CENTRAL"; 5.0 the status column flips to "ON TIME"; 7.0 logo. Why: the board is the bank's most recognisable look and the flip is motion the still could never do.

3. **Fifth language** (cold, swiss look). First second: "Deutsch" stamps on in black. Audio: room tone, then a laugh on the fifth word. Beats: 0.5 Deutsch; 1.3 Français; 2.1 Italiano; 2.9 Rumantsch; 3.8 "English" in red, bigger, the laugh hits; 6.5 "Switzerland's fifth language. Every Thursday."; 9.0 logo. Why: a rhythm anyone in Switzerland reads in one second, and the joke lands on the sound.

4. **New in town** (cold, from C2, photo look). First second: the room, wide, slow push in. Audio: room tone rising to a laugh at 4 s. Beats: 1.0 "New in Zürich?"; 2.5 "Know nobody yet?"; 4.0 (the laugh) "Nobody will make you talk."; 7.0 "Thursday. English stand-up. Near Central."; 9.0 logo. Why: the copy already works as a still; the laugh at line three turns a promise into evidence.

5. **Ten acts** (cold or warm, type look). First second: a big "1" in Anton. Audio: a short laugh burst on each count, ten different takes trimmed to a second. Beats: 0 to 6.5 the count 1 to 10, each with its laugh; 7.0 "Ten acts. One night."; 8.5 "Every Thursday."; 10.0 logo. Why: ten laughs in seven seconds is the format's own argument.

6. **Put it in the calendar** (warm, week look). First second: the week list slides in, seven rows. Audio: a quiet bed of room tone, one laugh when Thursday lights up. Beats: 1.5 Thursday's row turns yellow and grows; 3.0 the other rows dim; 4.5 "Every Thursday. Plan the week around it."; 8.0 logo. Why: the warm audience knows us; the ask is a habit, and the animation is the habit forming.

7. **Two minutes** (intent, chalk look). First second: a chalk timer "0:00" starts counting up fast. Audio: footsteps under the count, a door, then the room. Beats: 0 to 2.0 the timer runs to "2:00"; 2.0 "Central" chalk-written top, "ROBIN's" bottom; 3.5 the room sound arrives with a laugh; 5.0 "Still deciding? It is two minutes."; 8.0 logo. Why: the objection the intent audience has (getting there, getting home) answered with a clock.

8. **Just the logo** (any group, 6 seconds, the cheapest). First second: the August bouncing logo, breathing, alone on ink. Audio: one perfect laugh. Beats: 3.5 one line, per group ("English comedy exists in Zürich." for cold, "Thursday, as usual." for warm, "Still deciding?" for intent); 6.0 end. Why: a control. If this beats the still images, the sound is doing the work and the fancier concepts are optional.

Build order: 8, 1, 2 first (a control, the audio proof, the distinctive look); 3 to 7 stay on the bench until the first pair has two to three weeks of numbers.

## Spike, before any concept work (half a day)

1. Copy fonts, theme, Logo and Finalize into `video/`, `bun install`, render concept 8 at 6 seconds with a placeholder laugh (any take) via `bunx remotion render`; note whether the render process exits by itself under bun (Remotion's docs flag that it may not). If the bun runtime trips on the renderer or the headless Chrome download, the same command under the node runtime is the fallback, written into the README as such.
2. Run the post-pass; check with ffprobe: 1080 x 1920, yuv420p, AAC 48 kHz, 30 fps, faststart, and the loudness with ffmpeg's ebur128 filter.
3. Upload it to `act_<id>/advideos`, poll the video's status until it is ready, build the creative with a thumbnail (the story PNG's image hash) and the placement rules, and create one PAUSED ad in Intent with it. validate_only proves nothing for video: it does not upload, process, thumbnail or review. Wait for Meta's review to pass. If Meta refuses video and image in one asset_feed_spec under a single-text ad, fall back to a video-only creative and record the decision. Check that the rules cover every placement the ad set runs (the bank's story rule plus the catch-all feed rule; Explore, Messenger Stories and Audience Network fall under the catch-all).
4. Delete the paused ad and the test video. Nothing goes live from the spike.

## Effort and money

Yours: about one hour at Thursday's show for the audio, thirty minutes to file the takes and write `SOURCES.md`, and the review of the first three renders on the contact sheet. Build: the spike half a day; the three first compositions about four hours; the bank integration (`video:` field, render, upload, creative, tests) about three hours; docs one hour. Money: nothing; Remotion's free licence covers a company of up to three people; Meta spend is unchanged because the videos replace or sit beside ads inside the existing budgets.

## How we will know

The comparison has to be like for like. Since 13 September every bank ad already carries a 9:16 still for Stories and Reels, so the still arm exists: the video twin is a second ad in the same ad set with the same copy, the same 4:5 feed image and the video in place of the 9:16 still (`intent-I2` still, `intent-I2v` video). Only the Stories and Reels placements are compared, read with the placement breakdown (`breakdowns=publisher_platform,platform_position`), a one-line addition to the readout; the feed rows of both ads are identical by construction and are ignored. Meta will not split spend evenly between the twins, it moves budget to an early leader within days, so the read is cost per result, not volume.

Written down before launch, not after: the primary metric is cost per landing page view in Stories and Reels (site `/go/` clicks by utm_content as the check); ThruPlay and three-second holds are diagnostics only; a twin is judged only past the bank's existing floor (30 landing page views per ad) and after two to three weeks; "video wins" means at least 25 percent cheaper per landing page view on those placements with both ads past the floor, anything closer is a draw and the still stays. The Saturday review reads the pair and the recommendations section (the Reels item should disappear on its own once a video with audio is live on that ad set).

## Open questions before build

1. `bed.mp3`: where is it from and under what licence? If unknown, no music at all is the plan.
2. Which show do you record at first: this Thursday (17 September)?
3. A voice line on the intent ads: yours through the existing pipeline, the host with a yes, or none?
4. Feeds: keep the 4:5 still (the plan) or also a 4:5 video in step two?
5. Start with three concepts (8, 1, 2) or all eight rendered for the contact sheet before choosing?
6. Home for the code: `video/` in the site repo (the plan) or the August project extended?
7. The comparison design above (a video twin ad beside each still, judged on Stories and Reels only, 25 percent as the bar): agreed, or a different bar?
8. Photos with identifiable audience faces: none in the videos (the plan), or do you want to ask a few regulars for a written yes so one real-crowd concept is possible?

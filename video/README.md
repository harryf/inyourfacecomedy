# video/

The video ads for Meta Stories and Reels, made with [Remotion](https://www.remotion.dev) under
bun. Plan and concepts: `meta-ads/video-plan.md`. Jekyll does not publish this folder
(`_config.yml` excludes it), and it has its own `package.json`, apart from the site's.

```
cd video
bun install
bun scripts/Render.ts Departures        # out/Departures.mp4
bun scripts/Render.ts FifthLanguage     # out/FifthLanguage.mp4
bunx remotion studio src/index.ts       # preview and scrub in a browser
```

`scripts/Render.ts` renders one composition and runs the post-pass Instagram wants: 1080 x 1920,
H.264 yuv420p in tv range, 30 fps, AAC 48 kHz with a true-peak limiter, faststart. A composition
without sound gets a silent track.

## What is here

- `src/Root.tsx` lists the compositions. The words on screen are props with defaults, so the
  bank files in `meta-ads/bank/` can drive them later.
- `src/compositions/Departures.tsx`: a split-flap station board flips in row by row, the status
  flips to ON TIME with a chime, the room laughs into the logo. 11 seconds.
- `src/compositions/FifthLanguage.tsx`: Deutsch, Français, Italiano, Rumantsch stamp on, then
  ENGLISH in red with the room's laugh, which drops to a chuckle while the line is read and
  swells back at the logo. 11.5 seconds.
- `src/components/EndLogo.tsx`: the closing beat every ad shares.
- `src/theme.ts`: the site's colours and the Reels safe zone. Meta's own buttons cover about the
  top 270 px and everything below 1250 px, so words and logo stay inside that box.

## Audio is not in git

`public/audio/` is ignored: it holds cuts of a room recording and a draft sound effect whose
licence is still open. A fresh clone renders nothing until those files are back. The masters,
how they were cut and where each came from are in `meta-ads/creative/audio/` (`SOURCES.md`,
also not in git). Files the compositions expect: `flutter-row.wav`, `flutter-status.wav`,
`chime-on-time.wav` (synthesised, ours), `laugh-end-departures.wav`, `stamp.wav`,
`bed-fifth-language.wav`.

Rules that carry over from the plan: no comedian's words in an ad without asking them (every
laugh is cut to start after the last word), no identifiable audience faces, no music from
Meta's library, and nothing goes live with an unlicensed sound.

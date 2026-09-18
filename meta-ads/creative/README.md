# Ad creative

Hand-made images and clips for the Meta ads. Everything in this folder except this file and
`.gitkeep` is gitignored: the repo is public and clips can show audience faces. Keep a backup
in your own photo library or Drive.

Layout:

```
meta-ads/creative/
  bank/<hook>/           one folder per hook from docs/meta-ads.md phase 4 (newcomer, coffee, plain, proof, central, region, ...)
    <hook>-post-v1.png   4:5 feed image (1080 x 1350), from Flyer Maker or Week Story "post" format
    <hook>-story-v1.png  9:16 story image (1080 x 1920), the "story" format
    <hook>-post-v1.mp4   a clip, when the hook is a clip
    copy.md              the primary text and headline used, one line per version
  lineup/<show>-<date>/  the Monday lineup flyer for one show date (post and story), until the script makes these
  clips/                 raw phone clips before cutting
```

Naming: `<hook>-<format>-v<N>.<ext>`. Bump `v` when the image changes; the ad name in Ads
Manager and the `utm_content` on its link carry the same `<hook>-v<N>`, so `/reports/`
shows clicks per version.

Generated output from `script/meta-lineup-ad.ts` goes to `script/meta-out/`, not here.

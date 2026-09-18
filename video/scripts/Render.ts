// Render one composition and run the Instagram post-pass (tv-range yuv420p, faststart, AAC
// with a true-peak limiter; a silent track is added when the composition has no audio, since
// Reels and Stories expect one). Usage, from video/:
//
//   bun scripts/Render.ts Departures            # writes out/Departures.mp4
//   bun scripts/Render.ts FifthLanguage out/x.mp4
import { $ } from "bun";
import { mkdirSync } from "node:fs";

const id = Bun.argv[2];
if (!id) { console.error("usage: bun scripts/Render.ts <CompositionId> [output.mp4]"); process.exit(1); }
const out = Bun.argv[3] ?? `out/${id}.mp4`;
const raw = `out/${id}-raw.mp4`;
mkdirSync("out", { recursive: true });

await $`bunx remotion render src/index.ts ${id} ${raw} --codec h264 --crf 17 --log=error`;
const hasAudio = (await $`ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 ${raw}`.text()).trim() !== "";
const video = ["-vf", "scale=in_range=jpeg:out_range=tv,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-profile:v", "high", "-level", "4.1", "-r", "30", "-movflags", "+faststart"];
if (hasAudio) await $`ffmpeg -y -hide_banner -loglevel error -i ${raw} ${video} -af alimiter=limit=0.89:attack=5:release=60:level=false -c:a aac -ar 48000 -b:a 192k ${out}`;
else await $`ffmpeg -y -hide_banner -loglevel error -i ${raw} -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 ${video} -c:a aac -ar 48000 -b:a 128k -shortest ${out}`;
console.log(await $`ffprobe -v error -show_entries stream=codec_name,width,height,pix_fmt,r_frame_rate,sample_rate:format=duration,size -of compact ${out}`.text());
process.exit(0);   // Remotion's renderer can leave handles open under bun

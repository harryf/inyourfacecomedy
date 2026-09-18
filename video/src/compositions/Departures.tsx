import { AbsoluteFill, Audio, Sequence, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { EndLogo } from "../components/EndLogo";
import { useFonts } from "../fonts";
import { C, FONT, SAFE } from "../theme";

// Concept 2, "Departures" (cold, the station look): a split-flap board whose rows flip in one
// after another, then the status flips to ON TIME. Reads silent. Sound: a flap flutter per row
// that ends in a clack as the row lands, the same for the status, a two-note chime as ON TIME
// lands (synthesised, ours), then the room's big laugh swelling into the logo. The audio files live in public/audio/ and are not in git.
export const departuresSchema = z.object({ rows: z.array(z.string()).min(1).max(5), status: z.string(), endLine: z.string() });
export const DEPARTURES_SECONDS = 11;

const COLS = 16;
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:'";
const ROW_START = 0.3, ROW_GAP = 1.05, STATUS_AT = 5.0, CHIME_AT = 5.7, LAUGH_AT = 6.6, LOGO_AT = 7.2;

// One flap cell: spins through glyphs, each column settling a little after the one before.
const Cell: React.FC<{ target: string; start: number; col: number; seed: string; size: number; colour?: string }> = ({ target, start, col, seed, size, colour }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const begin = Math.round(start * fps);
  const settle = begin + 8 + col * 2;
  let ch = " ";
  if (frame >= settle) ch = target;
  else if (frame >= begin && target !== " ") ch = GLYPHS[Math.floor(random(`${seed}-${col}-${Math.floor(frame / 2)}`) * GLYPHS.length)];
  // The flap falls: a quick squash on every change, and once more as it lands.
  const phase = frame >= settle ? Math.min(1, (frame - settle) / 3) : (frame % 2) / 2;
  const squash = frame < begin ? 1 : interpolate(phase, [0, 1], [0.55, 1]);
  return (
    <div style={{
      width: size, height: size * 1.42, marginRight: 4, borderRadius: 6, background: "#1b1b1e", position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.05)",
    }}>
      <span style={{ fontFamily: FONT.display, fontSize: size * 1.05, lineHeight: 1, color: colour || C.yellow, transform: `scaleY(${squash})` }}>{ch}</span>
      <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "rgba(0,0,0,0.65)" }} />
    </div>
  );
};

const Row: React.FC<{ text: string; start: number; seed: string; size: number; colour?: string }> = ({ text, start, seed, size, colour }) => (
  <div style={{ display: "flex" }}>
    {text.toUpperCase().padEnd(COLS, " ").slice(0, COLS).split("").map((c, i) => <Cell key={i} target={c} start={start} col={i} seed={seed} size={size} colour={colour} />)}
  </div>
);

export const Departures: React.FC<z.infer<typeof departuresSchema>> = ({ rows, status, endLine }) => {
  useFonts();
  const { fps } = useVideoConfig();
  const width = SAFE.right - SAFE.left;
  const size = Math.floor((width - COLS * 4) / COLS);
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, #121215 0%, ${C.ink} 100%)` }}>
      <div style={{ position: "absolute", left: SAFE.left, top: SAFE.top + 20, width }}>
        <div style={{ fontFamily: FONT.body, fontWeight: 800, fontSize: 40, letterSpacing: 10, color: C.cream, opacity: 0.85, marginBottom: 34 }}>ABFAHRT · DEPARTURES</div>
        {rows.map((r, i) => <div key={i} style={{ marginBottom: 26 }}><Row text={r} start={ROW_START + i * ROW_GAP} seed={`row${i}`} size={size} /></div>)}
        <div style={{ marginTop: 40, display: "flex", alignItems: "center" }}>
          <div style={{ fontFamily: FONT.body, fontWeight: 800, fontSize: 34, letterSpacing: 6, color: C.cream, opacity: 0.7, width: size * 4 + 16 }}>STATUS</div>
          <Row text={status} start={STATUS_AT} seed="status" size={size} colour="#7CFC8A" />
        </div>
      </div>
      <EndLogo from={Math.round(LOGO_AT * fps)} line={endLine} />
      {rows.map((_, i) => <Sequence key={i} from={Math.round((ROW_START + i * ROW_GAP) * fps)}><Audio src={staticFile("audio/flutter-row.wav")} volume={0.55} /></Sequence>)}
      <Sequence from={Math.round(STATUS_AT * fps)}><Audio src={staticFile("audio/flutter-status.wav")} volume={0.6} /></Sequence>
      <Sequence from={Math.round(CHIME_AT * fps)}><Audio src={staticFile("audio/chime-on-time.wav")} volume={0.8} /></Sequence>
      <Sequence from={Math.round(LAUGH_AT * fps)}><Audio src={staticFile("audio/laugh-end-departures.wav")} volume={0.9} /></Sequence>
    </AbsoluteFill>
  );
};

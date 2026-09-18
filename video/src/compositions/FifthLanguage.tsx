import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { EndLogo } from "../components/EndLogo";
import { useFonts } from "../fonts";
import { C, FONT, SAFE } from "../theme";

// Concept 3, "Fifth language" (cold, the Swiss look): the four national languages stamp on in
// black on the Swiss look's paper, fast (the list is the set-up, not the message), then
// "English" in red, bigger. Reads silent. Sound: a stamp thud per word, then one continuous
// room: the laugh lands on "English", drops to a chuckle under the line while it is read, and
// swells back as the logo arrives (the bed's biggest laugh is cut to start there). The audio
// files live in public/audio/ and are not in git.
export const fifthLanguageSchema = z.object({ line: z.string(), endLine: z.string() });
export const FIFTH_SECONDS = 11.5;

const WORDS: { word: string; at: number }[] = [
  { word: "Deutsch", at: 0.3 }, { word: "Français", at: 0.7 }, { word: "Italiano", at: 1.1 }, { word: "Rumantsch", at: 1.5 },
];
// The line is what has to be read: it is up for five seconds before the logo covers it.
const ENGLISH_AT = 2.1, LINE_AT = 3.0, LOGO_AT = 8.0;

export const FifthLanguage: React.FC<z.infer<typeof fifthLanguageSchema>> = ({ line, endLine }) => {
  useFonts();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stamp = (at: number) => {
    const f = frame - Math.round(at * fps);
    if (f < 0) return { opacity: 0, scale: 1 };
    // A stamp: arrives oversized and lands hard.
    return { opacity: 1, scale: interpolate(spring({ frame: f, fps, config: { damping: 14, mass: 0.4, stiffness: 260 } }), [0, 1], [1.5, 1]) };
  };
  const top = SAFE.top + 40;
  const eng = stamp(ENGLISH_AT);
  const dim = interpolate(frame, [ENGLISH_AT * fps, (ENGLISH_AT + 0.5) * fps], [1, 0.28], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      {/* the red Swiss bar down the left edge */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 36, height: "100%", background: C.red }} />
      {WORDS.map((w, i) => {
        const s = stamp(w.at);
        return (
          <div key={w.word} style={{
            position: "absolute", left: SAFE.left, top: top + i * 118, fontFamily: FONT.display, fontSize: 104, lineHeight: 1,
            color: C.ink, textTransform: "uppercase", opacity: s.opacity * dim, transform: `scale(${s.scale})`, transformOrigin: "left center",
          }}>{w.word}</div>
        );
      })}
      <div style={{
        position: "absolute", left: SAFE.left, top: top + 4 * 118 + 10, fontFamily: FONT.display, fontSize: 218, lineHeight: 1,
        color: C.red, textTransform: "uppercase", opacity: eng.opacity, transform: `scale(${eng.scale}) rotate(-2deg)`, transformOrigin: "left center",
      }}>English</div>
      <div style={{
        position: "absolute", left: SAFE.left, width: SAFE.right - SAFE.left, top: top + 4 * 118 + 270, fontFamily: FONT.body, fontWeight: 700,
        fontSize: 62, lineHeight: 1.2, color: C.ink,
        opacity: interpolate(frame, [LINE_AT * fps, (LINE_AT + 0.4) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      }}>{line}</div>
      <EndLogo from={Math.round(LOGO_AT * fps)} line={endLine} />
      {/* a stamp thud per language, then the one continuous room described at the top */}
      {WORDS.map((w) => <Sequence key={w.word} from={Math.round(w.at * fps)}><Audio src={staticFile("audio/stamp.wav")} volume={0.7} /></Sequence>)}
      <Sequence from={Math.round(ENGLISH_AT * fps)}><Audio src={staticFile("audio/stamp.wav")} volume={1} /></Sequence>
      <Sequence from={Math.round((ENGLISH_AT + 0.12) * fps)}>
        <Audio src={staticFile("audio/bed-fifth-language.wav")} volume={(f) => {
          const t = f / fps + ENGLISH_AT + 0.12;   // composition time
          const duck = interpolate(t, [ENGLISH_AT + 0.9, LINE_AT + 0.6, LOGO_AT - 0.7, LOGO_AT + 0.1], [0.85, 0.3, 0.3, 0.95], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return duck * interpolate(t, [FIFTH_SECONDS - 1, FIFTH_SECONDS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} />
      </Sequence>
    </AbsoluteFill>
  );
};

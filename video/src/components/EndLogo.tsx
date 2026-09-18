import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, H, SAFE, W } from "../theme";

// The last beat of every ad: the logo springs in, breathing with a yellow glow (the August
// story's logo, without the screensaver drift), one line under it.
export const EndLogo: React.FC<{ from: number; line?: string }> = ({ from, line }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - from;
  if (f < 0) return null;
  const t = f / fps;
  const pop = spring({ frame: f, fps, config: { damping: 11, mass: 0.7 } });
  const breathe = 1 + 0.05 * Math.sin((2 * Math.PI * t) / 3);
  const glow = 0.45 + 0.25 * Math.sin(t * 2.1);
  const size = 520;
  const cy = (SAFE.top + SAFE.bottom) / 2 - 60;
  return (
    <div style={{ position: "absolute", inset: 0, width: W, height: H, background: C.ink, opacity: interpolate(f, [0, 6], [0, 1], { extrapolateRight: "clamp" }) }}>
      <Img
        src={staticFile("logo.png")}
        style={{
          position: "absolute", left: W / 2 - size / 2, top: cy - size / 2, width: size, height: size,
          transform: `scale(${pop * breathe})`,
          filter: `drop-shadow(0 0 ${26 + 18 * glow}px rgba(255, 213, 79, ${glow}))`,
        }}
      />
      {line ? (
        <div style={{
          position: "absolute", left: SAFE.left, width: SAFE.right - SAFE.left, top: cy + size / 2 + 40, textAlign: "center",
          fontFamily: FONT.display, fontSize: 64, lineHeight: 1.1, color: C.cream, textTransform: "uppercase", letterSpacing: 1,
          opacity: interpolate(f, [10, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}>{line}</div>
      ) : null}
    </div>
  );
};

import { Composition } from "remotion";
import { DEPARTURES_SECONDS, Departures, departuresSchema } from "./compositions/Departures";
import { FIFTH_SECONDS, FifthLanguage, fifthLanguageSchema } from "./compositions/FifthLanguage";
import { FPS, H, W } from "./theme";

// One composition per concept in meta-ads/video-plan.md. All 9:16 for Stories and Reels. The
// on-screen words are props so the bank files can drive them later; the defaults are the plan's.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Departures" component={Departures} schema={departuresSchema}
      defaultProps={{ rows: ["ENGLISH STAND-UP", "THURSDAY 19:30", "ROBIN'S COFFEE", "2 MIN TO CENTRAL"], status: "ON TIME", endLine: "Every Thursday" }}
      durationInFrames={Math.round(DEPARTURES_SECONDS * FPS)} fps={FPS} width={W} height={H}
    />
    <Composition
      id="FifthLanguage" component={FifthLanguage} schema={fifthLanguageSchema}
      defaultProps={{ line: "Switzerland's fifth language. Every Thursday, two minutes from Central.", endLine: "English stand-up in Zürich" }}
      durationInFrames={Math.round(FIFTH_SECONDS * FPS)} fps={FPS} width={W} height={H}
    />
  </>
);

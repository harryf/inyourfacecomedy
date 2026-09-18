import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import { loadFont } from "@remotion/fonts";

let loaded: Promise<void> | null = null;
const load = () => {
  if (!loaded) {
    loaded = Promise.all([
      loadFont({ family: "Anton", url: staticFile("fonts/Anton-Regular.ttf"), weight: "400" }),
      loadFont({ family: "Permanent Marker", url: staticFile("fonts/PermanentMarker-Regular.ttf"), weight: "400" }),
      loadFont({ family: "Inter", url: staticFile("fonts/Inter.ttf"), weight: "100 900" }),
    ]).then(() => undefined);
  }
  return loaded;
};

export const useFonts = () => {
  const [handle] = useState(() => delayRender("fonts"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    load().then(() => { setReady(true); continueRender(handle); });
  }, [handle]);
  return ready;
};

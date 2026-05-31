// bun test preload — gives every test a simulated browser DOM.
// happy-dom provides document, window, navigator, location, URLSearchParams, etc.
// so the client-side scripts (comedian-lineup.js, lineup-maker-2000.js) run headless.
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({ url: "https://inyourfacecomedy.ch/" });

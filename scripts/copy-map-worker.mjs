// Copies MapLibre's web worker into public/ so the browser can load it.
//
// MapLibre draws the map on a background thread, and expects to find the
// worker script sitting next to its own file. Once a bundler has packed the
// library into chunks that is no longer true, so the worker is served from a
// fixed address instead (see MAP_WORKER_URL in src/lib/map/country-map.ts).
//
// Runs automatically before `npm run dev` and `npm run build`, which keeps
// the copy in step with whichever version of maplibre-gl is installed.

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = new URL("../public/maplibre/", import.meta.url);

mkdirSync(target, { recursive: true });
copyFileSync(
  require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs"),
  new URL("maplibre-gl-worker.mjs", target),
);

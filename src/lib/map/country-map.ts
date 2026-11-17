// The interactive base map shared by the public map page and the pin picker
// in /admin: MapLibre drawing country outlines from a local file. There are
// no map tiles and no API key; the only request is for /geo/countries.geojson
// (made by scripts/build-geo.mjs). Colours come from the CSS variables in
// globals.css and follow the theme.

import { geoInterpolate } from "d3-geo";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { FilterSpecification, Map as MapLibreMap } from "maplibre-gl";
import type { LatLng } from "../types";

type MapLibre = typeof import("maplibre-gl");

type CountryCollection = FeatureCollection<Polygon | MultiPolygon, { code: string | null; name: string }>;

export interface CountryMap {
  map: MapLibreMap;
  maplibregl: MapLibre;
  /** Stops following the theme and removes the map. */
  destroy: () => void;
}

interface CountryMapOptions {
  visitedCodes: string[];
  center?: [lng: number, lat: number];
  zoom?: number;
}

const OUTLINES_URL = "/geo/countries.geojson";
/** Put in place by scripts/copy-map-worker.mjs. */
const MAP_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";
/** How far out (about 30, 70 and 130 km) to look for land near a point at sea. */
const NEARBY_RADII_DEGREES = [0.3, 0.6, 1.2];
/** Layer filter matching the outlines of the given countries. */
const inCountries = (codes: string[]): FilterSpecification => ["in", ["get", "code"], ["literal", codes]];

// Fetched once per page load, however many callers ask for it.
let outlinesRequest: Promise<CountryCollection> | undefined;

function loadOutlines(): Promise<CountryCollection> {
  outlinesRequest ??= fetch(OUTLINES_URL).then((response) => {
    if (!response.ok) throw new Error(`Could not load country outlines (${response.status})`);
    return response.json();
  });
  return outlinesRequest;
}

/** Ray casting: a point is inside a ring if a line from it crosses the ring an odd number of times. */
function ringContains(ring: Position[], [x, y]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and not inside any hole (lakes, enclaves). */
const polygonContains = ([outer, ...holes]: Position[][], point: [number, number]) =>
  ringContains(outer, point) && !holes.some((hole) => ringContains(hole, point));

/**
 * ISO code of the country at a point, or null.
 *
 * The outlines are simplified, so small islands and ragged coasts are missing
 * (Tromso, on its island, reads as open sea). When the exact point misses,
 * rings of nearby points are tried and the country most of them hit wins.
 */
export async function findCountryAt({ lat, lng }: LatLng): Promise<string | null> {
  const { features } = await loadOutlines();
  const codeAt = (point: [number, number]) =>
    features.find(({ geometry }) =>
      geometry.type === "Polygon"
        ? polygonContains(geometry.coordinates, point)
        : geometry.coordinates.some((polygon) => polygonContains(polygon, point)),
    )?.properties.code ?? null;

  const exact = codeAt([lng, lat]);
  if (exact) return exact;

  const tally = new Map<string, number>();
  for (const radius of NEARBY_RADII_DEGREES) {
    for (let bearing = 0; bearing < 360; bearing += 45) {
      const angle = (bearing * Math.PI) / 180;
      const code = codeAt([lng + radius * Math.cos(angle), lat + radius * Math.sin(angle)]);
      if (code) tally.set(code, (tally.get(code) ?? 0) + 1);
    }
    // Stop at the first ring that touches land.
    if (tally.size > 0) break;
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function themeColours() {
  const styles = getComputedStyle(document.documentElement);
  const read = (name: string) => styles.getPropertyValue(name).trim();
  return {
    water: read("--map-water"),
    land: read("--map-land"),
    border: read("--map-border"),
    visited: read("--map-visited"),
    visitedLine: read("--map-visited-line"),
    route: read("--map-route"),
  };
}

function applyTheme(map: MapLibreMap) {
  const colours = themeColours();
  map.setPaintProperty("water", "background-color", colours.water);
  map.setPaintProperty("land", "fill-color", colours.land);
  map.setPaintProperty("borders", "line-color", colours.border);
  map.setPaintProperty("visited", "fill-color", colours.visited);
  map.setPaintProperty("visited-line", "line-color", colours.visitedLine);
  if (map.getLayer("routes")) map.setPaintProperty("routes", "line-color", colours.route);
}

/** MapLibre is large, so it is only downloaded by pages that show a map. */
async function loadMapLibre(): Promise<MapLibre> {
  const maplibregl = await import("maplibre-gl");
  maplibregl.setWorkerUrl(MAP_WORKER_URL);
  return maplibregl;
}

/** Creates the map and resolves once the countries are drawn. */
export async function createCountryMap(
  container: HTMLElement,
  { visitedCodes, center = [-20, 28], zoom = 1.2 }: CountryMapOptions,
): Promise<CountryMap> {
  const maplibregl = await loadMapLibre();
  const colours = themeColours();

  const map = new maplibregl.Map({
    container,
    center,
    zoom,
    minZoom: 0.5,
    maxZoom: 7,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    style: {
      version: 8,
      // MapLibre fetches and parses the outlines itself, off the main thread.
      sources: { countries: { type: "geojson", data: OUTLINES_URL } },
      layers: [
        { id: "water", type: "background", paint: { "background-color": colours.water } },
        { id: "land", type: "fill", source: "countries", paint: { "fill-color": colours.land } },
        {
          id: "visited",
          type: "fill",
          source: "countries",
          filter: inCountries(visitedCodes),
          paint: { "fill-color": colours.visited },
        },
        {
          id: "borders",
          type: "line",
          source: "countries",
          paint: { "line-color": colours.border, "line-width": 0.6 },
        },
        {
          id: "visited-line",
          type: "line",
          source: "countries",
          filter: inCountries(visitedCodes),
          paint: { "line-color": colours.visitedLine, "line-width": 1 },
        },
      ],
    },
  });
  map.touchZoomRotate.disableRotation();
  map.keyboard.disableRotation();

  // Recolour when the theme toggle flips data-theme on <html>.
  const themeObserver = new MutationObserver(() => applyTheme(map));
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  await map.once("load");

  return {
    map,
    maplibregl,
    destroy: () => {
      themeObserver.disconnect();
      map.remove();
    },
  };
}

/** Changes which countries are filled in. */
export function setVisitedCountries(map: MapLibreMap, codes: string[]) {
  map.setFilter("visited", inCountries(codes));
  map.setFilter("visited-line", inCountries(codes));
}

/** Adds dotted great-circle lines from `from` to each destination. */
export function addRoutes(map: MapLibreMap, from: LatLng, destinations: LatLng[]) {
  map.addSource("routes", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: destinations.map((to) => ({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: greatCircle(from, to) },
      })),
    },
  });
  map.addLayer({
    id: "routes",
    type: "line",
    source: "routes",
    layout: { "line-cap": "round" },
    paint: {
      "line-color": themeColours().route,
      "line-width": 1.1,
      "line-opacity": 0.55,
      "line-dasharray": [0.5, 3],
    },
  });
}

/**
 * Points along the shortest path between two places. Longitudes are allowed
 * to run past ±180 so a route across the Pacific is drawn as one unbroken
 * line instead of jumping to the other edge of the map.
 */
function greatCircle(from: LatLng, to: LatLng, steps = 64): [number, number][] {
  const interpolate = geoInterpolate([from.lng, from.lat], [to.lng, to.lat]);
  const points: [number, number][] = [];
  for (let step = 0; step <= steps; step++) {
    const [rawLng, lat] = interpolate(step / steps);
    let lng = rawLng;
    const previous = points.at(-1);
    if (previous) {
      while (lng - previous[0] > 180) lng -= 360;
      while (lng - previous[0] < -180) lng += 360;
    }
    points.push([lng, lat]);
  }
  return points;
}

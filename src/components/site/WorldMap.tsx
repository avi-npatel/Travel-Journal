import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { FeatureCollection } from "geojson";
import Link from "next/link";
import { getCountry } from "@/lib/countries";
import { COUNTRY_OUTLINES, OUTLINED_CODES } from "@/lib/map/atlas";
import type { LatLng } from "@/lib/types";

export interface MapTrip {
  slug: string;
  title: string;
  /** Shown as the pin's tooltip, e.g. "Tromso · Mar 2026". */
  label: string;
  point: LatLng;
}

interface WorldMapProps {
  visitedCodes: string[];
  trips: MapTrip[];
  home: LatLng;
}

// The projection and every country's path are the same for each render, so
// they are worked out once when the module loads.
const WIDTH = 1000;
const outlines = COUNTRY_OUTLINES.filter((c) => c.code !== "AQ"); // no Antarctica: saves a third of the height
const collection: FeatureCollection = {
  type: "FeatureCollection",
  features: outlines.map((c) => c.feature),
};
const projection = geoNaturalEarth1().fitWidth(WIDTH, collection);
const path = geoPath(projection).digits(1);
const HEIGHT = Math.ceil(path.bounds(collection)[1][1]);
const COUNTRY_PATHS = outlines.map((c) => ({ code: c.code, name: c.name, d: path(c.feature) ?? "" }));

const project = ({ lat, lng }: LatLng) => projection([lng, lat]) ?? [0, 0];

/**
 * The home page map: plain SVG drawn on the server, so it costs the visitor
 * no JavaScript. Visited countries are filled, each trip gets a pin that
 * links to it, and thin great-circle lines run out from home.
 */
export function WorldMap({ visitedCodes, trips, home }: WorldMapProps) {
  const visited = new Set(visitedCodes);
  const unvisitedPath = COUNTRY_PATHS.filter((c) => !c.code || !visited.has(c.code))
    .map((c) => c.d)
    .join("");

  // Countries too small to have an outline at this scale get a dot instead.
  const smallVisited = visitedCodes
    .filter((code) => !OUTLINED_CODES.has(code))
    .map(getCountry)
    .filter((c) => c !== undefined);

  const [homeX, homeY] = project(home);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`World map with ${visited.size} visited ${visited.size === 1 ? "country" : "countries"} filled in`}
      className="block h-auto w-full"
    >
      <path d={unvisitedPath} fill="var(--map-land)" stroke="var(--map-border)" strokeWidth="0.5" />

      {COUNTRY_PATHS.filter((c) => c.code && visited.has(c.code)).map((c) => (
        <path
          key={c.code}
          d={c.d}
          fill="var(--map-visited)"
          stroke="var(--map-visited-line)"
          strokeWidth="0.6"
          strokeLinejoin="round"
        >
          <title>{c.name}</title>
        </path>
      ))}

      {smallVisited.map((c) => {
        const [x, y] = project(c);
        return (
          <circle key={c.code} cx={x} cy={y} r="2.2" fill="var(--map-visited-line)">
            <title>{c.name}</title>
          </circle>
        );
      })}

      <g
        fill="none"
        stroke="var(--map-route)"
        strokeWidth="0.7"
        strokeDasharray="1 3.5"
        strokeLinecap="round"
        opacity="0.7"
      >
        {trips.map((trip) => (
          <path
            key={trip.slug}
            d={
              path({
                type: "LineString",
                coordinates: [
                  [home.lng, home.lat],
                  [trip.point.lng, trip.point.lat],
                ],
              }) ?? ""
            }
          />
        ))}
      </g>

      <circle cx={homeX} cy={homeY} r="3.2" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.2">
        <title>Home</title>
      </circle>

      {trips.map((trip) => {
        const [x, y] = project(trip.point);
        return (
          <Link
            key={trip.slug}
            href={`/trips/${trip.slug}`}
            className="group outline-none"
            aria-label={trip.label}
          >
            <title>{trip.label}</title>
            {/* Invisible, larger target so the pin is easy to hit. */}
            <circle cx={x} cy={y} r="13" fill="transparent" />
            <circle
              cx={x}
              cy={y}
              r="9"
              fill="none"
              stroke="var(--pin)"
              strokeWidth="1.2"
              className="opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
            />
            <circle
              cx={x}
              cy={y}
              r="4.2"
              fill="var(--pin)"
              stroke="var(--paper)"
              strokeWidth="1"
              style={{ filter: "var(--glow-pin)" }}
            />
          </Link>
        );
      })}
    </svg>
  );
}

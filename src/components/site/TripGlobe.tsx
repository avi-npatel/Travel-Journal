import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { cn } from "@/lib/cn";
import { COUNTRY_OUTLINES, LAND } from "@/lib/map/atlas";
import type { LatLng } from "@/lib/types";

interface TripGlobeProps {
  /** Where the trip went. Null draws the globe around home with no route. */
  point: LatLng | null;
  home: LatLng;
  countryCodes: string[];
  className?: string;
}

const SIZE = 600;
const RADIUS = 290;
const GRATICULE = geoGraticule10();

const toLngLat = ({ lat, lng }: LatLng): [number, number] => [lng, lat];

/**
 * A globe turned toward a trip's destination, with the country shaded and
 * the route from home dotted in. It stands in wherever a trip has no photo
 * yet (covers, the home hero, the empty gallery), so those spots look drawn
 * on purpose rather than missing something.
 *
 * Decorative: whatever sits next to it carries the text.
 */
export function TripGlobe({ point, home, countryCodes, className }: TripGlobeProps) {
  // Look from most of the way along the route, so the destination sits near
  // the middle and the line trails off toward home.
  const [centerLng, centerLat] = point
    ? geoInterpolate(toLngLat(home), toLngLat(point))(0.8)
    : toLngLat(home);

  const projection = geoOrthographic()
    .scale(RADIUS)
    .translate([SIZE / 2, SIZE / 2])
    .rotate([-centerLng, -centerLat])
    .clipAngle(90);
  const path = geoPath(projection).digits(1);

  const isFacingViewer = (p: LatLng) => geoDistance(toLngLat(p), [centerLng, centerLat]) < Math.PI / 2;
  const highlighted = COUNTRY_OUTLINES.filter((c) => c.code && countryCodes.includes(c.code));
  const homeXY = isFacingViewer(home) ? projection(toLngLat(home)) : null;
  const pointXY = point ? projection(toLngLat(point)) : null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("block", className)}
    >
      <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="var(--map-water)" stroke="var(--rule)" />
      <path d={path(GRATICULE) ?? ""} fill="none" stroke="var(--map-graticule)" strokeWidth="0.7" />
      <path d={path(LAND) ?? ""} fill="var(--map-land)" />

      {highlighted.map((c) => (
        <path
          key={c.code}
          d={path(c.feature) ?? ""}
          fill="var(--map-visited)"
          stroke="var(--map-visited-line)"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      ))}

      {point && (
        <path
          d={path({ type: "LineString", coordinates: [toLngLat(home), toLngLat(point)] }) ?? ""}
          fill="none"
          stroke="var(--map-route)"
          strokeWidth="1.6"
          strokeDasharray="0.1 7"
          strokeLinecap="round"
        />
      )}

      {homeXY && (
        <circle
          cx={homeXY[0]}
          cy={homeXY[1]}
          r="5"
          fill="var(--paper)"
          stroke="var(--ink)"
          strokeWidth="1.6"
        />
      )}

      {pointXY && (
        <g style={{ filter: "var(--glow-pin)" }}>
          <circle cx={pointXY[0]} cy={pointXY[1]} r="13" fill="none" stroke="var(--pin)" strokeWidth="1.4" />
          <circle cx={pointXY[0]} cy={pointXY[1]} r="5.5" fill="var(--pin)" />
        </g>
      )}
    </svg>
  );
}

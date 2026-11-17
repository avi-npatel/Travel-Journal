import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath } from "d3-geo";
import { cn } from "@/lib/cn";
import { mapPins } from "@/lib/geo";
import { COUNTRY_OUTLINES, LAND } from "@/lib/map/atlas";
import type { LatLng, Trip, TripPlace } from "@/lib/types";

interface TripGlobeProps {
  trip: { places: TripPlace[] } & Pick<Trip, "country_codes">;
  home: LatLng;
  className?: string;
}

const SIZE = 600;
const RADIUS = 290;
const GRATICULE = geoGraticule10();

const toLngLat = ({ lat, lng }: LatLng): [number, number] => [lng, lat];

/**
 * A globe turned toward a trip, with its countries shaded, a pin on each of
 * its places, and routes dotted in from home to the places that have one. It
 * stands in wherever a trip has no photo yet (covers, the home hero, the
 * empty gallery), so those spots look drawn on purpose.
 *
 * Decorative: whatever sits next to it carries the text.
 */
export function TripGlobe({ trip, home, className }: TripGlobeProps) {
  const pins = mapPins(trip);
  const lead = pins[0] ?? null;

  // Look from most of the way along the route to the first place, so it sits
  // near the middle and the line trails off toward home.
  const [centerLng, centerLat] = lead
    ? geoInterpolate(toLngLat(home), toLngLat(lead.point))(0.8)
    : toLngLat(home);

  const projection = geoOrthographic()
    .scale(RADIUS)
    .translate([SIZE / 2, SIZE / 2])
    .rotate([-centerLng, -centerLat])
    .clipAngle(90);
  const path = geoPath(projection).digits(1);

  const isFacingViewer = (p: LatLng) => geoDistance(toLngLat(p), [centerLng, centerLat]) < Math.PI / 2;
  const highlighted = COUNTRY_OUTLINES.filter((c) => c.code && trip.country_codes.includes(c.code));
  const homeXY = isFacingViewer(home) ? projection(toLngLat(home)) : null;
  const pinXYs = pins
    .filter((pin) => isFacingViewer(pin.point))
    .map((pin, index) => ({ key: pin.key, lead: index === 0, xy: projection(toLngLat(pin.point)) }));

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

      {pins
        .filter((pin) => pin.showRoute)
        .map((pin) => (
          <path
            key={pin.key}
            d={path({ type: "LineString", coordinates: [toLngLat(home), toLngLat(pin.point)] }) ?? ""}
            fill="none"
            stroke="var(--map-route)"
            strokeWidth="1.6"
            strokeDasharray="0.1 7"
            strokeLinecap="round"
          />
        ))}

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

      <g style={{ filter: "var(--glow-pin)" }}>
        {pinXYs.map(
          ({ key, lead: isLead, xy }) =>
            xy && (
              <g key={key}>
                {isLead && (
                  <circle cx={xy[0]} cy={xy[1]} r="13" fill="none" stroke="var(--pin)" strokeWidth="1.4" />
                )}
                <circle cx={xy[0]} cy={xy[1]} r={isLead ? 5.5 : 4.5} fill="var(--pin)" />
              </g>
            ),
        )}
      </g>
    </svg>
  );
}

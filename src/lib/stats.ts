import { CONTINENTS, continentsOf } from "./countries";
import type { SiteSettings, TripSummary } from "./types";

export interface SiteStats {
  countries: number;
  continents: number;
  continentsTotal: number;
  trips: number;
  photos: number;
}

/** Every country that counts as visited: trip countries plus the extras list. */
export function visitedCountryCodes(
  trips: Pick<TripSummary, "country_codes">[],
  settings: Pick<SiteSettings, "extra_country_codes">,
): string[] {
  const codes = new Set<string>(settings.extra_country_codes);
  for (const trip of trips) trip.country_codes.forEach((code) => codes.add(code));
  return [...codes].sort();
}

export function computeStats(trips: TripSummary[], settings: SiteSettings): SiteStats {
  const visited = visitedCountryCodes(trips, settings);
  return {
    countries: visited.length,
    continents: continentsOf(visited).length,
    continentsTotal: CONTINENTS.length,
    trips: trips.length,
    photos: trips.reduce((sum, trip) => sum + trip.photo_count, 0),
  };
}

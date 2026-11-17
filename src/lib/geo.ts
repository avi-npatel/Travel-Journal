import { getCountry } from "./countries";
import type { LatLng, Trip, TripPlace } from "./types";

const EARTH_RADIUS_KM = 6371;
const KM_PER_MILE = 1.609344;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two points, in kilometres. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number, unit: "mi" | "km" = "mi"): string {
  const value = unit === "mi" ? km / KM_PER_MILE : km;
  return `${Math.round(value).toLocaleString("en-US")} ${unit}`;
}

/** "69.65°N 18.96°E" */
export function formatCoordinates({ lat, lng }: LatLng, digits = 2): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(digits)}°${ns} ${Math.abs(lng).toFixed(digits)}°${ew}`;
}

/** A place that has been given a spot on the map. */
export type PinnedPlace = TripPlace & LatLng;

/** The trip's places that have a map pin, in trip order. */
export function pinnedPlaces(trip: { places: TripPlace[] }): PinnedPlace[] {
  return trip.places.filter((place): place is PinnedPlace => place.lat !== null && place.lng !== null);
}

/**
 * The single point that stands for a whole trip (distance, globe covers):
 * its first pinned place, otherwise the middle of its first country. Null if
 * it has neither.
 */
export function tripPoint(trip: { places: TripPlace[] } & Pick<Trip, "country_codes">): LatLng | null {
  const first = pinnedPlaces(trip)[0];
  if (first) return { lat: first.lat, lng: first.lng };
  const country = trip.country_codes.map(getCountry).find(Boolean);
  return country ? { lat: country.lat, lng: country.lng } : null;
}

/** A pin to draw on a map, for one place or (if a trip has none) its country. */
export interface MapPin {
  /** Unique within the trip. */
  key: string;
  /** The place name; null for a country fallback pin. */
  name: string | null;
  point: LatLng;
  showRoute: boolean;
}

/**
 * Every pin a trip shows on the maps: one per pinned place. A trip with no
 * pinned place still gets one pin, in the middle of its first country, so it
 * never disappears from the map.
 */
export function mapPins(trip: { places: TripPlace[] } & Pick<Trip, "country_codes">): MapPin[] {
  const pinned = pinnedPlaces(trip);
  if (pinned.length > 0) {
    return pinned.map((place) => ({
      key: place.id,
      name: place.name,
      point: { lat: place.lat, lng: place.lng },
      showRoute: place.show_route,
    }));
  }
  const fallback = tripPoint(trip);
  return fallback ? [{ key: "country", name: null, point: fallback, showRoute: true }] : [];
}

/** Rounds a coordinate pair so it identifies an area, not an address. */
export function roundPoint(point: LatLng, digits: number): LatLng {
  const factor = 10 ** digits;
  return {
    lat: Math.round(point.lat * factor) / factor,
    lng: Math.round(point.lng * factor) / factor,
  };
}

export function homePoint(settings: { home_lat: number; home_lng: number }): LatLng {
  return { lat: settings.home_lat, lng: settings.home_lng };
}

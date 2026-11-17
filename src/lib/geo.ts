import { getCountry } from "./countries";
import type { LatLng, Trip } from "./types";

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

/**
 * Where a trip's pin goes: its own coordinates if it has them, otherwise the
 * middle of its first country. Null if it has neither.
 */
export function tripPoint(trip: Pick<Trip, "lat" | "lng" | "country_codes">): LatLng | null {
  if (trip.lat !== null && trip.lng !== null) return { lat: trip.lat, lng: trip.lng };
  const country = trip.country_codes.map(getCountry).find(Boolean);
  return country ? { lat: country.lat, lng: country.lng } : null;
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

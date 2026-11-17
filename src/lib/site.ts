import { tripYear } from "./dates";
import { slugify } from "./slug";
import type { Trip } from "./types";

/** The address the site is served from, used to build absolute URLs. */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Set by Vercel on every deployment.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

export const tripPath = (trip: Pick<Trip, "slug">) => `/trips/${trip.slug}`;

/** Link to a trip opened at one place's photos (the gallery reads the #place-… part). */
export const placePath = (trip: Pick<Trip, "slug">, placeName: string | null) =>
  placeName ? `${tripPath(trip)}#place-${slugify(placeName)}` : tripPath(trip);

/**
 * Numbers trips in the order they happened: the earliest is 1. Shown as
 * "No. 004" on trip pages and cards.
 */
export function numberTrips(trips: Pick<Trip, "id" | "start_date" | "created_at">[]) {
  const oldestFirst = [...trips].sort((a, b) => {
    const byDate = (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999");
    return byDate || a.created_at.localeCompare(b.created_at);
  });
  return new Map(oldestFirst.map((trip, index) => [trip.id, index + 1]));
}

export const formatTripNumber = (n: number | undefined) =>
  n === undefined ? "" : `No. ${String(n).padStart(3, "0")}`;

export { tripYear };

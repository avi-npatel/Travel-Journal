// Reads when and where a photo was taken from its EXIF data, before the photo
// is re-encoded (which removes that data from the published copy).

import exifr from "exifr";
import { getCountry } from "../countries";
import { toDateInputValue } from "../dates";
import { roundPoint } from "../geo";
import type { LatLng } from "../types";

export interface PhotoExif {
  takenAt: Date | null;
  location: LatLng | null;
}

/** What a batch of photos suggests about the trip they belong to. */
export interface TripSuggestion {
  total: number;
  withDate: number;
  withLocation: number;
  /** "YYYY-MM-DD" of the earliest and latest photo. */
  startDate: string | null;
  endDate: string | null;
  /** Middle of the photo locations, rounded to roughly 10 km. */
  point: LatLng | null;
  /** Country that point falls in, if it could be worked out. */
  countryCode: string | null;
}

/**
 * Public trip pins are rounded to one decimal place (about 10 km), so a pin
 * derived from photos points at a town, never at a street.
 */
const PIN_PRECISION_DIGITS = 1;

const isValidDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.getTime());

export async function readExif(file: File): Promise<PhotoExif> {
  try {
    const tags = await exifr.parse(file, { tiff: true, exif: true, gps: true });
    const takenAt = [tags?.DateTimeOriginal, tags?.CreateDate].find(isValidDate) ?? null;
    const hasLocation = Number.isFinite(tags?.latitude) && Number.isFinite(tags?.longitude);
    return {
      takenAt,
      location: hasLocation ? { lat: tags.latitude, lng: tags.longitude } : null,
    };
  } catch {
    // No EXIF block, or a format exifr cannot parse: simply nothing to offer.
    return { takenAt: null, location: null };
  }
}

export async function suggestFromExif(
  photos: PhotoExif[],
  findCountry: (point: LatLng) => Promise<string | null>,
): Promise<TripSuggestion> {
  const dates = photos.flatMap((p) => (p.takenAt ? [p.takenAt.getTime()] : []));
  const locations = photos.flatMap((p) => (p.location ? [p.location] : []));

  let point: LatLng | null = null;
  let countryCode: string | null = null;
  if (locations.length > 0) {
    const centre = {
      lat: locations.reduce((sum, l) => sum + l.lat, 0) / locations.length,
      lng: locations.reduce((sum, l) => sum + l.lng, 0) / locations.length,
    };
    point = roundPoint(centre, PIN_PRECISION_DIGITS);
    countryCode = await findCountry(centre).catch(() => null);
    if (countryCode && !getCountry(countryCode)) countryCode = null;
  }

  return {
    total: photos.length,
    withDate: dates.length,
    withLocation: locations.length,
    startDate: dates.length ? toDateInputValue(new Date(Math.min(...dates))) : null,
    endDate: dates.length ? toDateInputValue(new Date(Math.max(...dates))) : null,
    point,
    countryCode,
  };
}

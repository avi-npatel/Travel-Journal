// Every read the public site makes.
//
// Each function is cached ("use cache") and tagged, so pages are served from
// the cache and never wait on the database. When something changes in /admin,
// the server action in app/admin/actions.ts expires the tag and the next
// visitor gets fresh data, with no redeploy. `cacheLife("hours")` is only a
// safety net in case that call is ever missed.

import { cacheLife, cacheTag } from "next/cache";
import { sanitizeRichText } from "./sanitize";
import { createPublicClient } from "./supabase/public";
import type { Photo, SiteSettings, Trip, TripSummary, TripWithPhotos } from "./types";

export const SITE_CACHE_TAG = "site";

// `trips` and `photos` are linked twice (a photo belongs to a trip; a trip
// points at its cover photo), so each embed names the foreign key it follows.
const SUMMARY_COLUMNS =
  "*, cover:photos!trips_cover_photo_fk(*), photo_count:photos!photos_trip_id_fkey(count)";
const DETAIL_COLUMNS = "*, photos:photos!photos_trip_id_fkey(*)";

type SummaryRow = Trip & { cover: Photo | null; photo_count: { count: number }[] };
type DetailRow = Trip & { photos: Photo[] };

function fail(what: string, message: string): never {
  throw new Error(`Could not load ${what}: ${message}`);
}

export async function getSettings(): Promise<SiteSettings> {
  "use cache";
  cacheTag(SITE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient().from("site_settings").select("*").single();
  if (error) fail("site settings", error.message);

  const settings = data as SiteSettings;
  return { ...settings, about_html: sanitizeRichText(settings.about_html) };
}

/** Published trips, newest first. Undated trips go last. */
export async function getPublishedTrips(): Promise<TripSummary[]> {
  "use cache";
  cacheTag(SITE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("trips")
    .select(SUMMARY_COLUMNS)
    .eq("status", "published")
    .order("start_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) fail("trips", error.message);

  return (data as unknown as SummaryRow[]).map(({ photo_count, ...trip }) => ({
    ...trip,
    photo_count: photo_count[0]?.count ?? 0,
  }));
}

/** One published trip with its photos in gallery order, or null. */
export async function getTripBySlug(slug: string): Promise<TripWithPhotos | null> {
  "use cache";
  cacheTag(SITE_CACHE_TAG);
  cacheLife("hours");

  const { data, error } = await createPublicClient()
    .from("trips")
    .select(DETAIL_COLUMNS)
    .eq("slug", slug)
    .eq("status", "published")
    .order("sort_order", { referencedTable: "photos" })
    .maybeSingle();
  if (error) fail(`trip "${slug}"`, error.message);
  if (!data) return null;

  const trip = data as unknown as DetailRow;
  return {
    ...trip,
    description_html: sanitizeRichText(trip.description_html),
    cover: trip.photos.find((photo) => photo.id === trip.cover_photo_id) ?? trip.photos[0] ?? null,
  };
}

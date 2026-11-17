// Everything /admin reads from or writes to the database, in one place.
//
// These run in the browser as the signed-in admin. The database's row level
// security is what actually permits them; a visitor calling the same code
// would get empty results and refused writes.

import { getBrowserClient } from "../supabase/browser";
import { tripSlug } from "../slug";
import type { Photo, PhotoLocation, SiteSettings, Trip, TripSummary } from "../types";
import { removePhotoFiles } from "./upload";

/** The trip fields the editor form controls. */
export type TripFields = Pick<
  Trip,
  | "title"
  | "slug"
  | "status"
  | "country_codes"
  | "places"
  | "tags"
  | "start_date"
  | "end_date"
  | "date_precision"
  | "summary"
  | "description_html"
  | "lat"
  | "lng"
>;

export interface TripBundle {
  trip: Trip;
  photos: Photo[];
  locations: PhotoLocation[];
}

const db = () => getBrowserClient();

function check<T>(result: { data: T; error: { message: string } | null }, action: string): T {
  if (result.error) throw new Error(`Could not ${action}: ${result.error.message}`);
  return result.data;
}

// --- Session ---------------------------------------------------------------

/** True if someone is signed in and their account is on the admin list. */
export async function isSignedInAdmin(): Promise<"admin" | "not-admin" | "signed-out"> {
  const {
    data: { user },
  } = await db().auth.getUser();
  if (!user) return "signed-out";
  const { data } = await db().rpc("is_admin");
  return data === true ? "admin" : "not-admin";
}

// --- Trips -----------------------------------------------------------------

/** Every trip, drafts included, newest first. */
export async function listTrips(): Promise<TripSummary[]> {
  const rows = check(
    await db()
      .from("trips")
      .select("*, cover:photos!trips_cover_photo_fk(*), photo_count:photos!photos_trip_id_fkey(count)")
      .order("start_date", { ascending: false, nullsFirst: true })
      .order("created_at", { ascending: false }),
    "load trips",
  ) as unknown as (Trip & { cover: Photo | null; photo_count: { count: number }[] })[];

  return rows.map(({ photo_count, ...trip }) => ({ ...trip, photo_count: photo_count[0]?.count ?? 0 }));
}

/** Starts a new, empty draft and returns its id. Drafts are never public. */
export async function createDraftTrip(): Promise<string> {
  const placeholderSlug = `untitled-${crypto.randomUUID().slice(0, 8)}`;
  const row = check(
    await db().from("trips").insert({ title: "Untitled trip", slug: placeholderSlug }).select("id").single(),
    "create the trip",
  ) as { id: string };
  return row.id;
}

export async function loadTrip(id: string): Promise<TripBundle | null> {
  const trip = check(await db().from("trips").select("*").eq("id", id).maybeSingle(), "load the trip");
  if (!trip) return null;

  const photos = check(
    await db().from("photos").select("*").eq("trip_id", id).order("sort_order"),
    "load the photos",
  ) as Photo[];

  const locations = check(
    await db()
      .from("photo_locations")
      .select("*")
      .in(
        "photo_id",
        photos.map((photo) => photo.id),
      ),
    "load photo locations",
  ) as PhotoLocation[];

  return { trip: trip as Trip, photos, locations };
}

/**
 * A slug nobody else is using: the wanted one, or it with -2, -3… appended.
 * Slugs appear in URLs, so two trips can never share one.
 */
async function freeSlug(wanted: string, tripId: string): Promise<string> {
  const taken = new Set(
    (
      check(
        await db().from("trips").select("slug").like("slug", `${wanted}%`).neq("id", tripId),
        "check the web address",
      ) as { slug: string }[]
    ).map((row) => row.slug),
  );
  if (!taken.has(wanted)) return wanted;
  for (let suffix = 2; ; suffix++) {
    if (!taken.has(`${wanted}-${suffix}`)) return `${wanted}-${suffix}`;
  }
}

export async function saveTrip(id: string, fields: TripFields): Promise<Trip> {
  const wantedSlug = fields.slug || tripSlug(fields.title, fields.start_date);
  const slug = await freeSlug(wantedSlug, id);
  const row = check(
    await db()
      .from("trips")
      .update({ ...fields, slug })
      .eq("id", id)
      .select("*")
      .single(),
    "save the trip",
  );
  return row as Trip;
}

export async function deleteTrip(id: string, photos: Photo[]): Promise<void> {
  // Files first: once the rows are gone there is no record of what to remove.
  await removePhotoFiles(photos);
  check(await db().from("trips").delete().eq("id", id), "delete the trip");
}

export async function setCoverPhoto(tripId: string, photoId: string | null): Promise<void> {
  check(await db().from("trips").update({ cover_photo_id: photoId }).eq("id", tripId), "set the cover");
}

/** Tags already used on any trip, for suggestions. */
export async function listTags(): Promise<string[]> {
  const rows = check(await db().from("trips").select("tags"), "load tags") as { tags: string[] }[];
  return [...new Set(rows.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b));
}

// --- Photos ----------------------------------------------------------------

export type NewPhoto = Omit<Photo, "caption">;

export async function insertPhoto(
  photo: NewPhoto,
  location: { lat: number; lng: number } | null,
): Promise<Photo> {
  const row = check(await db().from("photos").insert(photo).select("*").single(), "save the photo") as Photo;
  if (location) {
    // Admin-only table; see the migration for why this is kept apart.
    check(
      await db()
        .from("photo_locations")
        .insert({ photo_id: row.id, ...location }),
      "save the photo's location",
    );
  }
  return row;
}

export async function updateCaption(photoId: string, caption: string): Promise<void> {
  check(await db().from("photos").update({ caption }).eq("id", photoId), "save the caption");
}

/** Saves the gallery order: photos appear in the order of `photoIds`. */
export async function savePhotoOrder(photoIds: string[]): Promise<void> {
  check(await db().rpc("reorder_photos", { photo_ids: photoIds }), "save the order");
}

export async function deletePhoto(photo: Photo): Promise<void> {
  await removePhotoFiles([photo]);
  check(await db().from("photos").delete().eq("id", photo.id), "delete the photo");
}

// --- Settings --------------------------------------------------------------

export async function loadSettings(): Promise<SiteSettings> {
  return check(await db().from("site_settings").select("*").single(), "load settings") as SiteSettings;
}

export async function saveSettings(settings: SiteSettings): Promise<void> {
  const {
    site_title,
    site_description,
    about_html,
    extra_country_codes,
    home_name,
    home_code,
    home_lat,
    home_lng,
  } = settings;
  check(
    await db()
      .from("site_settings")
      .update({
        site_title,
        site_description,
        about_html,
        extra_country_codes,
        home_name,
        home_code,
        home_lat,
        home_lng,
      })
      .eq("id", true),
    "save settings",
  );
}

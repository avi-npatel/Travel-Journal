// Row shapes for the tables in supabase/migrations. Kept by hand because the
// schema is small; if it grows, generate these with `supabase gen types`.

export type TripStatus = "draft" | "published";
export type DatePrecision = "day" | "month";
export type PhotoFormat = "webp" | "jpeg";

/** An image stored in the bucket at three sizes (see lib/images.ts). */
export interface StoredImage {
  /** Path inside the "photos" bucket, without the -full/-md/-thumb suffix. */
  storage_path: string;
  format: PhotoFormat;
  width: number;
  height: number;
  blur_data_url: string | null;
}

export interface Photo extends StoredImage {
  id: string;
  trip_id: string;
  /** The place on the trip this photo belongs to, or null if unassigned. */
  place_id: string | null;
  caption: string;
  /** Order within its place (or among the unassigned photos). */
  sort_order: number;
  taken_at: string | null;
}

/** A stop on a trip: a city, town or spot. Optionally pinned on the map. */
export interface TripPlace {
  id: string;
  trip_id: string;
  name: string;
  sort_order: number;
  lat: number | null;
  lng: number | null;
  /** Draw a route line from home to this pin, or only mark the spot. */
  show_route: boolean;
}

export interface Trip {
  id: string;
  slug: string;
  title: string;
  status: TripStatus;
  /** ISO 3166-1 alpha-2 codes. */
  country_codes: string[];
  tags: string[];
  /** "YYYY-MM-DD". With date_precision "month" only year and month count. */
  start_date: string | null;
  /** Only set on trips entered with exact days before durations existed. */
  end_date: string | null;
  date_precision: DatePrecision;
  /** How many days the trip lasted. */
  duration_days: number | null;
  summary: string;
  description_html: string;
  cover_photo_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * The trip columns the site reads. Listed explicitly because the table also
 * keeps a few retired columns (places, lat, lng) from before trip_places.
 */
export const TRIP_COLUMNS =
  "id,slug,title,status,country_codes,tags,start_date,end_date,date_precision,duration_days," +
  "summary,description_html,cover_photo_id,created_at,updated_at";

/** A trip as shown in lists: its places, cover and how many photos it has. */
export interface TripSummary extends Trip {
  places: TripPlace[];
  cover: Photo | null;
  photo_count: number;
}

/** A trip as shown on its own page. */
export interface TripWithPhotos extends Trip {
  places: TripPlace[];
  cover: Photo | null;
  /** In gallery order: by place, then by each photo's own order. */
  photos: Photo[];
}

export interface PhotoLocation {
  photo_id: string;
  lat: number;
  lng: number;
}

export interface SiteSettings {
  site_title: string;
  site_description: string;
  about_html: string;
  extra_country_codes: string[];
  home_name: string;
  home_code: string;
  home_lat: number;
  home_lng: number;
  /** Photo shown on the About page, or null. */
  portrait: StoredImage | null;
  portrait_alt: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

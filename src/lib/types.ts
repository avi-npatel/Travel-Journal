// Row shapes for the tables in supabase/migrations. Kept by hand because the
// schema is small; if it grows, generate these with `supabase gen types`.

export type TripStatus = "draft" | "published";
export type DatePrecision = "day" | "month";
export type PhotoFormat = "webp" | "jpeg";

export interface Photo {
  id: string;
  trip_id: string;
  /** Path inside the "photos" bucket, without the -full/-md/-thumb suffix. */
  storage_path: string;
  format: PhotoFormat;
  width: number;
  height: number;
  caption: string;
  sort_order: number;
  blur_data_url: string | null;
  taken_at: string | null;
}

export interface Trip {
  id: string;
  slug: string;
  title: string;
  status: TripStatus;
  /** ISO 3166-1 alpha-2 codes. */
  country_codes: string[];
  places: string[];
  tags: string[];
  /** "YYYY-MM-DD". With date_precision "month" only year and month count. */
  start_date: string | null;
  end_date: string | null;
  date_precision: DatePrecision;
  summary: string;
  description_html: string;
  lat: number | null;
  lng: number | null;
  cover_photo_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A trip as shown in lists: its cover and how many photos it has. */
export interface TripSummary extends Trip {
  cover: Photo | null;
  photo_count: number;
}

/** A trip as shown on its own page. */
export interface TripWithPhotos extends Trip {
  cover: Photo | null;
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
}

export interface LatLng {
  lat: number;
  lng: number;
}

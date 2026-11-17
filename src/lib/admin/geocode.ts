import type { LatLng } from "../types";

export interface PlaceSearchResult {
  name: string;
  point: LatLng;
}

/** Looks a place name up with OpenStreetMap's free search (Nominatim). */
export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "5" }).toString();
  const response = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!response.ok) throw new Error("Place search is unavailable right now.");
  const rows: { display_name: string; lat: string; lon: string }[] = await response.json();
  return rows.map((row) => ({
    name: row.display_name,
    point: { lat: Number(row.lat), lng: Number(row.lon) },
  }));
}

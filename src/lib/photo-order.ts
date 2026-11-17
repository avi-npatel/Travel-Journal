import type { Photo, TripPlace } from "./types";

/**
 * Photos in gallery order: grouped by place in the trip's place order, each
 * place's photos in their own order, unassigned photos last.
 */
export function orderPhotos(photos: Photo[], places: Pick<TripPlace, "id">[]): Photo[] {
  const placeRank = new Map(places.map((place, index) => [place.id, index]));
  const rank = (photo: Photo) =>
    photo.place_id ? (placeRank.get(photo.place_id) ?? places.length) : places.length;
  return [...photos].sort((a, b) => rank(a) - rank(b) || a.sort_order - b.sort_order);
}

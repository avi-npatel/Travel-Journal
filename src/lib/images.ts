import type { Photo } from "./types";

export const PHOTO_BUCKET = "photos";

/**
 * Every photo is stored at three sizes, made in the browser at upload time.
 * `full` is capped on its long edge; the other two are capped on width so the
 * image loader can pick one from the width next/image asks for.
 */
export const VARIANTS = {
  full: { maxLongEdge: 2400, quality: 0.82 },
  md: { maxWidth: 1400, quality: 0.8 },
  thumb: { maxWidth: 640, quality: 0.72 },
} as const;

export type Variant = keyof typeof VARIANTS;

type StoredPhoto = Pick<Photo, "storage_path" | "format">;

const extension = (format: Photo["format"]) => (format === "webp" ? "webp" : "jpg");

/** Path of one size of a photo inside the bucket. */
export function variantPath(photo: StoredPhoto, variant: Variant): string {
  return `${photo.storage_path}-${variant}.${extension(photo.format)}`;
}

/**
 * Public URL of a photo. Pass the `full` URL to next/image: the loader in
 * image-loader.ts swaps in a smaller size when that is all the layout needs.
 */
export function photoUrl(photo: StoredPhoto, variant: Variant = "full"): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${PHOTO_BUCKET}/${variantPath(photo, variant)}`;
}

export function photoAlt(photo: Pick<Photo, "caption">, fallback: string): string {
  return photo.caption.trim() || fallback;
}

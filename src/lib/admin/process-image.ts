// Turns a photo straight off a camera or phone into the three files the site
// stores, entirely in the browser.
//
// Drawing the picture onto a canvas and saving the canvas keeps the pixels
// and nothing else: every EXIF tag, GPS position included, is left behind.
// That is what guarantees a published photo never reveals where it was taken.

import { VARIANTS, type Variant } from "../images";
import type { PhotoFormat } from "../types";

export interface ProcessedImage {
  files: Record<Variant, Blob>;
  format: PhotoFormat;
  /** Pixel size of the largest ("full") file. */
  width: number;
  height: number;
  /** A few hundred bytes of blurred preview, stored in the database. */
  blurDataUrl: string;
}

const BLUR_WIDTH = 24;
const MIME: Record<PhotoFormat, string> = { webp: "image/webp", jpeg: "image/jpeg" };

type Drawable = ImageBitmap | HTMLCanvasElement;

/** Copies `source` onto a new canvas, scaled by `scale` (never above 1). */
function scaled(source: Drawable, scale: number): HTMLCanvasElement {
  const factor = Math.min(1, scale);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * factor));
  canvas.height = Math.max(1, Math.round(source.height * factor));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser could not prepare the image.");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, format: PhotoFormat, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("This browser could not encode the image."))),
      MIME[format],
      quality,
    );
  });
}

let webpSupport: boolean | undefined;

/** WebP where the browser can write it (smaller files); JPEG otherwise. */
function preferredFormat(): PhotoFormat {
  webpSupport ??= document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
  return webpSupport ? "webp" : "jpeg";
}

async function decode(file: File): Promise<ImageBitmap> {
  try {
    // Applies the camera's rotation flag, so portraits come out upright.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const isHeic = /\.(heic|heif)$/i.test(file.name) || /hei[cf]/.test(file.type);
    throw new Error(
      isHeic
        ? "This browser cannot open HEIC photos. Export as JPEG first, or upload from Safari."
        : "This file could not be read as an image.",
    );
  }
}

export async function processImage(file: File): Promise<ProcessedImage> {
  const bitmap = await decode(file);
  const format = preferredFormat();

  // Each size is made from the one above it; stepping down gives a cleaner
  // result than shrinking the original a long way in one go.
  const longEdge = Math.max(bitmap.width, bitmap.height);
  const full = scaled(bitmap, VARIANTS.full.maxLongEdge / longEdge);
  bitmap.close();
  const md = scaled(full, VARIANTS.md.maxWidth / full.width);
  const thumb = scaled(md, VARIANTS.thumb.maxWidth / md.width);
  const blur = scaled(thumb, BLUR_WIDTH / thumb.width);

  const [fullBlob, mdBlob, thumbBlob] = await Promise.all([
    encode(full, format, VARIANTS.full.quality),
    encode(md, format, VARIANTS.md.quality),
    encode(thumb, format, VARIANTS.thumb.quality),
  ]);

  const result: ProcessedImage = {
    files: { full: fullBlob, md: mdBlob, thumb: thumbBlob },
    format,
    width: full.width,
    height: full.height,
    blurDataUrl: blur.toDataURL("image/jpeg", 0.6),
  };

  // Canvases hold a lot of memory; shrinking them releases it right away,
  // which matters when thirty photos are queued.
  for (const canvas of [full, md, thumb, blur]) canvas.width = canvas.height = 0;
  return result;
}

export const mimeType = (format: PhotoFormat) => MIME[format];

"use client";

// Custom loader for next/image (wired up in next.config.ts).
//
// Photos are resized in the browser when they are uploaded, so there is
// nothing left for an image optimisation service to do. Instead of sending
// every request through Vercel's optimiser (which is metered on the free
// tier), this maps the width next/image asks for onto one of the three sizes
// already sitting in Supabase Storage.

import type { ImageLoaderProps } from "next/image";

const FULL_VARIANT = /-full\.(webp|jpg)$/;

export default function photoLoader({ src, width }: ImageLoaderProps): string {
  if (!FULL_VARIANT.test(src)) return src;
  const variant = width <= 640 ? "thumb" : width <= 1400 ? "md" : "full";
  return src.replace(FULL_VARIANT, `-${variant}.$1`);
}

import Image from "next/image";
import { photoUrl } from "@/lib/images";
import type { Photo as PhotoRow } from "@/lib/types";

interface PhotoProps {
  photo: PhotoRow;
  alt: string;
  /** How wide the image is on screen, e.g. "(min-width: 768px) 50vw, 100vw". */
  sizes: string;
  /** Fill the (positioned) parent instead of using the photo's own shape. */
  fill?: boolean;
  /** Load ahead of everything else. Only for the first image on a page. */
  preload?: boolean;
  className?: string;
}

/**
 * One stored photo through next/image: the right size for the layout, lazy
 * loading, reserved space so nothing jumps, and a blurred preview while the
 * real file arrives.
 */
export function Photo({ photo, alt, sizes, fill, preload, className }: PhotoProps) {
  const dimensions = fill ? { fill: true } : { width: photo.width, height: photo.height };
  const blur = photo.blur_data_url
    ? ({ placeholder: "blur", blurDataURL: photo.blur_data_url } as const)
    : {};

  return (
    <Image
      src={photoUrl(photo)}
      alt={alt}
      sizes={sizes}
      preload={preload}
      // A preloaded image is the first thing on the page: decode it before
      // painting, so it never shows up a frame late.
      decoding={preload ? "sync" : "async"}
      className={className}
      {...dimensions}
      {...blur}
    />
  );
}

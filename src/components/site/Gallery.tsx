"use client";

import type { CSSProperties } from "react";
import { useRef, useState } from "react";
import { photoAlt } from "@/lib/images";
import type { Photo as PhotoRow } from "@/lib/types";
import { Lightbox } from "./Lightbox";
import { Photo } from "./Photo";

interface GalleryProps {
  photos: PhotoRow[];
  tripTitle: string;
}

/**
 * Upper estimate of a tile's on-screen width, so next/image can pick a file
 * size. Rows stretch to fill the page (see .gallery in globals.css), so a
 * tile can end up well over its base size; guessing high keeps photos sharp.
 */
function tileSizes(aspectRatio: number): string {
  if (aspectRatio >= 2) return "100vw";
  if (aspectRatio >= 1) return "(min-width: 1100px) 62vw, 100vw";
  return "(min-width: 1100px) 36vw, 55vw";
}

/**
 * A trip's photographs in justified rows: every photo keeps its own shape,
 * landscape and portrait mixed, and each row runs the full width. Selecting
 * one opens the lightbox.
 */
export function Gallery({ photos, tripTitle }: GalleryProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  /** Closes the lightbox and puts focus on the photo it was showing. */
  function close() {
    const lastViewed = openIndex;
    setOpenIndex(null);
    if (lastViewed !== null) {
      // Wait a frame: the lightbox has to leave the page before focus can move.
      requestAnimationFrame(() => tiles.current[lastViewed]?.focus());
    }
  }

  return (
    <>
      <ul className="gallery">
        {photos.map((photo, index) => {
          const aspectRatio = photo.width / photo.height;
          const position = `Photo ${index + 1} of ${photos.length}`;
          return (
            <li key={photo.id} className="contents">
              <button
                ref={(element) => {
                  tiles.current[index] = element;
                }}
                type="button"
                className="gallery-item reveal"
                style={{ "--ar": aspectRatio } as CSSProperties}
                onClick={() => setOpenIndex(index)}
                aria-label={`Open ${position.toLowerCase()}${photo.caption ? `: ${photo.caption}` : ""}`}
              >
                <Photo
                  photo={photo}
                  alt={photoAlt(photo, `${position} from ${tripTitle}`)}
                  sizes={tileSizes(aspectRatio)}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {openIndex !== null && (
        <Lightbox
          photos={photos}
          index={openIndex}
          tripTitle={tripTitle}
          onIndexChange={setOpenIndex}
          onClose={close}
        />
      )}
    </>
  );
}

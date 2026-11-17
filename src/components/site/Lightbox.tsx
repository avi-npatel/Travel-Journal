"use client";

import Image from "next/image";
import type { KeyboardEvent, PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import photoLoader from "@/lib/image-loader";
import { photoAlt, photoUrl } from "@/lib/images";
import type { Photo } from "@/lib/types";

interface LightboxProps {
  photos: Photo[];
  index: number;
  tripTitle: string;
  /** Place names by place id, shown next to the photo count. */
  placeNames?: Map<string, string>;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

/** How far a finger has to travel sideways to count as a swipe. */
const SWIPE_THRESHOLD_PX = 60;

/**
 * Full-screen photo viewer.
 *
 * Built on <dialog>, which supplies the hard parts of an accessible modal for
 * free: focus is trapped inside while it is open, Escape closes it, and focus
 * returns to the thumbnail afterwards. On top of that: arrow keys (plus Home
 * and End), swipe on touch screens, captions, and preloading of the photos on
 * either side so stepping through feels instant.
 */
export function Lightbox({ photos, index, tripTitle, placeNames, onIndexChange, onClose }: LightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragStartX = useRef<number | null>(null);
  const didSwipe = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const photo = photos[index];
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;
  const position = `${String(index + 1).padStart(2, "0")} / ${String(photos.length).padStart(2, "0")}`;

  const goTo = (next: number) => {
    if (next >= 0 && next < photos.length) onIndexChange(next);
  };

  // Open as a modal on mount; stop the page behind from scrolling meanwhile.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // The guard matters in development, where React runs effects twice.
    if (!dialog.open) dialog.showModal();
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previousOverflow;
    };
  }, []);

  // Warm the browser cache with the neighbours at the size it would request.
  useEffect(() => {
    const width = Math.round(window.innerWidth * window.devicePixelRatio);
    for (const neighbour of [photos[index + 1], photos[index - 1]]) {
      if (neighbour) new window.Image().src = photoLoader({ src: photoUrl(neighbour), width });
    }
  }, [index, photos]);

  function handleKeyDown(event: KeyboardEvent) {
    const destinations: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: photos.length - 1,
    };
    if (event.key in destinations) {
      event.preventDefault();
      goTo(destinations[event.key]);
    }
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse") return; // mouse users have the buttons
    dragStartX.current = event.clientX;
    didSwipe.current = false;
  }

  function handlePointerMove(event: PointerEvent) {
    if (dragStartX.current === null) return;
    setDragOffset(event.clientX - dragStartX.current);
  }

  function handlePointerEnd() {
    if (dragStartX.current === null) return;
    dragStartX.current = null;
    if (Math.abs(dragOffset) > SWIPE_THRESHOLD_PX) {
      didSwipe.current = true;
      goTo(dragOffset < 0 ? index + 1 : index - 1);
    }
    setDragOffset(0);
  }

  return (
    <dialog
      ref={dialogRef}
      className="lightbox"
      aria-label={`Photographs: ${tripTitle}`}
      onClose={onClose}
      onKeyDown={handleKeyDown}
    >
      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto]">
        <div className="flex items-center justify-between px-3 py-2 sm:px-5 sm:py-3">
          <p className="meta text-[#b9b6ae]" aria-live="polite">
            <span className="sr-only">Photo </span>
            {position}
            {photo.place_id && placeNames?.get(photo.place_id) && (
              <span className="ml-3 text-[#ecebe6]">{placeNames.get(photo.place_id)}</span>
            )}
          </p>
          <button
            type="button"
            className="lightbox-button grid"
            onClick={onClose}
            aria-label="Close"
            autoFocus
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Stage. Tapping the empty space around the photo closes. */}
        <div
          className="relative touch-pan-y select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onClick={(event) => {
            if (event.target === event.currentTarget && !didSwipe.current) onClose();
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-2 inset-y-0 sm:inset-x-20"
            style={{
              transform: `translateX(${dragOffset}px)`,
              transition: dragOffset === 0 ? "transform 0.2s ease-out" : "none",
            }}
          >
            {/* `key` remounts the image for each photo, replaying the fade. */}
            <Image
              key={photo.id}
              src={photoUrl(photo)}
              alt={photoAlt(photo, `Photo ${index + 1} of ${photos.length} from ${tripTitle}`)}
              fill
              sizes="100vw"
              loading="eager"
              draggable={false}
              className="lightbox-photo"
              style={{ objectFit: "contain" }}
              {...(photo.blur_data_url
                ? { placeholder: "blur" as const, blurDataURL: photo.blur_data_url }
                : {})}
            />
          </div>

          <button
            type="button"
            className="lightbox-button absolute left-3 top-1/2 hidden -translate-y-1/2 sm:grid"
            onClick={() => goTo(index - 1)}
            disabled={!hasPrevious}
            aria-label="Previous photo"
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            className="lightbox-button absolute right-3 top-1/2 hidden -translate-y-1/2 sm:grid"
            onClick={() => goTo(index + 1)}
            disabled={!hasNext}
            aria-label="Next photo"
          >
            <Chevron direction="right" />
          </button>
        </div>

        <div className="flex min-h-16 items-center gap-3 px-3 py-3 sm:justify-center sm:px-5">
          {/* On phones the arrows sit down here, within thumb reach. */}
          <button
            type="button"
            className="lightbox-button grid shrink-0 sm:hidden"
            onClick={() => goTo(index - 1)}
            disabled={!hasPrevious}
            aria-label="Previous photo"
          >
            <Chevron direction="left" />
          </button>
          <p className="max-w-3xl flex-1 text-center text-[0.9375rem] leading-snug text-[#d8d5cd] sm:flex-none">
            {photo.caption}
          </p>
          <button
            type="button"
            className="lightbox-button grid shrink-0 sm:hidden"
            onClick={() => goTo(index + 1)}
            disabled={!hasNext}
            aria-label="Next photo"
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d={direction === "left" ? "M14.5 5l-7 7 7 7" : "M9.5 5l7 7-7 7"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

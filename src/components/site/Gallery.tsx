"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { photoAlt } from "@/lib/images";
import { slugify } from "@/lib/slug";
import type { Photo as PhotoRow, TripPlace } from "@/lib/types";
import { Lightbox } from "./Lightbox";
import { Photo } from "./Photo";

interface GalleryProps {
  /** In gallery order: by place, then each photo's own order. */
  photos: PhotoRow[];
  places: Pick<TripPlace, "id" | "name">[];
  tripTitle: string;
  /** Shown instead of the gallery when the trip has no photos at all. */
  emptyState: ReactNode;
}

const ALL = "all";

/** The address fragment for a place, e.g. "#place-london-england". */
const placeHash = (place: Pick<TripPlace, "name">) => `place-${slugify(place.name)}`;

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

interface Section {
  key: string;
  /** Null for the "all photos, ungrouped" view and for unassigned photos. */
  title: string | null;
  photos: PhotoRow[];
}

/**
 * A trip's photographs in justified rows: every photo keeps its own shape,
 * landscape and portrait mixed, and each row runs the full width.
 *
 * Above the photos sits one small button per place. Picking one fades the
 * others and lays out just that place's photos; "All" shows every photo,
 * grouped by place. Selecting a photo opens the lightbox, which steps through
 * whatever is on screen.
 */
export function Gallery({ photos, places, tripTitle, emptyState }: GalleryProps) {
  const [selected, setSelected] = useState<string>(ALL);
  /** True once a place has been picked, so the photos animate in. */
  const [hasPicked, setHasPicked] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const tiles = useRef<(HTMLButtonElement | null)[]>([]);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const photo of photos) {
      if (photo.place_id) result.set(photo.place_id, (result.get(photo.place_id) ?? 0) + 1);
    }
    return result;
  }, [photos]);
  const placeNames = useMemo(() => new Map(places.map((place) => [place.id, place.name])), [places]);

  // Arriving from a map pin (".../trips/x#place-london") opens that place,
  // whether the page was just loaded or only its address fragment changed.
  useEffect(() => {
    const openFromHash = () => {
      const fromHash = places.find((place) => `#${placeHash(place)}` === window.location.hash);
      if (fromHash) setSelected(fromHash.id);
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [places]);

  function pick(next: string) {
    setSelected(next);
    setHasPicked(true);
    const place = places.find((p) => p.id === next);
    const url = new URL(window.location.href);
    url.hash = place ? placeHash(place) : "";
    history.replaceState(history.state, "", url);
  }

  // What is on screen: one place's photos, or every photo grouped by place.
  const sections: Section[] = useMemo(() => {
    if (selected !== ALL) {
      return [{ key: selected, title: null, photos: photos.filter((photo) => photo.place_id === selected) }];
    }
    const groups = [
      ...places.map((place) => ({
        key: place.id,
        title: place.name,
        photos: photos.filter((photo) => photo.place_id === place.id),
      })),
      {
        key: "unassigned",
        title: null,
        photos: photos.filter((photo) => !photo.place_id || !placeNames.has(photo.place_id)),
      },
    ].filter((group) => group.photos.length > 0);
    // Headings only help when photos come from more than one place.
    return groups.length > 1 ? groups : [{ key: ALL, title: null, photos }];
  }, [selected, photos, places, placeNames]);

  const visible = useMemo(() => sections.flatMap((section) => section.photos), [sections]);
  const selectedPlace = places.find((place) => place.id === selected) ?? null;

  /** Closes the lightbox and puts focus on the photo it was showing. */
  function close() {
    const lastViewed = openIndex;
    setOpenIndex(null);
    if (lastViewed !== null) {
      // Wait a frame: the lightbox has to leave the page before focus can move.
      requestAnimationFrame(() => tiles.current[lastViewed]?.focus());
    }
  }

  if (photos.length === 0 && places.length === 0) return <>{emptyState}</>;

  let offset = 0;
  return (
    <>
      {places.length > 0 && (
        <div className="shell">
          <div
            role="group"
            aria-label="Show photos from"
            className="-mt-2 mb-6 flex flex-wrap gap-1.5 sm:mb-8"
          >
            <PlaceButton
              label="All"
              count={photos.length}
              pressed={selected === ALL}
              faded={selected !== ALL}
              onClick={() => pick(ALL)}
            />
            {places.map((place) => (
              <PlaceButton
                key={place.id}
                label={place.name}
                count={counts.get(place.id) ?? 0}
                pressed={selected === place.id}
                faded={selected !== ALL && selected !== place.id}
                onClick={() => pick(place.id)}
              />
            ))}
          </div>
        </div>
      )}

      {photos.length === 0 ? (
        emptyState
      ) : visible.length === 0 ? (
        <div className="shell">
          <p className="display text-2xl text-muted sm:text-3xl">
            No photos from {selectedPlace?.name ?? "here"} yet.
          </p>
        </div>
      ) : (
        // `key` remounts the photos when the place changes, replaying their entrance.
        <div key={selected} className="space-y-10 px-1.5 sm:space-y-14 sm:px-3">
          {sections.map((section) => {
            const start = offset;
            offset += section.photos.length;
            return (
              <section key={section.key} aria-label={section.title ?? undefined}>
                {section.title && (
                  <div className="shell mb-4 flex items-baseline gap-3">
                    <h3 className="font-display text-2xl">{section.title}</h3>
                    <span className="meta">{section.photos.length}</span>
                  </div>
                )}
                <ul className="gallery">
                  {section.photos.map((photo, sectionIndex) => {
                    const index = start + sectionIndex;
                    const aspectRatio = photo.width / photo.height;
                    const position = `Photo ${index + 1} of ${visible.length}`;
                    return (
                      <li key={photo.id} className="contents">
                        <button
                          ref={(element) => {
                            tiles.current[index] = element;
                          }}
                          type="button"
                          className={cn("gallery-item", hasPicked ? "gallery-enter" : "reveal")}
                          style={{ "--ar": aspectRatio, "--i": sectionIndex } as CSSProperties}
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
              </section>
            );
          })}
        </div>
      )}

      {openIndex !== null && visible[openIndex] && (
        <Lightbox
          photos={visible}
          index={openIndex}
          tripTitle={tripTitle}
          placeNames={placeNames}
          onIndexChange={setOpenIndex}
          onClose={close}
        />
      )}
    </>
  );
}

interface PlaceButtonProps {
  label: string;
  count: number;
  pressed: boolean;
  /** Another place is being viewed. */
  faded: boolean;
  onClick: () => void;
}

function PlaceButton({ label, count, pressed, faded, onClick }: PlaceButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "tag gap-2 transition-[opacity,background-color,border-color,color] duration-200",
        faded && "opacity-40 hover:opacity-100 focus-visible:opacity-100",
      )}
    >
      {label}
      <span className="opacity-60">{count}</span>
    </button>
  );
}

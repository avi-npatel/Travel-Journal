import { cn } from "@/lib/cn";
import { formatCoordinates, tripPoint } from "@/lib/geo";
import { photoAlt } from "@/lib/images";
import type { LatLng, TripSummary } from "@/lib/types";
import { Photo } from "./Photo";
import { TripGlobe } from "./TripGlobe";

interface TripCoverProps {
  trip: Pick<TripSummary, "title" | "cover" | "places" | "country_codes">;
  home: LatLng;
  sizes: string;
  /** Sets the shape: "aspect-[3/2]", or "size-full" to fill a sized parent. */
  className?: string;
  preload?: boolean;
}

/**
 * The picture that represents a trip in lists: its cover photo, or, until it
 * has one, a globe turned to where the trip went, with its pins.
 */
export function TripCover({ trip, home, sizes, className, preload }: TripCoverProps) {
  if (trip.cover) {
    return (
      <div className={cn("relative overflow-hidden bg-sunk", className)}>
        <Photo
          photo={trip.cover}
          alt={photoAlt(trip.cover, `Cover photo: ${trip.title}`)}
          sizes={sizes}
          preload={preload}
          fill
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.025]"
        />
      </div>
    );
  }

  const point = tripPoint(trip);
  return (
    <div className={cn("relative overflow-hidden bg-sunk", className)}>
      <TripGlobe
        trip={trip}
        home={home}
        className="absolute left-1/2 top-1/2 size-[135%] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
      <p className="meta absolute left-3 top-3">No photos yet</p>
      {point && <p className="meta absolute bottom-3 left-3">{formatCoordinates(point)}</p>}
    </div>
  );
}

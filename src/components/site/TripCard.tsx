import Link from "next/link";
import { cn } from "@/lib/cn";
import { countryNames } from "@/lib/countries";
import { formatTripDates } from "@/lib/dates";
import { formatTripNumber, tripPath } from "@/lib/site";
import type { LatLng, TripSummary } from "@/lib/types";
import { TripCover } from "./TripCover";

interface TripCardProps {
  trip: TripSummary;
  number: number | undefined;
  home: LatLng;
  /** Shape of the cover, e.g. "aspect-[3/2]". */
  coverClassName: string;
  sizes: string;
  /** Size of the title; cards vary in scale across a layout. */
  titleClassName?: string;
  className?: string;
}

/** A trip in a grid: cover, a line of metadata, title, optional summary. */
export function TripCard({
  trip,
  number,
  home,
  coverClassName,
  sizes,
  titleClassName = "text-3xl",
  className,
}: TripCardProps) {
  const meta = [formatTripNumber(number), formatTripDates(trip), countryNames(trip.country_codes).join(", ")];

  return (
    <Link href={tripPath(trip)} className={cn("group reveal block", className)}>
      <TripCover trip={trip} home={home} sizes={sizes} className={coverClassName} />
      <p className="meta mt-4 flex flex-wrap gap-x-3">
        {meta.filter(Boolean).map((part) => (
          <span key={part}>{part}</span>
        ))}
      </p>
      <h3 className={cn("display mt-2 transition-colors group-hover:text-accent", titleClassName)}>
        {trip.title}
      </h3>
      {trip.summary && <p className="mt-3 line-clamp-2 max-w-xl text-soft">{trip.summary}</p>}
    </Link>
  );
}

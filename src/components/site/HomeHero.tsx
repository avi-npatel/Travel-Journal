import Link from "next/link";
import { countryNames } from "@/lib/countries";
import { formatTripDates } from "@/lib/dates";
import { distanceKm, formatCoordinates, formatDistance, homePoint, tripPoint } from "@/lib/geo";
import { photoAlt } from "@/lib/images";
import { formatTripNumber, tripPath } from "@/lib/site";
import type { SiteSettings, TripSummary } from "@/lib/types";
import { Photo } from "./Photo";
import { TripGlobe } from "./TripGlobe";

interface HomeHeroProps {
  trip: TripSummary;
  number: number | undefined;
  /** False when a more recent trip exists but has no photo to show yet. */
  isLatest: boolean;
  settings: SiteSettings;
}

/**
 * Top of the home page: one trip, its title set as large as the screen
 * allows. Over its cover photo when it has one; over a globe when not.
 */
export function HomeHero({ trip, number, isLatest, settings }: HomeHeroProps) {
  const home = homePoint(settings);
  const point = tripPoint(trip);

  const kicker = [isLatest ? "Latest trip" : "From the log", formatTripNumber(number)];
  const details = [
    formatTripDates(trip),
    countryNames(trip.country_codes).join(", "),
    point && formatCoordinates(point),
    point && `${formatDistance(distanceKm(home, point))} from ${settings.home_name}`,
  ].filter(Boolean);

  const text = (
    <div className="shell relative pb-9 pt-24 sm:pb-12">
      <p className="meta flex gap-x-3 text-current opacity-80">
        {kicker.filter(Boolean).map((part) => (
          <span key={part}>{part}</span>
        ))}
      </p>
      <h1 className="display mt-3 max-w-[14ch] text-[clamp(3.25rem,12.5vw,12.5rem)]">
        <Link href={tripPath(trip)} className="outline-offset-8 hover:opacity-85">
          {trip.title}
        </Link>
      </h1>
      <p className="meta mt-6 flex flex-wrap gap-x-4 gap-y-1 text-current opacity-80">
        {details.map((part) => (
          <span key={part as string}>{part}</span>
        ))}
      </p>
    </div>
  );

  if (trip.cover) {
    return (
      <section className="relative flex min-h-[72svh] items-end overflow-hidden bg-[#0b0b0c] text-[#f6f2ea] md:min-h-[86svh]">
        <Photo
          photo={trip.cover}
          alt={photoAlt(trip.cover, `Cover photo: ${trip.title}`)}
          sizes="100vw"
          fill
          preload
          className="object-cover"
        />
        {/* Darkens the bottom of the photo so the title stays readable. Photo,
            overlay and text stack in source order; no z-index needed. */}
        <div aria-hidden="true" className="hero-scrim absolute inset-0" />
        {text}
      </section>
    );
  }

  return (
    <section className="relative flex min-h-[64svh] items-end overflow-hidden border-b border-rule md:min-h-[78svh]">
      <TripGlobe
        trip={trip}
        home={home}
        className="absolute -right-[22%] top-1/2 aspect-square w-[min(118svh,105vw)] -translate-y-1/2 md:-right-[6%]"
      />
      {text}
    </section>
  );
}

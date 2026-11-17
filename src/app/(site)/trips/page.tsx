import type { Metadata } from "next";
import { Suspense } from "react";
import { TripCover } from "@/components/site/TripCover";
import { TripsBrowser, TripsFallback, type TripListItem } from "@/components/site/TripsBrowser";
import { continentsOf, countryNames } from "@/lib/countries";
import { getPublishedTrips, getSettings } from "@/lib/data";
import { formatTripDates, tripYear } from "@/lib/dates";
import { distanceKm, formatDistance, homePoint, tripPoint } from "@/lib/geo";
import { formatTripNumber, numberTrips, tripPath } from "@/lib/site";

export const metadata: Metadata = {
  title: "Trips",
  description: "Every trip in the log, filterable by year, continent, and tag.",
};

export default async function TripsPage() {
  const [trips, settings] = await Promise.all([getPublishedTrips(), getSettings()]);
  const home = homePoint(settings);
  const numbers = numberTrips(trips);

  // Work out everything the list shows here on the server, so the browser
  // only has to filter and sort.
  const items: TripListItem[] = trips.map((trip) => {
    const point = tripPoint(trip);
    return {
      id: trip.id,
      href: tripPath(trip),
      title: trip.title,
      summary: trip.summary,
      numberLabel: formatTripNumber(numbers.get(trip.id)),
      dateLabel: formatTripDates(trip),
      sortKey: trip.start_date ?? "",
      year: tripYear(trip),
      countries: countryNames(trip.country_codes),
      continents: continentsOf(trip.country_codes),
      tags: trip.tags,
      distanceLabel: point ? formatDistance(distanceKm(home, point)) : null,
      photoCount: trip.photo_count,
      cover: (
        <TripCover
          trip={trip}
          home={home}
          sizes="(min-width: 1024px) 58vw, (min-width: 640px) 50vw, 100vw"
          className="size-full"
        />
      ),
    };
  });

  return (
    <div className="shell pt-12 sm:pt-20">
      <h1 className="display text-[clamp(3.25rem,10vw,9rem)]">Trips</h1>
      <div className="mt-10 sm:mt-14">
        {/* Filters come from the URL, which is only known per request, so the
            filtered view streams in over the plain list. */}
        <Suspense fallback={<TripsFallback items={items} />}>
          <TripsBrowser items={items} />
        </Suspense>
      </div>
    </div>
  );
}

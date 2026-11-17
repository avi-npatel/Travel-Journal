import type { Metadata } from "next";
import { InteractiveMap, type MapPageTrip } from "@/components/site/InteractiveMap";
import { countryNames } from "@/lib/countries";
import { getPublishedTrips, getSettings } from "@/lib/data";
import { formatTripDates } from "@/lib/dates";
import { homePoint, mapPins } from "@/lib/geo";
import { placePath } from "@/lib/site";
import { computeStats, visitedCountryCodes } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Map",
  description: "Every country visited and every trip, on one map.",
};

export default async function MapPage() {
  const [trips, settings] = await Promise.all([getPublishedTrips(), getSettings()]);
  const stats = computeStats(trips, settings);

  const mapTrips: MapPageTrip[] = trips.map((trip) => ({
    slug: trip.slug,
    title: trip.title,
    dateLabel: formatTripDates(trip),
    countryLabel: countryNames(trip.country_codes).join(", "),
    pins: mapPins(trip).map((pin) => ({
      key: pin.key,
      name: pin.name,
      href: placePath(trip, pin.name),
      point: pin.point,
      showRoute: pin.showRoute,
    })),
  }));

  return (
    <>
      {/* Kept short so the map itself fills the rest of the screen. */}
      <div className="shell flex flex-wrap items-end justify-between gap-x-10 gap-y-3 py-6 sm:py-8">
        <h1 className="display text-5xl sm:text-7xl">Map</h1>
        <p className="meta flex flex-wrap gap-x-5 gap-y-1 pb-1 sm:pb-2">
          <span>
            {stats.countries} {stats.countries === 1 ? "country" : "countries"}
          </span>
          <span>
            {stats.continents} of {stats.continentsTotal} continents
          </span>
          <span>
            {stats.trips} {stats.trips === 1 ? "trip" : "trips"}
          </span>
        </p>
      </div>
      <InteractiveMap
        trips={mapTrips}
        visitedCodes={visitedCountryCodes(trips, settings)}
        home={homePoint(settings)}
      />
    </>
  );
}

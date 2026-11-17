import Link from "next/link";
import { HomeHero } from "@/components/site/HomeHero";
import { StatsStrip } from "@/components/site/StatsStrip";
import { TripCard } from "@/components/site/TripCard";
import { WorldMap, type WorldMapPin } from "@/components/site/WorldMap";
import { getPublishedTrips, getSettings } from "@/lib/data";
import { formatTripDates } from "@/lib/dates";
import { homePoint, mapPins } from "@/lib/geo";
import { numberTrips, placePath } from "@/lib/site";
import { computeStats, visitedCountryCodes } from "@/lib/stats";

const RECENT_COUNT = 5;

/**
 * How the recent trips are laid out on wide screens: one large and one tall
 * card first, then a row whose split depends on how many are left. Sizes are
 * deliberately uneven; a row of matching boxes reads as a template.
 */
function recentCardLayout(index: number, total: number) {
  if (index === 0) {
    return { span: "md:col-span-7", cover: "aspect-[3/2]", title: "text-4xl sm:text-5xl lg:text-6xl" };
  }
  if (index === 1) {
    return { span: "md:col-span-5 md:mt-28", cover: "aspect-[4/5]", title: "text-3xl sm:text-4xl" };
  }
  const rest = total - 2;
  if (rest === 1)
    return { span: "md:col-span-8 md:col-start-3", cover: "aspect-[16/9]", title: "text-3xl sm:text-4xl" };
  if (rest === 2) {
    return index === 2
      ? { span: "md:col-span-5", cover: "aspect-[4/3]", title: "text-3xl" }
      : { span: "md:col-span-7 md:mt-16", cover: "aspect-[16/9]", title: "text-3xl sm:text-4xl" };
  }
  return { span: "md:col-span-4", cover: "aspect-[4/3]", title: "text-3xl" };
}

export default async function HomePage() {
  const [trips, settings] = await Promise.all([getPublishedTrips(), getSettings()]);
  const home = homePoint(settings);
  const numbers = numberTrips(trips);
  const stats = computeStats(trips, settings);

  // Lead with the newest trip that has a photo; with none, the newest trip.
  const heroTrip = trips.find((trip) => trip.cover) ?? trips[0];
  const recent = trips.slice(0, RECENT_COUNT);

  const mapPinsForHome: WorldMapPin[] = trips.flatMap((trip) => {
    const when = formatTripDates(trip);
    return mapPins(trip).map((pin) => ({
      key: `${trip.id}-${pin.key}`,
      href: placePath(trip, pin.name),
      label: [pin.name, trip.title, when].filter(Boolean).join(" · "),
      point: pin.point,
      showRoute: pin.showRoute,
    }));
  });

  return (
    <>
      {heroTrip ? (
        <HomeHero
          trip={heroTrip}
          number={numbers.get(heroTrip.id)}
          isLatest={heroTrip.id === trips[0].id}
          settings={settings}
        />
      ) : (
        <section className="shell border-b border-rule py-28">
          <h1 className="display text-[clamp(3.25rem,12vw,11rem)]">{settings.site_title}</h1>
          <p className="meta mt-6">No trips published yet. Add the first one in /admin.</p>
        </section>
      )}

      <section aria-label="Totals" className="shell mt-10 sm:mt-14">
        <StatsStrip stats={stats} />
      </section>

      <section aria-labelledby="map-heading" className="shell mt-20 sm:mt-28">
        <div className="flex items-end justify-between gap-6 border-b border-ink pb-4">
          <h2 id="map-heading" className="display text-4xl sm:text-6xl">
            Where I&rsquo;ve <em>been</em>
          </h2>
          <Link href="/map" className="meta link shrink-0 pb-1">
            Open the map <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="mt-8 sm:mt-12">
          <WorldMap visitedCodes={visitedCountryCodes(trips, settings)} pins={mapPinsForHome} home={home} />
        </div>
        <p className="meta mt-5 flex flex-wrap gap-x-6 gap-y-1">
          <span>
            <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-pin align-middle" />
            Trip
          </span>
          <span>
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2 rounded-full border border-ink align-middle"
            />
            Home: {settings.home_name}
          </span>
        </p>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recent-heading" className="shell mt-20 sm:mt-28">
          <div className="flex items-end justify-between gap-6 border-b border-ink pb-4">
            <h2 id="recent-heading" className="display text-4xl sm:text-6xl">
              Recent <em>trips</em>
            </h2>
            <Link href="/trips" className="meta link shrink-0 pb-1">
              All {trips.length} {trips.length === 1 ? "trip" : "trips"} <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="mt-10 grid gap-x-8 gap-y-14 sm:mt-14 md:grid-cols-12 lg:gap-x-12">
            {recent.map((trip, index) => {
              const layout = recentCardLayout(index, recent.length);
              return (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  number={numbers.get(trip.id)}
                  home={home}
                  className={layout.span}
                  coverClassName={layout.cover}
                  titleClassName={layout.title}
                  sizes="(min-width: 768px) 58vw, 100vw"
                />
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}

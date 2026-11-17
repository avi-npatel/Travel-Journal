import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BoardingPass } from "@/components/site/BoardingPass";
import { Gallery } from "@/components/site/Gallery";
import { Photo } from "@/components/site/Photo";
import { TripGlobe } from "@/components/site/TripGlobe";
import { countryNames } from "@/lib/countries";
import { getPublishedTrips, getSettings, getTripBySlug } from "@/lib/data";
import { formatTripDates } from "@/lib/dates";
import { formatCoordinates, homePoint, tripPoint } from "@/lib/geo";
import { photoAlt } from "@/lib/images";
import { htmlToText } from "@/lib/sanitize";
import { formatTripNumber, numberTrips, tripPath } from "@/lib/site";
import type { TripSummary } from "@/lib/types";

// A trip page is sent as one complete document rather than streamed in
// pieces. The first visit to a new trip waits a moment for the full page, and
// an address that matches no trip answers with a real 404 status (which is
// what search engines need) instead of a placeholder page.
export const ensureStatic = "navigation";
export const instant = false;

// Trips that exist at build time are prerendered. A trip published later is
// rendered on its first visit and cached from then on.
export async function generateStaticParams() {
  const trips = await getPublishedTrips();
  // Next.js needs at least one entry to check the route at build time.
  return trips.length > 0 ? trips.map((trip) => ({ slug: trip.slug })) : [{ slug: "no-trips-yet" }];
}

export async function generateMetadata({ params }: PageProps<"/trips/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripBySlug(slug);
  if (!trip) return { title: "Trip not found" };

  const where = countryNames(trip.country_codes).join(", ");
  const fallback = [where, formatTripDates(trip)].filter(Boolean).join(", ");
  const description = (trip.summary || htmlToText(trip.description_html) || fallback).slice(0, 200);

  return {
    title: trip.title,
    description,
    alternates: { canonical: tripPath(trip) },
    // The preview image comes from opengraph-image.tsx in this folder.
    openGraph: { type: "article", title: trip.title, description, url: tripPath(trip) },
  };
}

export default async function TripPage({ params }: PageProps<"/trips/[slug]">) {
  const { slug } = await params;
  const [trip, trips, settings] = await Promise.all([
    getTripBySlug(slug),
    getPublishedTrips(),
    getSettings(),
  ]);
  if (!trip) notFound();

  const home = homePoint(settings);
  const point = tripPoint(trip);
  const number = numberTrips(trips).get(trip.id);

  // `trips` is newest first, so the newer neighbour sits just before this one.
  const position = trips.findIndex((t) => t.id === trip.id);
  const newer = position > 0 ? trips[position - 1] : null;
  const older = position >= 0 ? (trips[position + 1] ?? null) : null;

  return (
    <article>
      {trip.cover && (
        <div className="relative h-[52svh] min-h-80 w-full bg-sunk sm:h-[72svh]">
          <Photo
            photo={trip.cover}
            alt={photoAlt(trip.cover, `Cover photo: ${trip.title}`)}
            sizes="100vw"
            fill
            preload
            className="object-cover"
          />
        </div>
      )}

      <div className="shell pt-10 sm:pt-16">
        <p className="meta">
          <Link href="/trips" className="hover:text-accent">
            Trips
          </Link>
          <span aria-hidden="true"> / </span>
          {formatTripNumber(number)}
        </p>
        <h1 className="display mt-4 text-[clamp(3rem,10.5vw,10rem)]">{trip.title}</h1>
        {trip.summary && (
          <p className="display-italic mt-6 max-w-3xl font-display text-2xl leading-snug text-soft sm:text-3xl">
            {trip.summary}
          </p>
        )}

        <div className="mt-10 sm:mt-14">
          <BoardingPass trip={trip} number={number} settings={settings} />
        </div>

        {(trip.description_html || trip.tags.length > 0) && (
          <div className="mt-14 grid gap-x-12 gap-y-10 sm:mt-20 lg:grid-cols-12">
            {trip.description_html && (
              <div
                className="prose-journal lg:col-span-7"
                // Sanitised in lib/data.ts before it is cached.
                dangerouslySetInnerHTML={{ __html: trip.description_html }}
              />
            )}
            <aside className="space-y-8 lg:col-span-4 lg:col-start-9">
              {trip.tags.length > 0 && (
                <div>
                  <h2 className="meta border-b border-rule pb-2">Tags</h2>
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {trip.tags.map((tag) => (
                      <li key={tag}>
                        <Link href={`/trips?tag=${encodeURIComponent(tag)}`} className="tag">
                          {tag}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      <section aria-labelledby="photos-heading" className="mt-16 sm:mt-24">
        <div className="shell">
          <div className="mb-6 flex items-end justify-between border-b border-ink pb-3 sm:mb-8">
            <h2 id="photos-heading" className="display text-3xl sm:text-5xl">
              Photographs
            </h2>
            <p className="meta pb-1">
              {trip.photos.length === 0
                ? "None yet"
                : `${trip.photos.length} ${trip.photos.length === 1 ? "photo" : "photos"}`}
            </p>
          </div>
        </div>

        <Gallery
          photos={trip.photos}
          places={trip.places}
          tripTitle={trip.title}
          emptyState={
            // The globe turned to this trip, so the page still has a picture
            // and says plainly that photos are to come.
            <div className="shell">
              <div className="relative flex min-h-[26rem] items-end overflow-hidden border border-rule bg-sunk sm:min-h-[34rem]">
                <TripGlobe
                  trip={trip}
                  home={home}
                  className="absolute left-1/2 top-1/2 aspect-square w-[max(110%,46rem)] max-w-none -translate-x-1/2 -translate-y-1/2"
                />
                <div className="relative p-5 sm:p-8">
                  <p className="display text-3xl sm:text-4xl">No photos from this trip yet.</p>
                  <p className="meta mt-3 flex flex-wrap gap-x-4">
                    {point && <span>{formatCoordinates(point)}</span>}
                    <span>Route shown from {settings.home_name}</span>
                  </p>
                </div>
              </div>
            </div>
          }
        />
      </section>

      {(newer || older) && (
        <nav
          aria-label="More trips"
          className="shell mt-20 grid gap-px border-y border-rule sm:mt-28 sm:grid-cols-2"
        >
          <NeighbourLink trip={older} label="Earlier trip" align="left" />
          <NeighbourLink trip={newer} label="Later trip" align="right" />
        </nav>
      )}
    </article>
  );
}

interface NeighbourLinkProps {
  trip: TripSummary | null;
  label: string;
  align: "left" | "right";
}

function NeighbourLink({ trip, label, align }: NeighbourLinkProps) {
  const alignment = align === "right" ? "sm:text-right sm:border-l sm:border-rule sm:pl-8" : "sm:pr-8";
  if (!trip) return <div className={`hidden sm:block ${alignment}`} />;

  return (
    <Link href={tripPath(trip)} className={`group block py-8 ${alignment}`}>
      <span className="meta">
        {align === "left" && <span aria-hidden="true">← </span>}
        {label}
        {align === "right" && <span aria-hidden="true"> →</span>}
      </span>
      <span className="display mt-2 block text-3xl transition-colors group-hover:text-accent sm:text-4xl">
        {trip.title}
      </span>
      <span className="meta mt-2 block">{formatTripDates(trip)}</span>
    </Link>
  );
}

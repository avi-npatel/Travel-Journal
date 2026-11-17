import { countryNames } from "@/lib/countries";
import { formatTripDates, tripLengthDays } from "@/lib/dates";
import { distanceKm, formatCoordinates, formatDistance, homePoint, tripPoint } from "@/lib/geo";
import { formatTripNumber } from "@/lib/site";
import type { SiteSettings, TripWithPhotos } from "@/lib/types";

interface BoardingPassProps {
  trip: TripWithPhotos;
  number: number | undefined;
  settings: SiteSettings;
}

/**
 * A trip's facts laid out like a boarding pass: where from, where to, when,
 * how far, with a tear-off stub. The "to" code is the destination's ISO
 * country code, since a trip is not tied to one airport.
 */
export function BoardingPass({ trip, number, settings }: BoardingPassProps) {
  const home = homePoint(settings);
  const point = tripPoint(trip);
  const km = point ? distanceKm(home, point) : null;
  const days = tripLengthDays(trip);
  const countries = countryNames(trip.country_codes);

  const fields = [
    { label: "Date", value: formatTripDates(trip) ?? "Undated" },
    { label: "Distance", value: km === null ? "—" : `${formatDistance(km)} · ${formatDistance(km, "km")}` },
    { label: "Coordinates", value: point ? formatCoordinates(point) : "—" },
    { label: "Trip", value: formatTripNumber(number) || "—" },
  ];

  return (
    <section className="pass" aria-label="Trip details">
      <div className="pass-main">
        <div className="flex items-end gap-4 sm:gap-8">
          <div>
            <p className="meta">From</p>
            <p className="pass-code mt-1">{settings.home_code}</p>
            <p className="meta meta-ink mt-2">{settings.home_name}</p>
          </div>

          <div className="flex min-w-8 flex-1 items-center gap-3 pb-9 text-muted" aria-hidden="true">
            <span className="h-px flex-1 border-t border-dashed border-current" />
            <PlaneIcon />
            <span className="h-px flex-1 border-t border-dashed border-current" />
          </div>

          <div className="text-right">
            <p className="meta">To</p>
            <p className="pass-code mt-1">{trip.country_codes.slice(0, 2).join("·") || "—"}</p>
            <p className="meta meta-ink mt-2">{countries.join(", ") || "Somewhere"}</p>
          </div>
        </div>

        <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-rule pt-5 sm:grid-cols-4">
          {fields.map((field) => (
            <div key={field.label}>
              <dt className="meta">{field.label}</dt>
              <dd className="meta meta-ink mt-1 text-[0.8125rem]">{field.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="pass-stub flex items-end justify-between gap-6 min-[900px]:flex-col min-[900px]:items-stretch">
        <dl className="flex gap-8 min-[900px]:justify-between">
          <div>
            <dt className="meta">Photos</dt>
            <dd className="pass-code mt-1 text-[2rem]">{String(trip.photos.length).padStart(2, "0")}</dd>
          </div>
          <div className="min-[900px]:text-right">
            <dt className="meta">Days</dt>
            <dd className="pass-code mt-1 text-[2rem]">
              {days === null ? "—" : String(days).padStart(2, "0")}
            </dd>
          </div>
        </dl>
        <Barcode seed={trip.slug} />
      </div>
    </section>
  );
}

/** Airliner seen from above, turned to fly left to right. */
function PlaneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 rotate-45 text-ink" aria-hidden="true">
      <path
        fill="currentColor"
        d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"
      />
    </svg>
  );
}

/**
 * Decorative barcode. The bar widths come from the trip's slug, so each trip
 * gets its own pattern and it never changes between renders.
 */
function Barcode({ seed }: { seed: string }) {
  const bars: { x: number; width: number }[] = [];
  let hash = 2166136261; // FNV-1a
  let x = 0;
  for (let i = 0; x < 150; i++) {
    hash ^= seed.charCodeAt(i % seed.length);
    hash = Math.imul(hash, 16777619);
    const width = 1 + ((hash >>> 8) % 3);
    if (i % 2 === 0) bars.push({ x, width });
    x += width + (i % 2 === 0 ? 0 : 1);
  }

  return (
    <svg
      viewBox="0 0 150 34"
      preserveAspectRatio="none"
      className="h-9 w-32 shrink-0 text-ink min-[900px]:w-full"
      aria-hidden="true"
    >
      {bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y="0" width={bar.width} height="34" fill="currentColor" />
      ))}
    </svg>
  );
}

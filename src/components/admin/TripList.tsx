"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createDraftTrip, listTrips } from "@/lib/admin/api";
import { cn } from "@/lib/cn";
import { countryNames } from "@/lib/countries";
import { formatTripDates } from "@/lib/dates";
import type { TripSummary } from "@/lib/types";

type Filter = "all" | "published" | "draft";

const describe = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/** The admin home: every trip, drafts included, and the "New trip" button. */
export function TripList() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    listTrips()
      .then((rows) => !cancelled && setTrips(rows))
      .catch((e) => !cancelled && setError(describe(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  async function createTrip() {
    setCreating(true);
    try {
      // A draft row is created straight away so photos can be attached to it
      // before anything else is filled in. Drafts are never public.
      router.push(`/admin/trips/${await createDraftTrip()}`);
    } catch (e) {
      setError(describe(e));
      setCreating(false);
    }
  }

  const needle = search.trim().toLowerCase();
  const visible = (trips ?? []).filter(
    (trip) =>
      (filter === "all" || trip.status === filter) &&
      (!needle ||
        trip.title.toLowerCase().includes(needle) ||
        countryNames(trip.country_codes).some((name) => name.toLowerCase().includes(needle))),
  );
  const draftCount = trips?.filter((trip) => trip.status === "draft").length ?? 0;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-5xl sm:text-6xl">Trips</h1>
          {trips && (
            <p className="meta mt-3">
              {trips.length - draftCount} published · {draftCount} {draftCount === 1 ? "draft" : "drafts"}
            </p>
          )}
        </div>
        <button type="button" className="btn btn-primary" onClick={createTrip} disabled={creating}>
          {creating ? "Creating…" : "New trip"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-6 border-l-2 border-danger pl-3 text-danger">
          {error}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-rule py-3">
        <div role="group" aria-label="Show" className="flex">
          {(["all", "published", "draft"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={cn(
                "meta min-h-9 border px-3 capitalize first:rounded-l last:rounded-r [&:not(:first-child)]:-ml-px",
                filter === option
                  ? "relative border-accent bg-accent text-on-accent"
                  : "meta-ink border-rule hover:border-ink",
              )}
            >
              {option === "draft" ? "Drafts" : option}
            </button>
          ))}
        </div>
        <label htmlFor="trip-search" className="sr-only">
          Search trips
        </label>
        <input
          id="trip-search"
          type="search"
          className="field ml-auto min-h-9 w-full py-1 text-sm sm:w-64"
          placeholder="Search by title or country"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {trips === null && !error && (
        <p className="meta mt-8" role="status">
          Loading trips…
        </p>
      )}

      {trips && visible.length === 0 && (
        <p className="mt-10 text-soft">
          {trips.length === 0 ? "No trips yet. Start with “New trip”." : "No trips match."}
        </p>
      )}

      {visible.length > 0 && (
        <ul>
          {visible.map((trip) => (
            <li key={trip.id}>
              <Link
                href={`/admin/trips/${trip.id}`}
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-b border-rule px-1 py-4 transition-colors hover:bg-raised sm:grid-cols-[minmax(0,1fr)_9rem_6rem_6.5rem] sm:px-3"
              >
                <span>
                  <span className="board-title block group-hover:text-accent">{trip.title}</span>
                  <span className="meta mt-1 block">
                    {countryNames(trip.country_codes).join(", ") || "No country yet"}
                  </span>
                </span>
                <span className="meta hidden sm:block">{formatTripDates(trip) ?? "No date"}</span>
                <span className="meta hidden sm:block">
                  {trip.photo_count} {trip.photo_count === 1 ? "photo" : "photos"}
                </span>
                <span
                  className={cn(
                    "meta justify-self-end rounded-sm border px-2 py-0.5",
                    trip.status === "published" ? "border-accent text-accent" : "border-rule",
                  )}
                >
                  {trip.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

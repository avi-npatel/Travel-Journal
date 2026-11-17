"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { addRoutes, createCountryMap } from "@/lib/map/country-map";
import type { LatLng } from "@/lib/types";

export interface MapPageTrip {
  slug: string;
  title: string;
  dateLabel: string | null;
  countryLabel: string;
  /** Null when the trip has neither coordinates nor a country. */
  point: LatLng | null;
}

interface InteractiveMapProps {
  trips: MapPageTrip[];
  visitedCodes: string[];
  home: LatLng;
}

type Projection = "mercator" | "globe";
type Status = "loading" | "ready" | "error";

/**
 * The map page: visited countries filled in, a pin per trip, routes from
 * home. Pins are real links, so they can be reached and opened from the
 * keyboard, and the list beside the map offers the same trips as text.
 */
export function InteractiveMap({ trips, visitedCodes, home }: InteractiveMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const pinsRef = useRef(new Map<string, HTMLElement>());
  const [status, setStatus] = useState<Status>("loading");
  const [projection, setProjection] = useState<Projection>("mercator");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pins = pinsRef.current;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    createCountryMap(container, { visitedCodes })
      .then((created) => {
        if (cancelled) return created.destroy();
        const { map, maplibregl } = created;
        destroy = created.destroy;
        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        const pinned = trips.filter((trip): trip is MapPageTrip & { point: LatLng } => trip.point !== null);
        addRoutes(
          map,
          home,
          pinned.map((trip) => trip.point),
        );

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });

        for (const trip of pinned) {
          const pin = document.createElement("a");
          pin.href = `/trips/${trip.slug}`;
          pin.className = "map-pin";
          pin.setAttribute("aria-label", [trip.title, trip.dateLabel].filter(Boolean).join(", "));

          const lngLat: [number, number] = [trip.point.lng, trip.point.lat];
          const showLabel = () => {
            setActiveSlug(trip.slug);
            popup.setLngLat(lngLat).setDOMContent(pinLabel(trip)).addTo(map);
          };
          const hideLabel = () => {
            setActiveSlug(null);
            popup.remove();
          };
          pin.addEventListener("mouseenter", showLabel);
          pin.addEventListener("mouseleave", hideLabel);
          pin.addEventListener("focus", showLabel);
          pin.addEventListener("blur", hideLabel);
          pin.addEventListener("click", (event) => {
            // Client-side navigation unless the visitor wants a new tab.
            if (event.metaKey || event.ctrlKey || event.shiftKey) return;
            event.preventDefault();
            router.push(`/trips/${trip.slug}`);
          });

          new maplibregl.Marker({ element: pin }).setLngLat(lngLat).addTo(map);
          pins.set(trip.slug, pin);
        }

        // Start framed on home plus every pin.
        if (pinned.length > 0) {
          const bounds = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
          for (const trip of pinned) bounds.extend([trip.point.lng, trip.point.lat]);
          map.fitBounds(bounds, { padding: 72, maxZoom: 4, animate: false });
        }

        const homeDot = document.createElement("div");
        homeDot.className = "size-2.5 rounded-full border-[1.5px] border-ink bg-paper";
        homeDot.title = "Home";
        new maplibregl.Marker({ element: homeDot }).setLngLat([home.lng, home.lat]).addTo(map);

        setStatus("ready");
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      pins.clear();
      mapRef.current = null;
      destroy?.();
    };
    // The page passes fresh arrays on every render; the map is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror list hover onto the matching pin.
  useEffect(() => {
    pinsRef.current.forEach((pin, slug) => pin.setAttribute("data-active", String(slug === activeSlug)));
  }, [activeSlug]);

  function changeProjection(next: Projection) {
    setProjection(next);
    mapRef.current?.setProjection({ type: next });
  }

  return (
    <div className="grid border-y border-rule lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="relative h-[62svh] min-h-[26rem] lg:h-[calc(100svh-13rem)]">
        <div
          ref={containerRef}
          // Sized with height/width, not absolute positioning: MapLibre's own
          // stylesheet sets `position: relative` on this element.
          className="size-full"
          role="region"
          aria-label="Interactive world map. Use the trip list to browse without the map."
        />

        {status !== "ready" && (
          <p className="meta absolute inset-0 grid place-items-center" role="status">
            {status === "loading"
              ? "Loading map…"
              : "The map could not be loaded. The trips are listed below."}
          </p>
        )}

        <div role="group" aria-label="Map projection" className="absolute left-3 top-3 flex">
          {(["mercator", "globe"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={projection === option}
              onClick={() => changeProjection(option)}
              className={cn(
                "meta min-h-9 border px-3 transition-colors first:rounded-l last:-ml-px last:rounded-r",
                projection === option
                  ? "relative z-10 border-accent bg-accent text-on-accent"
                  : "meta-ink border-rule bg-raised hover:border-ink",
              )}
            >
              {option === "mercator" ? "Flat" : "Globe"}
            </button>
          ))}
        </div>
      </div>

      <aside
        aria-label="Trips on the map"
        className="border-t border-rule lg:max-h-[calc(100svh-13rem)] lg:overflow-y-auto lg:border-l lg:border-t-0"
      >
        <ul>
          {trips.map((trip) => (
            <li key={trip.slug} className="border-b border-rule last:border-b-0">
              <Link
                href={`/trips/${trip.slug}`}
                onMouseEnter={() => setActiveSlug(trip.slug)}
                onMouseLeave={() => setActiveSlug(null)}
                onFocus={() => setActiveSlug(trip.slug)}
                onBlur={() => setActiveSlug(null)}
                className={cn(
                  "group block px-4 py-4 transition-colors hover:bg-raised sm:px-5",
                  activeSlug === trip.slug && "bg-raised",
                )}
              >
                <span className="meta flex justify-between gap-3">
                  <span>{trip.dateLabel ?? "Undated"}</span>
                  <span className="text-right">{trip.countryLabel}</span>
                </span>
                <span
                  className={cn(
                    "display mt-1 block text-2xl transition-colors group-hover:text-accent",
                    activeSlug === trip.slug && "text-accent",
                  )}
                >
                  {trip.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

/** Contents of the label that appears over a hovered or focused pin. */
function pinLabel(trip: MapPageTrip): HTMLElement {
  const label = document.createElement("div");
  const title = document.createElement("p");
  title.className = "display text-xl";
  title.textContent = trip.title;
  const detail = document.createElement("p");
  detail.className = "meta mt-1";
  detail.textContent = [trip.dateLabel, trip.countryLabel].filter(Boolean).join(" · ");
  label.append(title, detail);
  return label;
}

"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { Map as MapLibreMap } from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { addRoutes, createCountryMap } from "@/lib/map/country-map";
import type { LatLng } from "@/lib/types";

export interface MapPagePin {
  key: string;
  /** The place's name; null for a trip pinned only by its country. */
  name: string | null;
  href: string;
  point: LatLng;
  showRoute: boolean;
}

export interface MapPageTrip {
  slug: string;
  title: string;
  dateLabel: string | null;
  countryLabel: string;
  pins: MapPagePin[];
}

interface InteractiveMapProps {
  trips: MapPageTrip[];
  visitedCodes: string[];
  home: LatLng;
}

type Projection = "mercator" | "globe";
type Status = "loading" | "ready" | "error";

/**
 * The map page: visited countries filled in, a pin for every place, routes
 * from home to the places that have one. Pins are real links, so they can be
 * reached and opened from the keyboard, and the list beside the map offers
 * the same trips as text. Hovering a trip in the list lights up its pins.
 */
export function InteractiveMap({ trips, visitedCodes, home }: InteractiveMapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  /** Every pin element, by trip slug. */
  const pinsRef = useRef(new Map<string, HTMLElement[]>());
  const [status, setStatus] = useState<Status>("loading");
  const [projection, setProjection] = useState<Projection>("mercator");
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const pinElements = pinsRef.current;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    createCountryMap(container, { visitedCodes })
      .then((created) => {
        if (cancelled) return created.destroy();
        const { map, maplibregl } = created;
        destroy = created.destroy;
        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

        const allPins = trips.flatMap((trip) => trip.pins);
        addRoutes(
          map,
          home,
          allPins.filter((pin) => pin.showRoute).map((pin) => pin.point),
        );

        const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16 });

        for (const trip of trips) {
          const elements: HTMLElement[] = [];
          for (const pin of trip.pins) {
            const element = document.createElement("a");
            element.href = pin.href;
            element.className = "map-pin";
            element.setAttribute(
              "aria-label",
              [pin.name, trip.title, trip.dateLabel].filter(Boolean).join(", "),
            );
            // The marker element is positioned by MapLibre; everything that
            // grows on hover lives on this inner dot (see globals.css).
            const dot = document.createElement("span");
            dot.className = "map-pin-dot";
            element.append(dot);

            const lngLat: [number, number] = [pin.point.lng, pin.point.lat];
            const showLabel = () => {
              setActiveSlug(trip.slug);
              popup.setLngLat(lngLat).setDOMContent(pinLabel(trip, pin)).addTo(map);
            };
            const hideLabel = () => {
              setActiveSlug(null);
              popup.remove();
            };
            element.addEventListener("mouseenter", showLabel);
            element.addEventListener("mouseleave", hideLabel);
            element.addEventListener("focus", showLabel);
            element.addEventListener("blur", hideLabel);
            element.addEventListener("click", (event) => {
              // Client-side navigation unless the visitor wants a new tab.
              if (event.metaKey || event.ctrlKey || event.shiftKey) return;
              event.preventDefault();
              router.push(pin.href);
            });

            new maplibregl.Marker({ element }).setLngLat(lngLat).addTo(map);
            elements.push(element);
          }
          pinElements.set(trip.slug, elements);
        }

        // Start framed on home plus every pin.
        if (allPins.length > 0) {
          const bounds = new maplibregl.LngLatBounds([home.lng, home.lat], [home.lng, home.lat]);
          for (const pin of allPins) bounds.extend([pin.point.lng, pin.point.lat]);
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
      pinElements.clear();
      mapRef.current = null;
      destroy?.();
    };
    // The page passes fresh arrays on every render; the map is built once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Light up every pin of the trip hovered in the list (or on the map).
  useEffect(() => {
    pinsRef.current.forEach((elements, slug) => {
      for (const element of elements) element.setAttribute("data-active", String(slug === activeSlug));
    });
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
function pinLabel(trip: MapPageTrip, pin: MapPagePin): HTMLElement {
  const label = document.createElement("div");
  const title = document.createElement("p");
  title.className = "display text-xl";
  title.textContent = pin.name ?? trip.title;
  const detail = document.createElement("p");
  detail.className = "meta mt-1";
  detail.textContent = [pin.name ? trip.title : null, trip.dateLabel, pin.name ? null : trip.countryLabel]
    .filter(Boolean)
    .join(" · ");
  label.append(title, detail);
  return label;
}

"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { getCountry } from "@/lib/countries";
import { pinnedPlaces, roundPoint } from "@/lib/geo";
import { createCountryMap, setVisitedCountries } from "@/lib/map/country-map";
import type { LatLng, TripPlace } from "@/lib/types";

interface PlacesMapProps {
  places: TripPlace[];
  /** The place whose pin a click on the map sets. */
  activeId: string | null;
  /** The trip's countries, shaded for orientation. */
  countryCodes: string[];
  /** Exact photo positions from EXIF. Shown here only; never published. */
  photoPoints: LatLng[];
  /** A click on empty map: put the active place's pin here. */
  onPick: (point: LatLng) => void;
  /** A pin was dragged to a new spot. */
  onMove: (placeId: string, point: LatLng) => void;
  /** A pin was clicked. */
  onSelect: (placeId: string) => void;
}

/** Hand-placed pins keep two decimals (about 1 km): a town, not a doorstep. */
export const PIN_DIGITS = 2;
const PHOTO_SOURCE = "photo-points";

const photoFeatures = (points: LatLng[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((point) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
  })),
});

interface PinMarker {
  marker: Marker;
  element: HTMLElement;
  number: HTMLElement;
}

/**
 * The admin map for a trip's places: one numbered pin per pinned place. Click
 * the map to place the selected place's pin, drag a pin to move it, click a
 * pin to select its place.
 */
export function PlacesMap({
  places,
  activeId,
  countryCodes,
  photoPoints,
  onPick,
  onMove,
  onSelect,
}: PlacesMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libraryRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef(new Map<string, PinMarker>());
  const [ready, setReady] = useState(false);

  // The map's own event handlers are made once; these keep them pointed at
  // the latest callbacks.
  const handlers = useRef({ onPick, onMove, onSelect });
  useEffect(() => {
    handlers.current = { onPick, onMove, onSelect };
  }, [onPick, onMove, onSelect]);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const markers = markersRef.current;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    createCountryMap(container, { visitedCodes: [] }).then((created) => {
      if (cancelled) return created.destroy();
      const { map, maplibregl } = created;
      destroy = created.destroy;
      mapRef.current = map;
      libraryRef.current = maplibregl;

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.getCanvas().style.cursor = "crosshair";

      map.addSource(PHOTO_SOURCE, { type: "geojson", data: photoFeatures([]) });
      map.addLayer({
        id: PHOTO_SOURCE,
        type: "circle",
        source: PHOTO_SOURCE,
        paint: {
          "circle-radius": 3.5,
          "circle-color": getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
          "circle-opacity": 0.5,
        },
      });

      map.on("click", (event) => {
        handlers.current.onPick(roundPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng }, PIN_DIGITS));
      });

      setReady(true);
    });

    return () => {
      cancelled = true;
      markers.clear();
      mapRef.current = null;
      destroy?.();
    };
  }, []);

  // Keep one marker per pinned place, numbered by its place in the list.
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libraryRef.current;
    if (!ready || !map || !maplibregl) return;
    const markers = markersRef.current;

    const pinned = pinnedPlaces({ places });
    const keep = new Set(pinned.map((place) => place.id));
    for (const [id, pin] of markers) {
      if (!keep.has(id)) {
        pin.marker.remove();
        markers.delete(id);
      }
    }

    for (const place of pinned) {
      let pin = markers.get(place.id);
      if (!pin) {
        const element = document.createElement("button");
        element.type = "button";
        element.className = "map-pin";
        const dot = document.createElement("span");
        dot.className = "map-pin-dot";
        const number = document.createElement("span");
        number.className = "map-pin-number";
        element.append(dot, number);
        element.addEventListener("click", (event) => {
          event.stopPropagation(); // not a click on the map
          handlers.current.onSelect(place.id);
        });

        const marker = new maplibregl.Marker({ element, draggable: true }).setLngLat([place.lng, place.lat]);
        marker.on("dragend", () => {
          const { lat, lng } = marker.getLngLat();
          handlers.current.onMove(place.id, roundPoint({ lat, lng }, PIN_DIGITS));
        });
        marker.addTo(map);
        pin = { marker, element, number };
        markers.set(place.id, pin);
      }
      pin.marker.setLngLat([place.lng, place.lat]);
      const position = places.findIndex((p) => p.id === place.id) + 1;
      pin.number.textContent = String(position);
      pin.element.setAttribute("aria-label", `Pin ${position}: ${place.name}`);
      pin.element.dataset.active = String(place.id === activeId);
    }
  }, [ready, places, activeId]);

  // Frame all pins when the map first has them; afterwards only follow the
  // selected place when its pin is off screen.
  const framed = useRef(false);
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = libraryRef.current;
    if (!ready || !map || !maplibregl) return;
    const pinned = pinnedPlaces({ places });

    if (!framed.current) {
      framed.current = true;
      if (pinned.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        for (const place of pinned) bounds.extend([place.lng, place.lat]);
        map.fitBounds(bounds, { padding: 60, maxZoom: 5, animate: false });
      } else {
        const country = getCountry(countryCodes[0] ?? "");
        if (country) map.jumpTo({ center: [country.lng, country.lat], zoom: 2.6 });
      }
      return;
    }

    const active = pinned.find((place) => place.id === activeId);
    if (active && !map.getBounds().contains([active.lng, active.lat])) {
      map.easeTo({ center: [active.lng, active.lat], zoom: Math.max(map.getZoom(), 3.5) });
    }
  }, [ready, places, activeId, countryCodes]);

  useEffect(() => {
    if (ready && mapRef.current) setVisitedCountries(mapRef.current, countryCodes);
  }, [ready, countryCodes]);

  useEffect(() => {
    const source = ready ? (mapRef.current?.getSource(PHOTO_SOURCE) as GeoJSONSource | undefined) : undefined;
    source?.setData(photoFeatures(photoPoints));
  }, [ready, photoPoints]);

  return (
    <div className="relative h-80 overflow-hidden rounded border border-rule sm:h-[26rem]">
      <div
        ref={containerRef}
        className="size-full"
        aria-label="Map of this trip's places. Click to place the selected place's pin."
        role="application"
      />
      {!ready && <p className="meta absolute inset-0 grid place-items-center">Loading map…</p>}
    </div>
  );
}

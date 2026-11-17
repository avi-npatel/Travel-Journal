"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { getCountry } from "@/lib/countries";
import { formatCoordinates, roundPoint } from "@/lib/geo";
import { createCountryMap, setVisitedCountries } from "@/lib/map/country-map";
import type { LatLng } from "@/lib/types";

interface LocationPickerProps {
  /** The trip's public pin, or null when it has none. */
  value: LatLng | null;
  onChange: (point: LatLng | null) => void;
  /** The trip's countries, shaded on the map for orientation. */
  countryCodes: string[];
  /** Exact photo positions from EXIF. Shown here only; never published. */
  photoPoints: LatLng[];
}

interface SearchResult {
  name: string;
  point: LatLng;
}

/** Hand-placed pins keep two decimals (about 1 km): a town, not a doorstep. */
const PIN_DIGITS = 2;
const PHOTO_SOURCE = "photo-points";

const photoFeatures = (points: LatLng[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((point) => ({
    type: "Feature" as const,
    properties: {},
    geometry: { type: "Point" as const, coordinates: [point.lng, point.lat] },
  })),
});

/** Looks a place name up with OpenStreetMap's free search (Nominatim). */
async function searchPlaces(query: string): Promise<SearchResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "5" }).toString();
  const response = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!response.ok) throw new Error("Search is unavailable right now.");
  const rows: { display_name: string; lat: string; lon: string }[] = await response.json();
  return rows.map((row) => ({
    name: row.display_name,
    point: { lat: Number(row.lat), lng: Number(row.lon) },
  }));
}

/**
 * Chooses where a trip's pin sits on the public map: search for a place,
 * click the map, or drag the pin. Small dots mark where the trip's photos
 * were taken (from their EXIF data), to help with placing it.
 */
export function LocationPicker({ value, onChange, countryCodes, photoPoints }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // The map's event handlers are created once; this keeps them pointed at
  // the latest onChange.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Create the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let destroy: (() => void) | undefined;

    createCountryMap(container, { visitedCodes: [] }).then((created) => {
      if (cancelled) return created.destroy();
      const { map, maplibregl } = created;
      destroy = created.destroy;
      mapRef.current = map;

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
          "circle-opacity": 0.55,
        },
      });

      const pin = document.createElement("div");
      pin.className = "map-pin";
      const marker = new maplibregl.Marker({ element: pin, draggable: true });
      marker.on("dragend", () => {
        const { lat, lng } = marker.getLngLat();
        onChangeRef.current(roundPoint({ lat, lng }, PIN_DIGITS));
      });
      markerRef.current = marker;

      map.on("click", (event) => {
        onChangeRef.current(roundPoint({ lat: event.lngLat.lat, lng: event.lngLat.lng }, PIN_DIGITS));
      });

      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current = null;
      markerRef.current = null;
      destroy?.();
    };
  }, []);

  // Keep the pin in step with the value.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!ready || !map || !marker) return;
    if (value) marker.setLngLat([value.lng, value.lat]).addTo(map);
    else marker.remove();
  }, [ready, value]);

  // When the pin first appears or jumps far away, bring it into view.
  const lastCentred = useRef<LatLng | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !value) return;
    const previous = lastCentred.current;
    const isOnScreen = map.getBounds().contains([value.lng, value.lat]);
    if (!previous || !isOnScreen) {
      map.easeTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 3.2) });
    }
    lastCentred.current = value;
  }, [ready, value]);

  // Shade the trip's countries and, until there is a pin, look at the first one.
  const hasPin = value !== null;
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    setVisitedCountries(map, countryCodes);
    const first = getCountry(countryCodes[0] ?? "");
    if (!hasPin && first) map.easeTo({ center: [first.lng, first.lat], zoom: 2.6 });
  }, [ready, countryCodes, hasPin]);

  useEffect(() => {
    const source = ready ? (mapRef.current?.getSource(PHOTO_SOURCE) as GeoJSONSource | undefined) : undefined;
    source?.setData(photoFeatures(photoPoints));
  }, [ready, photoPoints]);

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPlaces(query.trim()));
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  function choose(result: SearchResult) {
    onChange(roundPoint(result.point, PIN_DIGITS));
    setResults(null);
    setQuery("");
  }

  return (
    <div>
      <div className="flex gap-2">
        <label htmlFor="place-search" className="sr-only">
          Find a place
        </label>
        <input
          id="place-search"
          type="search"
          className="field"
          placeholder="Find a place, e.g. Lisbon"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault(); // search, do not submit the trip form
              runSearch();
            }
          }}
        />
        <button type="button" className="btn" onClick={runSearch} disabled={searching || !query.trim()}>
          {searching ? "Searching…" : "Find"}
        </button>
      </div>

      {searchError && (
        <p role="alert" className="hint text-danger">
          {searchError}
        </p>
      )}
      {results && (
        <ul className="mt-2 divide-y divide-rule rounded border border-rule bg-raised">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Nothing found. Try another name.</li>
          )}
          {results.map((result) => (
            <li key={`${result.point.lat},${result.point.lng}`}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-sunk"
                onClick={() => choose(result)}
              >
                {result.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative mt-3 h-72 overflow-hidden rounded border border-rule sm:h-96">
        <div
          ref={containerRef}
          className="size-full"
          aria-label="Map for placing the trip's pin"
          role="application"
        />
        {!ready && <p className="meta absolute inset-0 grid place-items-center">Loading map…</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="meta meta-ink" aria-live="polite">
          {value
            ? `Pin: ${formatCoordinates(value)}`
            : "No pin yet. The middle of the first country is used."}
        </p>
        {value && (
          <button type="button" className="btn btn-sm btn-quiet" onClick={() => onChange(null)}>
            Remove pin
          </button>
        )}
      </div>
      <p className="hint">
        Search, click the map, or drag the pin. Place search is provided by OpenStreetMap.
        {photoPoints.length > 0 &&
          ` Grey dots are where ${photoPoints.length === 1 ? "a photo was" : `${photoPoints.length} photos were`} taken; only you can see them.`}
      </p>
    </div>
  );
}

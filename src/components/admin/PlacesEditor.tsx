"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { addPlace, deletePlace, savePlaceOrder, updatePlace, type PlaceChanges } from "@/lib/admin/api";
import { searchPlaces, type PlaceSearchResult } from "@/lib/admin/geocode";
import { cn } from "@/lib/cn";
import { countryNames } from "@/lib/countries";
import { formatCoordinates, roundPoint } from "@/lib/geo";
import type { LatLng, TripPlace } from "@/lib/types";
import { PIN_DIGITS, PlacesMap } from "./PlacesMap";

interface PlacesEditorProps {
  tripId: string;
  places: TripPlace[];
  setPlaces: Dispatch<SetStateAction<TripPlace[]>>;
  countryCodes: string[];
  photoPoints: LatLng[];
  /** How many photos each place holds, by place id. */
  photoCounts: Map<string, number>;
  /** Called after anything is saved, so the public site can be refreshed. */
  onSaved: () => void;
  onError: (message: string) => void;
  /** Called after a place is deleted: its photos are now unassigned. */
  onPlaceDeleted: (placeId: string) => void;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/**
 * A trip's places, each with an optional map pin and route line. Every change
 * is saved as it is made, like photos; the Save button is only for the
 * details form above.
 */
export function PlacesEditor({
  tripId,
  places,
  setPlaces,
  countryCodes,
  photoPoints,
  photoCounts,
  onSaved,
  onError,
  onPlaceDeleted,
}: PlacesEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(
    () => places.find((place) => place.lat === null)?.id ?? places[0]?.id ?? null,
  );
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const active = places.find((place) => place.id === activeId) ?? null;

  /** Shows the change at once, saves it, and undoes it on the page if saving fails. */
  async function change(placeId: string, changes: PlaceChanges) {
    const before = places;
    setPlaces((current) => current.map((place) => (place.id === placeId ? { ...place, ...changes } : place)));
    try {
      await updatePlace(placeId, changes);
      onSaved();
    } catch (error) {
      setPlaces(before);
      onError(describe(error));
    }
  }

  const setPin = (placeId: string, point: LatLng | null) =>
    change(placeId, { lat: point?.lat ?? null, lng: point?.lng ?? null });

  async function add() {
    const name = newName.trim().replace(/\s+/g, " ");
    if (!name) return;
    if (places.some((place) => place.name.toLowerCase() === name.toLowerCase())) {
      onError(`“${name}” is already on this trip.`);
      return;
    }
    setAdding(true);
    try {
      const place = await addPlace(tripId, name, places.length);
      setPlaces((current) => [...current, place]);
      setActiveId(place.id);
      setNewName("");
      onSaved();
    } catch (error) {
      onError(describe(error));
    } finally {
      setAdding(false);
    }
  }

  async function move(placeId: string, direction: -1 | 1) {
    const from = places.findIndex((place) => place.id === placeId);
    const to = from + direction;
    if (to < 0 || to >= places.length) return;
    const reordered = [...places];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
    const before = places;
    setPlaces(reordered.map((place, index) => ({ ...place, sort_order: index })));
    try {
      await savePlaceOrder(reordered.map((place) => place.id));
      onSaved();
    } catch (error) {
      setPlaces(before);
      onError(describe(error));
    }
  }

  async function remove(placeId: string) {
    try {
      await deletePlace(placeId);
      setPlaces((current) => current.filter((place) => place.id !== placeId));
      if (activeId === placeId) setActiveId(null);
      onPlaceDeleted(placeId);
      onSaved();
    } catch (error) {
      onError(describe(error));
    }
  }

  async function runSearch(text: string) {
    if (!text.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPlaces(text.trim()));
    } catch (error) {
      setSearchError(describe(error));
    } finally {
      setSearching(false);
    }
  }

  /** Searches for a place by its own name (plus the trip's countries, to narrow it down). */
  function locate(place: TripPlace) {
    setActiveId(place.id);
    const text = [place.name, ...countryNames(countryCodes).slice(0, 1)].join(", ");
    setQuery(text);
    runSearch(text);
  }

  function chooseResult(result: PlaceSearchResult) {
    if (!active) return;
    setPin(active.id, roundPoint(result.point, PIN_DIGITS));
    setResults(null);
    setQuery("");
  }

  return (
    <div className="grid gap-x-8 gap-y-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        {places.length === 0 ? (
          <p className="text-sm text-soft">
            No places yet. Add the cities, towns or spots this trip covered.
          </p>
        ) : (
          <ol className="divide-y divide-rule border-y border-rule">
            {places.map((place, index) => (
              <PlaceRow
                key={place.id}
                place={place}
                position={index + 1}
                isFirst={index === 0}
                isLast={index === places.length - 1}
                isActive={place.id === activeId}
                photoCount={photoCounts.get(place.id) ?? 0}
                onActivate={() => setActiveId(place.id)}
                onRename={(name) => change(place.id, { name })}
                onToggleRoute={(show_route) => change(place.id, { show_route })}
                onLocate={() => locate(place)}
                onClearPin={() => setPin(place.id, null)}
                onMove={(direction) => move(place.id, direction)}
                onDelete={() => remove(place.id)}
              />
            ))}
          </ol>
        )}

        <div className="mt-4 flex gap-2">
          <label htmlFor="new-place" className="sr-only">
            Add a place
          </label>
          <input
            id="new-place"
            type="text"
            className="field"
            placeholder="Add a place, e.g. London"
            value={newName}
            autoComplete="off"
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault(); // add the place, do not submit anything
                add();
              }
            }}
          />
          <button type="button" className="btn" onClick={add} disabled={adding || !newName.trim()}>
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        <p className="hint">
          Each place can have its own pin. Photos are sorted by place in the Photos section below.
        </p>
      </div>

      <div>
        <div className="flex gap-2">
          <label htmlFor="place-search" className="sr-only">
            Find a place on the map
          </label>
          <input
            id="place-search"
            type="search"
            className="field"
            placeholder={active ? `Find the spot for ${active.name}` : "Select a place first"}
            disabled={!active}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch(query);
              }
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => runSearch(query)}
            disabled={!active || searching || !query.trim()}
          >
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
                  onClick={() => chooseResult(result)}
                >
                  {result.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3">
          <PlacesMap
            places={places}
            activeId={activeId}
            countryCodes={countryCodes}
            photoPoints={photoPoints}
            onPick={(point) => active && setPin(active.id, point)}
            onMove={(placeId, point) => setPin(placeId, point)}
            onSelect={setActiveId}
          />
        </div>
        <p className="hint">
          {active
            ? `Click the map to put the pin for “${active.name}”, or drag any pin.`
            : "Select a place in the list, then click the map to pin it."}{" "}
          Place search is provided by OpenStreetMap.
          {photoPoints.length > 0 && " Grey dots are where your photos were taken; only you can see them."}
        </p>
      </div>
    </div>
  );
}

interface PlaceRowProps {
  place: TripPlace;
  position: number;
  isFirst: boolean;
  isLast: boolean;
  isActive: boolean;
  photoCount: number;
  onActivate: () => void;
  onRename: (name: string) => void;
  onToggleRoute: (showRoute: boolean) => void;
  onLocate: () => void;
  onClearPin: () => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}

function PlaceRow({
  place,
  position,
  isFirst,
  isLast,
  isActive,
  photoCount,
  onActivate,
  onRename,
  onToggleRoute,
  onLocate,
  onClearPin,
  onMove,
  onDelete,
}: PlaceRowProps) {
  const [name, setName] = useState(place.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasPin = place.lat !== null && place.lng !== null;
  const nameId = `place-name-${place.id}`;

  function commitName() {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (!trimmed) return setName(place.name); // a place needs a name
    if (trimmed !== place.name) onRename(trimmed);
  }

  return (
    <li
      className={cn(
        "py-3 pl-3 pr-1 transition-colors",
        isActive ? "border-l-2 border-accent bg-raised" : "border-l-2 border-transparent",
      )}
      onFocusCapture={onActivate}
      onClick={onActivate}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-sm font-mono text-[11px]",
            isActive ? "bg-accent text-on-accent" : "bg-ink text-paper",
          )}
        >
          {position}
        </span>
        <label htmlFor={nameId} className="sr-only">
          Name of place {position}
        </label>
        <input
          id={nameId}
          type="text"
          className="field min-h-9 flex-1 px-2 py-1"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
        <div className="flex shrink-0">
          <IconButton label={`Move ${place.name} up`} disabled={isFirst} onClick={() => onMove(-1)}>
            <path d="M6 15l6-6 6 6" />
          </IconButton>
          <IconButton label={`Move ${place.name} down`} disabled={isLast} onClick={() => onMove(1)}>
            <path d="M6 9l6 6 6-6" />
          </IconButton>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-8">
        <span className="meta meta-ink min-w-[9.5rem]">
          {hasPin ? formatCoordinates({ lat: place.lat!, lng: place.lng! }) : "No pin"}
        </span>
        <button type="button" className="meta link" onClick={onLocate}>
          {hasPin ? "Move pin" : "Find on map"}
        </button>
        {hasPin && (
          <button type="button" className="meta hover:text-danger" onClick={onClearPin}>
            Remove pin
          </button>
        )}
        <label
          className={cn(
            "meta flex items-center gap-1.5",
            hasPin ? "meta-ink cursor-pointer" : "cursor-not-allowed opacity-50",
          )}
          title={hasPin ? undefined : "Add a pin first"}
        >
          <input
            type="checkbox"
            className="size-3.5 accent-[var(--accent)]"
            checked={place.show_route}
            disabled={!hasPin}
            onChange={(event) => onToggleRoute(event.target.checked)}
          />
          Route line from home
        </label>
      </div>

      <div className="mt-2 flex min-h-7 items-center justify-between gap-3 pl-8">
        <span className="meta">
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
        </span>
        {confirmingDelete ? (
          <span className="flex items-center gap-2">
            <span className="text-xs text-danger">
              {photoCount === 0
                ? "Delete?"
                : photoCount === 1
                  ? "Delete? Its photo stays, unassigned."
                  : `Delete? Its ${photoCount} photos stay, unassigned.`}
            </span>
            <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="btn btn-sm btn-quiet" onClick={() => setConfirmingDelete(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="meta hover:text-danger"
            onClick={() => setConfirmingDelete(true)}
            aria-label={`Delete ${place.name}`}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-sm text-soft hover:bg-sunk hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
    >
      <svg
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </button>
  );
}

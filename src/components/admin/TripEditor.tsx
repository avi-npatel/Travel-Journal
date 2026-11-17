"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { refreshPublicSite } from "@/app/admin/actions";
import { deleteTrip, listTags, loadTrip, saveTrip, updatePlace, type TripFields } from "@/lib/admin/api";
import type { TripSuggestion } from "@/lib/admin/exif";
import { countryName } from "@/lib/countries";
import { formatDays, formatTripDates, tripLengthDays } from "@/lib/dates";
import { formatCoordinates } from "@/lib/geo";
import { slugify, tripSlug } from "@/lib/slug";
import type { Photo, PhotoLocation, Trip, TripPlace } from "@/lib/types";
import { ChipInput } from "./ChipInput";
import { ConfirmDialog } from "./ConfirmDialog";
import { CountryPicker } from "./CountryPicker";
import { PhotoManager } from "./PhotoManager";
import { PlacesEditor } from "./PlacesEditor";
import { RichTextEditor } from "./RichTextEditor";
import { MAX_DURATION_DAYS, TripDatesField } from "./TripDatesField";

type Notice = { kind: "ok" | "error"; text: string } | null;

const SUMMARY_MAX = 240;

const FIELD_KEYS = [
  "title",
  "slug",
  "status",
  "country_codes",
  "tags",
  "start_date",
  "date_precision",
  "duration_days",
  "summary",
  "description_html",
] as const satisfies readonly (keyof TripFields)[];

/**
 * The part of a trip row that the form edits. Trips are recorded by month
 * and length; one entered with exact days (before lengths existed) is shown
 * as its month and its number of days, and saved that way.
 */
function fieldsOf(trip: Trip): TripFields {
  const fields = Object.fromEntries(FIELD_KEYS.map((key) => [key, trip[key]])) as TripFields;
  return {
    ...fields,
    start_date: trip.start_date ? `${trip.start_date.slice(0, 7)}-01` : null,
    date_precision: "month",
    duration_days: tripLengthDays(trip),
  };
}

/** Days from the first to the last of two "YYYY-MM-DD" dates, counting both. */
function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
}

/** A fresh draft is created with this title; it is cleared for typing. */
const PLACEHOLDER_TITLE = "Untitled trip";

const describe = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/**
 * The whole "edit a trip" screen. The details form is saved with the Save
 * button; photos save themselves as they change.
 */
export function TripEditor({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<TripFields | null>(null);
  const [saved, setSaved] = useState<TripFields | null>(null);
  const [places, setPlaces] = useState<TripPlace[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [locations, setLocations] = useState<PhotoLocation[]>([]);
  const [coverId, setCoverId] = useState<string | null>(null);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState<{ found: TripSuggestion; placeId: string | null } | null>(
    null,
  );

  const [loadState, setLoadState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // While true, the web address follows the title. It stops following once
  // the trip has been published (so shared links keep working) or once the
  // address has been edited by hand.
  const [slugFollowsTitle, setSlugFollowsTitle] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadTrip(tripId), listTags()])
      .then(([bundle, tags]) => {
        if (cancelled) return;
        if (!bundle) return setLoadState("missing");

        const fields = fieldsOf(bundle.trip);
        const isNew = fields.title === PLACEHOLDER_TITLE && fields.slug.startsWith("untitled-");
        const initial = isNew ? { ...fields, title: "" } : fields;

        setForm(initial);
        setSaved(initial);
        setPlaces(bundle.places);
        setPhotos(bundle.photos);
        setLocations(bundle.locations);
        setCoverId(bundle.trip.cover_photo_id);
        setKnownTags(tags);
        setSlugFollowsTitle(
          fields.status === "draft" && (isNew || fields.slug === tripSlug(fields.title, fields.start_date)),
        );
        setLoadState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setNotice({ kind: "error", text: describe(error) });
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  /** Tells the public site to pick up changes. Photo edits arrive in bursts, so wait for a pause. */
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const refreshSoon = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      refreshPublicSite().catch((error) => setNotice({ kind: "error", text: describe(error) }));
    }, 800);
  }, []);

  const showError = useCallback((text: string) => setNotice({ kind: "error", text }), []);
  const addLocations = useCallback(
    (added: PhotoLocation[]) => setLocations((current) => [...current, ...added]),
    [],
  );

  const photoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of photos) {
      if (photo.place_id) counts.set(photo.place_id, (counts.get(photo.place_id) ?? 0) + 1);
    }
    return counts;
  }, [photos]);

  // The place's photos stay on the trip; the database has already unassigned them.
  const unassignPhotosOf = useCallback(
    (placeId: string) =>
      setPhotos((current) =>
        current.map((photo) => (photo.place_id === placeId ? { ...photo, place_id: null } : photo)),
      ),
    [],
  );
  const offerSuggestion = useCallback(
    (found: TripSuggestion, placeId: string | null) => setSuggestion({ found, placeId }),
    [],
  );

  // Only photos that still exist; deleting a photo deletes its location too.
  const photoPoints = useMemo(() => {
    const ids = new Set(photos.map((photo) => photo.id));
    return locations.filter((location) => ids.has(location.photo_id)).map(({ lat, lng }) => ({ lat, lng }));
  }, [photos, locations]);

  if (loadState === "loading") {
    return (
      <p className="meta" role="status">
        Loading trip…
      </p>
    );
  }
  if (loadState === "missing" || loadState === "error" || !form || !saved) {
    return (
      <div>
        <h1 className="display text-4xl">
          {loadState === "missing" ? "Trip not found" : "Could not load this trip"}
        </h1>
        {notice && <p className="mt-3 text-danger">{notice.text}</p>}
        <Link href="/admin" className="btn mt-6">
          Back to trips
        </Link>
      </div>
    );
  }

  const set = <K extends keyof TripFields>(key: K, value: TripFields[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const shownSlug = slugFollowsTitle ? tripSlug(form.title, form.start_date) : form.slug;

  async function save(event?: FormEvent) {
    event?.preventDefault();
    if (!form) return;

    const title = form.title.trim();
    if (!title) {
      setNotice({ kind: "error", text: "Give the trip a title before saving." });
      document.getElementById("title")?.focus();
      return;
    }

    setSaving(true);
    setNotice(null);
    try {
      const slug = slugify(shownSlug) || tripSlug(title, form.start_date);
      const trip = await saveTrip(tripId, { ...form, title, slug, summary: form.summary.trim() });
      const fields = fieldsOf(trip);
      setForm(fields);
      setSaved(fields);
      if (fields.status === "published") setSlugFollowsTitle(false);

      await refreshPublicSite();
      setNotice({
        kind: "ok",
        text:
          fields.status === "published"
            ? "Saved. Live on the site now."
            : "Draft saved. Only you can see it.",
      });
    } catch (error) {
      setNotice({ kind: "error", text: describe(error) });
    } finally {
      setSaving(false);
    }
  }

  async function removeTrip() {
    setDeleting(true);
    try {
      await deleteTrip(tripId, photos);
      await refreshPublicSite().catch(() => {});
      router.push("/admin");
    } catch (error) {
      setNotice({ kind: "error", text: describe(error) });
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function applySuggestion(parts: { dates?: boolean; pin?: boolean; country?: boolean }) {
    if (!suggestion) return;
    const { found, placeId } = suggestion;
    setForm((current) => {
      if (!current) return current;
      const next = { ...current };
      if (parts.dates && found.startDate) {
        next.start_date = `${found.startDate.slice(0, 7)}-01`;
        next.date_precision = "month";
        if (found.endDate) {
          next.duration_days = Math.min(daysBetween(found.startDate, found.endDate), MAX_DURATION_DAYS);
        }
      }
      if (parts.country && found.countryCode && !next.country_codes.includes(found.countryCode)) {
        next.country_codes = [...next.country_codes, found.countryCode];
      }
      return next;
    });

    // A place's pin saves straight away, like everything in the Places section.
    const place = places.find((p) => p.id === placeId);
    const point = found.point;
    if (parts.pin && point && place && place.lat === null) {
      try {
        await updatePlace(place.id, { lat: point.lat, lng: point.lng });
        setPlaces((current) =>
          current.map((p) => (p.id === place.id ? { ...p, lat: point.lat, lng: point.lng } : p)),
        );
        refreshSoon();
      } catch (error) {
        setNotice({ kind: "error", text: describe(error) });
      }
    }
  }

  const saveLabel = saving
    ? "Saving…"
    : form.status === "published"
      ? saved.status === "published"
        ? "Save changes"
        : "Save and publish"
      : "Save draft";

  return (
    <>
      <form onSubmit={save} noValidate>
        <p className="meta">
          <Link href="/admin" className="hover:text-accent">
            Trips
          </Link>
          <span aria-hidden="true"> / </span>
          Edit
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="display text-4xl sm:text-6xl">{form.title || "New trip"}</h1>
          {saved.status === "published" && (
            <Link href={`/trips/${saved.slug}`} target="_blank" className="meta link pb-1.5">
              View on the site <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>

        {/* --- Details ----------------------------------------------------- */}
        <section aria-labelledby="details-heading" className="mt-10 border-t border-ink pt-6">
          <h2 id="details-heading" className="display text-3xl">
            Details
          </h2>

          <div className="mt-6 grid gap-x-8 gap-y-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <label htmlFor="title" className="label">
                Title{" "}
                <span className="normal-case tracking-normal text-muted">(the only required field)</span>
              </label>
              <input
                id="title"
                type="text"
                className="field text-lg"
                placeholder="e.g. Lisbon and the Algarve"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                autoComplete="off"
              />
            </div>

            <div>
              <label htmlFor="countries" className="label">
                Countries
              </label>
              <CountryPicker
                id="countries"
                value={form.country_codes}
                onChange={(codes) => set("country_codes", codes)}
              />
              <p className="hint">Type to search. Add as many as the trip covered.</p>
            </div>

            <div>
              <TripDatesField
                value={{ start_date: form.start_date, duration_days: form.duration_days }}
                onChange={(when) =>
                  setForm((current) => (current ? { ...current, ...when, date_precision: "month" } : current))
                }
              />
            </div>

            <div>
              <label htmlFor="tags" className="label">
                Tags
              </label>
              <ChipInput
                id="tags"
                value={form.tags}
                onChange={(tags) => set("tags", tags)}
                placeholder="food, hiking, road trip…"
                normalize={(tag) => tag.toLowerCase()}
                splitOnComma
                suggestions={knownTags}
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="summary" className="label">
                Short summary
              </label>
              <textarea
                id="summary"
                rows={2}
                maxLength={SUMMARY_MAX}
                className="field resize-y"
                placeholder="One or two sentences, shown under the title and in link previews."
                value={form.summary}
                onChange={(event) => set("summary", event.target.value)}
              />
              <p className="hint text-right">
                {form.summary.length} / {SUMMARY_MAX}
              </p>
            </div>

            <div className="lg:col-span-2">
              <p className="label" id="description-label">
                Description
              </p>
              <RichTextEditor
                initialValue={saved.description_html}
                onChange={(html) => set("description_html", html)}
                label="Description"
                placeholder="Write as much or as little as you like."
              />
            </div>

            <fieldset>
              <legend className="label">Visibility</legend>
              <div className="flex">
                {(["draft", "published"] as const).map((status) => (
                  <label
                    key={status}
                    className="meta flex min-h-11 cursor-pointer items-center border border-rule px-4 transition-colors first:rounded-l last:-ml-px last:rounded-r has-checked:relative has-checked:border-accent has-checked:bg-accent has-checked:text-on-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
                  >
                    <input
                      type="radio"
                      name="status"
                      className="sr-only"
                      checked={form.status === status}
                      onChange={() => set("status", status)}
                    />
                    {status === "draft" ? "Draft" : "Published"}
                  </label>
                ))}
              </div>
              <p className="hint">
                {form.status === "draft"
                  ? "Drafts appear only here in the admin."
                  : "Published trips appear on the public site as soon as you save."}
              </p>
            </fieldset>

            <div>
              <label htmlFor="slug" className="label">
                Web address
              </label>
              <div className="field flex items-center gap-1 py-0 pr-0">
                <span className="shrink-0 text-muted">/trips/</span>
                <input
                  id="slug"
                  type="text"
                  className="min-h-[2.6rem] w-full bg-transparent outline-none"
                  value={shownSlug}
                  onChange={(event) => {
                    setSlugFollowsTitle(false);
                    set("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));
                  }}
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
              <p className="hint">
                {slugFollowsTitle
                  ? "Follows the title until the trip is published."
                  : "Changing this breaks links to the trip that have already been shared."}
              </p>
            </div>
          </div>
        </section>

        {/* --- Save bar ------------------------------------------------------ */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-paper">
          <div className="shell flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2.5">
            <p
              role="status"
              className={notice?.kind === "error" ? "text-sm text-danger" : "text-sm text-soft"}
            >
              {notice?.text ?? (isDirty ? "Unsaved changes to the details." : "Details are saved.")}
            </p>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || (!isDirty && saved.title !== "")}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </form>

      {/* --- Places (outside the form: they save on their own) -------------- */}
      <section aria-labelledby="places-heading" className="mt-14 border-t border-ink pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="places-heading" className="display text-3xl">
            Places &amp; map pins
          </h2>
          <p className="meta">changes here save automatically</p>
        </div>
        <p className="hint max-w-2xl">
          The cities, towns and spots on this trip, in order. Give a place a pin to show it on the map, and
          choose whether a route line is drawn to it from home.
        </p>
        <div className="mt-6">
          <PlacesEditor
            tripId={tripId}
            places={places}
            setPlaces={setPlaces}
            countryCodes={form.country_codes}
            photoPoints={photoPoints}
            photoCounts={photoCounts}
            onSaved={refreshSoon}
            onError={showError}
            onPlaceDeleted={unassignPhotosOf}
          />
        </div>
      </section>

      {/* --- Photos (outside the form: they save on their own) -------------- */}
      <section aria-labelledby="photos-heading" className="mt-14 border-t border-ink pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="photos-heading" className="display text-3xl">
            Photos
          </h2>
          <p className="meta">
            {photos.length} {photos.length === 1 ? "photo" : "photos"} · changes here save automatically
          </p>
        </div>

        {suggestion && (
          <ExifSuggestion
            suggestion={suggestion.found}
            pinPlace={places.find((place) => place.id === suggestion.placeId && place.lat === null) ?? null}
            onApply={applySuggestion}
            onDismiss={() => setSuggestion(null)}
          />
        )}

        <div className="mt-6">
          <PhotoManager
            tripId={tripId}
            places={places}
            photos={photos}
            setPhotos={setPhotos}
            locations={locations}
            coverId={coverId}
            setCoverId={setCoverId}
            onLocationsAdded={addLocations}
            onSuggestion={offerSuggestion}
            onSaved={refreshSoon}
            onError={showError}
          />
        </div>
      </section>

      <section aria-labelledby="delete-heading" className="mt-20 border-t border-rule pt-6">
        <h2 id="delete-heading" className="meta meta-ink">
          Delete this trip
        </h2>
        <p className="hint max-w-xl">
          Removes the trip, its photos and their files for good. This cannot be undone.
        </p>
        <button type="button" className="btn btn-danger mt-4" onClick={() => setConfirmingDelete(true)}>
          Delete trip
        </button>
      </section>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this trip?"
        confirmLabel="Delete trip"
        busy={deleting}
        onConfirm={removeTrip}
        onCancel={() => setConfirmingDelete(false)}
      >
        <p>
          &ldquo;{saved.title || "Untitled trip"}&rdquo; and its {photos.length}{" "}
          {photos.length === 1 ? "photo" : "photos"} will be permanently removed.
        </p>
      </ConfirmDialog>
    </>
  );
}

interface ExifSuggestionProps {
  suggestion: TripSuggestion;
  /** The place the photos went to, if it has no pin yet (the pin can go there). */
  pinPlace: TripPlace | null;
  onApply: (parts: { dates?: boolean; pin?: boolean; country?: boolean }) => void;
  onDismiss: () => void;
}

/** Offers to fill the form from what the uploaded photos recorded. */
function ExifSuggestion({ suggestion, pinPlace, onApply, onDismiss }: ExifSuggestionProps) {
  const { startDate, endDate, countryCode } = suggestion;
  const point = pinPlace ? suggestion.point : null;
  const days = startDate && endDate ? daysBetween(startDate, endDate) : null;
  const dates = startDate
    ? [
        formatTripDates({ start_date: startDate, end_date: null, date_precision: "month" }),
        days && formatDays(days),
      ]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div
      role="region"
      aria-label="Suggestions from photo data"
      className="mt-6 rounded border border-accent bg-raised p-4 sm:p-5"
    >
      <p className="meta meta-ink">Found in your photos</p>
      <p className="mt-2 text-sm text-soft">
        {suggestion.withDate} of {suggestion.total} carry a date and {suggestion.withLocation} carry a
        location. Use them to fill in the details above? Details are saved when you press Save.
      </p>

      <ul className="mt-4 space-y-2.5">
        {dates && <SuggestionRow label="Dates" value={dates} onApply={() => onApply({ dates: true })} />}
        {point && (
          <SuggestionRow
            label={`Pin for ${pinPlace?.name}`}
            value={`${formatCoordinates(point, 1)} (rounded to about 10 km)`}
            onApply={() => onApply({ pin: true })}
          />
        )}
        {countryCode && (
          <SuggestionRow
            label="Country"
            value={countryName(countryCode)}
            onApply={() => onApply({ country: true })}
          />
        )}
      </ul>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            onApply({ dates: true, pin: true, country: true });
            onDismiss();
          }}
        >
          Use all
        </button>
        <button type="button" className="btn btn-sm btn-quiet" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <p className="hint">
        Exact photo locations are kept private and only shown to you, on the map above. The uploaded image
        files contain no location data.
      </p>
    </div>
  );
}

function SuggestionRow({ label, value, onApply }: { label: string; value: string; onApply: () => void }) {
  const [used, setUsed] = useState(false);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-rule pb-2.5">
      <span>
        <span className="meta mr-3">{label}</span>
        <span className="text-[0.9375rem]">{value}</span>
      </span>
      <button
        type="button"
        className="btn btn-sm"
        disabled={used}
        onClick={() => {
          onApply();
          setUsed(true);
        }}
      >
        {used ? "Filled in" : "Use"}
      </button>
    </li>
  );
}

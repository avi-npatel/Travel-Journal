"use client";

import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type { Dispatch, DragEvent, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  deletePhoto,
  insertPhoto,
  movePhotos,
  savePhotoOrder,
  setCoverPhoto,
  updateCaption,
} from "@/lib/admin/api";
import { readExif, suggestFromExif, type PhotoExif, type TripSuggestion } from "@/lib/admin/exif";
import { runPool } from "@/lib/admin/pool";
import { processImage } from "@/lib/admin/process-image";
import { removePhotoFiles, uploadPhotoFiles } from "@/lib/admin/upload";
import { cn } from "@/lib/cn";
import { distanceKm, pinnedPlaces } from "@/lib/geo";
import { findCountryAt } from "@/lib/map/country-map";
import type { Photo, PhotoLocation, TripPlace } from "@/lib/types";
import { PhotoTile } from "./PhotoTile";

interface PhotoManagerProps {
  tripId: string;
  places: TripPlace[];
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  /** Private GPS positions of this trip's photos (from EXIF). */
  locations: PhotoLocation[];
  coverId: string | null;
  setCoverId: (id: string | null) => void;
  /** Called with the private GPS positions of newly uploaded photos. */
  onLocationsAdded: (locations: PhotoLocation[]) => void;
  /** Called when a dropped batch carries dates or locations worth offering. */
  onSuggestion: (suggestion: TripSuggestion, placeId: string | null) => void;
  /** Called after anything is saved, so the public site can be refreshed. */
  onSaved: () => void;
  onError: (message: string) => void;
}

type UploadStatus = "waiting" | "preparing" | "uploading" | "saving" | "failed";

interface UploadItem {
  key: string;
  file: File;
  exif: PhotoExif;
  placeId: string | null;
  sortOrder: number;
  status: UploadStatus;
  /** 0–1 while uploading. */
  progress: number;
  error?: string;
}

/** The group key for photos that belong to no place. */
const UNASSIGNED = "unassigned";
const groupOf = (photo: Pick<Photo, "place_id">) => photo.place_id ?? UNASSIGNED;
const placeIdOf = (group: string) => (group === UNASSIGNED ? null : group);

/** How many photos are resized and uploaded at the same time. */
const PARALLEL_UPLOADS = 3;

/** "Sort by location" assigns a photo to the nearest pinned place within this distance. */
const MATCH_RADIUS_KM = 100;

const REORDER_INSTRUCTIONS =
  "To reorder, press space or enter to pick the photo up, use the arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.";

const STATUS_LABEL: Record<UploadStatus, string> = {
  waiting: "Waiting",
  preparing: "Resizing",
  uploading: "Uploading",
  saving: "Saving",
  failed: "Failed",
};

const isImage = (file: File) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

const byOrder = (a: Photo, b: Photo) => a.sort_order - b.sort_order;

/** Oldest first when every photo has a date; otherwise by file name. */
function inShootingOrder(entries: { file: File; exif: PhotoExif }[]) {
  const allDated = entries.every((entry) => entry.exif.takenAt);
  return [...entries].sort((a, b) =>
    allDated
      ? a.exif.takenAt!.getTime() - b.exif.takenAt!.getTime()
      : a.file.name.localeCompare(b.file.name, undefined, { numeric: true }),
  );
}

/**
 * A trip's photos, sorted into its places. Pick a place, then drop photos to
 * upload them there (each is resized in the browser first). Photos can be
 * reordered within a place, moved to another place, captioned, made the
 * cover, or deleted. Every change is saved as it is made.
 */
export function PhotoManager({
  tripId,
  places,
  photos,
  setPhotos,
  locations,
  coverId,
  setCoverId,
  onLocationsAdded,
  onSuggestion,
  onSaved,
  onError,
}: PhotoManagerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<UploadItem[]>([]);
  const [finishedCount, setFinishedCount] = useState(0);
  /** Batches still uploading; the done-counter resets when this returns to 0. */
  const runningBatches = useRef(0);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [matchReport, setMatchReport] = useState<string | null>(null);

  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const photo of photos) result.set(groupOf(photo), (result.get(groupOf(photo)) ?? 0) + 1);
    return result;
  }, [photos]);
  const unassignedCount = counts.get(UNASSIGNED) ?? 0;

  // Which place's photos are on screen. Unassigned photos come first when
  // there are any, since those are the ones waiting to be sorted.
  const [group, setGroup] = useState<string>(() =>
    unassignedCount > 0 || places.length === 0 ? UNASSIGNED : places[0].id,
  );
  // If the shown place is deleted, fall back to the unassigned photos.
  const groupExists = group === UNASSIGNED || places.some((place) => place.id === group);
  const activeGroup = groupExists ? group : UNASSIGNED;

  const groupPhotos = useMemo(
    () => photos.filter((photo) => groupOf(photo) === activeGroup).sort(byOrder),
    [photos, activeGroup],
  );
  const activePlace = places.find((place) => place.id === activeGroup) ?? null;
  const groupLabel = activePlace?.name ?? (places.length === 0 ? "this trip" : "not assigned to a place");

  // Uploads finish at unpredictable times, long after the render that started
  // them, so they read the current photos and cover through refs.
  const photosRef = useRef(photos);
  const coverRef = useRef(coverId);
  useEffect(() => {
    photosRef.current = photos;
    coverRef.current = coverId;
  }, [photos, coverId]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold to drag on touch screens, so swiping still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function showGroup(next: string) {
    setGroup(next);
    setSelected(new Set());
    setMatchReport(null);
  }

  /** The next free position at the end of a group (counting queued uploads). */
  function nextOrderIn(targetGroup: string, current = photosRef.current) {
    const orders = [
      ...current.filter((photo) => groupOf(photo) === targetGroup).map((photo) => photo.sort_order),
      ...queue.filter((item) => (item.placeId ?? UNASSIGNED) === targetGroup).map((item) => item.sortOrder),
    ];
    return Math.max(-1, ...orders) + 1;
  }

  const patchItem = (key: string, changes: Partial<UploadItem>) =>
    setQueue((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));

  // --- Uploading -----------------------------------------------------------

  async function uploadOne(item: UploadItem) {
    const photoId = crypto.randomUUID();
    const storagePath = `${tripId}/${photoId}`;
    let uploaded: Pick<Photo, "storage_path" | "format"> | null = null;

    try {
      patchItem(item.key, { status: "preparing", error: undefined });
      const image = await processImage(item.file);

      patchItem(item.key, { status: "uploading", progress: 0 });
      uploaded = { storage_path: storagePath, format: image.format };
      await uploadPhotoFiles(storagePath, image, (progress) => patchItem(item.key, { progress }));

      patchItem(item.key, { status: "saving", progress: 1 });
      const photo = await insertPhoto(
        {
          id: photoId,
          trip_id: tripId,
          place_id: item.placeId,
          storage_path: storagePath,
          format: image.format,
          width: image.width,
          height: image.height,
          sort_order: item.sortOrder,
          blur_data_url: image.blurDataUrl,
          taken_at: item.exif.takenAt?.toISOString() ?? null,
        },
        item.exif.location,
      );

      setPhotos((current) => [...current, photo]);
      if (item.exif.location) onLocationsAdded([{ photo_id: photo.id, ...item.exif.location }]);
      setQueue((items) => items.filter((queued) => queued.key !== item.key));
      setFinishedCount((count) => count + 1);
    } catch (error) {
      // Do not leave files in storage that no photo row points to.
      if (uploaded) await removePhotoFiles([uploaded]).catch(() => {});
      patchItem(item.key, { status: "failed", error: message(error) });
    }
  }

  async function runUploads(items: UploadItem[]) {
    runningBatches.current += 1;
    await runPool(items, PARALLEL_UPLOADS, uploadOne);
    runningBatches.current -= 1;
    if (runningBatches.current === 0) setFinishedCount(0);

    // A trip's first photo becomes its cover until another is chosen.
    const first = photosRef.current[0];
    if (!coverRef.current && first) {
      try {
        await setCoverPhoto(tripId, first.id);
        setCoverId(first.id);
      } catch (error) {
        onError(message(error));
      }
    }
    onSaved();
  }

  async function addFiles(fileList: FileList | File[]) {
    const files = [...fileList].filter(isImage);
    if (files.length === 0) return;
    const placeId = placeIdOf(activeGroup);

    // Read dates and positions first: it is quick, and re-encoding the photos
    // (next step) strips that information for good.
    const entries = inShootingOrder(
      await Promise.all(files.map(async (file) => ({ file, exif: await readExif(file) }))),
    );

    const firstOrder = nextOrderIn(activeGroup);
    const items: UploadItem[] = entries.map((entry, index) => ({
      ...entry,
      key: crypto.randomUUID(),
      placeId,
      sortOrder: firstOrder + index,
      status: "waiting",
      progress: 0,
    }));
    setQueue((current) => [...current, ...items]);

    const exifs = entries.map((entry) => entry.exif);
    if (exifs.some((exif) => exif.takenAt || exif.location)) {
      suggestFromExif(exifs, findCountryAt).then((suggestion) => onSuggestion(suggestion, placeId));
    }

    await runUploads(items);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setIsDraggingOver(false);
    addFiles(event.dataTransfer.files);
  }

  const retry = (item: UploadItem) => runUploads([item]);
  const dismiss = (key: string) => setQueue((items) => items.filter((item) => item.key !== key));

  // --- Editing existing photos ---------------------------------------------

  async function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = groupPhotos.findIndex((photo) => photo.id === active.id);
    const to = groupPhotos.findIndex((photo) => photo.id === over.id);
    const reordered = arrayMove(groupPhotos, from, to);
    const newOrder = new Map(reordered.map((photo, index) => [photo.id, index]));

    const before = photos;
    // Show the new order at once, then save it.
    setPhotos((current) =>
      current.map((photo) =>
        newOrder.has(photo.id) ? { ...photo, sort_order: newOrder.get(photo.id)! } : photo,
      ),
    );
    try {
      await savePhotoOrder(reordered.map((photo) => photo.id));
      onSaved();
    } catch (error) {
      setPhotos(before);
      onError(message(error));
    }
  }

  /** Moves photos to the end of another place (or to unassigned). */
  async function moveTo(photoIds: string[], targetGroup: string) {
    const ids = photoIds.filter((id) =>
      photos.find((photo) => photo.id === id && groupOf(photo) !== targetGroup),
    );
    if (ids.length === 0) return;
    const firstOrder = nextOrderIn(targetGroup, photos);
    const placeId = placeIdOf(targetGroup);
    const moved = new Map(ids.map((id, index) => [id, firstOrder + index]));

    const before = photos;
    setPhotos((current) =>
      current.map((photo) =>
        moved.has(photo.id) ? { ...photo, place_id: placeId, sort_order: moved.get(photo.id)! } : photo,
      ),
    );
    setSelected(new Set());
    try {
      await movePhotos(ids, placeId, firstOrder);
      onSaved();
    } catch (error) {
      setPhotos(before);
      onError(message(error));
    }
  }

  /**
   * Puts each unassigned photo that has a GPS position into the nearest
   * pinned place, if one is within MATCH_RADIUS_KM.
   */
  async function sortByLocation() {
    const pins = pinnedPlaces({ places });
    const positions = new Map(locations.map((location) => [location.photo_id, location]));
    const plan = new Map<string, string[]>();

    for (const photo of groupPhotos) {
      const position = positions.get(photo.id);
      if (!position) continue;
      let best: { id: string; km: number } | null = null;
      for (const pin of pins) {
        const km = distanceKm(position, pin);
        if (km <= MATCH_RADIUS_KM && (!best || km < best.km)) best = { id: pin.id, km };
      }
      if (best) plan.set(best.id, [...(plan.get(best.id) ?? []), photo.id]);
    }

    let moved = 0;
    let current = photos;
    for (const [placeId, ids] of plan) {
      const firstOrder = nextOrderIn(placeId, current);
      try {
        await movePhotos(ids, placeId, firstOrder);
      } catch (error) {
        onError(message(error));
        break;
      }
      const order = new Map(ids.map((id, index) => [id, firstOrder + index]));
      current = current.map((photo) =>
        order.has(photo.id) ? { ...photo, place_id: placeId, sort_order: order.get(photo.id)! } : photo,
      );
      moved += ids.length;
    }
    setPhotos(current);
    setMatchReport(
      moved === 0
        ? `No photo was taken within ${MATCH_RADIUS_KM} km of a pinned place.`
        : `Moved ${moved} ${moved === 1 ? "photo" : "photos"} to the nearest place.`,
    );
    if (moved > 0) onSaved();
  }

  async function saveCaption(photo: Photo, caption: string) {
    try {
      await updateCaption(photo.id, caption);
      setPhotos((current) => current.map((p) => (p.id === photo.id ? { ...p, caption } : p)));
      onSaved();
    } catch (error) {
      onError(message(error));
    }
  }

  async function makeCover(photo: Photo) {
    try {
      await setCoverPhoto(tripId, photo.id);
      setCoverId(photo.id);
      onSaved();
    } catch (error) {
      onError(message(error));
    }
  }

  async function remove(photo: Photo) {
    try {
      await deletePhoto(photo);
      const remaining = photos.filter((p) => p.id !== photo.id);
      setPhotos(remaining);
      // If the cover was deleted, the first photo left takes over.
      if (coverId === photo.id) {
        const nextCover = remaining[0]?.id ?? null;
        await setCoverPhoto(tripId, nextCover);
        setCoverId(nextCover);
      }
      onSaved();
    } catch (error) {
      onError(message(error));
    }
  }

  function toggleSelected(photoId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  // What a screen reader says during a keyboard reorder. (The defaults read
  // out raw database ids.)
  const positionOf = (id: UniqueIdentifier | undefined) =>
    groupPhotos.findIndex((photo) => photo.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up photo ${positionOf(active.id)} of ${groupPhotos.length}.`,
    onDragOver: ({ over }) =>
      over ? `Now at position ${positionOf(over.id)} of ${groupPhotos.length}.` : undefined,
    onDragEnd: ({ over }) => (over ? `Dropped at position ${positionOf(over.id)}.` : "Dropped."),
    onDragCancel: () => "Reordering cancelled.",
  };

  // --- Render --------------------------------------------------------------

  const activeUploads = queue.filter((item) => item.status !== "failed");
  const batchTotal = finishedCount + queue.length;
  const moveOptions = [
    ...places.map((place) => ({ value: place.id, label: place.name })),
    { value: UNASSIGNED, label: "Not assigned" },
  ];
  const canSortByLocation =
    activeGroup === UNASSIGNED &&
    pinnedPlaces({ places }).length > 0 &&
    groupPhotos.some((photo) => locations.some((location) => location.photo_id === photo.id));
  const allSelected = groupPhotos.length > 0 && groupPhotos.every((photo) => selected.has(photo.id));

  return (
    <div>
      {places.length > 0 && (
        <div role="group" aria-label="Show photos for" className="mb-5 flex flex-wrap gap-2">
          {places.map((place) => (
            <GroupButton
              key={place.id}
              label={place.name}
              count={counts.get(place.id) ?? 0}
              pressed={activeGroup === place.id}
              onClick={() => showGroup(place.id)}
            />
          ))}
          {(unassignedCount > 0 || activeGroup === UNASSIGNED) && (
            <GroupButton
              label="Not assigned"
              count={unassignedCount}
              pressed={activeGroup === UNASSIGNED}
              onClick={() => showGroup(UNASSIGNED)}
              subtle
            />
          )}
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={cn(
          "grid place-items-center rounded border border-dashed px-6 py-9 text-center transition-colors",
          isDraggingOver ? "border-accent bg-raised" : "border-muted",
        )}
      >
        <div>
          <p className="display text-2xl sm:text-3xl">
            {activePlace ? (
              <>
                Drop photos from <em>{activePlace.name}</em>
              </>
            ) : (
              "Drop photos here"
            )}
          </p>
          <p className="hint mx-auto max-w-md">
            {activePlace
              ? "They are added to this place. "
              : places.length > 0
                ? "They are added without a place; pick a place above to upload straight to it. "
                : ""}
            As many as you like at once. Each is resized to 2400px and stripped of location data in your
            browser before it is uploaded.
          </p>
          <button type="button" className="btn mt-5" onClick={() => fileInputRef.current?.click()}>
            Choose photos
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="sr-only"
            tabIndex={-1}
            aria-label={`Choose photos to upload to ${groupLabel}`}
            onChange={(event) => {
              if (event.target.files) addFiles(event.target.files);
              event.target.value = ""; // allow choosing the same file again
            }}
          />
        </div>
      </div>

      {queue.length > 0 && (
        <section aria-label="Uploads" className="mt-6">
          <p className="meta meta-ink" role="status">
            {activeUploads.length > 0
              ? `Uploading: ${finishedCount} of ${batchTotal} done`
              : `${queue.length} ${queue.length === 1 ? "upload" : "uploads"} failed`}
          </p>
          {/* Scrolls inside its own box, so a big batch does not push the page around. */}
          <ul className="mt-3 max-h-80 divide-y divide-rule overflow-y-auto border-y border-rule pr-2">
            {queue.map((item) => (
              <li
                key={item.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 py-2.5"
              >
                <span className="truncate text-sm">
                  {item.file.name}
                  <span className="meta ml-2">
                    → {places.find((place) => place.id === item.placeId)?.name ?? "not assigned"}
                  </span>
                </span>
                <span className={cn("meta", item.status === "failed" && "text-danger")}>
                  {STATUS_LABEL[item.status]}
                  {item.status === "uploading" && ` ${Math.round(item.progress * 100)}%`}
                </span>

                {item.status === "failed" ? (
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-danger">{item.error}</p>
                    <span className="flex gap-2">
                      <button type="button" className="btn btn-sm" onClick={() => retry(item)}>
                        Retry
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => dismiss(item.key)}
                      >
                        Dismiss
                      </button>
                    </span>
                  </div>
                ) : (
                  <div
                    role="progressbar"
                    aria-label={`Upload progress for ${item.file.name}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(item.progress * 100)}
                    className="col-span-2 h-1 overflow-hidden rounded-full bg-sunk"
                  >
                    <div
                      className={cn(
                        "h-full bg-accent transition-[width] duration-150",
                        item.status === "preparing" && "animate-pulse",
                      )}
                      style={{
                        width: `${item.status === "preparing" ? 6 : item.progress * 100}%`,
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {groupPhotos.length === 0 ? (
        <p className="mt-6 text-sm text-soft">
          {activePlace ? `No photos from ${activePlace.name} yet.` : "No photos here."}
        </p>
      ) : (
        <>
          <div className="mt-8 flex min-h-10 flex-wrap items-center gap-x-4 gap-y-2 border-y border-rule py-2">
            <label className="meta meta-ink flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-[var(--accent)]"
                checked={allSelected}
                onChange={() =>
                  setSelected(allSelected ? new Set() : new Set(groupPhotos.map((photo) => photo.id)))
                }
              />
              Select all
            </label>
            {selected.size > 0 && places.length > 0 && (
              <label className="flex items-center gap-2">
                <span className="meta meta-ink">Move {selected.size} to</span>
                <select
                  className="field min-h-8 w-auto py-1 text-sm"
                  value=""
                  onChange={(event) => event.target.value && moveTo([...selected], event.target.value)}
                >
                  <option value="">Choose a place…</option>
                  {moveOptions
                    .filter((option) => option.value !== activeGroup)
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {canSortByLocation && (
              <button type="button" className="btn btn-sm ml-auto" onClick={sortByLocation}>
                Sort by location
              </button>
            )}
          </div>
          {matchReport && (
            <p role="status" className="hint">
              {matchReport}
            </p>
          )}
          {canSortByLocation && !matchReport && (
            <p className="hint">
              &ldquo;Sort by location&rdquo; moves each photo that recorded a GPS position into the pinned
              place it was taken nearest to (within {MATCH_RADIUS_KM} km).
            </p>
          )}

          <p className="hint mt-4">
            Drag a photo to change the order (or focus its handle and use the arrow keys).
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements, screenReaderInstructions: { draggable: REORDER_INSTRUCTIONS } }}
          >
            <SortableContext items={groupPhotos.map((photo) => photo.id)} strategy={rectSortingStrategy}>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {groupPhotos.map((photo, index) => (
                  <PhotoTile
                    key={photo.id}
                    photo={photo}
                    position={index + 1}
                    isCover={photo.id === coverId}
                    isSelected={selected.has(photo.id)}
                    moveOptions={places.length > 0 ? moveOptions : []}
                    currentGroup={activeGroup}
                    onToggleSelected={() => toggleSelected(photo.id)}
                    onMoveTo={(target) => moveTo([photo.id], target)}
                    onCaptionSave={(caption) => saveCaption(photo, caption)}
                    onMakeCover={() => makeCover(photo)}
                    onDelete={() => remove(photo)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}
    </div>
  );
}

interface GroupButtonProps {
  label: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
  subtle?: boolean;
}

function GroupButton({ label, count, pressed, onClick, subtle }: GroupButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn("tag gap-2 normal-case tracking-normal", subtle && !pressed && "border-dashed")}
    >
      <span className="font-sans text-sm">{label}</span>
      <span className="font-mono text-[0.6875rem] opacity-70">{count}</span>
    </button>
  );
}

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
import { useEffect, useRef, useState } from "react";
import { deletePhoto, insertPhoto, savePhotoOrder, setCoverPhoto, updateCaption } from "@/lib/admin/api";
import { readExif, suggestFromExif, type PhotoExif, type TripSuggestion } from "@/lib/admin/exif";
import { runPool } from "@/lib/admin/pool";
import { processImage } from "@/lib/admin/process-image";
import { removePhotoFiles, uploadPhotoFiles } from "@/lib/admin/upload";
import { cn } from "@/lib/cn";
import { findCountryAt } from "@/lib/map/country-map";
import type { Photo, PhotoLocation } from "@/lib/types";
import { PhotoTile } from "./PhotoTile";

interface PhotoManagerProps {
  tripId: string;
  photos: Photo[];
  setPhotos: Dispatch<SetStateAction<Photo[]>>;
  coverId: string | null;
  setCoverId: (id: string | null) => void;
  /** Called with the private GPS positions of newly uploaded photos. */
  onLocationsAdded: (locations: PhotoLocation[]) => void;
  /** Called when a dropped batch carries dates or locations worth offering. */
  onSuggestion: (suggestion: TripSuggestion) => void;
  /** Called after anything is saved, so the public site can be refreshed. */
  onSaved: () => void;
  onError: (message: string) => void;
}

type UploadStatus = "waiting" | "preparing" | "uploading" | "saving" | "failed";

interface UploadItem {
  key: string;
  file: File;
  exif: PhotoExif;
  sortOrder: number;
  status: UploadStatus;
  /** 0–1 while uploading. */
  progress: number;
  error?: string;
}

/** How many photos are resized and uploaded at the same time. */
const PARALLEL_UPLOADS = 3;

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
 * A trip's photos: drop files to upload them (resized in the browser first),
 * drag to reorder, caption, choose the cover, delete. Every change is saved
 * as it is made; there is no separate save step for photos.
 */
export function PhotoManager({
  tripId,
  photos,
  setPhotos,
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

      setPhotos((current) => [...current, photo].sort((a, b) => a.sort_order - b.sort_order));
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

    // Read dates and positions first: it is quick, and re-encoding the photos
    // (next step) strips that information for good.
    const entries = inShootingOrder(
      await Promise.all(files.map(async (file) => ({ file, exif: await readExif(file) }))),
    );

    const firstOrder =
      Math.max(-1, ...photosRef.current.map((p) => p.sort_order), ...queue.map((q) => q.sortOrder)) + 1;
    const items: UploadItem[] = entries.map((entry, index) => ({
      ...entry,
      key: crypto.randomUUID(),
      sortOrder: firstOrder + index,
      status: "waiting",
      progress: 0,
    }));
    setQueue((current) => [...current, ...items]);

    const exifs = entries.map((entry) => entry.exif);
    if (exifs.some((exif) => exif.takenAt || exif.location)) {
      suggestFromExif(exifs, findCountryAt).then(onSuggestion);
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
    const from = photos.findIndex((photo) => photo.id === active.id);
    const to = photos.findIndex((photo) => photo.id === over.id);
    const reordered = arrayMove(photos, from, to).map((photo, index) => ({ ...photo, sort_order: index }));

    setPhotos(reordered); // show the new order at once, then save it
    try {
      await savePhotoOrder(reordered.map((photo) => photo.id));
      onSaved();
    } catch (error) {
      setPhotos(photos);
      onError(message(error));
    }
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

  // What a screen reader says during a keyboard reorder. (The defaults read
  // out raw database ids.)
  const placeOf = (id: UniqueIdentifier | undefined) => photos.findIndex((photo) => photo.id === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up photo ${placeOf(active.id)} of ${photos.length}.`,
    onDragOver: ({ over }) => (over ? `Now at position ${placeOf(over.id)} of ${photos.length}.` : undefined),
    onDragEnd: ({ over }) => (over ? `Dropped at position ${placeOf(over.id)}.` : "Dropped."),
    onDragCancel: () => "Reordering cancelled.",
  };

  // --- Render --------------------------------------------------------------

  const activeUploads = queue.filter((item) => item.status !== "failed");
  const batchTotal = finishedCount + queue.length;

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
        className={cn(
          "grid place-items-center rounded border border-dashed px-6 py-10 text-center transition-colors",
          isDraggingOver ? "border-accent bg-raised" : "border-muted",
        )}
      >
        <div>
          <p className="display text-2xl sm:text-3xl">Drop photos here</p>
          <p className="hint mx-auto max-w-md">
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
            aria-label="Choose photos to upload"
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
                <span className="truncate text-sm">{item.file.name}</span>
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

      {photos.length > 0 && (
        <>
          <p className="hint mt-8">
            Drag a photo to change the order (or focus its handle and use the arrow keys). The order here is
            the order in the gallery.
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            accessibility={{ announcements, screenReaderInstructions: { draggable: REORDER_INSTRUCTIONS } }}
          >
            <SortableContext items={photos.map((photo) => photo.id)} strategy={rectSortingStrategy}>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {photos.map((photo, index) => (
                  <PhotoTile
                    key={photo.id}
                    photo={photo}
                    position={index + 1}
                    isCover={photo.id === coverId}
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

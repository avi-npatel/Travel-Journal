"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { Photo } from "@/components/site/Photo";
import { cn } from "@/lib/cn";
import type { Photo as PhotoRow } from "@/lib/types";

interface PhotoTileProps {
  photo: PhotoRow;
  /** 1-based place in its group. */
  position: number;
  isCover: boolean;
  isSelected: boolean;
  /** Where the photo can be moved to; empty when the trip has no places. */
  moveOptions: { value: string; label: string }[];
  /** The group the photo is in now (a place id, or the unassigned key). */
  currentGroup: string;
  onToggleSelected: () => void;
  onMoveTo: (group: string) => void;
  onCaptionSave: (caption: string) => void;
  onMakeCover: () => void;
  onDelete: () => void;
}

/** One photo in the admin grid: drag handle, select, caption, place, cover and delete. */
export function PhotoTile({
  photo,
  position,
  isCover,
  isSelected,
  moveOptions,
  currentGroup,
  onToggleSelected,
  onMoveTo,
  onCaptionSave,
  onMakeCover,
  onDelete,
}: PhotoTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });
  const [caption, setCaption] = useState(photo.caption);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const captionId = `caption-${photo.id}`;
  const placeId = `place-${photo.id}`;

  function commitCaption() {
    const trimmed = caption.trim();
    if (trimmed !== photo.caption) onCaptionSave(trimmed);
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-80")}
    >
      <div className="relative">
        {/* The picture is the drag handle. */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Photo ${position}${photo.caption ? `, ${photo.caption}` : ""}. Drag to reorder.`}
          className={cn(
            "relative block aspect-[4/3] w-full cursor-grab touch-manipulation overflow-hidden rounded-sm bg-sunk active:cursor-grabbing",
            isCover && "outline outline-2 outline-offset-2 outline-accent",
            isSelected && "ring-2 ring-ink ring-offset-2 ring-offset-paper",
          )}
        >
          <Photo
            photo={photo}
            alt=""
            sizes="(min-width: 1280px) 18vw, (min-width: 640px) 30vw, 46vw"
            fill
            className="pointer-events-none object-cover"
          />
          <span className="meta absolute bottom-1.5 left-1.5 rounded-sm bg-paper/90 px-1.5 py-0.5 text-ink">
            {String(position).padStart(2, "0")}
          </span>
          {isCover && (
            <span className="meta absolute right-1.5 top-1.5 rounded-sm bg-accent px-1.5 py-0.5 text-on-accent">
              Cover
            </span>
          )}
        </button>
        {/* Selection checkbox sits over the corner, outside the drag handle. */}
        <label className="absolute left-1.5 top-1.5 grid size-7 cursor-pointer place-items-center rounded-sm bg-paper/90">
          <input
            type="checkbox"
            className="size-4 accent-[var(--accent)]"
            checked={isSelected}
            onChange={onToggleSelected}
            aria-label={`Select photo ${position}`}
          />
        </label>
      </div>

      <label htmlFor={captionId} className="sr-only">
        Caption for photo {position}
      </label>
      <input
        id={captionId}
        type="text"
        className="field mt-2 min-h-9 px-2 py-1 text-sm"
        placeholder="Caption (optional)"
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        onBlur={commitCaption}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault(); // save the caption, not the whole form
            event.currentTarget.blur();
          }
        }}
      />

      {moveOptions.length > 0 && (
        <>
          <label htmlFor={placeId} className="sr-only">
            Place for photo {position}
          </label>
          <select
            id={placeId}
            className="field mt-1.5 min-h-8 px-2 py-1 text-xs"
            value={currentGroup}
            onChange={(event) => onMoveTo(event.target.value)}
          >
            {moveOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="mt-1.5 flex min-h-8 items-center justify-between gap-2">
        {confirmingDelete ? (
          <>
            <span className="meta text-danger">Delete?</span>
            <span className="flex gap-1.5">
              <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
                Delete
              </button>
              <button
                type="button"
                className="btn btn-sm btn-quiet"
                onClick={() => setConfirmingDelete(false)}
              >
                Keep
              </button>
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="meta meta-ink hover:text-accent disabled:text-muted disabled:hover:text-muted"
              onClick={onMakeCover}
              disabled={isCover}
            >
              {isCover ? "Is the cover" : "Make cover"}
            </button>
            <button
              type="button"
              className="meta hover:text-danger"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Delete photo ${position}`}
            >
              Delete
            </button>
          </>
        )}
      </div>
    </li>
  );
}

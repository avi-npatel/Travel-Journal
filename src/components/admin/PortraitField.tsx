"use client";

import { useRef, useState } from "react";
import { refreshPublicSite } from "@/app/admin/actions";
import { Photo } from "@/components/site/Photo";
import { savePortrait } from "@/lib/admin/api";
import { processImage } from "@/lib/admin/process-image";
import { removePhotoFiles, uploadPhotoFiles } from "@/lib/admin/upload";
import type { StoredImage } from "@/lib/types";

interface PortraitFieldProps {
  portrait: StoredImage | null;
  onChange: (portrait: StoredImage | null) => void;
  onError: (message: string) => void;
}

const describe = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong.");

/**
 * The photo shown on the About page, under "Home base". Uploading or removing
 * it takes effect straight away (the alt text is saved with the rest of the
 * settings). The previous file is deleted once the new one is in place.
 */
export function PortraitField({ portrait, onChange, onError }: PortraitFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  async function upload(file: File) {
    const storagePath = `site/portrait-${crypto.randomUUID()}`;
    let uploaded: StoredImage | null = null;
    setProgress(0);
    try {
      const image = await processImage(file);
      const next: StoredImage = {
        storage_path: storagePath,
        format: image.format,
        width: image.width,
        height: image.height,
        blur_data_url: image.blurDataUrl,
      };
      await uploadPhotoFiles(storagePath, image, setProgress);
      uploaded = next;
      await savePortrait(next);
      const previous = portrait;
      onChange(next);
      if (previous) await removePhotoFiles([previous]).catch(() => {});
      await refreshPublicSite();
    } catch (error) {
      // Do not leave a file behind that the settings do not point to.
      if (uploaded) await removePhotoFiles([uploaded]).catch(() => {});
      onError(describe(error));
    } finally {
      setProgress(null);
    }
  }

  async function remove() {
    if (!portrait) return;
    try {
      await savePortrait(null);
      await removePhotoFiles([portrait]).catch(() => {});
      onChange(null);
      await refreshPublicSite();
    } catch (error) {
      onError(describe(error));
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="relative w-44 overflow-hidden rounded-sm border border-rule bg-sunk">
        {portrait ? (
          <Photo photo={portrait} alt="Current portrait" sizes="176px" className="h-auto w-full" />
        ) : (
          <div className="meta grid aspect-[4/5] place-items-center">No photo</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            disabled={progress !== null}
            onClick={() => inputRef.current?.click()}
          >
            {progress !== null
              ? `Uploading ${Math.round(progress * 100)}%`
              : portrait
                ? "Replace photo"
                : "Upload photo"}
          </button>
          {portrait && progress === null && (
            <button type="button" className="btn btn-quiet" onClick={remove}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose a portrait photo"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
            event.target.value = "";
          }}
        />
        <p className="hint">
          Shown on the About page under your home base. It updates as soon as it finishes uploading; location
          data is removed first, like trip photos.
        </p>
      </div>
    </div>
  );
}

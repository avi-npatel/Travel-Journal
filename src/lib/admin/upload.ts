// Uploads to Supabase Storage with progress.
//
// supabase-js uploads with fetch(), which cannot report how much has been
// sent. XMLHttpRequest can, so uploads go straight to the Storage REST
// endpoint with the signed-in admin's access token.

import { PHOTO_BUCKET, variantPath, type Variant } from "../images";
import { getBrowserClient } from "../supabase/browser";
import { supabaseEnv } from "../supabase/env";
import type { Photo } from "../types";
import { mimeType, type ProcessedImage } from "./process-image";

/** The files never change once uploaded, so browsers may keep them a year. */
const CACHE_SECONDS = 60 * 60 * 24 * 365;

const UPLOAD_ORDER: Variant[] = ["thumb", "md", "full"];

function putFile(path: string, blob: Blob, token: string, onProgress: (sentBytes: number) => void) {
  const { url, key } = supabaseEnv();

  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${url}/storage/v1/object/${PHOTO_BUCKET}/${path}`);
    request.setRequestHeader("Authorization", `Bearer ${token}`);
    request.setRequestHeader("apikey", key);
    request.setRequestHeader("Content-Type", blob.type);
    request.setRequestHeader("Cache-Control", `max-age=${CACHE_SECONDS}`);
    request.setRequestHeader("x-upsert", "false");

    request.upload.onprogress = (event) => onProgress(event.loaded);
    request.onerror = () => reject(new Error("Upload failed. Check your connection."));
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) return resolve();
      let reason = `Upload failed (${request.status}).`;
      try {
        reason = JSON.parse(request.responseText).message ?? reason;
      } catch {
        // response was not JSON; keep the generic reason
      }
      reject(new Error(reason));
    };
    request.send(blob);
  });
}

/**
 * Uploads all three sizes of one photo. `onProgress` receives a number from
 * 0 to 1 covering the three files together.
 */
export async function uploadPhotoFiles(
  storagePath: string,
  image: ProcessedImage,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const {
    data: { session },
  } = await getBrowserClient().auth.getSession();
  if (!session) throw new Error("You are signed out. Sign in again and retry.");

  const stored = { storage_path: storagePath, format: image.format };
  const totalBytes = UPLOAD_ORDER.reduce((sum, variant) => sum + image.files[variant].size, 0);
  let finishedBytes = 0;

  for (const variant of UPLOAD_ORDER) {
    const blob = image.files[variant];
    const typed = blob.type ? blob : new Blob([blob], { type: mimeType(image.format) });
    await putFile(variantPath(stored, variant), typed, session.access_token, (sent) =>
      onProgress(Math.min(1, (finishedBytes + sent) / totalBytes)),
    );
    finishedBytes += blob.size;
  }
  onProgress(1);
}

/** Removes every stored size of the given photos. */
export async function removePhotoFiles(photos: Pick<Photo, "storage_path" | "format">[]): Promise<void> {
  if (photos.length === 0) return;
  const paths = photos.flatMap((photo) => UPLOAD_ORDER.map((variant) => variantPath(photo, variant)));
  const { error } = await getBrowserClient().storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw new Error(`Could not delete the image files: ${error.message}`);
}

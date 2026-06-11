/**
 * Client upload pipeline — the per-file state machine behind the admin
 * upload UI: presign → direct-to-R2 PUT (XHR, for progress events) →
 * confirm → poll until processing settles.
 *
 * startPhotoUpload returns a handle: `done` resolves when the file
 * reaches a terminal state (ready/failed) and never rejects; `cancel()`
 * aborts an in-flight PUT and stops polling (no further states are
 * emitted). State transitions arrive via onChange; the component renders
 * them and owns the queue UI.
 */

import { presignUpload, confirmUpload, getPhoto } from "@/lib/admin-api";
import { cdnUrlFor, variantStorageKey } from "@/lib/image-url";

export type UploadStatus =
  | "queued"
  | "presigning"
  | "uploading"
  | "confirming"
  | "processing"
  | "ready"
  | "failed";

export type UploadState = {
  /** "queued" is a UI-only state — the machine starts at "presigning". */
  status: Exclude<UploadStatus, "queued">;
  /** 0–100; only meaningful while uploading. */
  progress: number;
  photoId?: string;
  /** Set when ready. */
  thumbUrl?: string;
  /** Set when failed. */
  error?: string;
};

export type UploadHandle = {
  /**
   * Resolves once the file is handed off to processing (polling continues
   * in the background) or earlier on failure/cancel. Await this to gate
   * upload concurrency without serializing on processing time.
   */
  uploaded: Promise<void>;
  /** Resolves at a terminal state (ready/failed); never rejects. */
  done: Promise<void>;
  /** Abort the in-flight PUT and stop polling. */
  cancel: () => void;
};

const POLL_INTERVAL = 2000;
const POLL_TIMEOUT = 120000;
const XHR_TIMEOUT = 300000; // 5 minutes

export function startPhotoUpload(
  file: File,
  opts: { onChange: (state: UploadState) => void },
): UploadHandle {
  let xhr: XMLHttpRequest | null = null;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  let resolveUploaded!: () => void;
  const uploaded = new Promise<void>((resolve) => {
    resolveUploaded = resolve;
  });

  const emit = (state: UploadState) => {
    if (!cancelled) opts.onChange(state);
  };

  async function run(): Promise<void> {
    // Stage 1: presign
    emit({ status: "presigning", progress: 0 });
    const presign = await presignUpload(file.name, file.type);
    if (cancelled) return;
    if (!presign.ok) {
      emit({ status: "failed", progress: 0, error: presign.error });
      return;
    }
    const { url, storageKey, photoId } = presign.data;

    // Stage 2: PUT to R2 (XHR rather than fetch, for upload progress)
    emit({ status: "uploading", progress: 0, photoId });
    try {
      await putWithProgress(url, (pct) =>
        emit({ status: "uploading", progress: pct, photoId }),
      );
    } catch (err) {
      if (cancelled) return;
      emit({
        status: "failed",
        progress: 0,
        photoId,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return;
    }
    if (cancelled) return;

    // Stage 3: confirm (idempotent server-side)
    emit({ status: "confirming", progress: 100, photoId });
    const confirm = await confirmUpload(storageKey);
    if (cancelled) return;
    if (!confirm.ok) {
      emit({
        status: "failed",
        progress: 100,
        photoId,
        error: `Confirm failed: ${confirm.error}`,
      });
      return;
    }

    // Stage 4: poll until the worker settles the photo. The upload itself
    // is finished here — release `uploaded` so the next queued file starts.
    emit({ status: "processing", progress: 100, photoId });
    resolveUploaded();
    await pollUntilSettled(photoId);
  }

  function putWithProgress(
    url: string,
    onProgress: (pct: number) => void,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const req = new XMLHttpRequest();
      xhr = req;
      req.timeout = XHR_TIMEOUT;

      req.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      req.onload = () => {
        xhr = null;
        if (req.status >= 200 && req.status < 300) resolve();
        else reject(new Error(`R2 returned ${req.status}: ${req.statusText}`));
      };
      req.onerror = () => {
        xhr = null;
        reject(new Error("Network error during upload"));
      };
      req.ontimeout = () => {
        xhr = null;
        reject(new Error("Upload timed out"));
      };
      req.onabort = () => {
        xhr = null;
        reject(new Error("Upload aborted"));
      };

      req.open("PUT", url);
      req.setRequestHeader("Content-Type", file.type);
      req.send(file);
    });
  }

  function pollUntilSettled(photoId: string): Promise<void> {
    const startTime = Date.now();
    return new Promise<void>((resolve) => {
      const tick = () => {
        if (cancelled) return resolve();
        if (Date.now() - startTime > POLL_TIMEOUT) {
          emit({
            status: "failed",
            progress: 100,
            photoId,
            error: "Processing timed out after 2 minutes",
          });
          return resolve();
        }
        pollTimer = setTimeout(async () => {
          const result = await getPhoto(photoId);
          if (cancelled) return resolve();
          if (!result.ok) return tick(); // retry on transient failure
          if (result.data.status === "ready") {
            emit({
              status: "ready",
              progress: 100,
              photoId,
              thumbUrl: cdnUrlFor(variantStorageKey(photoId, "thumb_200")),
            });
            resolve();
          } else if (result.data.status === "failed") {
            emit({
              status: "failed",
              progress: 100,
              photoId,
              error: "Image processing failed",
            });
            resolve();
          } else {
            tick();
          }
        }, POLL_INTERVAL);
      };
      tick();
    });
  }

  return {
    uploaded,
    // The .finally covers every early exit (failure/cancel before stage 4).
    done: run().finally(() => resolveUploaded()),
    cancel() {
      cancelled = true;
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      xhr?.abort();
    },
  };
}

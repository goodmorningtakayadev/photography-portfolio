/**
 * Upload pipeline — confirm, process, and reprocess operations.
 *
 * Owns the orchestration around an uploaded photo's journey:
 *   presigned upload → confirmUpload → (worker) → processConfirmedPhoto
 *                                              ↳ reprocessPhoto restarts from here
 *
 * Routes become thin transport: parse body → call op → switch on result.kind.
 * Idempotency, status invariants, and the failed-status-on-error guarantee
 * live in this module, not in the routes.
 *
 * The worker trigger is fire-and-forget HTTP because Vercel runs each
 * request as a separate Lambda invocation — the trigger needs to return
 * immediately so the user-facing call doesn't block on Sharp processing.
 * If we ever swap to a real queue (Inngest, BullMQ), only triggerProcessing
 * changes.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { photos, photoVariants, type Photo } from "@/db/schema";
import { extractPhotoIdFromKey, headObject } from "@/lib/storage";
import { processPhoto } from "@/lib/processing";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";

export type ConfirmResult =
  | { kind: "created"; photoId: string }
  | { kind: "invalid_key" }
  | { kind: "already_confirmed" }
  | { kind: "file_not_found" }
  | { kind: "file_too_large"; size: number; maxSize: number }
  | { kind: "storage_unavailable" };

export type ProcessResult =
  | { kind: "processed"; variantCount: number }
  | { kind: "photo_not_found" }
  | { kind: "wrong_status"; currentStatus: Photo["status"] };

export type ReprocessResult =
  | { kind: "requeued" }
  | { kind: "photo_not_found" }
  | { kind: "wrong_status"; currentStatus: Photo["status"] };

/**
 * Stage 1 — Confirm a completed upload. Idempotent on storageKey: a second
 * confirm for the same key returns `already_confirmed` rather than creating
 * a duplicate. Triggers the processing worker on success.
 *
 * Throws on unexpected DB failures; callers should treat exceptions as 500.
 */
export async function confirmUpload(args: {
  storageKey: string;
  baseUrl: URL;
  cookie: string | null;
}): Promise<ConfirmResult> {
  const photoId = extractPhotoIdFromKey(args.storageKey);
  if (!photoId) return { kind: "invalid_key" };

  const [existing] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);
  if (existing) return { kind: "already_confirmed" };

  let head: { exists: boolean; contentLength?: number };
  try {
    head = await headObject(args.storageKey);
  } catch (err) {
    console.error("[upload-pipeline] R2 HEAD error:", err);
    return { kind: "storage_unavailable" };
  }
  if (!head.exists) return { kind: "file_not_found" };

  if (head.contentLength && head.contentLength > MAX_UPLOAD_SIZE) {
    return {
      kind: "file_too_large",
      size: head.contentLength,
      maxSize: MAX_UPLOAD_SIZE,
    };
  }

  const [maxResult] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${photos.gallerySortOrder}), 0)`,
    })
    .from(photos);
  const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

  await db.insert(photos).values({
    id: photoId,
    storageKey: args.storageKey,
    status: "processing",
    isPublished: false,
    gallerySortOrder: nextOrder,
  });

  triggerProcessing({
    photoId,
    baseUrl: args.baseUrl,
    cookie: args.cookie,
  });

  return { kind: "created", photoId };
}

/**
 * Stage 2 — Run the Sharp pipeline + persist variants for a confirmed photo.
 * Owns the "always transition to failed on error" invariant: if processing
 * throws, the photo is marked status='failed' before the error propagates.
 *
 * Pure Node — invoked by /api/uploads/process route, but trivially callable
 * from a script or test fixture.
 */
export async function processConfirmedPhoto(
  photoId: string,
): Promise<ProcessResult> {
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo) return { kind: "photo_not_found" };
  if (photo.status !== "processing") {
    return { kind: "wrong_status", currentStatus: photo.status };
  }

  try {
    const result = await processPhoto(photoId, photo.storageKey);

    await db
      .update(photos)
      .set({
        width: result.metadata.width,
        height: result.metadata.height,
        exifData: result.metadata.exifData,
        blurhash: result.blurhash,
        takenAt: result.metadata.takenAt,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(photos.id, photoId));

    await db.insert(photoVariants).values(
      result.variants.map((v) => ({
        photoId,
        variantType: v.variantType,
        storageKey: v.storageKey,
        width: v.width,
        height: v.height,
        format: v.format,
        fileSize: v.fileSize,
      })),
    );

    return { kind: "processed", variantCount: result.variants.length };
  } catch (err) {
    try {
      await db
        .update(photos)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(photos.id, photoId));
    } catch (updateError) {
      console.error(
        "[upload-pipeline] Failed to mark status=failed:",
        updateError,
      );
    }
    throw err;
  }
}

/**
 * Stage 3 — Reset a failed photo to processing and re-trigger the worker.
 * Atomic clear-variants + status-flip via db.batch; fire-and-forget trigger
 * after the batch commits.
 */
export async function reprocessPhoto(args: {
  photoId: string;
  baseUrl: URL;
  cookie: string | null;
}): Promise<ReprocessResult> {
  const [photo] = await db
    .select({ status: photos.status })
    .from(photos)
    .where(eq(photos.id, args.photoId))
    .limit(1);

  if (!photo) return { kind: "photo_not_found" };
  if (photo.status !== "failed") {
    return { kind: "wrong_status", currentStatus: photo.status };
  }

  await db.batch([
    db
      .delete(photoVariants)
      .where(eq(photoVariants.photoId, args.photoId)),
    db
      .update(photos)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(photos.id, args.photoId)),
  ]);

  triggerProcessing({
    photoId: args.photoId,
    baseUrl: args.baseUrl,
    cookie: args.cookie,
  });

  return { kind: "requeued" };
}

/**
 * Fire-and-forget POST to /api/uploads/process. Internal — exposed only
 * via confirmUpload and reprocessPhoto so callers can't accidentally bypass
 * status invariants. Trigger failures are logged; never propagated, since
 * the user-facing call has already succeeded by the time we get here.
 */
function triggerProcessing(args: {
  photoId: string;
  baseUrl: URL;
  cookie: string | null;
}): void {
  const processUrl = new URL("/api/uploads/process", args.baseUrl);
  fetch(processUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: args.cookie ?? "",
    },
    body: JSON.stringify({ photoId: args.photoId }),
  }).catch((err) =>
    console.error("[upload-pipeline] Failed to trigger processing:", err),
  );
}

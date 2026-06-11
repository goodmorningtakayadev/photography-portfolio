import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { photoCategories } from "@/db/schema";
import {
  archivePhotos,
  restorePhotos,
  permanentlyDeletePhotos,
} from "@/lib/photo-lifecycle";
import {
  revalidateForPhotoChange,
  revalidateForPhotoLifecycle,
} from "@/lib/revalidation";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

const bulkSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("archive"),
    photoIds: z.array(z.string().uuid()).min(1, "At least one photo required"),
  }),
  z.object({
    action: z.literal("restore"),
    photoIds: z.array(z.string().uuid()).min(1, "At least one photo required"),
  }),
  z.object({
    action: z.literal("categorize"),
    photoIds: z.array(z.string().uuid()).min(1, "At least one photo required"),
    categoryIds: z.array(z.string().uuid()),
  }),
  z.object({
    action: z.literal("permanently_delete"),
    photoIds: z.array(z.string().uuid()).min(1, "At least one photo required"),
    confirm: z.literal(true, {
      message: "Confirmation required. Send { confirm: true } to proceed.",
    }),
  }),
]);

/**
 * POST /api/photos/bulk — Bulk lifecycle operations and category assignment.
 * Lifecycle ops delegate to src/lib/photo-lifecycle.ts.
 */
export const POST = adminRoute(
  "Bulk operation failed",
  async (request) => {
    const body = await readJson(request, bulkSchema);
    if (!body.ok) return body.response;
    const parsed = body.value;

    if (parsed.action === "archive") {
      const event = await archivePhotos(parsed.photoIds);
      revalidateForPhotoLifecycle(event);
      return apiSuccess(event);
    }

    if (parsed.action === "restore") {
      const event = await restorePhotos(parsed.photoIds);
      revalidateForPhotoLifecycle(event);
      return apiSuccess(event);
    }

    if (parsed.action === "permanently_delete") {
      const event = await permanentlyDeletePhotos(parsed.photoIds);
      revalidateForPhotoLifecycle(event);
      return apiSuccess(event);
    }

    if (parsed.action === "categorize") {
      const { photoIds, categoryIds } = parsed;

      // Build batch: delete all existing categories for each photo,
      // then insert new assignments
      const deletes = photoIds.map((photoId) =>
        db
          .delete(photoCategories)
          .where(eq(photoCategories.photoId, photoId)),
      );

      const inserts =
        categoryIds.length > 0
          ? photoIds.map((photoId) =>
              db.insert(photoCategories).values(
                categoryIds.map((categoryId) => ({
                  photoId,
                  categoryId,
                })),
              ),
            )
          : [];

      if (deletes.length > 0) {
        await db.batch(
          [...deletes, ...inserts] as [
            (typeof deletes)[0],
            ...(typeof deletes)[number][],
          ],
        );
      }

      // Categorize affects /gallery (filter behavior) and / (homepage shows
      // category covers); doesn't change project page contents.
      revalidateForPhotoChange();

      return apiSuccess({ updated: photoIds.length });
    }

    return apiError("Unknown action", 400);
  },
);

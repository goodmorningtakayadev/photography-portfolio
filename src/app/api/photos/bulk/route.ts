import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
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
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.action === "archive") {
      const event = await archivePhotos(parsed.data.photoIds);
      revalidateForPhotoLifecycle(event);
      return NextResponse.json({ data: event, error: null });
    }

    if (parsed.data.action === "restore") {
      const event = await restorePhotos(parsed.data.photoIds);
      revalidateForPhotoLifecycle(event);
      return NextResponse.json({ data: event, error: null });
    }

    if (parsed.data.action === "permanently_delete") {
      const event = await permanentlyDeletePhotos(parsed.data.photoIds);
      revalidateForPhotoLifecycle(event);
      return NextResponse.json({ data: event, error: null });
    }

    if (parsed.data.action === "categorize") {
      const { photoIds, categoryIds } = parsed.data;

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

      return NextResponse.json({
        data: { updated: photoIds.length },
        error: null,
      });
    }

    return NextResponse.json(
      { data: null, error: "Unknown action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("POST /api/photos/bulk error:", error);
    return NextResponse.json(
      { data: null, error: "Bulk operation failed" },
      { status: 500 },
    );
  }
}

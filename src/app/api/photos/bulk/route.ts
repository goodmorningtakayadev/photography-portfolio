import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { photos, photoCategories, projects } from "@/db/schema";

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
]);

/**
 * POST /api/photos/bulk — Bulk archive or bulk set categories.
 * Uses db.batch() for atomicity (neon-http has no db.transaction()).
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
      const { photoIds } = parsed.data;

      // Atomic batch: archive photos + clear cover references
      await db.batch([
        db
          .update(photos)
          .set({ status: "archived", updatedAt: new Date() })
          .where(inArray(photos.id, photoIds)),
        db
          .update(projects)
          .set({ coverPhotoId: null, updatedAt: new Date() })
          .where(inArray(projects.coverPhotoId, photoIds)),
      ]);

      return NextResponse.json({
        data: { updated: photoIds.length },
        error: null,
      });
    }

    if (parsed.data.action === "restore") {
      const { photoIds } = parsed.data;

      await db
        .update(photos)
        .set({ status: "ready", updatedAt: new Date() })
        .where(inArray(photos.id, photoIds));

      return NextResponse.json({
        data: { updated: photoIds.length },
        error: null,
      });
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

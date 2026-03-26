import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq, gte, ne, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { deleteObject } from "@/lib/storage";
import { db } from "@/db";
import {
  photos,
  photoVariants,
  photoCategories,
  projects,
} from "@/db/schema";
import { getPhotoById } from "@/db/queries/photos";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/photos/[id] — Fetch a single photo with categories and variants.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const photo = await getPhotoById(id);

  if (!photo) {
    return NextResponse.json(
      { data: null, error: "Photo not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: photo, error: null });
}

/**
 * PATCH /api/photos/[id] — Update photo fields or execute lifecycle action.
 */
const patchSchema = z.object({
  caption: z.string().max(500).nullable().optional(),
  altText: z.string().max(500).nullable().optional(),
  gallerySortOrder: z.number().int().optional(),
  isPublished: z.boolean().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  action: z.enum(["archive", "restore", "reprocess"]).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { action, categoryIds, ...fields } = parsed.data;

  // Verify photo exists
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (!photo) {
    return NextResponse.json(
      { data: null, error: "Photo not found" },
      { status: 404 },
    );
  }

  try {
    // Handle lifecycle actions
    if (action === "archive") {
      await db
        .update(photos)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(photos.id, id));
      // Clear cover_photo_id references on projects
      await db
        .update(projects)
        .set({ coverPhotoId: null, updatedAt: new Date() })
        .where(eq(projects.coverPhotoId, id));

      revalidatePath("/");
      revalidatePath("/gallery");

      return NextResponse.json({
        data: { id, status: "archived" },
        error: null,
      });
    }

    if (action === "restore") {
      if (photo.status !== "archived") {
        return NextResponse.json(
          { data: null, error: "Only archived photos can be restored" },
          { status: 400 },
        );
      }
      await db
        .update(photos)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(photos.id, id));

      revalidatePath("/");
      revalidatePath("/gallery");

      return NextResponse.json({
        data: { id, status: "ready" },
        error: null,
      });
    }

    if (action === "reprocess") {
      if (photo.status !== "failed") {
        return NextResponse.json(
          { data: null, error: "Only failed photos can be reprocessed" },
          { status: 400 },
        );
      }
      // Delete existing variants
      await db
        .delete(photoVariants)
        .where(eq(photoVariants.photoId, id));
      // Reset status
      await db
        .update(photos)
        .set({ status: "processing", updatedAt: new Date() })
        .where(eq(photos.id, id));

      // Fire-and-forget processing trigger
      const processUrl = new URL("/api/uploads/process", request.url);
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: request.headers.get("cookie") ?? "",
        },
        body: JSON.stringify({ photoId: id }),
      }).catch((err) =>
        console.error("Failed to trigger reprocessing:", err),
      );

      return NextResponse.json({
        data: { id, status: "processing" },
        error: null,
      });
    }

    // Handle field updates
    const updateSet: Record<string, unknown> = {};
    if (fields.caption !== undefined) updateSet.caption = fields.caption;
    if (fields.altText !== undefined) updateSet.altText = fields.altText;
    if (fields.isPublished !== undefined)
      updateSet.isPublished = fields.isPublished;

    // Handle gallery sort order with insert-and-shift
    let needsNormalization = false;
    if (fields.gallerySortOrder !== undefined && fields.gallerySortOrder !== photo.gallerySortOrder) {
      const newOrder = fields.gallerySortOrder;
      // Shift all photos at or after the target position up by 1 (excluding this photo)
      await db
        .update(photos)
        .set({
          gallerySortOrder: sql`${photos.gallerySortOrder} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            gte(photos.gallerySortOrder, newOrder),
            ne(photos.id, id),
          ),
        );
      updateSet.gallerySortOrder = newOrder;
      needsNormalization = true;
    }

    if (Object.keys(updateSet).length > 0) {
      updateSet.updatedAt = new Date();
      await db.update(photos).set(updateSet).where(eq(photos.id, id));
    }

    // Normalize all gallery sort orders to be sequential (0, 1, 2, ...)
    if (needsNormalization) {
      await db.execute(sql`
        WITH ordered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY gallery_sort_order ASC, created_at DESC) AS new_order
          FROM photos
        )
        UPDATE photos
        SET gallery_sort_order = ordered.new_order
        FROM ordered
        WHERE photos.id = ordered.id
          AND photos.gallery_sort_order != ordered.new_order
      `);
    }

    // Handle category assignment
    if (categoryIds !== undefined) {
      await db
        .delete(photoCategories)
        .where(eq(photoCategories.photoId, id));
      if (categoryIds.length > 0) {
        await db.insert(photoCategories).values(
          categoryIds.map((categoryId) => ({
            photoId: id,
            categoryId,
          })),
        );
      }
    }

    revalidatePath("/");
    revalidatePath("/gallery");

    return NextResponse.json({ data: { id, updated: true }, error: null });
  } catch (error) {
    console.error("PATCH /api/photos/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/photos/[id] — Permanently delete photo, R2 files, and all references.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  let body: { confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.confirm) {
    return NextResponse.json(
      {
        data: null,
        error: "Confirmation required. Send { confirm: true } to proceed.",
      },
      { status: 400 },
    );
  }

  // Fetch photo and variants (need storage keys before deleting DB rows)
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (!photo) {
    return NextResponse.json(
      { data: null, error: "Photo not found" },
      { status: 404 },
    );
  }

  const variants = await db
    .select()
    .from(photoVariants)
    .where(eq(photoVariants.photoId, id));

  try {
    // 1. Clear cover_photo_id references on projects
    await db
      .update(projects)
      .set({ coverPhotoId: null, updatedAt: new Date() })
      .where(eq(projects.coverPhotoId, id));

    // 2. Delete R2 files (variants first, then original)
    const orphanedKeys: string[] = [];

    for (const variant of variants) {
      try {
        await deleteObject(variant.storageKey);
      } catch (err) {
        console.error(
          `Failed to delete variant ${variant.storageKey}:`,
          err,
        );
        orphanedKeys.push(variant.storageKey);
      }
    }

    try {
      await deleteObject(photo.storageKey);
    } catch (err) {
      console.error(
        `Failed to delete original ${photo.storageKey}:`,
        err,
      );
      orphanedKeys.push(photo.storageKey);
    }

    // 3. Delete DB row (ON DELETE CASCADE handles join tables + variants)
    await db.delete(photos).where(eq(photos.id, id));

    revalidatePath("/");
    revalidatePath("/gallery");
    revalidatePath("/projects");

    return NextResponse.json({
      data: {
        deleted: true,
        orphanedKeys: orphanedKeys.length > 0 ? orphanedKeys : undefined,
      },
      error: null,
    });
  } catch (error) {
    console.error("DELETE /api/photos/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to delete photo" },
      { status: 500 },
    );
  }
}

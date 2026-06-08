import { NextResponse } from "next/server";
import { eq, gte, ne, and, sql } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { photos, photoCategories } from "@/db/schema";
import { getPhotoById } from "@/db/queries/photos";
import { getProjectSlugsAffectedByPhotos } from "@/db/queries/projects";
import {
  archivePhotos,
  restorePhotos,
  permanentlyDeletePhotos,
} from "@/lib/photo-lifecycle";
import { reprocessPhoto } from "@/lib/upload-pipeline";
import {
  revalidateForPhotoChange,
  revalidateForPhotoLifecycle,
} from "@/lib/revalidation";

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
      const event = await archivePhotos([id]);
      if (event.photoIds.length === 0) {
        return NextResponse.json(
          { data: null, error: "Photo already archived" },
          { status: 400 },
        );
      }
      revalidateForPhotoLifecycle(event);
      return NextResponse.json({
        data: {
          id,
          status: "archived",
          affectedProjectSlugs: event.affectedProjectSlugs,
        },
        error: null,
      });
    }

    if (action === "restore") {
      const event = await restorePhotos([id]);
      if (event.photoIds.length === 0) {
        return NextResponse.json(
          { data: null, error: "Only archived photos can be restored" },
          { status: 400 },
        );
      }
      revalidateForPhotoLifecycle(event);
      return NextResponse.json({
        data: { id, status: "ready" },
        error: null,
      });
    }

    if (action === "reprocess") {
      const result = await reprocessPhoto({
        photoId: id,
        baseUrl: new URL(request.url),
        cookie: request.headers.get("cookie"),
      });
      switch (result.kind) {
        case "requeued":
          return NextResponse.json({
            data: { id, status: "processing" },
            error: null,
          });
        case "photo_not_found":
          return NextResponse.json(
            { data: null, error: "Photo not found" },
            { status: 404 },
          );
        case "wrong_status":
          return NextResponse.json(
            {
              data: null,
              error: "Only failed photos can be reprocessed",
            },
            { status: 400 },
          );
      }
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

    // Caption and altText surface on /projects/[slug]; isPublished and
    // gallerySortOrder don't (project pages filter on status='ready' only).
    // Categories don't appear on project pages either.
    const projectVisibleChange =
      fields.caption !== undefined || fields.altText !== undefined;
    const affectedProjectSlugs = projectVisibleChange
      ? await getProjectSlugsAffectedByPhotos([id])
      : [];
    revalidateForPhotoChange({ affectedProjectSlugs });

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

  try {
    const event = await permanentlyDeletePhotos([id]);

    if (event.photoIds.length === 0) {
      return NextResponse.json(
        { data: null, error: "Photo not found" },
        { status: 404 },
      );
    }

    revalidateForPhotoLifecycle(event);

    return NextResponse.json({
      data: {
        deleted: true,
        orphanedKeys:
          event.orphanedStorageKeys.length > 0
            ? event.orphanedStorageKeys
            : undefined,
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

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { eq, and, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { projects, projectPhotos, photos } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/photos — Add photos to project.
 */
const addSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1, "At least one photo ID required"),
});

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  // Verify project exists
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    return NextResponse.json(
      { data: null, error: "Project not found" },
      { status: 404 },
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

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { photoIds } = parsed.data;

  try {
    // Validate all photoIds reference existing ready photos
    const validPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(
        and(
          inArray(photos.id, photoIds),
          eq(photos.status, "ready"),
        ),
      );

    const validIds = new Set(validPhotos.map((p) => p.id));
    const invalidIds = photoIds.filter((pid) => !validIds.has(pid));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error: `Invalid or non-ready photo IDs: ${invalidIds.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Get existing photos in project to skip duplicates and find max sort_order
    const existing = await db
      .select({
        photoId: projectPhotos.photoId,
        sortOrder: projectPhotos.sortOrder,
      })
      .from(projectPhotos)
      .where(eq(projectPhotos.projectId, id));

    const existingIds = new Set(existing.map((e) => e.photoId));
    const maxOrder = existing.reduce(
      (max, e) => Math.max(max, e.sortOrder),
      0,
    );

    const newPhotos = photoIds.filter((pid) => !existingIds.has(pid));

    if (newPhotos.length === 0) {
      return NextResponse.json({
        data: { added: 0 },
        error: null,
      });
    }

    await db.insert(projectPhotos).values(
      newPhotos.map((photoId, i) => ({
        projectId: id,
        photoId,
        sortOrder: maxOrder + i + 1,
      })),
    );

    revalidatePath("/projects/" + project.slug);

    return NextResponse.json({
      data: { added: newPhotos.length },
      error: null,
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/photos error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to add photos to project" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/projects/[id]/photos — Reorder photos (full ordered list).
 * Uses db.batch() for atomic delete+re-insert (neon-http has no db.transaction()).
 */
const reorderSchema = z.object({
  photoIds: z
    .array(z.string().uuid())
    .min(1, "Cannot reorder with empty list"),
});

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { id } = await params;

  // Verify project exists
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) {
    return NextResponse.json(
      { data: null, error: "Project not found" },
      { status: 404 },
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

  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { photoIds } = parsed.data;

  try {
    // Atomic delete+re-insert via db.batch()
    await db.batch([
      db
        .delete(projectPhotos)
        .where(eq(projectPhotos.projectId, id)),
      db.insert(projectPhotos).values(
        photoIds.map((photoId, i) => ({
          projectId: id,
          photoId,
          sortOrder: i,
        })),
      ),
    ]);

    revalidatePath("/projects/" + project.slug);

    return NextResponse.json({
      data: { reordered: photoIds.length },
      error: null,
    });
  } catch (error) {
    console.error("PUT /api/projects/[id]/photos error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to reorder photos" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects/[id]/photos — Remove a photo from the project.
 */
const removeSchema = z.object({
  photoId: z.string().uuid("Invalid photo ID"),
});

export async function DELETE(request: Request, { params }: RouteContext) {
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

  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { photoId } = parsed.data;

  try {
    // Delete the join row
    await db
      .delete(projectPhotos)
      .where(
        and(
          eq(projectPhotos.projectId, id),
          eq(projectPhotos.photoId, photoId),
        ),
      );

    // If removed photo was cover, clear it
    const [project] = await db
      .select({ coverPhotoId: projects.coverPhotoId })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (project?.coverPhotoId === photoId) {
      await db
        .update(projects)
        .set({ coverPhotoId: null, updatedAt: new Date() })
        .where(eq(projects.id, id));
    }

    // Fetch project slug for revalidation
    const [projectForSlug] = await db
      .select({ slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (projectForSlug) {
      revalidatePath("/projects/" + projectForSlug.slug);
    }

    return NextResponse.json({
      data: { removed: true },
      error: null,
    });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/photos error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to remove photo from project" },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { projects, projectPhotos } from "@/db/schema";
import { getProjectByIdAdmin } from "@/db/queries/admin";
import { revalidateForProjectChange } from "@/lib/revalidation";
import { slugify, PROJECT_SLUG_MAX } from "@/lib/slug";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id] — Fetch project with photos and thumb variants.
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
  const project = await getProjectByIdAdmin(id);

  if (!project) {
    return NextResponse.json(
      { data: null, error: "Project not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: project, error: null });
}

/**
 * PATCH /api/projects/[id] — Update project fields.
 */
const patchSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(200))
    .optional(),
  description: z.string().max(5000).nullable().optional(),
  slug: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(200))
    .optional(),
  isPublished: z.boolean().optional(),
  coverPhotoId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
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

  // Verify project exists
  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { data: null, error: "Project not found" },
      { status: 404 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
    // Auto-regenerate slug if title changes and slug not explicitly provided
    if (parsed.data.slug === undefined) {
      const newSlug = slugify(parsed.data.title, PROJECT_SLUG_MAX);
      if (!newSlug) {
        return NextResponse.json(
          {
            data: null,
            error: "Title must contain at least one alphanumeric character",
          },
          { status: 400 },
        );
      }
      updates.slug = newSlug;
    }
  }

  if (parsed.data.slug !== undefined) {
    const cleanSlug = slugify(parsed.data.slug, PROJECT_SLUG_MAX);
    if (!cleanSlug) {
      return NextResponse.json(
        { data: null, error: "Slug must contain at least one alphanumeric character" },
        { status: 400 },
      );
    }
    updates.slug = cleanSlug;
  }

  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description;
  }

  if (parsed.data.isPublished !== undefined) {
    updates.isPublished = parsed.data.isPublished;
    if (parsed.data.isPublished && !existing.publishedAt) {
      updates.publishedAt = new Date();
    }
  }

  if (parsed.data.sortOrder !== undefined) {
    updates.sortOrder = parsed.data.sortOrder;
  }

  // Validate coverPhotoId belongs to project
  if (parsed.data.coverPhotoId !== undefined) {
    if (parsed.data.coverPhotoId !== null) {
      const [inProject] = await db
        .select()
        .from(projectPhotos)
        .where(
          and(
            eq(projectPhotos.projectId, id),
            eq(projectPhotos.photoId, parsed.data.coverPhotoId),
          ),
        )
        .limit(1);

      if (!inProject) {
        return NextResponse.json(
          { data: null, error: "Cover photo must be a photo in this project" },
          { status: 400 },
        );
      }
    }
    updates.coverPhotoId = parsed.data.coverPhotoId;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { data: null, error: "No fields to update" },
      { status: 400 },
    );
  }

  try {
    updates.updatedAt = new Date();
    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    const slugs =
      existing.slug !== updated.slug
        ? [existing.slug, updated.slug]
        : [updated.slug];
    revalidateForProjectChange({ slugs });

    return NextResponse.json({ data: updated, error: null });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        {
          data: null,
          error: "A project with this slug already exists",
        },
        { status: 409 },
      );
    }
    console.error("PATCH /api/projects/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to update project" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects/[id] — Delete project. ON DELETE CASCADE handles project_photos.
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

  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { data: null, error: "Project not found" },
      { status: 404 },
    );
  }

  try {
    await db.delete(projects).where(eq(projects.id, id));

    revalidateForProjectChange({ slugs: [existing.slug] });

    return NextResponse.json({ data: { deleted: true }, error: null });
  } catch (error) {
    console.error("DELETE /api/projects/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to delete project" },
      { status: 500 },
    );
  }
}

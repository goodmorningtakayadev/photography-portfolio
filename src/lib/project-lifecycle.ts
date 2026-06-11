/**
 * Project lifecycle — create, update, delete, and photo-membership
 * operations for curated projects.
 *
 * Mirrors photo-lifecycle: owns the mutation rules (slug generation,
 * publishedAt stamping, cover validation, the cover-nulling rule when a
 * photo leaves a project, sort-order assignment, unique-violation
 * detection) so routes stay transport. Pure Node — no Next.js imports.
 * Result kinds carry the slugs callers need for revalidation.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  photos,
  projects,
  projectPhotos,
  type Project,
} from "@/db/schema";
import { slugify, PROJECT_SLUG_MAX } from "@/lib/slug";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("unique");
}

// ── Create ──

export type CreateProjectResult =
  | { kind: "created"; project: Project }
  | { kind: "invalid_title" }
  | { kind: "slug_conflict" };

export async function createProject(
  title: string,
): Promise<CreateProjectResult> {
  const slug = slugify(title, PROJECT_SLUG_MAX);
  if (!slug) return { kind: "invalid_title" };

  const [maxResult] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${projects.sortOrder}), 0)`,
    })
    .from(projects);
  const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

  try {
    const [created] = await db
      .insert(projects)
      .values({ title, slug, sortOrder: nextOrder })
      .returning();
    return { kind: "created", project: created };
  } catch (error) {
    if (isUniqueViolation(error)) return { kind: "slug_conflict" };
    throw error;
  }
}

// ── Update ──

export type UpdateProjectInput = {
  title?: string;
  slug?: string;
  description?: string | null;
  isPublished?: boolean;
  coverPhotoId?: string | null;
  sortOrder?: number;
};

export type UpdateProjectResult =
  | { kind: "updated"; project: Project; affectedSlugs: string[] }
  | { kind: "not_found" }
  | { kind: "invalid_title" }
  | { kind: "invalid_slug" }
  | { kind: "no_fields" }
  | { kind: "cover_not_in_project" }
  | { kind: "slug_conflict" };

export async function updateProject(
  id: string,
  input: UpdateProjectInput,
): Promise<UpdateProjectResult> {
  const [existing] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!existing) return { kind: "not_found" };

  const updates: Partial<typeof projects.$inferInsert> = {};

  if (input.title !== undefined) {
    updates.title = input.title;
    // Auto-regenerate slug if title changes and slug not explicitly provided
    if (input.slug === undefined) {
      const newSlug = slugify(input.title, PROJECT_SLUG_MAX);
      if (!newSlug) return { kind: "invalid_title" };
      updates.slug = newSlug;
    }
  }

  if (input.slug !== undefined) {
    const cleanSlug = slugify(input.slug, PROJECT_SLUG_MAX);
    if (!cleanSlug) return { kind: "invalid_slug" };
    updates.slug = cleanSlug;
  }

  if (input.description !== undefined) {
    updates.description = input.description;
  }

  if (input.isPublished !== undefined) {
    updates.isPublished = input.isPublished;
    if (input.isPublished && !existing.publishedAt) {
      updates.publishedAt = new Date();
    }
  }

  if (input.sortOrder !== undefined) {
    updates.sortOrder = input.sortOrder;
  }

  // A cover must be a member of the project it covers.
  if (input.coverPhotoId !== undefined) {
    if (input.coverPhotoId !== null) {
      const [inProject] = await db
        .select({ photoId: projectPhotos.photoId })
        .from(projectPhotos)
        .where(
          and(
            eq(projectPhotos.projectId, id),
            eq(projectPhotos.photoId, input.coverPhotoId),
          ),
        )
        .limit(1);
      if (!inProject) return { kind: "cover_not_in_project" };
    }
    updates.coverPhotoId = input.coverPhotoId;
  }

  if (Object.keys(updates).length === 0) return { kind: "no_fields" };

  updates.updatedAt = new Date();
  try {
    const [updated] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    // On rename, both slugs need revalidation so the stale page falls out.
    const affectedSlugs =
      existing.slug !== updated.slug
        ? [existing.slug, updated.slug]
        : [updated.slug];
    return { kind: "updated", project: updated, affectedSlugs };
  } catch (error) {
    if (isUniqueViolation(error)) return { kind: "slug_conflict" };
    throw error;
  }
}

// ── Delete ──

export type DeleteProjectResult =
  | { kind: "deleted"; slug: string }
  | { kind: "not_found" };

export async function deleteProject(
  id: string,
): Promise<DeleteProjectResult> {
  const [existing] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!existing) return { kind: "not_found" };

  // ON DELETE CASCADE cleans project_photos; photos themselves are kept.
  await db.delete(projects).where(eq(projects.id, id));
  return { kind: "deleted", slug: existing.slug };
}

// ── Photo membership ──

export type AddPhotosResult =
  | { kind: "added"; added: number; slug: string }
  | { kind: "not_found" }
  | { kind: "invalid_photos"; invalidIds: string[] };

/**
 * Add photos to a project, appending after the current max sort order.
 * Only ready photos may join; photos already in the project are skipped
 * (added reports net-new memberships only).
 */
export async function addPhotosToProject(
  projectId: string,
  photoIds: string[],
): Promise<AddPhotosResult> {
  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { kind: "not_found" };

  const validPhotos = await db
    .select({ id: photos.id })
    .from(photos)
    .where(and(inArray(photos.id, photoIds), eq(photos.status, "ready")));

  const validIds = new Set(validPhotos.map((p) => p.id));
  const invalidIds = photoIds.filter((pid) => !validIds.has(pid));
  if (invalidIds.length > 0) {
    return { kind: "invalid_photos", invalidIds };
  }

  const existing = await db
    .select({
      photoId: projectPhotos.photoId,
      sortOrder: projectPhotos.sortOrder,
    })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, projectId));

  const existingIds = new Set(existing.map((e) => e.photoId));
  const maxOrder = existing.reduce((max, e) => Math.max(max, e.sortOrder), 0);
  const newPhotos = photoIds.filter((pid) => !existingIds.has(pid));

  if (newPhotos.length === 0) {
    return { kind: "added", added: 0, slug: project.slug };
  }

  await db.insert(projectPhotos).values(
    newPhotos.map((photoId, i) => ({
      projectId,
      photoId,
      sortOrder: maxOrder + i + 1,
    })),
  );

  return { kind: "added", added: newPhotos.length, slug: project.slug };
}

export type ReorderPhotosResult =
  | { kind: "reordered"; count: number; slug: string }
  | { kind: "not_found" };

/**
 * Replace the project's photo ordering with the given full ordered list.
 * Atomic delete+re-insert via db.batch (neon-http has no transactions);
 * per-membership fields (scene_note, added_at) are carried over.
 */
export async function reorderProjectPhotos(
  projectId: string,
  photoIds: string[],
): Promise<ReorderPhotosResult> {
  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { kind: "not_found" };

  const existingRows = await db
    .select({
      photoId: projectPhotos.photoId,
      sceneNote: projectPhotos.sceneNote,
      addedAt: projectPhotos.addedAt,
    })
    .from(projectPhotos)
    .where(eq(projectPhotos.projectId, projectId));
  const existingById = new Map(existingRows.map((r) => [r.photoId, r]));

  await db.batch([
    db.delete(projectPhotos).where(eq(projectPhotos.projectId, projectId)),
    db.insert(projectPhotos).values(
      photoIds.map((photoId, i) => ({
        projectId,
        photoId,
        sortOrder: i,
        sceneNote: existingById.get(photoId)?.sceneNote ?? null,
        addedAt: existingById.get(photoId)?.addedAt ?? new Date(),
      })),
    ),
  ]);

  return { kind: "reordered", count: photoIds.length, slug: project.slug };
}

export type SetSceneNoteResult =
  | { kind: "note_set"; sceneNote: string | null; slug: string }
  | { kind: "not_found" }
  | { kind: "photo_not_in_project" };

/**
 * Set the per-membership scene note. Empty/whitespace input clears it —
 * the public page then falls back to the photo's description.
 */
export async function setProjectPhotoSceneNote(
  projectId: string,
  photoId: string,
  sceneNote: string | null,
): Promise<SetSceneNoteResult> {
  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { kind: "not_found" };

  const normalized = sceneNote?.trim() || null;

  const updated = await db
    .update(projectPhotos)
    .set({ sceneNote: normalized })
    .where(
      and(
        eq(projectPhotos.projectId, projectId),
        eq(projectPhotos.photoId, photoId),
      ),
    )
    .returning({ photoId: projectPhotos.photoId });

  if (updated.length === 0) return { kind: "photo_not_in_project" };

  return { kind: "note_set", sceneNote: normalized, slug: project.slug };
}

export type RemovePhotoResult =
  | { kind: "removed"; slug: string }
  | { kind: "not_found" };

/**
 * Remove a photo from a project. Owns the cover-nulling rule — the same
 * rule photo-lifecycle applies on archive/delete: a project never keeps a
 * cover reference to a photo that left it.
 */
export async function removePhotoFromProject(
  projectId: string,
  photoId: string,
): Promise<RemovePhotoResult> {
  const [project] = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return { kind: "not_found" };

  await db.batch([
    db
      .delete(projectPhotos)
      .where(
        and(
          eq(projectPhotos.projectId, projectId),
          eq(projectPhotos.photoId, photoId),
        ),
      ),
    db
      .update(projects)
      .set({ coverPhotoId: null, updatedAt: new Date() })
      .where(
        and(eq(projects.id, projectId), eq(projects.coverPhotoId, photoId)),
      ),
  ]);

  return { kind: "removed", slug: project.slug };
}

import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  projectPhotos,
  photos,
  type Project,
  type Photo,
} from "@/db/schema";

export type ProjectWithCover = Project & {
  coverPhoto: Photo | null;
};

export type ProjectWithPhotos = Project & {
  coverPhoto: Photo | null;
  photos: Photo[];
};

/**
 * Get all published projects ordered by sort_order, with cover photo.
 */
export async function getPublishedProjects(): Promise<ProjectWithCover[]> {
  const rows = await db
    .select({
      project: projects,
      coverPhoto: photos,
    })
    .from(projects)
    .leftJoin(photos, eq(projects.coverPhotoId, photos.id))
    .where(eq(projects.isPublished, true))
    .orderBy(asc(projects.sortOrder));

  return rows.map((r) => ({
    ...r.project,
    coverPhoto: r.coverPhoto,
  }));
}

/**
 * Get a single project by slug with its ordered photos.
 */
export async function getProjectBySlug(
  slug: string
): Promise<ProjectWithPhotos | null> {
  const [row] = await db
    .select({
      project: projects,
      coverPhoto: photos,
    })
    .from(projects)
    .leftJoin(photos, eq(projects.coverPhotoId, photos.id))
    .where(and(eq(projects.slug, slug), eq(projects.isPublished, true)))
    .limit(1);

  if (!row) return null;

  const projectPhotoRows = await db
    .select({ photo: photos })
    .from(projectPhotos)
    .innerJoin(photos, eq(projectPhotos.photoId, photos.id))
    .where(
      and(
        eq(projectPhotos.projectId, row.project.id),
        eq(photos.status, "ready")
      )
    )
    .orderBy(asc(projectPhotos.sortOrder));

  return {
    ...row.project,
    coverPhoto: row.coverPhoto,
    photos: projectPhotoRows.map((r) => r.photo),
  };
}

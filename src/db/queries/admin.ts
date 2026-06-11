import { sql, eq, and, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  photos,
  photoVariants,
  projects,
  projectPhotos,
  type Photo,
  type Project,
} from "@/db/schema";

export type PhotoWithThumb = Photo & { thumbStorageKey: string | null };

/**
 * Get photo counts by status for the dashboard stats cards.
 */
export async function getPhotoStats() {
  const result = await db
    .select({
      total: sql<number>`cast(count(*) as integer)`,
      published: sql<number>`cast(coalesce(sum(case when ${photos.isPublished} = true and ${photos.status} = 'ready' then 1 else 0 end), 0) as integer)`,
      processing: sql<number>`cast(coalesce(sum(case when ${photos.status} = 'processing' then 1 else 0 end), 0) as integer)`,
      ready: sql<number>`cast(coalesce(sum(case when ${photos.status} = 'ready' then 1 else 0 end), 0) as integer)`,
      failed: sql<number>`cast(coalesce(sum(case when ${photos.status} = 'failed' then 1 else 0 end), 0) as integer)`,
      archived: sql<number>`cast(coalesce(sum(case when ${photos.status} = 'archived' then 1 else 0 end), 0) as integer)`,
    })
    .from(photos);

  return (
    result[0] ?? {
      total: 0,
      published: 0,
      processing: 0,
      ready: 0,
      failed: 0,
      archived: 0,
    }
  );
}

/**
 * Get recent photos with thumb_200 variant for the dashboard grid.
 */
export async function getRecentPhotos(
  limit = 8,
): Promise<PhotoWithThumb[]> {
  const result = await db
    .select({
      photo: photos,
      thumbStorageKey: photoVariants.storageKey,
    })
    .from(photos)
    .leftJoin(
      photoVariants,
      and(
        eq(photoVariants.photoId, photos.id),
        eq(photoVariants.variantType, "thumb_200"),
      ),
    )
    .orderBy(desc(photos.createdAt))
    .limit(limit);

  return result.map((r) => ({
    ...r.photo,
    thumbStorageKey: r.thumbStorageKey,
  }));
}

/**
 * Get paginated photos with thumb variant, filterable by status.
 */
export async function getAllPhotosAdmin({
  status,
  page = 1,
  limit = 24,
}: {
  status?: Photo["status"];
  page?: number;
  limit?: number;
}): Promise<{
  photos: PhotoWithThumb[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const where = status ? eq(photos.status, status) : undefined;

  const [photosResult, countResult] = await Promise.all([
    db
      .select({
        photo: photos,
        thumbStorageKey: photoVariants.storageKey,
      })
      .from(photos)
      .leftJoin(
        photoVariants,
        and(
          eq(photoVariants.photoId, photos.id),
          eq(photoVariants.variantType, "thumb_200"),
        ),
      )
      .where(where)
      .orderBy(asc(photos.gallerySortOrder), desc(photos.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(photos)
      .where(where),
  ]);

  const total = countResult[0]?.count ?? 0;

  return {
    photos: photosResult.map((r) => ({
      ...r.photo,
      thumbStorageKey: r.thumbStorageKey,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// ── Project Queries ──

export type ProjectWithMeta = Project & {
  photoCount: number;
  coverThumbStorageKey: string | null;
};

export type ProjectPhotoWithThumb = {
  photoId: string;
  sortOrder: number;
  sceneNote: string | null;
  addedAt: Date;
  caption: string | null;
  altText: string | null;
  status: Photo["status"];
  thumbStorageKey: string | null;
};

export type ProjectDetail = Project & {
  photos: ProjectPhotoWithThumb[];
};

/**
 * Get all projects with photo count and cover photo thumb storage key.
 */
export async function getAllProjectsAdmin(): Promise<ProjectWithMeta[]> {
  const result = await db
    .select({
      project: projects,
      photoCount:
        sql<number>`cast(count(distinct ${projectPhotos.photoId}) as integer)`,
      coverThumbStorageKey: photoVariants.storageKey,
    })
    .from(projects)
    .leftJoin(
      projectPhotos,
      eq(projectPhotos.projectId, projects.id),
    )
    .leftJoin(
      photos,
      eq(photos.id, projects.coverPhotoId),
    )
    .leftJoin(
      photoVariants,
      and(
        eq(photoVariants.photoId, projects.coverPhotoId),
        eq(photoVariants.variantType, "thumb_200"),
      ),
    )
    .groupBy(projects.id, photoVariants.storageKey)
    .orderBy(asc(projects.sortOrder));

  return result.map((r) => ({
    ...r.project,
    photoCount: r.photoCount,
    coverThumbStorageKey: r.coverThumbStorageKey,
  }));
}

/**
 * Get a single project by ID with its photos (including thumb variants),
 * ordered by project_photos.sort_order.
 */
export async function getProjectByIdAdmin(
  id: string,
): Promise<ProjectDetail | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);

  if (!project) return null;

  const photosResult = await db
    .select({
      photoId: projectPhotos.photoId,
      sortOrder: projectPhotos.sortOrder,
      sceneNote: projectPhotos.sceneNote,
      addedAt: projectPhotos.addedAt,
      caption: photos.caption,
      altText: photos.altText,
      status: photos.status,
      thumbStorageKey: photoVariants.storageKey,
    })
    .from(projectPhotos)
    .innerJoin(photos, eq(photos.id, projectPhotos.photoId))
    .leftJoin(
      photoVariants,
      and(
        eq(photoVariants.photoId, projectPhotos.photoId),
        eq(photoVariants.variantType, "thumb_200"),
      ),
    )
    .where(eq(projectPhotos.projectId, id))
    .orderBy(asc(projectPhotos.sortOrder));

  return {
    ...project,
    photos: photosResult,
  };
}

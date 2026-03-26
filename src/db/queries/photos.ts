import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  photos,
  photoVariants,
  photoCategories,
  categories,
  projects,
  projectPhotos,
  type Photo,
  type PhotoVariant,
  type Category,
} from "@/db/schema";
import type {
  PhotoWithVariantsAndCategories,
  CategoryWithCover,
} from "@/lib/photo-adapter";

export type PhotoWithCategories = Photo & {
  categories: Category[];
  variants: PhotoVariant[];
};

/**
 * Get published photos, optionally filtered by category slug.
 * Returns photos with status='ready' and is_published=true,
 * ordered by gallery_sort_order.
 */
export async function getPublishedPhotos(
  categorySlug?: string
): Promise<Photo[]> {
  if (categorySlug) {
    const rows = await db
      .select({ photo: photos })
      .from(photos)
      .innerJoin(photoCategories, eq(photos.id, photoCategories.photoId))
      .innerJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(
        and(
          eq(photos.isPublished, true),
          eq(photos.status, "ready"),
          eq(categories.slug, categorySlug)
        )
      )
      .orderBy(asc(photos.gallerySortOrder));

    return rows.map((r) => r.photo);
  }

  return db
    .select()
    .from(photos)
    .where(and(eq(photos.isPublished, true), eq(photos.status, "ready")))
    .orderBy(asc(photos.gallerySortOrder));
}

/**
 * Get a single photo by ID with its categories and variants.
 */
export async function getPhotoById(
  id: string
): Promise<PhotoWithCategories | null> {
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, id))
    .limit(1);

  if (!photo) return null;

  const [photoVars, photoCats] = await Promise.all([
    db
      .select()
      .from(photoVariants)
      .where(eq(photoVariants.photoId, id)),
    db
      .select({ category: categories })
      .from(photoCategories)
      .innerJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(eq(photoCategories.photoId, id)),
  ]);

  return {
    ...photo,
    variants: photoVars,
    categories: photoCats.map((r) => r.category),
  };
}

/**
 * Get featured/top photos for the homepage.
 * Returns published, ready photos ordered by gallery_sort_order, limited.
 */
export async function getFeaturedPhotos(limit = 6): Promise<Photo[]> {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.isPublished, true), eq(photos.status, "ready")))
    .orderBy(asc(photos.gallerySortOrder))
    .limit(limit);
}

// ── Public page queries (with variants + categories for adapters) ──

/**
 * Get all published photos with thumb/web variant keys and category slugs/names.
 * Main data source for the gallery page.
 */
export async function getPublishedPhotosWithVariants(): Promise<
  PhotoWithVariantsAndCategories[]
> {
  // 1. Fetch published photos
  const photoRows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.isPublished, true), eq(photos.status, "ready")))
    .orderBy(asc(photos.gallerySortOrder));

  if (photoRows.length === 0) return [];

  const photoIds = photoRows.map((p) => p.id);

  // 2. Batch-fetch variants and categories in parallel
  const [variantRows, catRows] = await Promise.all([
    db
      .select({
        photoId: photoVariants.photoId,
        variantType: photoVariants.variantType,
        storageKey: photoVariants.storageKey,
      })
      .from(photoVariants)
      .where(inArray(photoVariants.photoId, photoIds)),
    db
      .select({
        photoId: photoCategories.photoId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(photoCategories)
      .innerJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(inArray(photoCategories.photoId, photoIds)),
  ]);

  // Group variants by photoId
  const variantMap = new Map<
    string,
    { thumb: string | null; web: string | null }
  >();
  for (const v of variantRows) {
    const entry = variantMap.get(v.photoId) || { thumb: null, web: null };
    if (v.variantType === "thumb_200") entry.thumb = v.storageKey;
    if (v.variantType === "web_1200") entry.web = v.storageKey;
    variantMap.set(v.photoId, entry);
  }

  // Group categories by photoId
  const catMap = new Map<string, { slugs: string[]; names: string[] }>();
  for (const row of catRows) {
    const entry = catMap.get(row.photoId) || { slugs: [], names: [] };
    entry.slugs.push(row.slug);
    entry.names.push(row.name);
    catMap.set(row.photoId, entry);
  }

  return photoRows.map((photo) => {
    const variants = variantMap.get(photo.id) || { thumb: null, web: null };
    const cats = catMap.get(photo.id) || { slugs: [], names: [] };
    return {
      ...photo,
      thumbStorageKey: variants.thumb,
      webStorageKey: variants.web,
      categorySlugs: cats.slugs,
      categoryNames: cats.names,
    };
  });
}

/**
 * Get featured photos with variant keys and categories (homepage).
 */
export async function getFeaturedPhotosWithVariants(
  limit = 6,
): Promise<PhotoWithVariantsAndCategories[]> {
  const photoRows = await db
    .select()
    .from(photos)
    .where(and(eq(photos.isPublished, true), eq(photos.status, "ready")))
    .orderBy(asc(photos.gallerySortOrder))
    .limit(limit);

  if (photoRows.length === 0) return [];

  const photoIds = photoRows.map((p) => p.id);

  const [variantRows, catRows] = await Promise.all([
    db
      .select({
        photoId: photoVariants.photoId,
        variantType: photoVariants.variantType,
        storageKey: photoVariants.storageKey,
      })
      .from(photoVariants)
      .where(inArray(photoVariants.photoId, photoIds)),
    db
      .select({
        photoId: photoCategories.photoId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(photoCategories)
      .innerJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(inArray(photoCategories.photoId, photoIds)),
  ]);

  const variantMap = new Map<
    string,
    { thumb: string | null; web: string | null }
  >();
  for (const v of variantRows) {
    const entry = variantMap.get(v.photoId) || { thumb: null, web: null };
    if (v.variantType === "thumb_200") entry.thumb = v.storageKey;
    if (v.variantType === "web_1200") entry.web = v.storageKey;
    variantMap.set(v.photoId, entry);
  }

  const catMap = new Map<string, { slugs: string[]; names: string[] }>();
  for (const row of catRows) {
    const entry = catMap.get(row.photoId) || { slugs: [], names: [] };
    entry.slugs.push(row.slug);
    entry.names.push(row.name);
    catMap.set(row.photoId, entry);
  }

  return photoRows.map((photo) => {
    const variants = variantMap.get(photo.id) || { thumb: null, web: null };
    const cats = catMap.get(photo.id) || { slugs: [], names: [] };
    return {
      ...photo,
      thumbStorageKey: variants.thumb,
      webStorageKey: variants.web,
      categorySlugs: cats.slugs,
      categoryNames: cats.names,
    };
  });
}

/**
 * Get all categories with the first published photo as cover.
 */
export async function getCategoriesWithCoverPhoto(): Promise<
  CategoryWithCover[]
> {
  // Use a CTE approach: for each category, find the first published photo
  const allCats = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder));

  const result: CategoryWithCover[] = [];

  for (const cat of allCats) {
    // Find first published photo in this category
    const [coverRow] = await db
      .select({
        photoId: photos.id,
        storageKey: photos.storageKey,
        caption: photos.caption,
        altText: photos.altText,
        width: photos.width,
        height: photos.height,
      })
      .from(photos)
      .innerJoin(photoCategories, eq(photoCategories.photoId, photos.id))
      .where(
        and(
          eq(photoCategories.categoryId, cat.id),
          eq(photos.status, "ready"),
          eq(photos.isPublished, true),
        ),
      )
      .orderBy(asc(photos.gallerySortOrder))
      .limit(1);

    let coverThumbStorageKey: string | null = null;
    if (coverRow) {
      const [variant] = await db
        .select({ storageKey: photoVariants.storageKey })
        .from(photoVariants)
        .where(
          and(
            eq(photoVariants.photoId, coverRow.photoId),
            eq(photoVariants.variantType, "web_1200"),
          ),
        )
        .limit(1);
      coverThumbStorageKey = variant?.storageKey || null;
    }

    result.push({
      ...cat,
      coverPhotoId: coverRow?.photoId || null,
      coverStorageKey: coverRow?.storageKey || null,
      coverThumbStorageKey,
      coverCaption: coverRow?.caption || null,
      coverAltText: coverRow?.altText || null,
      coverWidth: coverRow?.width || null,
      coverHeight: coverRow?.height || null,
    });
  }

  return result;
}

/**
 * Get all published projects with their ordered photos (for gallery "Projects" tab).
 */
export async function getPublishedProjectsWithPhotos(): Promise<
  {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    coverPhotoId: string | null;
    isPublished: boolean;
    publishedAt: Date | null;
    sortOrder: number;
    coverPhoto: PhotoWithVariantsAndCategories | null;
    photos: PhotoWithVariantsAndCategories[];
  }[]
> {
  // Fetch published projects
  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.isPublished, true))
    .orderBy(asc(projects.sortOrder));

  if (projectRows.length === 0) return [];

  // For each project, fetch its photos with variants
  const result = await Promise.all(
    projectRows.map(async (project) => {
      const photoRows = await db
        .select({ photo: photos })
        .from(projectPhotos)
        .innerJoin(photos, eq(projectPhotos.photoId, photos.id))
        .where(
          and(
            eq(projectPhotos.projectId, project.id),
            eq(photos.status, "ready"),
          ),
        )
        .orderBy(asc(projectPhotos.sortOrder));

      const projPhotoIds = photoRows.map((r) => r.photo.id);
      let variantMap = new Map<
        string,
        { thumb: string | null; web: string | null }
      >();
      let catMap = new Map<string, { slugs: string[]; names: string[] }>();

      if (projPhotoIds.length > 0) {
        const [variantRows, catRows] = await Promise.all([
          db
            .select({
              photoId: photoVariants.photoId,
              variantType: photoVariants.variantType,
              storageKey: photoVariants.storageKey,
            })
            .from(photoVariants)
            .where(inArray(photoVariants.photoId, projPhotoIds)),
          db
            .select({
              photoId: photoCategories.photoId,
              slug: categories.slug,
              name: categories.name,
            })
            .from(photoCategories)
            .innerJoin(
              categories,
              eq(photoCategories.categoryId, categories.id),
            )
            .where(inArray(photoCategories.photoId, projPhotoIds)),
        ]);

        for (const v of variantRows) {
          const entry = variantMap.get(v.photoId) || {
            thumb: null,
            web: null,
          };
          if (v.variantType === "thumb_200") entry.thumb = v.storageKey;
          if (v.variantType === "web_1200") entry.web = v.storageKey;
          variantMap.set(v.photoId, entry);
        }

        for (const row of catRows) {
          const entry = catMap.get(row.photoId) || { slugs: [], names: [] };
          entry.slugs.push(row.slug);
          entry.names.push(row.name);
          catMap.set(row.photoId, entry);
        }
      }

      const projectPhotoViews = photoRows.map((r) => {
        const variants = variantMap.get(r.photo.id) || {
          thumb: null,
          web: null,
        };
        const cats = catMap.get(r.photo.id) || { slugs: [], names: [] };
        return {
          ...r.photo,
          thumbStorageKey: variants.thumb,
          webStorageKey: variants.web,
          categorySlugs: cats.slugs,
          categoryNames: cats.names,
        };
      });

      // Find cover photo from the project's photos
      const coverPhoto = project.coverPhotoId
        ? projectPhotoViews.find((p) => p.id === project.coverPhotoId) || null
        : null;

      return {
        id: project.id,
        title: project.title,
        slug: project.slug,
        description: project.description,
        coverPhotoId: project.coverPhotoId,
        isPublished: project.isPublished,
        publishedAt: project.publishedAt,
        sortOrder: project.sortOrder,
        coverPhoto,
        photos: projectPhotoViews,
      };
    }),
  );

  return result;
}

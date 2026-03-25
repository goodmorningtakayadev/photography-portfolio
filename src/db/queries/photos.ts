import { eq, and, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  photos,
  photoVariants,
  photoCategories,
  categories,
  type Photo,
  type PhotoVariant,
  type Category,
} from "@/db/schema";

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

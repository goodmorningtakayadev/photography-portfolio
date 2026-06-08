import { eq } from "drizzle-orm";
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
 * Get a single photo by ID with its categories and variants.
 * Used by the admin GET /api/photos/[id] endpoint.
 */
export async function getPhotoById(
  id: string,
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

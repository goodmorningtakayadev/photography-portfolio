import { eq, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  photoCategories,
  type Category,
} from "@/db/schema";

export type CategoryWithCount = Category & { photoCount: number };

/**
 * Get all categories ordered by sort_order.
 */
export async function getAllCategories(): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder));
}

/**
 * Get all categories ordered by sortOrder, with photo count per category.
 * Used by the admin category manager.
 */
export async function getAllCategoriesWithCounts(): Promise<
  CategoryWithCount[]
> {
  const result = await db
    .select({
      category: categories,
      photoCount:
        sql<number>`cast(count(${photoCategories.photoId}) as integer)`,
    })
    .from(categories)
    .leftJoin(
      photoCategories,
      eq(photoCategories.categoryId, categories.id),
    )
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder));

  return result.map((r) => ({
    ...r.category,
    photoCount: r.photoCount,
  }));
}

/**
 * Get a single category by slug.
 */
export async function getCategoryBySlug(
  slug: string
): Promise<Category | null> {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  return category ?? null;
}

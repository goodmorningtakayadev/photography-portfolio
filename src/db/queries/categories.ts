import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { categories, type Category } from "@/db/schema";

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

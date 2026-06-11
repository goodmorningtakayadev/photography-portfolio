/**
 * Category lifecycle — create, update, delete for gallery filter labels.
 *
 * Categories are flat labels (name + slug + sort order, nothing more), so
 * this module is small on purpose — but it still owns the rules: slug
 * generation/auto-regeneration, sort-order assignment, unique-violation
 * detection. Pure Node — no Next.js imports; callers revalidate.
 */

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, type Category } from "@/db/schema";
import { slugify, CATEGORY_SLUG_MAX } from "@/lib/slug";

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes("unique");
}

export type CreateCategoryResult =
  | { kind: "created"; category: Category }
  | { kind: "invalid_name" }
  | { kind: "conflict" };

export async function createCategory(
  name: string,
): Promise<CreateCategoryResult> {
  const slug = slugify(name, CATEGORY_SLUG_MAX);
  if (!slug) return { kind: "invalid_name" };

  const [maxResult] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${categories.sortOrder}), 0)`,
    })
    .from(categories);
  const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

  try {
    const [created] = await db
      .insert(categories)
      .values({ name, slug, sortOrder: nextOrder })
      .returning();
    return { kind: "created", category: created };
  } catch (error) {
    if (isUniqueViolation(error)) return { kind: "conflict" };
    throw error;
  }
}

export type UpdateCategoryInput = {
  name?: string;
  slug?: string;
  sortOrder?: number;
};

export type UpdateCategoryResult =
  | { kind: "updated"; category: Category }
  | { kind: "not_found" }
  | { kind: "invalid_name" }
  | { kind: "invalid_slug" }
  | { kind: "no_fields" }
  | { kind: "conflict" };

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<UpdateCategoryResult> {
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!existing) return { kind: "not_found" };

  const updates: Partial<typeof categories.$inferInsert> = {};

  if (input.name !== undefined) {
    updates.name = input.name;
    // Auto-regenerate slug if name changes and slug not explicitly provided
    if (input.slug === undefined) {
      const newSlug = slugify(input.name, CATEGORY_SLUG_MAX);
      if (!newSlug) return { kind: "invalid_name" };
      updates.slug = newSlug;
    }
  }

  if (input.slug !== undefined) {
    const cleanSlug = slugify(input.slug, CATEGORY_SLUG_MAX);
    if (!cleanSlug) return { kind: "invalid_slug" };
    updates.slug = cleanSlug;
  }

  if (input.sortOrder !== undefined) {
    updates.sortOrder = input.sortOrder;
  }

  if (Object.keys(updates).length === 0) return { kind: "no_fields" };

  try {
    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return { kind: "updated", category: updated };
  } catch (error) {
    if (isUniqueViolation(error)) return { kind: "conflict" };
    throw error;
  }
}

export type DeleteCategoryResult =
  | { kind: "deleted" }
  | { kind: "not_found" };

export async function deleteCategory(
  id: string,
): Promise<DeleteCategoryResult> {
  const [existing] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);
  if (!existing) return { kind: "not_found" };

  // FK CASCADE cleans photo_categories.
  await db.delete(categories).where(eq(categories.id, id));
  return { kind: "deleted" };
}

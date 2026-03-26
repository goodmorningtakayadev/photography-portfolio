import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Slugify a string for URL-safe category slugs.
 */
function slugify(name: string): string | null {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
  return slug.length > 0 ? slug : null;
}

// --- Validation ---

const patchSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(100))
    .optional(),
  slug: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(100))
    .optional(),
  sortOrder: z.number().int().min(0).optional(),
});

/**
 * PATCH /api/categories/[id] — Update category fields.
 */
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

  // Verify category exists
  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { data: null, error: "Category not found" },
      { status: 404 },
    );
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.name !== undefined) {
    updates.name = parsed.data.name;
    // Auto-regenerate slug if name changes and slug not explicitly provided
    if (parsed.data.slug === undefined) {
      const newSlug = slugify(parsed.data.name);
      if (!newSlug) {
        return NextResponse.json(
          {
            data: null,
            error: "Name must contain at least one alphanumeric character",
          },
          { status: 400 },
        );
      }
      updates.slug = newSlug;
    }
  }

  if (parsed.data.slug !== undefined) {
    const cleanSlug = slugify(parsed.data.slug);
    if (!cleanSlug) {
      return NextResponse.json(
        { data: null, error: "Slug must contain at least one alphanumeric character" },
        { status: 400 },
      );
    }
    updates.slug = cleanSlug;
  }

  if (parsed.data.sortOrder !== undefined) {
    updates.sortOrder = parsed.data.sortOrder;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { data: null, error: "No fields to update" },
      { status: 400 },
    );
  }

  try {
    const [updated] = await db
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();

    return NextResponse.json({ data: updated, error: null });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        {
          data: null,
          error: "A category with this name or slug already exists",
        },
        { status: 409 },
      );
    }
    console.error("PATCH /api/categories/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to update category" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/categories/[id] — Delete a category.
 * FK CASCADE handles photo_categories cleanup.
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

  const [existing] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json(
      { data: null, error: "Category not found" },
      { status: 404 },
    );
  }

  try {
    await db.delete(categories).where(eq(categories.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/categories/[id] error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to delete category" },
      { status: 500 },
    );
  }
}

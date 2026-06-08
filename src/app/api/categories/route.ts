import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { getAllCategories } from "@/db/queries/admin";
import { revalidateForCategoryChange } from "@/lib/revalidation";

export const dynamic = "force-dynamic";

/**
 * Slugify a string: lowercase, replace non-alphanumeric with hyphens,
 * collapse consecutive hyphens, trim leading/trailing hyphens.
 * Returns null if result is empty (all special characters).
 */
function slugify(name: string): string | null {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100); // Truncate to match schema varchar(100)
  return slug.length > 0 ? slug : null;
}

// --- Validation ---

const createSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Name is required").max(100, "Name too long (max 100 chars)")),
});

/**
 * GET /api/categories — List all categories with photo counts.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await getAllCategories();
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/categories — Create a new category.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { name } = parsed.data;
  const slug = slugify(name);

  if (!slug) {
    return NextResponse.json(
      {
        data: null,
        error: "Name must contain at least one alphanumeric character",
      },
      { status: 400 },
    );
  }

  try {
    // Get next sort order
    const [maxResult] = await db
      .select({
        maxOrder: sql<number>`coalesce(max(${categories.sortOrder}), 0)`,
      })
      .from(categories);

    const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

    const [created] = await db
      .insert(categories)
      .values({ name, slug, sortOrder: nextOrder })
      .returning();

    revalidateForCategoryChange();

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (error: unknown) {
    // Handle unique constraint violation
    if (
      error instanceof Error &&
      error.message.includes("unique")
    ) {
      return NextResponse.json(
        {
          data: null,
          error: "A category with this name or slug already exists",
        },
        { status: 409 },
      );
    }
    console.error("POST /api/categories error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to create category" },
      { status: 500 },
    );
  }
}

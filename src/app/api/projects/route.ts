import { NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getAllProjectsAdmin } from "@/db/queries/admin";
import { revalidateForProjectChange } from "@/lib/revalidation";
import { slugify, PROJECT_SLUG_MAX } from "@/lib/slug";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Title is required").max(200, "Title too long (max 200 chars)")),
});

/**
 * GET /api/projects — List all projects with photo count and cover thumb.
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
    const result = await getAllProjectsAdmin();
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects — Create a new project.
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

  const { title } = parsed.data;
  const slug = slugify(title, PROJECT_SLUG_MAX);

  if (!slug) {
    return NextResponse.json(
      {
        data: null,
        error: "Title must contain at least one alphanumeric character",
      },
      { status: 400 },
    );
  }

  try {
    const [maxResult] = await db
      .select({
        maxOrder: sql<number>`coalesce(max(${projects.sortOrder}), 0)`,
      })
      .from(projects);

    const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

    const [created] = await db
      .insert(projects)
      .values({
        title,
        slug,
        sortOrder: nextOrder,
      })
      .returning();

    revalidateForProjectChange({ slugs: [created.slug] });

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("unique")) {
      return NextResponse.json(
        {
          data: null,
          error: "A project with this title or slug already exists",
        },
        { status: 409 },
      );
    }
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to create project" },
      { status: 500 },
    );
  }
}

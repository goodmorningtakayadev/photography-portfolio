import { z } from "zod";
import { getAllProjectsAdmin } from "@/db/queries/admin";
import { createProject } from "@/lib/project-lifecycle";
import { revalidateForProjectChange } from "@/lib/revalidation";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

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
export const GET = adminRoute("Failed to fetch projects", async () => {
  return apiSuccess(await getAllProjectsAdmin());
});

/**
 * POST /api/projects — Create a new project.
 */
export const POST = adminRoute(
  "Failed to create project",
  async (request) => {
    const body = await readJson(request, createSchema);
    if (!body.ok) return body.response;

    const result = await createProject(body.value.title);
    switch (result.kind) {
      case "invalid_title":
        return apiError(
          "Title must contain at least one alphanumeric character",
          400,
        );
      case "slug_conflict":
        return apiError(
          "A project with this title or slug already exists",
          409,
        );
      case "created":
        revalidateForProjectChange({ slugs: [result.project.slug] });
        return apiSuccess(result.project, { status: 201 });
    }
  },
);

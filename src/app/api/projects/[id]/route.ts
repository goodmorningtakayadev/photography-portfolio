import { z } from "zod";
import { getProjectByIdAdmin } from "@/db/queries/admin";
import {
  updateProject,
  deleteProject,
} from "@/lib/project-lifecycle";
import { revalidateForProjectChange } from "@/lib/revalidation";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id] — Fetch project with photos and thumb variants.
 */
export const GET = adminRoute<RouteContext>(
  "Failed to fetch project",
  async (request, { params }) => {
    const { id } = await params;
    const project = await getProjectByIdAdmin(id);

    if (!project) return apiError("Project not found", 404);
    return apiSuccess(project);
  },
);

/**
 * PATCH /api/projects/[id] — Update project fields.
 */
const patchSchema = z.object({
  title: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(200))
    .optional(),
  description: z.string().max(5000).nullable().optional(),
  slug: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(200))
    .optional(),
  isPublished: z.boolean().optional(),
  coverPhotoId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const PATCH = adminRoute<RouteContext>(
  "Failed to update project",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, patchSchema);
    if (!body.ok) return body.response;

    const result = await updateProject(id, body.value);
    switch (result.kind) {
      case "not_found":
        return apiError("Project not found", 404);
      case "invalid_title":
        return apiError(
          "Title must contain at least one alphanumeric character",
          400,
        );
      case "invalid_slug":
        return apiError(
          "Slug must contain at least one alphanumeric character",
          400,
        );
      case "no_fields":
        return apiError("No fields to update", 400);
      case "cover_not_in_project":
        return apiError("Cover photo must be a photo in this project", 400);
      case "slug_conflict":
        return apiError("A project with this slug already exists", 409);
      case "updated":
        revalidateForProjectChange({ slugs: result.affectedSlugs });
        return apiSuccess(result.project);
    }
  },
);

/**
 * DELETE /api/projects/[id] — Delete project. ON DELETE CASCADE handles project_photos.
 */
const deleteSchema = z.object({
  confirm: z.literal(true, {
    message: "Confirmation required. Send { confirm: true } to proceed.",
  }),
});

export const DELETE = adminRoute<RouteContext>(
  "Failed to delete project",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, deleteSchema);
    if (!body.ok) return body.response;

    const result = await deleteProject(id);
    if (result.kind === "not_found") {
      return apiError("Project not found", 404);
    }

    revalidateForProjectChange({ slugs: [result.slug] });
    return apiSuccess({ deleted: true });
  },
);

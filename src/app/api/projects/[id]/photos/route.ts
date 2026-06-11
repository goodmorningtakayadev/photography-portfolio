import { z } from "zod";
import {
  addPhotosToProject,
  reorderProjectPhotos,
  setProjectPhotoSceneNote,
  removePhotoFromProject,
} from "@/lib/project-lifecycle";
import { revalidateForProjectChange } from "@/lib/revalidation";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/photos — Add photos to project.
 */
const addSchema = z.object({
  photoIds: z.array(z.string().uuid()).min(1, "At least one photo ID required"),
});

export const POST = adminRoute<RouteContext>(
  "Failed to add photos to project",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, addSchema);
    if (!body.ok) return body.response;

    const result = await addPhotosToProject(id, body.value.photoIds);
    switch (result.kind) {
      case "not_found":
        return apiError("Project not found", 404);
      case "invalid_photos":
        return apiError(
          `Invalid or non-ready photo IDs: ${result.invalidIds.join(", ")}`,
          400,
        );
      case "added":
        if (result.added > 0) {
          revalidateForProjectChange({ slugs: [result.slug] });
        }
        return apiSuccess({ added: result.added });
    }
  },
);

/**
 * PUT /api/projects/[id]/photos — Reorder photos (full ordered list).
 */
const reorderSchema = z.object({
  photoIds: z
    .array(z.string().uuid())
    .min(1, "Cannot reorder with empty list"),
});

export const PUT = adminRoute<RouteContext>(
  "Failed to reorder photos",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, reorderSchema);
    if (!body.ok) return body.response;

    const result = await reorderProjectPhotos(id, body.value.photoIds);
    if (result.kind === "not_found") {
      return apiError("Project not found", 404);
    }

    revalidateForProjectChange({ slugs: [result.slug] });
    return apiSuccess({ reordered: result.count });
  },
);

/**
 * PATCH /api/projects/[id]/photos — Set the scene note for one photo in the
 * project (null/empty clears it; public page falls back to the photo's
 * description).
 */
const noteSchema = z.object({
  photoId: z.string().uuid("Invalid photo ID"),
  sceneNote: z.string().max(2000).nullable(),
});

export const PATCH = adminRoute<RouteContext>(
  "Failed to update scene note",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, noteSchema);
    if (!body.ok) return body.response;

    const result = await setProjectPhotoSceneNote(
      id,
      body.value.photoId,
      body.value.sceneNote,
    );
    switch (result.kind) {
      case "not_found":
        return apiError("Project not found", 404);
      case "photo_not_in_project":
        return apiError("Photo is not in this project", 404);
      case "note_set":
        revalidateForProjectChange({ slugs: [result.slug] });
        return apiSuccess({
          photoId: body.value.photoId,
          sceneNote: result.sceneNote,
        });
    }
  },
);

/**
 * DELETE /api/projects/[id]/photos — Remove a photo from the project.
 */
const removeSchema = z.object({
  photoId: z.string().uuid("Invalid photo ID"),
});

export const DELETE = adminRoute<RouteContext>(
  "Failed to remove photo from project",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, removeSchema);
    if (!body.ok) return body.response;

    const result = await removePhotoFromProject(id, body.value.photoId);
    if (result.kind === "not_found") {
      return apiError("Project not found", 404);
    }

    revalidateForProjectChange({ slugs: [result.slug] });
    return apiSuccess({ removed: true });
  },
);

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  updateCategory,
  deleteCategory,
} from "@/lib/category-lifecycle";
import { revalidateForCategoryChange } from "@/lib/revalidation";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

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
export const PATCH = adminRoute<RouteContext>(
  "Failed to update category",
  async (request, { params }) => {
    const { id } = await params;

    const body = await readJson(request, patchSchema);
    if (!body.ok) return body.response;

    const result = await updateCategory(id, body.value);
    switch (result.kind) {
      case "not_found":
        return apiError("Category not found", 404);
      case "invalid_name":
        return apiError(
          "Name must contain at least one alphanumeric character",
          400,
        );
      case "invalid_slug":
        return apiError(
          "Slug must contain at least one alphanumeric character",
          400,
        );
      case "no_fields":
        return apiError("No fields to update", 400);
      case "conflict":
        return apiError(
          "A category with this name or slug already exists",
          409,
        );
      case "updated":
        revalidateForCategoryChange();
        return apiSuccess(result.category);
    }
  },
);

/**
 * DELETE /api/categories/[id] — Delete a category.
 * FK CASCADE handles photo_categories cleanup.
 */
export const DELETE = adminRoute<RouteContext>(
  "Failed to delete category",
  async (request, { params }) => {
    const { id } = await params;

    const result = await deleteCategory(id);
    if (result.kind === "not_found") {
      return apiError("Category not found", 404);
    }

    revalidateForCategoryChange();
    return new NextResponse(null, { status: 204 });
  },
);

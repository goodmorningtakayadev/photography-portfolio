import { z } from "zod";
import { getAllCategoriesWithCounts } from "@/db/queries/categories";
import { createCategory } from "@/lib/category-lifecycle";
import { revalidateForCategoryChange } from "@/lib/revalidation";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, "Name is required").max(100, "Name too long (max 100 chars)")),
});

/**
 * GET /api/categories — List all categories with photo counts.
 */
export const GET = adminRoute("Failed to fetch categories", async () => {
  return apiSuccess(await getAllCategoriesWithCounts());
});

/**
 * POST /api/categories — Create a new category.
 */
export const POST = adminRoute(
  "Failed to create category",
  async (request) => {
    const body = await readJson(request, createSchema);
    if (!body.ok) return body.response;

    const result = await createCategory(body.value.name);
    switch (result.kind) {
      case "invalid_name":
        return apiError(
          "Name must contain at least one alphanumeric character",
          400,
        );
      case "conflict":
        return apiError(
          "A category with this name or slug already exists",
          409,
        );
      case "created":
        revalidateForCategoryChange();
        return apiSuccess(result.category, { status: 201 });
    }
  },
);

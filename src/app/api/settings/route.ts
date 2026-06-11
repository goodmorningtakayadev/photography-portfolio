import { z } from "zod";
import { getSiteSettings, updateSiteSettings } from "@/db/queries/settings";
import { revalidateForSettingsChange } from "@/lib/revalidation";
import { adminRoute, apiSuccess, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  heroPhotoId: z.string().uuid().nullable().optional(),
  heroFocalX: z.number().int().min(0).max(100).optional(),
  heroFocalY: z.number().int().min(0).max(100).optional(),
});

/** GET /api/settings — current site settings. */
export const GET = adminRoute("Failed to fetch settings", async () => {
  const data = await getSiteSettings();
  return apiSuccess(data);
});

/** PATCH /api/settings — update hero photo / focal point. */
export const PATCH = adminRoute(
  "Failed to update settings",
  async (request) => {
    const body = await readJson(request, patchSchema);
    if (!body.ok) return body.response;

    const updated = await updateSiteSettings(body.value);
    revalidateForSettingsChange();
    return apiSuccess(updated);
  },
);

import { z } from "zod";
import { confirmUpload } from "@/lib/upload-pipeline";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  storageKey: z
    .string({ message: "Missing required field: storageKey" })
    .min(1, "Missing required field: storageKey"),
});

export const POST = adminRoute(
  "Failed to confirm upload",
  async (request) => {
    const body = await readJson(request, confirmSchema);
    if (!body.ok) return body.response;

    const result = await confirmUpload({
      storageKey: body.value.storageKey,
      baseUrl: new URL(request.url),
      cookie: request.headers.get("cookie"),
    });

    switch (result.kind) {
      case "created":
        return apiSuccess({ id: result.photoId, status: "processing" });
      case "invalid_key":
        return apiError(
          "Invalid storage key format. Expected: photos/<uuid>/original.<ext>",
          400,
        );
      case "already_confirmed":
        return apiError("Upload already confirmed", 409);
      case "file_not_found":
        return apiError("File not found in storage", 400);
      case "file_too_large":
        return apiError(
          `File exceeds maximum upload size of ${result.maxSize / (1024 * 1024)}MB`,
          400,
        );
      case "storage_unavailable":
        return apiError("Storage service unavailable", 502);
    }
  },
);

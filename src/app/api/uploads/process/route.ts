import { z } from "zod";
import { processConfirmedPhoto } from "@/lib/upload-pipeline";
import { adminRoute, apiSuccess, apiError, readJson } from "@/lib/api-route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const processSchema = z.object({
  photoId: z
    .string({ message: "Missing required field: photoId" })
    .min(1, "Missing required field: photoId"),
});

export const POST = adminRoute(
  "Processing failed",
  async (request) => {
    const body = await readJson(request, processSchema);
    if (!body.ok) return body.response;
    const { photoId } = body.value;

    // Inner catch keeps the photoId in the failure log — the most important
    // diagnostic signal this route produces.
    try {
      const result = await processConfirmedPhoto(photoId);

      switch (result.kind) {
        case "processed":
          return apiSuccess({
            id: photoId,
            status: "ready",
            variants: result.variantCount,
          });
        case "photo_not_found":
          return apiError("Photo not found", 404);
        case "wrong_status":
          return apiError(
            `Photo status is "${result.currentStatus}", expected "processing"`,
            400,
          );
      }
    } catch (error) {
      console.error("Processing failed for photo:", photoId, error);
      return apiError("Processing failed", 500);
    }
  },
);

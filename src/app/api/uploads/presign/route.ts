import { generateStorageKey, createPresignedUploadUrl } from "@/lib/storage";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/constants";
import { adminRoute, apiSuccess, apiError } from "@/lib/api-route";

export const dynamic = "force-dynamic";

export const GET = adminRoute(
  "Failed to generate upload URL",
  async (request) => {
    const { searchParams } = new URL(request.url);
    const filename = searchParams.get("filename");
    const contentType = searchParams.get("contentType");

    if (!filename || !contentType) {
      return apiError(
        "Missing required parameters: filename and contentType",
        400,
      );
    }

    if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
      return apiError(
        `Unsupported file type: ${contentType}. Allowed: ${[...ALLOWED_UPLOAD_TYPES].join(", ")}`,
        400,
      );
    }

    const { photoId, storageKey } = generateStorageKey(filename);
    const url = await createPresignedUploadUrl(storageKey, contentType);

    return apiSuccess({ url, storageKey, photoId });
  },
);

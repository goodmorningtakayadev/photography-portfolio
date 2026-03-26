import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { generateStorageKey, createPresignedUploadUrl } from "@/lib/storage";
import { ALLOWED_UPLOAD_TYPES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const filename = searchParams.get("filename");
  const contentType = searchParams.get("contentType");

  if (!filename || !contentType) {
    return NextResponse.json(
      {
        data: null,
        error: "Missing required parameters: filename and contentType",
      },
      { status: 400 }
    );
  }

  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
    return NextResponse.json(
      {
        data: null,
        error: `Unsupported file type: ${contentType}. Allowed: ${[...ALLOWED_UPLOAD_TYPES].join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    const { photoId, storageKey } = generateStorageKey(filename);
    const url = await createPresignedUploadUrl(storageKey, contentType);

    return NextResponse.json({
      data: { url, storageKey, photoId },
      error: null,
    });
  } catch (error) {
    console.error("Presign error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}

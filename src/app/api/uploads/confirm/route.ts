import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { confirmUpload } from "@/lib/upload-pipeline";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { storageKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { storageKey } = body;
  if (!storageKey) {
    return NextResponse.json(
      { data: null, error: "Missing required field: storageKey" },
      { status: 400 },
    );
  }

  try {
    const result = await confirmUpload({
      storageKey,
      baseUrl: new URL(request.url),
      cookie: request.headers.get("cookie"),
    });

    switch (result.kind) {
      case "created":
        return NextResponse.json({
          data: { id: result.photoId, status: "processing" },
          error: null,
        });
      case "invalid_key":
        return NextResponse.json(
          {
            data: null,
            error:
              "Invalid storage key format. Expected: photos/<uuid>/original.<ext>",
          },
          { status: 400 },
        );
      case "already_confirmed":
        return NextResponse.json(
          { data: null, error: "Upload already confirmed" },
          { status: 409 },
        );
      case "file_not_found":
        return NextResponse.json(
          { data: null, error: "File not found in storage" },
          { status: 400 },
        );
      case "file_too_large":
        return NextResponse.json(
          {
            data: null,
            error: `File exceeds maximum upload size of ${result.maxSize / (1024 * 1024)}MB`,
          },
          { status: 400 },
        );
      case "storage_unavailable":
        return NextResponse.json(
          { data: null, error: "Storage service unavailable" },
          { status: 502 },
        );
    }
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to confirm upload" },
      { status: 500 },
    );
  }
}

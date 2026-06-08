import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { processConfirmedPhoto } from "@/lib/upload-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  let body: { photoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { photoId } = body;
  if (!photoId) {
    return NextResponse.json(
      { data: null, error: "Missing required field: photoId" },
      { status: 400 },
    );
  }

  try {
    const result = await processConfirmedPhoto(photoId);

    switch (result.kind) {
      case "processed":
        return NextResponse.json({
          data: {
            id: photoId,
            status: "ready",
            variants: result.variantCount,
          },
          error: null,
        });
      case "photo_not_found":
        return NextResponse.json(
          { data: null, error: "Photo not found" },
          { status: 404 },
        );
      case "wrong_status":
        return NextResponse.json(
          {
            data: null,
            error: `Photo status is "${result.currentStatus}", expected "processing"`,
          },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error("Processing failed for photo:", photoId, error);
    return NextResponse.json(
      { data: null, error: "Processing failed" },
      { status: 500 },
    );
  }
}

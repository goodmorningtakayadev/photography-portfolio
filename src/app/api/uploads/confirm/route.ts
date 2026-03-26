import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { extractPhotoIdFromKey, headObject } from "@/lib/storage";
import { MAX_UPLOAD_SIZE } from "@/lib/constants";
import { db } from "@/db";
import { photos } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { storageKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { storageKey } = body;
  if (!storageKey) {
    return NextResponse.json(
      { data: null, error: "Missing required field: storageKey" },
      { status: 400 }
    );
  }

  // Extract and validate photoId from storageKey using strict regex
  const photoId = extractPhotoIdFromKey(storageKey);
  if (!photoId) {
    return NextResponse.json(
      {
        data: null,
        error:
          "Invalid storage key format. Expected: photos/<uuid>/original.<ext>",
      },
      { status: 400 }
    );
  }

  // Check for duplicate confirmation (idempotency guard)
  const [existing] = await db
    .select({ id: photos.id })
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { data: null, error: "Upload already confirmed" },
      { status: 409 }
    );
  }

  // Verify file exists in R2 and check size
  let head: { exists: boolean; contentLength?: number };
  try {
    head = await headObject(storageKey);
  } catch (error) {
    console.error("R2 HEAD error:", error);
    return NextResponse.json(
      { data: null, error: "Storage service unavailable" },
      { status: 502 }
    );
  }

  if (!head.exists) {
    return NextResponse.json(
      { data: null, error: "File not found in storage" },
      { status: 400 }
    );
  }

  if (head.contentLength && head.contentLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      {
        data: null,
        error: `File exceeds maximum upload size of ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`,
      },
      { status: 400 }
    );
  }

  // Calculate next gallery_sort_order
  try {
    const [maxResult] = await db
      .select({
        maxOrder: sql<number>`coalesce(max(${photos.gallerySortOrder}), 0)`,
      })
      .from(photos);

    const nextOrder = (maxResult?.maxOrder ?? 0) + 1;

    // Create photo record
    const [newPhoto] = await db
      .insert(photos)
      .values({
        id: photoId,
        storageKey,
        status: "processing",
        isPublished: false,
        gallerySortOrder: nextOrder,
      })
      .returning({ id: photos.id, status: photos.status });

    // Fire-and-forget: trigger async processing pipeline
    const processUrl = new URL("/api/uploads/process", request.url);
    fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ photoId }),
    }).catch((err) => console.error("Failed to trigger processing:", err));

    return NextResponse.json({
      data: { id: newPhoto.id, status: newPhoto.status },
      error: null,
    });
  } catch (error) {
    console.error("Confirm error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to confirm upload" },
      { status: 500 }
    );
  }
}

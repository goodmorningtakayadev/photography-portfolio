import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { processPhoto } from "@/lib/processing";
import { db } from "@/db";
import { photos, photoVariants } from "@/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { data: null, error: "Unauthorized" },
      { status: 401 }
    );
  }

  let body: { photoId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { data: null, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { photoId } = body;
  if (!photoId) {
    return NextResponse.json(
      { data: null, error: "Missing required field: photoId" },
      { status: 400 }
    );
  }

  // Look up photo record
  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1);

  if (!photo) {
    return NextResponse.json(
      { data: null, error: "Photo not found" },
      { status: 404 }
    );
  }

  if (photo.status !== "processing") {
    return NextResponse.json(
      {
        data: null,
        error: `Photo status is "${photo.status}", expected "processing"`,
      },
      { status: 400 }
    );
  }

  try {
    const result = await processPhoto(photoId, photo.storageKey);

    // Update photo record with metadata and set status to "ready"
    await db
      .update(photos)
      .set({
        width: result.metadata.width,
        height: result.metadata.height,
        exifData: result.metadata.exifData,
        blurhash: result.blurhash,
        takenAt: result.metadata.takenAt,
        status: "ready",
        updatedAt: new Date(),
      })
      .where(eq(photos.id, photoId));

    // Insert variant records
    await db.insert(photoVariants).values(
      result.variants.map((v) => ({
        photoId,
        variantType: v.variantType,
        storageKey: v.storageKey,
        width: v.width,
        height: v.height,
        format: v.format,
        fileSize: v.fileSize,
      }))
    );

    return NextResponse.json({
      data: { id: photoId, status: "ready", variants: result.variants.length },
      error: null,
    });
  } catch (error) {
    console.error("Processing failed for photo:", photoId, error);

    // Always transition to "failed" — never leave stuck in "processing"
    try {
      await db
        .update(photos)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(photos.id, photoId));
    } catch (updateError) {
      console.error("Failed to update status to failed:", updateError);
    }

    return NextResponse.json(
      { data: null, error: "Processing failed" },
      { status: 500 }
    );
  }
}

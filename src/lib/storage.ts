import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Strict regex for storage key validation and photoId extraction
const STORAGE_KEY_REGEX =
  /^photos\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/original\.(jpg|jpeg|png|webp|avif|tiff)$/;

// Lazy-initialized S3 client — avoids triggering env validation on import.
// Uses process.env directly (not env.ts) to prevent eager Zod parse at build time,
// matching the pattern established by auth routes in Phase 3.
let _client: S3Client | null = null;

function getR2Client(): S3Client {
  if (!_client) {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 credentials not configured");
    }

    _client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return _client;
}

/**
 * Generate a UUID-based storage key for a new photo upload.
 * Returns both the photoId (UUID) and the full storage key.
 */
export function generateStorageKey(filename: string): {
  photoId: string;
  storageKey: string;
} {
  const photoId = crypto.randomUUID();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const storageKey = `photos/${photoId}/original.${ext}`;
  return { photoId, storageKey };
}

/**
 * Extract photoId (UUID) from a storage key using strict regex validation.
 * Returns null if the key doesn't match the expected format.
 */
export function extractPhotoIdFromKey(storageKey: string): string | null {
  const match = storageKey.match(STORAGE_KEY_REGEX);
  return match ? match[1] : null;
}

/**
 * Create a presigned PUT URL for direct browser upload to R2.
 * Content-Type is included in the signature via signableHeaders to prevent
 * clients from uploading a different content type than validated at presign time.
 */
export async function createPresignedUploadUrl(
  storageKey: string,
  contentType: string
): Promise<string> {
  const client = getR2Client();

  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured");

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, {
    expiresIn: 300, // 5 minutes
    signableHeaders: new Set(["content-type"]),
  });
}

/**
 * Check if an object exists in R2 and return its size.
 * Returns { exists: true, contentLength } if found,
 * { exists: false } if not found. Throws on other errors.
 */
export async function headObject(
  storageKey: string
): Promise<{ exists: boolean; contentLength?: number }> {
  const client = getR2Client();

  try {
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error("R2_BUCKET_NAME not configured");

    const response = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: storageKey,
      })
    );
    return { exists: true, contentLength: response.ContentLength };
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "name" in error &&
      error.name === "NotFound"
    ) {
      return { exists: false };
    }
    throw error;
  }
}

/**
 * Download an object from R2 and return its contents as a Buffer.
 */
export async function downloadObject(storageKey: string): Promise<Buffer> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured");

  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: storageKey })
  );

  if (!response.Body) {
    throw new Error(`Empty response body for key: ${storageKey}`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a buffer to R2 at the given storage key.
 */
export async function uploadBuffer(
  storageKey: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured");

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
    })
  );
}

/**
 * Delete an object from R2 by storage key.
 */
export async function deleteObject(storageKey: string): Promise<void> {
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME not configured");

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    })
  );
}

export { getR2Client };

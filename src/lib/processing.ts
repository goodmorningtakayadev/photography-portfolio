import sharp from "sharp";
import { encode } from "blurhash";
import exifReader from "exif-reader";
import { downloadObject, uploadBuffer } from "@/lib/storage";
import { VARIANT_CONFIGS } from "@/lib/constants";

// --- Types ---

export interface VariantResult {
  variantType: "thumb_200" | "web_1200" | "retina_2400";
  storageKey: string;
  width: number;
  height: number;
  format: string;
  fileSize: number;
}

export interface MetadataResult {
  width: number;
  height: number;
  exifData: Record<string, unknown> | null;
  takenAt: Date | null;
}

export interface ProcessingResult {
  metadata: MetadataResult;
  blurhash: string;
  variants: VariantResult[];
}

// --- Main orchestrator ---

/**
 * Full processing pipeline for a photo:
 * 1. Download original from R2
 * 2. Extract metadata, compute blurhash, generate variants (parallel)
 * 3. Upload variants to R2
 * Returns all results for the caller to persist to DB.
 */
export async function processPhoto(
  photoId: string,
  storageKey: string
): Promise<ProcessingResult> {
  const originalBuffer = await downloadObject(storageKey);

  // Run metadata extraction, blurhash, and variant generation in parallel
  const [metadata, blurhash, variants] = await Promise.all([
    extractMetadata(originalBuffer),
    computeBlurhash(originalBuffer),
    generateVariants(originalBuffer, photoId),
  ]);

  // Upload all variants to R2
  await Promise.all(
    variants.map((v) =>
      uploadBuffer(v.storageKey, v.buffer, "image/webp")
    )
  );

  // Strip buffers from variant results before returning
  const variantRecords: VariantResult[] = variants.map(
    ({ buffer: _buffer, ...rest }) => rest
  );

  return { metadata, blurhash, variants: variantRecords };
}

// --- Variant generation ---

interface VariantWithBuffer extends VariantResult {
  buffer: Buffer;
}

export async function generateVariants(
  originalBuffer: Buffer,
  photoId: string
): Promise<VariantWithBuffer[]> {
  const entries = Object.entries(VARIANT_CONFIGS) as Array<
    [keyof typeof VARIANT_CONFIGS, (typeof VARIANT_CONFIGS)[keyof typeof VARIANT_CONFIGS]]
  >;

  const results = await Promise.all(
    entries.map(async ([variantType, config]) => {
      const result = await sharp(originalBuffer)
        .resize({ width: config.maxWidth, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      const variantStorageKey = `photos/${photoId}/${variantType}.webp`;

      return {
        variantType,
        storageKey: variantStorageKey,
        buffer: result.data,
        width: result.info.width,
        height: result.info.height,
        format: "webp",
        fileSize: result.info.size,
      } satisfies VariantWithBuffer;
    })
  );

  return results;
}

// --- EXIF extraction ---

export async function extractMetadata(
  originalBuffer: Buffer
): Promise<MetadataResult> {
  const metadata = await sharp(originalBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  let exifData: Record<string, unknown> | null = null;
  let takenAt: Date | null = null;

  if (metadata.exif) {
    try {
      const parsed = exifReader(metadata.exif);

      // exif-reader parses Photo.DateTimeOriginal into a Date object
      const dateTimeOriginal = parsed.Photo?.DateTimeOriginal;
      if (dateTimeOriginal instanceof Date && !isNaN(dateTimeOriginal.getTime())) {
        takenAt = dateTimeOriginal;
      }

      // Sanitize for JSONB: strip Buffers and non-serializable values
      exifData = sanitizeForJson(parsed);
    } catch {
      // Corrupt or unparseable EXIF — graceful degradation
      exifData = null;
    }
  }

  return { width, height, exifData, takenAt };
}

// --- Blurhash computation ---

export async function computeBlurhash(
  originalBuffer: Buffer
): Promise<string> {
  const { data, info } = await sharp(originalBuffer)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Convert Buffer to Uint8ClampedArray — blurhash.encode() requires this type
  const pixels = new Uint8ClampedArray(data);

  return encode(pixels, info.width, info.height, 4, 3);
}

// --- Helpers ---

/**
 * Recursively sanitize an object for JSON/JSONB storage.
 * Strips Buffer values, converts Date objects to ISO strings.
 */
function sanitizeForJson(obj: unknown): Record<string, unknown> | null {
  try {
    return JSON.parse(
      JSON.stringify(obj, (_key, value) => {
        if (Buffer.isBuffer(value)) return undefined;
        if (value instanceof Uint8Array) return undefined;
        if (value instanceof Date) return value.toISOString();
        return value;
      })
    );
  } catch {
    return null;
  }
}

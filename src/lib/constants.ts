// Allowed MIME types for photo uploads
export const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/tiff",
]);

// Maximum upload file size: 50MB
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

// Image variant configurations for processing pipeline (consumed in 04-02)
export const VARIANT_CONFIGS = {
  thumb_200: { maxWidth: 200, format: "webp" as const },
  web_1200: { maxWidth: 1200, format: "webp" as const },
  retina_2400: { maxWidth: 2400, format: "webp" as const },
} as const;

// Allowed file extensions for storage key validation
export const ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "avif",
  "tiff",
]);

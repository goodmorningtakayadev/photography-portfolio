/**
 * Image URL resolution — the one place that knows how a storage key becomes
 * a public URL, and how variant files are laid out in storage.
 *
 * Client-safe: NEXT_PUBLIC_CDN_URL is inlined into client bundles by Next.
 * Server code (public-views, processing) and admin components share this so
 * a CDN domain or storage-layout change is a one-file edit.
 */
import { VARIANT_CONFIGS } from "@/lib/constants";

export type VariantType = keyof typeof VARIANT_CONFIGS;

/**
 * Resolve a storage key to its public CDN URL. Null-propagating so callers
 * can pass optional variant keys straight through. When no CDN is configured
 * the key is returned as-is (matches public-views' historical fallback).
 */
export function cdnUrlFor(storageKey: string): string;
export function cdnUrlFor(storageKey: string | null | undefined): string | null;
export function cdnUrlFor(storageKey: string | null | undefined): string | null {
  if (!storageKey) return null;
  const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL;
  return cdnUrl ? `${cdnUrl}/${storageKey}` : storageKey;
}

/**
 * Storage key for a generated variant: photos/<photoId>/<variant>.<format>.
 * The processing pipeline writes to these keys; anything that needs a
 * variant URL before the DB row exists (e.g. upload polling) derives it here.
 */
export function variantStorageKey(
  photoId: string,
  variantType: VariantType,
): string {
  return `photos/${photoId}/${variantType}.${VARIANT_CONFIGS[variantType].format}`;
}

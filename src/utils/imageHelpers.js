/**
 * Image helper utilities for responsive optimized image delivery.
 *
 * Supports two photo shapes:
 * - DB-sourced (PhotoView): has _thumbUrl / _displayUrl from CDN variants
 * - Legacy (static JSON): uses build-time optimized files in /photos/optimized/
 */

/**
 * Get optimized image URL for a given size.
 * @param {Object} photo - Photo object (PhotoView or legacy JSON shape)
 * @param {'thumbnail' | 'display' | 'full'} size - Desired image size
 * @returns {string} URL path to the image
 */
export function getImageUrl(photo, size) {
  // DB-sourced photo with CDN variant URLs
  if (photo._thumbUrl !== undefined) {
    if (size === 'thumbnail') return photo._thumbUrl || photo.url;
    if (size === 'display') return photo._displayUrl || photo.url;
    return photo.url; // 'full' → original CDN URL
  }
  // Legacy: static file path
  if (size === 'full') {
    return photo.url;
  }
  return `/photos/optimized/${photo.id}-${size}.webp`;
}

/**
 * Get srcset string for responsive images.
 * @param {Object} photo - Photo object (PhotoView or legacy JSON shape)
 * @returns {string} srcset attribute value
 */
export function getImageSrcSet(photo) {
  if (photo._thumbUrl !== undefined) {
    const parts = [];
    if (photo._thumbUrl) parts.push(`${photo._thumbUrl} 200w`);
    if (photo._displayUrl) parts.push(`${photo._displayUrl} 1200w`);
    if (photo._retinaUrl) parts.push(`${photo._retinaUrl} 2400w`);
    // The original stays the largest candidate so screens that genuinely
    // need more than 2400px still get full quality — but only with its
    // true pixel width (a guessed descriptor would mislead selection).
    if (photo.url && photo.width && photo.width > 2400) {
      parts.push(`${photo.url} ${photo.width}w`);
    }
    return parts.join(', ');
  }
  return [
    `${getImageUrl(photo, 'thumbnail')} 400w`,
    `${getImageUrl(photo, 'display')} 1200w`,
  ].join(', ');
}

/**
 * Get fallback URL (original file) for error recovery.
 * @param {Object} photo - Photo object
 * @returns {string} URL path to original image
 */
export function getFallbackUrl(photo) {
  return photo.url;
}

/**
 * Get accessible alt text for a photo.
 * @param {Object} photo - Photo object
 * @returns {string} Alt text
 */
export function getAltText(photo) {
  return photo.description || photo.title;
}

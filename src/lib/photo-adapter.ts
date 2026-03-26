/**
 * Photo adapter — transforms DB objects into view shapes expected by
 * existing page components (Home.jsx, GalleryPage.jsx, Gallery.jsx, etc.).
 *
 * This is the bridge between the Postgres schema and the legacy component
 * contracts that were originally fed by static JSON.
 */

import type { Photo, Category } from "@/db/schema";

// ── View Types ──

export type PhotoView = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;       // primary category slug (for filtering)
  categoryName: string;   // primary category display name
  categories: string[];   // all category slugs
  date: string;
  published: boolean;
  order: number;
  _thumbUrl: string | null;
  _displayUrl: string | null;
};

export type CategoryView = {
  id: string;        // slug (NOT uuid) — used in URLs and filter matching
  name: string;
  description: string;
  coverPhoto: PhotoView | null;
};

export type CollectionView = {
  id: string;
  name: string;
  description: string;
  coverPhotoId: string | null;
  coverPhoto: PhotoView | null;
  photos: PhotoView[];
  photoIds: string[];
  photoCount: number;
  date: string;
  tags: string[];
};

// ── Raw query result types (from new query functions) ──

export type PhotoWithVariantsAndCategories = Photo & {
  thumbStorageKey: string | null;
  webStorageKey: string | null;
  categorySlugs: string[];
  categoryNames: string[];
};

export type CategoryWithCover = Category & {
  coverPhotoId: string | null;
  coverStorageKey: string | null;
  coverThumbStorageKey: string | null;
  coverCaption: string | null;
  coverAltText: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
};

// ── Converters ──

export function toPhotoView(
  photo: PhotoWithVariantsAndCategories,
  cdnUrl: string,
): PhotoView {
  return {
    id: photo.id,
    title: photo.caption || "Untitled",
    description: photo.altText || photo.caption || "",
    url: cdnUrl ? `${cdnUrl}/${photo.storageKey}` : photo.storageKey,
    category: photo.categorySlugs[0] || "",
    categoryName: photo.categoryNames[0] || "",
    categories: photo.categorySlugs,
    date: photo.takenAt
      ? photo.takenAt.toISOString()
      : photo.createdAt.toISOString(),
    published: true,
    order: photo.gallerySortOrder,
    _thumbUrl: photo.thumbStorageKey
      ? `${cdnUrl}/${photo.thumbStorageKey}`
      : null,
    _displayUrl: photo.webStorageKey
      ? `${cdnUrl}/${photo.webStorageKey}`
      : null,
  };
}

export function toCategoryView(
  cat: CategoryWithCover,
  cdnUrl: string,
): CategoryView {
  const coverPhoto: PhotoView | null =
    cat.coverPhotoId && cat.coverStorageKey
      ? {
          id: cat.coverPhotoId,
          title: cat.coverCaption || "Untitled",
          description: cat.coverAltText || cat.coverCaption || "",
          url: cdnUrl
            ? `${cdnUrl}/${cat.coverStorageKey}`
            : cat.coverStorageKey,
          category: cat.slug,
          categoryName: cat.name,
          categories: [cat.slug],
          date: "",
          published: true,
          order: 0,
          _thumbUrl: cat.coverThumbStorageKey
            ? `${cdnUrl}/${cat.coverThumbStorageKey}`
            : null,
          _displayUrl: null,
        }
      : null;

  return {
    id: cat.slug, // slug, NOT uuid — for URL params and filter matching
    name: cat.name,
    description: "", // DB categories don't have descriptions (by design)
    coverPhoto,
  };
}

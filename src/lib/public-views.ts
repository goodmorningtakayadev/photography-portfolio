/**
 * Public views — view-shaped data for the public-facing portfolio.
 *
 * Each operation returns ready-to-render data tailored to one page. Hides
 * Drizzle, the CDN URL, variant selection, and row→view conversion behind a
 * focused interface. Read-only; no mutations.
 *
 * Operations are wrapped in React.cache so duplicate calls within a single
 * request (e.g. generateMetadata + the page) hit the DB once.
 */

import { cache } from "react";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  photos,
  photoVariants,
  photoCategories,
  categories,
  projects,
  projectPhotos,
} from "@/db/schema";
import { getSiteSettings } from "@/db/queries/settings";

// ── Public view types ──

export type PhotoView = {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  categoryName: string;
  categories: string[];
  date: string;
  published: boolean;
  order: number;
  /** EXIF-derived display strings (e.g. "56mm", "f/1.8"); populated only
      where the query fetches exif_data (project detail). */
  focal: string | null;
  aperture: string | null;
  /** Per-project editorial note (project_photos.scene_note); populated only
      in the project-detail path. Null = fall back to description. */
  sceneNote: string | null;
  /** Intrinsic pixel dimensions; populated in the project-detail path so
      scene figures can reserve the photo's natural aspect ratio. */
  width: number | null;
  height: number | null;
  _thumbUrl: string | null;
  _displayUrl: string | null;
};

export type CategoryView = {
  id: string;
  name: string;
  description: string;
  coverPhoto: PhotoView | null;
};

export type ProjectCardView = {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverPhoto: PhotoView | null;
  photoCount: number;
  publishedAt: Date | null;
};

export type ProjectDetailView = {
  id: string;
  title: string;
  slug: string;
  description: string;
  publishedAt: Date | null;
  coverPhoto: PhotoView | null;
  photos: PhotoView[];
  prevSlug: string | null;
  prevTitle: string | null;
  nextSlug: string | null;
  nextTitle: string | null;
  nextCoverUrl: string | null;
};

// ── Operations ──

export const getHomepageView = cache(async (): Promise<{
  featuredPhotos: PhotoView[];
  categories: CategoryView[];
  featuredProjects: ProjectCardView[];
  hero: { photo: PhotoView | null; focalX: number; focalY: number };
}> => {
  const [photoRows, categoryRows, projectRows, settings] = await Promise.all([
    fetchPublishedPhotosWithVariants(6),
    fetchCategoriesWithCovers(),
    fetchProjectCards(3),
    getSiteSettings(),
  ]);

  const cdnUrl = getCdnUrl();
  const heroPhoto = settings.heroPhotoId
    ? await fetchHeroPhotoView(settings.heroPhotoId, cdnUrl)
    : null;

  return {
    featuredPhotos: photoRows.map((p) => toPhotoView(p, cdnUrl)),
    categories: categoryRows.map((c) => toCategoryView(c, cdnUrl)),
    featuredProjects: projectRows.map((p) => toProjectCardView(p, cdnUrl)),
    hero: {
      photo: heroPhoto,
      focalX: settings.heroFocalX,
      focalY: settings.heroFocalY,
    },
  };
});

export const getGalleryView = cache(async (): Promise<{
  photos: PhotoView[];
  categories: CategoryView[];
}> => {
  const [photoRows, categoryRows] = await Promise.all([
    fetchPublishedPhotosWithVariants(),
    fetchCategoriesWithCovers(),
  ]);

  const cdnUrl = getCdnUrl();
  return {
    photos: photoRows.map((p) => toPhotoView(p, cdnUrl)),
    categories: categoryRows.map((c) => toCategoryView(c, cdnUrl)),
  };
});

export const listProjectCards = cache(async (): Promise<ProjectCardView[]> => {
  const rows = await fetchProjectCards();
  const cdnUrl = getCdnUrl();
  return rows.map((p) => toProjectCardView(p, cdnUrl));
});

export const listPublishedProjectSlugs = cache(async (): Promise<string[]> => {
  const rows = await db
    .select({ slug: projects.slug })
    .from(projects)
    .where(eq(projects.isPublished, true))
    .orderBy(asc(projects.sortOrder));
  return rows.map((r) => r.slug);
});

export const getProjectViewBySlug = cache(async (
  slug: string,
): Promise<ProjectDetailView | null> => {
  const [projectRow] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug), eq(projects.isPublished, true)))
    .limit(1);

  if (!projectRow) return null;

  const photoRows = await db
    .select({ photo: photos, sceneNote: projectPhotos.sceneNote })
    .from(projectPhotos)
    .innerJoin(photos, eq(projectPhotos.photoId, photos.id))
    .where(
      and(
        eq(projectPhotos.projectId, projectRow.id),
        eq(photos.status, "ready"),
      ),
    )
    .orderBy(asc(projectPhotos.sortOrder));

  const photoIds = photoRows.map((r) => r.photo.id);
  const [variantMap, catMap] = await fetchVariantsAndCategories(photoIds);

  // Adjacent slugs by sort order — one cheap query.
  const allProjects = await db
    .select({
      slug: projects.slug,
      title: projects.title,
      coverPhotoId: projects.coverPhotoId,
    })
    .from(projects)
    .where(eq(projects.isPublished, true))
    .orderBy(asc(projects.sortOrder));

  const idx = allProjects.findIndex((p) => p.slug === slug);
  const prev = idx > 0 ? allProjects[idx - 1] : null;
  // Next is cyclic — the last project wraps to the first (null when alone),
  // so the detail page's NEXT PROJECT block always has somewhere to go.
  const next =
    idx >= 0 && allProjects.length > 1
      ? allProjects[(idx + 1) % allProjects.length]
      : null;

  const cdnUrl = getCdnUrl();

  // Next project's cover (web_1200) for the NEXT block background.
  let nextCoverUrl: string | null = null;
  if (next?.coverPhotoId) {
    const [variant] = await db
      .select({ storageKey: photoVariants.storageKey })
      .from(photoVariants)
      .where(
        and(
          eq(photoVariants.photoId, next.coverPhotoId),
          eq(photoVariants.variantType, "web_1200"),
        ),
      )
      .limit(1);
    nextCoverUrl = variant ? `${cdnUrl}/${variant.storageKey}` : null;
  }
  const photoViews = photoRows.map((r) =>
    buildPhotoView({
      id: r.photo.id,
      storageKey: r.photo.storageKey,
      caption: r.photo.caption,
      altText: r.photo.altText,
      takenAt: r.photo.takenAt,
      createdAt: r.photo.createdAt,
      gallerySortOrder: r.photo.gallerySortOrder,
      thumbKey: variantMap.get(r.photo.id)?.thumb ?? null,
      webKey: variantMap.get(r.photo.id)?.web ?? null,
      categorySlugs: catMap.get(r.photo.id)?.slugs ?? [],
      categoryNames: catMap.get(r.photo.id)?.names ?? [],
      exifData: r.photo.exifData,
      width: r.photo.width,
      height: r.photo.height,
      sceneNote: r.sceneNote,
      cdnUrl,
    }),
  );

  // Cover is the project's coverPhotoId resolved against this project's photos.
  // Matches existing semantics: if the cover isn't a member of the project,
  // treat as no cover.
  const coverPhoto =
    projectRow.coverPhotoId !== null
      ? photoViews.find((p) => p.id === projectRow.coverPhotoId) ?? null
      : null;

  return {
    id: projectRow.id,
    title: projectRow.title,
    slug: projectRow.slug,
    description: projectRow.description ?? "",
    publishedAt: projectRow.publishedAt,
    coverPhoto,
    photos: photoViews,
    prevSlug: prev?.slug ?? null,
    prevTitle: prev?.title ?? null,
    nextSlug: next?.slug ?? null,
    nextTitle: next?.title ?? null,
    nextCoverUrl,
  };
});

// ── Internal: fetchers ──

type RawPhotoRow = {
  id: string;
  storageKey: string;
  caption: string | null;
  altText: string | null;
  takenAt: Date | null;
  createdAt: Date;
  gallerySortOrder: number;
};

type FullPhotoRow = RawPhotoRow & {
  thumbStorageKey: string | null;
  webStorageKey: string | null;
  categorySlugs: string[];
  categoryNames: string[];
};

type CategoryWithCoverRow = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  coverPhotoId: string | null;
  coverStorageKey: string | null;
  coverWebKey: string | null;
  coverCaption: string | null;
  coverAltText: string | null;
};

type ProjectCardRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: Date | null;
  cover: RawPhotoRow | null;
  coverThumbKey: string | null;
  coverWebKey: string | null;
  coverCategorySlugs: string[];
  coverCategoryNames: string[];
  photoCount: number;
};

async function fetchPublishedPhotosWithVariants(
  limit?: number,
): Promise<FullPhotoRow[]> {
  const baseQuery = db
    .select()
    .from(photos)
    .where(and(eq(photos.isPublished, true), eq(photos.status, "ready")))
    .orderBy(asc(photos.gallerySortOrder))
    .$dynamic();

  const photoRows = await (limit !== undefined
    ? baseQuery.limit(limit)
    : baseQuery);

  if (photoRows.length === 0) return [];

  const ids = photoRows.map((p) => p.id);
  const [variantMap, catMap] = await fetchVariantsAndCategories(ids);

  return photoRows.map((p) => ({
    id: p.id,
    storageKey: p.storageKey,
    caption: p.caption,
    altText: p.altText,
    takenAt: p.takenAt,
    createdAt: p.createdAt,
    gallerySortOrder: p.gallerySortOrder,
    thumbStorageKey: variantMap.get(p.id)?.thumb ?? null,
    webStorageKey: variantMap.get(p.id)?.web ?? null,
    categorySlugs: catMap.get(p.id)?.slugs ?? [],
    categoryNames: catMap.get(p.id)?.names ?? [],
  }));
}

/** Resolve the admin-selected hero photo (any ready photo) to a PhotoView. */
async function fetchHeroPhotoView(
  photoId: string,
  cdnUrl: string,
): Promise<PhotoView | null> {
  const [row] = await db
    .select()
    .from(photos)
    .where(and(eq(photos.id, photoId), eq(photos.status, "ready")))
    .limit(1);
  if (!row) return null;

  const [variantMap, catMap] = await fetchVariantsAndCategories([photoId]);
  return buildPhotoView({
    id: row.id,
    storageKey: row.storageKey,
    caption: row.caption,
    altText: row.altText,
    takenAt: row.takenAt,
    createdAt: row.createdAt,
    gallerySortOrder: row.gallerySortOrder,
    thumbKey: variantMap.get(photoId)?.thumb ?? null,
    webKey: variantMap.get(photoId)?.web ?? null,
    categorySlugs: catMap.get(photoId)?.slugs ?? [],
    categoryNames: catMap.get(photoId)?.names ?? [],
    cdnUrl,
  });
}

async function fetchVariantsAndCategories(photoIds: string[]): Promise<
  [
    Map<string, { thumb: string | null; web: string | null }>,
    Map<string, { slugs: string[]; names: string[] }>,
  ]
> {
  if (photoIds.length === 0) return [new Map(), new Map()];

  const [variantRows, catRows] = await Promise.all([
    db
      .select({
        photoId: photoVariants.photoId,
        variantType: photoVariants.variantType,
        storageKey: photoVariants.storageKey,
      })
      .from(photoVariants)
      .where(inArray(photoVariants.photoId, photoIds)),
    db
      .select({
        photoId: photoCategories.photoId,
        slug: categories.slug,
        name: categories.name,
      })
      .from(photoCategories)
      .innerJoin(categories, eq(photoCategories.categoryId, categories.id))
      .where(inArray(photoCategories.photoId, photoIds)),
  ]);

  const variantMap = new Map<
    string,
    { thumb: string | null; web: string | null }
  >();
  for (const v of variantRows) {
    const entry = variantMap.get(v.photoId) ?? { thumb: null, web: null };
    if (v.variantType === "thumb_200") entry.thumb = v.storageKey;
    if (v.variantType === "web_1200") entry.web = v.storageKey;
    variantMap.set(v.photoId, entry);
  }

  const catMap = new Map<string, { slugs: string[]; names: string[] }>();
  for (const r of catRows) {
    const entry = catMap.get(r.photoId) ?? { slugs: [], names: [] };
    entry.slugs.push(r.slug);
    entry.names.push(r.name);
    catMap.set(r.photoId, entry);
  }

  return [variantMap, catMap];
}

/**
 * Single query (one window function, one outer join) replacing the prior
 * 2N+1-queries-per-render pattern. Picks each category's first published
 * photo (lowest gallery_sort_order) as cover, plus its web_1200 variant.
 */
async function fetchCategoriesWithCovers(): Promise<CategoryWithCoverRow[]> {
  const result = await db.execute(sql`
    WITH ranked_covers AS (
      SELECT
        pc.category_id,
        p.id            AS photo_id,
        p.storage_key,
        p.caption,
        p.alt_text,
        pv.storage_key  AS web_key,
        ROW_NUMBER() OVER (
          PARTITION BY pc.category_id
          ORDER BY p.gallery_sort_order ASC
        ) AS rn
      FROM photo_categories pc
      INNER JOIN photos p
        ON p.id = pc.photo_id
        AND p.status = 'ready'
        AND p.is_published = true
      LEFT JOIN photo_variants pv
        ON pv.photo_id = p.id
        AND pv.variant_type = 'web_1200'
    )
    SELECT
      c.id              AS category_id,
      c.name            AS category_name,
      c.slug            AS category_slug,
      c.sort_order      AS category_sort_order,
      rc.photo_id       AS cover_photo_id,
      rc.storage_key    AS cover_storage_key,
      rc.caption        AS cover_caption,
      rc.alt_text       AS cover_alt_text,
      rc.web_key        AS cover_web_key
    FROM categories c
    LEFT JOIN ranked_covers rc ON rc.category_id = c.id AND rc.rn = 1
    ORDER BY c.sort_order ASC
  `);

  // neon-http db.execute returns { rows, rowCount, ... }.
  const rows = (result as unknown as { rows: Record<string, unknown>[] }).rows;
  return rows.map((r) => ({
    id: r.category_id as string,
    name: r.category_name as string,
    slug: r.category_slug as string,
    sortOrder: r.category_sort_order as number,
    coverPhotoId: (r.cover_photo_id as string | null) ?? null,
    coverStorageKey: (r.cover_storage_key as string | null) ?? null,
    coverCaption: (r.cover_caption as string | null) ?? null,
    coverAltText: (r.cover_alt_text as string | null) ?? null,
    coverWebKey: (r.cover_web_key as string | null) ?? null,
  }));
}

async function fetchProjectCards(limit?: number): Promise<ProjectCardRow[]> {
  // 1. Projects + cover photo (left join).
  const baseQuery = db
    .select({
      project: projects,
      cover: photos,
    })
    .from(projects)
    .leftJoin(photos, eq(photos.id, projects.coverPhotoId))
    .where(eq(projects.isPublished, true))
    .orderBy(asc(projects.sortOrder))
    .$dynamic();

  const projectRows = await (limit !== undefined
    ? baseQuery.limit(limit)
    : baseQuery);

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((r) => r.project.id);
  const coverIds = projectRows
    .map((r) => r.cover?.id)
    .filter((id): id is string => typeof id === "string");

  // 2. Photo counts per project (only ready photos count) and 3. cover
  // variants/categories — in parallel.
  const [countRows, [variantMap, catMap]] = await Promise.all([
    db
      .select({
        projectId: projectPhotos.projectId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(projectPhotos)
      .innerJoin(photos, eq(photos.id, projectPhotos.photoId))
      .where(
        and(
          inArray(projectPhotos.projectId, projectIds),
          eq(photos.status, "ready"),
        ),
      )
      .groupBy(projectPhotos.projectId),
    fetchVariantsAndCategories(coverIds),
  ]);

  const countMap = new Map(countRows.map((r) => [r.projectId, r.count]));

  return projectRows.map((r) => ({
    id: r.project.id,
    slug: r.project.slug,
    title: r.project.title,
    description: r.project.description,
    publishedAt: r.project.publishedAt,
    cover: r.cover
      ? {
          id: r.cover.id,
          storageKey: r.cover.storageKey,
          caption: r.cover.caption,
          altText: r.cover.altText,
          takenAt: r.cover.takenAt,
          createdAt: r.cover.createdAt,
          gallerySortOrder: r.cover.gallerySortOrder,
        }
      : null,
    coverThumbKey: r.cover ? variantMap.get(r.cover.id)?.thumb ?? null : null,
    coverWebKey: r.cover ? variantMap.get(r.cover.id)?.web ?? null : null,
    coverCategorySlugs: r.cover ? catMap.get(r.cover.id)?.slugs ?? [] : [],
    coverCategoryNames: r.cover ? catMap.get(r.cover.id)?.names ?? [] : [],
    photoCount: countMap.get(r.project.id) ?? 0,
  }));
}

// ── Internal: converters ──

function getCdnUrl(): string {
  return process.env.NEXT_PUBLIC_CDN_URL ?? "";
}

/** Pull a finite number out of the exif-reader jsonb blob's Photo group. */
function exifNumber(exif: unknown, key: string): number | null {
  if (typeof exif !== "object" || exif === null) return null;
  const photo = (exif as Record<string, unknown>)["Photo"];
  if (typeof photo !== "object" || photo === null) return null;
  const value = (photo as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildPhotoView(args: {
  id: string;
  storageKey: string;
  caption: string | null;
  altText: string | null;
  takenAt: Date | null;
  createdAt: Date;
  gallerySortOrder: number;
  thumbKey: string | null;
  webKey: string | null;
  categorySlugs: string[];
  categoryNames: string[];
  exifData?: unknown;
  width?: number | null;
  height?: number | null;
  sceneNote?: string | null;
  cdnUrl: string;
}): PhotoView {
  const { cdnUrl } = args;
  const focalMm =
    exifNumber(args.exifData, "FocalLengthIn35mmFilm") ??
    exifNumber(args.exifData, "FocalLength");
  const fNumber = exifNumber(args.exifData, "FNumber");
  return {
    id: args.id,
    title: args.caption || "Untitled",
    description: args.altText || args.caption || "",
    url: cdnUrl ? `${cdnUrl}/${args.storageKey}` : args.storageKey,
    category: args.categorySlugs[0] ?? "",
    categoryName: args.categoryNames[0] ?? "",
    categories: args.categorySlugs,
    date: (args.takenAt ?? args.createdAt).toISOString(),
    published: true,
    order: args.gallerySortOrder,
    focal: focalMm !== null ? `${Math.round(focalMm)}mm` : null,
    aperture: fNumber !== null ? `f/${Math.round(fNumber * 10) / 10}` : null,
    sceneNote: args.sceneNote ?? null,
    width: args.width ?? null,
    height: args.height ?? null,
    _thumbUrl: args.thumbKey ? `${cdnUrl}/${args.thumbKey}` : null,
    _displayUrl: args.webKey ? `${cdnUrl}/${args.webKey}` : null,
  };
}

function toPhotoView(row: FullPhotoRow, cdnUrl: string): PhotoView {
  return buildPhotoView({
    id: row.id,
    storageKey: row.storageKey,
    caption: row.caption,
    altText: row.altText,
    takenAt: row.takenAt,
    createdAt: row.createdAt,
    gallerySortOrder: row.gallerySortOrder,
    thumbKey: row.thumbStorageKey,
    webKey: row.webStorageKey,
    categorySlugs: row.categorySlugs,
    categoryNames: row.categoryNames,
    cdnUrl,
  });
}

function toCategoryView(
  row: CategoryWithCoverRow,
  cdnUrl: string,
): CategoryView {
  if (!row.coverPhotoId || !row.coverStorageKey) {
    return {
      id: row.slug,
      name: row.name,
      description: "",
      coverPhoto: null,
    };
  }

  // Category covers historically use web_1200 as their thumbnail and have
  // no _displayUrl — preserve that contract.
  return {
    id: row.slug,
    name: row.name,
    description: "",
    coverPhoto: {
      id: row.coverPhotoId,
      title: row.coverCaption || "Untitled",
      description: row.coverAltText || row.coverCaption || "",
      url: cdnUrl ? `${cdnUrl}/${row.coverStorageKey}` : row.coverStorageKey,
      category: row.slug,
      categoryName: row.name,
      categories: [row.slug],
      date: "",
      published: true,
      order: 0,
      focal: null,
      aperture: null,
      sceneNote: null,
      width: null,
      height: null,
      _thumbUrl: row.coverWebKey ? `${cdnUrl}/${row.coverWebKey}` : null,
      _displayUrl: null,
    },
  };
}

function toProjectCardView(
  row: ProjectCardRow,
  cdnUrl: string,
): ProjectCardView {
  const coverPhoto = row.cover
    ? buildPhotoView({
        id: row.cover.id,
        storageKey: row.cover.storageKey,
        caption: row.cover.caption,
        altText: row.cover.altText,
        takenAt: row.cover.takenAt,
        createdAt: row.cover.createdAt,
        gallerySortOrder: row.cover.gallerySortOrder,
        thumbKey: row.coverThumbKey,
        webKey: row.coverWebKey,
        categorySlugs: row.coverCategorySlugs,
        categoryNames: row.coverCategoryNames,
        cdnUrl,
      })
    : null;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    coverPhoto,
    photoCount: row.photoCount,
    publishedAt: row.publishedAt,
  };
}

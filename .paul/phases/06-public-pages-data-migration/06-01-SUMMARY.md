---
phase: 06-public-pages-data-migration
plan: 01
subsystem: ui, database
tags: [nextjs, isr, server-components, cdn, drizzle, photo-adapter]

requires:
  - phase: 04-object-storage
    provides: R2 storage, photo variants (thumb_200, web_1200), CDN delivery
  - phase: 05-admin-interface
    provides: Admin CMS to populate database with photos, categories, projects
provides:
  - Photo adapter layer (DB objects → legacy component-compatible view shapes)
  - CDN-aware image helpers (getImageUrl, getImageSrcSet support variant URLs)
  - Database-driven homepage (server component, ISR)
  - Database-driven gallery (server component, ISR, category filtering)
  - Batch-fetch query pattern for photos + variants + categories
affects: [06-02-projects-pages, 07-polish-deploy]

tech-stack:
  added: []
  patterns: [photo adapter layer for DB→view shape transformation, batch-fetch variants+categories in JS (avoids correlated subqueries), ISR with revalidate=3600]

key-files:
  created:
    - src/lib/photo-adapter.ts
    - src/app/(public)/page.tsx
    - src/app/(public)/gallery/page.tsx
    - src/app/(public)/about/page.tsx
  modified:
    - src/utils/imageHelpers.js
    - src/db/queries/photos.ts
    - src/page-components/Home.jsx
    - src/page-components/GalleryPage.jsx
    - src/components/Gallery/Gallery.jsx
    - src/components/EditorialSpread/EditorialSpread.jsx

key-decisions:
  - "Adapter pattern: DB objects transformed to legacy JSON-compatible shapes so page components need minimal changes"
  - "Batch-fetch variants in JS: correlated SQL subqueries failed with Drizzle/Neon — switched to separate queries + in-memory join"
  - "CategoryView.id = slug (not UUID): gallery filtering and URL params depend on slug strings"
  - "Projects tab removed from gallery: user direction — projects will get their own page and UX flow"
  - "Featured photos = top N by gallery_sort_order (no featured flag in DB — Phase 2 decision)"

patterns-established:
  - "Photo adapter pattern: toPhotoView() and toCategoryView() convert DB rows to component props"
  - "Batch-fetch pattern: query photos first, then batch-fetch variants + categories by photoId array, join in JS"
  - "ISR pattern: export const revalidate = 3600 on public server component pages"
  - "CDN image resolution: photo._thumbUrl / _displayUrl checked by getImageUrl before legacy fallback"

duration: ~25min
started: 2026-03-25T18:20:00Z
completed: 2026-03-25T18:45:00Z
---

# Phase 6 Plan 01: Gallery and Homepage Data Migration Summary

**Homepage and gallery migrated from static JSON to Postgres-driven server components with CDN image delivery via R2 variants, using an adapter layer to preserve pixel-identical component behavior.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 3 completed (2 auto + 1 human-verify) |
| Files created | 4 |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Homepage displays DB-driven content | Pass | Hero photo (first by gallery_sort_order), featured photos, category cards with cover photos — all from Postgres, images from CDN |
| AC-2: Gallery displays DB-driven content | Pass | All published photos from DB, category filter tabs work, Load More pagination works. Projects tab removed per user direction. |
| AC-3: Image URLs resolve via CDN | Pass | getImageUrl returns CDN variant URLs (thumb_200, web_1200). srcset populated correctly. Verified in browser devtools. |

## Accomplishments

- Photo adapter layer bridging DB schema to legacy component contracts — minimal changes to interactive components
- Batch-fetch query pattern avoiding correlated subquery issues with Neon HTTP driver
- Homepage and gallery fully database-driven with 1-hour ISR revalidation
- CDN image delivery with proper srcset for responsive loading (200w thumb, 1200w display)
- Gallery simplified — Projects tab removed, clean category-only filtering

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/photo-adapter.ts` | Created | PhotoView, CategoryView, CollectionView types + toPhotoView(), toCategoryView() converters |
| `src/app/(public)/page.tsx` | Created (replaced .jsx) | Server component fetching featured photos + categories from DB |
| `src/app/(public)/gallery/page.tsx` | Created (replaced .jsx) | Server component fetching all published photos + categories from DB |
| `src/app/(public)/about/page.tsx` | Created (replaced .jsx) | Server component wrapper (no data fetching — static content) |
| `src/utils/imageHelpers.js` | Modified | Dual-path getImageUrl: CDN variant URLs for DB photos, static paths for legacy |
| `src/db/queries/photos.ts` | Modified | Added 4 functions: getPublishedPhotosWithVariants, getFeaturedPhotosWithVariants, getCategoriesWithCoverPhoto, getPublishedProjectsWithPhotos |
| `src/page-components/Home.jsx` | Modified | Accepts {photos, categories} props instead of importing JSON. Category cards use cat.coverPhoto. |
| `src/page-components/GalleryPage.jsx` | Modified | Accepts {photos, categories} props. Projects tab and all collection logic removed. |
| `src/components/Gallery/Gallery.jsx` | Modified | Renders photo.categoryName for display (one-line change) |
| `src/components/EditorialSpread/EditorialSpread.jsx` | Modified | Renders photo.categoryName for display (one-line change) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Batch-fetch variants in JS instead of SQL subqueries | Correlated subqueries returned null with Drizzle's neon-http driver — raw SQL alias JOINs also unreliable | Reliable pattern: 3 parallel queries + in-memory join. Slightly more round-trips but correct results. |
| Remove Projects tab from gallery | User direction: projects will get their own page with distinct UX flow | Gallery simplified to photo-only with category filters. Projects page deferred. |
| CategoryView.id = slug | Gallery filtering, URL params, and CategoryFilter.jsx all use category.id for matching. DB categories have UUID ids. Using slug preserves all existing component logic. | Components work without modification to filtering/URL logic |
| Featured photos = gallery_sort_order top N | DB has no `featured` flag (Phase 2 decision). User has ordered photos meaningfully in admin. | Homepage shows first 3 photos by sort order as featured. Hero = first photo. |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Query approach changed — correlated subqueries → batch-fetch |
| Scope changes | 1 | Projects tab removed from gallery (user direction) |
| Deferred | 2 | About page CDN photo, projects page |

### Auto-fixed: Correlated subquery failure

- **Found during:** Task 1 verification
- **Issue:** Correlated SQL subqueries for variant storage keys returned null at runtime. Drizzle's `sql` template with `${photos.id}` inside subqueries didn't correctly reference the outer query's column.
- **Fix:** Switched to batch-fetch pattern — query photos first, then batch-fetch variants and categories by photoId array, join in JavaScript.
- **Verification:** Gallery thumbnails confirmed loading web_1200.webp variants with populated srcset.

### Scope Change: Projects tab removed

- **User direction:** "You can remove the projects tab, eventually I will make projects its own page and have its own UX flow"
- **Impact:** GalleryPage.jsx simplified significantly — removed all collection/project logic, useViewCursor for projects grid, back-to-projects navigation. Gallery route no longer fetches project data.

### Deferred Items

- About page photo from CDN + admin-configurable (user requested, deferred to future plan — needs site_settings mechanism)
- Featured section showing 3 selected projects instead of photos (user mentioned, deferred)

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| TypeScript `never[]` inference on JSX default props | Removed default parameter values from GalleryPage/Home — server components always provide props |
| Correlated subqueries returning null | Switched to batch-fetch pattern (3 queries + JS join) |

## Next Phase Readiness

**Ready:**
- Homepage and gallery fully database-driven
- Photo adapter layer reusable for future pages (projects page can use same toPhotoView)
- ISR configured — will wire up revalidateTag in Plan 06-02
- CDN image delivery working end-to-end

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 06-public-pages-data-migration, Plan: 01*
*Completed: 2026-03-25*

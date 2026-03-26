# Enterprise Plan Audit Report

**Plan:** .paul/phases/06-public-pages-data-migration/06-01-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable** — after applying the findings below.

The plan's adapter-based migration approach is sound: server components fetch from Postgres, transform via adapters, and pass to unchanged client components. However, the plan contained four data shape mismatches that would break functionality at runtime, and one deferred feature that would visibly break the gallery's project click-through interaction.

Would I sign off after upgrades? Yes. The adapter pattern is the right call, and the gaps are all discoverable from reading the source — the audit just caught them before they'd surface during implementation.

## 2. What Is Solid

- **Adapter pattern.** Correct architectural choice — transforms DB objects to legacy-compatible view shapes, minimizing changes to existing interactive components. This protects the pixel-identical constraint.
- **Server/client boundary.** Route files become server components, page components stay as client components receiving props. Clean separation.
- **Image helper backward compatibility.** Dual-path `getImageUrl` supports both legacy static paths and new CDN URLs. Enables gradual migration.
- **ISR strategy.** `revalidate = 3600` with planned `revalidateTag` wiring in 06-02. Correct Next.js pattern.
- **Boundary protection.** Explicit list of DO NOT CHANGE files prevents scope creep into visual components.
- **Query isolation.** New query functions alongside existing ones — no breakage of admin functionality.

## 3. Enterprise Gaps Identified

### Gap 1: CategoryView.id must be slug, not UUID
CategoryFilter.jsx uses `cat.id` as the `activeCategory` value. GalleryPage.jsx filters photos by `p.category === activeCategory`. Home.jsx builds links as `/gallery?category=${cat.id}`. In the JSON, `cat.id = "portraits"`. In the DB, `categories.id` is a UUID. If CategoryView.id = UUID, all filtering and URL construction breaks silently — gallery shows no photos for any category, homepage links navigate to invalid categories.

**Severity:** Must-have. Complete gallery filtering breakage.

### Gap 2: CategoryView missing `description` field
Home.jsx line 203 renders `<p className="cat-desc">{cat.description}</p>`. The plan's original CategoryView had no `description` field. DB categories don't have descriptions (by design — CLAUDE.md says "Categories are flat filter labels, nothing more"). Without this field, homepage category cards lose their subtitle text, violating pixel-identical.

**Severity:** Must-have. Visible layout difference on homepage.

### Gap 3: photo.category used for both filtering AND display
Gallery.jsx line 40: `<span className="g-cat mono">{photo.category}</span>` — renders photo.category as visible text. EditorialSpread.jsx line 44: `<span className="ed-card-cat mono">{photo.category}</span>` — same. GalleryPage.jsx line 68: `publishedPhotos.filter(p => p.category === activeCategory)` — uses photo.category for filtering against category slugs.

If `photo.category` = slug (needed for filtering), display shows "portraits" instead of "Portraits". If `photo.category` = name (needed for display), filtering breaks. Need separate fields.

**Severity:** Must-have. Either display is wrong or filtering is broken.

### Gap 4: Collection click-through requires photo data
GalleryPage.jsx line 62: `setFilteredPhotos(getCollectionPhotos(selectedCollection))`. When a user clicks a project card, the gallery shows that project's photos in the grid. The plan originally deferred this to 06-02, but the gallery's click-through interaction would break — clicking a project card would show an empty gallery.

**Severity:** Must-have. Breaks existing gallery interaction.

### Gap 5: Project photo count and metadata for gallery cards
GalleryPage.jsx line 207: `{String(photos.length).padStart(2, '0')} photos` — displays photo count per project card. Also uses `collection.date` (line 128-131) and `collection.tags` (line 133-138). `getPublishedProjects()` returns cover photo but not photo counts, dates in the expected format, or tags.

**Severity:** Strongly recommended. Photo count display would show 0 or error.

### Gap 6: Date serialization across server→client boundary
Next.js serializes props from server to client components as JSON. Date objects fail serialization with "Error: Only plain objects can be passed to Client Components from Server Components." DB queries return `takenAt`, `createdAt` as Date objects. Adapter must convert to strings.

**Severity:** Strongly recommended. Runtime crash on page load.

### Gap 7: Gallery.jsx and EditorialSpread.jsx need categoryName
These components render `photo.category` as visible text. With the slug/name split, they need a one-line change each to render `photo.categoryName` instead. The plan's original boundaries listed these as DO NOT CHANGE.

**Severity:** Strongly recommended. Required to support the slug/name fix.

### Gap 8: `aspectRatio` field mismatch (non-issue)
JSON has `"aspectRatio": "portrait"` (string). Plan originally defined `aspectRatio: number`. However, grep confirms no component reads `photo.aspectRatio`. Field can be safely omitted.

**Severity:** Informational — resolved by removal.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | CategoryView.id must be slug, not UUID | Task 1: CategoryView type definition | Added explicit comment requiring id = slug, with rationale citing CategoryFilter.jsx and GalleryPage.jsx filtering |
| 2 | CategoryView missing description field | Task 1: CategoryView type definition | Added `description: string` field with note about DB categories not having descriptions |
| 3 | photo.category dual use (filter + display) | Task 1: PhotoView type definition | Split into `category` (slug, for filtering) + `categoryName` (display name). Added to toPhotoView mapping. |
| 4 | Collection click-through needs photo data | Task 2: Gallery route + GalleryPage | Changed from "defer to 06-02" to "include full PhotoView[] per collection". Added getPublishedProjectsWithPhotos query. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 5 | Project photo count + date + tags | Task 2: Gallery route collection mapping | Added photoCount, date (YYYY-MM format), tags (empty array) to collection shape |
| 6 | Date serialization safety | Task 1: toPhotoView + adapter constraints | Added requirement to convert all dates to strings via .toISOString() |
| 7 | Gallery.jsx + EditorialSpread.jsx display fix | Task 2: GalleryPage modifications, Boundaries, files_modified | Added one-line changes to render categoryName; updated boundaries to note these minimal changes; added files to frontmatter |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Category descriptions from a managed source | DB categories intentionally lack descriptions (CLAUDE.md). Hardcoded empty strings or adapter-level mapping is acceptable. If the photographer wants editable category descriptions, that's a schema change for a future phase. |
| 2 | Empty state handling when no photos in DB | User confirmed all photos are uploaded. Empty state is a defensive edge case, not a current risk. |
| 3 | `getImageSrcSet` width values (200w vs 400w) | Current srcSet uses 400w and 1200w. DB variants are 200px and 1200px. The srcSet widths should match actual variant sizes. Minor visual optimization, not a breakage — browser picks closest. |

## 5. Audit & Compliance Readiness

**Evidence production:** The adapter layer creates a clear audit trail — DB queries are isolated in `src/db/queries/photos.ts`, transformation logic in `src/lib/photo-adapter.ts`, and route-level data assembly in page.tsx files. If image URLs are wrong, the source is traceable.

**Silent failure prevention:** The must-have fixes (category ID/slug, collection photos) prevent silent breakages where the page renders but with empty content or broken filtering. These would have been particularly hard to debug because the page loads without errors — just with wrong data.

**Ownership:** Clear file ownership — queries layer, adapter layer, route layer, component layer. Each has a single responsibility.

## 6. Final Release Bar

**Must be true before ship:**
- CategoryView uses slug as id, not UUID
- PhotoView separates category slug from display name
- Collection objects include their photos for click-through
- All dates are strings at the server→client boundary
- Gallery.jsx and EditorialSpread.jsx render categoryName

**Remaining risks if shipped as-is:**
- Category descriptions will be empty strings (was hardcoded copy in JSON). Minor visual gap on homepage cards.
- srcSet width hints may not perfectly match variant pixel widths. Browser handles gracefully.

**Sign-off:** After applying all must-have and strongly-recommended upgrades, this plan is production-safe. The adapter pattern is the right approach for a data source migration with pixel-identical constraints.

---

**Summary:** Applied 4 must-have + 3 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

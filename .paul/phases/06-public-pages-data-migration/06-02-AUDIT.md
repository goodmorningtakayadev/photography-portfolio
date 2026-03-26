# Enterprise Plan Audit Report

**Plan:** .paul/phases/06-public-pages-data-migration/06-02-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable** — after applying the findings below.

The editorial magazine concept is ambitious and well-specified — the template cycling algorithm, scroll-snap sections, and design details are clear enough to implement without guessing. The revalidation wiring is comprehensive. However, two critical issues would cause silent failures at runtime: the revalidation API (`revalidateTag`) doesn't work with Drizzle queries, and the project detail page would get photos without CDN variant URLs.

After upgrades? Yes — the plan is production-safe and the editorial UX direction is the right call for a photography portfolio.

## 2. What Is Solid

- **Editorial template algorithm.** The cycling logic (Title Card → Hero → Diptych/Editorial/Detail → End Card) is well-defined with clear rules for odd photo counts. This gives implementation clarity without over-specifying.
- **Separation of concerns.** Server components handle data fetching, client components handle scroll-snap and interactions. Clean boundary.
- **Comprehensive revalidation matrix.** Every admin mutation endpoint is mapped to the pages it affects. No blind spots.
- **Accessibility considered.** prefers-reduced-motion, aria-labels on sections, keyboard navigation via ArrowDown/Up — these are often forgotten in editorial/magazine experiences.
- **Design constraint preservation.** Boundaries protect all completed work. New pages get their own design within the established Dark Cinematic Brutalism language.
- **Progressive disclosure.** The scroll-snap creates a natural reveal cadence — one spread at a time, rather than overwhelming with all photos at once.

## 3. Enterprise Gaps Identified

### Gap 1: revalidateTag doesn't work with Drizzle queries
`revalidateTag` invalidates `fetch`-based cache entries or data wrapped in `unstable_cache`. Public pages use direct Drizzle queries to Postgres — these bypass Next.js's data cache entirely. Calling `revalidateTag('gallery')` after an admin mutation would be a no-op. Pages would only refresh when the 3600s TTL expires.

**Severity:** Must-have. The entire revalidation feature (AC-3) would silently fail.

### Gap 2: getProjectBySlug returns photos without variants
The plan says to use `getProjectBySlug()` for the detail page. This function returns raw `Photo[]` objects — no `thumbStorageKey`, `webStorageKey`, `categorySlugs`, or `categoryNames`. `toPhotoView()` requires `PhotoWithVariantsAndCategories` inputs. Without variants, all editorial spread images would fall back to original files (no srcset, larger downloads).

**Severity:** Must-have. Image delivery degradation + TypeScript type error.

### Gap 3: Hero spread references retina_2400 variant
AC-2 says "retina_2400 for hero spreads" but PhotoView only has `_thumbUrl` and `_displayUrl`. No `_retinaUrl` exists. The query doesn't fetch retina_2400 variants.

**Severity:** Strongly recommended. Use `photo.url` (original) for hero spreads — full quality, already available.

### Gap 4: "Next Project" link needs adjacent project data
The end card has "Next Project" link, but the detail page server component only fetches the current project. It needs the next project's slug and title (by sort_order) to render the link.

**Severity:** Strongly recommended. End card would have a broken/missing "Next Project" link.

### Gap 5: Diptych photo consumption ambiguity
The template cycle mentions Diptych but doesn't explicitly state it consumes 2 photos from the photo array. Without a cursor/index tracking how many photos each template consumes, the implementation will misalign photos with templates.

**Severity:** Strongly recommended. Off-by-one in photo indexing.

### Gap 6: Mandatory scroll-snap on mobile
`scroll-snap-type: y mandatory` hijacks natural mobile scrolling. On mobile, users expect fluid scroll — mandatory snap feels "sticky" and disorienting, especially for content-heavy pages. Most editorial sites use proximity on mobile.

**Severity:** Strongly recommended. Poor mobile UX for the primary audience (mobile visitors).

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | revalidateTag → revalidatePath | Task 2: entire revalidation strategy | Replaced all `revalidateTag` with `revalidatePath` using specific page paths. Added explanation of why revalidateTag doesn't work with Drizzle. |
| 2 | getProjectBySlug lacks variants | Task 1: project detail route | Added note to NOT use getProjectBySlug, use getPublishedProjectsWithPhotos or create new variant-enriched query. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 3 | Hero spread retina_2400 | Task 1: Hero Spread template, AC-2 | Changed to use `photo.url` (original). Removed retina_2400 reference from AC-2. |
| 4 | Next project data | Task 1: project detail route | Added requirement to pass nextProject/prevProject slugs+titles as props. |
| 5 | Diptych photo consumption | Task 1: template assignment | Added explicit note that Diptych consumes 2 photos, track cursor/index. |
| 6 | Mobile scroll-snap proximity | Task 1: responsive section | Changed mobile/tablet to `scroll-snap-type: y proximity`. Desktop stays mandatory. |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Wrap Drizzle queries with `unstable_cache` + tags for more granular invalidation | revalidatePath works correctly for current needs. unstable_cache would enable tag-based invalidation but adds complexity. Can adopt later if page count grows. |
| 2 | Preload retina_2400 variant for hero spreads | Original file works. Adding a third variant URL to the adapter is a minor optimization — can add _retinaUrl to PhotoView in Phase 7. |
| 3 | Scroll position persistence when navigating back from project detail | Browser back button should handle this naturally with ISR pages, but explicit scroll restoration could be added in Phase 7. |

## 5. Audit & Compliance Readiness

**Evidence production:** revalidatePath calls create a clear cause-effect chain — admin mutation → specific page invalidation → visitor sees updated content. Each call is traceable to a specific API endpoint.

**Silent failure prevention:** The must-have revalidateTag→revalidatePath fix prevents the most dangerous silent failure — pages appearing to accept admin changes but never actually updating for visitors.

**Post-incident reconstruction:** If a page shows stale content, the revalidatePath calls in API routes provide a clear audit trail of which mutations should have triggered regeneration.

## 6. Final Release Bar

**Must be true before ship:**
- revalidatePath (not revalidateTag) used in all admin mutations
- Project detail page fetches variant-enriched photo data
- Hero spreads use original URL (not missing retina field)
- Mobile scroll-snap uses proximity, not mandatory
- End card has valid next/prev project links

**Remaining risks:**
- Editorial layout quality is subjective — checkpoint:human-verify handles this
- Scroll-snap behavior varies across browsers — test on Chrome, Firefox, Safari

**Sign-off:** After applying all upgrades, this plan delivers a distinctive editorial experience with correct ISR revalidation. The editorial magazine direction is the right differentiator for a photography portfolio.

---

**Summary:** Applied 2 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

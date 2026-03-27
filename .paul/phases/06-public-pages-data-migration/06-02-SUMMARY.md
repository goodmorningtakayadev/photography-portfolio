---
phase: 06-public-pages-data-migration
plan: 02
subsystem: ui, api
tags: [nextjs, isr, revalidatePath, projects, editorial-layout, scroll-snap, css-modules]

requires:
  - phase: 06-public-pages-data-migration
    plan: 01
    provides: Photo adapter layer, CDN image helpers, batch-fetch query pattern, ISR setup
  - phase: 05-admin-interface
    provides: Project CRUD, photo management, category management endpoints
provides:
  - Public projects listing page (/projects)
  - Editorial magazine project detail page (/projects/[slug])
  - ISR revalidation wired into all admin mutation endpoints
  - Homepage featured section showing projects (via EditorialSpread)
affects: [07-polish-deploy]

tech-stack:
  added: []
  patterns: [editorial magazine scroll-snap layout, revalidatePath for ISR with Drizzle (not revalidateTag), CSS files over styled-jsx for scoped styles]

key-files:
  created:
    - src/app/(public)/projects/page.tsx
    - src/app/(public)/projects/[slug]/page.tsx
    - src/page-components/ProjectsPage.tsx
    - src/page-components/ProjectsPage.css
    - src/page-components/ProjectDetailPage.tsx
    - src/page-components/ProjectDetailPage.css
  modified:
    - src/app/api/photos/[id]/route.ts
    - src/app/api/photos/bulk/route.ts
    - src/app/api/projects/route.ts
    - src/app/api/projects/[id]/route.ts
    - src/app/api/projects/[id]/photos/route.ts
    - src/app/api/categories/route.ts
    - src/app/api/categories/[id]/route.ts
    - src/components/Header/Header.jsx
    - src/page-components/Home.jsx
    - src/page-components/Home.css

key-decisions:
  - "revalidatePath instead of revalidateTag: Drizzle queries bypass Next.js fetch cache, so revalidateTag is a no-op"
  - "Editorial magazine layout for project detail: scroll-snapping spreads (hero, diptych, editorial, detail) — not a gallery grid"
  - "CSS files instead of styled-jsx: styled-jsx scoping broke all component styles at runtime"
  - "Homepage featured shows projects not photos: user-directed, reuses EditorialSpread with project cover photos"
  - "Mobile scroll-snap: proximity not mandatory: mandatory hijacks natural mobile scrolling"
  - "Project cards: custom hover with typing animation on title (1.5s reveal)"

patterns-established:
  - "revalidatePath pattern: call after every admin mutation, targeting affected public routes"
  - "Editorial scroll-snap layout: title card → hero → cycled spreads → end card with nav"
  - "CSS files for page components: more reliable than styled-jsx for scoped styles"

duration: ~35min
started: 2026-03-26T00:00:00Z
completed: 2026-03-26T00:35:00Z
---

# Phase 6 Plan 02: Projects Pages + ISR Revalidation Summary

**Public projects listing and editorial magazine project detail pages with scroll-snapping spreads, plus ISR revalidation wired into all 7 admin API route files via revalidatePath.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~35 min |
| Started | 2026-03-26 |
| Completed | 2026-03-26 |
| Tasks | 3 completed (2 auto + 1 human-verify) |
| Files created | 6 |
| Files modified | 10 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Projects Listing Page | Pass | /projects renders published projects with cover photos, Dark Cinematic Brutalism design, custom hover typing animation |
| AC-2: Individual Project Page (Editorial Magazine) | Pass | /projects/[slug] renders title card → hero → diptych/editorial/detail spreads → end card. Scroll-snap works. Progress indicator tracks position. generateStaticParams generates paths for all published slugs. |
| AC-3: ISR Revalidation from Admin Mutations | Pass | revalidatePath called in all 7 API route files after mutations. Photo, project, category, and bulk endpoints all trigger appropriate path invalidation. |

## Accomplishments

- Projects listing page with Dark Cinematic Brutalism design and custom typing animation hover effect on project cards
- Editorial magazine project detail with scroll-snapping spreads (title card, hero, diptych, editorial, detail, end card) and scroll progress indicator
- ISR revalidation wired into all admin mutation endpoints using revalidatePath (7 API route files)
- Homepage featured section converted from photos to projects using EditorialSpread layout
- "Projects" added to public navigation bar

## Task Commits

All code committed in a single WIP commit during the session:

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| All tasks | `f8cbcb9` | wip | DB-driven homepage, gallery, projects pages + ISR revalidation |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/app/(public)/projects/page.tsx` | Created | Server component fetching published projects from DB |
| `src/app/(public)/projects/[slug]/page.tsx` | Created | Server component with generateStaticParams for project detail |
| `src/page-components/ProjectsPage.tsx` | Created | Projects listing client component with typing animation hover |
| `src/page-components/ProjectsPage.css` | Created | Scoped styles for projects listing |
| `src/page-components/ProjectDetailPage.tsx` | Created | Editorial magazine layout with scroll-snapping spreads |
| `src/page-components/ProjectDetailPage.css` | Created | Scoped styles for editorial spreads |
| `src/app/api/photos/[id]/route.ts` | Modified | Added revalidatePath for /, /gallery, /projects after photo mutations |
| `src/app/api/photos/bulk/route.ts` | Modified | Added revalidatePath for /, /gallery after bulk archive/restore/categorize |
| `src/app/api/projects/route.ts` | Modified | Added revalidatePath for /projects after project create |
| `src/app/api/projects/[id]/route.ts` | Modified | Added revalidatePath for /projects, /projects/[slug] after project update/delete |
| `src/app/api/projects/[id]/photos/route.ts` | Modified | Added revalidatePath for /projects/[slug] after photo add/reorder/remove |
| `src/app/api/categories/route.ts` | Modified | Added revalidatePath for /, /gallery after category create |
| `src/app/api/categories/[id]/route.ts` | Modified | Added revalidatePath for /, /gallery after category update/delete |
| `src/components/Header/Header.jsx` | Modified | Added "Projects" nav link between Home and Gallery |
| `src/page-components/Home.jsx` | Modified | Featured section shows projects via EditorialSpread instead of photos |
| `src/page-components/Home.css` | Modified | Styles for featured projects section |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| revalidatePath instead of revalidateTag | Drizzle queries go directly to DB, bypassing Next.js fetch cache — revalidateTag is a no-op | All ISR invalidation uses path-based approach |
| Editorial magazine layout for project detail | User chose Option C (hybrid magazine with scroll-snap spreads) over grid or lightbox | Unique immersive viewing experience per project |
| CSS files instead of styled-jsx | styled-jsx scoping broke all component styles at runtime | More reliable, standard CSS approach |
| Homepage featured shows projects not photos | User direction — EditorialSpread reused with project cover photos | Homepage drives traffic to project pages |
| Mobile scroll-snap: proximity not mandatory | Audit catch — mandatory snap hijacks natural mobile scrolling | Better mobile UX |
| Typing animation on project card hover | User-directed design tweak during checkpoint | 1.5s title reveal animation on card hover |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope additions | 3 | User-directed design changes during checkpoint |
| Deferred | 3 | Logged for future phases |

**Total impact:** User-directed refinements, no unplanned scope creep.

### Scope Additions (User-Directed)

1. **Homepage featured section → projects** — Changed from featured photos to featured projects using EditorialSpread. Not in original plan scope (boundaries said "No changes to homepage featured section") but user explicitly requested it.

2. **Typing animation on project cards** — Custom hover effect with 1.5s title reveal animation. Design enhancement requested during checkpoint.

3. **CSS files over styled-jsx** — Migrated from `<style jsx>` to standalone CSS files after styled-jsx scoping broke styles at runtime.

### Deferred Items

- About page photo from CDN + admin-configurable (needs site_settings table)
- Featured section showing user-selectable projects from admin (currently shows first 3 by sort_order)
- `unstable_cache` wrapping for granular tag-based invalidation (revalidatePath works for now)

### Skill Audit

| Expected | Invoked | Notes |
|----------|---------|-------|
| /frontend-design | ✓ | Invoked for projects listing and detail page implementation |

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| styled-jsx scoping broke component styles | Migrated to standalone CSS files |
| revalidateTag no-op with Drizzle queries | Switched to revalidatePath (audit catch) |

## Next Phase Readiness

**Ready:**
- All public pages database-driven (homepage, gallery, projects)
- ISR revalidation wired end-to-end (admin mutation → path invalidation → page regeneration)
- Editorial magazine UX established for project viewing
- Photo adapter layer shared across all public pages

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 06-public-pages-data-migration, Plan: 02*
*Completed: 2026-03-26*

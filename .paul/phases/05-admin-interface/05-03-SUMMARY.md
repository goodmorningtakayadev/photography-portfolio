---
phase: 05-admin-interface
plan: 03
subsystem: ui, api
tags: [nextjs, drizzle, drag-and-drop, crud, bulk-operations, neon-batch]

requires:
  - phase: 05-admin-interface (05-01)
    provides: Admin layout, sidebar nav, photo management, Dark Cinematic Brutalism design
  - phase: 05-admin-interface (05-02)
    provides: Upload interface, category CRUD, slugify function
provides:
  - Project CRUD API (list, create, edit, delete, publish)
  - Project photo management (add, remove, reorder via drag-and-drop, cover photo)
  - Bulk photo operations (multi-select archive, restore, set categories)
  - Admin project list page and project editor page
  - Photo picker modal for adding photos to projects
affects: [06-public-pages-data-migration]

tech-stack:
  added: []
  patterns: [db.batch() for atomic multi-query operations, native HTML drag-and-drop reorder, optimistic UI with revert on error, discriminated union Zod schemas]

key-files:
  created:
    - src/app/api/projects/route.ts
    - src/app/api/projects/[id]/route.ts
    - src/app/api/projects/[id]/photos/route.ts
    - src/app/api/photos/bulk/route.ts
    - src/app/admin/projects/page.tsx
    - src/app/admin/projects/new/page.tsx
    - src/app/admin/projects/[id]/page.tsx
    - src/components/admin/ProjectList.tsx
    - src/components/admin/ProjectEditor.tsx
  modified:
    - src/db/queries/admin.ts
    - src/components/admin/PhotoGrid.tsx

key-decisions:
  - "db.batch() for atomic reorder: neon-http lacks db.transaction(), so PUT reorder uses batch delete+re-insert"
  - "Bulk categorize is REPLACE semantics: deletes all existing, inserts new — UI labels this clearly"
  - "Photo picker uses server-provided data: availablePhotos passed as prop, filtered client-side"
  - "Native HTML drag events for reorder: no external library dependency"
  - "Optimistic reorder with revert on API failure"
  - "Discriminated union Zod schema for bulk actions (archive | restore | categorize)"

patterns-established:
  - "db.batch() pattern for multi-statement atomicity on neon-http"
  - "Native drag-and-drop for ordered lists (dragStart → dragEnter → drop → persist)"
  - "Photo picker modal pattern: server-fetched availablePhotos, client-filtered by existing membership"
  - "Bulk operation pattern: discriminated union Zod schema, batch queries, consolidated refresh"

duration: ~10min
started: 2026-03-25T18:00:00Z
completed: 2026-03-25T18:10:00Z
---

# Phase 5 Plan 03: Project Management & Bulk Operations Summary

**Project CRUD with drag-and-drop photo ordering, cover photo selection, and bulk photo operations (archive, restore, set categories) using db.batch() for atomicity.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 3 completed (2 auto + 1 human-verify) |
| Files created | 9 |
| Files modified | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Project CRUD | Pass | Create, edit, delete, publish/unpublish all functional. Slug auto-generation + uniqueness enforcement (409). ON DELETE CASCADE cleans up join rows. |
| AC-2: Project Photo Management | Pass | Add photos via picker modal, drag-and-drop reorder with optimistic update, set/clear cover photo with ember indicator, remove photo (project_photos row only). |
| AC-3: Bulk Photo Operations | Pass | Selection mode with checkboxes, floating action bar, bulk archive/restore with db.batch(), bulk set categories (REPLACE semantics) with db.batch(). UI clearly labels "Replaces existing categories". |

## Accomplishments

- Full project CRUD with 3 API routes covering all operations (list, create, edit, delete, publish, photo management, reorder)
- Atomic photo reorder using db.batch() — prevents data loss on partial failure between delete+re-insert
- Bulk operations endpoint handling archive, restore, and categorize with discriminated union Zod validation
- Photo picker modal with server-provided data and client-side filtering of already-added photos
- Native HTML drag-and-drop with optimistic UI and automatic revert on API error
- Dark Cinematic Brutalism design consistency across all new components

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/app/api/projects/route.ts` | Created | GET (list with photo count + cover thumb), POST (create with auto-slug + sort order) |
| `src/app/api/projects/[id]/route.ts` | Created | GET (project + photos), PATCH (fields + coverPhotoId validation), DELETE (with confirm) |
| `src/app/api/projects/[id]/photos/route.ts` | Created | POST (add with validation), PUT (reorder via db.batch), DELETE (remove + cover clear) |
| `src/app/api/photos/bulk/route.ts` | Created | POST with discriminated union: archive (batch), restore, categorize (batch replace) |
| `src/app/admin/projects/page.tsx` | Created | Server component — fetches projects, renders heading + "New Project" + ProjectList |
| `src/app/admin/projects/new/page.tsx` | Created | Client component — title input form, POST to API, redirect to editor |
| `src/app/admin/projects/[id]/page.tsx` | Created | Server component — fetches project + available photos + categories, renders ProjectEditor |
| `src/components/admin/ProjectList.tsx` | Created | Card grid with cover thumb, photo count, published indicator, hover action overlay |
| `src/components/admin/ProjectEditor.tsx` | Created | Two-panel editor: details form (left) + photo grid with drag-and-drop (right) + picker modal |
| `src/db/queries/admin.ts` | Modified | Added getAllProjectsAdmin(), getProjectByIdAdmin() + types (ProjectWithMeta, ProjectDetail) |
| `src/components/admin/PhotoGrid.tsx` | Modified | Added selection mode, bulk actions bar, category picker, bulk archive/restore/categorize |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| db.batch() for atomic reorder | neon-http driver lacks db.transaction() — batch sends queries as single HTTP transaction | Prevents data loss if connection fails between delete and insert |
| REPLACE semantics for bulk categorize | CLAUDE.md specifies categories are set, not appended — clearer mental model | UI labels "Replaces existing categories" to avoid confusion |
| Discriminated union Zod schema for bulk | Type-safe routing of archive/restore/categorize in single endpoint | Clean pattern, validates action-specific fields (e.g. categoryIds only on categorize) |
| Native HTML drag events | Avoids external library dependency, consistent with UploadDropzone pattern | Lightweight, no bundle impact |
| Server-provided availablePhotos | Photo picker needs ready photos — client component can't fetch server-side | getAllPhotosAdmin({ status: "ready", limit: 500 }) passed as prop |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | None |
| Scope additions | 1 | Minor — bulk restore added |
| Deferred | 0 | None |

**Total impact:** Minimal — one minor scope addition (bulk restore) that fits naturally.

### Scope Addition: Bulk Restore

Bulk restore was added alongside bulk archive in the bulk API and PhotoGrid UI. This wasn't explicitly in the plan's AC-3 but is the natural complement to bulk archive and was straightforward to include.

## Issues Encountered

None — plan executed cleanly. Code was fully built in a prior session and verified against all plan requirements and audit upgrades.

## Skill Audit

All required skills invoked:
- /frontend-design — loaded
- /ui-ux-pro-max — loaded
- /bencium-controlled-ux-designer — loaded

## Next Phase Readiness

**Ready:**
- Complete admin CMS: dashboard, photo management, upload, categories, projects, bulk operations
- All CRUD APIs in place for photos, categories, projects
- Database fully populated via admin interface
- Phase 6 can now switch public pages from static JSON to database-driven queries

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 05-admin-interface, Plan: 03*
*Completed: 2026-03-25*

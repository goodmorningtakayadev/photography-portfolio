---
phase: 04-content-management
plan: 01
subsystem: tooling
tags: [cli, content-management, draft-publish, readline, sharp]

requires:
  - phase: 02-photo-storage-gallery
    provides: Photo data model (photos.json), image optimization pipeline (optimize-images.js)
  - phase: 03-projects-collections
    provides: Collection data model, gallery category integration
provides:
  - Interactive CLI for adding photos without editing JSON
  - Interactive CLI for creating collections without editing JSON
  - Content listing and draft/publish toggle
  - Publish filtering across Gallery, Home, and collection helpers
affects: [05-polish-deploy (CLI scripts may need docs, published field is part of data model)]

tech-stack:
  added: []
  patterns: [Atomic JSON writes (temp file + rename), CLI via readline/promises, published-field filtering (p.published !== false)]

key-files:
  created: [scripts/manage-content.js]
  modified: [src/data/photos.json, src/pages/GalleryPage.jsx, src/pages/Home.jsx, src/utils/collectionHelpers.js, package.json]

key-decisions:
  - "CLI over headless CMS — aligns with existing local file + sharp architecture, zero new dependencies"
  - "Atomic JSON writes via temp file + rename for data safety (audit-added)"
  - "published !== false default pattern — backwards compatible, existing photos display without migration"

patterns-established:
  - "Content mutation always through temp file + rename (never direct write to photos.json)"
  - "Publish filtering: p.published !== false (default-true, backwards compatible)"
  - "Filename sanitization: lowercase, strip traversal, [a-z0-9\\-\\.] only, collision resolution via numeric suffix"

duration: ~15min
started: 2026-03-23
completed: 2026-03-23
---

# Phase 4 Plan 01: Content Management CLI Summary

**Interactive CLI tool for adding photos, managing collections, and toggling draft/publish state — with atomic JSON writes, filename sanitization, and publish filtering across all public views.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Started | 2026-03-23 |
| Completed | 2026-03-23 |
| Tasks | 3 completed (2 auto + 1 checkpoint) |
| Files created | 1 |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Add Photo via CLI | Pass | Full workflow: prompts → copy → JSON update → optimize. User added 2 photos during verification |
| AC-2: Manage Collections via CLI | Pass | Collection creation with photo selection, cover photo, slug generation |
| AC-3: Draft/Publish Filtering | Pass | Gallery, Home (featured + hero + category thumbnails), and collection helpers all filter unpublished |
| AC-4: Content Listing and Management | Pass | Table display of photos/collections, publish toggle via manage subcommand |
| AC-5: Error Handling and Data Safety | Pass | Invalid paths rejected, atomic JSON writes, filename collision resolution |

## Accomplishments

- Created unified CLI tool (`scripts/manage-content.js`) with `add-photo`, `add-collection`, and `manage` subcommands
- Implemented atomic JSON write pattern (temp file + rename) across all mutations for data safety
- Added `published` field to data model with backwards-compatible `!== false` filtering across Gallery, Home, and collection helpers
- Auto-detect aspect ratio via sharp, filename sanitization, and collision resolution

## Skill Audit

No required skills for this plan (CLI tooling, no UI/CSS/design work).

| Expected | Invoked | Notes |
|----------|---------|-------|
| /frontend-design | N/A | No UI work in this plan |
| /ui-ux-pro-max | N/A | No CSS/design work |
| /bencium-controlled-ux-designer | N/A | No visual decisions |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `scripts/manage-content.js` | Created | Unified CLI tool with add-photo, add-collection, manage subcommands |
| `src/data/photos.json` | Modified | Added `published: true` to all photos, 2 new photos added by user during testing |
| `src/pages/GalleryPage.jsx` | Modified | Added publishedPhotos filter before category/collection logic |
| `src/pages/Home.jsx` | Modified | Added publish filtering for featured, hero, and category card thumbnails |
| `src/utils/collectionHelpers.js` | Modified | Filter unpublished from getCollectionPhotos(), cover photo fallback in getCollectionCoverPhoto() |
| `package.json` | Modified | Added 3 npm scripts: add-photo, add-collection, manage-content |
| `src/pages/About.jsx` | Modified | Portrait photo updated by user (out of plan scope) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| CLI over CMS/admin UI | Aligns with existing local file + sharp architecture; zero new dependencies | Simple, maintainable tooling for single-operator portfolio |
| Atomic JSON writes | Audit finding — prevent data corruption on crash/power failure | All mutations go through temp file + rename pattern |
| Default-true published field | `published !== false` means existing photos without the field still display | Zero-migration backwards compatibility |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | CLI bug fix during checkpoint |
| Scope additions | 1 | User-initiated About.jsx update (minor) |
| Deferred | 0 | — |

**Total impact:** One bug caught and fixed during verification. No scope creep.

### Auto-fixed Issues

**1. CLI double-extension bug**
- **Found during:** Checkpoint verification
- **Issue:** `add-photo` produced filenames like `photo.jpg.jpg` when source already had `.jpg` extension. `basename(path, ext)` strips one `.jpg` but sanitizer preserves the remaining one, then `.jpg` is appended again.
- **Fix:** Added `.replace(/\.(jpg|jpeg|png)$/i, '')` after sanitization to strip any lingering image extension before appending the canonical `.jpg`
- **Files:** `scripts/manage-content.js`
- **Verification:** Confirmed new filenames are correct single-extension

### User-Initiated Changes (Out of Plan Scope)

- User updated About.jsx portrait from Unsplash placeholder to local photo
- User added 2 photos via CLI during verification testing
- These changes are kept as intended user content

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Content management workflow fully operational
- All Phase 4 ROADMAP scope covered (authoring, upload, organization, draft/publish)
- Phase 5 (Polish & Deploy) can proceed

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 04-content-management, Plan: 01*
*Completed: 2026-03-23*

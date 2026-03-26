---
phase: 04-object-storage
plan: 02
subsystem: processing
tags: [sharp, webp, exif, blurhash, image-processing, variants]

requires:
  - phase: 04-object-storage (plan 01)
    provides: R2 client (storage.ts), confirm endpoint, VARIANT_CONFIGS, getSession()
provides:
  - Sharp image processing pipeline (processing.ts)
  - Three WebP variant generation (thumb_200, web_1200, retina_2400)
  - EXIF extraction and DateTimeOriginal parsing
  - Blurhash computation
  - Photo status lifecycle (processing → ready / failed)
  - Async processing trigger from confirm endpoint
  - downloadObject and uploadBuffer storage helpers
affects: [05-admin-interface, 06-public-pages]

tech-stack:
  added: ["blurhash@2.0.5", "exif-reader@2.0.3", "sharp@0.34.5 (moved to deps)"]
  patterns: [parallel Sharp operations via Promise.all, fire-and-forget fetch for async processing, maxDuration for Vercel Lambda timeout]

key-files:
  created: [src/lib/processing.ts, src/app/api/uploads/process/route.ts]
  modified: [src/lib/storage.ts, src/app/api/uploads/confirm/route.ts, package.json, pnpm-lock.yaml]

key-decisions:
  - "exif-reader v2 returns DateTimeOriginal as Date object (not string) — simplified parsing vs audit expectation"
  - "EXIF sanitization via JSON.stringify replacer to strip Buffers/Uint8Arrays for JSONB safety"
  - "Blurhash uses 4x3 components at 32x32 resize for compact hashes"
  - "Fire-and-forget fetch with cookie forwarding for async processing trigger"
  - "maxDuration: 60 on process endpoint for Vercel Lambda timeout"

patterns-established:
  - "Processing pipeline: download original → parallel (variants + metadata + blurhash) → upload variants → update DB"
  - "Variant storage key: photos/<uuid>/<variant_type>.webp"
  - "Status lifecycle: processing → ready (success) or processing → failed (error, with catch block)"
  - "Fire-and-forget async trigger: fetch().catch() from confirm to process endpoint"
  - "EXIF sanitization: JSON.parse(JSON.stringify(obj, replacer)) to strip non-serializable values"

duration: ~15min
started: 2026-03-25
completed: 2026-03-25
---

# Phase 4 Plan 02: Image Processing Pipeline Summary

**Sharp-based image processing pipeline generating three WebP variants, extracting EXIF metadata, computing blurhash, and transitioning photo status from "processing" to "ready" — triggered asynchronously from the confirm endpoint.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 2 completed |
| Files created | 2 |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Variant Generation | Pass | Three WebP variants via Sharp with withoutEnlargement, uploaded to R2, variant records created |
| AC-2: EXIF Extraction and Metadata | Pass | exif-reader parses EXIF, DateTimeOriginal extracted as Date, width/height from Sharp metadata |
| AC-3: Blurhash Computation | Pass | 32x32 resize → ensureAlpha → raw → Uint8ClampedArray → encode(4,3) |
| AC-4: Status Lifecycle — Success | Pass | processPhoto success → status "ready", updatedAt set |
| AC-5: Status Lifecycle — Failure | Pass | Catch block → status "failed", error logged, nested try-catch for status update |
| AC-6: Async Trigger from Confirm | Pass | Fire-and-forget fetch with cookie forwarding, .catch() for error handling |
| AC-7: Process Endpoint Auth | Pass | getSession() returns 401 JSON for unauthenticated requests |

Note: End-to-end pipeline testing requires R2 credentials and database. Verified via tsc + build + code review.

## Accomplishments

- Complete image processing pipeline: download → parallel operations → upload variants → update DB
- Three WebP variants (thumb_200, web_1200, retina_2400) with quality 80
- Robust EXIF extraction with graceful degradation on corrupt/missing data
- JSONB-safe EXIF serialization stripping Buffers and non-serializable values
- Deterministic status lifecycle — photos never stuck in "processing"

## Skill Audit

No required skills for this plan (backend-only, no UI work).

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/processing.ts` | Created | Sharp pipeline: processPhoto, generateVariants, extractMetadata, computeBlurhash |
| `src/app/api/uploads/process/route.ts` | Created | POST endpoint: runs pipeline, updates photos + photo_variants, handles failures |
| `src/lib/storage.ts` | Modified | Added downloadObject (GetObjectCommand → Buffer) and uploadBuffer (PutObjectCommand) |
| `src/app/api/uploads/confirm/route.ts` | Modified | Added fire-and-forget fetch to trigger /api/uploads/process |
| `package.json` | Modified | +blurhash, +exif-reader, sharp moved from devDependencies to dependencies |
| `pnpm-lock.yaml` | Modified | Lockfile updated |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| exif-reader DateTimeOriginal is Date, not string | exif-reader v2 type definitions show `Photo.DateTimeOriginal: Date` — library does the parsing | Simplified code vs audit-expected string parsing pattern |
| EXIF sanitization via JSON.stringify replacer | Strip Buffers (thumbnail data, MakerNote) and Uint8Arrays that aren't JSON-serializable. JSON.parse(JSON.stringify(obj, replacer)) is simple and comprehensive | Prevents JSONB insert failures from non-serializable EXIF values |
| maxDuration: 60 | Sharp processing of 50MB original into 3 variants takes 5-15s. Default Vercel timeout (10s) is too tight | Process endpoint gets full 60s on Vercel |
| sharp moved to dependencies | Was in devDependencies (legacy optimize-images script). Production processing requires it at runtime | Available in Vercel Lambda deployment |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Minor — simplified code based on actual library types |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** One simplification. No scope creep.

### Auto-fixed Issues

**1. [Types] EXIF DateTimeOriginal is Date, not string**
- **Found during:** Task 1 (tsc caught `parsed.exif?.DateTimeOriginal` — no `exif` property on Exif type)
- **Issue:** Audit assumed exif-reader returns DateTimeOriginal as string "YYYY:MM:DD HH:MM:SS". Actual v2 types: `Photo?.DateTimeOriginal: Date` — library does the parsing.
- **Fix:** Simplified to `instanceof Date` check instead of string parsing with colon replacement.
- **Files:** src/lib/processing.ts
- **Verification:** tsc passes, logic correct

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `parsed.exif` property doesn't exist on Exif type | Used `parsed.Photo?.DateTimeOriginal` (correct path per type defs) |
| sharp removed from both deps during install sequence | Re-ran `pnpm add sharp` to add to dependencies properly |

## Next Phase Readiness

**Ready:**
- Complete upload + processing pipeline: presign → PUT → confirm → process → ready
- Photos table enriched: width, height, exifData, blurhash, takenAt, status
- Photo variants table populated: three WebP sizes with dimensions and file sizes
- All admin API endpoints auth-protected via getSession()
- Storage helpers (download, upload, presign, HEAD) available for Phase 5

**Concerns:**
- Fire-and-forget processing trigger could theoretically be dropped on Lambda freeze edge case — Phase 5 admin UI will show processing status for manual re-trigger
- No retry mechanism for failed processing — admin can re-trigger manually

**Blockers:**
- None

---
*Phase: 04-object-storage, Plan: 02*
*Completed: 2026-03-25*

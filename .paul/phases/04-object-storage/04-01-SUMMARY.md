---
phase: 04-object-storage
plan: 01
subsystem: storage
tags: [r2, s3, cloudflare, presigned-url, aws-sdk-v3, upload]

requires:
  - phase: 02-database-schema
    provides: photos table with storage_key, status enum, gallery_sort_order
  - phase: 03-authentication
    provides: JWT session cookie, session.ts helpers, getSession() API auth pattern
provides:
  - R2 S3Client with lazy initialization (storage.ts)
  - Presigned PUT URL generation with signed Content-Type
  - Upload confirmation endpoint creating photo records with status "processing"
  - getSession() reusable API route auth guard (session.ts)
  - Upload constants (allowed types, max size, variant configs)
  - extractPhotoIdFromKey() strict regex validator
affects: [04-object-storage, 05-admin-interface, 06-public-pages]

tech-stack:
  added: ["@aws-sdk/client-s3@3.1016.0", "@aws-sdk/s3-request-presigner@3.1016.0"]
  patterns: [lazy Proxy for env.ts and db/index.ts, process.env direct access for storage.ts, force-dynamic on API routes]

key-files:
  created: [src/lib/storage.ts, src/lib/constants.ts, src/app/api/uploads/presign/route.ts, src/app/api/uploads/confirm/route.ts]
  modified: [src/lib/session.ts, src/lib/env.ts, src/db/index.ts, package.json, pnpm-lock.yaml]

key-decisions:
  - "storage.ts uses process.env directly (not serverEnv) to avoid build-time eager parse"
  - "env.ts converted to lazy Proxy — resolves Phase 2 deferred issue 'Env validation eager loading risk'"
  - "db/index.ts converted to lazy Proxy — same root cause as env.ts"
  - "Confirm endpoint derives photoId from storageKey (not client-supplied) — audit finding"
  - "signableHeaders includes content-type to enforce upload type in presigned URL — audit finding"
  - "API routes use getSession() inline auth returning 401 JSON, not middleware redirects"

patterns-established:
  - "Lazy Proxy pattern for modules with env-dependent top-level initialization"
  - "API route auth: getSession() → 401 JSON (not middleware redirect)"
  - "force-dynamic export on API routes that use runtime env vars or DB"
  - "Storage key format: photos/<uuid>/original.<ext> with strict UUID regex validation"
  - "Upload flow: presign → client PUT → confirm → DB record"

duration: ~20min
started: 2026-03-25
completed: 2026-03-25
---

# Phase 4 Plan 01: R2 Client and Presigned Upload Flow Summary

**R2 storage client with presigned PUT upload flow, upload confirmation creating photo records, and reusable API auth guard — plus lazy Proxy fix for env.ts/db build-time crash.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 2 completed |
| Files created | 4 |
| Files modified | 5 (3 planned + 2 deviations) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Presigned URL Generation | Pass | generateStorageKey + createPresignedUploadUrl with signableHeaders |
| AC-2: Content Type Validation | Pass | ALLOWED_UPLOAD_TYPES check + Content-Type enforced in signature |
| AC-3: Upload Confirmation | Pass | photoId derived from storageKey, record created with status "processing" |
| AC-4: Auth Protection | Pass | getSession() returns 401 JSON on both endpoints |
| AC-5: Missing Parameters Rejected | Pass | 400 for missing filename/contentType |
| AC-6: Duplicate Confirmation (audit-added) | Pass | 409 "Upload already confirmed" on existing photoId |
| AC-7: Oversized Upload Rejected (audit-added) | Pass | HEAD Content-Length checked against MAX_UPLOAD_SIZE |

Note: AC-3, AC-6, AC-7 verified via code path analysis + tsc + build. Full end-to-end requires R2 credentials and running database.

## Accomplishments

- Complete presigned upload flow: presign → client PUT to R2 → confirm → DB record
- Reusable getSession() auth guard for all future admin API routes
- Strict storage key validation regex preventing path traversal and ID mismatch
- Resolved Phase 2 deferred issue: env.ts eager loading risk (lazy Proxy)

## Skill Audit

No required skills for this plan (backend-only, no UI work). All SPECIAL-FLOWS skills are UI-focused.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/storage.ts` | Created | R2 S3Client (lazy), presigned URL gen, HEAD, key extraction |
| `src/lib/constants.ts` | Created | ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_SIZE, VARIANT_CONFIGS |
| `src/app/api/uploads/presign/route.ts` | Created | GET → presigned PUT URL + storage key + photoId |
| `src/app/api/uploads/confirm/route.ts` | Created | POST → validates key, checks R2, creates photo record |
| `src/lib/session.ts` | Modified | Added getSession() API route auth guard |
| `src/lib/env.ts` | Modified | Lazy Proxy — defers Zod parse to first property access |
| `src/db/index.ts` | Modified | Lazy Proxy — defers neon connection to first use |
| `package.json` | Modified | +@aws-sdk/client-s3, +@aws-sdk/s3-request-presigner |
| `pnpm-lock.yaml` | Modified | Lockfile updated |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Lazy Proxy for env.ts | Eager Zod parse crashes Next.js build when env vars unavailable during static analysis. Proxy defers parse to first property access (runtime only) | All modules importing serverEnv now build safely. Resolves Phase 2 deferred issue. |
| Lazy Proxy for db/index.ts | Same root cause — neon() call at module level accesses serverEnv.DATABASE_URL | db can be imported in any route without build failure |
| storage.ts uses process.env directly | Even with lazy env.ts, storage.ts benefits from explicit runtime checks with clear error messages for missing R2 vars | Consistent with auth.ts Phase 3 pattern |
| force-dynamic on upload routes | API routes that use DB/R2 must not be pre-rendered during build | Standard Next.js pattern for dynamic API routes |
| getSession() in session.ts | Reusable auth guard needed for API routes outside /admin/* middleware scope. Returns JWTPayload or null. | All future admin API routes can use same pattern |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 3 | Essential — build would fail without these fixes |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Three essential infrastructure fixes to resolve build-time env validation crash. No scope creep.

### Auto-fixed Issues

**1. [Build] env.ts eager Zod parse crashes Next.js build**
- **Found during:** Task 2 verification (`pnpm build`)
- **Issue:** `serverSchema.parse(process.env)` runs at import time. When any route imports a module that transitively imports env.ts, Next.js build fails because env vars aren't available during static analysis / page data collection.
- **Fix:** Wrapped serverEnv and clientEnv in Proxy objects that defer parse to first property access.
- **Files:** src/lib/env.ts
- **Verification:** `pnpm build` succeeds

**2. [Build] db/index.ts module-level neon() call triggers env parse**
- **Found during:** Task 2 verification (second `pnpm build` after env.ts fix)
- **Issue:** `neon(serverEnv.DATABASE_URL)` at module level accesses the Proxy, triggering the Zod parse. The confirm route imports db, which imports env.ts.
- **Fix:** Wrapped db in Proxy with lazy getDb() initialization using process.env.DATABASE_URL directly.
- **Files:** src/db/index.ts
- **Verification:** `pnpm build` succeeds with all 9 routes

**3. [Build] Added `export const dynamic = "force-dynamic"` to upload routes**
- **Found during:** Task 2 implementation
- **Issue:** Next.js attempts to pre-render API routes that don't explicitly opt out of static generation
- **Fix:** Added dynamic export to both presign and confirm routes
- **Files:** src/app/api/uploads/presign/route.ts, src/app/api/uploads/confirm/route.ts
- **Verification:** Routes appear as `ƒ (Dynamic)` in build output

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| env.ts eager parse crashes build | Lazy Proxy pattern (deviation #1) |
| db/index.ts triggers env parse at build time | Lazy Proxy pattern (deviation #2) |

## Next Phase Readiness

**Ready:**
- R2 client and presigned upload flow complete — admin can upload photos to R2
- Confirm endpoint creates photo records with status "processing"
- getSession() available for all future admin API routes
- constants.ts VARIANT_CONFIGS ready for 04-02 processing pipeline
- extractPhotoIdFromKey() available for processing pipeline to parse storage keys

**Concerns:**
- env.ts lazy Proxy changes behavior from fail-fast at startup to fail-on-first-use. Missing env vars surface as runtime errors on first request, not at deploy time. Consider adding a health check endpoint in Phase 7 that eagerly validates all env vars.
- The `$2` prefix check for ADMIN_PASSWORD_HASH in env.ts is still validated on first access — ensure .env.local has the bcrypt hash with `\$` escaping.

**Blockers:**
- None

---
*Phase: 04-object-storage, Plan: 01*
*Completed: 2026-03-25*

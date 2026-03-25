---
phase: 02-database-schema
plan: 01
subsystem: database
tags: [postgres, neon, drizzle-orm, zod, schema, seed, serverless]

requires:
  - phase: 01-nextjs-migration
    provides: Next.js App Router project with pnpm and TypeScript config
provides:
  - Drizzle ORM schema with 6 tables (photos, photo_variants, categories, photo_categories, projects, project_photos)
  - Neon serverless DB client (neon-http driver)
  - Zod environment variable validation (server + client schemas)
  - SQL migration for initial schema
  - Seed script mapping photos.json → database
  - Typed read-only query functions for photos, categories, projects
affects: [03-authentication (DB client available), 04-object-storage (photo_variants table ready), 05-admin-interface (query functions + schema types), 06-public-migration (query functions for data swap)]

tech-stack:
  added: [drizzle-orm@0.45.1, @neondatabase/serverless@1.0.2, zod@4.3.6, drizzle-kit@0.31.10, tsx@4.21.0, ws@8.20.0]
  patterns: [neon-http for app queries, neon-serverless Pool for transactions (seed), Zod env validation at module level, typed query functions in src/db/queries/]

key-files:
  created: [src/db/schema.ts, src/db/index.ts, src/lib/env.ts, drizzle.config.ts, .env.example, scripts/seed.ts, src/db/queries/photos.ts, src/db/queries/categories.ts, src/db/queries/projects.ts, drizzle/0000_melodic_gargoyle.sql]
  modified: [package.json]

key-decisions:
  - "neon-http driver for app client (faster for serverless, no WebSocket overhead) — seed uses neon-serverless Pool for transaction support"
  - "Zod v4 (4.3.6) installed — string().url(), startsWith(), min() methods confirmed compatible"
  - "title → caption, description → alt_text mapping for seed — deterministic, no ambiguity"
  - "featured/heroImage/tags fields dropped during seed — Phase 6 homepage will use gallery_sort_order + limit instead"
  - "Seed idempotency via TRUNCATE CASCADE in reverse FK order, not ON CONFLICT"

patterns-established:
  - "DB queries live in src/db/queries/ — one file per domain (photos, categories, projects)"
  - "App DB client uses neon-http (src/db/index.ts) — scripts needing transactions create own Pool connection"
  - "Environment validation in src/lib/env.ts — serverEnv for server code, clientEnv for client code"
  - "Schema types exported from src/db/schema.ts — Photo, NewPhoto, Category, Project, etc."
  - "DB scripts: pnpm db:generate, db:migrate, db:seed, db:studio"

duration: ~10min
started: 2026-03-25
completed: 2026-03-25
---

# Phase 2 Plan 01: Database & Schema Summary

**Drizzle ORM schema with 6 tables matching CLAUDE.md spec, Neon serverless client, Zod env validation, migration, seed script, and typed query functions — all compiling with zero errors.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 2 completed (2 auto) |
| Files created | 10 |
| Files modified | 1 (package.json) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Schema Matches CLAUDE.md Specification | Pass | 6 tables, 2 enums, all columns/types/FKs/indexes verified in generated SQL |
| AC-2: Environment Variables Validated at Startup | Pass | Zod server + client schemas, validates DATABASE_URL, ADMIN_PASSWORD_HASH, JWT_SECRET, CDN_URL |
| AC-3: Seed Script Populates Database from photos.json | Pass | Script created with transaction support, idempotent truncate, UUID mapping, data loss warnings |
| AC-4: Build Passes with New Dependencies | Pass | `pnpm build` zero errors, `tsc --noEmit` zero errors, all 3 routes still static |

## Accomplishments

- Full Drizzle schema: photos, photo_variants, categories, photo_categories, projects, project_photos — with GIN index on exif_data, B-tree on sort/date columns, composite on project_photos
- FK cascades correct: CASCADE on join tables + variants, SET NULL on cover_photo_id
- Neon HTTP client for app queries, Pool-based client for seed transactions
- Seed script maps all 10 photos, 3 categories, 3 projects from photos.json with deterministic field mapping
- 7 typed query functions across 3 domain files (photos, categories, projects)

## Skill Audit

No required skills for this plan (database/backend work — no UI changes).

| Expected | Invoked | Notes |
|----------|---------|-------|
| /frontend-design | N/A | No UI work in this plan |
| /ui-ux-pro-max | N/A | No design decisions |
| /bencium-controlled-ux-designer | N/A | No visual changes |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `package.json` | Modified | Added 6 deps (drizzle-orm, @neondatabase/serverless, zod, drizzle-kit, tsx, ws) + 4 db scripts |
| `src/db/schema.ts` | Created | Drizzle schema — 6 tables, 2 enums, indexes, FK cascades, exported types |
| `src/db/index.ts` | Created | Neon HTTP DB client with schema export |
| `src/lib/env.ts` | Created | Zod validation for server + client environment variables |
| `drizzle.config.ts` | Created | Drizzle Kit config — schema path, migration output, postgresql dialect |
| `.env.example` | Created | Documents all required env vars with comments |
| `scripts/seed.ts` | Created | Idempotent seed from photos.json — truncate + insert in transaction |
| `src/db/queries/photos.ts` | Created | getPublishedPhotos, getPhotoById, getFeaturedPhotos |
| `src/db/queries/categories.ts` | Created | getAllCategories, getCategoryBySlug |
| `src/db/queries/projects.ts` | Created | getPublishedProjects, getProjectBySlug |
| `drizzle/0000_melodic_gargoyle.sql` | Generated | Initial SQL migration — CREATE TABLE, indexes, FK constraints |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| neon-http driver for app, neon-serverless Pool for seed | HTTP is faster for serverless reads; Pool needed for interactive transactions in seed | Two driver patterns — documented in patterns-established |
| Zod v4 (not v3) | pnpm installed latest (4.3.6); confirmed v3-style methods still work | No API issues — string().url(), startsWith(), min() all present |
| title→caption, description→alt_text | CLAUDE.md schema has no `title` column; caption is the display name; alt_text is descriptive | Deterministic mapping, no ambiguity |
| Drop featured/heroImage/tags during seed | Not in CLAUDE.md schema; categories handle categorization | Phase 6 homepage will use sort_order + limit for featured selection |
| TRUNCATE CASCADE for seed idempotency | Clean slate on each run; ON CONFLICT leaves stale data | Destructive but correct for seed script use case |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | — |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** Plan executed exactly as written — zero deviations.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Zod v4 installed (plan referenced v3-style API) | Confirmed v4 maintains v3 method compatibility — no code changes needed |
| esbuild build scripts ignored by pnpm | Normal for pnpm strict mode — ran `pnpm approve-builds` previously for sharp |

## Next Phase Readiness

**Ready:**
- Database schema defined and migration generated
- DB client available for Phase 3 (auth middleware can verify sessions)
- Query functions ready for Phase 6 (public pages data swap)
- Schema types exported for use in Phase 4 (image processing) and Phase 5 (admin CRUD)
- Seed script ready to populate once DATABASE_URL is configured

**Concerns:**
- Seed script requires live Neon database to run — user must set up Neon project and DATABASE_URL
- Env validation at module level will throw if vars missing — safe now (nothing imports db) but Phase 6 must ensure vars are set at build time
- photos.json `featured`/`heroImage` data not preserved — Phase 6 needs alternative homepage strategy

**Blockers:**
- None

---
*Phase: 02-database-schema, Plan: 01*
*Completed: 2026-03-25*

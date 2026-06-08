# Roadmap: photography-portfolio

## Overview
Refactor the existing Vite+React photography portfolio SPA into a Next.js App Router monolith backed by Postgres (Neon) and Cloudflare R2. The refactor preserves the existing public design pixel-identical while adding database-driven content, object storage, async image processing, and a single-admin CMS interface. Each phase builds incrementally — the site remains functional after every phase.

## Current Milestone
**v1.0 Next.js + CMS Refactor** (v1.0.0)
Status: In progress
Phases: 6 of 7 complete

## Phases

| Phase | Name | Plans | Status | Completed |
|-------|------|-------|--------|-----------|
| 1 | Next.js App Router Migration | 1 | Complete | 2026-03-25 |
| 2 | Database & Schema | 1 | Complete | 2026-03-25 |
| 3 | Authentication | 1 | Complete | 2026-03-25 |
| 4 | Object Storage & Image Processing | 2 | Complete | 2026-03-25 |
| 5 | Admin Interface | 3 | Complete | 2026-03-25 |
| 6 | Public Pages Data Migration | 2 | Complete | 2026-03-26 |
| 7 | Polish & Deploy | 1 | Planning | - |

## Phase Details

### Phase 1: Next.js App Router Migration
**Goal:** Convert the Vite+React SPA to Next.js App Router while preserving all existing pages pixel-identical
**Depends on:** Nothing (first phase)
**Research:** Unlikely (standard Next.js migration)

**Scope:**
- Replace Vite with Next.js App Router
- Switch from npm to pnpm
- Set up TypeScript config (existing files stay .jsx, new code in .ts/.tsx)
- Set up Tailwind CSS alongside existing CSS
- Migrate all pages to App Router file-based routing under (public) route group
- Replace react-router-dom with next/link and next/navigation
- Preserve all existing visual design, animations, and behavior

**Plans:**
- [x] 01-01: Initialize Next.js and migrate all public pages

### Phase 2: Database & Schema
**Goal:** Postgres database with Drizzle ORM schema matching CLAUDE.md spec, seeded from existing photos.json
**Depends on:** Phase 1 (Next.js project must exist)
**Research:** Unlikely (schema defined in CLAUDE.md)

**Scope:**
- Neon Postgres connection with Drizzle ORM
- Full schema: photos, photo_variants, categories, photo_categories, projects, project_photos
- Environment variable validation (Zod)
- Seed script to migrate photos.json → database
- Reusable query functions in src/db/queries/

**Plans:**
- [x] 02-01: Schema, migrations, env validation, and seed

### Phase 3: Authentication
**Goal:** Single-admin auth protecting /(admin) routes
**Depends on:** Phase 1 (Next.js middleware required)
**Research:** Unlikely (simple JWT + bcrypt pattern)

**Scope:**
- Login page at /login
- POST /api/auth/login and /api/auth/logout endpoints
- Middleware protecting /(admin) routes
- JWT session cookie (7-day expiry)
- bcrypt password verification against ADMIN_PASSWORD_HASH env var

**Plans:**
- [x] 03-01: Auth helpers, login/logout endpoints, middleware, and login page

### Phase 4: Object Storage & Image Processing
**Goal:** Upload photos to Cloudflare R2 with async image processing pipeline
**Depends on:** Phase 2 (database must exist for photo records), Phase 3 (auth for admin endpoints)
**Research:** Likely (R2 presigned URL flow, Sharp pipeline details)
**Research topics:** R2 presigned URL generation, Sharp WebP/AVIF pipeline, blurhash computation

**Scope:**
- R2 client setup (S3-compatible)
- Presigned URL generation for direct browser uploads
- Upload confirmation endpoint
- Sharp processing: thumb_200, web_1200, retina_2400 variants
- EXIF extraction, blurhash computation
- Photo status lifecycle (processing → ready → failed)

**Plans:**
- [x] 04-01: R2 client and presigned upload flow
- [x] 04-02: Image processing pipeline (Sharp + variants + EXIF + blurhash)

### Phase 5: Admin Interface
**Goal:** Admin CMS for managing photos, categories, and projects
**Depends on:** Phase 3 (auth), Phase 4 (upload/storage)
**Research:** Unlikely (CRUD patterns)

**Scope:**
- Admin layout with dashboard
- Photo management (list, edit metadata, categorize, archive, delete)
- Upload interface (drag-and-drop, progress, processing status)
- Category management (add/remove/reorder filter labels)
- Project management (CRUD, cover photo, photo ordering via drag-and-drop)
- Bulk operations (archive, categorize)

**Plans:**
- [x] 05-01: Admin layout, dashboard, and photo management
- [x] 05-02: Upload interface and category management
- [x] 05-03: Project management and bulk operations

### Phase 6: Public Pages Data Migration
**Goal:** Switch public pages from static JSON to database-driven with ISR
**Depends on:** Phase 2 (database), Phase 5 (admin populates data)
**Research:** Unlikely (Next.js ISR patterns)

**Scope:**
- Convert public pages to server components fetching from Postgres
- Gallery page: database-driven with category filtering
- Projects page: database-driven with individual project pages at /projects/[slug]
- ISR via revalidateTag for gallery, projects, individual project pages
- CDN URL resolution from storage keys at render time
- Admin mutations trigger revalidation

**Plans:**
- [x] 06-01: Gallery and homepage data migration
- [x] 06-02: Projects pages and revalidation

### Phase 7: Polish & Deploy
**Goal:** Production-ready site deployed to Vercel
**Depends on:** Phase 6
**Research:** Unlikely (standard deployment)

**Scope:**
- SEO metadata with real domain
- Performance audit (Lighthouse)
- Responsive edge cases
- Vercel deployment configuration
- Environment variable setup in Vercel dashboard

**Plans:**
- [ ] 07-01: SEO metadata, font optimization, dynamic sitemap, and production config

---
*Roadmap created: 2026-03-25*
*Last updated: 2026-03-26 — Phase 6 complete*

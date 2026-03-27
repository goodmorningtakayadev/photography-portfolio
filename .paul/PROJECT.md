# Project: photography-portfolio

## Description
Refactoring a Vite+React SPA into a Next.js App Router monolith with Postgres (Neon), Cloudflare R2 storage, and a single-admin CMS. The public portfolio is statically generated while the admin layer provides upload, processing, tagging, organizing, and publishing of photos.

## Core Value
The site owner (sole admin) can upload, process, tag, organize, and publish photos through an admin interface, while visitors see a performant, statically-generated public portfolio.

## Current State

| Attribute | Value |
|-----------|-------|
| Version | 0.0.0 |
| Status | All public pages database-driven with ISR, ready for polish & deploy |
| Last Updated | 2026-03-26 |

## Requirements

### Validated (Shipped)
- [x] Public homepage with hero, featured photos, category cards
- [x] Gallery page with category filtering and pagination
- [x] Projects/collections viewing via gallery filter
- [x] About page with contact form (Web3Forms)
- [x] Image optimization pipeline (Sharp, build-time WebP variants)
- [x] CLI content management (add photo, add collection, manage)
- [x] SEO meta tags, sitemap, robots.txt
- [x] Route-based code splitting

### Active (In Progress)
- [ ] Production polish and Vercel deployment — Phase 7

### Validated (Recently Shipped)
- [x] Migrate from Vite+React to Next.js App Router — Phase 1
- [x] Replace static JSON with Postgres (Neon) + Drizzle ORM — Phase 2 (schema, migration, seed, queries)
- [x] Replace local photo storage with Cloudflare R2 + CDN — Phase 4 (R2 client, presigned uploads, variants)
- [x] Build admin interface for photo/project/category management — Phase 5 (dashboard, photos, upload, categories, projects, bulk ops)
- [x] Implement single-admin auth (middleware + bcrypt + JWT) — Phase 3
- [x] Async image processing pipeline (Sharp + background jobs) — Phase 4 (3 WebP variants, EXIF, blurhash)
- [x] Public pages database-driven with ISR — Phase 6 (homepage, gallery, projects listing, project detail editorial)
- [x] ISR revalidation from all admin mutations — Phase 6 (revalidatePath in 7 API route files)
- [x] Projects editorial magazine experience — Phase 6 (scroll-snapping spreads, progress indicator, typing animation hover)

### Out of Scope
- Multi-user support, user registration, collaborative editing
- Auth libraries (NextAuth, Lucia, Clerk, Auth.js)
- External image CDN services (Imgix, Cloudinary)
- Client-side state management libraries (Redux, Zustand)
- Headless CMS platforms
- Merging categories and projects into a single abstraction

## Target Users

**Primary:** Site visitors (photography enthusiasts, potential clients)
- Browse gallery filtered by category
- View curated project collections
- Contact the photographer

**Secondary:** Site owner (sole admin/photographer)
- Upload and process photos
- Organize into categories and projects
- Publish/unpublish content
- Manage portfolio through admin UI

## Constraints

### Technical Constraints
- Next.js App Router (monolith serving both public and admin)
- Postgres via Neon (serverless driver)
- Cloudflare R2 for object storage (S3-compatible, zero egress)
- Cloudflare CDN for public image delivery
- Sharp for image processing (not external services)
- Drizzle ORM for database access
- Single-admin auth via env vars (no auth libraries)
- Public pages must be statically generated (ISR)

### Design Constraints
- Existing public portfolio design must be preserved pixel-identical
- No CSS/style/layout changes to existing public components
- Admin pages can have their own design
- New wrappers around existing components are OK; rewrites are not

---
*Created: 2026-03-25*
*Last updated: 2026-03-26 after Phase 6*

# Project: photography-portfolio

## Description
Refactoring a Vite+React SPA into a Next.js App Router monolith with Postgres (Neon), Cloudflare R2 storage, and a single-admin CMS. The public portfolio is statically generated while the admin layer provides upload, processing, tagging, organizing, and publishing of photos.

## Core Value
The site owner (sole admin) can upload, process, tag, organize, and publish photos through an admin interface, while visitors see a performant, statically-generated public portfolio.

## Current State

| Attribute | Value |
|-----------|-------|
| Version | 0.0.0 |
| Status | Prototype (Vite+React SPA with static JSON data) |
| Last Updated | 2026-03-25 |

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
- [x] Migrate from Vite+React to Next.js App Router — Phase 1 complete
- [ ] Replace static JSON with Postgres (Neon) + Drizzle ORM
- [ ] Replace local photo storage with Cloudflare R2 + CDN
- [ ] Build admin interface for photo/project/category management
- [ ] Implement single-admin auth (middleware + bcrypt + JWT)
- [ ] Async image processing pipeline (Sharp + background jobs)

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

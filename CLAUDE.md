# CLAUDE.md — Photography Portfolio + CMS

## Project overview

This is a photography portfolio that doubles as a media asset management system and lightweight CMS. The site owner (sole admin) can upload, process, tag, organize, and publish photos through an admin interface, while visitors see a performant, statically-generated public portfolio.

This is a **single-user system** — there is only one admin (the photographer/owner). There is no multi-user support, no user registration, no collaborative editing. All admin functionality assumes a single authenticated operator.

The architecture is a **monolith** — a single Next.js (App Router) application serving both the public portfolio and the authenticated admin layer.

## Tech stack

| Layer              | Choice                        | Notes                                              |
|--------------------|-------------------------------|----------------------------------------------------|
| Framework          | Next.js (App Router)          | Server components for public, client for admin      |
| Language           | TypeScript (strict mode)      | No `any` types, prefer `unknown` + narrowing        |
| Database           | Postgres via Neon              | Serverless driver for edge, pooled for server       |
| ORM                | Drizzle ORM                   | Schema in `src/db/schema.ts`, migrations in `drizzle/` |
| Object storage     | Cloudflare R2 (S3-compatible) | Zero egress fees                                   |
| CDN                | Cloudflare                    | Sits in front of R2 for public image delivery       |
| Image processing   | Sharp                         | Resize, format conversion, EXIF extraction, blurhash |
| Auth               | Middleware + env var           | Single admin, no users table, password hash in env  |
| Styling            | Tailwind CSS                  | Existing portfolio styles should be preserved       |
| Package manager    | pnpm                          | Lockfile is `pnpm-lock.yaml`                       |

## Architecture principles

- **Two viewing systems, one photo pool.** The gallery page shows all published photos in a filterable grid (filtered by categories). The projects page shows curated, ordered photo sets with their own identity and viewing experience. Both reference the same `photos` table. These are fundamentally different concepts and must not be merged into a single abstraction.
- **Categories are labels, not containers.** A category (street, portraits, travel) is a filter applied to the gallery view. Categories have no metadata beyond a name and slug. They don't have descriptions, cover photos, or ordering of their photos. A photo can have multiple categories. The set of categories is small and changes rarely.
- **Projects are containers with identity.** A project has a title, slug, description, cover photo, publish state, and an ordered set of photos. Projects get their own page and their own viewing UX. A photo can appear in zero or more projects.
- **Public pages are statically generated (ISR).** Gallery and project pages use `generateStaticParams` and `revalidateTag`. Admin mutations call `revalidateTag('gallery')`, `revalidateTag('project:<slug>')`, or `revalidateTag('projects')` after changes.
- **Uploads bypass the web server.** The client requests a presigned URL from `/api/uploads/presign`, uploads directly to R2, then calls `/api/uploads/confirm` to trigger processing.
- **Image processing is async.** Confirmation endpoint enqueues a job. The worker (or serverless function) generates variants, extracts EXIF, computes blurhash, and writes metadata to Postgres.
- **Storage keys, not URLs.** The `photos` table stores `storage_key` (e.g., `photos/<uuid>/original.jpg`), never full URLs. The CDN domain is resolved at render time via `NEXT_PUBLIC_CDN_URL`.

## Database schema

Tables and their purposes:

### Photo pool

- `photos` — the atomic unit: storage key, dimensions, EXIF (jsonb), blurhash, caption, alt text, status enum (`processing` | `ready` | `failed` | `archived`), `taken_at` parsed from EXIF, `is_published` (controls public visibility), `gallery_sort_order` (ordering in the main gallery view)
- `photo_variants` — generated sizes per photo: variant type enum (`thumb_200` | `web_1200` | `retina_2400`), storage key, dimensions, format (webp/avif/jpg), file size

### Category system (gallery filtering)

- `categories` — small lookup table of predefined filter labels: `name` (unique), `slug` (unique, used in URL params), `sort_order` (display order of filter tabs). Examples: "street", "portraits", "travel". This table rarely changes.
- `photo_categories` — many-to-many join table: `photo_id` FK, `category_id` FK. Composite PK on `(photo_id, category_id)`. No `sort_order` — categories are filters, not ordered containers.

### Project system (curated sets)

- `projects` — curated, ordered collections of photos with their own identity: title, slug (unique, used in URLs like `/projects/la-session`), description, `cover_photo_id` FK, `is_published`, `sort_order` (display order on the projects page), `published_at`
- `project_photos` — many-to-many join table: `project_id` FK, `photo_id` FK, `sort_order` (drag-and-drop ordering within the project), `added_at`. Composite PK on `(project_id, photo_id)`.

### Important distinctions

**Categories ≠ Projects.** Do not merge these into a single "collections" abstraction. They serve different purposes:
- Categories are labels with no metadata — they filter the gallery view. A photo has categories.
- Projects are containers with identity — they have their own page, description, cover photo, and ordered photos. A project contains photos.

There is **no `users` table**. This is a single-user system. Auth is handled via environment variables, not database-backed user records. No table should have an `uploaded_by`, `created_by`, or `user_id` foreign key.

There is **no generic `tags` table**. Photo categorization uses the `categories` + `photo_categories` tables, not freeform tags. If freeform tagging is needed later, it should be a separate `tags` table — not overloaded onto categories.

Key indexes: GIN on `photos.exif_data`, B-tree on `photos.taken_at`, B-tree on `photos.gallery_sort_order`, composite on `(project_id, sort_order)` in `project_photos`, unique on `categories.slug`, unique on `projects.slug`.

Foreign key cascades: `photo_categories`, `project_photos`, and `photo_variants` all use `ON DELETE CASCADE` referencing `photos.id`. Deleting a photo row automatically cleans up all join table entries and variant records. `projects.cover_photo_id` uses `ON DELETE SET NULL` — deleting a cover photo nullifies the reference rather than deleting the project.

Schema source of truth: `src/db/schema.ts`. Run `pnpm drizzle-kit generate` after changes, `pnpm drizzle-kit migrate` to apply.

## Authentication

This is a single-admin system. Auth is intentionally simple:

- **No users table, no user model, no registration flow.** Don't create any of these.
- Admin credentials are stored as environment variables: `ADMIN_PASSWORD_HASH` (bcrypt hash of the admin password).
- Auth is implemented via Next.js middleware (`src/middleware.ts`) that protects all `/(admin)` routes.
- Login endpoint (`/api/auth/login`) validates the password against `ADMIN_PASSWORD_HASH`, sets an HTTP-only secure session cookie with a signed JWT.
- Logout endpoint (`/api/auth/logout`) clears the cookie.
- The session JWT contains only `{ role: "admin", iat, exp }` — no user ID needed since there's only one admin.
- Session expiry: 7 days. No refresh tokens needed for a single-user system.
- The login page lives at `/login` (outside the `(admin)` route group so middleware doesn't block it).

**Do not install Auth.js, NextAuth, Lucia, or any auth library.** The overhead is not justified for single-user auth. A middleware check + bcrypt + a signed cookie is sufficient and far simpler to maintain.

## File and directory conventions

```
src/
├── app/
│   ├── (public)/           # Public portfolio routes (SSG/ISR)
│   │   ├── page.tsx        # Homepage
│   │   ├── gallery/        # Main gallery — all photos, filterable by category
│   │   │   └── page.tsx    # Grid view with category filter tabs
│   │   └── projects/
│   │       ├── page.tsx    # Projects listing page
│   │       └── [slug]/     # Individual project page (own viewing UX)
│   ├── (admin)/            # Authenticated admin routes
│   │   ├── layout.tsx      # Auth guard wrapper
│   │   ├── dashboard/      # Overview, recent uploads
│   │   ├── upload/         # Upload interface
│   │   ├── photos/         # Photo management (categorize, edit, archive)
│   │   ├── photos/archived/ # Archived photos — restore or permanently delete
│   │   ├── categories/     # Category management (add/remove/reorder filter labels)
│   │   └── projects/       # Project CRUD, photo ordering within projects
│   └── api/
│       ├── auth/
│       │   ├── login/      # POST → validate password, set session cookie
│       │   └── logout/     # POST → clear session cookie
│       ├── uploads/
│       │   ├── presign/    # GET → returns presigned R2 URL
│       │   └── confirm/    # POST → enqueues processing job
│       └── revalidate/     # POST → ISR cache invalidation
├── db/
│   ├── schema.ts           # Drizzle schema definition
│   ├── index.ts            # DB client export
│   └── queries/            # Reusable query functions
├── lib/
│   ├── auth.ts             # bcrypt verify, JWT sign/verify helpers
│   ├── storage.ts          # R2 client, presigned URL generation
│   ├── processing.ts       # Sharp pipeline: resize, EXIF, blurhash
│   └── constants.ts        # Variant sizes, allowed formats, categories list, etc.
├── components/
│   ├── public/             # Portfolio UI components
│   └── admin/              # CMS UI components
└── workers/
    └── process-image.ts    # Background image processing entry point
```

## Image variants

Every uploaded photo produces these variants:

| Variant        | Max dimension | Format | Purpose                    |
|----------------|---------------|--------|----------------------------|
| `thumb_200`    | 200px wide    | webp   | Admin grid, gallery thumbs |
| `web_1200`     | 1200px wide   | webp   | Standard gallery view      |
| `retina_2400`  | 2400px wide   | webp   | Retina / lightbox          |
| `original`     | As uploaded   | As-is  | Archive, download          |

Storage path pattern: `photos/<photo_uuid>/<variant_type>.<format>`

## Environment variables

### Required variables

```
DATABASE_URL=              # Neon Postgres connection string
R2_ACCOUNT_ID=             # Cloudflare account ID
R2_ACCESS_KEY_ID=          # R2 API credentials
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=            # e.g., "portfolio-photos"
R2_PUBLIC_URL=             # Custom domain or R2.dev URL
NEXT_PUBLIC_CDN_URL=       # Cloudflare CDN domain for public images
ADMIN_PASSWORD_HASH=       # bcrypt hash of admin password (generate with: npx bcryptjs <password>)
JWT_SECRET=                # Random 64+ char string for signing session cookies
```

### Security rules

- **Never commit `.env` files.** The `.gitignore` must include: `.env`, `.env.local`, `.env.production`, `.env*.local`.
- **Do commit `.env.example`** with empty values as documentation for required variables.
- **`NEXT_PUBLIC_` prefix = client-visible.** Any variable starting with `NEXT_PUBLIC_` is bundled into client-side JS and visible in the browser. Only `NEXT_PUBLIC_CDN_URL` should use this prefix. Never put secrets (API keys, database URLs, auth secrets) behind `NEXT_PUBLIC_`.
- **Scope R2 credentials narrowly.** The R2 API token should have permission only to read/write the specific portfolio bucket, not the entire Cloudflare account.
- **Production secrets go in the deployment platform** (Vercel environment variables, Railway dashboard, etc.), never in files on disk.

### Runtime validation

All environment variables must be validated at startup using Zod in `src/lib/env.ts`. This catches misconfiguration at deploy time rather than at runtime when a user hits an endpoint.

```typescript
// src/lib/env.ts
import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_PUBLIC_URL: z.string().url(),
  ADMIN_PASSWORD_HASH: z.string().startsWith("$2"),  // bcrypt hash prefix
  JWT_SECRET: z.string().min(64),
});

const clientSchema = z.object({
  NEXT_PUBLIC_CDN_URL: z.string().url(),
});

export const serverEnv = serverSchema.parse(process.env);
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
});
```

**Usage:** Import `serverEnv` in server components, API routes, and workers. Import `clientEnv` in client components. Never import `serverEnv` in client code — the bundler will fail because the server variables don't exist client-side, which is the correct behavior.

**When creating new environment variables:** Add to the appropriate Zod schema in `src/lib/env.ts`, add to `.env.example` with a comment, and add to the deployment platform's variable dashboard. If the variable is optional, use `.optional().default("fallback")` in the schema.

## Code style and conventions

- Prefer server components by default. Use `"use client"` only when the component needs interactivity (event handlers, hooks, browser APIs).
- Data fetching happens in server components or API routes, never in client components. Client components receive data via props.
- Use Drizzle query builder (`db.select().from(...)`) over raw SQL. Extract reusable queries into `src/db/queries/`.
- Error handling: API routes return typed JSON responses with consistent shape `{ data, error }`. Never throw unhandled in API routes.
- Image `<img>` and `next/image` tags must always include `alt` text (use `photos.alt_text` column, fall back to `photos.caption`, then filename).
- Use `satisfies` for type narrowing where possible. Prefer discriminated unions over optional fields.

## Refactoring rules

### Design preservation (hard constraint)

The existing photography portfolio has an established visual design and user experience. **This must not change during refactoring.** The goal of this project is to expand the portfolio's scope by adding backend infrastructure (database, object storage, admin CMS) — not to redesign the frontend.

Specifically:
- Every public-facing page must look pixel-identical after refactoring. The layout, typography, spacing, colors, animations, and responsive behavior must all be preserved.
- Do not change CSS class names, component structure, or Tailwind utilities on existing public components unless strictly necessary for the data source swap (e.g., replacing a hardcoded `src="/images/photo.jpg"` with a dynamic CDN URL).
- Do not "improve" or "modernize" existing styles, component patterns, or UI decisions during refactoring. If something looks intentional, it is.
- If a refactor requires a new wrapper component (e.g., to fetch data), the inner component should remain unchanged — wrap it, don't rewrite it.
- New admin pages can use their own design. The constraint applies only to the existing public-facing portfolio.

### Refactoring approach

- **One page at a time.** Refactor a single route, test it, commit, then move to the next.
- **Don't break static generation.** Any page that was statically generated before should remain statically generated after. Use ISR (`revalidateTag`) rather than switching to dynamic rendering.
- **Additive only.** New features (upload, admin, processing) are additions. Existing functionality is a migration of data source (static → database-driven), not a rewrite.

## Photo lifecycle

Photos move through these statuses: `processing` → `ready` → `archived` (soft delete). Permanent deletion is a separate, destructive operation.

### Status enum

| Status       | Meaning                                    | Visible in gallery? | Visible in projects? | Files in R2? |
|--------------|--------------------------------------------|---------------------|----------------------|--------------|
| `processing` | Upload confirmed, variants being generated | No                  | No                   | Yes          |
| `ready`      | Fully processed, available for use         | If `is_published`   | If project published | Yes          |
| `failed`     | Processing failed (retry or discard)       | No                  | No                   | Partial      |
| `archived`   | Soft-deleted, hidden from public           | No                  | No                   | Yes          |

### Archive (soft delete)

Set `photos.status = 'archived'`. This is the default "remove" action in the admin UI.

Cascade checklist:
1. Set `photos.status` to `archived`
2. Check if this photo is `cover_photo_id` on any project → if so, set `cover_photo_id` to `null` (admin can pick a new cover later)
3. Call `revalidateTag('gallery')`
4. For each project containing this photo, call `revalidateTag('project:<slug>')`

The photo's `photo_categories`, `project_photos`, and `photo_variants` rows stay intact. The photo disappears from public views because public queries filter on `status = 'ready'`. To restore: set status back to `ready`.

### Permanent delete

Irreversible destruction of a photo and all associated data. The admin UI should require explicit confirmation (e.g., type the photo filename to confirm).

Cascade checklist:
1. Check if this photo is `cover_photo_id` on any project → if so, set `cover_photo_id` to `null`
2. Delete all variant files from R2 (query `photo_variants` for storage keys first)
3. Delete the original file from R2 (use `photos.storage_key`)
4. Delete the `photos` row (foreign key `ON DELETE CASCADE` handles `photo_categories`, `project_photos`, and `photo_variants` automatically)
5. Call `revalidateTag('gallery')`
6. For each project that contained this photo, call `revalidateTag('project:<slug>')`

**Important:** Delete R2 files before deleting database rows — you need the storage keys from the database to know what to delete. If the R2 deletion fails, log the orphaned keys for manual cleanup rather than leaving the database in an inconsistent state.

### Bulk operations

The admin UI should support selecting multiple photos for bulk archive and bulk category assignment. Bulk permanent delete should also be supported but gated behind a stricter confirmation flow. Bulk operations should batch their database writes in a single transaction and consolidate revalidation calls (one `revalidateTag('gallery')` at the end, not per-photo).

## Common tasks

**Add a new database table:** Edit `src/db/schema.ts` → run `pnpm drizzle-kit generate` → review migration in `drizzle/` → run `pnpm drizzle-kit migrate`.

**Add a new image variant:** Update the variant enum in schema, add the size config to `src/lib/constants.ts`, update the Sharp pipeline in `src/lib/processing.ts`.

**Add a new category:** Insert a row into the `categories` table with a name, slug, and sort order. No code changes needed — the gallery filter tabs are driven by the database.

**Archive a photo:** Set `status = 'archived'`, clear any cover photo references, revalidate affected pages. See Photo lifecycle above for full cascade.

**Permanently delete a photo:** Delete R2 files first, then delete the database row (cascades to join tables), revalidate affected pages. See Photo lifecycle above for full cascade. Requires confirmation in admin UI.

**Restore an archived photo:** Set `status = 'ready'`, re-assign `is_published` if needed, revalidate gallery and any projects containing the photo.

**Publish a gallery change to the live site:** Admin mutation calls `revalidateTag('gallery')` after adding/removing/reordering photos or changing category assignments.

**Publish a project change:** Admin mutation calls `revalidateTag('project:<slug>')` for the specific project page and `revalidateTag('projects')` for the projects listing page.

## Testing

- Use Vitest for unit tests, Playwright for e2e.
- Test image processing functions with fixture files in `tests/fixtures/`.
- Admin flows: test the full upload → process → publish → public view cycle in e2e.
- Database queries: test against a Neon branch or local Postgres via Docker.

## What NOT to do

- Don't hard-delete photos without explicit confirmation. The default "remove" action should always be archive (soft delete). Permanent deletion is a separate, destructive action.
- Don't delete database rows before R2 files. Storage keys live in the database — delete files first, then rows.
- Don't merge categories and projects into a single "collections" or "albums" table. They are fundamentally different concepts with different data shapes, different UX, and different query patterns.
- Don't add metadata (description, cover photo, ordering) to categories. Categories are flat filter labels, nothing more.
- Don't add freeform tags as a replacement for categories. The category set is predefined and managed through the admin, not typed inline during upload.
- Don't create a `users` table, user model, registration flow, or any multi-user infrastructure. This is a single-admin system. Auth is env-var based.
- Don't install Auth.js, NextAuth, Lucia, Clerk, or any auth library. Middleware + bcrypt + JWT cookie is sufficient.
- Don't add `uploaded_by`, `created_by`, or `user_id` columns to any table. Every record is implicitly owned by the single admin.
- Don't store full URLs in the database. Store storage keys and resolve CDN URLs at render time.
- Don't process images synchronously in API routes. Always enqueue for background processing.
- Don't bypass the ORM for writes. Raw SQL reads are acceptable for complex analytics queries only.
- Don't add client-side state management libraries (Redux, Zustand, etc.). React Server Components + URL state + React context is sufficient for this app's complexity.
- Don't install an image CDN service (Imgix, Cloudinary) — we handle our own variants via Sharp and serve through Cloudflare.

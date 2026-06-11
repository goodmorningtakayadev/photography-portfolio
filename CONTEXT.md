# CONTEXT.md — Domain language

Shared vocabulary for this codebase. Use these terms in code, commits, and
discussion; if a new concept earns a module, name it here first.
Architecture rules and operational detail live in CLAUDE.md — this file is
the glossary plus the map of which module owns which concept.

## Domain terms

- **Photo** — the atomic unit of the photo pool (`photos` table). Identified
  by UUID; its files live in R2 under storage keys, never URLs.
- **Storage key** — R2 object path (`photos/<uuid>/<name>.<ext>`). The DB
  stores keys; URLs are resolved at render time (see Image URL resolution).
- **Variant** — a generated rendition of a photo (`thumb_200`, `web_1200`,
  `retina_2400`), produced by the processing pipeline.
- **Photo status** — `processing → ready → archived` (plus `failed`).
  Archive is a soft delete; permanent delete is a separate destructive
  operation. Public queries only ever see `ready`.
- **Category** — a flat filter label for the gallery (name + slug + sort
  order, nothing more). A photo has zero or more categories. Categories are
  not containers and never gain metadata.
- **Project** — a curated, ordered photo set with its own identity (title,
  slug, description, cover photo, publish state) and its own public page.
- **Membership** — a photo's row in `project_photos`: its position
  (`sort_order`) and per-project **scene note** within one project.
- **Cover** — a project's representative photo. Invariant: a cover must be
  a member of its project; when a photo leaves a project (removal, archive,
  delete), any cover reference to it is nulled.
- **Gallery** — the public all-photos grid, filterable by category, ordered
  by `gallery_sort_order`.
- **Hero** — the homepage's lead photo + focal point, stored in site
  settings.
- **Slug** — URL-safe identifier derived from a name/title; one slugify
  rule for the whole system (`src/lib/slug.ts`), max length per schema
  column.

## Lifecycles and pipelines

- **Photo lifecycle** (`src/lib/photo-lifecycle.ts`) — archive, restore,
  permanent delete, including the cascades (cover nulling, R2-before-DB
  delete ordering, affected-project tracking).
- **Project lifecycle** (`src/lib/project-lifecycle.ts`) — project CRUD and
  membership operations (add, reorder, scene note, remove), including slug
  regeneration, publishedAt stamping, and the cover invariant.
- **Category lifecycle** (`src/lib/category-lifecycle.ts`) — category CRUD.
- **Upload pipeline, server half** (`src/lib/upload-pipeline.ts`) —
  confirm → trigger processing → process/reprocess; owns idempotency and
  the failed-status-on-error guarantee.
- **Upload pipeline, client half** (`src/lib/upload-client.ts`) — per-file
  state machine in the browser: presign → direct-to-R2 PUT → confirm →
  poll. Emits **upload states** (`presigning … ready/failed`).

These modules are pure Node/browser respectively — no Next.js imports.
They return result kinds; callers map kinds to responses and decide what
to revalidate.

## Seams (where behavior changes without editing callers)

- **Public views** (`src/lib/public-views.ts`) — read-only, view-shaped
  data for every public page. The only path from DB rows to public markup.
- **Admin API client** (`src/lib/admin-api.ts`) — the named mutations admin
  components call; owns fetch transport and the `{ data, error }` envelope
  parsing. Components never call `fetch` directly.
- **Route scaffold** (`src/lib/api-route.ts`) — server twin of the admin
  API client: session check, body validation, response envelope, 500
  handling for every admin route.
- **Revalidation policy** (`src/lib/revalidation.ts`) — the one place that
  knows which mutations affect which public pages.
- **Image URL resolution** (`src/lib/image-url.ts`) — storage key → CDN
  URL, and the variant storage-key layout. Client-safe; used by admin,
  public views, and the processing pipeline.
- **Status display** (`src/components/admin/status-display.ts`) — status →
  label/colour for photo badges and the upload queue.

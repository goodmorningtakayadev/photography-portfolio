# Enterprise Plan Audit Report

**Plan:** .paul/phases/07-polish-deploy/07-01-PLAN.md
**Audited:** 2026-03-26
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable** — after applying the findings below.

The plan correctly identifies all the production-polish work needed: next/font migration, domain parameterization, per-route metadata, and dynamic sitemap/robots. The CSS variable bridge strategy is sound — it avoids touching any existing component CSS while switching the font loading mechanism. The scope boundaries are appropriate.

Two must-have issues would cause build failures: the `metadataBase` URL constructor throws on undefined input, and the dynamic sitemap queries the database at build time without forcing dynamic rendering. Both are straightforward to fix.

After upgrades? Yes — this is a clean, focused final-phase plan.

## 2. What Is Solid

- **CSS variable bridge for next/font.** Changing `--f-display` from `'Syne', sans-serif` to `var(--font-syne), sans-serif` is exactly right — it lets every existing component pick up the self-hosted fonts without any CSS changes. Zero-blast-radius migration.
- **Scope discipline.** The plan explicitly defers next/image migration, ESLint setup, and about page CDN photo. These are real temptations for a "polish" phase, and refusing them keeps the plan focused and achievable.
- **Domain parameterization via NEXT_PUBLIC_SITE_URL.** Single env var controlling all canonical URLs, OG tags, sitemap, and robots — correct pattern for multi-environment deployment.
- **Dynamic sitemap with DB query.** Including published project slugs means the sitemap stays current without manual updates — correct for a CMS-driven site.
- **Boundaries section.** Protecting all existing components, API routes, schema, and admin pages is appropriate for a polish phase.

## 3. Enterprise Gaps Identified

### Gap 1: `new URL(process.env.NEXT_PUBLIC_SITE_URL)` throws on undefined
The root layout's `metadata` export is a static object evaluated at module load time. `new URL(undefined)` throws `TypeError: Invalid URL`. This will crash the dev server and build if NEXT_PUBLIC_SITE_URL is not set. Same risk applies to any static metadata export that constructs URLs from this env var.

### Gap 2: sitemap.ts queries DB at build time
The plan's sitemap.ts imports from `@/db` and runs `db.select()`. During `next build`, Next.js attempts to statically render the sitemap route. Without `export const dynamic = 'force-dynamic'`, this requires DATABASE_URL at build time. In CI/CD pipelines or Vercel preview builds where the database isn't available, the build will fail with a connection error.

### Gap 3: robots.ts should also be forced dynamic
Same rationale as sitemap — robots.ts references `NEXT_PUBLIC_SITE_URL`. While it doesn't query the DB, making it dynamic ensures the sitemap URL always reflects the current environment rather than being baked in at build time.

### Gap 4: Stale preload link for legacy hero image
`<link rel="preload" href="/photos/vintage-aesthetics-3.jpg" as="image" />` in the root layout preloads a legacy static file. The homepage hero is now served from the database via CDN. This preload is a wasted high-priority HTTP request — the browser downloads a ~200KB image that isn't rendered. Worse, it contends with the actual hero image download.

### Gap 5: Project detail generateMetadata lacks OpenGraph
The existing `generateMetadata` for `/projects/[slug]` returns only `title` and `description`. The plan says to "enhance with openGraph.images using project cover photo CDN URL" but the action description doesn't specify implementation. Without explicit instructions, the cover photo URL construction (CDN base + storage key + variant) will likely be missed or done incorrectly.

### Gap 6: NEXT_PUBLIC_SITE_URL added to clientEnv but never accessed through it
The plan adds NEXT_PUBLIC_SITE_URL to the `clientSchema` in env.ts. But every usage in the plan (layout.jsx, sitemap.ts, robots.ts, page metadata) accesses `process.env.NEXT_PUBLIC_SITE_URL` directly in server components — not through `clientEnv`. The Zod validation in the lazy proxy never fires, creating a false sense of validation. Either validate where it's actually used, or drop from clientSchema.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | metadataBase throws on undefined NEXT_PUBLIC_SITE_URL | Task 1 action (domain parameterization) | Added fallback: `new URL(process.env.NEXT_PUBLIC_SITE_URL \|\| 'http://localhost:3000')` for metadataBase and all URL constructions |
| 2 | sitemap.ts needs force-dynamic to avoid build-time DB access failure | Task 2 action (dynamic sitemap) | Added `export const dynamic = 'force-dynamic'` to sitemap.ts code |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | robots.ts should be forced dynamic for environment consistency | Task 2 action (dynamic robots) | Added `export const dynamic = 'force-dynamic'` to robots.ts code |
| 2 | Stale preload link wastes bandwidth on legacy hero image | Task 1 action (root layout changes) | Added instruction to remove the preload link |
| 3 | Project detail generateMetadata needs explicit OG implementation | Task 2 action (per-route metadata) | Added specific openGraph implementation with cover photo CDN URL and fallback |
| 4 | NEXT_PUBLIC_SITE_URL in clientEnv is dead validation | Task 1 action (env.ts) | Changed from clientSchema to direct process.env usage with inline fallback |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Root layout is .jsx not .tsx | Renaming files is cosmetic — all functionality works, TypeScript validates imported modules |
| 2 | Legacy static files in public/ (photos/optimized/, photos/*.jpg) | Still used by about page photo and as OG image fallback — removing requires site_settings table for admin-configurable assets |
| 3 | OG image is a static legacy file, not dynamic CDN content | The static file exists and will be deployed — works correctly. Making it dynamic requires a "site settings" mechanism to pick the OG photo |

## 5. Audit & Compliance Readiness

- **Build reliability:** After must-have fixes, `pnpm build` succeeds without requiring DATABASE_URL at build time (sitemap/robots are dynamic). This is critical for CI/CD and Vercel preview deployments.
- **Environment portability:** With the fallback pattern on NEXT_PUBLIC_SITE_URL, local dev works without the var set, while production uses the real domain. No environment-specific code paths.
- **SEO correctness:** Dynamic sitemap includes all published projects. Per-route metadata ensures proper indexing. Canonical URLs prevent duplicate content issues.
- **No silent failures:** The removed dead validation (clientEnv) eliminates false confidence. The fallback URLs ensure graceful degradation rather than crashes.

## 6. Final Release Bar

**What must be true before this ships:**
- All URL constructions have fallbacks for missing env vars
- Sitemap and robots are dynamically rendered (not baked at build time)
- Stale preload link removed to avoid wasted bandwidth
- Every public page has unique metadata with OG tags

**Risks remaining if shipped as-is (without fixes):**
- Build crashes in environments without NEXT_PUBLIC_SITE_URL (CI/CD, fresh clones)
- Build crashes in environments without DATABASE_URL (Vercel preview deploys)
- 200KB wasted download from stale preload on every page load

**After fixes applied:** Would sign off. This is a focused, appropriately-scoped final phase.

---

**Summary:** Applied 2 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

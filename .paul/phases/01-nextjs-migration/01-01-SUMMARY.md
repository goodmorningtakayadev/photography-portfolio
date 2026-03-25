---
phase: 01-nextjs-migration
plan: 01
subsystem: infra
tags: [next.js, app-router, tailwind-v4, pnpm, migration, vite-removal]

requires:
  - phase: none
    provides: First phase — existing Vite+React SPA codebase
provides:
  - Next.js App Router project with 3 public routes (/, /gallery, /about)
  - Tailwind v4 CSS-first setup (ready for admin pages)
  - TypeScript config with allowJs (ready for incremental adoption)
  - pnpm package manager
  - Pixel-identical public portfolio
affects: [02-database-schema (Next.js project exists), 03-authentication (middleware available), 05-admin-interface (Tailwind ready)]

tech-stack:
  added: [next@15.5.14, tailwindcss@4.2.2, @tailwindcss/postcss@4.2.2, typescript@5.9.3]
  removed: [vite@7.2.4, @vitejs/plugin-react@5.1.1, react-router-dom@7.13.0, eslint (Vite-specific)]
  patterns: [App Router file-based routing, "use client" for interactive components, client component wrappers for page-level routes]

key-files:
  created: [src/app/layout.jsx, src/app/globals.css, src/app/(public)/page.jsx, src/app/(public)/gallery/page.jsx, src/app/(public)/about/page.jsx, next.config.js, tsconfig.json, postcss.config.mjs, .env.local]
  modified: [package.json, src/components/Header/Header.jsx, src/components/Footer/Footer.jsx, src/components/ContactForm/ContactForm.jsx, src/components/Lightbox/Lightbox.jsx, src/components/Gallery/Gallery.jsx, src/components/EditorialSpread/EditorialSpread.jsx, src/hooks/useViewCursor.js]
  moved: [src/pages/* → src/page-components/* (avoid Pages Router conflict)]

key-decisions:
  - "Moved src/pages/ to src/page-components/ — Next.js treated src/pages/ as Pages Router routes"
  - "Tailwind v4 CSS-first config (no tailwind.config.js) — @import 'tailwindcss' in globals.css"
  - "Existing CSS imported before Tailwind to avoid @import ordering warnings"
  - "GalleryPage wrapped in Suspense for useSearchParams compatibility"
  - "NEXT_PUBLIC_WEB3FORMS_KEY replaces VITE_WEB3FORMS_KEY for client-side env access"

patterns-established:
  - "Page components live in src/page-components/ (not src/pages/ which is reserved for Pages Router)"
  - "Route files in src/app/ are thin wrappers with 'use client' that import page components"
  - "All interactive components use 'use client' directive"
  - "next/link with href= (not to=) for all navigation"
  - "usePathname() replaces useLocation().pathname"
  - "useRouter().replace() with URLSearchParams replaces setSearchParams()"

duration: ~25min
started: 2026-03-25
completed: 2026-03-25
---

# Phase 1 Plan 01: Next.js App Router Migration Summary

**Migrated Vite+React SPA to Next.js 15 App Router with Tailwind v4, pnpm, and pixel-identical public pages — all 3 routes statically generated.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 3 completed (2 auto + 1 human checkpoint) |
| Files created | 9 |
| Files modified | 8 |
| Files moved | 6 (src/pages/ → src/page-components/) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Next.js Project Builds Successfully | Pass | `pnpm build` zero errors, all 3 routes static |
| AC-2: All Three Public Routes Render | Pass | /, /gallery, /about all render correctly — human verified |
| AC-3: react-router-dom and Vite APIs Fully Replaced | Pass | grep returns 0 matches for react-router-dom and import.meta.env |
| AC-4: Existing Design Preserved | Pass | Human verified — typing animation, film grain, scanlines, lightbox, VIEW cursor, category filtering, mobile nav all working |
| AC-5: Package Manager Switched to pnpm | Pass | pnpm-lock.yaml exists, package-lock.json removed |

## Accomplishments

- Fully replaced Vite build system with Next.js 15 App Router — 3 statically generated routes
- Eliminated react-router-dom: Link→next/link, useLocation→usePathname, useSearchParams→next/navigation, setSearchParams→router.replace
- Migrated Vite env vars (import.meta.env.VITE_*) to Next.js (process.env.NEXT_PUBLIC_*) — caught by enterprise audit
- Installed Tailwind v4 with CSS-first configuration, ready for admin UI in Phase 5
- Preserved all existing visual design pixel-identical (human verified)

## Skill Audit

No required skills for this plan (structural migration, no UI/design changes).

| Expected | Invoked | Notes |
|----------|---------|-------|
| /frontend-design | N/A | No UI work in this plan |
| /ui-ux-pro-max | N/A | No design decisions |
| /bencium-controlled-ux-designer | N/A | No visual changes |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `package.json` | Modified | Next.js deps, pnpm scripts, removed Vite/ESLint/react-router-dom |
| `next.config.js` | Created | Minimal Next.js config |
| `tsconfig.json` | Created | Strict TS with allowJs, @/ path alias |
| `postcss.config.mjs` | Created | @tailwindcss/postcss plugin for Tailwind v4 |
| `src/app/layout.jsx` | Created | Root layout with Header/Footer shell, metadata, JSON-LD |
| `src/app/globals.css` | Created | Imports existing global.css + Tailwind |
| `src/app/(public)/page.jsx` | Created | Home route wrapper |
| `src/app/(public)/gallery/page.jsx` | Created | Gallery route wrapper with Suspense |
| `src/app/(public)/about/page.jsx` | Created | About route wrapper |
| `.env.local` | Created | NEXT_PUBLIC_WEB3FORMS_KEY |
| `src/components/Header/Header.jsx` | Modified | next/link, usePathname, href= |
| `src/components/Footer/Footer.jsx` | Modified | next/link, href= |
| `src/components/ContactForm/ContactForm.jsx` | Modified | process.env.NEXT_PUBLIC_WEB3FORMS_KEY |
| `src/components/Lightbox/Lightbox.jsx` | Modified | "use client", null guard |
| `src/components/Gallery/Gallery.jsx` | Modified | "use client" |
| `src/components/EditorialSpread/EditorialSpread.jsx` | Modified | "use client" |
| `src/page-components/Home.jsx` | Modified (moved) | next/link, href=, "use client" |
| `src/page-components/GalleryPage.jsx` | Modified (moved) | next/navigation, router.replace, "use client" |
| `src/page-components/About.jsx` | Modified (moved) | "use client" |
| `src/hooks/useViewCursor.js` | Modified | Removed empty deps array for conditional render fix |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Move src/pages/ → src/page-components/ | Next.js treats src/pages/ as Pages Router — caused duplicate route generation | All page component imports updated; pattern established for project |
| Tailwind v4 CSS-first (no tailwind.config.js) | Tailwind v4 eliminated JS config; audit caught incorrect v3-style plan | postcss.config.mjs + @import "tailwindcss" in CSS only |
| Existing CSS before Tailwind in globals.css | Prevents @import ordering warning from Google Fonts in global.css | CSS load order: global.css (with fonts) → Tailwind utilities |
| Suspense wrapper on GalleryPage route | Next.js useSearchParams in App Router can trigger suspense boundary requirement | Gallery route wrapped in Suspense fallback={null} |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 3 | Essential fixes for Next.js compatibility |
| Scope additions | 0 | — |
| Deferred | 0 | — |

**Total impact:** All deviations were essential fixes — no scope creep.

### Auto-fixed Issues

**1. Pages Router conflict — src/pages/ treated as routes**
- **Found during:** Task 2 (build verification)
- **Issue:** Next.js generated Pages Router routes for Home, GalleryPage, About alongside App Router routes
- **Fix:** Moved src/pages/ → src/page-components/, updated all imports
- **Files:** 3 page components + 3 route wrappers
- **Verification:** Rebuild showed only App Router routes

**2. Lightbox null prop guard**
- **Found during:** Checkpoint (dev server testing)
- **Issue:** Lightbox crashed with `photos.findIndex` on undefined — hydration edge case
- **Fix:** Added early return if `!photo || !photos || photos.length === 0`
- **Files:** src/components/Lightbox/Lightbox.jsx
- **Verification:** Page loads without error

**3. useViewCursor effect deps for conditional rendering**
- **Found during:** Checkpoint (visual verification)
- **Issue:** VIEW cursor didn't appear on Projects cards — refs were null when useEffect ran with `[]` deps because projects grid is conditionally rendered
- **Fix:** Removed empty dependency array so effect re-runs when refs attach
- **Files:** src/hooks/useViewCursor.js
- **Verification:** VIEW cursor appears on Projects cards

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| pnpm not installed globally | Installed with `npm install -g pnpm` |
| sharp build scripts warning | Ran `pnpm approve-builds sharp` |
| @types/node missing | Auto-installed by Next.js during first build |
| CSS @import ordering warning | Reordered globals.css to import existing CSS before Tailwind |

## Next Phase Readiness

**Ready:**
- Next.js App Router project fully operational
- Tailwind v4 installed and ready for admin UI (Phase 5)
- TypeScript config with allowJs for incremental adoption
- pnpm as package manager
- All existing functionality preserved

**Concerns:**
- useViewCursor effect runs on every render (no deps) — acceptable for now, could optimize later
- Page components in src/page-components/ is non-standard naming — works fine but future phases may consolidate into app/ routes
- Google Fonts loaded via CSS @import (deferred: next/font optimization in Phase 7)

**Blockers:**
- None

---
*Phase: 01-nextjs-migration, Plan: 01*
*Completed: 2026-03-25*

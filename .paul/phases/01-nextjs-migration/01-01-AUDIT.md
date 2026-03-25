# Enterprise Plan Audit Report

**Plan:** .paul/phases/01-nextjs-migration/01-01-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable (after applied fixes)

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan was structurally sound but contained three release-blocking issues that would cause silent failures in production:

1. The ContactForm uses `import.meta.env.VITE_WEB3FORMS_KEY` — a Vite-only API that does not exist in Next.js. Without migration, the contact form silently fails (no API key → Web3Forms rejects the submission). This was completely unaddressed.
2. Tailwind v4 setup was specified incorrectly — the plan listed `tailwind.config.js` as a file to create, but Tailwind v4 uses CSS-first configuration with no JS config file. Following the original plan would produce either a build error or a misconfigured Tailwind install.
3. The Home.jsx migration instruction referenced `useNavigate` which does not exist in the source — a factual error that would cause confusion during execution.

After applying the fixes below, the plan is ready for execution. I would approve this for production.

## 2. What Is Solid

- **Boundary protection is excellent.** The DO NOT CHANGE list explicitly covers every CSS file, hooks, utils, data, and public assets. This prevents accidental visual regressions during a high-risk structural migration.
- **Human verification checkpoint is well-designed.** The checkpoint covers all major interaction patterns (typing animation, lightbox keyboard nav, category filtering, mobile menu, contact form submission). This is the right safety net for a visual preservation migration.
- **Router migration mapping is thorough.** The plan correctly identifies every component that imports from react-router-dom and specifies the exact Next.js replacement for each hook (useLocation → usePathname, useSearchParams → useSearchParams + useRouter).
- **Scope discipline is strong.** Explicit exclusions (no TypeScript conversion, no next/image, no Tailwind on existing components, no data source changes) prevent scope creep during what should be a mechanical migration.
- **"use client" strategy is correct.** Marking all existing interactive components as client components avoids hydration mismatches and preserves exact runtime behavior.

## 3. Enterprise Gaps Identified

### Critical: Vite `import.meta.env` API not addressed
`ContactForm.jsx` line 87 reads `import.meta.env.VITE_WEB3FORMS_KEY`. This is Vite's build-time env injection — it does not exist in Next.js. The form will silently send `undefined` as the access key, causing all submissions to fail with no user-visible error (Web3Forms returns 401 but the form may not surface it clearly). Neither the plan's tasks nor context section mentioned this dependency.

### Critical: Tailwind v4 config mismatch
The plan's frontmatter listed `tailwind.config.js` in `files_modified` and Task 1 files. Tailwind v4 (released Jan 2025) eliminated the JS config file entirely — configuration is done via CSS `@import "tailwindcss"` directives and `@theme` blocks. Creating a `tailwind.config.js` would either be ignored (wasted file) or cause confusion about which config source is authoritative.

### High: Factual error in Home.jsx migration
The plan stated Home.jsx "Uses Link, useNavigate from react-router-dom". Source inspection confirms Home.jsx only imports `Link` — no `useNavigate` usage exists. The Task 2 instruction to "Replace useNavigate with useRouter" would cause the implementer to search for code that doesn't exist, wasting time and creating confusion.

### Medium: GalleryPage setSearchParams underspecified
While the plan mentioned replacing `setSearchParams` with `router.replace`, it didn't specify the exact 3 call patterns. GalleryPage has distinct patterns: empty params for "all", single category, and category+collection compound params. Without explicit patterns, the implementer must reverse-engineer the correct URL construction for each.

### Medium: ESLint handling vague
"Move ESLint config to Next.js compatible setup or remove for now" leaves ambiguity about which path to take. For a migration phase, removing Vite-specific ESLint and deferring Next.js ESLint is the correct approach — should be stated explicitly.

### Low: Header useEffect dependency arrays
The Header has two useEffect hooks that depend on `location.pathname` and `location`. After migration to `usePathname()`, these dependency arrays must be updated to `[pathname]`. This is straightforward but easy to miss during mechanical find-and-replace.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | ContactForm uses `import.meta.env.VITE_WEB3FORMS_KEY` — Vite API doesn't exist in Next.js | Task 1 action (added step 11: env var migration), Task 2 action (added ContactForm.jsx replacement), files_modified (added ContactForm.jsx, .env.local), AC-3 (added import.meta.env check), verification (added grep check) | Added env var migration from VITE_ prefix to NEXT_PUBLIC_ prefix, explicit ContactForm.jsx `process.env` replacement, and verification grep |
| 2 | Tailwind v4 uses CSS-first config, not tailwind.config.js | Task 1 files (removed tailwind.config.js, changed to postcss.config.mjs), Task 1 action step 9 (rewritten for v4 CSS-first), frontmatter files_modified (removed tailwind.config.js), Task 1 verify (added no tailwind.config.js check), verification section (added check) | Removed all tailwind.config.js references, specified CSS-first setup with @import "tailwindcss" |
| 3 | Home.jsx does NOT use useNavigate — factual error | Context section (corrected), Task 2 action item for Home.jsx (corrected) | Corrected to "Uses Link from react-router-dom (no useNavigate)" |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | GalleryPage setSearchParams needs concrete replacement patterns | Task 2 action item for GalleryPage.jsx | Added explicit replacement for all 3 setSearchParams call sites with exact router.replace() patterns |
| 2 | ESLint handling was vague ("remove or move") | Task 1 action step 4 (new, replaces old step 10) | Made explicit: remove eslint.config.js and all Vite ESLint deps, defer Next.js ESLint to Phase 7 |
| 3 | Header useEffect dependency arrays need explicit update | Task 2 action item for Header.jsx | Added comment about useEffect deps changing from location.pathname to pathname |
| 4 | Task 1 needs dev server smoke test before Task 2 | Task 1 verify | Added: pnpm dev starts without config errors as smoke test |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Google Fonts should use next/font for performance | Existing @import url() works correctly in Next.js CSS. next/font optimization is a Phase 7 polish item, not a migration requirement. |
| 2 | Per-route metadata (different titles for /gallery, /about) | All routes currently share the same SPA meta tags. Route-specific metadata can be added when pages become server components in Phase 6. |
| 3 | Next.js ESLint plugin (next/core-web-vitals) | Removed Vite ESLint in this phase. Next.js ESLint setup is a Phase 7 polish item. No linting is safer than wrong linting during a migration. |

## 5. Audit & Compliance Readiness

**Evidence production:** The plan includes multiple automated verification steps (grep checks for eliminated dependencies, build verification) and a human checkpoint. This provides audit-defensible evidence that the migration was validated.

**Silent failure prevention:** The critical `import.meta.env` fix addresses the highest-risk silent failure — without it, the contact form would appear functional but silently fail all submissions. The Tailwind v4 config fix prevents build-time confusion.

**Post-incident reconstruction:** Git branch `refactor/nextjs-cms` preserves the original codebase on `master`. If the migration breaks, `git diff master` reconstructs exactly what changed. The plan's scope limits prevent unrelated changes from polluting the diff.

**Ownership and accountability:** Single plan, single concern (framework migration), single branch. Clear ownership.

## 6. Final Release Bar

**What must be true:**
- All 3 routes render identically to the Vite version
- `import.meta.env` is fully eliminated (grep returns zero)
- `react-router-dom` is fully eliminated (grep returns zero)
- Contact form successfully submits (env var migration worked)
- `pnpm build` produces zero errors
- Human verification checkpoint passed

**Remaining risks if shipped as-is (after fixes):**
- Google Fonts load via @import (slight performance hit vs next/font) — acceptable for migration phase
- No per-route SEO metadata — same as current SPA behavior, no regression
- No ESLint — acceptable for one phase, must be restored in Phase 7

**Sign-off:** With the applied fixes, I would sign my name to this migration plan. The risks are well-contained and the verification is thorough.

---

**Summary:** Applied 3 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

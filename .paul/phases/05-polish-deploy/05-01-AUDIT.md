# Enterprise Plan Audit Report

**Plan:** .paul/phases/05-polish-deploy/05-01-PLAN.md
**Audited:** 2026-03-23
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable** — after applying the 6 upgrades below.

The plan is well-scoped with clear task separation (SEO vs performance), explicit boundaries, and a zero-dependency constraint that aligns with the project's architecture philosophy. However, two must-have issues would have caused silent failures in production: the hero preload targeted the wrong asset format, and og:image lacked the absolute URL requirement mandated by the OG protocol. Both are now corrected.

Would I sign off on this plan post-fixes? Yes. The scope is appropriate for a pre-deployment polish phase, the tasks are specific enough for autonomous execution, and the boundaries correctly protect all existing UI/component code.

## 2. What Is Solid

- **Task decomposition is clean.** SEO (static files + meta tags) and performance (code splitting + build config) are correctly separated. Neither task depends on the other, and both can be verified independently.
- **Zero-dependency constraint is correct.** For a Vite SPA deploying to Vercel, compression is handled at the CDN layer. Adding vite-plugin-compression would be wasted complexity.
- **Boundary protection is comprehensive.** All page components, styles, data files, and CLI scripts are explicitly protected. This prevents scope creep into UI work.
- **Placeholder domain strategy is sound.** Using `https://example.com` and deferring real domain to 05-02 (deployment) is the right sequencing — domain isn't known until deployment platform is configured.
- **Home kept as static import.** Correct decision — the landing page should never be lazy-loaded. Only secondary routes benefit from code splitting.
- **Vendor chunk strategy is appropriate.** Separating react/react-dom/react-router-dom into a vendor chunk leverages long-term caching since framework code changes infrequently.

## 3. Enterprise Gaps Identified

### Gap 1: Hero Preload Asset Mismatch (CRITICAL)
The plan specified preloading "the optimized display WebP variant" for the hero image. However, `Home.jsx` line 44 calls `getImageUrl(heroPhoto, 'full')`, and `imageHelpers.js` returns `photo.url` for the 'full' size — which is `/photos/vintage-aesthetics-3.jpg` (original JPG). Preloading a WebP that is never requested wastes bandwidth and provides zero benefit. The actual hero render would still wait for the JPG.

### Gap 2: og:image Requires Absolute URL (CRITICAL)
The Open Graph protocol requires absolute URLs for `og:image`. The plan mentioned using "a representative photo path" without specifying it must be absolute. Social media crawlers resolve og:image literally — a relative path like `/photos/image.jpg` will fail silently on Facebook, Twitter, and LinkedIn. No error, no image, no indication of why.

### Gap 3: SPA Meta Tag Limitation Undocumented
This is a client-side SPA. All 3 routes (`/`, `/gallery`, `/about`) serve the identical `index.html`. Social media crawlers (Facebook, Twitter, LinkedIn) do not execute JavaScript. Every URL shared on social media will display the same OG title, description, and image — regardless of which route was shared. This isn't a bug to fix (it requires SSR/prerendering, which is out of scope), but it's a limitation that should be explicitly documented to prevent confusion during testing or future work.

### Gap 4: Production Build Not Verified
The verification section tested with `npm run dev`, which uses Vite's dev server with HMR — it does NOT use the built/split chunks. Code splitting effectiveness can only be verified against the production build. `npm run preview` serves the built output and would catch build-time issues that dev mode masks.

### Gap 5: No Build Size Baseline Comparison
The plan verifies "multiple JS chunks exist" but doesn't verify the split is meaningful. If manualChunks misconfigures and the vendor chunk is 5KB while the main chunk remains 255KB, the check would pass despite negligible improvement. A comparison against the pre-split ~260KB baseline is needed.

### Gap 6: Sitemap Missing lastmod
The plan specified `changefreq` and `priority` but omitted `<lastmod>`. Google has publicly stated that `lastmod` is the most useful sitemap signal, while `changefreq` and `priority` are largely ignored by modern crawlers.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Hero preload targets wrong image format (WebP vs actual JPG) | Task 2 action, AC-5 | Corrected preload to `/photos/vintage-aesthetics-3.jpg` with `as="image"` (no `type="image/webp"`). Added note about manual update if hero changes. |
| 2 | og:image requires absolute URL per OG protocol | Task 1 action | Specified og:image must use absolute URL format `https://example.com/photos/optimized/{id}-display.webp`. Noted relative paths silently fail. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | SPA meta tag limitation undocumented | Boundaries (new KNOWN LIMITATIONS subsection) | Added explicit documentation that all routes share same OG tags due to SPA architecture, and that per-route meta requires SSR (out of scope). |
| 2 | Production build not verified with `npm run preview` | Task 2 verify, Verification section | Added `npm run preview` verification step for production build testing. |
| 3 | No build size comparison against baseline | Task 2 verify, Verification section | Added baseline comparison check (~260KB pre-split) to confirm meaningful reduction. |
| 4 | Sitemap missing `<lastmod>` dates | Task 1 action | Added `<lastmod>` requirement with today's date (2026-03-23). |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Per-route meta tags via SSR/prerendering | Requires new dependencies or SSR conversion — both explicitly out of scope. Shared OG tags are standard practice for personal portfolio SPAs. |
| 2 | JSON-LD Schema.org vocabulary validation | Parsing as valid JSON is sufficient for deployment. Schema.org structured data testing tool validation is a future polish item. |
| 3 | Suspense loading fallback for lazy routes | `fallback={null}` is acceptable for small route chunks (~10-30KB) on a portfolio site. A proper loading state is a UI concern outside this plan's infrastructure scope. |

## 5. Audit & Compliance Readiness

**Audit Evidence:**
- Build output is verifiable (chunk files in dist/assets)
- SEO tags are inspectable in static index.html (no runtime generation)
- sitemap.xml and robots.txt are static files, directly verifiable

**Silent Failure Prevention:**
- Must-have #1 (hero preload) prevented a silent performance waste — wrong preload would load an unused asset
- Must-have #2 (og:image absolute URL) prevented silent social sharing failure — no error, just missing images on every social platform
- The KNOWN LIMITATIONS section prevents future confusion about why different routes show the same social preview

**Post-Incident Reconstruction:**
- All changes are to static files or build config — fully diffable in version control
- No runtime state or database changes in this plan

**Ownership:**
- Plan is autonomous (no checkpoints) — single executor can complete without handoffs

## 6. Final Release Bar

**What must be true before this plan ships:**
- Hero preload in index.html matches the actual hero image path used by Home.jsx
- og:image uses absolute URL with placeholder domain
- Build produces at least 3 distinct JS chunks (vendor, main, lazy routes)
- Main chunk is measurably smaller than pre-split ~260KB baseline
- `npm run preview` serves all routes correctly

**Remaining risks if shipped as-is (post-fixes):**
- Placeholder domain (`example.com`) means SEO meta tags are non-functional until 05-02 updates them — this is by design and acceptable
- SPA limitation means social sharing shows same preview for all routes — documented, acceptable for portfolio

**Sign-off:** I would approve this plan for execution after the applied fixes. The scope is right-sized, the implementation instructions are specific enough for autonomous execution, and the boundary protections are comprehensive.

---

**Summary:** Applied 2 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

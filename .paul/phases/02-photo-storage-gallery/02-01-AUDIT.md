# Enterprise Plan Audit Report

**Plan:** .paul/phases/02-photo-storage-gallery/02-01-PLAN.md
**Audited:** 2026-03-23
**Verdict:** Conditionally Acceptable → Acceptable (after applying findings)

---

## 1. Executive Verdict

**Conditionally acceptable**, upgraded to **acceptable** after auto-applying findings.

The plan has solid structure: well-scoped decision checkpoint, clear acceptance criteria, appropriate boundaries, and specific component-by-component update instructions. However, the audit found **3 must-have** and **4 strongly-recommended** gaps that, if shipped as-is, would result in a silent breakage vector (hardcoded hero index), incomplete optimization scope (category cards missed), and zero error resilience (no fallback for broken images).

After applying all must-have and strongly-recommended findings, I would approve this plan for execution.

## 2. What Is Solid

- **Decision checkpoint placement.** Correctly gates all implementation work on the storage approach decision. The three options are well-analyzed with honest pros/cons. No false choices.
- **Boundaries section.** Comprehensive protection of Phase 1 artifacts, design system CSS, and explicit scope limits deferring pagination/CMS/collections to correct future phases.
- **Task specificity.** Task 2 and Task 3 specify exact files, exact function signatures, and exact import paths. An implementer can execute without asking clarifying questions.
- **Acceptance criteria format.** AC-1 through AC-4 are testable, behavior-focused, and cover the key dimensions (structure, optimization, delivery, regression).
- **Skills section.** Correctly identifies all three required skills from SPECIAL-FLOWS.md with blocking enforcement.

## 3. Enterprise Gaps Identified

### Gap 1: Hero image hardcoded array index (CRITICAL)
`Home.jsx:39` uses `featuredPhotos[5]?.url` — a hardcoded index into the filtered featured photos array. With exactly 6 photos all marked `featured: true`, index 5 happens to be the last entry (Vintage Aesthetics). When the data architecture is enhanced and more photos are added (the entire purpose of this plan), this index will point to a different photo or `undefined`. The `?.` prevents a crash but produces a hero section with no background image — a **silent visual failure** at the top of the site.

### Gap 2: Home.jsx category card images excluded from Task 3
`Home.jsx:117` renders category cards with `<img src={photo.thumbnail}>` — direct data access, not routed through imageHelpers. Task 3 action item 4 only mentions "hero background/image reference" and "featured photos section." The category cards section would remain using un-optimized original files, defeating the optimization goal for a visible section of the home page.

### Gap 3: `files_modified` frontmatter missing new file
`src/utils/imageHelpers.js` is created in Task 2 but not listed in the `files_modified` frontmatter field. This field is used for conflict detection with parallel plans. An incomplete list could allow conflicting modifications to go undetected.

### Gap 4: No image error/fallback handling
No `<img>` element in the codebase has an `onerror` handler. If Cloudinary (option-a/c) has an outage, or image URLs are misconfigured, every image displays as a broken icon. For a photography portfolio, broken images IS a broken product. The plan had no acceptance criterion or task action covering degraded state.

### Gap 5: No `sizes` attribute specification
Task 3 mentions adding `srcset` and `sizes` attribute but doesn't specify values. Without accurate `sizes`, the browser defaults to assuming the image is the full viewport width and will always download the largest variant from the srcset, negating the entire responsive optimization.

### Gap 6: `alt` text improvement not specified
The data structure adds a `description` field, and the plan adds accessibility through skills, but no task specifies how `description` should map to `alt` text on images. Currently all images use `alt={photo.title}` which is minimal. The `description` field should be the preferred `alt` source with `title` as fallback.

### Gap 7: Gallery.jsx uses `photo.thumbnail`, not `photo.url`
Task 3 action item 1 says "Replace img src={photo.url}" but the actual code at `Gallery.jsx:89` uses `photo.thumbnail`. Minor but could cause confusion during implementation.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Hero image hardcoded index `featuredPhotos[5]` will break silently as photos are added | Task 2 (data schema) + Task 3 (Home.jsx) | Added `heroImage` boolean field to data schema. Task 3 now requires replacing hardcoded index with `photoData.photos.find(p => p.heroImage)`. Added verification check. |
| 2 | `files_modified` missing `src/utils/imageHelpers.js` | Frontmatter | Added `src/utils/imageHelpers.js` to `files_modified` array |
| 3 | Home.jsx category card images not covered in Task 3 | Task 3 action item 4 | Added explicit instruction to update category card `photo.thumbnail` references to use `getImageUrl(photo, 'thumbnail')` |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 4 | No image error/fallback handling | AC (new AC-5) + Task 2 (helper) + Task 3 (all components) | Added AC-5 for image error resilience. Added `getFallbackUrl()` to imageHelpers. Added `onError` handler instructions to all image updates in Task 3. Added verification step to deliberately break an image URL and confirm fallback. |
| 5 | No `sizes` attribute values specified | Task 3 (all component actions) | Added explicit `sizes` values: Gallery `(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw`, Lightbox `100vw`, EditorialSpread hero `100vw` / scattered `(max-width: 768px) 100vw, 60vw` |
| 6 | `alt` text not leveraging new `description` field | Task 2 (helper) + Task 3 (all components) | Added `getAltText(photo)` helper returning `description \|\| title`. Updated all component actions to use `alt={getAltText(photo)}`. |
| 7 | Gallery.jsx uses `photo.thumbnail` not `photo.url` | Task 3 action item 1 | Corrected: "Replace img src={photo.thumbnail}" instead of `photo.url` |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 8 | Categories array schema not reviewed for Phase 3 forward-compatibility | Phase 3 will design project/collection model and can extend categories then. Current structure works for this plan's scope. |
| 9 | AC-2 wording ambiguous for Cloudinary (no explicit "pipeline run") | Decision checkpoint resolves which approach to use; implementer will have full context. Low ambiguity risk. |
| 10 | Branching if/else implementation instructions in Task 2 | Acceptable given checkpoint-first execution model. Post-decision, implementer knows which path to follow. |

## 5. Audit & Compliance Readiness

**Produces defensible audit evidence:** Yes. Verification steps are specific: dev server checks, browser DevTools network tab, specific interaction tests (filtering, lightbox nav, arrow keys, ESC). The added fallback verification (deliberately break an image URL) strengthens evidence of resilience.

**Prevents silent failures:** After fixes — yes. The hero image fix eliminates the primary silent failure vector. The onError fallback handlers prevent broken image icons from reaching users. Before fixes, Gap 1 was a guaranteed silent failure once photos were added.

**Supports post-incident reconstruction:** Adequate. Clear file lists, acceptance criteria with Given/When/Then format, and boundaries that define what should NOT have changed make it possible to trace any issues back to plan scope.

**Clear ownership and accountability:** Yes. Tasks are specific enough to assign. The decision checkpoint creates a documented record of the architectural choice with rationale.

## 6. Final Release Bar

**What must be true before this plan ships:**
- Hero image selection is data-driven (`heroImage` flag), not index-based
- Every `<img>` in Gallery, Lightbox, EditorialSpread, and Home routes through `imageHelpers`
- Every `<img>` has an `onError` fallback that prevents broken image display
- `sizes` attributes are present with values matching the actual CSS layout breakpoints
- All 6 existing photos are migrated to enhanced schema with zero visual regression

**Risks remaining after applying fixes:**
- Cloudinary free tier bandwidth limits (25GB/month) could be hit with viral traffic — acceptable risk for a portfolio
- The decision checkpoint introduces a human dependency that blocks autonomous execution — correct tradeoff for an architectural decision
- `description` fields will initially be placeholders — acceptable, content can be refined incrementally

**Would I sign my name to this?** Yes, after the applied fixes. The plan correctly scopes a foundational architecture change, protects completed work, and now handles the failure cases that a production system requires.

---

**Summary:** Applied 3 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

# Enterprise Plan Audit Report

**Plan:** .paul/phases/03-projects-collections/03-01-PLAN.md
**Audited:** 2026-03-23
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan's core architecture is sound — extending an existing JSON data model with a collections array and creating a listing page follows established project patterns. However, the original plan had gaps in defensive coding, accessibility, and dead-link UX that would have shipped latent bugs and accessibility violations. All must-have and strongly-recommended findings have been applied. With those upgrades, the plan is ready for execution.

Would I sign off on this for production? **Yes, after the applied upgrades.**

## 2. What Is Solid

- **Data normalization is correct.** Collections reference photos by ID rather than embedding photo data. This avoids duplication and allows a photo to appear in multiple collections without inconsistency. The one-to-many relationship sits on the collection side, which is the right direction for this use case.

- **Explicit boundaries protecting existing work.** Gallery, Lightbox, Header, ContactForm, global styles, and the image optimization pipeline are all marked as DO NOT CHANGE. This prevents unintended regressions from scope creep.

- **Visual checkpoint before completion.** Human verification of the UI before closing the plan catches aesthetic and interaction issues that automated checks miss. Appropriate for a design-sensitive portfolio site.

- **Reuse of existing imageHelpers utilities.** Using getImageUrl, getImageSrcSet, and getAltText for cover images maintains consistency and avoids duplicate logic.

- **Clear scope separation between 03-01 and 03-02.** Data model + listing page (03-01) vs. detail page + navigation (03-02) is a clean vertical split that avoids task bloat.

- **No false dependencies.** Wave 1 with empty depends_on is correct — this plan genuinely has no prerequisite beyond the completed Phase 2 work.

## 3. Enterprise Gaps Identified

### Gap 1: No defensive handling for invalid photo references (HIGH)
Helper functions would crash with undefined property access if a coverPhotoId or photoIds entry references a non-existent photo. This can happen from data entry typos or if a photo is later removed from photos.json while still referenced by a collection.

### Gap 2: Missing accessibility requirements (HIGH)
The original plan specified hover interactions but no keyboard navigation, focus states, alt text for cover images, or semantic HTML structure. The existing site has accessibility patterns in ContactForm — this page would be inconsistent.

### Gap 3: Dead links to non-existent detail page (MEDIUM)
Cards linked to `/projects/{id}` but the detail page (Plan 03-02) doesn't exist yet. The placeholder route rendered the listing page for detail URLs, which would confuse users who click a card and see the same page. Also creates dead-link issues for bookmarks/sharing.

### Gap 4: No empty state handling (MEDIUM)
No specification for what /projects shows when there are zero collections. During development or if the collections array is empty, the page would render a bare header with no content.

### Gap 5: Cover image error fallback missing (MEDIUM)
Gallery already uses getFallbackUrl onError for broken images. The original plan didn't specify this pattern for ProjectsPage cover images, creating inconsistency and potential broken image icons.

### Gap 6: AC-2 didn't specify order preservation (LOW)
getCollectionPhotos should preserve the photoIds array order since curators expect their arranged sequence to be maintained. This was implied but not explicit.

### Gap 7: No console error/warning check in verification (LOW)
Build passing doesn't mean no runtime errors. The verification section lacked a check for console cleanliness.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| M1 | Defensive helper functions for invalid photo references | AC-2, Task 1 action | Added null-return for getCollectionCoverPhoto, filter+warn for getCollectionPhotos, explicit avoid-throw guidance |
| M2 | Accessibility for project cards | New AC-5, Task 2 action, Task 2 CSS, Checkpoint, Verification | Added semantic HTML (article + heading), keyboard focusability, focus-visible styles, getAltText for covers, getFallbackUrl onError |
| M3 | Cover image error fallback | Task 2 action, Verification | Added getFallbackUrl onError handler requirement, matching Gallery pattern |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| S1 | Don't create dead links to non-existent detail page | Task 2 action, App.jsx, Boundaries, Scope Limits | Cards are no longer links; removed placeholder :projectId route; added explicit avoid guidance |
| S2 | Empty state for zero collections | AC-3, Task 2 action | Added empty state requirement with styled message |
| S3 | Explicit order preservation in AC-2 | AC-2 | Specified photoIds order preservation in getCollectionPhotos return |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| D1 | SEO metadata for /projects page | Phase 5 scope — SEO handled in Polish & Deploy phase |
| D2 | Collection sorting/filtering on listing page | Only a few collections initially; complexity not justified until collection count grows |
| D3 | Pagination for collections listing | Same as D2 — not needed until many collections exist |

## 5. Audit & Compliance Readiness

**Audit evidence:** The plan produces verifiable artifacts — data model in photos.json (diffable), helper functions with deterministic output, and a visual checkpoint requiring human sign-off. This is adequate for a frontend feature.

**Silent failure prevention:** The defensive helper upgrades (M1) ensure invalid data references produce graceful degradation rather than crashes. Console.warn for missing IDs provides observability without breaking the UI.

**Accessibility compliance:** The addition of AC-5 brings the plan in line with WCAG 2.1 Level AA expectations for semantic structure, keyboard operability, and alternative text. Consistent with the accessibility standards already established in ContactForm.

**Ownership:** Clear boundaries and scope limits establish accountability — this plan owns the data model and listing page, nothing else.

## 6. Final Release Bar

**What must be true before this ships:**
- All 3 must-have upgrades implemented (defensive helpers, accessibility, image fallbacks)
- All 3 strongly-recommended upgrades implemented (no dead links, empty state, order preservation)
- Visual checkpoint passed by human reviewer
- Zero console errors on /projects page

**Risks remaining if shipped as-is (after upgrades):**
- Cards are not yet clickable (by design — detail page in 03-02). Users may expect to click into a project. This is acceptable as a staging state, but 03-02 should follow promptly.
- Only sample collections exist with the 6 existing photos. Real content will come later.

**Sign-off:** With the applied upgrades, I would sign my name to this plan for production execution.

---

**Summary:** Applied 3 must-have + 3 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

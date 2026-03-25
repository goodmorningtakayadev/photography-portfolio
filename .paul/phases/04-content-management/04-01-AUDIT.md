# Enterprise Plan Audit Report

**Plan:** .paul/phases/04-content-management/04-01-PLAN.md
**Audited:** 2026-03-23
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan's architecture is sound — a CLI tool for a file-based portfolio is the right call, and the draft/publish model is appropriately minimal. However, the original plan had three release-blocking gaps: no protection against data corruption during JSON writes, no filename collision handling, and an unpublished-photo leak in Home.jsx category thumbnails. All three have been remediated. With the applied upgrades, I would approve this for production.

## 2. What Is Solid

- **Architecture choice:** CLI over headless CMS for a filesystem-based personal portfolio. No new services, no new dependencies, no architectural pivots required. Correct decision.
- **Backwards-compatible published field:** `published !== false` means existing data works without migration. This is the right default-true pattern.
- **Boundary protection:** Comprehensive DO NOT CHANGE list covering all stable components. optimize-images.js is correctly called rather than modified.
- **Single file for data model:** Keeping photos, categories, and collections in one JSON file is appropriate at this scale. No premature database introduction.
- **Checkpoint placement:** Human verification after CLI + filtering implementation covers the full workflow end-to-end.
- **No new runtime dependencies:** CLI uses Node built-ins + already-installed sharp. Clean.

## 3. Enterprise Gaps Identified

### 3.1 JSON Write Corruption Risk (Must-Have — FIXED)
**Original gap:** Plan specified writing to photos.json without atomic write pattern. A crash, power failure, or disk error mid-write would corrupt the single source of truth with no recovery path.
**Risk:** Complete data loss of all photo metadata, categories, and collections.

### 3.2 Filename Collision (Must-Have — FIXED)
**Original gap:** "Copy file to public/photos/{sanitized-filename}.jpg" with no collision check. Adding a photo with the same filename as an existing one would silently overwrite the original.
**Risk:** Permanent loss of a source photo file with no warning.

### 3.3 Draft Photo Leak in Home.jsx Category Thumbnails (Must-Have — FIXED)
**Original gap:** Plan specified filtering for "featured photos and hero image" on Home.jsx but missed the category card thumbnail lookup (`photoData.photos.find(p => p.category === cat.id)` at line ~117). An unpublished photo could appear as a category representative image.
**Risk:** Breaks the publish/draft contract — user marks a photo as draft but it still appears on the home page.

### 3.4 Filename Sanitization Unspecified (Strongly Recommended — FIXED)
**Original gap:** Plan mentioned "sanitized-filename" without defining sanitization rules. Without explicit rules, path traversal (`../`) or special characters could cause file system issues.
**Risk:** Potential for malformed file paths; low severity but easily prevented.

### 3.5 Error Handling Unspecified (Strongly Recommended — FIXED)
**Original gap:** No acceptance criterion for error scenarios. What happens when optimization fails? When a file doesn't exist? The plan had validation rules but no testable error behavior specification.
**Risk:** Undefined behavior on failure; user doesn't know what went wrong or how to recover.

### 3.6 Rollback on Partial Failure (Strongly Recommended — FIXED)
**Original gap:** The add-photo workflow is multi-step (copy → JSON update → optimize). A failure at step 3 leaves orphaned data at steps 1-2. No cleanup was specified.
**Risk:** Inconsistent state — photos.json references a photo whose optimized variants don't exist.

### 3.7 Automated Testing (Can Safely Defer)
**Gap:** All verification is manual. No unit tests for the CLI tool.
**Rationale for deferral:** Personal portfolio with single operator. CLI is a dev tool, not user-facing. Manual verification via checkpoint is sufficient at this scale.

### 3.8 Collection Visibility with All-Unpublished Photos (Can Safely Defer)
**Gap:** If all photos in a collection are unpublished, the collection still appears in the Projects view with 0 photos. Not a broken state, but potentially confusing.
**Rationale for deferral:** Edge case requiring explicit user action to trigger. The Projects view already handles empty collections ("No collections yet"). A collection with 0 visible photos is a minor UX quirk, not a data integrity issue.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | JSON write corruption risk | Task 1 `<action>` | Added temp file + rename atomic write pattern for all JSON mutations; added safety pattern specification |
| 2 | Filename collision | Task 1 `<action>` | Added collision detection with numeric suffix resolution |
| 3 | Draft photo leak in category thumbnails | Task 2 `<action>` | Added explicit filter for Home.jsx category card thumbnail lookup |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Filename sanitization | Task 1 `<action>` | Added explicit sanitization rules (lowercase, strip traversal, allow only [a-z0-9\-\.]) |
| 2 | Error handling AC | `<acceptance_criteria>` | Added AC-5 with three Given/When/Then scenarios for error cases |
| 3 | Rollback on partial failure | Task 1 `<action>` | Added cleanup steps on optimization failure (remove file, revert JSON) |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Automated tests for CLI | Personal portfolio, single operator, manual checkpoint sufficient |
| 2 | Collection visibility with all-unpublished photos | Edge case, not data integrity issue, Projects view handles empty gracefully |

## 5. Audit & Compliance Readiness

**Defensible audit evidence:** The plan now produces clear verification checkpoints including error scenario testing. The human-verify checkpoint covers end-to-end workflow including the new error cases.

**Silent failure prevention:** AC-5 ensures all error paths produce visible error messages. The atomic JSON write pattern ensures no silent data corruption.

**Post-incident reconstruction:** The temp file pattern means photos.json is either fully updated or fully unchanged — no partial states to diagnose.

**Ownership and accountability:** Single-file data model with CLI tool means clear ownership. All mutations go through one script. No distributed state.

## 6. Final Release Bar

**Must be true before shipping:**
- All three must-have fixes are implemented (atomic writes, collision handling, category thumbnail filtering)
- AC-5 error scenarios pass (invalid input doesn't corrupt data, partial failure rolls back)
- Human verification checkpoint validates full end-to-end workflow

**Remaining risks if shipped as-is (post-upgrade):**
- No automated test coverage for CLI tool (deferred — acceptable for personal portfolio)
- Empty collection edge case visible but not broken (deferred — cosmetic)

**Sign-off:** With the applied upgrades, I would sign my name to this plan. The data integrity protections are now appropriate, error handling is specified, and the architecture is sound for the project's scale.

---

**Summary:** Applied 3 must-have + 3 strongly-recommended upgrades. Deferred 2 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

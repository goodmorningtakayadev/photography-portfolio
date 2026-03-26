# Enterprise Plan Audit Report

**Plan:** .paul/phases/05-admin-interface/05-03-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable** — after applying the findings below.

The plan's scope is well-defined and the task structure is solid. However, it contained two data-loss risks (non-atomic reorder and bulk categorize using a driver that doesn't support `db.transaction()`), an unspecified data source for the photo picker, and several input validation gaps. All have been addressed in the applied upgrades.

Would I sign off on this for production after upgrades? Yes. The remaining deferred items are ergonomic, not safety-critical.

## 2. What Is Solid

- **Schema alignment.** The plan correctly uses `projects`, `projectPhotos` tables as defined in schema.ts. No schema modifications needed.
- **Cascade semantics.** Delete project → ON DELETE CASCADE cleans up project_photos. Remove photo from project → only join row deleted, photo preserved. Cover photo removal → SET NULL. All correct per CLAUDE.md.
- **Consistent API patterns.** Following established patterns from photo and category APIs: `{ data, error }` shape, Zod validation, getSession() auth, force-dynamic, 409 on unique conflicts.
- **Design continuity.** Explicit adherence to Dark Cinematic Brutalism system established in 05-01. CSS variables, font families, transition patterns all specified.
- **Boundary protection.** Comprehensive DO NOT CHANGE list covers all completed subsystems. Schema locked. Public pages untouched.
- **Checkpoint placement.** Single human-verify after both auto tasks — appropriate for this scope. Not excessive.
- **Bulk archive cascades.** Correctly clears cover_photo_id on projects referencing archived photos.

## 3. Enterprise Gaps Identified

### Gap 1: PUT reorder uses non-atomic delete-all + re-insert
The neon-http driver does NOT support interactive `db.transaction()` (established Phase 2, documented in 02-01-PLAN.md and 02-01-SUMMARY.md). The planned "delete all project_photos, re-insert with new order" pattern would execute as two separate HTTP requests. If the connection fails between delete and insert, the project loses ALL its photos with no recovery path. This is a data-loss risk.

### Gap 2: Photo picker data source unspecified
The ProjectEditor client component needs to display available photos for the "Add Photos" modal. The plan describes the picker UI but never specifies where the photo list comes from. Client components cannot call server-only query functions directly. Without a data source, the picker cannot be implemented.

### Gap 3: Bulk categorize not atomic
Per CLAUDE.md: "Bulk operations should batch their database writes in a single transaction." The plan says "batch the operations" but doesn't specify the mechanism. With neon-http, `db.transaction()` is unavailable. Without atomicity, a partial failure during bulk categorize could leave some photos with old categories and others with new ones — an inconsistent state.

### Gap 4: coverPhotoId not validated against project membership
PATCH project accepts any UUID as coverPhotoId. An admin could (via API) set a cover photo that isn't in the project. While unlikely via the UI, the API should enforce invariants independently of the UI.

### Gap 5: Bulk categorize semantics ambiguous
The action says "delete existing, then insert new" (REPLACE). The acceptance criteria says "assigned the chosen categories" (ambiguous — could mean ADD). The UI label "Categorize" is also ambiguous. This mismatch could lead to the implementer choosing ADD semantics when REPLACE was intended, or confusing users.

### Gap 6: POST add-photos doesn't validate photoIds
If the client sends invalid or non-existent photoIds, the INSERT will hit a foreign key constraint violation and return a generic 500 error. Validating upfront provides a clear 400 with details.

### Gap 7: Empty reorder array deletes all photos
PUT reorder with `photoIds: []` would delete all project_photos without inserting any. This is likely never intentional and should be rejected.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | PUT reorder non-atomic (Gap 1) | Task 1 action, item 3 (PUT) | Specified `db.batch()` for atomic delete+re-insert. Added CRITICAL note about neon-http not supporting `db.transaction()`. |
| 2 | Photo picker data source missing (Gap 2) | Task 1 action, items 8 and 10 | Server page fetches ready photos via query and passes as `availablePhotos` prop. Picker filters out already-added photos client-side. |
| 3 | Bulk categorize not atomic (Gap 3) | Task 2 action, categorize section | Specified `db.batch([...deletes, ...inserts])` for atomic execution. Referenced CLAUDE.md transaction requirement. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | coverPhotoId not validated (Gap 4) | Task 1 action, item 2 (PATCH) | Added validation: verify photo exists in project_photos before accepting as cover. Return 400 if not. |
| 2 | Bulk categorize semantics ambiguous (Gap 5) | AC-3, Task 2 action + UI | Changed label to "Set Categories", clarified REPLACE semantics in AC-3 ("REPLACED with the chosen set, not appended"). |
| 3 | photoIds not validated in add-photos (Gap 6) | Task 1 action, item 3 (POST) | Added: validate all photoIds reference existing photos with status "ready" before inserting. Return 400 for invalid IDs. |
| 4 | Empty reorder array (Gap 7) | Task 1 action, item 3 (PUT) | Added: reject empty photoIds array with 400. |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Project sort_order management on list page | Already noted in scope limits. Projects reorder is low-frequency for a single-admin system. Can add up/down arrows later. |
| 2 | Pagination for photo picker | Single-admin system with manageable photo count. Loading all ready photos is acceptable. If library grows to thousands, add pagination then. |
| 3 | Undo for bulk operations | Nice-to-have. Single admin can re-categorize or restore archived photos. No data loss from bulk archive (soft delete). |

## 5. Audit & Compliance Readiness

**Defensible audit evidence:**
- All mutations require authenticated session (getSession())
- Zod validates all inputs at API boundary
- Destructive operations (delete project) require explicit confirmation body
- Bulk operations are labeled clearly (replace semantics documented)

**Silent failure prevention:**
- `db.batch()` provides atomicity — partial failures roll back
- PhotoId validation catches invalid references before FK violations
- Empty reorder guard prevents accidental data loss
- Cover photo validation prevents orphaned references

**Post-incident reconstruction:**
- All API errors logged to console with endpoint context
- `{ data, error }` response shape provides client-visible error details
- No audit trail gaps for this scope (admin actions are visible in database state)

**Ownership and accountability:**
- Single-admin system — all actions are attributable to the admin
- No authorization escalation risks (only one role)

## 6. Final Release Bar

**What must be true before shipping:**
- `db.batch()` is verified working with the project's neon-http driver (test with actual delete+insert batch)
- All input validations applied (coverPhotoId membership, photoIds existence, empty reorder guard)
- Bulk categorize clearly labeled as REPLACE operation in UI
- Photo picker receives data from server props (not an unimplemented API call)

**Remaining risks if shipped as-is (post-upgrades):**
- No undo for bulk operations (acceptable — archive is reversible, categorize can be re-done)
- No pagination on photo picker (acceptable for current scale)
- Project list sort_order not manageable via UI (acceptable — low-frequency operation)

**Sign-off:** With the applied upgrades, this plan meets enterprise standards for a single-admin CMS. The `db.batch()` requirement is the most critical upgrade — it prevents the only data-loss scenario in the plan.

---

**Summary:** Applied 3 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

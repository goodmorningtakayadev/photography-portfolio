# Enterprise Plan Audit Report

**Plan:** .paul/phases/05-admin-interface/05-02-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan is well-structured with clear task decomposition, proper acceptance criteria, and explicit boundaries. After applying 2 must-have and 4 strongly-recommended upgrades, this plan is ready for production execution.

The plan correctly consumes the existing upload pipeline without modification and keeps category management appropriately simple (flat labels, no metadata creep). The decision to use native browser APIs over libraries is sound for this scope.

Would I sign off on this plan? **Yes, with the applied upgrades.** The original plan had blind spots around upload resilience (no timeout, no navigation guard, vague error messaging) and input validation edge cases that could lead to runtime errors. These are now addressed.

## 2. What Is Solid

- **Boundary discipline.** The plan explicitly protects 9 existing files and correctly identifies scope limits. The "DO NOT CHANGE" list matches exactly the files that were verified working in Phases 3-5.
- **Upload pipeline consumption.** The client correctly uses the existing presign → upload → confirm → process flow without modifying any backend routes. The presign route already validates Content-Type in the signature (signableHeaders), and confirm already validates via headObject + idempotency guard.
- **Category schema respect.** The plan correctly avoids adding metadata to categories (CLAUDE.md constraint). The up/down reorder approach is proportionate for a small set (<15 items).
- **Concurrent upload throttling (max 3).** Prevents overwhelming the serverless processing pipeline while still allowing parallel uploads.
- **Existing GET /api/photos/[id] returns status + variants.** The `getPhotoById` query already returns `PhotoWithCategories` with full variant data and status field. Polling this endpoint for upload status is architecturally correct.
- **Dark Cinematic Brutalism consistency.** The plan references specific CSS variables and type patterns from 05-01, ensuring visual coherence.

## 3. Enterprise Gaps Identified

### Gap 1: No navigation guard during active uploads (MUST-HAVE)
Navigating away mid-upload creates two problems: (a) presigned-but-unconfirmed files become orphaned in R2 with no DB record, (b) photos in "processing" state get stuck (though the process route does transition to "failed" on error). A single-admin system has no background process to clean these up. The `beforeunload` event is the standard browser mechanism for this.

### Gap 2: Generic error messages on upload failure (MUST-HAVE)
The plan specified retry for failed uploads but the UploadItem type's `error?: string` field was never populated with stage-specific information. When a 50MB upload fails at the R2 PUT stage vs. the presign stage, the admin needs to know which failed. "Upload failed" is not actionable; "Upload to R2 failed: 403 Forbidden" is.

### Gap 3: No CDN URL construction specification (STRONGLY RECOMMENDED)
The UploadItem type had `thumbUrl?: string` but the plan never specified how this value is derived. The existing GET /api/photos/[id] returns variant storage keys, but the simpler approach is constructing the URL client-side from the known pattern (`NEXT_PUBLIC_CDN_URL/photos/${photoId}/thumb_200.webp`). Without explicit specification, the implementer might add unnecessary complexity or fail to display thumbnails.

### Gap 4: Missing category name input constraints (STRONGLY RECOMMENDED)
The POST endpoint specified Zod validation but no min/max length or whitespace handling. The schema allows varchar(100) but the Zod schema would accept a 1000-char name, causing a database error at insert time. Whitespace-only names like "   " would produce empty slugs.

### Gap 5: Slugify produces empty string on edge input (STRONGLY RECOMMENDED)
Input like "!!!" or purely-emoji names would slugify to "" (empty string after stripping non-alphanumeric). An empty slug violates the NOT NULL + UNIQUE constraint and could cause a confusing Postgres error. The slugify function needs an explicit empty-result check.

### Gap 6: No XHR upload timeout (STRONGLY RECOMMENDED)
MAX_UPLOAD_SIZE is 50MB. On a 2Mbps connection, a 50MB upload takes ~3.5 minutes. Without an explicit XHR timeout, the upload hangs indefinitely if the connection stalls. The default XHR timeout is 0 (infinite).

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | No beforeunload warning during active uploads | AC-2 (new criterion), Task 1 action (new section 8), Verification | Added beforeunload event listener requirement while files are in active states. Removes on terminal states or unmount. |
| 2 | Per-stage error messages missing | AC-2 (new criterion), Task 1 action (section 4, new error handling sub-section), Verification | Each pipeline stage wrapped in try-catch with stage-specific error messages. Error string indicates which stage and what HTTP status/error. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 3 | CDN URL construction unspecified | Task 1 action (section 4, poll stage) | Explicit instruction: construct `thumbUrl` from `NEXT_PUBLIC_CDN_URL + /photos/${photoId}/thumb_200.webp` on "ready" status. References CLAUDE.md pattern. |
| 4 | Category name validation gaps | Task 2 action (POST description) | Added: trim whitespace, min 1 char, max 100 chars matching schema varchar(100). |
| 5 | Slugify empty-result crash | Task 2 action (slugify helper) | Added: empty result check → 400 "Name must contain at least one alphanumeric character". Truncate to 100 chars. |
| 6 | No XHR upload timeout | Task 1 action (section 4, Upload to R2 stage) | Added: `xhr.timeout = 300000` (5 min). On timeout, abort and set failed with "Upload timed out". |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | R2 CORS configuration documentation | Infrastructure concern, not application code. Presigned URL flow was built and tested in Phase 4 — CORS is presumably configured. If not, the XHR PUT will fail with a clear CORS error that's immediately diagnosable. |
| 2 | Atomic category reorder (transaction) | Individual PATCH calls for reorder could leave inconsistent sort_order on partial failure. Acceptable for <15 categories in a single-admin system — admin can retry. A bulk reorder endpoint is warranted at scale but not here. |
| 3 | R2 orphan file cleanup lifecycle rule | Presigned-but-never-confirmed files accumulate in R2. A bucket lifecycle rule (auto-delete objects older than 24h without a DB record) would clean these up. This is infrastructure config for Phase 7 (deploy). |

## 5. Audit & Compliance Readiness

**Audit evidence:** The plan produces clear audit trails through existing patterns — API routes log errors to console, DB records track status transitions with timestamps, and the `{ data, error }` response shape provides consistent error reporting.

**Silent failure prevention:** The applied beforeunload guard and per-stage error messages close the two main silent failure paths. Before: upload could fail with a generic message and the admin wouldn't know why. After: each stage reports its specific failure.

**Post-incident reconstruction:** Photo status lifecycle (processing → ready/failed) with timestamps enables reconstructing what happened. The upload queue's stage-specific errors aid debugging. Console.error calls in existing API routes capture server-side context.

**Ownership and accountability:** Single-admin system with auth on all endpoints. No shared state concerns. All category mutations and uploads are attributable to the sole admin.

## 6. Final Release Bar

**Must be true before this plan ships:**
- All 6 applied findings are implemented (2 must-have + 4 strongly-recommended)
- Upload pipeline completes end-to-end: presign → R2 PUT → confirm → process → ready
- Category CRUD handles all edge cases: empty names, duplicate slugs, empty slug results
- beforeunload fires during active uploads, does not fire after completion

**Risks remaining if shipped as-is (after upgrades):**
- R2 CORS misconfiguration would block all uploads (immediately visible, not silent)
- Category reorder is non-atomic (low risk: small set, single admin, retry-safe)
- Orphaned R2 files from abandoned uploads accumulate slowly (infrastructure cleanup, Phase 7)

**Sign-off:** I would approve this plan for production with the applied upgrades. The remaining deferred items are infrastructure concerns, not application logic gaps.

---

**Summary:** Applied 2 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

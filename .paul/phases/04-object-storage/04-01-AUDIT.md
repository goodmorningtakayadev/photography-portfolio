# Enterprise Plan Audit Report

**Plan:** .paul/phases/04-object-storage/04-01-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan's architecture is sound — presigned PUT flow, lazy R2 client, inline API auth via getSession(), and the decision to keep middleware focused on browser routes are all correct choices. However, three release-blocking gaps existed: the confirm endpoint was not idempotent (duplicate POSTs crash with 500), Content-Type wasn't included in the presigned URL signature (allowing upload of arbitrary file types past validation), and the client-supplied photoId could be tampered to mismatch the storageKey. All three have been addressed.

Would I approve this for production after applying fixes? Yes, with the understanding that the deferred items (sort_order atomicity, orphan cleanup) are acceptable trade-offs for a single-admin system.

## 2. What Is Solid

- **Lazy R2 client initialization.** Not instantiating at module level prevents cascading env validation failures in unrelated imports. This is a lesson the project already learned with env.ts coupling in Phase 3 — good to see it applied proactively.
- **Inline API auth via getSession() instead of middleware expansion.** API routes need 401 JSON, not redirects. Keeping middleware focused on browser /admin/* routes and using a helper for API auth is the architecturally correct split.
- **process.env for JWT_SECRET in session.ts.** Continuing the Phase 3 pattern of decoupling auth from env.ts eager validation. Consistent and correct.
- **Storage keys, not URLs.** Following CLAUDE.md's architecture principle of storing keys and resolving CDN URLs at render time. The plan correctly avoids leaking CDN URLs into the database.
- **UUID generated server-side at presign time.** Client cannot choose its own photo ID, preventing ID enumeration or collision attacks.
- **Boundaries section.** Explicit protection of schema, migrations, auth, middleware, and public pages. Scope limits are well-defined with clear rationale.

## 3. Enterprise Gaps Identified

### 3.1 — Content-Type signature bypass (CRITICAL)
The plan specified `ContentType` on the PutObjectCommand but did NOT include `signableHeaders: new Set(["content-type"])` in the getSignedUrl call. Research confirms @aws-sdk/s3-request-presigner does NOT sign Content-Type by default. Without this, a client could upload `application/x-executable` using a presigned URL that was validated for `image/jpeg`. The AC-2 content type validation would pass at presign time but be meaningless at upload time.

### 3.2 — Confirm endpoint not idempotent
The confirm endpoint does a bare INSERT with an explicit photoId primary key. A second POST with the same storageKey would hit a PK unique constraint violation, caught by the generic try/catch, and surface as a 500 "Failed to confirm upload". This is a data integrity and UX issue — network retries, double-clicks, or client bugs would produce 500s in production logs.

### 3.3 — Client-supplied photoId trust
The confirm endpoint accepted `{ storageKey, photoId }` from the client. A bug or tampered request could provide `photoId: "aaa..."` with `storageKey: "photos/bbb.../original.jpg"`, creating a photo record whose ID doesn't match its storage location. Every downstream operation that constructs a storage path from the photo ID would break silently.

### 3.4 — MAX_UPLOAD_SIZE defined but never enforced
constants.ts defines MAX_UPLOAD_SIZE but the presign endpoint can't enforce it (presigned PUT URLs don't support Content-Length conditions — confirmed by research). The confirm endpoint didn't check file size either. A 2GB RAW file would be accepted without complaint.

### 3.5 — headObject returns boolean only
headObject returning just `boolean` discards the Content-Length metadata from the HEAD response, which is needed for size validation in the confirm endpoint. The response shape needed to be extended.

### 3.6 — Storage key regex underspecified
The plan said "matches pattern `photos/<uuid>/original.<ext>`" without specifying the exact regex. A loose regex like `/^photos\/.+\/original\..+$/` could match `photos/../../../etc/passwd/original.anything`, enabling path traversal in storage key construction.

### 3.7 — Error responses all generic 500
The confirm endpoint lumped all errors into a single 500 catch-all. File not found, file too large, duplicate confirm, storage service error, and DB write failure all returned the same message. This makes debugging impossible and masks distinct failure modes from the client.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Content-Type not included in presigned URL signature | Task 1 action (createPresignedUploadUrl) | Added `signableHeaders: new Set(["content-type"])` requirement with explanation of why it's critical |
| 2 | Confirm endpoint not idempotent — duplicate POST returns 500 | AC (new AC-6), Task 2 action, Task 2 verify, Verification | Added existence check before INSERT; return 409 "Upload already confirmed" on duplicate |
| 3 | Client-supplied photoId can mismatch storageKey | AC-3 (rewritten), Task 2 action, Task 1 action (new extractPhotoIdFromKey) | Removed photoId from confirm request body; derive from storageKey via strict regex extraction |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 4 | MAX_UPLOAD_SIZE never enforced | AC (new AC-7), Task 2 action (confirm), Verification | Confirm endpoint checks HEAD Content-Length against MAX_UPLOAD_SIZE; returns 400 if exceeded |
| 5 | Storage key regex underspecified | Task 1 action (new extractPhotoIdFromKey) | Added strict regex: `^photos/[0-9a-f]{8}-...-[0-9a-f]{12}/original\.(jpg|jpeg|png|webp|avif|tiff)$` |
| 6 | All errors generic 500 | Task 2 action (confirm) | Added explicit status code mapping: 400 (validation), 401 (auth), 409 (duplicate), 500 (internal) |
| 7 | headObject returns boolean only, discards Content-Length | Task 1 action (headObject) | Changed return type to `{ exists: boolean, contentLength?: number }` |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 8 | gallery_sort_order race condition (MAX+1 not atomic) | Single-admin system with extremely low concurrent upload probability. Phase 5 bulk upload will address ordering properly. No data corruption — worst case is two photos with same sort_order, which is cosmetic. |
| 9 | Orphaned uploads (presigned but never confirmed) | Files in R2 cost storage but cause no functional issues. Addressable with R2 object lifecycle rules or a scheduled cleanup job. Not blocking for initial upload flow. |
| 10 | Presigned POST for server-enforced size limits | Presigned PUT can't enforce Content-Length in signature. Presigned POST can but is more complex client-side. Since confirm endpoint now validates size via HEAD, server-side enforcement exists. Client-side presigned POST is a defense-in-depth improvement, not a necessity. |

## 5. Audit & Compliance Readiness

**Audit evidence:** The plan produces a clear chain: presign (UUID generated server-side) → upload (presigned URL with signed Content-Type) → confirm (existence verified, size validated, record created). Each step has testable acceptance criteria. The `{ data, error }` response shape provides structured logging.

**Silent failure prevention:** The three must-have fixes were specifically about preventing silent failures — a 500 on duplicate confirm would pollute error logs with no actionable information; a Content-Type bypass would allow malicious uploads that only surface when the processing pipeline (04-02) fails on non-image content; a mismatched photoId/storageKey would silently corrupt the storage key → ID relationship.

**Post-incident reconstruction:** API routes log errors to console. Photo records have `createdAt` timestamps. Storage keys are deterministic from photo IDs. An incident responder can trace: photo ID → storage key → R2 object → presign timestamp. Consider adding structured logging in Phase 7 (polish) for production observability.

**Ownership:** Single-admin system — all uploads are implicitly by the admin. No user_id columns needed (consistent with CLAUDE.md constraints). Auth is verified per-request via getSession().

## 6. Final Release Bar

**What must be true before this plan ships:**
- Content-Type is signed in presigned URLs (clients cannot bypass type validation)
- Duplicate confirm returns 409, not 500 (idempotent API surface)
- photoId is derived from storageKey, not client-supplied (data integrity)
- File size is validated at confirm time (resource abuse prevention)
- Storage key regex is strict with explicit UUID format and allowed extensions (path traversal prevention)

**Remaining risks if shipped with applied fixes:**
- Sort order race condition (cosmetic, single-admin, deferred)
- Orphaned R2 objects from unused presigned URLs (storage cost, deferred)
- No structured logging beyond console.error (acceptable for v1, Phase 7 item)

**Sign-off:** With the 3 must-have and 4 strongly-recommended upgrades applied, I would sign my name to this plan. The architecture is clean, the security surface is well-bounded, and the deferred items are genuine trade-offs appropriate for a single-admin system.

---

**Summary:** Applied 3 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

# Enterprise Plan Audit Report

**Plan:** .paul/phases/04-object-storage/04-02-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan's architecture is clean: Sharp pipeline with parallel metadata extraction, fire-and-forget async trigger, clear success/failure status transitions, and proper auth on the process endpoint. One release-blocking gap: `blurhash.encode()` expects `Uint8ClampedArray` but the plan passes raw Buffer, which will cause a TypeScript compilation error. Two strongly-recommended items address EXIF parsing correctness: the non-standard EXIF date format with colons, and the need to sanitize exif-reader output before JSONB storage.

The deferred items (waitUntil for reliability, memory optimization, partial variant cleanup) are all genuine trade-offs acceptable for a single-admin system with low upload volume.

Would I sign my name to this after fixes? Yes. The pipeline is straightforward, the failure path is well-specified, and the boundaries correctly protect existing code.

## 2. What Is Solid

- **Parallel processing in processPhoto().** Calling generateVariants(), extractMetadata(), and computeBlurhash() concurrently is the correct architecture. These are independent operations on the same input buffer.
- **Status lifecycle with mandatory failure handling.** The plan explicitly requires "status update to 'failed' MUST be in a finally or catch — never leave a photo in 'processing' after an error." This is the single most important requirement for the processing pipeline.
- **Guard against re-processing.** Process endpoint checks `status === "processing"` before proceeding. Prevents double-processing of already-completed photos.
- **maxDuration: 60 on the process endpoint.** Correct for Vercel — Sharp processing of 3 variants from a 50MB original will take 5-15 seconds, well within 60s but too long for the default 10s.
- **withoutEnlargement: true.** Prevents upscaling small originals, which would create larger files with no quality benefit.
- **Fire-and-forget with cookie forwarding.** The confirm endpoint forwards the session cookie so the process endpoint can authenticate. This is a subtle requirement that was correctly identified.
- **Boundaries.** Correctly protects schema, session.ts, constants.ts, and all existing routes. No scope creep into admin UI or CDN resolution.

## 3. Enterprise Gaps Identified

### 3.1 — Blurhash type mismatch (CRITICAL)
`blurhash.encode()` has TypeScript signature: `encode(pixels: Uint8ClampedArray, width: number, height: number, xComponents: number, yComponents: number): string`. Sharp's `.raw().toBuffer()` returns a Node.js `Buffer` (Uint8Array subclass), not `Uint8ClampedArray`. TypeScript will reject this — the plan would fail at `tsc --noEmit`.

### 3.2 — EXIF DateTimeOriginal format
The `exif-reader` package returns DateTimeOriginal as a string in EXIF format: `"2025:03:25 14:30:45"` — note colons in the date part, not dashes. A naive `new Date(dateString)` will produce `Invalid Date` on most engines because `"2025:03:25"` is not a recognized date format. The plan says "convert to Date for takenAt" but doesn't specify how to handle this EXIF-specific date format.

### 3.3 — EXIF data serialization for JSONB
`exif-reader` output is a nested object that may contain Buffer instances (e.g., EXIF thumbnail data, MakerNote binary blobs) and Date objects. PostgreSQL's JSONB column (`exif_data`) requires JSON-serializable values. Inserting a Buffer via Drizzle ORM will either throw or produce garbage data. The plan says "strip Buffer values" but doesn't specify the mechanism.

### 3.4 — GetObjectCommand Body guard
`GetObjectCommand` response may have an undefined `Body` if the object is empty or there's an S3 error that returns 200 with no body. The plan specifies "converts response Body stream to Buffer" but doesn't guard against this edge case.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | blurhash.encode() expects Uint8ClampedArray, not Buffer | Task 1 action (computeBlurhash) | Added explicit `new Uint8ClampedArray(data)` conversion before encode call |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 2 | EXIF DateTimeOriginal uses non-standard "YYYY:MM:DD" format | Task 1 action (extractMetadata) | Added specific parsing pattern: replace first two colons, then new Date() |
| 3 | exif-reader output may contain non-JSON-serializable values | Task 1 action (extractMetadata) | Added JSONB sanitization requirement: strip Buffers, convert Dates |
| 4 | GetObjectCommand Body may be undefined | Task 1 action (downloadObject) | Added guard: throw if response.Body is undefined; added explicit stream-to-buffer pattern |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 5 | Fire-and-forget fetch may not complete before Lambda freezes | On Vercel, Node.js Lambdas drain the event loop before freezing. The fetch() call initiates the HTTP request synchronously. For single-admin with low upload volume, the risk of dropped triggers is negligible. Phase 5 admin UI will show processing status, making manual re-triggers easy. |
| 6 | Large original (50MB) + 3 variants in memory simultaneously | At peak: ~200MB for a 50MB original with 3 variant buffers. Vercel default memory is 1024MB. Single-admin means no concurrent processing. Well within limits. |
| 7 | Partial variant upload on failure leaves orphan objects in R2 | If variant 2 fails after variant 1 succeeds, variant 1 sits in R2. No data corruption — just storage cost. Cleanup can be added when permanent delete is implemented (Phase 5). |

## 5. Audit & Compliance Readiness

**Audit evidence:** Processing results are persisted in two tables: `photos` (metadata, status) and `photo_variants` (variant records with dimensions and file sizes). Status transitions are deterministic: "processing" → "ready" or "processing" → "failed". The process endpoint logs errors before setting failure status.

**Silent failure prevention:** The must-have finding (Uint8ClampedArray) would cause a runtime crash, not a silent failure — TypeScript catches it at compile time. The EXIF date parsing issue (strongly-recommended) would result in `null` takenAt rather than a crash, since the plan already specifies graceful handling of missing EXIF. The JSONB serialization issue could cause a silent DB write failure, caught by the process endpoint's catch block and surfaced as status "failed".

**Post-incident reconstruction:** Photo record has `status`, `updatedAt`, and `createdAt`. Variant records have `createdAt`. Error details are logged to console. An incident responder can trace: photo ID → status timeline → variant existence → R2 objects.

**Ownership:** Single-admin system — all processing is triggered by admin uploads. Auth is verified on the process endpoint.

## 6. Final Release Bar

**What must be true before this plan ships:**
- Blurhash computation uses Uint8ClampedArray (TypeScript type safety)
- EXIF date parsing handles the "YYYY:MM:DD" format correctly
- EXIF data is sanitized for JSONB before database insertion
- Status transitions to "failed" on any processing error (never stuck in "processing")

**Remaining risks if shipped with applied fixes:**
- Fire-and-forget trigger could theoretically be dropped (Lambda freeze edge case) — mitigated by admin UI status polling in Phase 5
- Large files use significant memory — within Vercel limits for single-admin
- No automatic retry for failed processing — deferred to Phase 5

**Sign-off:** With the 1 must-have and 3 strongly-recommended upgrades applied, I would sign my name to this plan. The processing pipeline is well-structured, failure handling is explicit, and the deferred items are appropriate trade-offs for the system's scale.

---

**Summary:** Applied 1 must-have + 3 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

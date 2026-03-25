# Enterprise Plan Audit Report

**Plan:** .paul/phases/02-database-schema/02-01-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable** — after applying the must-have and strongly-recommended fixes below.

The plan has solid schema design that faithfully follows the CLAUDE.md spec, good separation of concerns, and reasonable task scoping. However, it contained a critical Drizzle ORM driver mismatch that would have caused runtime failures, ambiguous data mapping that would produce inconsistent seed results, and an underspecified idempotency strategy. These are now fixed.

Would I approve this for production if I were accountable? **Yes, after the applied fixes.** The plan correctly isolates database infrastructure from application logic, protects existing files, and produces testable artifacts.

## 2. What Is Solid (Do Not Change)

- **Schema design matches CLAUDE.md exactly** — 6 tables, correct column types, proper FK cascades (CASCADE on joins, SET NULL on cover_photo_id). No invented columns, no scope creep.
- **Two enums (status, variant_type)** properly constrain state space. No stringly-typed status fields.
- **Index selection is correct** — GIN on jsonb (exif_data), B-tree on sort/date columns, composite on project_photos ordering. These match the query patterns defined in the query functions.
- **Env validation with Zod** catches misconfiguration at deploy time. The pattern (server vs client schemas) prevents secret leakage to client bundles.
- **Seed script creates its own connection** — correctly avoids coupling to the app's db client and env validation.
- **Boundaries section** explicitly protects all existing Phase 1 files. No scope creep risk.
- **Query functions are read-only** — correctly defers mutation queries to Phase 5 (admin).

## 3. Enterprise Gaps Identified

### Gap 1: Wrong Drizzle driver import path (CRITICAL)
The plan specified `import drizzle from drizzle-orm/neon-serverless` with `neon()` function call. This is a driver/API mismatch:
- `neon()` from `@neondatabase/serverless` returns an HTTP query function
- `drizzle-orm/neon-serverless` expects a `Pool` instance (WebSocket-based)
- Correct pairing: `neon()` → `drizzle-orm/neon-http`, or `Pool` → `drizzle-orm/neon-serverless`

Would have caused: runtime error on first database query attempt.

### Gap 2: Seed script transaction incompatibility
Plan said "wrap all inserts in a single transaction" but the app db client uses neon-http which doesn't support interactive `db.transaction()`. The seed script's own connection was underspecified.

Would have caused: seed script runtime error or silent data inconsistency.

### Gap 3: Ambiguous title/description mapping
Plan had contradictory mapping: "title → caption (also alt_text as fallback)" AND "description → leave as-is (store in caption if non-empty, otherwise use title)". Both fields mapped to caption with conflicting precedence.

Would have caused: unpredictable seed results — some photos with description as caption, others with title.

### Gap 4: Silent data loss without logging
photos.json has `featured` (used by homepage), `heroImage` (used for hero banner), and `tags` (freeform metadata) — all silently dropped. No warning, no documentation of what's lost.

Would have caused: confusion in Phase 6 when homepage featured photos query has no way to identify which photos were originally featured.

### Gap 5: Ambiguous idempotency strategy
"truncate tables (in correct FK order) before inserting, or use ON CONFLICT DO NOTHING" — these are fundamentally different strategies with different data integrity implications.

Would have caused: implementer choice between destructive reset and stale data accumulation without guidance.

### Gap 6: Migration SQL not inspected
Plan verified only that `drizzle-kit generate` succeeds, not that the output SQL is correct. Drizzle can generate valid SQL that doesn't match intent (e.g., missing an index, wrong cascade direction).

Would have caused: schema deployed without verification of actual constraints.

### Gap 7: Drizzle config pattern outdated
Plan used bare function call `drizzle(neon(...))` instead of the current config object pattern `drizzle({ client: ... })`. Also didn't use `defineConfig()` for drizzle.config.ts.

Would have caused: deprecation warnings or subtle API mismatches.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Wrong Drizzle import: `neon-serverless` with `neon()` | Task 1 action (src/db/index.ts) | Changed to `drizzle-orm/neon-http` with config object pattern `drizzle({ client: sql })`. Added note that neon-http doesn't support interactive transactions. |
| 2 | Seed script needs transaction-capable connection | Task 2 action (scripts/seed.ts) | Added explicit Pool-based connection setup with `drizzle-orm/neon-serverless`, WebSocket config (`ws` package), and pool cleanup (`pool.end()`). Added `ws` and `@types/ws` as dev dependencies. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 3 | Ambiguous title/description field mapping | Task 2 action (field mapping) | Clarified: `title → caption` (always), `description → alt_text` (with title fallback). Deterministic, no ambiguity. |
| 4 | Silent data loss for featured/heroImage/tags | Task 2 action (field mapping) | Added explicit documentation of dropped fields, requirement to log warnings during seed, and note that Phase 6 homepage will use gallery_sort_order + limit instead of featured flag. |
| 5 | Ambiguous idempotency strategy | Task 2 action (seed script) | Made explicit: TRUNCATE CASCADE in reverse dependency order, then insert fresh. No ON CONFLICT ambiguity. |
| 6 | Migration SQL not inspected | Task 1 verify section | Added: inspect generated SQL to confirm all tables, indexes, and ON DELETE clauses match intent. |
| 7 | Outdated Drizzle config patterns | Task 1 action (drizzle.config.ts) | Added `defineConfig()` usage with explicit code example. Added note that `generate` doesn't need dbCredentials. |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Photo dimensions (width/height) not in seed data | Schema columns are nullable. Actual dimensions come from Phase 4 image processing. Seeding null is correct. |
| 2 | japan-sessions collection data quality (1 photo, mismatched tags) | This is source data quality, not a schema/seed issue. Seed faithfully reproduces it. Owner can fix via admin UI in Phase 5. |
| 3 | Eager env validation (`serverSchema.parse()` at module level) | Safe for Phase 2 — no page imports db module at build time. Phase 6 will need to verify this doesn't break static generation. Note added to plan. |

## 5. Audit & Compliance Readiness

**Audit evidence:** The plan produces a SQL migration file that can be version-controlled and reviewed. Schema changes are traceable through `drizzle-kit generate`.

**Silent failure prevention:** Zod env validation catches misconfiguration at startup. Seed script uses transactions — partial insertion cannot occur.

**Post-incident reconstruction:** Migration history in `drizzle/` directory provides full schema evolution. Seed script is deterministic and can be re-run.

**Ownership:** Single admin system — no authorization boundary ambiguity at the database layer. All tables are implicitly owned by the sole admin.

**One area that would fail audit:** There is no migration rollback strategy. If a migration is applied and breaks production, the plan has no documented rollback path. This is acceptable for Phase 2 (initial schema, no production data) but must be addressed before Phase 6 (production data migration). Noted as a future concern, not blocking for this plan.

## 6. Final Release Bar

**What must be true before this plan ships:**
- src/db/index.ts uses `drizzle-orm/neon-http` (not neon-serverless) with config object API
- Seed script uses Pool-based connection with WebSocket support for transactions
- Field mapping is deterministic (title→caption, description→alt_text)
- Seed script logs warnings for dropped data fields
- Generated migration SQL has been manually inspected for correctness
- `pnpm build` passes without importing db module in any existing page

**Risks if shipped as-is (pre-audit):**
- Runtime crash on first DB query (wrong driver import)
- Seed script transaction failure
- Inconsistent data from ambiguous field mapping

**All three risks are now eliminated by the applied fixes.**

I would sign my name to this plan as audited.

---

**Summary:** Applied 2 must-have + 5 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

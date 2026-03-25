# Enterprise Plan Audit Report

**Plan:** .paul/phases/03-authentication/03-01-PLAN.md
**Audited:** 2026-03-25
**Verdict:** Conditionally Acceptable

---

## 1. Executive Verdict

**Conditionally Acceptable.** The plan demonstrates solid architectural judgment — particularly the Edge Runtime-aware split of auth.ts (bcrypt, Node-only) vs session.ts (jose, Edge-compatible), and the explicit avoidance of auth libraries for a single-admin system. However, three release-blocking gaps were identified: missing error handling that would leak internal details or cause unhandled exceptions, an env.ts coupling that would break auth if R2 credentials aren't set, and underspecified middleware failure behavior. All have been remediated.

Would I sign off on this for production? **Yes, after the applied fixes.** The auth model is appropriately simple for the threat model (single admin, no public registration, no sensitive user data beyond the admin's own photos).

## 2. What Is Solid (Do Not Change)

**Edge Runtime isolation (auth.ts vs session.ts):** Correctly identifies that bcryptjs is Node-only and cannot be imported in middleware. The parameter-injection pattern for JWT_SECRET (callers pass the secret rather than the module importing env.ts) is the right design. This prevents two distinct failure modes in one architectural decision.

**Scope discipline:** The plan explicitly excludes rate limiting, refresh tokens, CSRF tokens, and password reset — all appropriate deferrals for a single-admin system. The boundaries section correctly protects all Phase 1-2 artifacts.

**Cookie configuration:** httpOnly, secure-in-production, sameSite lax, 7-day maxAge. Standard and correct for this threat model.

**Server/client component split for login page:** Separating the server component (metadata export, session check) from the client component (form logic) is the correct Next.js pattern. This was already in the original plan.

**Middleware matcher pattern:** `["/admin/:path*"]` is clean and extensible. Future phases can add matchers without restructuring the middleware.

## 3. Enterprise Gaps Identified

### Gap 1: Login route has no error boundary (CRITICAL)
The original plan specified: "Parse JSON body" and "Validate body — return 400 if password missing" but had no try-catch. If the request body is not valid JSON, `request.json()` throws an unhandled exception, producing a generic 500 with a stack trace in development. In production, Next.js returns a generic error page — but the behavior is undefined and uncontrolled.

**Risk:** Unhandled exceptions in auth endpoints are exploitable for information gathering. A malformed request should never produce an unexpected response.

### Gap 2: env.ts coupling breaks auth without R2 credentials (HIGH)
The original plan specified `Import serverEnv from @/lib/env` in the login route. The env.ts module eagerly validates ALL server env vars at import time — including `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`. If any R2 var is unset, the import throws and the login route never loads.

**Confirmed:** env.ts is currently only imported by `src/db/index.ts`. Adding it to the auth route creates a new coupling point. Since R2 is Phase 4 and credentials may not exist yet, this would make auth development impossible without dummy R2 values.

**Risk:** Auth functionality blocked by unrelated infrastructure configuration. Violates single-responsibility principle.

### Gap 3: Middleware behavior undefined when JWT_SECRET is missing (HIGH)
The original plan said "Read process.env.JWT_SECRET directly (with non-null assertion or early return)." This is ambiguous. A non-null assertion (`!`) will cause a runtime crash in the middleware if the var is missing. An "early return" could mean `NextResponse.next()` — which would silently allow unauthenticated access to admin routes.

**Risk:** Misconfigured deployment could either crash the middleware (denial of service) or fail open (unauthorized access). Both are unacceptable.

### Gap 4: Different error responses leak auth state (MEDIUM)
The original plan returned `{ error: "Invalid password" }` for wrong passwords and HTTP 400 for missing body. This allows an attacker to distinguish between "valid request format, wrong password" and "invalid request format" — a minor information leak that can inform attack strategy.

### Gap 5: Already-authenticated users see login form (LOW-MEDIUM)
The original plan had no check for existing valid sessions on the /login page. An already-authenticated admin visiting /login would see the form unnecessarily. In a multi-tab scenario, this causes confusion.

### Gap 6: Stale session cookies accumulate (LOW)
When middleware detects an expired JWT and redirects to /login, the expired cookie persists. On every subsequent request to /admin/*, the middleware re-parses and re-verifies the expired token before redirecting. The cookie should be cleared on first failure.

### Gap 7: API response shape inconsistency (LOW)
CLAUDE.md specifies `{ data, error }` as the consistent API response shape. The original plan used `{ success: true }` / `{ error: "..." }` — a different shape that would need to be reconciled later.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Login route missing error boundary — malformed requests cause unhandled exceptions | Task 2 action, AC-6 added | Added try-catch wrapper, generic error response for all failure modes, AC-6 for malformed body handling |
| 2 | env.ts coupling breaks auth without R2 credentials | Task 2 action | Changed from `import serverEnv from @/lib/env` to `process.env.ADMIN_PASSWORD_HASH!` / `process.env.JWT_SECRET!` direct access. Added env.ts to "Avoid" list |
| 3 | Middleware behavior undefined when JWT_SECRET missing — could fail open | Task 2 action | Added explicit fail-closed behavior: if JWT_SECRET undefined, redirect to /login, do NOT call NextResponse.next() |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | API response shape uses `{ success }` instead of `{ data, error }` per CLAUDE.md | Task 2 action (login + logout routes) | Changed all responses to `{ data: null, error: null }` / `{ data: null, error: "Invalid credentials" }` |
| 2 | Already-authenticated admin sees login form | Task 3 action, AC-7 added | Added session check in server component — if valid session exists, redirect to /admin/dashboard |
| 3 | Stale cookies not cleared on middleware redirect | Task 2 middleware action | Added cookie clearing on verification failure before redirect |
| 4 | Different error messages for different failure modes leak auth state | Task 2 action, verification | All failure modes return identical `{ data: null, error: "Invalid credentials" }` with 401 status. Added security note. |
| 5 | LoginForm.tsx missing from files_modified frontmatter | Frontmatter | Added `src/components/admin/LoginForm.tsx` to files_modified list |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | `returnTo` query param for post-login redirect | No admin pages exist yet (Phase 5). When admin pages exist, the UX benefit of returnTo becomes meaningful. Add to Phase 5 plan. |
| 2 | Rate limiting on login endpoint | Already noted in plan boundaries. Single-admin system with no public registration reduces brute-force attack surface. Address in Phase 7 (deploy/polish) with Vercel/Cloudflare WAF rules. |
| 3 | CSRF token validation | JSON API with SameSite=lax cookies is sufficient for this threat model. Browsers enforce same-origin policy for fetch/XHR with Content-Type: application/json. No form-based POST exists that could be CSRF'd. |

## 5. Audit & Compliance Readiness

**Defensible audit evidence:** The plan produces clear artifacts (API routes, middleware, session helpers) with explicit verification steps. The `{ data, error }` response shape enables consistent API logging.

**Silent failure prevention:** The must-have fixes address the two main silent failure vectors: unhandled exceptions in the login route (now caught and logged), and undefined middleware behavior on missing JWT_SECRET (now fails closed).

**Post-incident reconstruction:** Auth events (login success/failure, middleware redirects) are implicitly logged via Next.js request logs. For a single-admin system, this is sufficient. If audit logging becomes a requirement, it can be added to the login route's catch block.

**Clear ownership:** All auth code is isolated in three locations: `src/lib/auth.ts`, `src/lib/session.ts`, and `src/middleware.ts`. The separation of concerns is clean and auditable.

**One concern:** The plan does not specify structured logging (e.g., JSON log format with event type). Server-side `console.error` in the catch block is adequate for development but would need upgrade for production observability. This is appropriately deferred to Phase 7.

## 6. Final Release Bar

**What must be true before this plan ships:**
- All three must-have fixes are implemented (error handling, env.ts decoupling, fail-closed middleware)
- Login endpoint returns identical error responses regardless of failure mode
- Middleware redirects to /login when JWT_SECRET is missing (fail closed)
- No auth code imports from `@/lib/env`

**Risks remaining if shipped as-is (with fixes applied):**
- No rate limiting on login endpoint (acceptable for single-admin, deferred to Phase 7)
- No structured auth event logging (acceptable, deferred to Phase 7)
- Login page inherits public Header/Footer — minimal information disclosure (site name, navigation) but acceptable since /login URL is not linked from public pages

**Sign-off:** I would sign my name to this system with the applied fixes. The auth model is appropriately simple for a single-admin photography portfolio. The security posture is defensive (fail closed, generic errors, httpOnly cookies) without being overengineered.

---

**Summary:** Applied 3 must-have + 5 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*

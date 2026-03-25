---
phase: 03-authentication
plan: 01
subsystem: auth
tags: [jwt, bcrypt, jose, middleware, edge-runtime]

requires:
  - phase: 01-nextjs-migration
    provides: Next.js App Router with middleware support
provides:
  - Single-admin authentication (bcrypt + JWT)
  - Middleware route protection for /admin/*
  - Login page at /login
  - Session management helpers (Edge-compatible)
affects: [04-object-storage, 05-admin-interface]

tech-stack:
  added: [bcryptjs@3.0.3, jose@6.2.2, "@types/bcryptjs@3.0.0"]
  patterns: [Edge-compatible session module split, process.env direct access for auth (bypass env.ts)]

key-files:
  created: [src/lib/auth.ts, src/lib/session.ts, src/middleware.ts, src/app/api/auth/login/route.ts, src/app/api/auth/logout/route.ts, src/app/login/page.tsx, src/components/admin/LoginForm.tsx]
  modified: [package.json, pnpm-lock.yaml]

key-decisions:
  - "auth.ts vs session.ts split: bcrypt (Node-only) separated from jose (Edge-compatible) for middleware"
  - "Auth routes use process.env directly instead of env.ts to avoid R2 env var coupling"
  - "All login error responses return identical { data: null, error: 'Invalid credentials' } — no info leakage"
  - "Login page uses inline styles with CSS variables from existing theme — matches Dark Cinematic Brutalism aesthetic"

patterns-established:
  - "Edge-compatible modules must not import bcryptjs or env.ts"
  - "API routes follow { data, error } response shape per CLAUDE.md"
  - "Admin UI components go in src/components/admin/"
  - "bcrypt hashes in .env files must escape $ with backslash (\\$) for dotenv-expand"

duration: ~25min
started: 2026-03-25
completed: 2026-03-25
---

# Phase 3 Plan 01: Authentication Summary

**Single-admin JWT auth with bcrypt verification, Edge-compatible middleware, and login page matching Dark Cinematic Brutalism aesthetic.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25 min |
| Started | 2026-03-25 |
| Completed | 2026-03-25 |
| Tasks | 3 completed + 1 checkpoint approved |
| Files created | 7 |
| Files modified | 2 (package.json, pnpm-lock.yaml) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Valid Password Authentication | Pass | Correct password → 200 + Set-Cookie with JWT |
| AC-2: Invalid Password Rejection | Pass | Wrong password → 401 + generic error |
| AC-3: Route Protection | Pass | Unauthenticated /admin/* → redirect to /login |
| AC-4: Logout | Pass | POST /api/auth/logout clears session cookie |
| AC-5: Login Page Functionality | Pass | Form submits, redirects on success, shows errors |
| AC-6: Login Error Handling | Pass | Malformed body → same 401 generic error (audit-added) |
| AC-7: Already-Authenticated Redirect | Pass | Server component checks session, redirects if valid (audit-added) |

## Accomplishments

- Full auth flow: login → JWT session cookie → middleware verification → logout
- Edge-compatible architecture: session.ts (jose) cleanly separated from auth.ts (bcryptjs)
- Auth decoupled from env.ts — works without R2/storage credentials configured
- Login page styled to match existing Dark Cinematic Brutalism portfolio aesthetic (Syne/Outfit/JetBrains Mono, ember accent)

## Skill Audit

| Expected | Invoked | Notes |
|----------|---------|-------|
| /frontend-design (required) | ✓ | Loaded before Task 3, guided login page styling |
| /bencium-controlled-ux-designer (optional) | ○ | Not needed — login page is minimal, design decisions were straightforward |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/auth.ts` | Created | bcrypt password verification helper |
| `src/lib/session.ts` | Created | JWT sign/verify, cookie config (Edge-compatible) |
| `src/app/api/auth/login/route.ts` | Created | POST login endpoint with try-catch error handling |
| `src/app/api/auth/logout/route.ts` | Created | POST logout endpoint, clears session cookie |
| `src/middleware.ts` | Created | Protects /admin/*, fail-closed on missing JWT_SECRET |
| `src/app/login/page.tsx` | Created | Server component with session check + metadata |
| `src/components/admin/LoginForm.tsx` | Created | Client component with password form, dark theme styling |
| `package.json` | Modified | Added bcryptjs, jose, @types/bcryptjs |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Split auth.ts / session.ts | bcryptjs is Node-only, jose is Edge-compatible. Middleware needs session verification without importing bcrypt | Pattern for all future Edge Runtime code |
| process.env direct access (not env.ts) | env.ts eagerly validates ALL server vars including R2. Auth shouldn't fail because R2 isn't configured yet | Auth routes work independently of storage config |
| Generic error for all login failures | Audit finding: different error messages leak auth state to attackers | All failure modes return identical 401 response |
| Inline styles with CSS variables | Login page uses existing --black, --ember, --f-display vars. Avoids adding CSS files while matching site aesthetic | Future admin pages can adopt same pattern or use Tailwind |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Essential — bcrypt hash env var escaping |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** One env configuration issue resolved during verification.

### Auto-fixed Issues

**1. [Config] bcrypt hash $-escaping in .env.local**
- **Found during:** Checkpoint verification
- **Issue:** dotenv-expand interprets `$` in bcrypt hashes as variable references, truncating the hash from 60 to 49 characters. `bcrypt.compare` fails silently (returns false).
- **Fix:** Escaped `$` characters with `\$` in .env.local. Documented in patterns-established.
- **Files:** .env.local (not committed)
- **Verification:** Login with correct password succeeds after fix

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| bcrypt hash truncated by dotenv-expand | Escaped `$` with `\$` in .env.local |
| jose Edge Runtime warning (DecompressionStream) | Harmless — only affects JWE, not JWS. No action needed. |

## Next Phase Readiness

**Ready:**
- Auth boundary established — all future admin routes at /admin/* are automatically protected
- Session helpers available for admin API routes (Phase 4-5)
- Login page functional and styled
- src/components/admin/ directory established for future admin UI components

**Concerns:**
- Future admin API routes (e.g., /api/uploads/) are NOT under /admin/* and won't be auto-protected by middleware. Each phase must either add matchers or verify auth inline.
- .env.local bcrypt hash requires `\$` escaping — document in deployment guide

**Blockers:**
- None

---
*Phase: 03-authentication, Plan: 01*
*Completed: 2026-03-25*

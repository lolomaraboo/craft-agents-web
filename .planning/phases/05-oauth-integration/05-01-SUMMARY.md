---
phase: 05-oauth-integration
plan: 01
subsystem: auth
tags: [oauth, fastify, cookie, csrf, state-management]

# Dependency graph
requires:
  - phase: 01-server-foundation
    provides: Fastify server with plugin architecture
  - phase: 02-core-api
    provides: TypeBox schema validation pattern
provides:
  - OAuth infrastructure (plugin, state manager, schemas)
  - Cookie support for secure state storage
  - TypeBox schemas for OAuth routes
  - State manager singleton for session tracking
affects: [05-02-google-oauth, 05-03-slack-oauth, 05-04-microsoft-oauth]

# Tech tracking
tech-stack:
  added: [@fastify/oauth2@8.1.2, @fastify/cookie@11.0.2]
  patterns: [OAuth state management with 5-minute expiry, Cookie-based CSRF protection]

key-files:
  created:
    - apps/web/src/server/plugins/oauth.ts
    - apps/web/src/server/lib/oauth-state.ts
    - apps/web/src/server/schemas/oauth.ts
  modified:
    - apps/web/src/server/index.ts
    - apps/web/package.json

key-decisions:
  - "Cookie plugin registered with httpOnly, sameSite=lax, secure in production"
  - "State manager uses crypto.randomBytes(16) for CSRF protection"
  - "5-minute state expiry with 60-second cleanup interval"
  - "TypeBox union type for OAuthCallbackQuery (handles success/error cases)"

patterns-established:
  - "OAuth state lifecycle: create → validate → clear"
  - "Singleton state manager with automatic cleanup on startup"
  - "Cookie secret falls back to dev value with warning (not error)"

# Metrics
duration: 3min
completed: 2026-01-28
---

# Phase 05 Plan 01: OAuth Infrastructure Summary

**Fastify OAuth foundation with cookie plugin, state manager for session tracking, and TypeBox schemas for all three providers**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-28T05:05:57Z
- **Completed:** 2026-01-28T05:09:10Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- OAuth plugin with @fastify/cookie registered for secure state storage
- State manager singleton with 5-minute expiry and periodic cleanup
- TypeBox schemas ready for Google, Slack, and Microsoft OAuth routes
- Server verified to start successfully with cookie support enabled

## Task Commits

Each task was committed atomically:

1. **Task 1: Install OAuth dependencies and create TypeBox schemas** - `f212dc4` (feat)
2. **Task 2: Create OAuth state manager** - `cf3bd75` (feat)
3. **Task 3: Create OAuth plugin and register in server** - `1ae5ab4` (feat)

## Files Created/Modified

**Created:**
- `apps/web/src/server/plugins/oauth.ts` - Fastify plugin with cookie registration
- `apps/web/src/server/lib/oauth-state.ts` - OAuth state manager singleton with session tracking
- `apps/web/src/server/schemas/oauth.ts` - TypeBox schemas for OAuth routes

**Modified:**
- `apps/web/src/server/index.ts` - Registered OAuth plugin after multipart, before websocket
- `apps/web/package.json` - Added @fastify/oauth2 and @fastify/cookie dependencies

## Decisions Made

1. **Cookie configuration:** httpOnly for security, sameSite=lax for CSRF protection, secure only in production (allows localhost testing)

2. **State manager design:** Singleton instance with automatic cleanup on startup. Uses Map for O(1) lookups, periodic cleanup every 60 seconds.

3. **State generation:** 16-byte random state using crypto.randomBytes().toString('hex') - follows same pattern as packages/shared/src/auth/pkce.ts

4. **TypeBox union for callbacks:** OAuthCallbackQuery uses Type.Union to handle both success (code+state) and error (error+state+error_description) cases from OAuth providers

5. **Dev secret fallback:** If COOKIE_SECRET not set, plugin warns but uses dev secret. Allows local testing without breaking server startup.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript iteration compatibility**
- **Found during:** Task 2 (OAuth state manager implementation)
- **Issue:** `for...of` loop on Map.entries() failed with TS2802 error (requires --downlevelIteration flag)
- **Fix:** Changed from `for (const [state, entry] of this.stateMap.entries())` to `this.stateMap.forEach((entry, state) => {...})`
- **Files modified:** apps/web/src/server/lib/oauth-state.ts
- **Verification:** bunx tsc --noEmit confirmed no errors specific to oauth-state.ts
- **Committed in:** cf3bd75 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor iteration pattern change for TypeScript compatibility. No functional impact.

## Issues Encountered

None - plan executed smoothly.

## User Setup Required

**External services require manual configuration.** OAuth providers need credentials and redirect URI configuration:

**Google OAuth:**
- `GOOGLE_OAUTH_CLIENT_ID` - From Google Cloud Console → APIs & Services → Credentials
- `GOOGLE_OAUTH_CLIENT_SECRET` - From Google Cloud Console → APIs & Services → Credentials
- Add `http://localhost:3000/api/oauth/google/callback` to authorized redirect URIs

**Microsoft OAuth:**
- `MICROSOFT_OAUTH_CLIENT_ID` - From Azure Portal → App registrations → Application (client) ID
- Add `http://localhost:3000/api/oauth/microsoft/callback` to redirect URIs

**Slack OAuth:**
- `SLACK_OAUTH_CLIENT_ID` - From Slack API → Your Apps → OAuth & Permissions
- `SLACK_OAUTH_CLIENT_SECRET` - From Slack API → Your Apps → OAuth & Permissions

**Cookie Security:**
- `COOKIE_SECRET` - Generate with: `openssl rand -hex 32`

## Next Phase Readiness

**Ready for provider routes:** OAuth infrastructure complete. Next plans (05-02, 05-03, 05-04) can build Google, Slack, and Microsoft OAuth routes on top of this foundation.

**State manager pattern:** The `oauthStateManager.createState(sessionId, provider)` → callback validates state → `oauthStateManager.clearState(state)` pattern is ready for all three providers.

**No blockers:** Server starts successfully, cookie support verified, schemas ready.

---
*Phase: 05-oauth-integration*
*Completed: 2026-01-28*

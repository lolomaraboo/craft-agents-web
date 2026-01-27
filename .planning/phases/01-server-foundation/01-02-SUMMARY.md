---
phase: 01-server-foundation
plan: 02
subsystem: server
tags: [vite, react, static-files, spa, hot-reload, proxy]

# Dependency graph
requires:
  - phase: 01-01
    provides: Fastify server with WebSocket endpoint
provides:
  - Static file serving plugin with SPA fallback for production
  - Vite dev server with proxy to Fastify for /api and /ws
  - Minimal React app with WebSocket connection test
  - Full development workflow with hot reload
affects: [02-core-api, 03-realtime-events, 04-session-management]

# Tech tracking
tech-stack:
  added:
    - vite@6.2.4
    - "@vitejs/plugin-react@5.1.2"
    - react@18.3.1
    - react-dom@18.3.1
    - concurrently@9.2.1
  patterns:
    - Vite proxy pattern for development API/WebSocket routing
    - Static plugin disabled in dev mode (Vite handles frontend)
    - Separate tsconfig for server (excludes client code)

key-files:
  created:
    - apps/web/src/server/plugins/static.ts
    - apps/web/vite.config.ts
    - apps/web/src/client/index.html
    - apps/web/src/client/main.tsx
    - apps/web/src/client/App.tsx
    - apps/web/tsconfig.server.json
  modified:
    - apps/web/src/server/index.ts
    - apps/web/package.json
    - package.json
    - apps/web/tsconfig.json

key-decisions:
  - "Set NODE_ENV=development explicitly in dev:server script (bun defaults to production)"
  - "Excluded client code from main tsconfig (Vite handles client TypeScript)"
  - "Static plugin uses SPA fallback for all non-API, non-WS GET requests"

patterns-established:
  - "Dev pattern: concurrently runs tsx watch (server) and vite (client)"
  - "Proxy pattern: /api and /ws requests proxied from Vite to Fastify"
  - "Build pattern: vite build for client, tsc -p tsconfig.server.json for server"

# Metrics
duration: 5min
completed: 2026-01-27
---

# Phase 1 Plan 2: Static Serving and Vite Dev Server Summary

**Vite dev server with proxy to Fastify for /api and /ws, plus @fastify/static for production SPA serving**

## Performance

- **Duration:** 5 min
- **Started:** 2026-01-27T21:01:40Z
- **Completed:** 2026-01-27T21:06:50Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments
- Created static file serving plugin with SPA fallback (serves index.html for client routes)
- Configured Vite dev server with proxy to Fastify for /api and /ws paths
- Built minimal React app with WebSocket connection test button
- Established full dev workflow via `bun run web:dev` (starts both servers)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create static file serving plugin with SPA fallback** - `06cca8e` (feat)
2. **Task 2: Create minimal React app and Vite configuration** - `247d34a` (feat)
3. **Task 3: Add root-level dev script and verify full workflow** - `a1d6f51` (feat)

## Files Created/Modified
- `apps/web/src/server/plugins/static.ts` - Static file serving with SPA fallback
- `apps/web/src/server/index.ts` - Register static plugin (disabled in dev mode)
- `apps/web/vite.config.ts` - Vite config with proxy to Fastify
- `apps/web/src/client/index.html` - React app entry HTML
- `apps/web/src/client/main.tsx` - React app entry point
- `apps/web/src/client/App.tsx` - Minimal React component with WebSocket test
- `apps/web/tsconfig.server.json` - Separate tsconfig for server production builds
- `apps/web/tsconfig.json` - Excluded client code (Vite handles it)
- `apps/web/package.json` - Dev scripts, React/Vite dependencies
- `package.json` - Root-level web:dev, web:build, web:preview scripts

## Decisions Made
- Set NODE_ENV=development explicitly in dev:server script because bun/tsx default to production
- Excluded client code from main tsconfig.json (Vite uses esbuild for client TypeScript)
- Static plugin uses setNotFoundHandler for SPA fallback, only for GET requests not starting with /api or /ws

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed NODE_ENV detection for dev mode**
- **Found during:** Task 3 (verify full workflow)
- **Issue:** Bun defaults NODE_ENV to 'production', causing static plugin to enable in dev mode
- **Fix:** Added NODE_ENV=development prefix to dev:server script
- **Files modified:** apps/web/package.json
- **Verification:** Dev logs show "Static plugin disabled (dev mode)" and use pino-pretty format
- **Committed in:** a1d6f51 (Task 3 commit)

**2. [Rule 3 - Blocking] Excluded client code from server TypeScript config**
- **Found during:** Task 3 (verify full workflow)
- **Issue:** Main tsconfig included client code, failing on JSX and DOM types
- **Fix:** Changed include from "src/**/*" to "src/server/**/*", added src/client to exclude
- **Files modified:** apps/web/tsconfig.json
- **Verification:** `bun run tsc --noEmit` compiles without errors
- **Committed in:** a1d6f51 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for correct operation. No scope creep.

## Issues Encountered
None - deviations handled via auto-fix rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Server foundation complete with both HTTP and WebSocket capabilities
- Development workflow ready: `bun run web:dev` starts everything
- Ready for Phase 2 (Core API) to add HTTP endpoints
- Ready for Phase 3 (Real-time Events) to implement WebSocket message handlers
- No blockers identified

---
*Phase: 01-server-foundation*
*Completed: 2026-01-27*

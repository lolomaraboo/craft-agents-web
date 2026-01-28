# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-27)

**Core value:** Browser-based Claude agent access with 100% feature parity
**Current focus:** Phase 5 - OAuth Integration (Next)

## Current Position

Phase: 5 of 6 (OAuth Integration)
Plan: 1 of 4 in phase
Status: In progress
Last activity: 2026-01-28 - Completed 05-01-PLAN.md

Progress: [#########-] 75% (9/12 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 9
- Average duration: 8.8 min
- Total execution time: 79 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-server-foundation | 2/2 | 9 min | 4.5 min |
| 02-core-api | 2/2 | 15 min | 7.5 min |
| 03-real-time-events | 2/2 | 8 min | 4.0 min |
| 04-file-handling | 2/2 | 44 min | 22.0 min |
| 05-oauth-integration | 1/4 | 3 min | 3.0 min |

**Recent Trend:**
- Last 5 plans: 4 min, 26 min, 18 min, 3 min
- Trend: Fast completion for infrastructure setup (Phase 5-01)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Research]: Fastify 5.x over Express (2-3x faster for JSON streaming)
- [Research]: ws library for WebSocket (fastest, simplest)
- [Research]: Adapter pattern for IPC->HTTP (minimize renderer changes)
- [01-01]: Used fastify-plugin wrapper for proper WebSocket plugin encapsulation
- [01-01]: Attached WebSocket message handlers synchronously to avoid async trap
- [01-02]: Set NODE_ENV=development explicitly (bun defaults to production)
- [01-02]: Excluded client code from main tsconfig (Vite handles client TypeScript)
- [01-02]: Static plugin uses SPA fallback for non-API/non-WS GET requests
- [02-01]: TypeBox over Zod for runtime validation (better Fastify integration)
- [02-01]: CORS only enabled in development mode (production uses same origin)
- [02-01]: SessionManager stubs return predictable mock data (real implementation in Phase 3)
- [02-01]: HTTP 202 Accepted for message sending (async processing in Phase 3)
- [02-02]: Direct @craft-agent/shared imports for workspace operations (same as Electron IPC)
- [02-02]: Credential API exposes metadata only, never values (security)
- [02-02]: Placeholder endpoints return { data: [] } for future implementation
- [03-01]: TypeBox schemas for WebSocket events (consistent with Phase 2 API)
- [03-01]: 50ms delta batching interval (balance latency vs message overhead)
- [03-01]: Session-scoped tracking with WeakMap cleanup (memory-safe disconnect handling)
- [03-01]: Mock agent for Phase 3-01 verification (real CraftAgent in 03-02)
- [03-02]: 60-second permission timeout (balance user decision time vs blocking agent)
- [03-02]: Placeholder workspace ID "web-server" for ConfigWatcher (only watches global files)
- [03-02]: Graceful fallback for config watcher failures (non-critical feature)
- [04-01]: Use request.parts() async iterator for multipart uploads (memory efficient)
- [04-01]: Magic number validation with file-type library (security - prevents MIME spoofing)
- [04-01]: UUID-prefixed filenames prevent collisions ({uuid}-{original-name})
- [04-01]: Hardcoded ~/.craft-agent workspace path for Phase 4 (will be wired properly later)
- [04-02]: Path validation using resolve() and startsWith() for traversal protection
- [04-02]: 24-hour grace period before deleting orphaned files
- [04-02]: Cleanup scheduled every 24 hours starting at server startup
- [05-01]: Cookie plugin with httpOnly, sameSite=lax, secure in production
- [05-01]: State manager uses crypto.randomBytes(16) for CSRF protection
- [05-01]: 5-minute state expiry with 60-second cleanup interval
- [05-01]: TypeBox union type for OAuthCallbackQuery (handles success/error cases)

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 04:**
- Image resizing needed before Claude API submission (20MB raw → API limits)
- Workspace context currently hardcoded to ~/.craft-agent (needs multi-workspace support)

## Session Continuity

Last session: 2026-01-28T05:09:10Z
Stopped at: Completed 05-01-PLAN.md
Resume file: None

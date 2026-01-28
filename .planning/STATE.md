# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-27)

**Core value:** Browser-based Claude agent access with 100% feature parity
**Current focus:** Milestone Complete - v1.0 Web Foundation

## Current Position

Phase: 6 of 6 (Frontend Adaptation)
Plan: 2 of 2 in phase (complete)
Status: Phase complete
Last activity: 2026-01-28 - Completed 06-02-PLAN.md

Progress: [###########] 100% (12/12 plans)

## Performance Metrics

**Velocity:**
- Total plans completed: 12
- Average duration: 8.0 min
- Total execution time: 96 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-server-foundation | 2/2 | 9 min | 4.5 min |
| 02-core-api | 2/2 | 15 min | 7.5 min |
| 03-real-time-events | 2/2 | 8 min | 4.0 min |
| 04-file-handling | 2/2 | 44 min | 22.0 min |
| 05-oauth-integration | 2/2 | 10 min | 5.0 min |
| 06-frontend-adaptation | 2/2 | 10 min | 5.0 min |

**Recent Trend:**
- Last 5 plans: 18 min, 3 min, 7 min, 4 min, 6 min
- Trend: Consistent fast execution for frontend/integration phases

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
- [05-02]: source_oauth credential type for all OAuth tokens (not provider-specific types)
- [05-02]: PKCE for Google/Microsoft, HTTP Basic auth for Slack (no PKCE support)
- [05-02]: Cloudflare relay for Slack HTTPS requirement (agents.craft.do)
- [05-02]: 5-minute token refresh buffer with automatic refresh via getValidOAuthToken()
- [06-01]: WebSocket auto-reconnection: 5 max attempts with exponential backoff (1s, 2s, 4s, 8s, 16s)
- [06-01]: Permission responses sent via WebSocket (not HTTP) for real-time delivery
- [06-01]: WebElectronAPI excludes Electron-only methods (file dialogs, window management, auto-update, notifications)
- [06-01]: Preferences transformed from server JSON to stringified format matching ElectronAPI
- [06-02]: react-error-boundary library for network error handling with onReset retry
- [06-02]: LoadingState wraps children pattern for async operations (inline and full variants)
- [06-02]: useApiClient throws if adapter not initialized (catches bootstrap errors early)
- [06-02]: Bootstrap injects HttpAdapter as window.electronAPI before React render
- [06-02]: WebSocket connected early in main.tsx for immediate availability

### Pending Todos

None yet.

### Blockers/Concerns

**Phase 04:**
- Image resizing needed before Claude API submission (20MB raw → API limits)
- Workspace context currently hardcoded to ~/.craft-agent (needs multi-workspace support)

## Session Continuity

Last session: 2026-01-28T11:11:31Z
Stopped at: Completed 06-02-PLAN.md (Phase 6 complete)
Resume file: None

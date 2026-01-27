# Research Summary: Craft Agents Web

**Project:** Transform Electron desktop app into self-hosted web application
**Research Date:** 2026-01-27

## Key Decisions

### Server Framework: Fastify + ws

**Recommendation:** Fastify 5.x for HTTP, ws library for WebSocket

**Rationale:**
- Fastify is 2-3x faster than Express for JSON-heavy streaming
- TypeScript-first with excellent type inference
- ws is the fastest, simplest WebSocket library
- Both are battle-tested and well-maintained

### Architecture: HTTP/WebSocket Hybrid

Replace Electron main process with Node.js server:
- **HTTP REST API** replaces `ipcMain.handle()` (127 endpoints)
- **WebSocket** replaces `ipcRenderer.on()` (30+ event types)
- **SessionManager** adapted with minimal changes
- **packages/shared/** reused 100% unchanged

### Code Reuse Strategy

| Layer | Reuse % |
|-------|---------|
| packages/shared/ | 100% |
| packages/ui/ | 100% |
| packages/core/ | 100% |
| renderer/components | 90% |
| renderer/atoms | 90% |
| main/sessions.ts | 70% |

## Table Stakes (Must Have)

1. HTTP API for all session operations
2. WebSocket for real-time event streaming
3. File upload via multipart/form-data
4. OAuth redirect flow with PKCE
5. Server-side credential storage
6. Config file watching with WebSocket push

## Critical Pitfalls to Avoid

1. **Sync IPC assumptions** → Add loading states everywhere
2. **Node.js in renderer** → Audit and remove before migration
3. **File system access** → Server handles all fs, browser uploads
4. **WebSocket fragility** → Robust reconnection logic required
5. **OAuth flow differences** → Configurable callback URLs

## Recommended Phase Structure

| Phase | Focus | Complexity |
|-------|-------|------------|
| 1 | Server foundation (Fastify + ws) | Low |
| 2 | Core API routes (sessions CRUD) | Low |
| 3 | WebSocket event streaming | Medium |
| 4 | File upload/download | Medium |
| 5 | OAuth callbacks | Medium |

## Stack Summary

**Server:**
- Fastify 5.x + @fastify/websocket + @fastify/multipart
- ws 8.x for WebSocket
- tsx + nodemon for development
- pino for logging

**Client:**
- Existing React app from renderer/
- HTTP client adapter replacing window.electronAPI
- WebSocket manager for events

**Unchanged:**
- packages/shared/ (CraftAgent, credentials, MCP, config)
- packages/ui/ (React components)
- packages/core/ (types, utilities)

## Out of Scope

- Multi-user authentication
- Viewer app (defer to later)
- Auto-update mechanism
- System notifications (use browser API)
- Global keyboard shortcuts

## Confidence Assessment

| Area | Confidence |
|------|------------|
| Architecture | HIGH |
| Stack choices | MEDIUM |
| Code reuse | HIGH |
| Pitfalls | HIGH |

---
*Research complete: 2026-01-27*

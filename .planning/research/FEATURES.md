# Feature Landscape: Electron to Web

**Research Date:** 2026-01-27
**Confidence:** HIGH (based on codebase analysis)

## Table Stakes

Features that must work for feature parity.

| Electron Feature | Web Equivalent | Complexity |
|------------------|----------------|------------|
| IPC request/response | HTTP API (fetch) | Low |
| IPC event streaming | WebSocket client | Medium |
| Session persistence | Server-side file I/O | Low |
| Real-time streaming | WebSocket | Medium |
| File attachments | File Upload API | Medium |
| OAuth flows | OAuth redirect with PKCE | High |
| Credential storage | Server-side only | Low |
| Permission modes | WebSocket for asks | Low |
| Theme system | CSS variables + API | Low |
| Config watching | Server watcher + WS push | Medium |

## Differentiators

Web platform advantages over desktop.

| Feature | Value |
|---------|-------|
| Cross-device access | Any browser on network |
| No installation | Deploy once, access anywhere |
| Browser DevTools | Better debugging |
| Multi-tab support | Native browser feature |
| Simpler updates | Server update = everyone updated |
| Standard OAuth | Web is OAuth's natural habitat |

## Anti-Features

Things to NOT build.

| Anti-Feature | Reason |
|--------------|--------|
| File System Access API | Chrome-only, permission UX |
| Multi-user auth | Out of scope |
| IndexedDB for sessions | Server is source of truth |
| Service Worker API caching | Real-time data shouldn't cache |
| Electron-style menus | Browser has its own |
| Window state persistence | Browser manages tabs |
| Auto-update mechanism | Web refreshes naturally |

## Feature Dependencies

```
Foundation Layer:
├─ HTTP server (Fastify)
├─ WebSocket server (ws)
└─ Static file serving

Communication Layer:
├─ IPC → HTTP adapter
├─ IPC events → WebSocket
└─ File upload API

Business Logic (reuse existing):
├─ SessionManager
├─ CraftAgent
└─ MCP client
```

## Migration Checklist

**Session Management:**
- [ ] POST /api/sessions (create)
- [ ] POST /api/sessions/:id/messages (send)
- [ ] WebSocket session_event (receive streaming)
- [ ] POST /api/sessions/:id/abort (cancel)

**File Operations:**
- [ ] POST /api/attachments (upload)
- [ ] GET /api/attachments/:id (download)

**OAuth:**
- [ ] GET /auth/:provider/start
- [ ] GET /auth/:provider/callback

**Real-time:**
- [ ] WebSocket session_event (30+ event types)
- [ ] WebSocket permission_request
- [ ] WebSocket config_changed

---
*Features research: 2026-01-27*

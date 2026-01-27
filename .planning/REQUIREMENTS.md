# Requirements: Craft Agents Web

**Defined:** 2026-01-27
**Core Value:** Browser-based Claude agent access with 100% feature parity

## v1.0 Requirements

Requirements for Web Foundation milestone. Each maps to roadmap phases.

### Server Foundation

- [ ] **SRVR-01**: Fastify HTTP server starts and listens on configurable port
- [ ] **SRVR-02**: WebSocket server accepts connections and manages client lifecycle
- [ ] **SRVR-03**: Static file serving delivers React app bundle
- [ ] **SRVR-04**: Development server supports hot reload for frontend changes
- [ ] **SRVR-05**: Server gracefully shuts down on SIGTERM/SIGINT

### API Layer

- [ ] **API-01**: Session CRUD endpoints (create, read, list, delete)
- [ ] **API-02**: Session message endpoint accepts user messages
- [ ] **API-03**: Session abort endpoint cancels in-progress requests
- [ ] **API-04**: Workspace CRUD endpoints (create, read, list, update, delete)
- [ ] **API-05**: Config endpoints (get, update, watch)
- [ ] **API-06**: Credential endpoints (list, add, remove) — server-side only
- [ ] **API-07**: MCP server endpoints (list, connect, disconnect)
- [ ] **API-08**: Theme endpoints (get, update, per-workspace overrides)

### Real-time Communication

- [ ] **RTCM-01**: WebSocket broadcasts agent response events (streaming)
- [ ] **RTCM-02**: WebSocket broadcasts tool use events
- [ ] **RTCM-03**: WebSocket handles permission request/response flow
- [ ] **RTCM-04**: WebSocket broadcasts config change notifications
- [ ] **RTCM-05**: WebSocket supports session-scoped event filtering
- [ ] **RTCM-06**: WebSocket reconnection maintains session context

### File Handling

- [ ] **FILE-01**: File upload API accepts multipart form data
- [ ] **FILE-02**: File upload stores to server filesystem (configurable path)
- [ ] **FILE-03**: File download endpoint serves uploaded attachments
- [ ] **FILE-04**: File cleanup removes orphaned attachments

### OAuth & Auth

- [ ] **AUTH-01**: OAuth start endpoint initiates PKCE flow
- [ ] **AUTH-02**: OAuth callback endpoint handles provider response
- [ ] **AUTH-03**: OAuth tokens stored server-side (encrypted)
- [ ] **AUTH-04**: Google OAuth provider supported
- [ ] **AUTH-05**: Slack OAuth provider supported
- [ ] **AUTH-06**: Microsoft OAuth provider supported
- [ ] **AUTH-07**: OAuth refresh flow handles token expiration

### Frontend Adaptation

- [ ] **FRNT-01**: HTTP client adapter replaces window.electronAPI
- [ ] **FRNT-02**: WebSocket manager subscribes to server events
- [ ] **FRNT-03**: Loading states shown during async operations
- [ ] **FRNT-04**: Error boundaries handle network failures gracefully
- [ ] **FRNT-05**: Frontend uses same React components as Electron app
- [ ] **FRNT-06**: Theme system works via HTTP API (not IPC)

## Future Requirements

Deferred to v2.0+. Tracked but not in current roadmap.

### Viewer App

- **VIEW-01**: Viewer app ported to web
- **VIEW-02**: Viewer shares session read-only access

### Advanced Features

- **ADV-01**: Multi-instance session sharing
- **ADV-02**: System notifications via browser API
- **ADV-03**: PWA installation support

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multi-user authentication | Single-user deployment, trusted localhost |
| Database backend | Keep file-based storage for Electron compatibility |
| File System Access API | Chrome-only, permission UX issues |
| IndexedDB for sessions | Server is source of truth |
| Service Worker caching | Real-time data shouldn't cache |
| Electron-style menus | Browser has its own |
| Auto-update mechanism | Web refreshes naturally |
| Global keyboard shortcuts | Browser limitation |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SRVR-01 | — | Pending |
| SRVR-02 | — | Pending |
| SRVR-03 | — | Pending |
| SRVR-04 | — | Pending |
| SRVR-05 | — | Pending |
| API-01 | — | Pending |
| API-02 | — | Pending |
| API-03 | — | Pending |
| API-04 | — | Pending |
| API-05 | — | Pending |
| API-06 | — | Pending |
| API-07 | — | Pending |
| API-08 | — | Pending |
| RTCM-01 | — | Pending |
| RTCM-02 | — | Pending |
| RTCM-03 | — | Pending |
| RTCM-04 | — | Pending |
| RTCM-05 | — | Pending |
| RTCM-06 | — | Pending |
| FILE-01 | — | Pending |
| FILE-02 | — | Pending |
| FILE-03 | — | Pending |
| FILE-04 | — | Pending |
| AUTH-01 | — | Pending |
| AUTH-02 | — | Pending |
| AUTH-03 | — | Pending |
| AUTH-04 | — | Pending |
| AUTH-05 | — | Pending |
| AUTH-06 | — | Pending |
| AUTH-07 | — | Pending |
| FRNT-01 | — | Pending |
| FRNT-02 | — | Pending |
| FRNT-03 | — | Pending |
| FRNT-04 | — | Pending |
| FRNT-05 | — | Pending |
| FRNT-06 | — | Pending |

**Coverage:**
- v1.0 requirements: 36 total
- Mapped to phases: 0
- Unmapped: 36 (roadmap pending)

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 after initial definition*

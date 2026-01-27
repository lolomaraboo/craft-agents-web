# Requirements: Craft Agents Web

**Defined:** 2026-01-27
**Core Value:** Browser-based Claude agent access with 100% feature parity

## v1.0 Requirements

Requirements for Web Foundation milestone. Each maps to roadmap phases.

### Server Foundation

- [x] **SRVR-01**: Fastify HTTP server starts and listens on configurable port
- [x] **SRVR-02**: WebSocket server accepts connections and manages client lifecycle
- [x] **SRVR-03**: Static file serving delivers React app bundle
- [x] **SRVR-04**: Development server supports hot reload for frontend changes
- [x] **SRVR-05**: Server gracefully shuts down on SIGTERM/SIGINT

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
| SRVR-01 | Phase 1 | Complete |
| SRVR-02 | Phase 1 | Complete |
| SRVR-03 | Phase 1 | Complete |
| SRVR-04 | Phase 1 | Complete |
| SRVR-05 | Phase 1 | Complete |
| API-01 | Phase 2 | Pending |
| API-02 | Phase 2 | Pending |
| API-03 | Phase 2 | Pending |
| API-04 | Phase 2 | Pending |
| API-05 | Phase 2 | Pending |
| API-06 | Phase 2 | Pending |
| API-07 | Phase 2 | Pending |
| API-08 | Phase 2 | Pending |
| RTCM-01 | Phase 3 | Pending |
| RTCM-02 | Phase 3 | Pending |
| RTCM-03 | Phase 3 | Pending |
| RTCM-04 | Phase 3 | Pending |
| RTCM-05 | Phase 3 | Pending |
| RTCM-06 | Phase 3 | Pending |
| FILE-01 | Phase 4 | Pending |
| FILE-02 | Phase 4 | Pending |
| FILE-03 | Phase 4 | Pending |
| FILE-04 | Phase 4 | Pending |
| AUTH-01 | Phase 5 | Pending |
| AUTH-02 | Phase 5 | Pending |
| AUTH-03 | Phase 5 | Pending |
| AUTH-04 | Phase 5 | Pending |
| AUTH-05 | Phase 5 | Pending |
| AUTH-06 | Phase 5 | Pending |
| AUTH-07 | Phase 5 | Pending |
| FRNT-01 | Phase 6 | Pending |
| FRNT-02 | Phase 6 | Pending |
| FRNT-03 | Phase 6 | Pending |
| FRNT-04 | Phase 6 | Pending |
| FRNT-05 | Phase 6 | Pending |
| FRNT-06 | Phase 6 | Pending |

**Coverage:**
- v1.0 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 after Phase 1 completion*

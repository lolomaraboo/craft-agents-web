# Roadmap: Craft Agents Web

## Overview

Transform the Electron desktop app into a self-hosted web application. The journey progresses from server foundation through API layer, real-time communication, file handling, OAuth integration, and finally frontend adaptation. Each phase builds on the previous, culminating in a browser-based interface with 100% feature parity.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Server Foundation** - Fastify HTTP server with WebSocket support
- [x] **Phase 2: Core API** - HTTP endpoints replacing IPC handlers
- [ ] **Phase 3: Real-time Events** - WebSocket streaming for agent responses
- [ ] **Phase 4: File Handling** - Upload, storage, and download for attachments
- [x] **Phase 5: OAuth Integration** - PKCE flows for Google, Slack, Microsoft
- [ ] **Phase 6: Frontend Adaptation** - React app connected via HTTP/WebSocket

## Phase Details

### Phase 1: Server Foundation
**Goal**: Server infrastructure exists and can serve the React application
**Depends on**: Nothing (first phase)
**Requirements**: SRVR-01, SRVR-02, SRVR-03, SRVR-04, SRVR-05
**Success Criteria** (what must be TRUE):
  1. User can start server with `bun run dev` and see it listening on configured port
  2. Browser can connect to WebSocket endpoint and receive connection acknowledgment
  3. Browser can load React app bundle from server root URL
  4. Frontend changes hot-reload in browser during development
  5. Server shuts down cleanly when process receives SIGTERM
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md - Core Fastify server with WebSocket support and graceful shutdown
- [x] 01-02-PLAN.md - Static file serving and Vite dev server integration

### Phase 2: Core API
**Goal**: All session and configuration operations available via HTTP endpoints
**Depends on**: Phase 1
**Requirements**: API-01, API-02, API-03, API-04, API-05, API-06, API-07, API-08
**Success Criteria** (what must be TRUE):
  1. User can create, list, read, and delete sessions via HTTP requests
  2. User can send messages to sessions and receive responses
  3. User can abort in-progress requests via HTTP endpoint
  4. User can manage workspaces (CRUD) and their configurations
  5. User can manage MCP server connections via HTTP endpoints
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md - Session CRUD, message, and abort endpoints with TypeBox validation
- [x] 02-02-PLAN.md - Workspace, config, MCP, and theme endpoints

### Phase 3: Real-time Events
**Goal**: Browser receives real-time updates during agent interactions
**Depends on**: Phase 2
**Requirements**: RTCM-01, RTCM-02, RTCM-03, RTCM-04, RTCM-05, RTCM-06
**Success Criteria** (what must be TRUE):
  1. Browser receives streaming agent response tokens in real-time
  2. Browser receives tool use events as they occur
  3. Browser can respond to permission requests via WebSocket
  4. Browser receives config change notifications when server config changes
  5. Browser reconnects automatically and maintains session context after disconnect
**Plans**: 2 plans

Plans:
- [ ] 03-01-PLAN.md - WebSocket event schemas, session-scoped tracking, delta batching, and SessionManager integration
- [ ] 03-02-PLAN.md - Permission request/response flow, timeout handling, and config change notifications

### Phase 4: File Handling
**Goal**: Users can upload and download file attachments via browser
**Depends on**: Phase 2
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04
**Success Criteria** (what must be TRUE):
  1. User can upload files via drag-and-drop or file picker in browser
  2. Uploaded files are stored on server filesystem in configured location
  3. User can download previously uploaded attachments
  4. Orphaned files are cleaned up automatically
**Plans**: 2 plans

Plans:
- [ ] 04-01-PLAN.md - File upload endpoint with multipart handling and magic number validation
- [ ] 04-02-PLAN.md - File download endpoint with path security and orphan cleanup

### Phase 5: OAuth Integration
**Goal**: Users can authenticate with external services via browser OAuth flows
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. User can initiate OAuth flow that opens provider login in browser
  2. OAuth callback returns to server and completes authentication
  3. Tokens are stored server-side with encryption
  4. Google, Slack, and Microsoft OAuth providers all work
  5. Expired tokens refresh automatically without user intervention
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md - OAuth infrastructure (cookie plugin, state manager, TypeBox schemas)
- [x] 05-02-PLAN.md - Google, Slack, Microsoft OAuth routes with token storage

### Phase 6: Frontend Adaptation
**Goal**: React application works identically to Electron version using HTTP/WebSocket transport
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: FRNT-01, FRNT-02, FRNT-03, FRNT-04, FRNT-05, FRNT-06
**Success Criteria** (what must be TRUE):
  1. All Electron IPC calls replaced with HTTP client adapter
  2. WebSocket manager subscribes to and routes server events to components
  3. Loading states appear during async operations (no sync IPC assumptions)
  4. Network errors display gracefully via error boundaries
  5. All 148 React components render and function identically to Electron app
**Plans**: TBD

Plans:
- [ ] 06-01: HTTP client adapter and WebSocket manager
- [ ] 06-02: Loading states, error boundaries, and component verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6
(Phases 4 and 5 can execute in parallel after Phase 2)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server Foundation | 2/2 | Complete | 2026-01-27 |
| 2. Core API | 2/2 | Complete | 2026-01-28 |
| 3. Real-time Events | 0/2 | Not started | - |
| 4. File Handling | 2/2 | Complete | 2026-01-28 |
| 5. OAuth Integration | 2/2 | Complete | 2026-01-28 |
| 6. Frontend Adaptation | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-27*
*Milestone: v1.0 Web Foundation*

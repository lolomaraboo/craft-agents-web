# Craft Agents Web

## What This Is

A self-hosted web application that provides browser-based access to Craft Agents. Transforms the existing Electron desktop app into a Node.js server (Express/Fastify) with a React frontend, enabling access from any browser without needing VNC or a desktop environment. Single-user deployment for local use on trusted networks.

## Core Value

Users can interact with Claude agents from any browser, maintaining full feature parity with the desktop app including real-time streaming, MCP server support, and OAuth integrations.

## Requirements

### Validated

<!-- Existing capabilities from Electron app that must be preserved -->

- ✓ Real-time streaming of agent responses — existing
- ✓ Session persistence in JSONL format — existing
- ✓ Multi-workspace support with isolated sessions — existing
- ✓ MCP server connections (stdio and HTTP transports) — existing
- ✓ Permission modes (safe/ask/allow-all) per session — existing
- ✓ Encrypted credential storage (AES-256-GCM) — existing
- ✓ OAuth flows for Google, Slack, Microsoft — existing
- ✓ Theme system with workspace overrides — existing
- ✓ Session recovery and resumption — existing
- ✓ File attachments in messages — existing
- ✓ Custom skills per workspace — existing

### Active

<!-- New requirements for web transformation -->

- [ ] Express/Fastify HTTP server replacing Electron main process
- [ ] WebSocket server for real-time event streaming
- [ ] HTTP API endpoints for all IPC operations
- [ ] React frontend adapted from renderer (fetch/WebSocket instead of IPC)
- [ ] File upload API for attachments (browser → server)
- [ ] Server-side session management without Electron window context
- [ ] OAuth callback handling in web context
- [ ] Static file serving for React app
- [ ] Development server with hot reload

### Out of Scope

- Multi-user/multi-tenant support — single user deployment only
- User authentication — trusted localhost network
- Viewer app — focus on main app, port later
- Auto-update mechanism — not applicable for web
- System notifications — browser has its own
- Global keyboard shortcuts — browser limitation
- Electron-specific window management — browser tabs instead

## Context

**Existing Architecture:**
- Monorepo with `packages/` (core, shared, ui) and `apps/` (electron, viewer)
- `packages/shared` contains most business logic (CraftAgent, sessions, credentials, MCP)
- Electron main process in `apps/electron/src/main/` handles IPC, sessions, file I/O
- React renderer in `apps/electron/src/renderer/` with Jotai state management
- IPC channels defined in `apps/electron/src/shared/types.ts`

**Key Transformations:**
1. `SessionManager` (main process) → HTTP/WebSocket server
2. `ipcMain.handle()` → Express routes
3. `ipcRenderer.invoke()` → fetch() calls
4. `ipcRenderer.on()` → WebSocket event listeners
5. `window.electron` preload API → HTTP client module

**Reusable Code:**
- `packages/shared/` — almost entirely reusable (agent, auth, config, credentials, MCP, sessions)
- `packages/ui/` — fully reusable (React components)
- `packages/core/` — fully reusable (types, utilities)
- `apps/electron/src/renderer/` — mostly reusable (components, atoms, hooks) with IPC→HTTP adapter

## Constraints

- **Runtime**: Node.js 22.x with Bun for package management
- **Framework**: Express or Fastify for HTTP server (TBD during planning)
- **Real-time**: WebSockets for bidirectional streaming
- **Storage**: Keep existing file-based storage in `~/.craft-agent/`
- **Compatibility**: Must support same config/session format as Electron app
- **Development**: Vite for frontend, esbuild for server (if needed)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebSockets over SSE | Need bidirectional communication for permission requests, abort signals | — Pending |
| Keep file-based storage | Avoid database dependency, maintain config compatibility with Electron | — Pending |
| Single app directory | Create `apps/web/` alongside `apps/electron/` | — Pending |
| Adapter pattern for IPC | Minimize changes to renderer code, swap IPC→HTTP at boundary | — Pending |

---
*Last updated: 2026-01-27 after initialization*

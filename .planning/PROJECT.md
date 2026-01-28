# Craft Agents Web

## What This Is

A self-hosted web application that provides browser-based access to Craft Agents. Transforms the existing Electron desktop app into a Node.js server (Express/Fastify) with a React frontend, enabling access from any browser without needing VNC or a desktop environment. Single-user deployment for local use on trusted networks.

## Core Value

Users can interact with Claude agents from any browser, maintaining **100% feature parity** with the desktop app. The web interface must be **identical** to the Electron app - same layout, same components, same UX.

**Key principle:** Reuse the entire React renderer (148 components) - only change the IPC→HTTP transport layer.

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

<!-- v1.0 Web Foundation (shipped 2026-01-28) -->

- ✓ Fastify HTTP server replacing Electron main process — v1.0
- ✓ WebSocket server for real-time event streaming — v1.0
- ✓ HTTP API endpoints for all IPC operations — v1.0 (25+ endpoints)
- ✓ React frontend adapted from renderer (fetch/WebSocket instead of IPC) — v1.0 (infrastructure)
- ✓ File upload API for attachments (browser → server) — v1.0
- ✓ Server-side session management without Electron window context — v1.0
- ✓ OAuth callback handling in web context — v1.0 (Google, Slack, Microsoft)
- ✓ Static file serving for React app — v1.0
- ✓ Development server with hot reload — v1.0

### Active

<!-- Next milestone requirements -->

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

## Current Milestone: v1.0 Web Foundation

**Goal:** Transform Electron main process into Node.js web server while preserving 100% feature parity.

**Target features:**
- Fastify HTTP server replacing Electron main process
- WebSocket server for real-time event streaming
- HTTP API endpoints for all IPC operations
- React frontend adapted with fetch/WebSocket instead of IPC
- File upload API for browser attachments
- Server-side session management
- OAuth callback handling in web context
- Static file serving and dev server

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebSockets over SSE | Need bidirectional communication for permission requests, abort signals | ✓ Good - Permission flow and reconnection working well |
| Keep file-based storage | Avoid database dependency, maintain config compatibility with Electron | ✓ Good - Maintains compatibility, cleanup scheduler works |
| Single app directory | Create `apps/web/` alongside `apps/electron/` | ✓ Good - Clean separation, monorepo structure preserved |
| Adapter pattern for IPC | Minimize changes to renderer code, swap IPC→HTTP at boundary | ✓ Good - HttpAdapter provides drop-in replacement |
| Fastify over Express | 2-3x faster for JSON-heavy streaming, TypeScript-first | ✓ Good - Plugin system and TypeBox integration excellent |
| @fastify/websocket | Fastify-native WebSocket integration | ✓ Good - Seamless integration with server lifecycle |
| TypeBox for validation | Better Fastify integration than Zod | ✓ Good - Runtime validation with type inference |
| Magic number file validation | Prevents MIME type spoofing | ✓ Good - Security improvement over extension checks |
| PKCE for OAuth | Secure OAuth without client_secret | ✓ Good - Google and Microsoft flows working |
| 50ms delta batching | Balance latency and message overhead | ✓ Good - Reduces WebSocket traffic during streaming |

---
*Last updated: 2026-01-28 after v1.0 milestone completion*

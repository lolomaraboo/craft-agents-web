# Architecture: Electron to Web

**Research Date:** 2026-01-27
**Confidence:** HIGH

## Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│              Browser Frontend                        │
│  React App (from renderer/) + HTTP/WS Adapter       │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP POST + WebSocket
┌─────────────────────▼───────────────────────────────┐
│              Node.js Server                          │
│  ┌─────────────────────────────────────────────┐   │
│  │  HTTP API (Fastify)                          │   │
│  │  - REST routes (replaces ipcMain.handle)    │   │
│  │  - File upload, OAuth callback              │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  WebSocket Server (ws)                       │   │
│  │  - Event streaming (replaces ipcRenderer.on)│   │
│  │  - Bidirectional: abort, permission         │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  SessionManager (adapted from Electron)      │   │
│  │  - CraftAgent instances per session         │   │
│  │  - Event forwarding to WebSocket            │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Shared (packages/shared/) - NO CHANGES     │   │
│  │  - CraftAgent, credentials, MCP, sessions   │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Data Flow: User Sends Message

1. User types → Component calls httpClient.sendMessage()
2. HTTP POST /api/sessions/:id/messages
3. Server → sessionManager.sendMessage()
4. CraftAgent → Claude API → events stream
5. SessionManager → WebSocket broadcast
6. Browser EventProcessor → Jotai atoms → UI renders

## Key Patterns

### Pattern 1: HTTP Client Adapter

Replace `window.electronAPI` with fetch/WebSocket:

```typescript
export const httpClient = {
  async getSessions() {
    return fetch('/api/sessions').then(r => r.json())
  },
  onSessionEvent(callback) {
    ws.on('session_event', callback)
  }
}
```

### Pattern 2: WebSocket Manager

Single connection per tab with reconnection:

```typescript
class WebSocketManager {
  connect() {
    this.ws = new WebSocket(`ws://${location.host}/ws`)
    this.ws.onclose = () => this.reconnect()
  }
}
```

### Pattern 3: SessionManager Adaptation

Replace IPC broadcast with WebSocket:

```typescript
broadcastEvent(event) {
  this.wsClients.forEach(ws => ws.send(JSON.stringify(event)))
}
```

## Code Reuse Strategy

| Code | Reuse |
|------|-------|
| packages/shared/ | 100% (no changes) |
| packages/ui/ | 100% (no changes) |
| packages/core/ | 100% (no changes) |
| renderer/components/ | 90% (swap IPC for HTTP) |
| renderer/atoms/ | 90% (swap IPC for WS) |
| main/sessions.ts | 70% (adapt IPC→WS) |
| WindowManager | 0% (not needed) |

## Build Order

1. **Phase 1:** HTTP server + WebSocket + SessionManager
2. **Phase 2:** Core API routes (sessions CRUD)
3. **Phase 3:** Real-time event streaming
4. **Phase 4:** File operations
5. **Phase 5:** OAuth callbacks
6. **Phase 6:** Remaining features

---
*Architecture research: 2026-01-27*

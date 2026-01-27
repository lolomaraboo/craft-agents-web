# Pitfalls: Electron to Web Migration

**Research Date:** 2026-01-27
**Confidence:** HIGH

## Critical Pitfalls

### 1. Synchronous IPC Assumptions in UI

**What goes wrong:** Electron IPC feels synchronous. HTTP is async. UI shows stale data.

**Prevention:**
- Add loading states to ALL components before migration
- Implement request caching layer
- Use optimistic updates where appropriate

**Phase:** 1-2 (API Foundation)

### 2. Node.js APIs in Renderer Code

**What goes wrong:** Renderer imports `fs`, `path`, `crypto` - browser doesn't have these.

**Prevention:**
```bash
# Audit Node.js usage
grep -r "require('fs')" apps/electron/src/renderer/
grep -r "from 'path'" apps/electron/src/renderer/
```

**Phase:** 0 (Pre-migration audit)

### 3. File System Access Patterns

**What goes wrong:** Electron has full fs access. Browser can only upload/download.

**Prevention:**
- Server maintains all file operations
- Browser uses File Upload API → POST to server
- Downloads via blob URLs

**Phase:** 3-4 (File Operations)

### 4. WebSocket Connection Management

**What goes wrong:** No reconnection logic. Lost messages. Multiple tabs conflict.

**Prevention:**
- Use robust WebSocket library (Socket.IO or ws + reconnecting-websocket)
- Implement connection state machine
- Message acknowledgment for critical operations
- Handle mid-stream disconnections

**Phase:** 2 (WebSocket Streaming)

### 5. OAuth Flow Assumptions

**What goes wrong:** Electron uses deep links or localhost:3456 callback. Web needs different approach.

**Prevention:**
- Configurable callback URL via environment
- PKCE for localhost (no client secret)
- State parameter validation

**Phase:** 5 (OAuth Integration)

## Moderate Pitfalls

### 6. Window Management in Shared Code

**What goes wrong:** Shared code calls `new BrowserWindow()` - doesn't exist in web.

**Prevention:** Abstract behind interface, move to app layer.

### 7. MCP Subprocess Management

**What goes wrong:** Orphaned processes after disconnect, no crash recovery.

**Prevention:**
- Design process lifecycle upfront
- Implement process registry with cleanup
- Add health checks

### 8. Encryption Key Management

**What goes wrong:** Electron uses OS keychain. Web needs different approach.

**Prevention:**
- Use environment variable for master key
- Document security model clearly

### 9. Synchronous Config Access

**What goes wrong:** `fs.readFileSync()` blocks event loop.

**Prevention:** Async config loading at startup, watch for changes.

### 10. Error Boundary Differences

**What goes wrong:** IPC errors vs HTTP errors (network/4xx/5xx) need different handling.

**Prevention:**
```typescript
type APIError =
  | { type: 'network', retryable: true }
  | { type: 'client', status: 400-499 }
  | { type: 'server', status: 500-599, retryable: true }
```

### 11. Development Workflow Complexity

**What goes wrong:** Electron is one command. Web needs server + client.

**Prevention:**
- Use Vite proxy for API requests
- Single `npm run dev` command with concurrently
- Aggregate logs with prefixes

## Minor Pitfalls

### 12. Browser API Differences
Clipboard, notifications require different APIs.

### 13. Build Size Increase
Check bundle size, use tree-shaking.

### 14. Storage Location Confusion
Server-side for persistence, localStorage for UI state only.

### 15. Testing Strategy
Use Playwright for both E2E, Vitest for API tests.

## Phase Mapping

| Phase | Pitfalls to Address |
|-------|---------------------|
| Phase 0 | 2 (Node.js audit) |
| Phase 1 | 1 (async patterns), 11 (dev workflow) |
| Phase 2 | 4 (WebSocket management) |
| Phase 3-4 | 3 (file access), 7 (MCP processes) |
| Phase 5 | 5 (OAuth), 8 (encryption) |
| Phase 6 | 10 (error handling), 9 (config) |

---
*Pitfalls research: 2026-01-27*

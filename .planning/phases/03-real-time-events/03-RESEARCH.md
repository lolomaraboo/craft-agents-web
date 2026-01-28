# Phase 3: Real-time Events - Research

**Researched:** 2026-01-28
**Domain:** WebSocket event broadcasting and session-scoped filtering for real-time agent interactions
**Confidence:** HIGH

## Summary

This phase transforms the Fastify web server from a stub REST API into a real-time event streaming system that replicates Electron's IPC event model. The standard approach involves wiring the existing WebSocket endpoint to receive AgentEvent streams from @craft-agent/shared's CraftAgent, filter events by session scope, and broadcast them to connected clients.

The research confirms that the infrastructure from Phases 1-2 provides the correct foundation:
1. WebSocket endpoint already exists at `/ws` with connection management
2. SessionManager stubs define the interface but need real @craft-agent/shared wiring
3. Fastify's broadcast pattern can be adapted for session-scoped filtering
4. The existing Electron implementation provides a proven event flow pattern to replicate

The key technical challenge is bridging the SDK's async iterator event stream into WebSocket broadcasts while maintaining session context for filtering and handling permission request/response flows bidirectionally.

**Primary recommendation:** Wire SessionManager.sendMessage to CraftAgent.chat(), consume the AgentEvent async iterator, transform events to SessionEvent format, and broadcast via WebSocket to session-scoped clients with connection tracking and reconnection support.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/websocket | 11.x | WebSocket server | Already installed, provides connection lifecycle hooks |
| ws | 8.x | WebSocket protocol | Underlying library used by @fastify/websocket |
| @craft-agent/shared | workspace:* | Agent SDK wrapper | Provides CraftAgent with event streaming |
| @sinclair/typebox | 0.34.x | Runtime validation | Already used for REST API, can validate WS messages |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Map<string, Set<WebSocket>> | native | Session-scoped client tracking | Track which clients are listening to which sessions |
| setTimeout batching | native | Delta aggregation | Batch text_delta events to reduce IPC overhead (50ms intervals) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Session-scoped Map | Global broadcast Set | Would work but can't filter by session, broadcasts to all clients |
| Manual event transforms | Shared event types | Easier but requires maintaining type compatibility |
| TypeBox validation | No validation | Faster but loses runtime safety on client messages |

**Installation:**
```bash
# No new dependencies needed - all already installed in Phases 1-2
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/server/
├── plugins/
│   └── websocket.ts         # WebSocket setup (Phase 1)
├── routes/
│   └── api/
│       ├── sessions.ts      # Session REST endpoints (Phase 2)
│       └── index.ts         # Route registration
├── lib/
│   ├── session-manager.ts   # CraftAgent wrapper (wire in Phase 3)
│   └── websocket-events.ts  # Session event broadcasting (NEW)
└── schemas/
    ├── session.ts           # TypeBox schemas
    └── websocket.ts         # WS message schemas (NEW)
```

### Pattern 1: Session-Scoped Connection Tracking
**What:** Track WebSocket clients per session for filtered broadcasting
**When to use:** Always for session events - only clients listening to a session should receive its events
**Example:**
```typescript
// Source: Fastify WebSocket patterns + project requirements
import type { WebSocket } from 'ws'

// Map session IDs to Sets of connected clients
const sessionClients = new Map<string, Set<WebSocket>>()

// Add client to session
function subscribeToSession(sessionId: string, socket: WebSocket): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set())
  }
  sessionClients.get(sessionId)!.add(socket)
}

// Remove client from session
function unsubscribeFromSession(sessionId: string, socket: WebSocket): void {
  const clients = sessionClients.get(sessionId)
  if (clients) {
    clients.delete(socket)
    if (clients.size === 0) {
      sessionClients.delete(sessionId)
    }
  }
}

// Broadcast to session-scoped clients only
function broadcastToSession(sessionId: string, event: SessionEvent): void {
  const clients = sessionClients.get(sessionId)
  if (!clients) return

  const message = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message)
    }
  }
}
```

### Pattern 2: AgentEvent to SessionEvent Transformation
**What:** Consume CraftAgent's async iterator and transform to SessionEvent format
**When to use:** Every time SessionManager.sendMessage is called
**Example:**
```typescript
// Source: apps/electron/src/main/sessions.ts pattern (lines 2579-2650)
import type { AgentEvent } from '@craft-agent/shared/agent'
import type { SessionEvent } from '../schemas/websocket.js'

async function processAgentEvents(
  sessionId: string,
  agent: CraftAgent,
  message: string,
  attachments?: FileAttachment[]
): Promise<void> {
  const chatIterator = agent.chat(message, attachments)

  for await (const event of chatIterator) {
    // Transform AgentEvent to SessionEvent
    const sessionEvent = transformEvent(sessionId, event)

    // Broadcast to clients listening to this session
    broadcastToSession(sessionId, sessionEvent)

    // Handle complete event - SDK always sends this last
    if (event.type === 'complete') {
      break
    }
  }
}

function transformEvent(sessionId: string, event: AgentEvent): SessionEvent {
  switch (event.type) {
    case 'text_delta':
      return { type: 'text_delta', sessionId, delta: event.text, turnId: event.turnId }
    case 'text_complete':
      return { type: 'text_complete', sessionId, text: event.text, isIntermediate: event.isIntermediate, turnId: event.turnId }
    case 'tool_start':
      return { type: 'tool_start', sessionId, toolName: event.toolName, toolUseId: event.toolUseId, toolInput: event.input, turnId: event.turnId }
    case 'tool_result':
      return { type: 'tool_result', sessionId, toolUseId: event.toolUseId, toolName: event.toolName || 'unknown', result: event.result, turnId: event.turnId, isError: event.isError }
    case 'complete':
      return { type: 'complete', sessionId }
    // ... handle all event types
  }
}
```

### Pattern 3: Delta Batching for Performance
**What:** Aggregate text_delta events before sending to reduce WebSocket message overhead
**When to use:** Always for text streaming - prevents 50+ messages per second
**Example:**
```typescript
// Source: apps/electron/src/main/sessions.ts (lines 3725-3760)
const DELTA_BATCH_INTERVAL_MS = 50

const pendingDeltas = new Map<string, { delta: string; turnId?: string }>()
const deltaFlushTimers = new Map<string, NodeJS.Timeout>()

function queueDelta(sessionId: string, delta: string, turnId?: string): void {
  const existing = pendingDeltas.get(sessionId)
  if (existing) {
    // Append to existing batch
    existing.delta += delta
    if (turnId) existing.turnId = turnId
  } else {
    // Start new batch
    pendingDeltas.set(sessionId, { delta, turnId })
  }

  // Schedule flush if not already scheduled
  if (!deltaFlushTimers.has(sessionId)) {
    const timer = setTimeout(() => {
      flushDelta(sessionId)
    }, DELTA_BATCH_INTERVAL_MS)
    deltaFlushTimers.set(sessionId, timer)
  }
}

function flushDelta(sessionId: string): void {
  const batch = pendingDeltas.get(sessionId)
  if (!batch) return

  broadcastToSession(sessionId, {
    type: 'text_delta',
    sessionId,
    delta: batch.delta,
    turnId: batch.turnId
  })

  pendingDeltas.delete(sessionId)
  const timer = deltaFlushTimers.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    deltaFlushTimers.delete(sessionId)
  }
}
```

### Pattern 4: Permission Request/Response Flow
**What:** Handle bidirectional permission requests via WebSocket
**When to use:** When agent requests permission for bash commands or other operations
**Example:**
```typescript
// Source: apps/electron/src/main/sessions.ts + preload patterns
import type { PermissionRequest } from '@craft-agent/core/types'

// Server-side: Agent requests permission
function handlePermissionRequest(sessionId: string, request: PermissionRequest): void {
  broadcastToSession(sessionId, {
    type: 'permission_request',
    sessionId,
    request
  })
}

// Server-side: Receive permission response from client
socket.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString())

    if (message.type === 'permission_response') {
      const { requestId, allowed, alwaysAllow } = message
      // Resolve the pending permission via CraftAgent callback
      agent.respondToPermission(requestId, allowed, alwaysAllow)
    }
  } catch (err) {
    fastify.log.warn({ err }, 'Invalid WebSocket message')
  }
})
```

### Pattern 5: Client-Side Reconnection with Session Context
**What:** Automatically reconnect WebSocket and restore session subscriptions
**When to use:** Always - development restarts and network issues require reconnection
**Example:**
```typescript
// Source: WebSocket reconnection best practices (Apidog, AWS, RingCentral)
class SessionWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
    this.connect()
  }

  private connect(): void {
    this.ws = new WebSocket(`ws://localhost:3000/ws`)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
      this.reconnectAttempts = 0
      // Subscribe to session events
      this.ws?.send(JSON.stringify({ type: 'subscribe', sessionId: this.sessionId }))
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected')
      this.attemptReconnect()
    }

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err)
      this.ws?.close()
    }

    this.ws.onmessage = (event) => {
      const sessionEvent = JSON.parse(event.data)
      this.handleSessionEvent(sessionEvent)
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff

    console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    setTimeout(() => this.connect(), delay)
  }

  private handleSessionEvent(event: SessionEvent): void {
    // Dispatch to React state or event handlers
    window.dispatchEvent(new CustomEvent('session-event', { detail: event }))
  }

  public close(): void {
    this.reconnectAttempts = this.maxReconnectAttempts // Prevent reconnection
    this.ws?.close()
  }
}
```

### Pattern 6: Config Change Notifications
**What:** Broadcast config changes when server detects file updates
**When to use:** When @craft-agent/shared's ConfigWatcher detects changes
**Example:**
```typescript
// Source: @craft-agent/shared/config/watcher.ts patterns
import { createConfigWatcher, type ConfigWatcherCallbacks } from '@craft-agent/shared/config'

// Set up config watcher
const callbacks: ConfigWatcherCallbacks = {
  onConfigChange: (config) => {
    // Broadcast to all clients (not session-scoped)
    broadcastGlobal({ type: 'config_changed', config })
  },
  onThemeChange: (theme) => {
    broadcastGlobal({ type: 'theme_changed', theme })
  }
}

const watcher = createConfigWatcher(callbacks)
await watcher.start()
```

### Anti-Patterns to Avoid
- **Broadcasting to all clients regardless of session:** Violates session isolation, exposes data across workspaces
- **Not flushing deltas on text_complete:** Can cause client to miss final text chunk
- **Synchronous event processing:** Blocks agent iteration, degrades streaming performance
- **Not cleaning up timers on disconnect:** Memory leaks from orphaned setTimeout intervals
- **Dropping events during reconnection:** Client loses critical state updates

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket reconnection | Custom retry logic | Exponential backoff pattern | Well-tested algorithm prevents server overload |
| Event type definitions | Separate client/server types | Shared SessionEvent types from @craft-agent/core | Single source of truth, type safety across boundary |
| Permission state tracking | Custom Map<requestId, Promise> | CraftAgent built-in permission callbacks | SDK handles resolution, cancellation, and timeouts |
| Session persistence | Custom file writes in broadcast | @craft-agent/shared sessionPersistenceQueue | Debounced writes (500ms), prevents disk thrashing |
| Config file watching | Custom fs.watch | @craft-agent/shared ConfigWatcher | Handles debouncing, cross-platform compatibility, JSON validation |

**Key insight:** The @craft-agent/shared package already implements session management, config watching, and permission flows. Phase 3's job is wiring these to WebSocket broadcasts, not reimplementing them. The Electron app's sessions.ts provides the proven event transformation pattern.

## Common Pitfalls

### Pitfall 1: Missing Session Cleanup on WebSocket Close
**What goes wrong:** Disconnected clients remain in session tracking Map, memory leaks over time
**Why it happens:** Only removing from global clients Set, not from session-scoped Map
**How to avoid:** Always call unsubscribeFromSession in both 'close' and 'error' handlers
**Warning signs:** sessionClients Map grows unbounded, memory usage increases
```typescript
// WRONG - only removes from global Set
socket.on('close', () => {
  clients.delete(socket)
})

// CORRECT - removes from both global and session-scoped tracking
socket.on('close', () => {
  clients.delete(socket)
  // Remove from ALL sessions this socket was subscribed to
  for (const [sessionId, sessionSet] of sessionClients) {
    sessionSet.delete(socket)
    if (sessionSet.size === 0) {
      sessionClients.delete(sessionId)
    }
  }
})
```

### Pitfall 2: Broadcasting Before Client Subscribes
**What goes wrong:** Client connects but misses initial events because subscription isn't registered yet
**Why it happens:** Race condition between client connection and subscription message
**How to avoid:** Send connection acknowledgment only AFTER processing subscription message
**Warning signs:** Client doesn't receive first few events, especially text_delta

### Pitfall 3: Not Handling Agent Async Errors
**What goes wrong:** Unhandled promise rejection crashes server when agent.chat() fails
**Why it happens:** CraftAgent.chat() returns async iterator that can throw
**How to avoid:** Wrap for-await loop in try-catch, send error event to client
**Warning signs:** Server crashes on API failures, clients stuck in processing state
```typescript
// CORRECT - wrap in try-catch
try {
  for await (const event of chatIterator) {
    processEvent(sessionId, event)
  }
} catch (error) {
  fastify.log.error({ error, sessionId }, 'Agent error')
  broadcastToSession(sessionId, {
    type: 'error',
    sessionId,
    error: error instanceof Error ? error.message : 'Unknown error'
  })
  broadcastToSession(sessionId, { type: 'complete', sessionId })
}
```

### Pitfall 4: Delta Batching Without Flush on Complete
**What goes wrong:** Final text chunk never reaches client, appears truncated
**Why it happens:** text_complete arrives before 50ms batch timer fires
**How to avoid:** Always flush pending deltas in text_complete handler
**Warning signs:** Streaming text ends abruptly, missing last sentence

### Pitfall 5: Session Context Lost on Reconnect
**What goes wrong:** Client reconnects but doesn't receive ongoing agent events
**Why it happens:** New WebSocket instance not added to session tracking Map
**How to avoid:** Client sends subscribe message with sessionId after reconnecting
**Warning signs:** Reconnection successful but no events, client appears frozen

### Pitfall 6: Permission Timeout Not Handled
**What goes wrong:** Agent waits forever if client disconnects during permission request
**Why it happens:** CraftAgent doesn't auto-timeout permission requests
**How to avoid:** Set timeout on permission handler, auto-deny after 60s
**Warning signs:** Agent stuck in processing state after client disconnect

## Code Examples

### Complete WebSocket Event System
```typescript
// Source: Verified patterns from Phase 1 research + Electron sessions.ts
import type { WebSocket } from 'ws'
import type { FastifyInstance } from 'fastify'
import type { CraftAgent } from '@craft-agent/shared/agent'
import type { SessionEvent } from '../schemas/websocket.js'

// Session-scoped client tracking
const sessionClients = new Map<string, Set<WebSocket>>()

// Track which sessions each socket is subscribed to (for cleanup)
const socketSessions = new WeakMap<WebSocket, Set<string>>()

// Delta batching
const DELTA_BATCH_INTERVAL_MS = 50
const pendingDeltas = new Map<string, { delta: string; turnId?: string }>()
const deltaFlushTimers = new Map<string, NodeJS.Timeout>()

export function setupWebSocketEvents(fastify: FastifyInstance): void {
  // Session subscription
  function subscribe(sessionId: string, socket: WebSocket): void {
    // Add to session clients
    if (!sessionClients.has(sessionId)) {
      sessionClients.set(sessionId, new Set())
    }
    sessionClients.get(sessionId)!.add(socket)

    // Track for cleanup
    let sessions = socketSessions.get(socket)
    if (!sessions) {
      sessions = new Set()
      socketSessions.set(socket, sessions)
    }
    sessions.add(sessionId)

    fastify.log.info({ sessionId }, 'Client subscribed to session')
  }

  // Session unsubscription
  function unsubscribe(sessionId: string, socket: WebSocket): void {
    const clients = sessionClients.get(sessionId)
    if (clients) {
      clients.delete(socket)
      if (clients.size === 0) {
        sessionClients.delete(sessionId)
      }
    }

    const sessions = socketSessions.get(socket)
    if (sessions) {
      sessions.delete(sessionId)
    }

    fastify.log.info({ sessionId }, 'Client unsubscribed from session')
  }

  // Cleanup on disconnect
  function cleanupSocket(socket: WebSocket): void {
    const sessions = socketSessions.get(socket)
    if (sessions) {
      for (const sessionId of sessions) {
        unsubscribe(sessionId, socket)
      }
    }
  }

  // Broadcast to session
  function broadcastToSession(sessionId: string, event: SessionEvent): void {
    const clients = sessionClients.get(sessionId)
    if (!clients || clients.size === 0) {
      fastify.log.debug({ sessionId, eventType: event.type }, 'No clients for session event')
      return
    }

    const message = JSON.stringify(event)
    for (const client of clients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message)
        } catch (err) {
          fastify.log.warn({ err, sessionId }, 'Failed to send to client')
        }
      }
    }
  }

  // Delta batching
  function queueDelta(sessionId: string, delta: string, turnId?: string): void {
    const existing = pendingDeltas.get(sessionId)
    if (existing) {
      existing.delta += delta
      if (turnId) existing.turnId = turnId
    } else {
      pendingDeltas.set(sessionId, { delta, turnId })
    }

    if (!deltaFlushTimers.has(sessionId)) {
      const timer = setTimeout(() => flushDelta(sessionId), DELTA_BATCH_INTERVAL_MS)
      deltaFlushTimers.set(sessionId, timer)
    }
  }

  function flushDelta(sessionId: string): void {
    const batch = pendingDeltas.get(sessionId)
    if (!batch) return

    broadcastToSession(sessionId, {
      type: 'text_delta',
      sessionId,
      delta: batch.delta,
      turnId: batch.turnId
    })

    pendingDeltas.delete(sessionId)
    const timer = deltaFlushTimers.get(sessionId)
    if (timer) {
      clearTimeout(timer)
      deltaFlushTimers.delete(sessionId)
    }
  }

  // Decorate Fastify instance with broadcast functions
  fastify.decorate('broadcastToSession', broadcastToSession)
  fastify.decorate('queueDelta', queueDelta)
  fastify.decorate('flushDelta', flushDelta)
  fastify.decorate('subscribeToSession', subscribe)
  fastify.decorate('unsubscribeFromSession', unsubscribe)

  // WebSocket message handler
  fastify.addHook('onReady', () => {
    fastify.log.info('WebSocket event system initialized')
  })
}

// Type augmentation
declare module 'fastify' {
  interface FastifyInstance {
    broadcastToSession: (sessionId: string, event: SessionEvent) => void
    queueDelta: (sessionId: string, delta: string, turnId?: string) => void
    flushDelta: (sessionId: string) => void
    subscribeToSession: (sessionId: string, socket: WebSocket) => void
    unsubscribeFromSession: (sessionId: string, socket: WebSocket) => void
  }
}
```

### SessionManager Integration with CraftAgent
```typescript
// Source: apps/electron/src/main/sessions.ts pattern
import { CraftAgent, type AgentEvent } from '@craft-agent/shared/agent'
import type { FileAttachment } from '@craft-agent/shared/utils/files'

export class SessionManager {
  private agents = new Map<string, CraftAgent>()
  private fastify: FastifyInstance

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
  }

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: unknown[],
    options?: unknown
  ): Promise<void> {
    const agent = await this.getOrCreateAgent(sessionId)

    try {
      const chatIterator = agent.chat(message, attachments)

      for await (const event of chatIterator) {
        this.processAgentEvent(sessionId, event)

        if (event.type === 'complete') {
          break
        }
      }
    } catch (error) {
      this.fastify.log.error({ error, sessionId }, 'Agent error')
      this.fastify.broadcastToSession(sessionId, {
        type: 'error',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      this.fastify.broadcastToSession(sessionId, { type: 'complete', sessionId })
    }
  }

  private processAgentEvent(sessionId: string, event: AgentEvent): void {
    switch (event.type) {
      case 'text_delta':
        this.fastify.queueDelta(sessionId, event.text, event.turnId)
        break

      case 'text_complete':
        this.fastify.flushDelta(sessionId) // Flush before sending complete
        this.fastify.broadcastToSession(sessionId, {
          type: 'text_complete',
          sessionId,
          text: event.text,
          isIntermediate: event.isIntermediate,
          turnId: event.turnId
        })
        break

      case 'tool_start':
        this.fastify.broadcastToSession(sessionId, {
          type: 'tool_start',
          sessionId,
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input,
          toolIntent: event.intent,
          toolDisplayName: event.displayName,
          turnId: event.turnId
        })
        break

      case 'tool_result':
        this.fastify.broadcastToSession(sessionId, {
          type: 'tool_result',
          sessionId,
          toolUseId: event.toolUseId,
          toolName: event.toolName || 'unknown',
          result: event.result,
          turnId: event.turnId,
          isError: event.isError
        })
        break

      case 'complete':
        this.fastify.broadcastToSession(sessionId, {
          type: 'complete',
          sessionId
        })
        break

      // ... handle other event types
    }
  }

  private async getOrCreateAgent(sessionId: string): Promise<CraftAgent> {
    let agent = this.agents.get(sessionId)
    if (!agent) {
      agent = new CraftAgent({
        workspace: { id: 'default', rootPath: process.cwd() },
        model: 'claude-sonnet-4-5-20250929',
        session: { id: sessionId }
      })
      this.agents.set(sessionId, agent)
    }
    return agent
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for updates | WebSocket streaming | 2015+ | Real-time UX, 95% reduction in HTTP overhead |
| Global broadcast | Session-scoped filtering | 2020+ | Multi-tenant isolation, privacy, reduced bandwidth |
| Manual reconnection | Exponential backoff | 2018+ | Better UX during network issues, less server load |
| Synchronous IPC | Async iterator streams | 2023+ (SDK) | Non-blocking, enables streaming, better error handling |

**Deprecated/outdated:**
- Socket.IO for simple WebSocket needs - ws library is faster and sufficient for this use case
- Long polling REST endpoints - WebSocket is standard for real-time in 2026
- Custom event serialization - JSON.stringify is fast enough for event streaming

## Open Questions

1. **Session Recovery After Server Restart**
   - What we know: Development restarts disconnect all clients
   - What's unclear: Should server persist "in-flight" agent operations to disk for recovery?
   - Recommendation: No - let clients re-send message after reconnect (simpler, stateless server)

2. **Multi-Window Session Sync**
   - What we know: Electron app syncs session state across multiple windows via IPC
   - What's unclear: Do we need to support multiple browser tabs viewing the same session?
   - Recommendation: Yes - WebSocket session-scoped broadcast naturally supports this

3. **Permission Request Timeout**
   - What we know: CraftAgent blocks waiting for permission response
   - What's unclear: What timeout is appropriate before auto-denying?
   - Recommendation: 60 seconds with visual countdown in client UI

4. **Config Change Granularity**
   - What we know: ConfigWatcher fires on any config file change
   - What's unclear: Should we broadcast specific changed fields or entire config?
   - Recommendation: Broadcast change notification type, let client re-fetch via REST (reduces message size)

## Sources

### Primary (HIGH confidence)
- Claude Agent SDK Documentation - [Quickstart](https://platform.claude.com/docs/en/agent-sdk/quickstart) - Event streaming patterns
- Claude Agent SDK Documentation - [Streaming Input](https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) - Async iterator usage
- apps/electron/src/main/sessions.ts - Proven AgentEvent processing pattern (lines 2579-3760)
- apps/electron/src/preload/index.ts - SessionEvent type definitions and IPC patterns (lines 50-59)
- @craft-agent/shared/agent/craft-agent.ts - CraftAgent API and event types
- @craft-agent/shared/config/watcher.ts - Config change notification patterns

### Secondary (MEDIUM confidence)
- [Fastify WebSocket Broadcasting Issue #42](https://github.com/fastify/fastify-websocket/issues/42) - Community patterns for session-scoped broadcasting
- [Getting Started with Fastify WebSockets](https://betterstack.com/community/guides/scaling-nodejs/fastify-websockets/) - Connection management best practices
- [Fastify WebSocket 2025 Guide](https://www.videosdk.live/developer-hub/websocket/fastify-websocket) - Session handling patterns
- [Jonathan's Blog: Accessing Fastify Sessions via tRPC Websockets](https://jonathan-frere.com/posts/trpc-fastify-websockets/) - WeakMap pattern for session context

### Tertiary (LOW confidence - used for patterns, not implementation details)
- [WebSocket Reconnect Strategies](https://apidog.com/blog/websocket-reconnect/) - Exponential backoff patterns
- [AWS: Managing Sessions in WebSocket API](https://aws.amazon.com/blogs/compute/managing-sessions-of-anonymous-users-in-websocket-api-based-applications/) - Session storage strategies
- [Ably: WebSocket Architecture Best Practices](https://ably.com/topic/websocket-architecture-best-practices) - Recovery mechanisms
- [RingCentral: Recovering a WebSocket Session](https://developers.ringcentral.com/guide/notifications/websockets/session-recovery) - Session recovery patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already installed in Phases 1-2, proven Electron implementation
- Architecture: HIGH - Direct replication of working Electron patterns
- Pitfalls: HIGH - Documented in Electron codebase and official WebSocket guides
- Code examples: HIGH - Derived from verified Electron implementation

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (stable ecosystem, reference implementation exists)

# Phase 6: Frontend Adaptation - Research

**Researched:** 2026-01-28
**Domain:** React frontend adaptation from Electron IPC to HTTP/WebSocket transport
**Confidence:** HIGH

## Summary

Phase 6 adapts the existing React frontend (148 components) from Electron's synchronous IPC communication to the HTTP/WebSocket transport layer established in Phases 1-5. The standard approach is the Adapter Pattern: creating a drop-in replacement for `window.electronAPI` that routes calls to HTTP endpoints and WebSocket events, minimizing changes to existing components.

This research confirms that:
1. The existing `ElectronAPI` interface (245 methods) provides a clear contract for the adapter
2. Prior decisions established HTTP APIs covering sessions, workspaces, config, theme, and OAuth
3. WebSocket infrastructure already handles session-scoped events with the same event types
4. The playground's `mock-utils.ts` demonstrates the pattern for injecting alternative implementations
5. Jotai state management is already async-aware; loading states can leverage existing patterns

The key challenges are:
- Converting synchronous IPC assumptions to async HTTP with loading states
- Managing WebSocket subscription lifecycle for component-scoped event handling
- Handling network errors gracefully where Electron IPC could not fail
- Ensuring theme system works via HTTP (no IPC for preset loading)

**Primary recommendation:** Create an HttpAdapter class implementing the ElectronAPI interface that routes to HTTP fetch calls and WebSocket subscriptions. Inject this adapter as `window.electronAPI` at app bootstrap. Add loading states to key async operations and wrap component trees with error boundaries for network failure handling.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-error-boundary | 5.x | Error handling | Modern functional component support, `onReset` for retry patterns |
| jotai `loadable` | 2.16+ | Async atom states | Already used, `loadable` provides `{state, data, error}` without Suspense |
| native fetch | - | HTTP client | No need for axios; fetch is sufficient for JSON APIs |
| native WebSocket | - | Event subscription | Already proven in Phase 3 client test |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | 5.x | (Optional) Data fetching | Only if caching/deduplication needed; not required initially |
| react-use-websocket | 4.x | (Optional) WebSocket hook | Consider if manual management proves complex |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom adapter | tRPC | tRPC excellent but requires backend changes; adapter leverages existing HTTP APIs |
| Manual fetch | axios | axios adds bundle size; fetch is sufficient for this use case |
| loadable atoms | Suspense | Suspense requires React 18/19 data fetching patterns; loadable more incremental |

**Installation:**
```bash
bun add react-error-boundary
# Optional if needed later:
# bun add @tanstack/react-query react-use-websocket
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/client/
├── main.tsx                    # Bootstrap, inject adapter
├── App.tsx                     # Root component (mirrors Electron)
├── adapters/
│   ├── http-adapter.ts         # ElectronAPI implementation via HTTP
│   ├── websocket-manager.ts    # WebSocket connection + event routing
│   └── index.ts                # Factory function (web vs electron)
├── hooks/
│   ├── useApiClient.ts         # Context hook for adapter access
│   └── useWebSocketEvent.ts    # Subscribe to WS events by session
├── components/
│   ├── ErrorBoundary.tsx       # Network error boundary wrapper
│   └── LoadingState.tsx        # Reusable loading indicator
└── ... (copy from electron/renderer with modifications)
```

### Pattern 1: Adapter Pattern for ElectronAPI Replacement

**What:** Create an adapter class that implements the same interface as `window.electronAPI` but uses HTTP/WebSocket
**When to use:** Always - this is the core migration strategy
**Example:**
```typescript
// Source: Project requirement + Electron preload/index.ts interface
// apps/web/src/client/adapters/http-adapter.ts

import type { ElectronAPI, Session, Workspace, SessionEvent } from '../types'
import { WebSocketManager } from './websocket-manager'

export class HttpAdapter implements Partial<ElectronAPI> {
  private ws: WebSocketManager
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    this.ws = new WebSocketManager()
  }

  // === Session Management ===

  async getSessions(): Promise<Session[]> {
    const res = await fetch(`${this.baseUrl}/api/sessions`)
    if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`)
    return res.json()
  }

  async getSessionMessages(sessionId: string): Promise<Session | null> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`)
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`)
    return res.json()
  }

  async createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, ...options })
    })
    if (!res.ok) throw new Error(`Failed to create session: ${res.status}`)
    return res.json()
  }

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, attachments, storedAttachments, options })
    })
    if (!res.ok) throw new Error(`Failed to send message: ${res.status}`)
    // Returns 202 Accepted - events come via WebSocket
  }

  // === Event Subscription ===

  onSessionEvent(callback: (event: SessionEvent) => void): () => void {
    return this.ws.subscribe(callback)
  }

  // === Theme (FRNT-06) ===

  async getColorTheme(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/theme/color`)
    if (!res.ok) throw new Error(`Failed to fetch theme: ${res.status}`)
    const data = await res.json()
    return data.themeId
  }

  async setColorTheme(themeId: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/theme/color`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId })
    })
    if (!res.ok) throw new Error(`Failed to set theme: ${res.status}`)
  }

  // ... implement remaining methods following same pattern
}
```

### Pattern 2: WebSocket Manager with Session Subscriptions

**What:** Centralized WebSocket connection that routes events to session-specific callbacks
**When to use:** For all real-time session events (FRNT-02)
**Example:**
```typescript
// Source: Phase 3 WebSocket schemas + react-use-websocket patterns
// apps/web/src/client/adapters/websocket-manager.ts

import type { SessionEvent, ClientMessage } from '../types'

type EventCallback = (event: SessionEvent) => void

export class WebSocketManager {
  private ws: WebSocket | null = null
  private callbacks = new Set<EventCallback>()
  private subscribedSessions = new Set<string>()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  connect(): void {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    this.ws.onopen = () => {
      console.log('[WebSocket] Connected')
      this.reconnectAttempts = 0
      // Re-subscribe to sessions after reconnect
      for (const sessionId of this.subscribedSessions) {
        this.sendMessage({ type: 'subscribe', sessionId })
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as SessionEvent
        for (const callback of this.callbacks) {
          callback(data)
        }
      } catch (err) {
        console.error('[WebSocket] Parse error:', err)
      }
    }

    this.ws.onclose = () => {
      console.log('[WebSocket] Disconnected')
      this.attemptReconnect()
    }

    this.ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err)
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
      setTimeout(() => this.connect(), delay)
    }
  }

  subscribe(callback: EventCallback): () => void {
    this.callbacks.add(callback)
    if (!this.ws) this.connect()
    return () => this.callbacks.delete(callback)
  }

  subscribeToSession(sessionId: string): void {
    this.subscribedSessions.add(sessionId)
    this.sendMessage({ type: 'subscribe', sessionId })
  }

  unsubscribeFromSession(sessionId: string): void {
    this.subscribedSessions.delete(sessionId)
    this.sendMessage({ type: 'unsubscribe', sessionId })
  }

  respondToPermission(requestId: string, allowed: boolean, alwaysAllow?: boolean): void {
    this.sendMessage({ type: 'permission_response', requestId, allowed, alwaysAllow })
  }

  private sendMessage(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  disconnect(): void {
    this.ws?.close()
    this.ws = null
  }
}
```

### Pattern 3: Error Boundary for Network Failures

**What:** Wrap component trees to catch and display network errors gracefully
**When to use:** At route boundaries and around critical data-fetching sections (FRNT-04)
**Example:**
```typescript
// Source: react-error-boundary library + best practices research
// apps/web/src/client/components/NetworkErrorBoundary.tsx

import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { ReactNode } from 'react'

function NetworkErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isNetworkError = error.message?.includes('fetch') ||
                         error.message?.includes('NetworkError') ||
                         error.message?.includes('Failed to')

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="text-destructive text-lg font-semibold mb-2">
        {isNetworkError ? 'Connection Error' : 'Something went wrong'}
      </div>
      <p className="text-muted-foreground mb-4">
        {isNetworkError
          ? 'Unable to connect to the server. Please check your connection.'
          : error.message}
      </p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
      >
        Try Again
      </button>
    </div>
  )
}

interface Props {
  children: ReactNode
  onReset?: () => void
}

export function NetworkErrorBoundary({ children, onReset }: Props) {
  return (
    <ErrorBoundary
      FallbackComponent={NetworkErrorFallback}
      onReset={onReset}
      onError={(error, info) => {
        console.error('[NetworkErrorBoundary]', error, info)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

### Pattern 4: Loading States for Async Operations

**What:** Show loading indicators during HTTP requests that were previously instant IPC
**When to use:** For any operation with perceptible latency (>100ms) (FRNT-03)
**Example:**
```typescript
// Source: Jotai loadable utility + existing atom patterns
// apps/web/src/client/atoms/async-sessions.ts

import { atom } from 'jotai'
import { loadable } from 'jotai/utils'

// Async atom that fetches sessions
const sessionsAsyncAtom = atom(async (get) => {
  const res = await fetch('/api/sessions')
  if (!res.ok) throw new Error('Failed to fetch sessions')
  return res.json()
})

// Loadable wrapper for non-Suspense usage
export const sessionsLoadableAtom = loadable(sessionsAsyncAtom)

// Usage in component:
// const sessions = useAtomValue(sessionsLoadableAtom)
// if (sessions.state === 'loading') return <Spinner />
// if (sessions.state === 'hasError') return <ErrorDisplay error={sessions.error} />
// return <SessionList sessions={sessions.data} />
```

### Anti-Patterns to Avoid

- **Direct fetch in render:** Don't call fetch inside render functions; use atoms or hooks
- **Missing cleanup:** Always return cleanup functions from WebSocket subscriptions
- **Blocking on session events:** Don't await WebSocket message delivery; it's fire-and-forget
- **Sync IPC assumptions:** Replace any `window.electronAPI.xxx()` calls that expect synchronous returns

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Error boundary | Custom class component | react-error-boundary | Handles modern React patterns, provides onReset |
| WebSocket reconnection | Manual retry logic | Built-in with exponential backoff | Reconnection is complex; use proven patterns |
| Loading state management | Manual useState | Jotai loadable() | Integrates with existing atom architecture |
| HTTP request abstraction | Custom wrapper | native fetch + try/catch | fetch is sufficient; don't over-abstract |

**Key insight:** The adapter pattern leverages the existing 245-method ElectronAPI interface, minimizing component changes. Don't try to redesign the data flow - replicate the existing patterns over HTTP.

## Common Pitfalls

### Pitfall 1: Assuming IPC is Instant

**What goes wrong:** Electron IPC feels synchronous; HTTP has network latency. Components flash or break without loading states.
**Why it happens:** IPC latency is <1ms; HTTP can be 50-500ms or more.
**How to avoid:** Add loading states for all data fetching. Use Jotai's `loadable()` for granular control.
**Warning signs:** UI elements appear empty before data loads; buttons feel unresponsive.

### Pitfall 2: Memory Leaks from WebSocket Subscriptions

**What goes wrong:** Components subscribe to WebSocket events but don't clean up on unmount.
**Why it happens:** Easy to forget cleanup functions in useEffect.
**How to avoid:** Always return cleanup from subscription hooks. Use the pattern in WebSocketManager.
**Warning signs:** Console shows events after navigating away; memory usage grows over time.

### Pitfall 3: Missing Error Handling for Network Failures

**What goes wrong:** App crashes or shows blank screen when server is unreachable.
**Why it happens:** Electron IPC rarely fails; fetch can fail for many reasons.
**How to avoid:** Wrap with ErrorBoundary. Add try/catch to all fetch calls. Show user-friendly errors.
**Warning signs:** Unhandled Promise rejections in console; white screen on network issues.

### Pitfall 4: WebSocket Not Reconnecting After Network Drop

**What goes wrong:** Real-time updates stop after temporary network interruption.
**Why it happens:** WebSocket.onclose fires but no reconnection logic exists.
**How to avoid:** Implement exponential backoff reconnection in WebSocketManager.
**Warning signs:** Session events stop arriving; need manual page refresh to restore.

### Pitfall 5: Theme Loading Breaks Without IPC

**What goes wrong:** Theme fails to load because `window.electronAPI.loadPresetTheme()` is not implemented.
**Why it happens:** Theme API was stubbed in Phase 2 but needs full HTTP implementation.
**How to avoid:** Implement all theme-related methods in HttpAdapter (FRNT-06).
**Warning signs:** Theme resets to default; preset picker shows empty list.

## Code Examples

### Bootstrap with Adapter Injection

```typescript
// Source: Playground mock-utils pattern + project structure
// apps/web/src/client/main.tsx

import React from 'react'
import { createRoot } from 'react-dom/client'
import { HttpAdapter } from './adapters/http-adapter'
import App from './App'

// Inject HTTP adapter as window.electronAPI
// This allows existing components to work unchanged
const adapter = new HttpAdapter()
;(window as any).electronAPI = adapter

// Connect WebSocket early
adapter.connect()

const container = document.getElementById('root')!
createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### Session Event Hook with Subscription

```typescript
// Source: WebSocket patterns + existing useNotifications.ts pattern
// apps/web/src/client/hooks/useSessionEvents.ts

import { useEffect } from 'react'
import type { SessionEvent } from '../types'

/**
 * Subscribe to WebSocket session events with automatic cleanup.
 * Re-subscribes when sessionId changes.
 */
export function useSessionEvents(
  sessionId: string | null,
  onEvent: (event: SessionEvent) => void
): void {
  useEffect(() => {
    if (!sessionId) return

    // Subscribe to session-scoped events
    window.electronAPI.subscribeToSession?.(sessionId)

    // Register global event handler
    const cleanup = window.electronAPI.onSessionEvent((event) => {
      if (event.sessionId === sessionId) {
        onEvent(event)
      }
    })

    return () => {
      cleanup()
      window.electronAPI.unsubscribeFromSession?.(sessionId)
    }
  }, [sessionId, onEvent])
}
```

### Loading State Component

```typescript
// Source: Common React patterns
// apps/web/src/client/components/LoadingState.tsx

import { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  /** Show loading state */
  isLoading: boolean
  /** Content to render when not loading */
  children: ReactNode
  /** Optional: custom loading message */
  message?: string
  /** Optional: show inline spinner vs full overlay */
  inline?: boolean
}

export function LoadingState({ isLoading, children, message, inline }: Props) {
  if (!isLoading) return <>{children}</>

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {message || 'Loading...'}
      </span>
    )
  }

  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-muted-foreground">{message || 'Loading...'}</span>
      </div>
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| window.electronAPI direct calls | Adapter pattern with HTTP | Phase 6 | Components unchanged, transport abstracted |
| IPC events via webContents.send | WebSocket with session subscriptions | Phase 3 | Same event types, different delivery |
| Sync theme loading | Async HTTP with loading state | Phase 6 | Must handle loading/error states |
| No network error handling | ErrorBoundary + try/catch | Phase 6 | Graceful degradation |

**Deprecated/outdated:**
- Direct `ipcRenderer.invoke()` calls: Replaced by HTTP fetch
- `contextBridge.exposeInMainWorld()`: Not needed in web context

## Open Questions

1. **Subset Implementation Priority**
   - What we know: 245 ElectronAPI methods exist; not all needed for basic web version
   - What's unclear: Which methods are critical path vs can be stubbed?
   - Recommendation: Prioritize session, workspace, config, theme. Stub file dialogs and system operations.

2. **Theme Preset Loading**
   - What we know: `/api/theme/presets` stub returns empty array
   - What's unclear: Where are preset themes stored? How should web load them?
   - Recommendation: Implement full preset loading in Phase 6 or stub with default theme.

3. **File Operations Without Electron Dialog**
   - What we know: `openFileDialog`, `openFolderDialog` depend on Electron's dialog module
   - What's unclear: How to handle file selection in web context?
   - Recommendation: Use `<input type="file">` for uploads; stub or omit folder operations initially.

## Sources

### Primary (HIGH confidence)
- `/opt/craft-agents-web/apps/electron/src/shared/types.ts` - ElectronAPI interface (lines 704-949)
- `/opt/craft-agents-web/apps/electron/src/preload/index.ts` - IPC to ElectronAPI mapping
- `/opt/craft-agents-web/apps/web/src/server/routes/api/` - Existing HTTP endpoints
- `/opt/craft-agents-web/apps/web/src/server/plugins/websocket.ts` - WebSocket implementation
- `/opt/craft-agents-web/apps/electron/src/renderer/playground/mock-utils.ts` - Adapter injection pattern

### Secondary (MEDIUM confidence)
- [react-error-boundary](https://github.com/bvaughn/react-error-boundary) - Error handling library
- [Jotai async utilities](https://jotai.org/docs/utilities/async) - Loadable pattern
- [react-use-websocket](https://github.com/robtaussig/react-use-websocket) - WebSocket hook patterns
- Prior phase research (01-05) - Established patterns and decisions

### Tertiary (LOW confidence)
- WebSearch results on adapter patterns - General guidance only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses established patterns from prior phases
- Architecture: HIGH - Adapter pattern is well-understood and matches existing code
- Pitfalls: HIGH - Based on actual codebase analysis and common React patterns

**Research date:** 2026-01-28
**Valid until:** 30 days (patterns stable, React/Jotai APIs mature)

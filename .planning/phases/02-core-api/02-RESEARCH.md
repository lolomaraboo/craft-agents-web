# Phase 2: Core API - Research

**Researched:** 2026-01-27
**Domain:** REST API endpoints replacing Electron IPC handlers
**Confidence:** HIGH

## Summary

Phase 2 transforms the Electron IPC communication layer into HTTP REST endpoints, enabling the renderer to communicate with the server via standard HTTP requests instead of Electron's IPC channels. This research confirms that Fastify 5.x with TypeBox validation, @fastify/sse for streaming responses, and an adapter pattern for gradual migration is the optimal approach.

The standard approach involves:
1. Fastify route plugins organized by domain (sessions, workspaces, config)
2. TypeBox for schema validation and TypeScript type generation
3. @fastify/sse for streaming AI responses (replacing Electron's webContents.send)
4. AbortController pattern for cancelling in-progress requests
5. Adapter pattern to minimize renderer changes during migration

The existing Electron app has 119 IPC handlers covering sessions, workspaces, configuration, file operations, MCP servers, sources, skills, labels, and system operations. These need to be converted to RESTful HTTP endpoints while preserving the exact same functionality.

**Primary recommendation:** Use Fastify's plugin architecture with domain-based route organization (sessions, workspaces, config), TypeBox schemas for validation and type safety, and Server-Sent Events for streaming AI responses. Implement an adapter layer in the renderer to switch between IPC and HTTP with minimal code changes.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.3.x | HTTP server (already in use) | 2-3x faster than Express, plugin architecture, TypeScript-first |
| @sinclair/typebox | 0.36.x | Schema validation + TS types | JSON Schema compatible, 10x faster than Zod, integrates with Fastify |
| @fastify/type-provider-typebox | 5.x | TypeBox integration | Official Fastify plugin for TypeBox type inference |
| @fastify/sse | 7.x | Server-Sent Events | Official plugin, streaming support, automatic reconnection |
| @fastify/cors | 10.x | CORS headers | Required for dev mode (Vite + server on different ports) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chokidar | 5.x | File watching | Config file watching (workspace settings, sources) |
| @fastify/multipart | 9.x | File uploads | Session attachments, avatar uploads |
| @fastify/rate-limit | 10.x | Rate limiting | Production deployment (optional but recommended) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeBox | Zod | Zod has better DX but 10x slower, TypeBox generates JSON Schema for OpenAPI |
| @fastify/sse | WebSocket for streaming | SSE is simpler, one-way (sufficient for AI responses), auto-reconnects |
| chokidar | fs.watch | chokidar is cross-platform, handles network drives, debouncing built-in |

**Installation:**
```bash
bun add @sinclair/typebox @fastify/type-provider-typebox @fastify/sse @fastify/cors chokidar
bun add -d @fastify/multipart @fastify/rate-limit
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/server/
├── index.ts              # Main server setup (Phase 1)
├── plugins/
│   ├── static.ts         # Static serving (Phase 1)
│   ├── websocket.ts      # WebSocket (Phase 1)
│   └── cors.ts           # CORS for dev mode (Phase 2)
├── routes/
│   ├── api/
│   │   ├── sessions.ts   # Session CRUD + message sending
│   │   ├── workspaces.ts # Workspace CRUD
│   │   ├── config.ts     # Config get/update/watch
│   │   ├── mcp.ts        # MCP server operations
│   │   └── system.ts     # System info, theme, etc.
│   └── index.ts          # Route plugin registration
├── schemas/
│   ├── session.ts        # TypeBox schemas for sessions
│   ├── workspace.ts      # TypeBox schemas for workspaces
│   └── common.ts         # Shared schemas (error responses, etc.)
├── lib/
│   ├── config.ts         # Server config (Phase 1)
│   ├── shutdown.ts       # Graceful shutdown (Phase 1)
│   └── session-manager.ts # Port SessionManager from Electron
└── adapters/
    └── ipc-to-http.ts    # Adapter for renderer migration
```

### Pattern 1: Route Plugin Organization by Domain
**What:** Group related endpoints into route plugins by domain (sessions, workspaces, config)
**When to use:** Always - organizes code by business domain, enables feature toggles
**Example:**
```typescript
// routes/api/sessions.ts
import { FastifyPluginAsync } from 'fastify'
import { Type, Static } from '@sinclair/typebox'

const CreateSessionSchema = Type.Object({
  workspaceId: Type.String(),
  name: Type.Optional(Type.String())
})

type CreateSessionRequest = Static<typeof CreateSessionSchema>

export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/sessions - List all sessions
  fastify.get('/sessions', async (request, reply) => {
    const sessions = await fastify.sessionManager.getSessions()
    return sessions
  })

  // POST /api/sessions - Create new session
  fastify.post<{ Body: CreateSessionRequest }>('/sessions', {
    schema: {
      body: CreateSessionSchema
    }
  }, async (request, reply) => {
    const session = await fastify.sessionManager.createSession(
      request.body.workspaceId,
      { name: request.body.name }
    )
    return reply.code(201).send(session)
  })

  // GET /api/sessions/:id - Get session with messages
  fastify.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const session = await fastify.sessionManager.getSession(request.params.id)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }
    return session
  })

  // DELETE /api/sessions/:id - Delete session
  fastify.delete<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    await fastify.sessionManager.deleteSession(request.params.id)
    return reply.code(204).send()
  })
}
```

### Pattern 2: TypeBox Schema Validation with Type Inference
**What:** Define schemas with TypeBox, get automatic validation and TypeScript types
**When to use:** For all request/response bodies and query parameters
**Example:**
```typescript
// schemas/session.ts
import { Type, Static } from '@sinclair/typebox'

// Request schemas
export const SendMessageSchema = Type.Object({
  sessionId: Type.String({ minLength: 1 }),
  message: Type.String({ minLength: 1 }),
  attachments: Type.Optional(Type.Array(Type.Object({
    path: Type.String(),
    name: Type.String(),
    mimeType: Type.String()
  }))),
  options: Type.Optional(Type.Object({
    thinkingLevel: Type.Optional(Type.String()),
    model: Type.Optional(Type.String())
  }))
})

// Response schemas
export const SessionSchema = Type.Object({
  id: Type.String(),
  workspaceId: Type.String(),
  name: Type.Optional(Type.String()),
  messages: Type.Array(Type.Object({
    id: Type.String(),
    role: Type.Union([Type.Literal('user'), Type.Literal('assistant')]),
    content: Type.String(),
    timestamp: Type.Number()
  })),
  isProcessing: Type.Boolean(),
  tokenUsage: Type.Optional(Type.Object({
    inputTokens: Type.Number(),
    outputTokens: Type.Number(),
    totalTokens: Type.Number()
  }))
})

// Infer TypeScript types
export type SendMessageBody = Static<typeof SendMessageSchema>
export type Session = Static<typeof SessionSchema>

// Use in routes
fastify.post<{ Body: SendMessageBody }>('/sessions/:id/messages', {
  schema: {
    body: SendMessageSchema,
    response: {
      200: SessionSchema
    }
  }
}, async (request, reply) => {
  // request.body is typed as SendMessageBody
  // return value must match SessionSchema
})
```

### Pattern 3: Server-Sent Events for Streaming Responses
**What:** Use SSE to stream AI responses back to client (replaces webContents.send)
**When to use:** For streaming message responses, progress updates
**Example:**
```typescript
// Source: @fastify/sse official docs
import { FastifyPluginAsync } from 'fastify'

export const streamingRoutes: FastifyPluginAsync = async (fastify) => {
  // Register SSE plugin
  await fastify.register(require('@fastify/sse'))

  // POST /api/sessions/:id/messages/stream - Send message with streaming response
  fastify.post<{
    Params: { id: string },
    Body: SendMessageBody
  }>('/sessions/:id/messages/stream', async (request, reply) => {
    const { id: sessionId } = request.params
    const { message, attachments, options } = request.body

    // Set up SSE
    reply.sse.send({ event: 'start', data: JSON.stringify({ sessionId }) })

    // Listen to agent events and forward via SSE
    const eventHandler = (event: AgentEvent) => {
      reply.sse.send({
        event: event.type,
        data: JSON.stringify(event)
      })
    }

    try {
      await fastify.sessionManager.sendMessage(
        sessionId,
        message,
        attachments,
        options,
        eventHandler
      )
      reply.sse.send({ event: 'complete', data: JSON.stringify({ sessionId }) })
    } catch (error) {
      reply.sse.send({
        event: 'error',
        data: JSON.stringify({ error: error.message })
      })
    }
  })
}
```

### Pattern 4: Request Abort Handling for Cancellation
**What:** Use AbortController to cancel in-progress AI requests
**When to use:** When user clicks "Stop" button during message processing
**Example:**
```typescript
// Source: Fastify abort detection patterns + AbortController API
export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/sessions/:id/abort - Cancel processing
  fastify.post<{ Params: { id: string } }>('/sessions/:id/abort', async (request, reply) => {
    const { id: sessionId } = request.params
    await fastify.sessionManager.cancelProcessing(sessionId)
    return reply.code(200).send({ success: true })
  })

  // In sendMessage handler, detect client disconnect
  fastify.post('/sessions/:id/messages', async (request, reply) => {
    const abortController = new AbortController()

    // Listen for client disconnect
    request.raw.on('close', () => {
      if (!reply.sent) {
        fastify.log.info('Client disconnected, aborting request')
        abortController.abort()
      }
    })

    // Pass signal to agent
    await fastify.sessionManager.sendMessage(
      sessionId,
      message,
      attachments,
      options,
      eventHandler,
      { signal: abortController.signal }
    )
  })
}
```

### Pattern 5: Config File Watching with Chokidar
**What:** Watch workspace config files and broadcast changes to clients
**When to use:** For live-reloading workspace settings, sources, labels
**Example:**
```typescript
// Source: chokidar official docs
import chokidar from 'chokidar'
import { join } from 'path'

export class ConfigWatcher {
  private watcher: chokidar.FSWatcher | null = null

  async watch(workspaceRoot: string, onChange: (path: string) => void) {
    const configPaths = [
      join(workspaceRoot, '.craft-agent', 'config.yaml'),
      join(workspaceRoot, '.craft-agent', 'sources', '*.yaml'),
      join(workspaceRoot, '.craft-agent', 'labels.yaml')
    ]

    this.watcher = chokidar.watch(configPaths, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100
      }
    })

    this.watcher.on('change', (path) => {
      onChange(path)
    })

    this.watcher.on('add', (path) => {
      onChange(path)
    })

    this.watcher.on('unlink', (path) => {
      onChange(path)
    })
  }

  async close() {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
  }
}
```

### Pattern 6: Adapter Pattern for IPC → HTTP Migration
**What:** Create an adapter in renderer that switches between IPC and HTTP transparently
**When to use:** During migration to minimize renderer code changes
**Example:**
```typescript
// renderer/lib/api-adapter.ts
interface ApiAdapter {
  invoke<T>(channel: string, ...args: any[]): Promise<T>
  on(channel: string, listener: (...args: any[]) => void): void
  off(channel: string, listener: (...args: any[]) => void): void
}

class HttpAdapter implements ApiAdapter {
  private baseUrl = 'http://localhost:3000/api'

  async invoke<T>(channel: string, ...args: any[]): Promise<T> {
    // Map IPC channel to HTTP endpoint
    const endpoint = this.channelToEndpoint(channel, args)
    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      headers: { 'Content-Type': 'application/json' },
      body: endpoint.body ? JSON.stringify(endpoint.body) : undefined
    })
    return response.json()
  }

  private channelToEndpoint(channel: string, args: any[]) {
    // Map IPC_CHANNELS to REST endpoints
    switch (channel) {
      case 'sessions:get':
        return { method: 'GET', url: `${this.baseUrl}/sessions` }
      case 'sessions:create':
        return {
          method: 'POST',
          url: `${this.baseUrl}/sessions`,
          body: { workspaceId: args[0], ...args[1] }
        }
      case 'sessions:delete':
        return { method: 'DELETE', url: `${this.baseUrl}/sessions/${args[0]}` }
      // ... other mappings
      default:
        throw new Error(`Unknown IPC channel: ${channel}`)
    }
  }
}

// Use in renderer
const api: ApiAdapter = IS_WEB ? new HttpAdapter() : window.electron
```

### Anti-Patterns to Avoid
- **Using verbs in endpoint URLs:** Use `/sessions/:id` not `/getSessions` - HTTP methods convey the action
- **Exposing internal IDs in public APIs:** Don't expose database IDs directly without validation
- **Not validating workspace access:** Always verify user has access to the workspace before operations
- **Synchronous config watching:** Use `awaitWriteFinish` to avoid reading partial file writes
- **Missing error boundaries:** Wrap route handlers with try/catch and return proper HTTP status codes

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema validation | Custom validators | TypeBox + @fastify/type-provider-typebox | Type safety, performance, JSON Schema compat |
| File watching | fs.watch polling | chokidar | Cross-platform, network drives, debouncing |
| Streaming responses | Manual chunked encoding | @fastify/sse | Auto-reconnect, Last-Event-ID, browser compat |
| Request cancellation | Custom abort logic | AbortController | Standard API, timeout support, cleanup |
| CORS handling | Manual header setting | @fastify/cors | Preflight handling, credential support, security |
| File uploads | Manual multipart parsing | @fastify/multipart | Memory management, streaming, validation |

**Key insight:** REST APIs have mature ecosystem solutions for common problems. Fastify's official plugins (@fastify/*) are production-tested and handle edge cases that custom implementations miss (e.g., CORS preflight, SSE reconnection, multipart boundaries).

## Common Pitfalls

### Pitfall 1: Not Handling Client Disconnects
**What goes wrong:** Long-running operations continue after client disconnects, wasting resources
**Why it happens:** HTTP doesn't automatically cancel server-side work on disconnect
**How to avoid:** Always create an AbortController and listen to request.raw 'close' event
**Warning signs:** Server CPU high during AI generation even after frontend refresh

### Pitfall 2: Missing Request Validation
**What goes wrong:** Malformed requests crash the server or cause database errors
**Why it happens:** Assuming client always sends correct data
**How to avoid:** Define TypeBox schemas for ALL request bodies, params, and query strings
**Warning signs:** Uncaught exceptions in logs, 500 errors from type mismatches

### Pitfall 3: Exposing Sensitive File Paths
**What goes wrong:** API returns absolute file paths (e.g., /Users/john/.ssh/id_rsa)
**Why it happens:** Reusing Electron code that had filesystem access assumptions
**How to avoid:** Always use relative paths from workspace root, validate file access
**Warning signs:** File paths in API responses include home directories

### Pitfall 4: Config File Race Conditions
**What goes wrong:** Reading config files during writes returns partial data
**Why it happens:** File watcher triggers immediately on write start, not completion
**How to avoid:** Use chokidar's `awaitWriteFinish` option to wait for writes to complete
**Warning signs:** Occasional YAML parse errors, incomplete config objects

### Pitfall 5: Session State Synchronization
**What goes wrong:** Multiple clients viewing same session see different states
**Why it happens:** No broadcast mechanism for session updates
**How to avoid:** Use WebSocket (from Phase 1) to broadcast session events to all clients
**Warning signs:** Users report stale data, need to refresh to see changes

### Pitfall 6: CORS in Development
**What goes wrong:** Fetch requests fail with CORS errors in dev mode (Vite + server separate)
**Why it happens:** Browser blocks cross-origin requests by default
**How to avoid:** Register @fastify/cors in dev mode with specific origin (Vite dev server)
**Warning signs:** Network tab shows OPTIONS requests failing, "CORS policy" errors

### Pitfall 7: Missing Response Status Codes
**What goes wrong:** All responses return 200, even errors
**Why it happens:** Forgetting to set reply.code() for different outcomes
**How to avoid:** Use appropriate codes: 201 (created), 204 (no content), 404 (not found), 400 (bad request), 500 (server error)
**Warning signs:** Frontend can't distinguish success from failure

## Code Examples

Verified patterns from official sources:

### Fastify Plugin Registration with TypeBox
```typescript
// Source: @fastify/type-provider-typebox official docs
import Fastify from 'fastify'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'

const fastify = Fastify().withTypeProvider<TypeBoxTypeProvider>()

// Now routes automatically get type inference
fastify.get('/user/:id', {
  schema: {
    params: Type.Object({
      id: Type.String()
    }),
    response: {
      200: Type.Object({
        id: Type.String(),
        name: Type.String(),
        email: Type.String({ format: 'email' })
      })
    }
  }
}, async (request, reply) => {
  // request.params.id is typed as string
  // return type must match response schema
  return {
    id: request.params.id,
    name: 'John Doe',
    email: 'john@example.com'
  }
})
```

### SSE Streaming with Cleanup
```typescript
// Source: @fastify/sse official docs + AbortController patterns
fastify.get('/stream/:sessionId', async (request, reply) => {
  const { sessionId } = request.params
  const abortController = new AbortController()

  // Handle client disconnect
  request.raw.on('close', () => {
    abortController.abort()
  })

  // Stream events
  for await (const event of sessionManager.streamEvents(sessionId, abortController.signal)) {
    if (abortController.signal.aborted) break

    reply.sse.send({
      event: event.type,
      data: JSON.stringify(event),
      id: event.id // Enables resume via Last-Event-ID
    })
  }
})
```

### CORS Configuration for Dev Mode
```typescript
// Source: @fastify/cors official docs
import cors from '@fastify/cors'

const isDev = process.env.NODE_ENV === 'development'

if (isDev) {
  await fastify.register(cors, {
    origin: 'http://localhost:5173', // Vite dev server
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  })
}
```

### Error Handler with Proper Status Codes
```typescript
// Source: Fastify error handling best practices
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error)

  // Validation errors (from TypeBox)
  if (error.validation) {
    return reply.code(400).send({
      error: 'Validation Error',
      details: error.validation
    })
  }

  // Not found errors
  if (error.statusCode === 404) {
    return reply.code(404).send({
      error: 'Not Found',
      message: error.message
    })
  }

  // Generic server errors
  return reply.code(500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An error occurred'
      : error.message
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Electron IPC (ipcMain/ipcRenderer) | REST API + WebSocket | 2024+ (web apps) | Enables browser access, better tooling |
| JSON Schema manual writing | TypeBox type-first | 2023+ (v0.25+) | Types and schemas from single definition |
| Custom streaming protocols | Server-Sent Events | 2021+ (HTTP/2 wide support) | Simpler than WebSocket, auto-reconnect |
| Manual AbortSignal | Built-in fetch abort | 2020+ (Node 16+) | Standard cancellation pattern |
| Zod validation | TypeBox for APIs | 2024+ (performance focus) | 10x faster, JSON Schema for OpenAPI |

**Deprecated/outdated:**
- **fastify-cors (v7):** Replaced by @fastify/cors (v9+) - use official @fastify namespace
- **Manual JSON Schema writing:** TypeBox generates schemas from types
- **Custom SSE implementations:** @fastify/sse is now official and feature-complete
- **Body parser plugins:** Built into Fastify 4+ by default

## Open Questions

Things that couldn't be fully resolved:

1. **Authentication/Authorization Strategy**
   - What we know: Self-hosted app, single-user in Phase 2
   - What's unclear: Future multi-user support, API key authentication for external tools
   - Recommendation: Start with no auth (localhost only), add API keys in Phase 3

2. **WebSocket vs SSE for Session Events**
   - What we know: Phase 1 has WebSocket, SSE good for one-way streaming
   - What's unclear: Whether to use both or standardize on one
   - Recommendation: Use SSE for message streaming (request/response), WebSocket for broadcasts (session updates to all clients)

3. **Session State Persistence**
   - What we know: Electron stores sessions in files, SessionManager keeps in-memory state
   - What's unclear: How to handle multiple server instances (future scaling)
   - Recommendation: Keep file-based persistence for Phase 2, document limitations for Phase 3

4. **Rate Limiting Strategy**
   - What we know: @fastify/rate-limit available, good for production
   - What's unclear: Whether needed for self-hosted, single-user deployment
   - Recommendation: Document but don't implement - add in Phase 3 if deploying publicly

## Sources

### Primary (HIGH confidence)
- [Fastify Official Documentation - Routes](https://fastify.dev/docs/latest/Reference/Routes/) - Route definition patterns
- [Fastify Official Documentation - Validation](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/) - Schema validation
- [Fastify Official Documentation - TypeScript](https://fastify.dev/docs/latest/Reference/TypeScript/) - Type providers
- [Fastify Official Documentation - Error Handling](https://fastify.dev/docs/latest/Reference/Errors/) - Error handler patterns
- [Fastify Official Documentation - Detecting Client Aborts](https://fastify.dev/docs/latest/Guides/Detecting-When-Clients-Abort/) - Request cancellation
- [@fastify/sse GitHub Repository](https://github.com/fastify/sse) - Official SSE plugin
- [@fastify/type-provider-typebox NPM](https://www.npmjs.com/package/@fastify/type-provider-typebox) - TypeBox integration
- [TypeBox GitHub Repository](https://github.com/sinclairzx81/typebox) - Schema definition library
- [Chokidar GitHub Repository](https://github.com/paulmillr/chokidar) - File watching library
- [Better Stack: Fastify Web API Guide](https://betterstack.com/community/guides/scaling-nodejs/fastify-web-api/) - Fastify best practices
- [Better Stack: TypeBox vs Zod](https://betterstack.com/community/guides/scaling-nodejs/typebox-vs-zod/) - Validation library comparison

### Secondary (MEDIUM confidence)
- [AST Consulting: Fastify Error Handling](https://astconsulting.in/java-script/nodejs/fastify/error-handling-fastify) - Error handling middleware patterns
- [Moesif: REST API Naming Conventions](https://www.moesif.com/blog/technical/api-development/The-Ultimate-Guide-to-REST-API-Naming-Convention/) - Endpoint naming best practices
- [RESTful API: Resource Naming](https://restfulapi.net/resource-naming/) - URI conventions
- [Stytch Blog: JWTs vs Sessions](https://stytch.com/blog/jwts-vs-sessions-which-is-right-for-you/) - Authentication patterns comparison
- [AppSignal Blog: AbortController in Node.js](https://blog.appsignal.com/2025/02/12/managing-asynchronous-operations-in-nodejs-with-abortcontroller.html) - Cancellation patterns (Feb 2025)
- [AI SDK: Stopping Streams](https://ai-sdk.dev/docs/advanced/stopping-streams) - Stream abort handling
- [Strapi: CORS Configuration](https://strapi.io/blog/what-is-cors-configuration-guide) - CORS security guide

### Tertiary (LOW confidence)
- [Medium: Fastify SSE](https://edisondevadoss.medium.com/fastify-server-sent-events-sse-93de994e013b) - SSE implementation example
- [DEV Community: Fastify Autoload](https://dev.to/dantesbytes/-understanding-fastify-autoload-organizing-your-api-with-ease-15bi) - Route organization
- [Val Town Blog: TypeBox vs Zod](https://blog.val.town/blog/typebox/) - Real-world comparison

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries are official Fastify plugins or widely adopted standards
- Architecture patterns: HIGH - Patterns verified from official documentation and production usage
- Pitfalls: HIGH - Based on common issues documented in GitHub issues and support forums
- Open questions: MEDIUM - Clear path forward but some decisions deferred to Phase 3

**Research date:** 2026-01-27
**Valid until:** Estimated 30 days (stable ecosystem, Fastify 5.x is mature)

**Key decisions made:**
- TypeBox over Zod (performance + JSON Schema compatibility)
- SSE for streaming (simpler than WebSocket for one-way)
- Adapter pattern for gradual migration (minimize renderer changes)
- Chokidar for config watching (cross-platform, battle-tested)
- Domain-based route organization (sessions, workspaces, config as separate plugins)

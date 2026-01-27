# Phase 1: Server Foundation - Research

**Researched:** 2026-01-27
**Domain:** Fastify HTTP server with WebSocket support for Node.js
**Confidence:** HIGH

## Summary

This phase establishes the server infrastructure to replace Electron's main process with a Node.js web server. The research confirms that Fastify 5.x with @fastify/websocket is the correct stack for this transformation, offering excellent performance and TypeScript support.

The standard approach involves:
1. Fastify 5.x as the HTTP server (2-3x faster than Express for JSON streaming)
2. @fastify/websocket (built on ws@8) for real-time bidirectional communication
3. @fastify/static for serving the Vite-built React application
4. tsx for TypeScript development with watch mode
5. pino (built into Fastify) for structured logging

**Primary recommendation:** Use Fastify's plugin architecture to organize concerns (static serving, WebSocket, API routes) as separate registered plugins, enabling clean separation and testability.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastify | 5.7.x | HTTP server framework | 2-3x faster than Express, TypeScript-first, plugin architecture |
| @fastify/websocket | 11.2.x | WebSocket support | Built on ws@8, integrates with Fastify lifecycle, official plugin |
| @fastify/static | 8.x | Static file serving | Production-ready, SPA support, cache control |
| ws | 8.x | WebSocket library | Fastest Node.js WebSocket, used by @fastify/websocket |
| pino | (via fastify) | Logging | Built into Fastify, structured JSON logging |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | latest | TypeScript execution | Development server with watch mode |
| pino-pretty | latest | Log formatting | Development environment only |
| @fastify/cors | latest | CORS support | If serving frontend from different origin in dev |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/websocket | ws directly | Would work, but lose Fastify lifecycle integration |
| tsx | nodemon + ts-node | tsx is faster on Node 22+, has built-in watch |
| pino | winston | pino is 5x faster, Fastify's native logger |

**Installation:**
```bash
bun add fastify @fastify/websocket @fastify/static
bun add -d tsx pino-pretty @types/ws
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── src/
│   ├── server/
│   │   ├── index.ts          # Main entry, server creation
│   │   ├── plugins/
│   │   │   ├── static.ts     # @fastify/static registration
│   │   │   └── websocket.ts  # @fastify/websocket + handlers
│   │   ├── routes/
│   │   │   └── api/          # HTTP API routes (Phase 2)
│   │   └── lib/
│   │       ├── config.ts     # Port, env configuration
│   │       └── shutdown.ts   # Graceful shutdown handler
│   └── client/               # React app (copy/symlink from electron renderer)
├── dist/                     # Production build output
├── package.json
└── tsconfig.json
```

### Pattern 1: Plugin-Based Server Organization
**What:** Register Fastify plugins in order for separation of concerns
**When to use:** Always - this is Fastify's core pattern
**Example:**
```typescript
// Source: Fastify official docs
import Fastify from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import path from 'node:path'

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
      : undefined
  }
})

// Register WebSocket BEFORE routes
await fastify.register(fastifyWebsocket, {
  options: { maxPayload: 1048576 } // 1MB max message size
})

// Register static file serving
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../dist'),
  prefix: '/'
})
```

### Pattern 2: Graceful Shutdown Handler
**What:** Handle SIGTERM/SIGINT to close connections cleanly
**When to use:** Always in production
**Example:**
```typescript
// Source: Fastify docs + fastify-graceful-shutdown patterns
async function setupGracefulShutdown(fastify: FastifyInstance): Promise<void> {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']

  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info({ signal }, 'Received shutdown signal')

      try {
        await fastify.close()
        fastify.log.info('Server closed successfully')
        process.exit(0)
      } catch (err) {
        fastify.log.error({ err }, 'Error during shutdown')
        process.exit(1)
      }
    })
  }
}
```

### Pattern 3: WebSocket Connection Management
**What:** Track active connections for broadcasting and cleanup
**When to use:** When needing to broadcast events to clients
**Example:**
```typescript
// Source: ws library docs + @fastify/websocket patterns
import type { WebSocket } from 'ws'

const clients = new Set<WebSocket>()

fastify.get('/ws', { websocket: true }, (socket, req) => {
  clients.add(socket)
  fastify.log.info({ clientId: req.id }, 'WebSocket client connected')

  socket.on('close', () => {
    clients.delete(socket)
    fastify.log.info({ clientId: req.id }, 'WebSocket client disconnected')
  })

  socket.on('error', (err) => {
    fastify.log.error({ err, clientId: req.id }, 'WebSocket error')
    clients.delete(socket)
  })

  socket.on('message', (data) => {
    // Handle incoming messages
  })
})

// Broadcast to all clients
function broadcast(message: string): void {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  }
}
```

### Pattern 4: SPA Fallback for Client-Side Routing
**What:** Serve index.html for unmatched routes (React Router support)
**When to use:** When the frontend uses client-side routing
**Example:**
```typescript
// Source: @fastify/static docs
// Register static files first
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'dist'),
  prefix: '/',
  wildcard: false, // Don't auto-serve, let us control fallback
})

// API routes go here (registered before wildcard)
// fastify.register(apiRoutes, { prefix: '/api' })

// SPA fallback - must be last
fastify.setNotFoundHandler((request, reply) => {
  // Only for GET requests, and not for API paths
  if (request.method === 'GET' && !request.url.startsWith('/api/')) {
    return reply.sendFile('index.html')
  }
  reply.code(404).send({ error: 'Not found' })
})
```

### Anti-Patterns to Avoid
- **Attaching async handlers before sync message handlers:** WebSocket handlers must attach `on('message')` synchronously to avoid dropping messages during async setup
- **Not cleaning up disconnected clients:** Always remove clients from tracking Set on 'close' and 'error' events
- **Using global variables for connection state:** Use WeakMap or plugin encapsulation to avoid memory leaks
- **Blocking the event loop in message handlers:** Use `setImmediate()` or offload heavy processing

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket heartbeat/ping-pong | Custom ping timer | ws built-in ping/pong | ws handles this automatically; manual implementation risks missing edge cases |
| Graceful shutdown | Custom signal handlers | `fastify.close()` with signal handlers | Fastify handles connection draining, returns 503 during shutdown |
| Static file serving | Custom file streaming | @fastify/static | Handles caching, ETags, range requests, security |
| Request logging | Custom middleware | Fastify's built-in pino | Automatic request/response logging, structured JSON |
| SPA routing fallback | Complex route matching | setNotFoundHandler pattern | Fastify's standard approach, works with static plugin |

**Key insight:** Fastify's plugin ecosystem solves most server infrastructure problems. The official plugins (@fastify/*) are maintained, tested, and optimized. Custom solutions introduce maintenance burden and subtle bugs.

## Common Pitfalls

### Pitfall 1: WebSocket Handler Async Trap
**What goes wrong:** Messages are dropped during connection setup
**Why it happens:** Async operations in handler run before message listeners are attached
**How to avoid:** Attach `on('message')` synchronously, then do async work
**Warning signs:** Intermittent missing messages, especially the first message
```typescript
// WRONG - may miss messages during async auth
fastify.get('/ws', { websocket: true }, async (socket, req) => {
  const user = await authenticateUser(req) // Messages lost here!
  socket.on('message', (data) => { /* ... */ })
})

// CORRECT - attach handler first, then do async work
fastify.get('/ws', { websocket: true }, (socket, req) => {
  const authPromise = authenticateUser(req)
  socket.on('message', async (data) => {
    const user = await authPromise // Safe: handler already attached
    // Process message with authenticated user
  })
})
```

### Pitfall 2: Memory Leaks from Uncleaned Connections
**What goes wrong:** Server memory grows unbounded over time
**Why it happens:** WebSocket clients added to Set but not removed on disconnect
**How to avoid:** Always handle 'close' and 'error' events to remove clients
**Warning signs:** Memory usage increasing, "MaxListenersExceededWarning" errors

### Pitfall 3: WebSocket Plugin Registration Order
**What goes wrong:** WebSocket routes don't work or override HTTP routes
**Why it happens:** @fastify/websocket must be registered before routes
**How to avoid:** Register websocket plugin first, then static, then routes
**Warning signs:** 404 errors on WebSocket endpoints, HTTP responses instead of upgrade

### Pitfall 4: Development Server Port Conflicts
**What goes wrong:** Can't start server, "address already in use" error
**Why it happens:** Previous instance didn't shut down cleanly
**How to avoid:** Use configurable port, implement proper shutdown, check port availability
**Warning signs:** EADDRINUSE errors on restart

### Pitfall 5: Missing Error Handling in WebSocket Handlers
**What goes wrong:** Unhandled errors crash the server or leave zombie connections
**Why it happens:** Fastify's onError hook doesn't cover WebSocket message handlers
**How to avoid:** Use try-catch in all message handlers, call socket.terminate() on fatal errors
**Warning signs:** Uncaught promise rejections, connections that stop responding

## Code Examples

### Complete Server Bootstrap
```typescript
// Source: Fastify docs + verified patterns
import Fastify, { type FastifyInstance } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface ServerConfig {
  port: number
  host: string
  staticRoot: string
  isDev: boolean
}

async function createServer(config: ServerConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.isDev ? 'debug' : 'info',
      transport: config.isDev
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined
    }
  })

  // WebSocket support (register first)
  await fastify.register(fastifyWebsocket, {
    options: { maxPayload: 1048576 }
  })

  // Static file serving (for production builds)
  if (!config.isDev) {
    await fastify.register(fastifyStatic, {
      root: config.staticRoot,
      prefix: '/',
    })
  }

  return fastify
}

async function startServer(): Promise<void> {
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    staticRoot: path.join(__dirname, '../dist'),
    isDev: process.env.NODE_ENV !== 'production'
  }

  const fastify = await createServer(config)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, 'Shutting down...')
    await fastify.close()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Start listening
  try {
    await fastify.listen({ port: config.port, host: config.host })
    fastify.log.info(`Server listening on ${config.host}:${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

startServer()
```

### WebSocket with Session Events (matching existing IPC pattern)
```typescript
// Source: @fastify/websocket docs + project requirements
import type { WebSocket } from 'ws'
import type { FastifyInstance, FastifyRequest } from 'fastify'

interface SessionEvent {
  type: string
  sessionId: string
  data: unknown
}

export async function registerWebSocketRoutes(fastify: FastifyInstance): Promise<void> {
  const clients = new Map<string, Set<WebSocket>>()

  fastify.get('/ws/sessions/:sessionId', { websocket: true }, (socket, req) => {
    const { sessionId } = req.params as { sessionId: string }

    // Track client for this session
    if (!clients.has(sessionId)) {
      clients.set(sessionId, new Set())
    }
    clients.get(sessionId)!.add(socket)

    fastify.log.info({ sessionId }, 'Client connected to session')

    socket.on('close', () => {
      clients.get(sessionId)?.delete(socket)
      if (clients.get(sessionId)?.size === 0) {
        clients.delete(sessionId)
      }
      fastify.log.info({ sessionId }, 'Client disconnected from session')
    })

    socket.on('error', (err) => {
      fastify.log.error({ err, sessionId }, 'WebSocket error')
      clients.get(sessionId)?.delete(socket)
    })

    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        // Handle incoming messages (e.g., abort requests)
        fastify.log.debug({ sessionId, message }, 'Received message')
      } catch (err) {
        fastify.log.warn({ err, sessionId }, 'Invalid message format')
      }
    })
  })

  // Broadcast helper for session events
  fastify.decorate('broadcastSessionEvent', (event: SessionEvent) => {
    const sessionClients = clients.get(event.sessionId)
    if (!sessionClients) return

    const message = JSON.stringify(event)
    for (const client of sessionClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message)
      }
    }
  })
}
```

### Development Server with Hot Reload Proxy
```typescript
// Source: Vite docs for proxy configuration
// vite.config.ts for development
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fastify 4.x | Fastify 5.x | Oct 2024 | Requires Node.js 20+, cleaner APIs, 5-10% faster |
| fastify-websocket | @fastify/websocket | 2022 | Renamed to scoped package, same functionality |
| ts-node + nodemon | tsx | 2024 | Better ESM support on Node 22+, built-in watch |
| Express | Fastify | N/A | 2-3x performance improvement for JSON-heavy workloads |

**Deprecated/outdated:**
- `fastify-websocket@4.x` - Use `@fastify/websocket@11.x` instead
- `fastify-static@4.x` - Use `@fastify/static@8.x` instead
- ts-node with Node 22+ ESM projects - Use tsx for better compatibility

## Open Questions

1. **Hot Reload Strategy in Development**
   - What we know: Vite's dev server handles frontend HMR; backend needs tsx watch
   - What's unclear: Best way to coordinate frontend proxy with backend restart
   - Recommendation: Run Vite dev server on :5173 proxying to Fastify on :3000; use tsx --watch for backend

2. **WebSocket Reconnection on Server Restart**
   - What we know: Development restarts will disconnect WebSocket clients
   - What's unclear: Should client auto-reconnect with exponential backoff?
   - Recommendation: Implement client-side reconnection logic with state recovery (Phase 4 scope)

3. **Port Configuration**
   - What we know: Need configurable port for both dev and production
   - What's unclear: Should support both CLI args and env vars?
   - Recommendation: Use `PORT` env var (standard), with CLI override for development

## Sources

### Primary (HIGH confidence)
- Fastify official documentation (https://fastify.dev/docs/latest/) - Server config, logging, lifecycle
- @fastify/websocket GitHub (https://github.com/fastify/fastify-websocket) - WebSocket integration patterns
- @fastify/static GitHub (https://github.com/fastify/fastify-static) - Static file serving, SPA patterns
- ws library GitHub (https://github.com/websockets/ws) - Connection management, ping/pong

### Secondary (MEDIUM confidence)
- Better Stack Fastify WebSocket guide (https://betterstack.com/community/guides/scaling-nodejs/fastify-websockets/) - Real-world patterns
- VideoSDK Fastify WebSocket guide (https://www.videosdk.live/developer-hub/websocket/fastify-websocket) - 2025 best practices
- tsx vs ts-node comparison (https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/) - Development tooling

### Tertiary (LOW confidence)
- WebSearch results for scalability patterns - Need validation for specific connection limits
- Memory leak discussions in GitHub issues - Specific to older versions, verify with current

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Fastify ecosystem, verified versions
- Architecture: HIGH - Based on official Fastify patterns and docs
- Pitfalls: HIGH - Documented in official repos and community guides
- Code examples: HIGH - Derived from official documentation

**Research date:** 2026-01-27
**Valid until:** 2026-02-27 (stable ecosystem, 30-day validity)

import type { FastifyInstance } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fp from 'fastify-plugin'
import type { WebSocket } from 'ws'

// Track active WebSocket clients
const clients = new Set<WebSocket>()

// Broadcast function to send message to all connected clients
function broadcast(message: string): void {
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      client.send(message)
    }
  }
}

async function websocketPluginImpl(fastify: FastifyInstance): Promise<void> {
  // Register @fastify/websocket with maxPayload
  await fastify.register(fastifyWebsocket, {
    options: { maxPayload: 1048576 } // 1MB max message size
  })

  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // Add to clients set immediately (sync)
    clients.add(socket)
    fastify.log.info({ clientId: req.id }, 'WebSocket client connected')

    // Send connection acknowledgment
    socket.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now()
    }))

    // Attach message handler synchronously (CRITICAL: avoid async trap from RESEARCH.md)
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())
        fastify.log.debug({ clientId: req.id, message }, 'Received WebSocket message')
        // Message handlers will be implemented in Phase 3
      } catch (err) {
        fastify.log.warn({ err, clientId: req.id }, 'Invalid WebSocket message format')
      }
    })

    socket.on('close', () => {
      clients.delete(socket)
      fastify.log.info({ clientId: req.id }, 'WebSocket client disconnected')
    })

    socket.on('error', (err) => {
      fastify.log.error({ err, clientId: req.id }, 'WebSocket error')
      clients.delete(socket)
    })
  })

  // Decorate fastify with broadcast function for use by other plugins/routes
  fastify.decorate('broadcast', broadcast)
}

// Export plugin wrapped with fastify-plugin for proper encapsulation
export const websocketPlugin = fp(websocketPluginImpl, {
  name: 'websocket-plugin',
  fastify: '5.x'
})

import type { FastifyInstance } from 'fastify'
import fastifyWebsocket from '@fastify/websocket'
import fp from 'fastify-plugin'
import type { WebSocket } from 'ws'
import {
  subscribeToSession,
  unsubscribeFromSession,
  cleanupSocket,
  broadcastToSession,
  broadcastGlobal,
  queueDelta,
  flushDelta
} from '../lib/websocket-events.js'
import type { ClientMessage, SessionEvent } from '../schemas/websocket.js'

async function websocketPluginImpl(fastify: FastifyInstance): Promise<void> {
  // Register @fastify/websocket with maxPayload
  await fastify.register(fastifyWebsocket, {
    options: { maxPayload: 1048576 } // 1MB max message size
  })

  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    fastify.log.info({ clientId: req.id }, 'WebSocket client connected')

    // Send connection acknowledgment
    socket.send(JSON.stringify({
      type: 'connected',
      timestamp: Date.now()
    }))

    // Attach message handler synchronously (CRITICAL: avoid async trap from RESEARCH.md)
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage
        fastify.log.debug({ clientId: req.id, message }, 'Received WebSocket message')

        // Handle client messages
        if (message.type === 'subscribe') {
          fastify.log.info({ sessionId: message.sessionId, clientId: req.id }, 'WebSocket subscribe request')
          subscribeToSession(message.sessionId, socket)
        } else if (message.type === 'unsubscribe') {
          unsubscribeFromSession(message.sessionId, socket)
        } else if (message.type === 'permission_response') {
          if (message.requestId) {
            fastify.sessionManager.respondToPermission()
          }
        } else {
          fastify.log.debug({ messageType: (message as { type: string }).type }, 'Unknown WebSocket message type')
        }
      } catch (err) {
        fastify.log.warn({ err, clientId: req.id }, 'Invalid WebSocket message format')
      }
    })

    socket.on('close', () => {
      cleanupSocket(socket)
      fastify.log.info({ clientId: req.id }, 'WebSocket client disconnected')
    })

    socket.on('error', (err) => {
      cleanupSocket(socket)
      fastify.log.error({ err, clientId: req.id }, 'WebSocket error')
    })
  })

  // Decorate fastify with broadcast functions for use by other plugins/routes
  fastify.decorate('broadcastToSession', broadcastToSession)
  fastify.decorate('broadcastGlobal', broadcastGlobal)
  fastify.decorate('queueDelta', queueDelta)
  fastify.decorate('flushDelta', flushDelta)
}

// Export plugin wrapped with fastify-plugin for proper encapsulation
export const websocketPlugin = fp(websocketPluginImpl, {
  name: 'websocket-plugin',
  fastify: '5.x'
})

// TypeScript module augmentation for Fastify decorators
declare module 'fastify' {
  interface FastifyInstance {
    broadcastToSession: (sessionId: string, event: SessionEvent) => void
    broadcastGlobal: (event: SessionEvent) => void
    queueDelta: (sessionId: string, delta: string, turnId?: string) => void
    flushDelta: (sessionId: string) => void
    sessionManager: import('../lib/session-manager.js').SessionManager
  }
}

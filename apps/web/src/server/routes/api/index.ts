import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { SessionManager } from '../../lib/session-manager.js'
import { sessionsRoutes } from './sessions.js'

// Type augmentation for SessionManager decorator
declare module 'fastify' {
  interface FastifyInstance {
    sessionManager: SessionManager
  }
}

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Decorate fastify with sessionManager instance
  const sessionManager = new SessionManager()
  fastify.decorate('sessionManager', sessionManager)

  // Register session routes under /api prefix
  await fastify.register(sessionsRoutes, { prefix: '/api' })
}

export default fp(apiRoutes, {
  name: 'api-routes'
})

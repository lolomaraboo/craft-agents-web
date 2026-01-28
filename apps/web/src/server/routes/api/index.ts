import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { SessionManager } from '../../lib/session-manager.js'
import { sessionsRoutes } from './sessions.js'
import { attachmentsRoutes } from './attachments.js'
import { workspacesRoutes } from './workspaces.js'
import { configRoutes } from './config.js'
import { credentialsRoutes } from './credentials.js'
import { mcpRoutes } from './mcp.js'
import { themeRoutes } from './theme.js'

// Type augmentation for SessionManager decorator
declare module 'fastify' {
  interface FastifyInstance {
    sessionManager: SessionManager
  }
}

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  // Decorate fastify with sessionManager instance (pass fastify for broadcast access)
  const sessionManager = new SessionManager(fastify)
  fastify.decorate('sessionManager', sessionManager)

  // Register all API routes under /api prefix
  await fastify.register(sessionsRoutes, { prefix: '/api' })      // from 02-01
  await fastify.register(attachmentsRoutes, { prefix: '/api' })   // file uploads (04-01)
  await fastify.register(workspacesRoutes, { prefix: '/api' })    // workspace CRUD + settings
  await fastify.register(configRoutes, { prefix: '/api' })        // global config + preferences
  await fastify.register(credentialsRoutes, { prefix: '/api' })   // credential management (API-06)
  await fastify.register(mcpRoutes, { prefix: '/api' })           // MCP tools (API-07, stub)
  await fastify.register(themeRoutes, { prefix: '/api' })         // theme config (API-08)
}

export default fp(apiRoutes, {
  name: 'api-routes'
})

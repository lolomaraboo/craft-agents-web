import type { FastifyPluginAsync } from 'fastify'
import { googleOAuthRoutes } from './google.js'
import { slackOAuthRoutes } from './slack.js'
import { microsoftOAuthRoutes } from './microsoft.js'

/**
 * OAuth routes plugin
 * Registers all OAuth provider routes under /oauth prefix
 *
 * Routes:
 * - /oauth/google/start
 * - /oauth/google/callback
 * - /oauth/slack/start
 * - /oauth/slack/callback
 * - /oauth/microsoft/start
 * - /oauth/microsoft/callback
 */
export const oauthRoutes: FastifyPluginAsync = async (fastify) => {
  // Register provider routes
  await fastify.register(googleOAuthRoutes)
  await fastify.register(slackOAuthRoutes)
  await fastify.register(microsoftOAuthRoutes)
}

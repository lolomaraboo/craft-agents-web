import type { FastifyPluginAsync } from 'fastify'
import type { SetupNeeds } from '@craft-agent/shared/auth/types'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/setup/needs - Get setup requirements
  // Web version uses CLI OAuth - always return configured
  fastify.get<{
    Reply: SetupNeeds
  }>('/setup/needs', async () => {
    // CLI is pre-configured with OAuth token
    return {
      needsBillingConfig: false,
      needsCredentials: false,
      isFullyConfigured: true
    }
  })

  // POST /api/auth/logout - Logout (clear auth state)
  fastify.post('/auth/logout', async () => {
    return { success: true }
  })

  // POST /api/onboarding/save - Save onboarding config
  fastify.post<{
    Body: any
    Reply: { success: boolean; error?: string; workspaceId?: string }
  }>('/onboarding/save', async (request) => {
    fastify.log.info({ body: request.body }, 'Onboarding save requested')
    return { success: true, workspaceId: 'default' }
  })

  // POST /api/oauth/mcp - Start MCP OAuth flow
  fastify.post<{
    Body: { mcpUrl: string }
    Reply: any
  }>('/oauth/mcp', async (request) => {
    return { success: false, error: 'Not implemented' }
  })

  // GET /api/logos - Get logo URL for a service
  fastify.get<{
    Querystring: { serviceUrl: string; provider?: string }
    Reply: { logoUrl: string | null }
  }>('/logos', async (request) => {
    return { logoUrl: null }
  })
}

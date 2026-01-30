import type { FastifyPluginAsync } from 'fastify'
import { getAuthState, getSetupNeeds } from '@craft-agent/shared/auth'
import type { SetupNeeds } from '@craft-agent/shared/auth/types'

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/setup/needs - Get setup requirements
  fastify.get<{
    Reply: SetupNeeds
  }>('/setup/needs', async () => {
    const authState = await getAuthState()
    const setupNeeds = getSetupNeeds(authState)
    return setupNeeds
  })

  // POST /api/auth/logout - Logout (clear auth state)
  fastify.post('/auth/logout', async () => {
    // Web version: logout is handled client-side
    // Backend doesn't maintain session state
    return { success: true }
  })

  // POST /api/onboarding/save - Save onboarding config
  // TODO: Implement onboarding save logic
  fastify.post<{
    Body: any
    Reply: { success: boolean; error?: string; workspaceId?: string }
  }>('/onboarding/save', async (request) => {
    fastify.log.info('Onboarding save requested:', request.body)
    // Stub for now
    return { success: false, error: 'Not implemented' }
  })

  // POST /api/oauth/mcp - Start MCP OAuth flow
  // TODO: Implement MCP OAuth logic
  fastify.post<{
    Body: { mcpUrl: string }
    Reply: any
  }>('/oauth/mcp', async (request) => {
    fastify.log.info('MCP OAuth requested:', request.body.mcpUrl)
    // Stub for now
    return { success: false, error: 'Not implemented' }
  })

  // GET /api/logos - Get logo URL for a service
  // TODO: Implement logo resolution logic
  fastify.get<{
    Querystring: { serviceUrl: string; provider?: string }
    Reply: { logoUrl: string | null }
  }>('/logos', async (request) => {
    fastify.log.info('Logo requested:', request.query)
    // Stub for now - return null
    return { logoUrl: null }
  })
}

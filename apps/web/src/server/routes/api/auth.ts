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

  // POST /api/auth/claude-oauth/start - Start Claude OAuth flow
  fastify.post<{
    Reply: { success: boolean; authUrl?: string; error?: string }
  }>('/auth/claude-oauth/start', async (request, reply) => {
    try {
      const { startClaudeOAuth } = await import('@craft-agent/shared/auth')
      const authUrl = await startClaudeOAuth()
      
      return { success: true, authUrl }
    } catch (error) {
      fastify.log.error('Claude OAuth start failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // POST /api/auth/claude-oauth/exchange - Exchange OAuth code for token
  fastify.post<{
    Body: { code: string }
    Reply: { success: boolean; token?: string; error?: string }
  }>('/auth/claude-oauth/exchange', async (request, reply) => {
    try {
      const { code } = request.body
      
      if (!code) {
        return { success: false, error: 'Code is required' }
      }
      
      const { exchangeClaudeCode } = await import('@craft-agent/shared/auth')
      const result = await exchangeClaudeCode(code)
      
      if (result.success) {
        return { success: true, token: result.accessToken }
      } else {
        return { success: false, error: result.error || 'Failed to exchange code' }
      }
    } catch (error) {
      fastify.log.error('Claude OAuth exchange failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  })

  // GET /api/auth/claude-oauth/state - Check if OAuth state exists
  fastify.get<{
    Reply: { hasState: boolean }
  }>('/auth/claude-oauth/state', async (request, reply) => {
    try {
      const { hasValidOAuthState } = await import('@craft-agent/shared/auth')
      const hasState = await hasValidOAuthState()
      return { hasState }
    } catch (error) {
      fastify.log.error('Check OAuth state failed:', error)
      return { hasState: false }
    }
  })

  // DELETE /api/auth/claude-oauth/state - Clear OAuth state
  fastify.delete<{
    Reply: { success: boolean }
  }>('/auth/claude-oauth/state', async (request, reply) => {
    try {
      const { clearOAuthState } = await import('@craft-agent/shared/auth')
      await clearOAuthState()
      return { success: true }
    } catch (error) {
      fastify.log.error('Clear OAuth state failed:', error)
      return { success: false }
    }
  })
}

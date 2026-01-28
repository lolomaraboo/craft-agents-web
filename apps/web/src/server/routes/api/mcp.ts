import type { FastifyPluginAsync } from 'fastify'
import { McpToolsResultSchema } from '../../schemas/mcp.js'

export const mcpRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workspaces/:workspaceId/mcp/:sourceSlug/tools - Get MCP tools for a source
  fastify.get<{
    Params: {
      workspaceId: string
      sourceSlug: string
    }
  }>('/workspaces/:workspaceId/mcp/:sourceSlug/tools', {
    schema: {
      response: {
        200: McpToolsResultSchema,
      },
    },
  }, async () => {
    // Stub implementation - actual MCP connection requires source loading infrastructure
    // This will be implemented when MCP integration is ready
    return {
      success: true,
      tools: [],
    }
  })
}

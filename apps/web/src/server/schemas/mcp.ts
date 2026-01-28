import { Type, Static } from '@sinclair/typebox'

// MCP tool metadata
export const McpToolSchema = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
  allowed: Type.Boolean(),
})

export type McpTool = Static<typeof McpToolSchema>

// MCP tools result
export const McpToolsResultSchema = Type.Object({
  success: Type.Boolean(),
  error: Type.Optional(Type.String()),
  tools: Type.Optional(Type.Array(McpToolSchema)),
})

export type McpToolsResult = Static<typeof McpToolsResultSchema>

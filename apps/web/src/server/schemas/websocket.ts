import { Type } from '@sinclair/typebox'
import type { Static } from '@sinclair/typebox'

/**
 * WebSocket Event Schemas
 *
 * TypeBox schemas for all WebSocket events exchanged between client and server.
 * Server->Client events (SessionEvent) and Client->Server events (ClientMessage).
 */

// ============================================================================
// Server -> Client Events
// ============================================================================

/**
 * Text delta event - batched text chunks during agent response
 */
export const TextDeltaEvent = Type.Object({
  type: Type.Literal('text_delta'),
  sessionId: Type.String(),
  delta: Type.String(),
  turnId: Type.Optional(Type.String())
})

/**
 * Text complete event - full text from agent (intermediate or final)
 */
export const TextCompleteEvent = Type.Object({
  type: Type.Literal('text_complete'),
  sessionId: Type.String(),
  text: Type.String(),
  isIntermediate: Type.Optional(Type.Boolean()),
  turnId: Type.Optional(Type.String())
})

/**
 * Tool start event - agent begins tool execution
 */
export const ToolStartEvent = Type.Object({
  type: Type.Literal('tool_start'),
  sessionId: Type.String(),
  toolName: Type.String(),
  toolUseId: Type.String(),
  toolInput: Type.Record(Type.String(), Type.Any()),
  toolIntent: Type.Optional(Type.String()),
  toolDisplayName: Type.Optional(Type.String()),
  turnId: Type.Optional(Type.String())
})

/**
 * Tool result event - tool execution completed
 */
export const ToolResultEvent = Type.Object({
  type: Type.Literal('tool_result'),
  sessionId: Type.String(),
  toolUseId: Type.String(),
  toolName: Type.String(),
  result: Type.String(),
  turnId: Type.Optional(Type.String()),
  isError: Type.Optional(Type.Boolean())
})

/**
 * Complete event - agent turn finished
 */
export const CompleteEvent = Type.Object({
  type: Type.Literal('complete'),
  sessionId: Type.String()
})

/**
 * Error event - error during processing
 */
export const ErrorEvent = Type.Object({
  type: Type.Literal('error'),
  sessionId: Type.String(),
  error: Type.String()
})

/**
 * Permission request event - agent needs approval for tool
 */
export const PermissionRequestEvent = Type.Object({
  type: Type.Literal('permission_request'),
  sessionId: Type.String(),
  request: Type.Object({
    requestId: Type.String(),
    toolName: Type.String(),
    command: Type.String(),
    description: Type.String()
  })
})

/**
 * Permission timeout event - permission request timed out
 */
export const PermissionTimeoutEvent = Type.Object({
  type: Type.Literal('permission_timeout'),
  sessionId: Type.String(),
  requestId: Type.String()
})

/**
 * Config changed event - global broadcast when config/theme changes
 */
export const ConfigChangedEvent = Type.Object({
  type: Type.Literal('config_changed'),
  changeType: Type.Union([Type.Literal('config'), Type.Literal('theme')])
})

/**
 * Union of all server->client events
 */
export const SessionEvent = Type.Union([
  TextDeltaEvent,
  TextCompleteEvent,
  ToolStartEvent,
  ToolResultEvent,
  CompleteEvent,
  ErrorEvent,
  PermissionRequestEvent,
  PermissionTimeoutEvent,
  ConfigChangedEvent
])

export type SessionEvent = Static<typeof SessionEvent>

// ============================================================================
// Client -> Server Messages
// ============================================================================

/**
 * Subscribe to session events
 */
export const SubscribeMessage = Type.Object({
  type: Type.Literal('subscribe'),
  sessionId: Type.String()
})

/**
 * Unsubscribe from session events
 */
export const UnsubscribeMessage = Type.Object({
  type: Type.Literal('unsubscribe'),
  sessionId: Type.String()
})

/**
 * Permission response from user
 */
export const PermissionResponseMessage = Type.Object({
  type: Type.Literal('permission_response'),
  requestId: Type.String(),
  allowed: Type.Boolean(),
  alwaysAllow: Type.Optional(Type.Boolean())
})

/**
 * Union of all client->server messages
 */
export const ClientMessage = Type.Union([
  SubscribeMessage,
  UnsubscribeMessage,
  PermissionResponseMessage
])

export type ClientMessage = Static<typeof ClientMessage>

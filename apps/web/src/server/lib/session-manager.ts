import type { Session } from '../schemas/session.js'
import type { FastifyInstance } from 'fastify'
import type { AgentEvent } from '@craft-agent/core/types'

/**
 * SessionManager wrapper for @craft-agent/shared session utilities
 *
 * Phase 2: Stub implementation with predictable mock responses
 * Phase 3: Wire up real SessionManager with event streaming
 */

/** Permission timeout constant: 60 seconds */
const PERMISSION_TIMEOUT_MS = 60000

/** Pending permission request tracking */
interface PendingPermission {
  resolve: ((allowed: boolean) => void) | null
  sessionId: string
  timeout: NodeJS.Timeout
}

export class SessionManager {
  private fastify: FastifyInstance
  private pendingPermissions: Map<string, PendingPermission> = new Map()

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
  }
  /**
   * Get all sessions across all workspaces
   */
  getSessions(): Session[] {
    // Stub: Return empty array
    return []
  }

  /**
   * Get a single session by ID with its messages
   */
  getSession(id: string): Session | null {
    // Stub: Return mock session, or null if id is 'not-found'
    if (id === 'not-found') {
      return null
    }

    return {
      id,
      workspaceId: 'mock',
      workspaceName: 'Mock Workspace',
      messages: [],
      lastMessageAt: Date.now(),
      isProcessing: false,
      createdAt: Date.now()
    }
  }

  /**
   * Create a new session
   */
  createSession(
    workspaceId: string,
    options?: {
      permissionMode?: string
      workingDirectory?: string
    }
  ): Session {
    // Stub: Return mock session
    const id = crypto.randomUUID()
    return {
      id,
      workspaceId,
      workspaceName: 'Mock Workspace',
      messages: [],
      lastMessageAt: Date.now(),
      isProcessing: false,
      createdAt: Date.now(),
      permissionMode: options?.permissionMode,
      workingDirectory: options?.workingDirectory
    }
  }

  /**
   * Delete a session
   */
  deleteSession(id: string): void {
    // Stub: Log deletion
    console.log(`Deleting session ${id}`)
  }

  /**
   * Send a message to a session
   * Phase 3: Implement event streaming for responses
   */
  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: unknown[],
    storedAttachments?: unknown[],
    options?: unknown
  ): Promise<void> {
    try {
      // Get or create agent (stub for now - will use real CraftAgent in Phase 3-02)
      const agent = await this.getOrCreateAgent(sessionId)

      // Process agent events and broadcast to subscribed clients
      for await (const event of agent) {
        this.processAgentEvent(sessionId, event)
        if (event.type === 'complete') break
      }
    } catch (error) {
      // Broadcast error and complete events
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.fastify.broadcastToSession(sessionId, {
        type: 'error',
        sessionId,
        error: errorMessage
      })
      this.fastify.broadcastToSession(sessionId, {
        type: 'complete',
        sessionId
      })
    }
  }

  /**
   * Process agent events and transform to WebSocket events
   */
  private processAgentEvent(sessionId: string, event: AgentEvent): void {
    switch (event.type) {
      case 'text_delta':
        // Queue delta for batching (50ms intervals)
        this.fastify.queueDelta(sessionId, event.text, event.turnId)
        break

      case 'text_complete':
        // Flush any pending deltas first, then broadcast complete
        this.fastify.flushDelta(sessionId)
        this.fastify.broadcastToSession(sessionId, {
          type: 'text_complete',
          sessionId,
          text: event.text,
          isIntermediate: event.isIntermediate,
          turnId: event.turnId
        })
        break

      case 'tool_start':
        this.fastify.broadcastToSession(sessionId, {
          type: 'tool_start',
          sessionId,
          toolName: event.toolName,
          toolUseId: event.toolUseId,
          toolInput: event.input,
          toolIntent: event.intent,
          toolDisplayName: event.displayName,
          turnId: event.turnId
        })
        break

      case 'tool_result':
        this.fastify.broadcastToSession(sessionId, {
          type: 'tool_result',
          sessionId,
          toolUseId: event.toolUseId,
          toolName: event.input?.toolName as string || 'unknown',
          result: event.result,
          turnId: event.turnId,
          isError: event.isError
        })
        break

      case 'complete':
        this.fastify.broadcastToSession(sessionId, {
          type: 'complete',
          sessionId
        })
        break

      case 'error':
      case 'typed_error':
        const errorMsg = event.type === 'error' ? event.message : event.error.message
        this.fastify.broadcastToSession(sessionId, {
          type: 'error',
          sessionId,
          error: errorMsg
        })
        break

      case 'permission_request':
        // Store pending permission with timeout
        const timeoutId = setTimeout(() => {
          this.autoRejectPermission(event.requestId, sessionId)
        }, PERMISSION_TIMEOUT_MS)

        this.pendingPermissions.set(event.requestId, {
          resolve: null, // Will be set by CraftAgent callback
          sessionId,
          timeout: timeoutId
        })

        // Broadcast to clients
        this.fastify.broadcastToSession(sessionId, {
          type: 'permission_request',
          sessionId,
          request: {
            requestId: event.requestId,
            toolName: event.toolName,
            command: event.command,
            description: event.description
          }
        })
        break

      // Other event types are handled internally or not broadcast
      default:
        break
    }
  }

  /**
   * Get or create agent for a session
   * Stub: Returns mock async iterator that yields test events
   * Phase 3-02: Will integrate with real CraftAgent
   */
  private async getOrCreateAgent(sessionId: string): Promise<AsyncIterable<AgentEvent>> {
    // Mock agent that yields test events
    return {
      async *[Symbol.asyncIterator]() {
        // Simulate streaming response
        yield { type: 'text_delta', text: 'Hello ', turnId: 'test-turn' } as AgentEvent
        await new Promise(resolve => setTimeout(resolve, 50))
        yield { type: 'text_delta', text: 'from ', turnId: 'test-turn' } as AgentEvent
        await new Promise(resolve => setTimeout(resolve, 50))
        yield { type: 'text_delta', text: 'the agent!', turnId: 'test-turn' } as AgentEvent
        await new Promise(resolve => setTimeout(resolve, 50))
        yield { type: 'text_complete', text: 'Hello from the agent!', turnId: 'test-turn' } as AgentEvent
        yield { type: 'complete' } as AgentEvent
      }
    }
  }

  /**
   * Respond to a permission request
   * Called when user approves/denies a permission request
   */
  respondToPermission(requestId: string, allowed: boolean, alwaysAllow?: boolean): void {
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) {
      this.fastify.log.warn({ requestId }, 'Permission response for unknown request')
      return
    }

    clearTimeout(pending.timeout)
    this.pendingPermissions.delete(requestId)

    // Forward to CraftAgent (when properly wired)
    // For now, log the response
    this.fastify.log.info({ requestId, allowed, alwaysAllow }, 'Permission response received')
  }

  /**
   * Auto-reject permission request when timeout expires
   */
  private autoRejectPermission(requestId: string, sessionId: string): void {
    const pending = this.pendingPermissions.get(requestId)
    if (!pending) return

    this.pendingPermissions.delete(requestId)
    this.fastify.log.warn({ requestId, sessionId }, 'Permission request timed out, auto-rejecting')

    // Broadcast timeout notification
    this.fastify.broadcastToSession(sessionId, {
      type: 'permission_timeout',
      sessionId,
      requestId
    })
  }

  /**
   * Cancel processing for a session
   */
  cancelProcessing(sessionId: string): { success: boolean } {
    // Stub: Return success
    return { success: true }
  }
}

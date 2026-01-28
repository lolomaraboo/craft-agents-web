import type { Session } from '../schemas/session.js'

/**
 * SessionManager wrapper for @craft-agent/shared session utilities
 *
 * Phase 2: Stub implementation with predictable mock responses
 * Phase 3: Will wire up real SessionManager with event streaming
 */
export class SessionManager {
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
   * Phase 3: Will implement event streaming for responses
   */
  sendMessage(
    sessionId: string,
    message: string,
    attachments?: unknown[],
    storedAttachments?: unknown[],
    options?: unknown
  ): void {
    // Stub: Log message sending
    console.log(`Sending message to ${sessionId}:`, message)
  }

  /**
   * Cancel processing for a session
   */
  cancelProcessing(sessionId: string): { success: boolean } {
    // Stub: Return success
    return { success: true }
  }
}

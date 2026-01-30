import type { Session } from '../schemas/session.js'
import type { FastifyInstance } from 'fastify'
import { execSync, spawn } from 'child_process'

interface ActiveSession {
  history: string
}

export class SessionManager {
  private fastify: FastifyInstance
  private activeSessions: Map<string, ActiveSession> = new Map()

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify
  }

  getSessions(): Session[] { return [] }

  getSession(id: string): Session | null {
    if (this.activeSessions.has(id)) {
      return {
        id, workspaceId: 'default', workspaceName: 'Workspace',
        messages: [], lastMessageAt: Date.now(), isProcessing: false, createdAt: Date.now()
      }
    }
    return null
  }

  createSession(workspaceId: string, options?: any): Session {
    const id = crypto.randomUUID()
    this.activeSessions.set(id, { history: '' })
    return {
      id, workspaceId, workspaceName: 'Web Workspace',
      messages: [], lastMessageAt: Date.now(), isProcessing: false, createdAt: Date.now(),
      permissionMode: options?.permissionMode, workingDirectory: options?.workingDirectory
    }
  }

  deleteSession(id: string): void { this.activeSessions.delete(id) }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const turnId = crypto.randomUUID()
    
    try {
      this.fastify.log.info({ sessionId, msg: message.substring(0,50) }, 'Calling Claude CLI')
      
      // Use execSync for simplicity - blocking but reliable
      const response = execSync(
        `claude -p ${JSON.stringify(message)} --output-format text`,
        { 
          encoding: 'utf8',
          timeout: 120000,
          env: { ...process.env, PATH: '/usr/bin:/usr/local/bin:' + process.env.PATH }
        }
      ).trim()
      
      this.fastify.log.info({ sessionId, responseLen: response.length }, 'Got response')
      
      // Send response via WebSocket
      this.fastify.queueDelta(sessionId, response, turnId)
      this.fastify.flushDelta(sessionId)
      this.fastify.broadcastToSession(sessionId, {
        type: 'text_complete', sessionId, text: response, turnId
      })
      this.fastify.broadcastToSession(sessionId, {
        type: 'complete', sessionId
      })
      
    } catch (error: any) {
      this.fastify.log.error({ sessionId, error: error.message }, 'CLI error')
      this.fastify.broadcastToSession(sessionId, {
        type: 'error', sessionId, error: error.message || 'Claude CLI error'
      })
      this.fastify.broadcastToSession(sessionId, {
        type: 'complete', sessionId
      })
    }
  }

  respondToPermission(): void {}
  cancelProcessing(): { success: boolean } { return { success: true } }
}

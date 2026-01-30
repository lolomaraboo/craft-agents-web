import type {
  WebElectronAPI,
  SessionEvent,
  FileAttachment,
  CreateSessionOptions,
  SendMessageOptions,
  ApiSetupInfo,
  PreferencesInfo,
} from '../types/electron-api.js'
import { WebSocketManager } from './websocket-manager.js'
import type { Session, Workspace, StoredAttachment } from '@craft-agent/core/types'
import type { AuthType } from '@craft-agent/shared/config'
import type { ThemeOverrides, PresetTheme } from '@craft-agent/shared/config/theme'

/**
 * HTTP adapter implementing WebElectronAPI
 *
 * Translates web-compatible ElectronAPI methods to HTTP fetch calls
 * against the Fastify server built in Phases 1-5.
 *
 * Session events are delegated to WebSocketManager for real-time updates.
 */
export class HttpAdapter implements WebElectronAPI {
  private ws: WebSocketManager
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    this.ws = new WebSocketManager()
  }

  /**
   * Connect to WebSocket for real-time events
   */
  connect(): void {
    this.ws.connect()
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.ws.disconnect()
  }

  // ============================================================================
  // Session Methods
  // ============================================================================

  async getSessions(): Promise<Session[]> {
    const response = await this.fetch('/api/sessions')
    return response.json()
  }

  async getSessionMessages(sessionId: string): Promise<Session | null> {
    try {
      const response = await this.fetch(`/api/sessions/${sessionId}`)
      return response.json()
    } catch (error) {
      // Return null on 404
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  async createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session> {
    const response = await this.fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, ...options }),
    })
    return response.json()
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
    })
  }

  async sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions
  ): Promise<void> {
    await this.fetch(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        attachments,
        storedAttachments,
        options,
      }),
    })
    // 202 Accepted - message queued for async processing
  }

  async cancelProcessing(sessionId: string, silent?: boolean): Promise<void> {
    await this.fetch(`/api/sessions/${sessionId}/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ silent }),
    })
  }

  async respondToPermission(
    sessionId: string,
    requestId: string,
    allowed: boolean,
    alwaysAllow: boolean
  ): Promise<boolean> {
    // Permission responses go via WebSocket, not HTTP
    this.ws.respondToPermission(requestId, allowed, alwaysAllow)
    return true
  }

  // ============================================================================
  // Workspace Methods
  // ============================================================================

  async getWorkspaces(): Promise<Workspace[]> {
    const response = await this.fetch('/api/workspaces')
    return response.json()
  }

  async createWorkspace(folderPath: string, name: string): Promise<Workspace> {
    const response = await this.fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, name }),
    })
    return response.json()
  }

  // ============================================================================
  // Config Methods
  // ============================================================================

  async getApiSetup(): Promise<ApiSetupInfo> {
    const response = await this.fetch('/api/config/api-setup')
    return response.json()
  }

  async updateApiSetup(
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModel?: string | null
  ): Promise<void> {
    await this.fetch('/api/config/api-setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authType,
        credential,
        anthropicBaseUrl,
        customModel,
      }),
    })
  }

  async getModel(): Promise<string | null> {
    const response = await this.fetch('/api/config/model')
    const data = await response.json()
    return data.model
  }

  async setModel(model: string): Promise<void> {
    await this.fetch('/api/config/model', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    })
  }

  async readPreferences(): Promise<PreferencesInfo> {
    const response = await this.fetch('/api/config/preferences')
    const prefs = await response.json()

    // Transform server response to match PreferencesInfo format
    return {
      content: JSON.stringify(prefs, null, 2),
      exists: Object.keys(prefs).length > 0,
      path: '~/.craft-agent/preferences.json', // Server-side path
    }
  }

  async writePreferences(content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const prefs = JSON.parse(content)
      await this.fetch('/api/config/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  // ============================================================================
  // Theme Methods
  // ============================================================================

  async getColorTheme(): Promise<string> {
    const response = await this.fetch('/api/theme/color')
    const data = await response.json()
    return data.themeId
  }

  async setColorTheme(themeId: string): Promise<void> {
    await this.fetch('/api/theme/color', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
    })
  }

  async loadPresetThemes(): Promise<PresetTheme[]> {
    const response = await this.fetch('/api/theme/presets')
    const data = await response.json()
    return data.presets || []
  }

  async getAppTheme(): Promise<ThemeOverrides | null> {
    try {
      const response = await this.fetch('/api/theme')
      return response.json()
    } catch {
      return null
    }
  }

  // ============================================================================
  // Event Methods
  // ============================================================================

  onSessionEvent(callback: (event: SessionEvent) => void): () => void {
    return this.ws.subscribe(callback)
  }

  subscribeToSession(sessionId: string): void {
    this.ws.subscribeToSession(sessionId)
  }

  unsubscribeFromSession(sessionId: string): void {
    this.ws.unsubscribeFromSession(sessionId)
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Fetch wrapper that adds baseUrl and throws on non-ok responses
   */
  private async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, options)

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return response
  }
}

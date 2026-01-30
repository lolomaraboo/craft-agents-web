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

  async loadPresetTheme(themeId: string): Promise<any | null> {
    try {
      const response = await this.fetch(`/api/theme/presets/${themeId}`)
      return response.json()
    } catch {
      return null
    }
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
  async isDebugMode(): Promise<boolean> {
    // Web version always returns false (no debug mode like Electron dev mode)
    return false
  }

  async getWindowWorkspace(): Promise<string | null> {
    // Web version: Get the first workspace ID from the list
    // In Electron, each window has a workspace ID, but in web we use a single session
    const workspaces = await this.getWorkspaces()
    return workspaces.length > 0 ? workspaces[0].id : null
  }

  async getWindowMode(): Promise<string | null> {
    // Web version always runs in main mode (no tab-content mode)
    return 'main'
  }

  async openWorkspace(workspaceId: string): Promise<void> {
    // Web version: no-op, workspace switching handled client-side
    console.log('[HttpAdapter] openWorkspace called:', workspaceId)
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    // Web version: no-op, workspace state managed in React
    console.log('[HttpAdapter] switchWorkspace called:', workspaceId)
  }

  async checkGitBash(): Promise<{ found: boolean; path: string | null; platform: 'win32' | 'darwin' | 'linux' }> {
    // Web version: Git Bash doesn't apply, return not found
    return {
      found: false,
      path: null,
      platform: 'linux' // arbitrary since it doesn't matter for web
    }
  }

  async browseForGitBash(): Promise<string | null> {
    // Web version: no file browser for Git Bash
    return null
  }

  async setGitBashPath(path: string): Promise<{ success: boolean; error?: string }> {
    // Web version: no-op
    return { success: false, error: 'Git Bash not supported in web version' }
  }

  onAppThemeChange(callback: (theme: any) => void): () => void {
    // Web version: theme changes handled via React state, not IPC events
    // Return no-op cleanup function
    return () => {}
  }

  async getLogoUrl(serviceUrl: string, provider?: string): Promise<string | null> {
    // Web version: delegate to backend API
    try {
      const params = new URLSearchParams({ serviceUrl })
      if (provider) params.append('provider', provider)
      const response = await this.fetch(`/api/logos?${params}`)
      const data = await response.json()
      return data.logoUrl || null
    } catch {
      return null
    }
  }

  // ============================================================================
  async getSetupNeeds(): Promise<any> {
    // Web version: delegate to backend
    const response = await this.fetch('/api/setup/needs')
    return response.json()
  }

  async logout(): Promise<void> {
    // Web version: clear auth state via API
    await this.fetch('/api/auth/logout', { method: 'POST' })
  }

  async saveOnboardingConfig(config: any): Promise<any> {
    // Web version: delegate to backend
    const response = await this.fetch('/api/onboarding/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    return response.json()
  }

  async startWorkspaceMcpOAuth(mcpUrl: string): Promise<any> {
    // Web version: delegate to backend
    const response = await this.fetch('/api/oauth/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpUrl }),
    })
    return response.json()
  }

  onMenuNewChat(callback: () => void): () => void {
    // Web version: no menu events, return no-op cleanup
    return () => {}
  }

  onMenuOpenSettings(callback: () => void): () => void {
    // Web version: no menu events, return no-op cleanup
    return () => {}
  }

  onMenuKeyboardShortcuts(callback: () => void): () => void {
    // Web version: no menu events, return no-op cleanup
    return () => {}
  }

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

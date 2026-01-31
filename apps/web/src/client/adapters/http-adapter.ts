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
 * HTTP adapter implementing the FULL ElectronAPI interface
 * All Electron-specific methods return sensible defaults for web
 */
export class HttpAdapter {
  private ws: WebSocketManager
  private baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
    this.ws = new WebSocketManager()
  }

  connect(): void { this.ws.connect() }
  disconnect(): void { this.ws.disconnect() }

  // ========== Session Management ==========
  async getSessions(): Promise<Session[]> {
    const response = await this.fetch('/api/sessions')
    const data = await response.json(); return data.data || data || []
  }

  async getSessionMessages(sessionId: string): Promise<Session | null> {
    try {
      const response = await this.fetch(`/api/sessions/${sessionId}`)
      const data = await response.json(); return data.data || data || []
    } catch { return null }
  }

  async createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session> {
    const response = await this.fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, ...options }),
    })
    const data = await response.json()
    const session = data.data || data || []
    
    // Subscribe to WebSocket updates for this session
    if (session.id) {
      this.ws.subscribeToSession(session.id)
    }
    
    return session
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
  }

  async sendMessage(sessionId: string, message: string, attachments?: FileAttachment[], storedAttachments?: StoredAttachment[], options?: SendMessageOptions): Promise<void> { console.log("[HttpAdapter] sendMessage called", { sessionId, message: message.substring(0,50), hasAttachments: !!attachments });
    await this.fetch(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, attachments, storedAttachments, options }),
    })
  }

  async cancelProcessing(sessionId: string, silent?: boolean): Promise<void> {
    await this.fetch(`/api/sessions/${sessionId}/abort`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ silent }),
    })
  }

  async killShell(sessionId: string, shellId: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: 'Not supported in web' }
  }

  async getTaskOutput(taskId: string): Promise<string | null> { return null }

  async respondToPermission(sessionId: string, requestId: string, allowed: boolean, alwaysAllow: boolean): Promise<boolean> {
    this.ws.respondToPermission(requestId, allowed, alwaysAllow)
    return true
  }

  async respondToCredential(sessionId: string, requestId: string, response: any): Promise<boolean> { return true }
  async sessionCommand(sessionId: string, command: any): Promise<void> {}
  async getPendingPlanExecution(sessionId: string): Promise<any> { return null }

  // ========== Workspace Management ==========
  async getWorkspaces(): Promise<Workspace[]> {
    const response = await this.fetch('/api/workspaces')
    const data = await response.json(); return data.data || data || []
  }

  async createWorkspace(folderPath: string, name: string): Promise<Workspace> {
    const response = await this.fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath, name }),
    })
    const data = await response.json(); return data.data || data || []
  }

  async checkWorkspaceSlug(slug: string): Promise<{ exists: boolean; path: string }> {
    return { exists: false, path: '' }
  }

  // ========== Window Management ==========
  async getWindowWorkspace(): Promise<string | null> {
    const workspaces = await this.getWorkspaces()
    return workspaces.length > 0 ? workspaces[0].id : null
  }

  async getWindowMode(): Promise<string | null> { return 'main' }
  async openWorkspace(workspaceId: string): Promise<void> {}
  async openSessionInNewWindow(workspaceId: string, sessionId: string): Promise<void> {
    window.open(`${window.location.origin}/session/${sessionId}`, '_blank')
  }
  async switchWorkspace(workspaceId: string): Promise<void> {}
  async closeWindow(): Promise<void> { window.close() }
  async confirmCloseWindow(): Promise<void> { window.close() }
  onCloseRequested(callback: () => void): () => void { return () => {} }
  async setTrafficLightsVisible(visible: boolean): Promise<void> {}

  // ========== Event Listeners ==========
  onSessionEvent(callback: (event: SessionEvent) => void): () => void {
    return this.ws.subscribe(callback)
  }
  subscribeToSession(sessionId: string): void { this.ws.subscribeToSession(sessionId) }
  unsubscribeFromSession(sessionId: string): void { this.ws.unsubscribeFromSession(sessionId) }

  // ========== File Operations ==========
  async readFile(path: string): Promise<string> { return '' }
  async openFileDialog(): Promise<string[]> { return [] }
  async readFileAttachment(path: string): Promise<FileAttachment | null> { return null }
  async storeAttachment(sessionId: string, attachment: FileAttachment): Promise<StoredAttachment> {
    return {} as StoredAttachment
  }
  async generateThumbnail(base64: string, mimeType: string): Promise<string | null> { return null }
  async searchFiles(basePath: string, query: string): Promise<any[]> { return [] }
  debugLog(...args: unknown[]): void { console.log('[Web Debug]', ...args) }

  // ========== Theme & System ==========
  async getSystemTheme(): Promise<boolean> {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  onSystemThemeChange(callback: (isDark: boolean) => void): () => void {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => callback(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }
  getVersions(): { node: string; chrome: string; electron: string } {
    return { node: 'web', chrome: navigator.userAgent, electron: 'web' }
  }
  async getHomeDir(): Promise<string> { return '/home/user' }
  async isDebugMode(): Promise<boolean> { return false }

  // ========== Auto-update (not applicable) ==========
  async checkForUpdates(): Promise<any> { return { available: false, currentVersion: '1.0.0', latestVersion: '1.0.0', downloadState: 'idle', downloadProgress: 0 } }
  async getUpdateInfo(): Promise<any> { return this.checkForUpdates() }
  async installUpdate(): Promise<void> {}
  async dismissUpdate(version: string): Promise<void> {}
  async getDismissedUpdateVersion(): Promise<string | null> { return null }
  onUpdateAvailable(callback: (info: any) => void): () => void { return () => {} }
  onUpdateDownloadProgress(callback: (progress: number) => void): () => void { return () => {} }

  // ========== Shell Operations ==========
  async openUrl(url: string): Promise<void> { window.open(url, '_blank') }
  async openFile(path: string): Promise<void> { window.open(path, '_blank') }
  async showInFolder(path: string): Promise<void> {}

  // ========== Menu Events ==========
  onMenuNewChat(callback: () => void): () => void { return () => {} }
  onMenuOpenSettings(callback: () => void): () => void { return () => {} }
  onMenuKeyboardShortcuts(callback: () => void): () => void { return () => {} }
  onDeepLinkNavigate(callback: (nav: any) => void): () => void { return () => {} }

  // ========== Auth ==========
  async showLogoutConfirmation(): Promise<boolean> { return confirm('Are you sure you want to logout?') }
  async showDeleteSessionConfirmation(name: string): Promise<boolean> { return confirm(`Delete session ${name}?`) }
  async logout(): Promise<void> { await this.fetch('/api/auth/logout', { method: 'POST' }) }
  async getAuthState(): Promise<any> { return {} }
  async getSetupNeeds(): Promise<any> {
    const response = await this.fetch('/api/setup/needs')
    const data = await response.json(); return data.data || data || []
  }
  async startWorkspaceMcpOAuth(mcpUrl: string): Promise<any> { return { success: false, error: 'Not implemented' } }
  async saveOnboardingConfig(config: any): Promise<any> { return { success: false, error: 'Not implemented' } }
  async startClaudeOAuth(): Promise<any> {
    const response = await this.fetch('/api/auth/claude-oauth/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const data = await response.json(); return data.data || data || []
  }
  async exchangeClaudeCode(code: string): Promise<any> {
    const response = await this.fetch('/api/auth/claude-oauth/exchange', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
    const data = await response.json(); return data.data || data || []
  }
  async hasClaudeOAuthState(): Promise<boolean> { return false }
  async clearClaudeOAuthState(): Promise<{ success: boolean }> { return { success: true } }

  // ========== Settings ==========
  async getApiSetup(): Promise<ApiSetupInfo> {
    const response = await this.fetch('/api/config/api-setup')
    const data = await response.json(); return data.data || data || []
  }
  async updateApiSetup(authType: AuthType, credential?: string, anthropicBaseUrl?: string | null, customModel?: string | null): Promise<void> {
    await this.fetch('/api/config/api-setup', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authType, credential, anthropicBaseUrl, customModel }) })
  }
  async testApiConnection(apiKey: string, baseUrl?: string, modelName?: string): Promise<{ success: boolean; error?: string; modelCount?: number }> {
    return { success: true }
  }
  async getModel(): Promise<string | null> {
    const response = await this.fetch('/api/config/model')
    const data = await response.json()
    return data.model
  }
  async setModel(model: string): Promise<void> {
    await this.fetch('/api/config/model', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model }) })
  }
  async getSessionModel(sessionId: string, workspaceId: string): Promise<string | null> { return null }
  async setSessionModel(sessionId: string, workspaceId: string, model: string | null): Promise<void> {}
  async getWorkspaceSettings(workspaceId: string): Promise<any> { return {} }
  async updateWorkspaceSetting(workspaceId: string, key: string, value: any): Promise<void> {}
  async openFolderDialog(): Promise<string | null> { return null }
  async readPreferences(): Promise<PreferencesInfo> {
    const response = await this.fetch('/api/config/preferences')
    const prefs = await response.json()
    return { content: JSON.stringify(prefs, null, 2), exists: Object.keys(prefs).length > 0, path: '~/.craft-agent/preferences.json' }
  }
  async writePreferences(content: string): Promise<{ success: boolean; error?: string }> {
    try {
      const prefs = JSON.parse(content)
      await this.fetch('/api/config/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) })
      return { success: true }
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : String(error) } }
  }

  // ========== Session Drafts ==========
  async getDraft(sessionId: string): Promise<string | null> { return null }
  async setDraft(sessionId: string, text: string): Promise<void> {}
  async deleteDraft(sessionId: string): Promise<void> {}
  async getAllDrafts(): Promise<Record<string, string>> { return {} }

  // ========== Session Info Panel ==========
  async getSessionFiles(sessionId: string): Promise<any[]> { return [] }
  async getSessionNotes(sessionId: string): Promise<string> { return '' }
  async setSessionNotes(sessionId: string, content: string): Promise<void> {}
  async watchSessionFiles(sessionId: string): Promise<void> {}
  async unwatchSessionFiles(): Promise<void> {}
  onSessionFilesChanged(callback: (sessionId: string) => void): () => void { return () => {} }

  // ========== Sources ==========
  async getSources(workspaceId: string): Promise<any[]> {
    try {
      const response = await this.fetch(`/api/workspaces/${workspaceId}/sources`)
      const data = await response.json(); return data.data || data || []
    } catch { return [] }
  }
  async createSource(workspaceId: string, config: any): Promise<any> { return config }
  async deleteSource(workspaceId: string, sourceSlug: string): Promise<void> {}
  async startSourceOAuth(workspaceId: string, sourceSlug: string): Promise<any> { return { success: false, error: 'Not implemented' } }
  async saveSourceCredentials(workspaceId: string, sourceSlug: string, credential: string): Promise<void> {}
  async getSourcePermissionsConfig(workspaceId: string, sourceSlug: string): Promise<any> { return null }
  async getWorkspacePermissionsConfig(workspaceId: string): Promise<any> { return null }
  async getDefaultPermissionsConfig(): Promise<any> { return { config: null, path: '' } }
  async getMcpTools(workspaceId: string, sourceSlug: string): Promise<any> { return { tools: [] } }
  onSourcesChanged(callback: (sources: any[]) => void): () => void { return () => {} }
  onDefaultPermissionsChanged(callback: () => void): () => void { return () => {} }

  // ========== Skills ==========
  async getSkills(workspaceId: string): Promise<any[]> {
    try {
      const response = await this.fetch(`/api/workspaces/${workspaceId}/skills`)
      const data = await response.json(); return data.data || data || []
    } catch { return [] }
  }
  async getSkillFiles(workspaceId: string, skillSlug: string): Promise<any[]> { return [] }
  async deleteSkill(workspaceId: string, skillSlug: string): Promise<void> {}
  async openSkillInEditor(workspaceId: string, skillSlug: string): Promise<void> {}
  async openSkillInFinder(workspaceId: string, skillSlug: string): Promise<void> {}
  onSkillsChanged(callback: (skills: any[]) => void): () => void { return () => {} }

  // ========== Statuses ==========
  async listStatuses(workspaceId: string): Promise<any[]> { return [] }
  async reorderStatuses(workspaceId: string, orderedIds: string[]): Promise<void> {}
  onStatusesChanged(callback: (workspaceId: string) => void): () => void { return () => {} }

  // ========== Labels ==========
  async listLabels(workspaceId: string): Promise<any[]> { return [] }
  async createLabel(workspaceId: string, input: any): Promise<any> { return input }
  async deleteLabel(workspaceId: string, labelId: string): Promise<{ stripped: number }> { return { stripped: 0 } }
  onLabelsChanged(callback: (workspaceId: string) => void): () => void { return () => {} }

  // ========== Views ==========
  async listViews(workspaceId: string): Promise<any[]> { return [] }
  async saveViews(workspaceId: string, views: any[]): Promise<void> {}

  // ========== Workspace Images ==========
  async readWorkspaceImage(workspaceId: string, relativePath: string): Promise<string> { return '' }
  async writeWorkspaceImage(workspaceId: string, relativePath: string, base64: string, mimeType: string): Promise<void> {}

  // ========== Theme ==========
  async getAppTheme(): Promise<ThemeOverrides | null> {
    try {
      const response = await this.fetch('/api/theme')
      const data = await response.json(); return data.data || data || []
    } catch { return null }
  }
  async loadPresetThemes(): Promise<PresetTheme[]> {
    const response = await this.fetch('/api/theme/presets')
    const data = await response.json()
    return data.presets || []
  }
  async loadPresetTheme(themeId: string): Promise<any> {
    try {
      const response = await this.fetch(`/api/theme/presets/${themeId}`)
      const data = await response.json(); return data.data || data || []
    } catch { return null }
  }
  async getColorTheme(): Promise<string> {
    const response = await this.fetch('/api/theme/color')
    const data = await response.json()
    return data.themeId
  }
  async setColorTheme(themeId: string): Promise<void> {
    await this.fetch('/api/theme/color', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ themeId }) })
  }
  onAppThemeChange(callback: (theme: any) => void): () => void { return () => {} }

  // ========== Logo URL ==========
  async getLogoUrl(serviceUrl: string, provider?: string): Promise<string | null> { return null }

  // ========== Notifications ==========
  async showNotification(title: string, body: string, workspaceId: string, sessionId: string): Promise<void> {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body })
    }
  }
  async getNotificationsEnabled(): Promise<boolean> { return false }
  async setNotificationsEnabled(enabled: boolean): Promise<void> {}
  async updateBadgeCount(count: number): Promise<void> {}
  async clearBadgeCount(): Promise<void> {}
  async setDockIconWithBadge(dataUrl: string): Promise<void> {}
  onBadgeDraw(callback: (data: any) => void): () => void { return () => {} }
  async getWindowFocusState(): Promise<boolean> { return document.hasFocus() }
  onWindowFocusChange(callback: (isFocused: boolean) => void): () => void {
    const handler = () => callback(document.hasFocus())
    window.addEventListener('focus', handler)
    window.addEventListener('blur', handler)
    return () => { window.removeEventListener('focus', handler); window.removeEventListener('blur', handler) }
  }
  onNotificationNavigate(callback: (data: any) => void): () => void { return () => {} }
  async broadcastThemePreferences(preferences: any): Promise<void> {}
  onThemePreferencesChange(callback: (preferences: any) => void): () => void { return () => {} }

  // ========== Git ==========
  async getGitBranch(dirPath: string): Promise<string | null> { return null }
  async checkGitBash(): Promise<any> { return { found: false, path: null, platform: 'linux' } }
  async browseForGitBash(): Promise<string | null> { return null }
  async setGitBashPath(path: string): Promise<{ success: boolean; error?: string }> { return { success: false, error: 'Not supported' } }

  // ========== Menu Actions ==========
  async menuQuit(): Promise<void> { window.close() }
  async menuNewWindow(): Promise<void> { window.open(window.location.href, '_blank') }
  async menuMinimize(): Promise<void> {}
  async menuMaximize(): Promise<void> {}
  async menuZoomIn(): Promise<void> {}
  async menuZoomOut(): Promise<void> {}
  async menuZoomReset(): Promise<void> {}
  async menuToggleDevTools(): Promise<void> {}
  async menuUndo(): Promise<void> { document.execCommand('undo') }
  async menuRedo(): Promise<void> { document.execCommand('redo') }
  async menuCut(): Promise<void> { document.execCommand('cut') }
  async menuCopy(): Promise<void> { document.execCommand('copy') }
  async menuPaste(): Promise<void> { document.execCommand('paste') }
  async menuSelectAll(): Promise<void> { document.execCommand('selectAll') }

  // ========== Fetch Helper ==========
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

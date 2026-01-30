import type { Session, Workspace, StoredAttachment } from '@craft-agent/core/types'
import type { AuthType } from '@craft-agent/shared/config'
import type { ThemeOverrides, PresetTheme } from '@craft-agent/shared/config/theme'

/**
 * Session event types from server WebSocket
 * Matches server schemas in apps/web/src/server/schemas/websocket.ts
 */
export type SessionEvent =
  | {
      type: 'text_delta'
      sessionId: string
      delta: string
      turnId?: string
    }
  | {
      type: 'text_complete'
      sessionId: string
      text: string
      isIntermediate?: boolean
      turnId?: string
    }
  | {
      type: 'tool_start'
      sessionId: string
      toolName: string
      toolUseId: string
      toolInput: Record<string, any>
      toolIntent?: string
      toolDisplayName?: string
      turnId?: string
    }
  | {
      type: 'tool_result'
      sessionId: string
      toolUseId: string
      toolName: string
      result: string
      turnId?: string
      isError?: boolean
    }
  | {
      type: 'complete'
      sessionId: string
    }
  | {
      type: 'error'
      sessionId: string
      error: string
    }
  | {
      type: 'permission_request'
      sessionId: string
      request: {
        requestId: string
        toolName: string
        command: string
        description: string
      }
    }
  | {
      type: 'permission_timeout'
      sessionId: string
      requestId: string
    }
  | {
      type: 'config_changed'
      changeType: 'config' | 'theme'
    }

/**
 * FileAttachment for uploads (base64 encoded)
 */
export interface FileAttachment {
  name: string
  base64: string
  mimeType: string
}

/**
 * Options for creating a session
 */
export interface CreateSessionOptions {
  permissionMode?: string
  workingDirectory?: string
}

/**
 * Options for sending a message
 */
export interface SendMessageOptions {
  thinkingLevel?: string
  model?: string
}

/**
 * API setup info
 */
export interface ApiSetupInfo {
  authType: AuthType
  hasCredential: boolean
  anthropicBaseUrl?: string
  customModel?: string
}

/**
 * User preferences file info
 */
export interface PreferencesInfo {
  content: string
  exists: boolean
  path: string
}

/**
 * Web-compatible subset of ElectronAPI
 * Excludes: file dialogs, window management, auto-update, menu actions,
 * shell operations, notifications, and other Electron-specific methods
 */
export interface WebElectronAPI {
  // Session management
  getSessions(): Promise<Session[]>
  getSessionMessages(sessionId: string): Promise<Session | null>
  createSession(workspaceId: string, options?: CreateSessionOptions): Promise<Session>
  deleteSession(sessionId: string): Promise<void>
  sendMessage(
    sessionId: string,
    message: string,
    attachments?: FileAttachment[],
    storedAttachments?: StoredAttachment[],
    options?: SendMessageOptions
  ): Promise<void>
  cancelProcessing(sessionId: string, silent?: boolean): Promise<void>
  respondToPermission(sessionId: string, requestId: string, allowed: boolean, alwaysAllow: boolean): Promise<boolean>

  // Workspace management
  getWorkspaces(): Promise<Workspace[]>
  createWorkspace(folderPath: string, name: string): Promise<Workspace>

  // Config
  getApiSetup(): Promise<ApiSetupInfo>
  updateApiSetup(
    authType: AuthType,
    credential?: string,
    anthropicBaseUrl?: string | null,
    customModel?: string | null
  ): Promise<void>
  getModel(): Promise<string | null>
  setModel(model: string): Promise<void>
  readPreferences(): Promise<PreferencesInfo>
  writePreferences(content: string): Promise<{ success: boolean; error?: string }>

  // Theme
  getColorTheme(): Promise<string>
  setColorTheme(themeId: string): Promise<void>
  loadPresetThemes(): Promise<PresetTheme[]>
  getAppTheme(): Promise<ThemeOverrides | null>

  // Event listeners
  onSessionEvent(callback: (event: SessionEvent) => void): () => void
  subscribeToSession(sessionId: string): void
  unsubscribeFromSession(sessionId: string): void
}

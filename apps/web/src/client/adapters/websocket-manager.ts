import type { SessionEvent } from '../types/electron-api.js'

/**
 * Client->Server message types
 */
interface SubscribeMessage {
  type: 'subscribe'
  sessionId: string
}

interface UnsubscribeMessage {
  type: 'unsubscribe'
  sessionId: string
}

interface PermissionResponseMessage {
  type: 'permission_response'
  requestId: string
  allowed: boolean
  alwaysAllow?: boolean
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PermissionResponseMessage

/**
 * WebSocket connection manager with auto-reconnection
 *
 * Handles:
 * - WebSocket connection to /ws endpoint
 * - Event routing to registered callbacks
 * - Session subscriptions/unsubscriptions
 * - Auto-reconnection with exponential backoff
 * - Permission responses
 */
export class WebSocketManager {
  private ws: WebSocket | null = null
  private callbacks: Set<(event: SessionEvent) => void> = new Set()
  private subscribedSessions: Set<string> = new Set()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Connect to WebSocket endpoint
   */
  connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return
    }

    // Determine protocol (ws:// or wss://)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`

    console.log('[WebSocketManager] Connecting to', wsUrl)
    this.ws = new WebSocket(wsUrl)

    this.ws.onopen = () => {
      console.log('[WebSocketManager] Connected')
      this.reconnectAttempts = 0

      // Re-subscribe to all sessions
      for (const sessionId of this.subscribedSessions) {
        this.sendMessage({ type: 'subscribe', sessionId })
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const sessionEvent = JSON.parse(event.data) as SessionEvent
        // Route event to all registered callbacks
        for (const callback of this.callbacks) {
          callback(sessionEvent)
        }
      } catch (error) {
        console.error('[WebSocketManager] Failed to parse message:', error)
      }
    }

    this.ws.onclose = () => {
      console.log('[WebSocketManager] Disconnected')
      this.ws = null
      this.attemptReconnect()
    }

    this.ws.onerror = (error) => {
      console.error('[WebSocketManager] Error:', error)
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocketManager] Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[WebSocketManager] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, delay)
  }

  /**
   * Subscribe to session events
   * @returns Cleanup function to unsubscribe
   */
  subscribe(callback: (event: SessionEvent) => void): () => void {
    this.callbacks.add(callback)

    // Connect if not already connected
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect()
    }

    // Return cleanup function
    return () => {
      this.callbacks.delete(callback)
    }
  }

  /**
   * Subscribe to a specific session's events
   */
  subscribeToSession(sessionId: string): void {
    this.subscribedSessions.add(sessionId)
    this.sendMessage({ type: 'subscribe', sessionId })
  }

  /**
   * Unsubscribe from a specific session's events
   */
  unsubscribeFromSession(sessionId: string): void {
    this.subscribedSessions.delete(sessionId)
    this.sendMessage({ type: 'unsubscribe', sessionId })
  }

  /**
   * Respond to a permission request
   */
  respondToPermission(requestId: string, allowed: boolean, alwaysAllow?: boolean): void {
    this.sendMessage({
      type: 'permission_response',
      requestId,
      allowed,
      alwaysAllow,
    })
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocketManager] Cannot send message, not connected:', message)
      return
    }

    this.ws.send(JSON.stringify(message))
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.callbacks.clear()
    this.subscribedSessions.clear()
    this.reconnectAttempts = 0
  }
}

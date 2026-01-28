import type { WebSocket } from 'ws'
import type { SessionEvent } from '../schemas/websocket.js'

/**
 * WebSocket Event Broadcasting System
 *
 * Provides session-scoped connection tracking and event broadcasting with delta batching.
 *
 * Architecture:
 * - sessionClients: Map<sessionId, Set<WebSocket>> - tracks all clients subscribed to each session
 * - socketSessions: WeakMap<WebSocket, Set<sessionId>> - tracks all sessions each socket is subscribed to
 * - Delta batching: 50ms intervals to reduce message overhead
 */

// ============================================================================
// Session-scoped connection tracking
// ============================================================================

/**
 * Maps session IDs to sets of WebSocket clients subscribed to that session
 */
const sessionClients = new Map<string, Set<WebSocket>>()

/**
 * WeakMap tracking which sessions each socket is subscribed to
 * (for cleanup on disconnect)
 */
const socketSessions = new WeakMap<WebSocket, Set<string>>()

/**
 * Subscribe a WebSocket client to a session
 */
export function subscribeToSession(sessionId: string, socket: WebSocket): void {
  // Add socket to session's client set
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set())
  }
  sessionClients.get(sessionId)!.add(socket)

  // Track this session in socket's session set
  let sessions = socketSessions.get(socket)
  if (!sessions) {
    sessions = new Set()
    socketSessions.set(socket, sessions)
  }
  sessions.add(sessionId)

  console.log(`[websocket] Client subscribed to session ${sessionId}`)
}

/**
 * Unsubscribe a WebSocket client from a session
 */
export function unsubscribeFromSession(sessionId: string, socket: WebSocket): void {
  // Remove socket from session's client set
  const clients = sessionClients.get(sessionId)
  if (clients) {
    clients.delete(socket)
    if (clients.size === 0) {
      sessionClients.delete(sessionId)
    }
  }

  // Remove session from socket's session set
  const sessions = socketSessions.get(socket)
  if (sessions) {
    sessions.delete(sessionId)
  }

  console.log(`[websocket] Client unsubscribed from session ${sessionId}`)
}

/**
 * Clean up all session subscriptions for a disconnected socket
 */
export function cleanupSocket(socket: WebSocket): void {
  const sessions = socketSessions.get(socket)
  if (!sessions) return

  // Unsubscribe from all sessions
  for (const sessionId of sessions) {
    const clients = sessionClients.get(sessionId)
    if (clients) {
      clients.delete(socket)
      if (clients.size === 0) {
        sessionClients.delete(sessionId)
      }
    }
  }

  socketSessions.delete(socket)
  console.log(`[websocket] Cleaned up socket subscriptions`)
}

/**
 * Broadcast an event to all clients subscribed to a session
 */
export function broadcastToSession(sessionId: string, event: SessionEvent): void {
  const clients = sessionClients.get(sessionId)
  if (!clients || clients.size === 0) {
    return
  }

  const message = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN = 1
      client.send(message)
    }
  }
}

/**
 * Broadcast an event to all connected WebSocket clients (global)
 * Used for config_changed events
 */
export function broadcastGlobal(event: SessionEvent): void {
  const message = JSON.stringify(event)

  // Iterate through all session client sets
  for (const clients of sessionClients.values()) {
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(message)
      }
    }
  }
}

// ============================================================================
// Delta batching (50ms intervals)
// ============================================================================

interface PendingDelta {
  delta: string
  turnId?: string
}

/**
 * Maps session IDs to accumulated delta text
 */
const pendingDeltas = new Map<string, PendingDelta>()

/**
 * Maps session IDs to flush timer handles
 */
const deltaFlushTimers = new Map<string, NodeJS.Timeout>()

/**
 * Queue a delta for batching, schedule flush if not already scheduled
 */
export function queueDelta(sessionId: string, delta: string, turnId?: string): void {
  // Accumulate delta
  const existing = pendingDeltas.get(sessionId)
  if (existing) {
    existing.delta += delta
    // Update turnId if provided (should be consistent within a turn)
    if (turnId) {
      existing.turnId = turnId
    }
  } else {
    pendingDeltas.set(sessionId, { delta, turnId })
  }

  // Schedule flush if not already scheduled
  if (!deltaFlushTimers.has(sessionId)) {
    const timer = setTimeout(() => {
      flushDelta(sessionId)
    }, 50) // 50ms batching interval
    deltaFlushTimers.set(sessionId, timer)
  }
}

/**
 * Flush accumulated delta for a session, clear timer
 */
export function flushDelta(sessionId: string): void {
  const pending = pendingDeltas.get(sessionId)
  if (!pending) return

  // Broadcast batched delta
  broadcastToSession(sessionId, {
    type: 'text_delta',
    sessionId,
    delta: pending.delta,
    turnId: pending.turnId
  })

  // Clear pending state
  pendingDeltas.delete(sessionId)

  const timer = deltaFlushTimers.get(sessionId)
  if (timer) {
    clearTimeout(timer)
    deltaFlushTimers.delete(sessionId)
  }
}

import { useEffect, useCallback } from 'react'
import type { SessionEvent } from '../types'

/**
 * Subscribe to WebSocket session events with automatic cleanup.
 * Re-subscribes when sessionId changes.
 *
 * @param sessionId - Session to subscribe to (null to skip)
 * @param onEvent - Callback for events matching this session
 */
export function useSessionEvents(
  sessionId: string | null,
  onEvent: (event: SessionEvent) => void
): void {
  const stableOnEvent = useCallback(onEvent, [onEvent])

  useEffect(() => {
    if (!sessionId) return

    const api = (window as any).electronAPI
    if (!api) {
      console.warn('[useSessionEvents] electronAPI not initialized')
      return
    }

    // Subscribe to session-scoped events
    api.subscribeToSession?.(sessionId)

    // Register global event handler that filters by sessionId
    const cleanup = api.onSessionEvent?.((event: SessionEvent) => {
      // Check if event has sessionId and matches
      if ('sessionId' in event && event.sessionId === sessionId) {
        stableOnEvent(event)
      }
      // config_changed events don't have sessionId, pass through
      if (event.type === 'config_changed') {
        stableOnEvent(event)
      }
    })

    return () => {
      cleanup?.()
      api.unsubscribeFromSession?.(sessionId)
    }
  }, [sessionId, stableOnEvent])
}

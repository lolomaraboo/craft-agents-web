import React, { useState, useEffect, useCallback } from 'react'
import { NetworkErrorBoundary, LoadingState } from './components'
import { useApiClient } from './hooks'
import type { SessionEvent } from './types'

function AppContent() {
  const api = useApiClient()
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [sessions, setSessions] = useState<any[]>([])
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [lastEvent, setLastEvent] = useState<SessionEvent | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)

        const [sessionsData, workspacesData] = await Promise.all([
          api.getSessions(),
          api.getWorkspaces()
        ])

        setSessions(sessionsData)
        setWorkspaces(workspacesData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [api])

  // Subscribe to WebSocket events
  useEffect(() => {
    setConnectionStatus('connecting')

    const cleanup = api.onSessionEvent((event) => {
      setConnectionStatus('connected')
      setLastEvent(event)
      console.log('[App] WebSocket event:', event)
    })

    // Mark connected after subscription setup
    setTimeout(() => {
      // If no events received, still show as connected (WS open)
      setConnectionStatus('connected')
    }, 1000)

    return cleanup
  }, [api])

  const handleRetry = useCallback(() => {
    setError(null)
    setIsLoading(true)
    Promise.all([api.getSessions(), api.getWorkspaces()])
      .then(([s, w]) => {
        setSessions(s)
        setWorkspaces(w)
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [api])

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
        <h1>Craft Agents Web</h1>
        <div style={{ color: '#dc2626', marginBottom: '1rem' }}>Error: {error}</div>
        <button onClick={handleRetry} style={{ padding: '8px 16px' }}>Retry</button>
      </div>
    )
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Craft Agents Web</h1>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Connection Status</h2>
        <p>WebSocket: <strong style={{
          color: connectionStatus === 'connected' ? '#16a34a' :
                 connectionStatus === 'connecting' ? '#ca8a04' : '#dc2626'
        }}>{connectionStatus}</strong></p>
        {lastEvent && (
          <p>Last event: <code style={{
            backgroundColor: '#f3f4f6',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>{lastEvent.type}</code></p>
        )}
      </section>

      <LoadingState isLoading={isLoading} message="Loading data...">
        <section style={{ marginBottom: '1.5rem' }}>
          <h2>Workspaces ({workspaces.length})</h2>
          {workspaces.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No workspaces found</p>
          ) : (
            <ul>
              {workspaces.map((ws: any) => (
                <li key={ws.id}>{ws.name || ws.id}</li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2>Sessions ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <p style={{ color: '#6b7280' }}>No sessions found</p>
          ) : (
            <ul>
              {sessions.map((s: any) => (
                <li key={s.id}>{s.name || s.id}</li>
              ))}
            </ul>
          )}
        </section>
      </LoadingState>
    </div>
  )
}

function App() {
  return (
    <NetworkErrorBoundary>
      <AppContent />
    </NetworkErrorBoundary>
  )
}

export default App

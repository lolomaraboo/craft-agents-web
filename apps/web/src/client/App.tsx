import React, { useState, useCallback } from 'react'

function App() {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected')
  const [lastMessage, setLastMessage] = useState<string | null>(null)

  const testWebSocket = useCallback(() => {
    setConnectionStatus('connecting')

    // Connect to WebSocket via Vite proxy (dev) or direct (prod)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      console.log('WebSocket connected')
      setConnectionStatus('connected')
    }

    ws.onmessage = (event) => {
      console.log('WebSocket message:', event.data)
      setLastMessage(event.data)
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setConnectionStatus('disconnected')
    }

    ws.onclose = () => {
      console.log('WebSocket closed')
      setConnectionStatus('disconnected')
    }
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Craft Agents Web</h1>
      <p>Connection status: <strong>{connectionStatus}</strong></p>
      {lastMessage && (
        <p>Last message: <code>{lastMessage}</code></p>
      )}
      <button
        onClick={testWebSocket}
        disabled={connectionStatus === 'connecting'}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: connectionStatus === 'connecting' ? 'wait' : 'pointer'
        }}
      >
        {connectionStatus === 'connecting' ? 'Connecting...' : 'Test WebSocket Connection'}
      </button>
    </div>
  )
}

export default App

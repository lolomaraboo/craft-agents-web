import React from 'react'
import { createRoot } from 'react-dom/client'
import { HttpAdapter } from './adapters'
import App from './App'

// Inject HTTP adapter as window.electronAPI
// This allows existing components expecting window.electronAPI to work unchanged
const adapter = new HttpAdapter()
;(window as any).electronAPI = adapter

// Connect WebSocket early
adapter.connect()

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

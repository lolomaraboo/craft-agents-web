import React from 'react'
import { createRoot } from 'react-dom/client'
import { Provider as JotaiProvider } from 'jotai'
import { HttpAdapter } from './adapters'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { Toaster } from '@/components/ui/sonner'
import './index.css'

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
    <JotaiProvider>
      <ThemeProvider>
        <App />
        <Toaster />
      </ThemeProvider>
    </JotaiProvider>
  </React.StrictMode>
)

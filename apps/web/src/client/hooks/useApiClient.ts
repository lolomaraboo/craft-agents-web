import type { WebElectronAPI } from '../types'

/**
 * Access the HTTP adapter injected as window.electronAPI.
 * Throws if adapter not initialized (bootstrap error).
 */
export function useApiClient(): WebElectronAPI {
  const api = (window as any).electronAPI as WebElectronAPI | undefined
  if (!api) {
    throw new Error('electronAPI not initialized. Ensure HttpAdapter is injected in main.tsx')
  }
  return api
}

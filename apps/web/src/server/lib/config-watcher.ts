import { createConfigWatcher, type ConfigWatcherCallbacks } from '@craft-agent/shared/config'
import { broadcastGlobal } from './websocket-events.js'
import type { FastifyInstance } from 'fastify'

let watcher: ReturnType<typeof createConfigWatcher> | null = null

/**
 * Setup config file watcher and broadcast changes to all clients
 *
 * Watches for changes to:
 * - config.json: Main app configuration
 * - theme.json: App-level theme overrides
 *
 * Broadcasts config_changed events to all connected WebSocket clients
 */
export function setupConfigWatcher(fastify: FastifyInstance): void {
  const callbacks: ConfigWatcherCallbacks = {
    onConfigChange: (config) => {
      fastify.log.info('Config changed, broadcasting to clients')
      broadcastGlobal({ type: 'config_changed', changeType: 'config' })
    },
    onAppThemeChange: (theme) => {
      fastify.log.info('Theme changed, broadcasting to clients')
      broadcastGlobal({ type: 'config_changed', changeType: 'theme' })
    }
  }

  // Use a placeholder workspace ID for the watcher (required by API)
  // The ConfigWatcher will watch global config files (config.json, theme.json) at ~/.craft-agent/
  // and workspace-specific files if they exist
  const placeholderWorkspaceId = 'web-server'

  try {
    watcher = createConfigWatcher(placeholderWorkspaceId, callbacks)
    fastify.log.info('Config watcher started successfully')
  } catch (error) {
    // Graceful fallback if config watcher fails (e.g., file system issues)
    fastify.log.warn({ error }, 'Failed to start config watcher - continuing without live config updates')
  }
}

/**
 * Stop config file watcher
 */
export function stopConfigWatcher(): void {
  if (watcher) {
    watcher.stop()
    watcher = null
  }
}

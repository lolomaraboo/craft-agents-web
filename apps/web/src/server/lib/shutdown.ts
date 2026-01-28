import type { FastifyInstance } from 'fastify'
import { stopConfigWatcher } from './config-watcher.js'

export async function setupGracefulShutdown(fastify: FastifyInstance): Promise<void> {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']

  for (const signal of signals) {
    process.on(signal, async () => {
      fastify.log.info({ signal }, 'Received shutdown signal')

      try {
        // Stop config watcher before closing server
        stopConfigWatcher()
        await fastify.close()
        fastify.log.info('Server closed successfully')
        process.exit(0)
      } catch (err) {
        fastify.log.error({ err }, 'Error during shutdown')
        process.exit(1)
      }
    })
  }
}

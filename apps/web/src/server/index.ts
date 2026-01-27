import Fastify, { type FastifyInstance } from 'fastify'
import { getConfig, type ServerConfig } from './lib/config.js'
import { setupGracefulShutdown } from './lib/shutdown.js'
import { websocketPlugin } from './plugins/websocket.js'

export async function createServer(config: ServerConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.isDev ? 'debug' : 'info',
      transport: config.isDev
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined
    }
  })

  // Register WebSocket plugin (must be registered before routes)
  await fastify.register(websocketPlugin)

  return fastify
}

export async function startServer(): Promise<void> {
  const config = getConfig()
  const fastify = await createServer(config)

  setupGracefulShutdown(fastify)

  try {
    await fastify.listen({ port: config.port, host: config.host })
    fastify.log.info(`Server listening on ${config.host}:${config.port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Run directly if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  startServer()
}

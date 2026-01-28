import Fastify, { type FastifyInstance } from 'fastify'
import { getConfig, type ServerConfig } from './lib/config.js'
import { setupGracefulShutdown } from './lib/shutdown.js'
import { setupConfigWatcher, stopConfigWatcher } from './lib/config-watcher.js'
import corsPlugin from './plugins/cors.js'
import multipartPlugin from './plugins/multipart.js'
import { websocketPlugin } from './plugins/websocket.js'
import apiRoutes from './routes/api/index.js'
import { staticPlugin } from './plugins/static.js'

export async function createServer(config: ServerConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: config.isDev ? 'debug' : 'info',
      transport: config.isDev
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' } }
        : undefined
    }
  })

  // Register CORS plugin (must be registered before websocket plugin)
  await fastify.register(corsPlugin)

  // Register multipart plugin (must be registered before API routes)
  await fastify.register(multipartPlugin)

  // Register WebSocket plugin (must be registered before static plugin)
  await fastify.register(websocketPlugin)

  // Register API routes (after websocket, so /api routes don't conflict with /ws)
  await fastify.register(apiRoutes)

  // Register static file serving plugin (disabled in dev mode - Vite handles frontend)
  await fastify.register(staticPlugin, { enabled: !config.isDev })

  return fastify
}

export async function startServer(): Promise<void> {
  const config = getConfig()
  const fastify = await createServer(config)

  setupGracefulShutdown(fastify)

  try {
    await fastify.listen({ port: config.port, host: config.host })
    fastify.log.info(`Server listening on ${config.host}:${config.port}`)

    // Start config watcher after server is ready
    setupConfigWatcher(fastify)
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

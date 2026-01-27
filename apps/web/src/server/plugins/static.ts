import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import fastifyStatic from '@fastify/static'
import fp from 'fastify-plugin'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface StaticPluginOptions {
  enabled: boolean
}

async function staticPluginImpl(
  fastify: FastifyInstance,
  options: StaticPluginOptions
): Promise<void> {
  // Skip in dev mode - Vite handles frontend
  if (!options.enabled) {
    fastify.log.debug('Static plugin disabled (dev mode)')
    return
  }

  // Register @fastify/static for serving built client files
  await fastify.register(fastifyStatic, {
    root: path.join(__dirname, '../../../dist/client'),
    prefix: '/',
    wildcard: false // We handle fallback manually for SPA
  })

  // SPA fallback: serve index.html for non-API, non-WS GET requests
  fastify.setNotFoundHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Only handle GET requests
      if (request.method !== 'GET') {
        return reply.status(404).send({ error: 'Not found' })
      }

      // Don't handle API or WebSocket paths
      if (request.url.startsWith('/api') || request.url.startsWith('/ws')) {
        return reply.status(404).send({ error: 'Not found' })
      }

      // Serve index.html for SPA routing
      return reply.sendFile('index.html')
    }
  )

  fastify.log.info('Static file serving enabled')
}

// Export plugin wrapped with fastify-plugin for proper encapsulation
export const staticPlugin = fp(staticPluginImpl, {
  name: 'static-plugin',
  fastify: '5.x'
})

import fp from 'fastify-plugin'
import cors from '@fastify/cors'
import type { FastifyPluginAsync } from 'fastify'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  const isDev = process.env.NODE_ENV === 'development'

  if (isDev) {
    await fastify.register(cors, {
      origin: 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
    })
    fastify.log.info('CORS enabled for development (Vite dev server)')
  }
}

export default fp(corsPlugin, {
  name: 'cors-plugin'
})

import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import type { FastifyPluginAsync } from 'fastify'

const multipartPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: {
      fileSize: 20 * 1024 * 1024, // 20MB limit (matches Electron app)
      files: 10 // Max 10 files per request
    },
    attachFieldsToBody: false // Use request.parts() async iterator
  })

  fastify.log.info('Multipart plugin registered (20MB file size limit)')
}

export default fp(multipartPlugin, {
  name: 'multipart-plugin'
})

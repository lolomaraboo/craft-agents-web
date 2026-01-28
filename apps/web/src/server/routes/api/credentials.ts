import type { FastifyPluginAsync } from 'fastify'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import {
  CredentialSchema,
  CreateCredentialSchema,
  CredentialListSchema,
} from '../../schemas/credential.js'

export const credentialsRoutes: FastifyPluginAsync = async (fastify) => {
  const credentialManager = getCredentialManager()

  // GET /api/credentials - List all stored credentials (metadata only, no values)
  fastify.get('/credentials', {
    schema: {
      response: {
        200: CredentialListSchema,
      },
    },
  }, async () => {
    // List all credentials (returns IDs only, no values)
    const credentialIds = await credentialManager.list()

    // Convert credential IDs to metadata format
    const credentials = credentialIds.map(id => ({
      id: JSON.stringify(id),
      name: id.type, // Use type as name for now
      type: id.type,
      createdAt: new Date().toISOString(), // Placeholder - actual timestamps not stored in current implementation
    }))

    return { credentials }
  })

  // POST /api/credentials - Add a new credential
  fastify.post<{
    Body: {
      name: string
      type: string
      value: string
    }
  }>('/credentials', {
    schema: {
      body: CreateCredentialSchema,
      response: {
        201: CredentialSchema,
      },
    },
  }, async (request, reply) => {
    const { name, type, value } = request.body

    // Store credential securely
    await credentialManager.set(
      { type: type as any },
      { value }
    )

    reply.code(201)
    return {
      id: JSON.stringify({ type }),
      name,
      type,
      createdAt: new Date().toISOString(),
    }
  })

  // DELETE /api/credentials/:id - Remove a credential
  fastify.delete<{
    Params: { id: string }
  }>('/credentials/:id', {
    schema: {
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Parse credential ID
      const credentialId = JSON.parse(request.params.id)

      // Delete credential
      const deleted = await credentialManager.delete(credentialId)

      if (!deleted) {
        reply.code(404)
        return { error: 'Credential not found' }
      }

      reply.code(204)
      return null
    } catch {
      reply.code(404)
      return { error: 'Invalid credential ID' }
    }
  })
}
